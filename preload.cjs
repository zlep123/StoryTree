'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktop',{
  getConnection:()=>ipcRenderer.invoke('connection'),
  checkUpdate:()=>ipcRenderer.invoke('check-update'),
  openUpdate:()=>ipcRenderer.invoke('open-update'),
  projectRequest:(route,body)=>ipcRenderer.invoke('project-request',route,body),
  getDisplaySettings:()=>ipcRenderer.invoke('get-display-settings'),
  saveDisplaySettings:settings=>ipcRenderer.invoke('save-display-settings',settings),
  exportProject:data=>ipcRenderer.invoke('export-project',data),
  exportNodeLog:(title,text)=>ipcRenderer.invoke('export-node-log',title,text),
  importProject:()=>ipcRenderer.invoke('import-project'),
  saveExcelTemplate:()=>ipcRenderer.invoke('save-excel-template'),
  getMcpConfig:()=>ipcRenderer.invoke('mcp-config'),
  listPlugins:()=>ipcRenderer.invoke('plugins-list'),
  installPlugin:()=>ipcRenderer.invoke('plugins-install'),
  installExamplePlugin:()=>ipcRenderer.invoke('plugins-install-example'),
  enablePlugin:(id,enabled)=>ipcRenderer.invoke('plugins-enable',id,enabled),
  removePlugin:id=>ipcRenderer.invoke('plugins-remove',id),
  pluginAction:(id,action,version)=>ipcRenderer.invoke('plugins-action',id,action,version),
  openData:()=>ipcRenderer.invoke('open-data')
});
