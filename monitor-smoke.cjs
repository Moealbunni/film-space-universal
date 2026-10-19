const {app}=require('electron');const fs=require('fs');const assert=require('node:assert/strict');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
app.on('browser-window-created',(_event,win)=>{
 win.hide();win.webContents.once('did-finish-load',async()=>{
 try{
 const js=code=>win.webContents.executeJavaScript(code);
 await js("document.querySelector('#startLink').click()");
 let pair;for(let i=0;i<40;i++){pair=await js("document.querySelector('#pairText').value");if(pair)break;await delay(100);}
 assert.ok(pair);const url=new URL(pair);const port=url.searchParams.get('port');const token=url.searchParams.get('token');
 const request=(p,body,extra={})=>fetch(`http://127.0.0.1:${port}/${p}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...extra},body});
 const scene=await (await request('scene')).json();assert.equal(scene.objects.length,2);
 const image=await win.webContents.capturePage();assert.equal((await request('frame',image.toJPEG(70),{'X-Film-Recording':'1'})).status,200);
 await js("document.querySelector('#showPhone').click()");await delay(300);
 assert.equal(await js("document.querySelector('#phoneMonitor').hidden"),false);
 assert.ok(await js("document.querySelector('#phoneImage').naturalWidth>0"));
 assert.equal(await js("document.querySelector('#monitorStatus').textContent"),'● iPhone is recording');
 await js("document.querySelector('#record').click()");assert.equal(await js("document.querySelector('#record').textContent"),'Record video');
 scene.objects[0].name='Transferred car';scene.objects[0].type='car';
 assert.equal((await request('phone-scene',JSON.stringify(scene))).status,200);
 await js("document.querySelector('#hidePhone').click();document.querySelector('#receivePhone').click()");await delay(200);
 assert.ok(await js("document.querySelector('#objects').textContent.includes('Transferred car')"));
 await js("document.querySelector('#stopLink').click()");await delay(100);
 assert.equal(await js("document.querySelector('#pairQr').hidden"),true);
 fs.writeFileSync('test-output/monitor-result.json',JSON.stringify({passed:true,checks:['preload pairing','scene preparation','JPEG display','recording indicator','monitor toggle','record target protection','phone scene import','disconnect']}));app.exit(0);
 }catch(e){fs.writeFileSync('test-output/monitor-result.json',JSON.stringify({passed:false,error:e.stack}));app.exit(1);}
 });
});
setTimeout(()=>app.exit(2),20000);
require('./electron.cjs');
