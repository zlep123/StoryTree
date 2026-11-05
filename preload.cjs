'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktop',{
  getConnection:()=>ipcRenderer.invoke('connection'),
  getDisplaySettings:()=>ipcRenderer.invoke('get-display-settings'),
  saveDisplaySettings:settings=>ipcRenderer.invoke('save-display-settings',settings),
  exportProject:data=>ipcRenderer.invoke('export-project',data),
  importProject:()=>ipcRenderer.invoke('import-project'),
  getMcpConfig:()=>ipcRenderer.invoke('mcp-config'),
  openData:()=>ipcRenderer.invoke('open-data')
});
