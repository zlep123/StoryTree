'use strict';

const fs=require('node:fs/promises');
const path=require('node:path');
const ST=require('./core.js');
const {decodeSnapshot,encodeSnapshot,writeAtomic}=require('./project-files.cjs');

const HISTORY_COUNT=60;
const HISTORY_BYTES=64*1024*1024;
const BACKUP_COUNT=40;
const snapshot=text=>({text,bytes:Buffer.byteLength(text,'utf8')});

function pushHistory(stack,entry){
  stack.push(entry);
  let bytes=0,keep=0;
  for(let i=stack.length-1;i>=0&&keep<HISTORY_COUNT;i--){
    bytes+=stack[i].bytes;
    if(keep&&bytes>HISTORY_BYTES)break;
    keep++;
  }
  if(stack.length>keep)stack.splice(0,stack.length-keep);
}

class Store {
  constructor(directory){
    this.directory=directory;
    this.file=path.join(directory,'story.storytree.json');
    this.media=path.join(directory,'media');
    this.backups=path.join(directory,'backups');
    this.undoStack=[];
    this.redoStack=[];
    this.queue=Promise.resolve();
  }
  static async open(directory){
    const store=new Store(directory);
    await fs.mkdir(directory,{recursive:true});
    let text;
    try{text=await fs.readFile(store.file,'utf8');}
    catch(error){if(error.code!=='ENOENT')throw error;}
    if(text===undefined){
      store.project=ST.demoProject();
      store.images=new Map();
      const next=await store.write(store.project);
      store.snapshot=next.snapshot;
      store.images=next.images;
    }else{
      try{
        const {project,images}=await decodeSnapshot(text,store.media);
        store.project=ST.validateProject(project,{legacyNumbers:true});
        store.images=images;
        store.snapshot=snapshot(text);
      }catch(error){throw Error('项目无法读取，原文件已保留。请从 backups 恢复。'+error.message,{cause:error});}
    }
    return store;
  }
  async write(project){
    const next=await encodeSnapshot(project,this.media,this.images);
    const makeBackup=this.snapshot&&async function(){
      await fs.mkdir(this.backups,{recursive:true});
      const name='story-'+String(project.revision).padStart(8,'0')+'-'+Date.now()+'.json';
      await fs.copyFile(this.file,path.join(this.backups,name));
    }.bind(this);
    await writeAtomic(this.file,next.text,makeBackup);
    return {snapshot:snapshot(next.text),images:next.images};
  }
  async pruneBackups(){
    try{
      const names=(await fs.readdir(this.backups)).filter(name=>/^story-\d+-\d+\.json$/u.test(name)).sort();
      for(const name of names.slice(0,-BACKUP_COUNT)){
        try{await fs.unlink(path.join(this.backups,name));}
        catch(error){console.warn('StoryTree backup cleanup:',error.code||error.name);}
      }
    }catch(error){console.warn('StoryTree backup listing:',error.code||error.name);}
  }
  enqueue(task){
    const job=this.queue.then(task);
    this.queue=job.catch(()=>{});
    return job;
  }
  async commit(project,source,description){
    const old=this.project;
    project.revision=old.revision+1;
    project.updatedAt=new Date().toISOString();
    project.audit=[...(old.audit||[]),{at:project.updatedAt,revision:project.revision,source,description}].slice(-200);
    const next=await this.write(project);
    this.project=project;
    this.snapshot=next.snapshot;
    this.images=next.images;
  }
  check(revision){
    if(revision!==undefined&&revision!==this.project.revision){
      throw Object.assign(Error('项目已被其他窗口或 AI 更新，请刷新后重试'),{status:409});
    }
  }
  execute(commands,revision,source='界面'){
    return this.enqueue(async()=>{
      this.check(revision);
      const old=this.snapshot;
      const result=ST.execute(this.project,commands);
      await this.commit(result.project,source,commands.map(c=>c.type).join(', '));
      pushHistory(this.undoStack,old);
      this.redoStack=[];
      await this.pruneBackups();
      return result;
    });
  }
  replace(project,revision,source='界面'){
    return this.enqueue(async()=>{
      this.check(revision);
      const old=this.snapshot;
      const next=ST.validateProject(ST.clone(project),{legacyNumbers:true});
      await this.commit(next,source,'导入项目');
      pushHistory(this.undoStack,old);
      this.redoStack=[];
      await this.pruneBackups();
      return {project:this.project};
    });
  }
  history(action,revision){
    return this.enqueue(async()=>{
      this.check(revision);
      if(!['undo','redo'].includes(action))throw Error('撤销或重做命令无效');
      const from=action==='undo'?this.undoStack:this.redoStack;
      const to=action==='undo'?this.redoStack:this.undoStack;
      if(!from.length)throw Error(action==='undo'?'没有可撤销的操作':'没有可重做的操作');
      const old=this.snapshot;
      const {project}=await decodeSnapshot(from.at(-1).text,this.media,this.images);
      await this.commit(ST.validateProject(project,{legacyNumbers:true}),'界面',action);
      from.pop();
      pushHistory(to,old);
      await this.pruneBackups();
      return {project:this.project};
    });
  }
}
module.exports={Store};
