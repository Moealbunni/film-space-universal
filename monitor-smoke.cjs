const {app,nativeImage}=require('electron');const fs=require('fs');const assert=require('node:assert/strict');
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
 const image=nativeImage.createFromBitmap(Buffer.from([0,0,255,255,0,255,0,255,255,0,0,255,255,255,255,255]),{width:2,height:2});assert.ok(!image.isEmpty());assert.equal((await request('frame',image.toJPEG(70),{'X-Film-Recording':'1'})).status,200);
 assert.equal((await request('monitor',Buffer.alloc(0))).status,200);await delay(300);
 assert.equal(await js("document.querySelector('#phoneMonitor').hidden"),false);
 assert.ok(await js("document.querySelector('#phoneImage').naturalWidth>0"));
 assert.equal(await js("document.querySelector('#monitorStatus').textContent"),'● iPhone is recording');
 await js("document.querySelector('#record').click()");assert.equal(await js("document.querySelector('#record').textContent"),'Record video');
 scene.objects[0].name='Transferred car';scene.objects[0].type='car';
 assert.equal((await request('phone-scene',JSON.stringify(scene))).status,200);
 await js("document.querySelector('#receivePhone').click()");await delay(200);
 assert.ok(await js("document.querySelector('#objects').textContent.includes('Transferred car')"));
 assert.equal(await js("document.querySelector('#phoneMonitor').hidden"),true);
 const kinds=['person','child','car','bike','box','sphere','wall','cylinder','cone','circle','plane','torus'];
 const incoming={format:'film-space-link-v1',floorSize:80,lens:50,objects:kinds.map((type,i)=>({type,name:'Phone '+type,color:i%2?'#12abef':'#efcd34',position:[i*.5,1,-2],rotation:[.2,.4,-.3],scale:[.7,1.3,2]}))};
 assert.equal((await request('phone-scene',JSON.stringify(incoming))).status,200);
 await js("document.querySelector('#receivePhone').click()");await delay(150);
 await js("document.querySelector('#preparePhone').click()");await delay(150);
 const roundtrip=await(await request('scene')).json();
 assert.equal(roundtrip.floorSize,80);assert.equal(roundtrip.lens,50);assert.equal(roundtrip.objects.length,kinds.length);
 for(let i=0;i<kinds.length;i++){
   const a=incoming.objects[i],b=roundtrip.objects[i];
   for(const key of ['type','name','color'])assert.equal(b[key],a[key]);
   for(const key of ['position','rotation','scale'])for(let axis=0;axis<3;axis++)assert.ok(Math.abs(b[key][axis]-a[key][axis])<1e-5,`${key} changed in roundtrip`);
 }
 await js(`(() => {const change=(id,value)=>{const e=document.querySelector(id);e.value=value;e.dispatchEvent(new Event('change'));};change('#objects','0');change('#objectName','Edited on Windows');change('#positionx',7);change('#scaley',2);document.querySelector('[data-color="#facc15"]').click();document.querySelector('#save').click();document.querySelector('#load').click();document.querySelector('#preparePhone').click();})()`);await delay(150);
 const edited=await(await request('scene')).json();assert.equal(edited.objects[0].name,'Edited on Windows');assert.equal(edited.objects[0].position[0],7);assert.equal(edited.objects[0].scale[1],2);assert.equal(edited.objects[0].color,'#facc15');

 await js("document.querySelector('#stopLink').click()");await delay(100);
 assert.equal(await js("document.querySelector('#pairQr').hidden"),true);
 fs.writeFileSync('test-output/monitor-result.json',JSON.stringify({passed:true,checks:['preload pairing','scene preparation','JPEG display','recording indicator','phone-triggered monitor opening','record target protection','phone scene import opens editor','all 12 shapes roundtrip with color/transforms/floor/lens','edit received scene then save/load and send back','disconnect']}));app.exit(0);
 }catch(e){fs.writeFileSync('test-output/monitor-result.json',JSON.stringify({passed:false,error:e.stack}));app.exit(1);}
 });
});
setTimeout(()=>app.exit(2),20000);
require('./electron.cjs');
