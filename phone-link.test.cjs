const {test}=require('node:test');
const assert=require('node:assert/strict');
const {PhoneLink,validScene}=require('./phone-link.cjs');
test('pairing authorization, scene exchange, preview and disconnect',async()=>{
 const events=[];const link=new PhoneLink((type,data)=>events.push({type,data}));
 try{
 const info=await link.start();const base=`http://127.0.0.1:${info.port}`;
 const headers={Authorization:'Bearer '+link.token};
 const req=(path,options={})=>fetch(base+path,{...options,headers:{...headers,...options.headers}});
 assert.equal((await fetch(base+'/status')).status,401);
 assert.equal((await req('/status',{headers:{Authorization:'Bearer '+String.fromCharCode(233).repeat(48)}})).status,401);
 assert.equal((await req('/status',{headers:{Origin:'https://example.com'}})).status,401);
 assert.equal((await req('/status')).status,200);
 assert.equal((await req('/scene')).status,404);
 const scene={format:'film-space-link-v1',floorSize:50,lens:24,objects:[{type:'car',name:'Red car',color:'#ff0000',position:[1,2,3],rotation:[.1,.2,.3],scale:[2,2,2]}]};
 assert.ok(validScene(scene));link.setScene(scene);
 assert.deepEqual(await (await req('/scene')).json(),scene);
 assert.equal((await req('/phone-scene',{method:'POST',body:JSON.stringify(scene)})).status,200);
 assert.deepEqual(link.phoneScene,scene);assert.ok(events.some(e=>e.type==='scene-ready'));
 const invalid=structuredClone(scene);invalid.objects[0].scale[1]=-1;
 assert.equal((await req('/phone-scene',{method:'POST',body:JSON.stringify(invalid)})).status,400);
 assert.deepEqual(link.phoneScene,scene);
 assert.equal((await req('/frame',{method:'POST',body:'bad'})).status,400);
 assert.equal((await req('/frame',{method:'POST',body:Buffer.from([255,216,255,217]),headers:{'X-Film-Recording':'1'}})).status,200);
 assert.ok(events.some(e=>e.type==='frame'&&e.data.recording));
 assert.equal((await req('/phone-scene',{method:'POST',body:'x'.repeat(2*1024*1024+1)})).status,413);
 const oldToken=link.token;await link.stop();assert.equal(link.phoneScene,null);
 await link.start();assert.notEqual(link.token,oldToken);
 }finally{await link.stop();}
});
