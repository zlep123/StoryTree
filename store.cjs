'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ST = require('./core.js');
class Store {
  constructor(directory) {
    this.directory=directory;fs.mkdirSync(directory,{recursive:true});
    this.file=path.join(directory,'story.storytree.json');this.undoStack=[];this.redoStack=[];
    if(fs.existsSync(this.file)) {
      try {this.project=ST.validateProject(JSON.parse(fs.readFileSync(this.file,'utf8')));}
      catch(e) {throw Error('项目无法读取，原文件已保留。请从 backups 恢复。'+e.message);}
    }else {this.project=ST.demoProject();this.persist();}
  }
  persist() {
    const text=JSON.stringify(this.project,null,2), temp=this.file+'.tmp';
    if(fs.existsSync(this.file)) {
      const dir=path.join(this.directory,'backups');fs.mkdirSync(dir,{recursive:true});
      fs.copyFileSync(this.file,path.join(dir,`story-${String(this.project.revision).padStart(8,'0')}-${Date.now()}.json`));
      const files=fs.readdirSync(dir).filter(f=>/^story-\d+-\d+\.json$/.test(f)).sort();
      for(const f of files.slice(0,-40))fs.unlinkSync(path.join(dir,f));
    }
    fs.writeFileSync(temp,text,'utf8');fs.renameSync(temp,this.file);
  }
  commit(p,source,description) {
    const old=this.project;p.revision=old.revision+1;p.updatedAt=new Date().toISOString();
    p.audit=[...(old.audit||[]),{at:p.updatedAt,revision:p.revision,source,description}].slice(-200);
    this.project=p;
    try{this.persist();}catch(e){this.project=old;throw e;}
    return this.project;
  }
  check(revision) {if(revision!==undefined && revision!==this.project.revision){const e=Error('项目已被其他窗口或 AI 更新，请刷新后重试');e.status=409;throw e;}}
  execute(commands,revision,source='界面') {
    this.check(revision);const old=this.project;const r=ST.execute(old,commands);
    this.commit(r.project,source,commands.map(c=>c.type).join(', '));
    this.undoStack.push(old);this.undoStack=this.undoStack.slice(-60);this.redoStack=[];
    return {project:this.project,results:r.results};
  }
  replace(p,revision,source='界面') {
    this.check(revision);p=ST.clone(p);ST.validateProject(p);
    const old=this.project;this.commit(p,source,'导入项目');this.undoStack.push(old);this.redoStack=[];return {project:this.project};
  }
  history(action,revision) {
    this.check(revision);const from=action==='undo'?this.undoStack:this.redoStack,to=action==='undo'?this.redoStack:this.undoStack;
    if(!from.length)throw Error(action==='undo'?'没有可撤销的操作':'没有可重做的操作');
    const p=from.at(-1),old=this.project;this.commit(ST.clone(p),'界面',action);from.pop();to.push(old);return {project:this.project};
  }
}
module.exports={Store};
