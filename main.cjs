'use strict';
const {app,BrowserWindow,ipcMain,dialog,shell}=require('electron');
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {startServer}=require('./server.cjs'),{serveStdio}=require('./mcp.cjs');
const {displaySettings}=require('./core.js');
const {decodeSnapshot,writeAtomic}=require('./project-files.cjs');
const {checkUpdate}=require('./update.cjs');
const {PluginStore}=require('./plugin-store.cjs');
const args=process.argv.slice(1),isMcp=args.includes('--mcp'),isService=args.includes('--service');
function arg(name){const i=args.indexOf(name);return i>=0?args[i+1]:undefined;}
const directory=path.resolve(arg('--data')||process.env.STORYTREE_DATA||path.join(app.isPackaged?path.dirname(process.execPath):__dirname,'data'));
const plugins=new PluginStore(directory);
const runtimeDirectory=path.join(directory,'.runtime',isService?'service':isMcp?'mcp-'+process.pid:'desktop');
fs.mkdirSync(runtimeDirectory,{recursive:true});app.setPath('userData',runtimeDirectory);app.setPath('sessionData',runtimeDirectory);
if(isService||isMcp){app.disableHardwareAcceleration();app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');}
const log=text=>{try{fs.appendFileSync(path.join(directory,'startup.log'),new Date().toISOString()+' '+process.pid+' '+text+'\n');}catch{}};
log(isMcp?'MCP starting':isService?'Service starting':'Desktop starting');
const connectionFile=path.join(directory,'.service.json');let connection,window,starting;
async function existing(){
  try{
    const c=JSON.parse(fs.readFileSync(connectionFile,'utf8'));
    const r=await fetch(`http://127.0.0.1:${c.port}/api/project?revision=0`,{headers:{'X-StoryTree-Token':c.token},signal:AbortSignal.timeout(1000)});
    await r.body?.cancel();
    if(r.ok)return c;
  }catch{}
  return null;
}
async function startConnection(){let c=await existing();if(c)return c;
  log('Starting data service');
  const serviceArgs=[path.join(__dirname,'service.cjs'),'--data',directory];
  const env={...process.env,ELECTRON_RUN_AS_NODE:'1'};delete env.NODE_OPTIONS;
  const logFd=fs.openSync(path.join(directory,'service.log'),'a');
  const child=spawn(process.execPath,serviceArgs,{detached:true,stdio:['ignore',logFd,logFd],windowsHide:true,env});child.on('error',e=>log('Service spawn error: '+e.message));child.unref();fs.closeSync(logFd);
  const deadline=Date.now()+8000;
  while(Date.now()<deadline){await new Promise(r=>setTimeout(r,120));c=await existing();if(c)return c;}
  throw Error('本地数据服务启动失败，请检查 data 目录是否可写');
}
function ensure(){
  if(!starting)starting=startConnection().then(c=>connection=c).finally(()=>{starting=null;});
  return starting;
}
async function projectRequest(route,body){
  const read=route==='script-example.txt'||/^project(?:\?revision=\d+)?$/u.test(route);
  const excel=/^excel\?kind=(?:item|character)$/u.test(route);
  const write=['commands','history','import'].includes(route);
  if(!read&&!excel&&!write)throw Error('Invalid project request');
  if(write && !Number.isSafeInteger(body?.revision))throw Error('Missing project revision');
  if(excel && (!(body instanceof Uint8Array)||body.byteLength>5*1024*1024))return {status:400,value:{error:'Excel 文件最大为 5 MB'}};
  const request=async(c)=>{
    const endpoint=route==='script-example.txt'?route:'api/'+route;
    const payload=read?undefined:excel?body:JSON.stringify(body);
    const r=await fetch(`http://127.0.0.1:${c.port}/${endpoint}`,{
      method:read?'GET':'POST',
      headers:{'Content-Type':excel?'application/octet-stream':'application/json','X-StoryTree-Token':c.token},
      body:payload,signal:AbortSignal.timeout(excel?12000:5000)
    });
    const value=r.status===204?null:route==='script-example.txt'?await r.text():await r.json();
    return {status:r.status,value};
  };
  try{
    try{
      const result=await request(connection||await ensure());
      if(result.status!==401)return result;
    }catch(error){log('Project service request interrupted: '+route.split('?')[0]+' '+(error.cause?.code||error.name));}
    // Reuse the same expected revision. If the first write committed, replay is rejected.
    return await request(await ensure());
  }catch(error){
    log('Project service reconnect failed: '+(error.cause?.code||error.name));
    return {status:503,value:{error:'本地数据服务暂时无法连接，请重试保存。'}};
  }
}
function mcpEntry(){return app.isPackaged?{command:path.join(path.dirname(process.execPath),'StoryTree.MCP.exe'),args:[]}:{command:process.execPath,args:[path.join(__dirname,'mcp-server.cjs')],env:{ELECTRON_RUN_AS_NODE:'1'}};}
function config(){return {mcpServers:{storytree:mcpEntry()}};}
async function remote(name,arguments_){connection=await ensure();const r=await fetch(`http://127.0.0.1:${connection.port}/api/mcp`,{method:'POST',headers:{'Content-Type':'application/json','X-StoryTree-Token':connection.token},body:JSON.stringify({name,arguments:arguments_})});const j=await r.json();if(!r.ok)throw Error(j.error);return j.result;}
async function createWindow(){
  connection=await ensure();window=new BrowserWindow({width:1560,height:960,minWidth:1080,minHeight:700,backgroundColor:'#101219',title:desktopLabel('StoryTree · 故事树','StoryTree'),autoHideMenuBar:true,icon:path.join(__dirname,'logo.ico'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  const base=`http://127.0.0.1:${connection.port}`;
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(e,url)=>{if(url!==base+'/')e.preventDefault();});
  window.webContents.session.setPermissionRequestHandler((_wc,_p,cb)=>cb(false));
  let closing=false,checking=false;
  window.on('close',async event=>{
    if(closing)return;
    event.preventDefault();
    if(checking)return;
    checking=true;
    try{
      if(await finishEditing(window)){
        closing=true;
        if(!window.isDestroyed())window.close();
      }
    }catch(error){
      log('Close save check failed: '+error.name);
      if(!window.isDestroyed())await dialog.showMessageBox(window,{type:'error',message:desktopLabel('无法保存恢复副本，编辑窗口仍然打开。','The recovery copy could not be saved. The editor is still open.'),detail:error.message});
    }finally{checking=false;}
  });
  await window.loadURL(base+'/');
}
async function evaluateInTime(window,code,timeout){
  let timer;
  try{
    return await Promise.race([window.webContents.executeJavaScript(code),new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(Error('Renderer timed out')),timeout);
    })]);
  }finally{clearTimeout(timer);}
}
async function finishEditing(window){
  while(!window.isDestroyed()){
    try{
      if(await evaluateInTime(window,'window.flushEdits ? window.flushEdits() : true',25000))return true;
    }catch(error){log('Pending edits could not be checked: '+error.name);}
    const {response}=await dialog.showMessageBox(window,{
      type:'warning',message:desktopLabel('有内容尚未保存','Some edits are still unsaved'),
      detail:desktopLabel('可以返回编辑、重试，或另存一份包含待保存内容的恢复副本。','Return to the editor, retry saving, or save a separate recovery copy with the pending edits.'),
      buttons:[desktopLabel('返回编辑','Return to editor'),desktopLabel('重试保存','Retry saving'),desktopLabel('保存恢复副本并退出','Save recovery copy and close')],
      defaultId:0,cancelId:0,noLink:true
    });
    if(response===0)return false;
    if(response===1)continue;
    const data=await evaluateInTime(window,'window.recoveryProject?.()',10000);
    if(typeof data!=='string')throw Error(desktopLabel('未能读取待保存内容。','Pending edits could not be read.'));
    const result=await dialog.showSaveDialog(window,{
      title:desktopLabel('另存恢复副本','Save recovery copy'),
      defaultPath:desktopLabel('故事恢复副本.storytree.json','Story-Recovery.storytree.json'),
      filters:[{name:'StoryTree',extensions:['json']}]
    });
    if(result.canceled)return false;
    fs.writeFileSync(result.filePath,data,{encoding:'utf8',flag:'wx'});
    return true;
  }
  return false;
}
const trusted=e=>{if(!window||e.sender!==window.webContents||e.senderFrame!==e.sender.mainFrame)throw Error('不受信任的窗口');};
const displayFile = path.join(directory, 'display-settings.json');
function readDisplaySettings() {
  try {
    return displaySettings(JSON.parse(fs.readFileSync(displayFile, 'utf8')));
  } catch {
    return displaySettings();
  }
}
const desktopLabel = (chinese,english) => readDisplaySettings().language==='en' ? english : chinese;
ipcMain.handle('get-display-settings', event => {
  trusted(event);
  return readDisplaySettings();
});
ipcMain.handle('save-display-settings', (event, settings) => {
  trusted(event);
  const temp = displayFile + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(displaySettings(settings), null, 2), 'utf8');
  fs.renameSync(temp, displayFile);
});
ipcMain.handle('connection',e=>{trusted(e);return {port:connection.port,token:connection.token,version:app.getVersion()};});
ipcMain.handle('plugins-list',event=>{trusted(event);return plugins.list();});
ipcMain.handle('plugins-install',async event=>{
  trusted(event);
  const result=await dialog.showOpenDialog(window,{
    title:desktopLabel('安装或更新插件','Install or update plugin'),
    properties:['openFile'],
    filters:[{name:desktopLabel('StoryTree 插件','StoryTree plugins'),extensions:['json']}]
  });
  return result.canceled?null:plugins.install(result.filePaths[0]);
});
ipcMain.handle('plugins-install-example',event=>{
  trusted(event);
  return plugins.install(path.join(__dirname,'examples','scene-review.storytree-plugin.json'));
});
ipcMain.handle('plugins-enable',(event,id,enabled)=>{trusted(event);return plugins.setEnabled(id,enabled);});
ipcMain.handle('plugins-remove',(event,id)=>{trusted(event);return plugins.remove(id);});
ipcMain.handle('plugins-action',(event,id,actionId,version)=>{trusted(event);return plugins.action(id,actionId,version);});
let latestRelease,checkingRelease;
ipcMain.handle('check-update',async event=>{
  trusted(event);
  checkingRelease||=checkUpdate(app.getVersion()).finally(()=>{checkingRelease=null;});
  latestRelease=await checkingRelease;
  return latestRelease?.version||null;
});
ipcMain.handle('open-update',async event=>{
  trusted(event);
  if(latestRelease)await shell.openExternal(latestRelease.url);
});
ipcMain.handle('project-request',(event,route,body)=>{
  trusted(event);
  if(typeof route!=='string')throw Error('Invalid project request');
  return projectRequest(route,body);
});
ipcMain.handle('mcp-config',e=>{trusted(e);const entry=mcpEntry();return {json:config(),toml:`[mcp_servers.storytree]\ncommand = '${entry.command}'\nargs = ${JSON.stringify(entry.args)}\n${entry.env?'env = { ELECTRON_RUN_AS_NODE = "1" }\n':''}`};});
ipcMain.handle('export-project',async(event,data)=>{
  trusted(event);
  if(typeof data!=='string'||data.length>40e6)throw Error(desktopLabel('项目过大','Project is too large'));
  JSON.parse(data);
  const result=await dialog.showSaveDialog(window,{
    title:desktopLabel('导出故事项目','Export story project'),
    defaultPath:desktopLabel('故事.storytree.json','Story.storytree.json'),
    filters:[{name:desktopLabel('StoryTree 项目','StoryTree projects'),extensions:['json']}]
  });
  if(result.canceled)return false;
  await writeAtomic(result.filePath,data);
  return true;
});
ipcMain.handle('export-node-log',async(event,title,text)=>{
  trusted(event);
  if(typeof title!=='string'||typeof text!=='string'||Buffer.byteLength(text,'utf8')>40e6){
    throw Error(desktopLabel('节点日志过大或无效','The node log is too large or invalid'));
  }
  const name=title.replace(/[<>:"/\\|?*\u0000-\u001f]/gu,'_').trim().slice(0,80).replace(/[. ]+$/u,'');
  const result=await dialog.showSaveDialog(window,{
    title:desktopLabel('导出节点日志','Export node log'),
    defaultPath:'StoryTree-'+(name||'node')+'.txt',
    filters:[{name:desktopLabel('文本文件','Text files'),extensions:['txt']}]
  });
  if(result.canceled)return false;
  const destination=path.resolve(result.filePath);
  if(path.extname(destination).toLowerCase()!=='.txt')throw Error(desktopLabel('请选择 .txt 文件名。','Choose a .txt file name.'));
  fs.writeFileSync(destination,text,'utf8');
  return true;
});
ipcMain.handle('import-project',async event=>{
  trusted(event);
  const result=await dialog.showOpenDialog(window,{
    title:desktopLabel('打开故事项目','Open story project'),
    properties:['openFile'],
    filters:[{name:desktopLabel('StoryTree 项目','StoryTree projects'),extensions:['json']}]
  });
  if(result.canceled)return null;
  const file=result.filePaths[0];
  if((await fs.promises.stat(file)).size>40e6)throw Error(desktopLabel('项目超过40MB','The project exceeds 40 MB'));
  const parent=path.dirname(file);
  const media=path.join(path.basename(parent).toLowerCase()==='backups'?path.dirname(parent):parent,'media');
  const {project}=await decodeSnapshot(await fs.promises.readFile(file,'utf8'),media);
  const portable=JSON.stringify(project);
  if(Buffer.byteLength(portable,'utf8')>40e6)throw Error(desktopLabel('项目超过40MB','The project exceeds 40 MB'));
  return portable;
});
ipcMain.handle('save-excel-template',async event=>{
  trusted(event);
  const result=await dialog.showSaveDialog(window,{
    title:desktopLabel('保存 Excel 导入模板','Save Excel import template'),
    defaultPath:desktopLabel('StoryTree-批量导入模板.xlsx','StoryTree-Excel-Import-Template.xlsx'),
    filters:[{name:'Excel',extensions:['xlsx']}]
  });
  if(result.canceled)return false;
  fs.copyFileSync(path.join(__dirname,'examples','Excel-Import-Template.xlsx'),result.filePath);
  return true;
});
ipcMain.handle('open-data',e=>{trusted(e);return shell.openPath(directory);});
app.whenReady().then(async()=>{
  log('Electron ready');
  if(isService){
    // Exclusive startup lock prevents two agents from forking independent stores.
    fs.mkdirSync(directory,{recursive:true});const lock=path.join(directory,'.service.lock');let fd;
    try{fd=fs.openSync(lock,'wx');fs.writeSync(fd,String(process.pid));}catch(e){try{const pid=Number(fs.readFileSync(lock));process.kill(pid,0);app.exit(0);return;}catch{fs.unlinkSync(lock);fd=fs.openSync(lock,'wx');fs.writeSync(fd,String(process.pid));}}
    const cleanup=()=>{try{fs.closeSync(fd);fs.unlinkSync(lock);}catch{}};process.on('exit',cleanup);process.on('SIGTERM',()=>app.exit(0));
    if(await existing()){cleanup();app.exit(0);return;}await startServer(directory);return;
  }
  if(isMcp){await ensure();serveStdio(remote);return;}
  if(!app.requestSingleInstanceLock()){app.quit();return;}
  app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
  await createWindow();
}).catch(e=>{log(e.stack);if(isMcp||isService){process.stderr.write(e.stack+'\n');app.exit(1);}else{dialog.showErrorBox(desktopLabel('StoryTree 启动失败','StoryTree could not start'),e.message);app.quit();}});
app.on('window-all-closed',()=>{if(!isService&&!isMcp)app.quit();});
