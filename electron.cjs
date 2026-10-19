const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('node:path');
const {PhoneLink}=require('./phone-link.cjs');
const QRCode=require('qrcode');
let link;

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === 'media');
  });
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#111827',
    title: 'Film Space Desktop',
    autoHideMenuBar: true,
    webPreferences: { preload:path.join(__dirname,'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  link=new PhoneLink((type,payload)=>{if(!window.isDestroyed())window.webContents.send('link:event',type,payload);});
  const own=event=>{if(event.sender!==window.webContents)throw Error('Unknown window');};
  ipcMain.handle('link:start',async event=>{own(event);const info=await link.start();return {...info,qr:await Promise.all(info.links.map(value=>QRCode.toDataURL(value,{width:240,margin:1})))};});
  ipcMain.handle('link:stop',async event=>{own(event);await link.stop();});
  ipcMain.handle('link:prepare',(event,scene)=>{own(event);link.setScene(scene);return true;});
  ipcMain.handle('link:receive',event=>{own(event);return link.phoneScene;});
  window.on('closed',()=>link.stop());
  window.loadFile(path.join(__dirname, 'index.html'));
});

app.on('window-all-closed', () => app.quit());
