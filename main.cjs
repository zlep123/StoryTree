'use strict';
const {app,BrowserWindow,ipcMain,dialog,shell}=require('electron');
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {startServer}=require('./server.cjs'),{serveStdio}=require('./mcp.cjs');
const {displaySettings}=require('./core.js');
const args=process.argv.slice(1),isMcp=args.includes('--mcp'),isService=args.includes('--service');
function arg(name){const i=args.indexOf(name);return i>=0?args[i+1]:undefined;}
const directory=path.resolve(arg('--data')||process.env.STORYTREE_DATA||path.join(app.isPackaged?path.dirname(process.execPath):__dirname,'data'));
const runtimeDirectory=path.join(directory,'.runtime',isService?'service':isMcp?'mcp-'+process.pid:'desktop');
fs.mkdirSync(runtimeDirectory,{recursive:true});app.setPath('userData',runtimeDirectory);app.setPath('sessionData',runtimeDirectory);
if(isService||isMcp){app.disableHardwareAcceleration();app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');}
const log=text=>{try{fs.appendFileSync(path.join(directory,'startup.log'),new Date().toISOString()+' '+process.pid+' '+text+'\n');}catch{}};
log(isMcp?'MCP starting':isService?'Service starting':'Desktop starting');
const connectionFile=path.join(directory,'.service.json');let connection,window;
async function existing(){try{const c=JSON.parse(fs.readFileSync(connectionFile,'utf8'));const r=await fetch(`http://127.0.0.1:${c.port}/api/project`,{headers:{'X-StoryTree-Token':c.token},signal:AbortSignal.timeout(1500)});if(r.ok)return c;}catch{}return null;}
async function ensure(){let c=await existing();if(c)return c;
  log('Starting data service');
  const serviceArgs=[path.join(__dirname,'service.cjs'),'--data',directory];
  const env={...process.env,ELECTRON_RUN_AS_NODE:'1'};delete env.NODE_OPTIONS;
  const logFd=fs.openSync(path.join(directory,'service.log'),'a');
  const child=spawn(process.execPath,serviceArgs,{detached:true,stdio:['ignore',logFd,logFd],windowsHide:true,env});child.on('error',e=>log('Service spawn error: '+e.message));child.unref();fs.closeSync(logFd);
  for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,120));c=await existing();if(c)return c;}throw Error('本地数据服务启动失败，请检查 data 目录是否可写');
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
  let closing=false;window.on('close',e=>{if(closing)return;e.preventDefault();Promise.race([window.webContents.executeJavaScript('window.flushEdits?.()'),new Promise(r=>setTimeout(()=>r(false),5000))]).then(saved=>{if(saved===false){dialog.showMessageBox(window,{type:'error',message:desktopLabel('尚未成功保存，请检查磁盘空间或重试。窗口已保留。','Saving did not finish. Check disk space or try again.')});return;}closing=true;if(!window.isDestroyed())window.close();}).catch(()=>{closing=true;if(!window.isDestroyed())window.close();});});
  await window.loadURL(base+'/');
}
const trusted=e=>{if(!window || e.sender!==window.webContents)throw Error('不受信任的窗口');};
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
ipcMain.handle('connection',e=>{trusted(e);return {port:connection.port,token:connection.token};});
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
  fs.writeFileSync(result.filePath,data,'utf8');
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
  if(fs.statSync(file).size>40e6)throw Error(desktopLabel('项目超过40MB','The project exceeds 40 MB'));
  return fs.readFileSync(file,'utf8');
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
