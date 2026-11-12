'use strict';

const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {setTimeout:delay}=require('node:timers/promises');

const STORAGE_KEY='_storytreeStorage';
const MEDIA_PREFIX='storytree-media:';
const MEDIA_FILE=/^([0-9a-f]{64})\.(png|jpeg|webp|gif)$/u;
const DATA_IMAGE=/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/u;
const MAX_MEDIA_BYTES=9_000_000;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const imageSlot=(object,key)=>key==='image'||(key==='value'&&object.kind==='characterField'&&object.key==='image');

async function writeAtomic(file,data,beforeReplace){
  const temp=path.join(path.dirname(file),'.'+path.basename(file)+'.'+randomUUID()+'.tmp');
  try{
    await fs.writeFile(temp,data,{flag:'wx',flush:true});
    if(beforeReplace)await beforeReplace();
    for(let attempt=0;;attempt++){
      try{await fs.rename(temp,file);return;}
      catch(error){
        if(process.platform!=='win32'||attempt===4||!['EPERM','EACCES','EBUSY'].includes(error.code))throw error;
        await delay(25*(attempt+1));
      }
    }
  }catch(error){
    await fs.unlink(temp).catch(()=>{});
    throw error;
  }
}

async function readBlob(directory,name){
  const [,hash,type]=MEDIA_FILE.exec(name)||[];
  if(!hash)throw Error('图片资源引用无效');
  const file=await fs.open(path.join(directory,name),'r');
  try{
    const info=await file.stat();
    if(!info.isFile()||info.size>MAX_MEDIA_BYTES)throw Error('图片资源无效或过大');
    const bytes=await file.readFile();
    if(digest(bytes)!==hash)throw Error('图片资源校验失败');
    return 'data:image/'+type+';base64,'+bytes.toString('base64');
  }finally{await file.close();}
}

async function decodeSnapshot(text,mediaDirectory,known=new Map()){
  const slots=[];
  const project=JSON.parse(text,function(key,value){
    if(imageSlot(this,key)&&typeof value==='string'&&value.startsWith(MEDIA_PREFIX)){
      slots.push({record:this,key,name:value.slice(MEDIA_PREFIX.length)});
    }
    return value;
  });
  const images=new Map();
  if(!project||!Object.hasOwn(project,STORAGE_KEY))return {project,images};
  if(project[STORAGE_KEY]!==1)throw Error('此版本无法读取该项目存储格式');
  delete project[STORAGE_KEY];
  const cached=new Map([...known].map(([value,name])=>[name,value]));
  for(const {record,key,name} of slots){
    if(!MEDIA_FILE.test(name))throw Error('图片资源引用无效');
    let value=cached.get(name);
    if(!value){
      try{value=await readBlob(mediaDirectory,name);}
      catch(error){if(error.code==='ENOENT')throw Error('缺少图片资源，请保留项目旁的 media 文件夹');throw error;}
      cached.set(name,value);
    }
    record[key]=value;
    images.set(value,name);
  }
  return {project,images};
}

async function encodeSnapshot(project,mediaDirectory,known){
  const images=new Map(),additions=new Map();
  const text=JSON.stringify(project,function(key,value){
    if(!imageSlot(this,key)||typeof value!=='string'||!value.startsWith('data:image/'))return value;
    let name=images.get(value)||known.get(value);
    if(!name){
      const image=DATA_IMAGE.exec(value);
      if(!image)return value;
      const bytes=Buffer.from(image[2],'base64');
      if(!bytes.length||bytes.length>MAX_MEDIA_BYTES)throw Error('图片资源无效或过大');
      name=digest(bytes)+'.'+image[1];
      additions.set(name,bytes);
    }
    images.set(value,name);
    return MEDIA_PREFIX+name;
  });
  if(additions.size){
    await fs.mkdir(mediaDirectory,{recursive:true});
    for(const [name,bytes] of additions){
      try{await readBlob(mediaDirectory,name);}
      catch(error){
        if(error.code!=='ENOENT')throw error;
        await writeAtomic(path.join(mediaDirectory,name),bytes);
      }
    }
  }
  return {text:images.size?'{"'+STORAGE_KEY+'":1,'+text.slice(1):text,images};
}

module.exports={decodeSnapshot,encodeSnapshot,writeAtomic};
