'use strict';
const fs=require('node:fs'),path=require('node:path'),{startServer}=require('./server.cjs');
const args=process.argv.slice(2),index=args.indexOf('--data'),directory=path.resolve(index>=0?args[index+1]:path.join(__dirname,'../../data'));
fs.mkdirSync(directory,{recursive:true});const lock=path.join(directory,'.service.lock');let fd;
try{fd=fs.openSync(lock,'wx');fs.writeSync(fd,String(process.pid));}
catch(e){try{const pid=Number(fs.readFileSync(lock));process.kill(pid,0);process.exit(0);}catch{try{fs.unlinkSync(lock);}catch{}fd=fs.openSync(lock,'wx');fs.writeSync(fd,String(process.pid));}}
const cleanup=()=>{try{fs.closeSync(fd);if(Number(fs.readFileSync(lock))===process.pid)fs.unlinkSync(lock);}catch{}};
process.on('exit',cleanup);
startServer(directory).then(info=>{
 let stopping=false;
 const stop=()=>{
   if(stopping)return;
   stopping=true;
   info.server.close(()=>info.store.queue.finally(()=>process.exit(0)));
 };
 process.on('SIGTERM',stop);process.on('SIGINT',stop);
 setInterval(()=>{if(Date.now()-info.lastAccess()>15*60*1000)stop();},30000).unref();
}).catch(e=>{process.stderr.write(e.stack+'\n');process.exit(1);});
