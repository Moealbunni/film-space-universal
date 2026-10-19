const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('filmLink',{
 start:()=>ipcRenderer.invoke('link:start'),stop:()=>ipcRenderer.invoke('link:stop'),
 prepare:scene=>ipcRenderer.invoke('link:prepare',scene),receive:()=>ipcRenderer.invoke('link:receive'),
 onEvent:callback=>{ipcRenderer.on('link:event',(_event,type,payload)=>callback(type,payload));}
});
