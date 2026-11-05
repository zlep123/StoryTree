'use strict';
// Runs inside the bundled Electron binary in Node mode: a pure stdio stream.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {serveStdio}=require('./mcp.cjs');
const args=process.argv.slice(2),i=args.indexOf('--data');
const base=path.resolve(__dirname,'../..');
const exe=fs.existsSync(path.join(base,'StoryTree.exe'))?path.join(base,'StoryTree.exe'):path.join(__dirname,'node_modules/electron/dist/electron.exe');
const directory=path.resolve(i>=0?args[i+1]:process.env.STORYTREE_DATA||path.join(fs.existsSync(path.join(base,'StoryTree.exe'))?base:__dirname,'data'));
async function existing(){try{const c=JSON.parse(fs.readFileSync(path.join(directory,'.service.json'),'utf8'));const r=await fetch(`http://127.0.0.1:${c.port}/api/project`,{headers:{'X-StoryTree-Token':c.token},signal:AbortSignal.timeout(1000)});if(r.ok)return c;}catch{}return null;}
let connection,starting;
async function ensure(){const c=await existing();if(c)return c;if(starting)return starting;starting=(async()=>{
 fs.mkdirSync(directory,{recursive:true});const env={...process.env,ELECTRON_RUN_AS_NODE:'1'};delete env.NODE_OPTIONS;
 const fd=fs.openSync(path.join(directory,'service.log'),'a');
 const child=spawn(exe,[path.join(__dirname,'service.cjs'),'--data',directory],{detached:true,stdio:['ignore',fd,fd],windowsHide:true,env});child.on('error',e=>process.stderr.write(e.message+'\n'));child.unref();fs.closeSync(fd);
 for(let n=0;n<120;n++){await new Promise(r=>setTimeout(r,100));const s=await existing();if(s)return s;}throw Error('StoryTree 数据服务启动失败');
 })();try{return await starting;}finally{starting=null;}}
serveStdio(async(name,arguments_)=>{connection=await ensure();const r=await fetch(`http://127.0.0.1:${connection.port}/api/mcp`,{method:'POST',headers:{'Content-Type':'application/json','X-StoryTree-Token':connection.token},body:JSON.stringify({name,arguments:arguments_})});const j=await r.json();if(!r.ok)throw Error(j.error);return j.result;});
