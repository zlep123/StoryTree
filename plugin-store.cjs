'use strict';

const fs=require('node:fs/promises');
const path=require('node:path');
const PluginAPI=require('./plugin-api.js');
const {writeAtomic}=require('./project-files.cjs');

const MAX_PLUGINS=32;
const MAX_REGISTRY=12*1024*1024;
const metadata=({plugin:{source,...manifest},enabled})=>({...manifest,enabled});

async function readText(file,limit){
  const handle=await fs.open(file,'r');
  try{
    const stat=await handle.stat();
    if(!stat.isFile()||stat.size>limit)throw Error('插件文件过大或格式无效。');
    const bytes=await handle.readFile();
    if(bytes.length>limit)throw Error('插件文件过大或格式无效。');
    try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
    catch{throw Error('插件文件须为有效的 UTF-8 JSON。');}
  }finally{await handle.close();}
}
function parse(text){
  try{return JSON.parse(text);}
  catch{throw Error('插件文件须为有效的 UTF-8 JSON。');}
}

class PluginStore{
  constructor(directory){
    this.file=path.join(directory,'plugins.json');
    this.queue=Promise.resolve();
  }
  async read(){
    let text;
    try{text=await readText(this.file,MAX_REGISTRY);}
    catch(error){if(error.code==='ENOENT')return [];throw error;}
    const registry=parse(text);
    if(registry?.version!==1||!Array.isArray(registry.plugins)||registry.plugins.length>MAX_PLUGINS)
      throw Error('插件登记文件无效。');
    const records=registry.plugins.map(record=>{
      if(typeof record?.enabled!=='boolean')throw Error('插件登记文件无效。');
      return {enabled:record.enabled,plugin:PluginAPI.validatePackage(record.plugin)};
    });
    if(new Set(records.map(({plugin})=>plugin.id)).size!==records.length)throw Error('插件登记文件包含重复标识。');
    return records;
  }
  list(){
    return this.queue.then(async()=> (await this.read()).map(metadata));
  }
  mutate(update){
    const job=this.queue.then(async()=>{
      const records=await this.read();
      const result=update(records);
      const text=JSON.stringify({version:1,plugins:records});
      if(Buffer.byteLength(text,'utf8')>MAX_REGISTRY)throw Error('插件文件过大或格式无效。');
      await writeAtomic(this.file,text);
      return result;
    });
    this.queue=job.catch(()=>{});
    return job;
  }
  async install(file){
    const plugin=PluginAPI.validatePackage(parse(await readText(file,PluginAPI.PACKAGE_LIMIT)));
    return this.mutate(records=>{
      const index=records.findIndex(entry=>entry.plugin.id===plugin.id);
      const existing=records[index];
      if(existing&&PluginAPI.compareVersions(plugin.version,existing.plugin.version)<=0)
        throw Error('已安装相同或更高版本的插件。');
      if(!existing&&records.length>=MAX_PLUGINS)throw Error('最多可安装 32 个插件。');
      const addedPermissions=plugin.permissions.some(permission=>!existing?.plugin.permissions.includes(permission));
      const record={plugin,enabled:!!existing?.enabled&&!addedPermissions};
      if(existing)records[index]=record;
      else records.push(record);
      return metadata(record);
    });
  }
  setEnabled(id,enabled){
    if(typeof enabled!=='boolean')throw Error('插件状态无效。');
    return this.mutate(records=>{
      const record=records.find(entry=>entry.plugin.id===id);
      if(!record)throw Error('找不到此插件。');
      record.enabled=enabled;
      return metadata(record);
    });
  }
  remove(id){
    return this.mutate(records=>{
      const index=records.findIndex(entry=>entry.plugin.id===id);
      if(index<0)throw Error('找不到此插件。');
      records.splice(index,1);
      return true;
    });
  }
  action(id,actionId,version){
    return this.queue.then(async()=>{
      const record=(await this.read()).find(entry=>entry.plugin.id===id);
      if(!record?.enabled)throw Error('此插件尚未启用。');
      if(version!==undefined&&record.plugin.version!==version)throw Error('插件已更新，请重新打开操作。');
      const action=record.plugin.actions.find(entry=>entry.id===actionId);
      if(!action)throw Error('找不到此插件操作。');
      return {manifest:metadata(record),action,source:record.plugin.source};
    });
  }
}
module.exports={PluginStore};
