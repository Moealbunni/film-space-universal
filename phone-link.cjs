const http = require('node:http');
const crypto = require('node:crypto');
const os = require('node:os');
const kinds = new Set(['person','child','car','bike','box','sphere','wall','cylinder','cone','circle','plane','torus']);
function validScene(s) {
 const vec=v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<=1000);
 return s?.format==='film-space-link-v1' && Array.isArray(s.objects) && s.objects.length<=200 && Number.isFinite(s.floorSize)&&s.floorSize>=2&&s.floorSize<=200 && [18,24,35,50,75,200].includes(s.lens) && s.objects.every(o=>kinds.has(o.type)&&typeof o.name==='string'&&o.name.length<=200&&/^#[0-9a-f]{6}$/i.test(o.color)&&vec(o.position)&&vec(o.rotation)&&vec(o.scale)&&o.scale.every(n=>n>=.01&&n<=100));
}
class PhoneLink {
 constructor(onEvent=()=>{}) { this.onEvent=onEvent;this.server=null;this.scene=null;this.phoneScene=null;this.lastSeen=0; }
 async start() {
  if(this.server) return this.info;
  this.token=crypto.randomBytes(24).toString('hex');this.lastSeen=0;
  this.server=http.createServer((req,res)=>this.handle(req,res));
  this.server.requestTimeout=5000;this.server.headersTimeout=5000;
  try { await new Promise((resolve,reject)=>{this.server.once('error',reject);this.server.listen(0,'0.0.0.0',resolve);}); }
  catch(e){this.server=null;throw e;}
  const port=this.server.address().port;
  const addresses=Object.values(os.networkInterfaces()).flat().filter(a=>a.family==='IPv4'&&!a.internal&&/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.)/.test(a.address)).map(a=>a.address);
  this.info={port,addresses,links:addresses.map(host=>`filmspace://pair?host=${host}&port=${port}&token=${this.token}`)};
  this.timer=setInterval(()=>this.onEvent('status',{connected:Date.now()-this.lastSeen<5000}),1500);
  return this.info;
 }
 async stop(){clearInterval(this.timer);const s=this.server;this.server=null;this.token=null;this.scene=null;this.phoneScene=null;this.lastSeen=0;if(s){s.closeAllConnections();await new Promise(r=>s.close(r));}this.onEvent('status',{connected:false});}
 setScene(scene){if(!validScene(scene))throw Error('Scene exceeds connection limits or contains invalid values.');this.scene=scene;}
 handle(req,res){
  res.setHeader('Cache-Control','no-store');
  const reply=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
  const auth=req.headers.authorization||'';
  const expected='Bearer '+this.token;
  const authBytes=Buffer.from(auth), expectedBytes=Buffer.from(expected);
  if(req.headers.origin || authBytes.length!==expectedBytes.length || !crypto.timingSafeEqual(authBytes,expectedBytes)){reply(401,{error:'Pairing required'});return;}
  if(req.method==='GET'&&req.url==='/status'){this.lastSeen=Date.now();reply(200,{ok:true,hasScene:!!this.scene});return;}
  if(req.method==='POST'&&req.url==='/monitor'){this.lastSeen=Date.now();this.onEvent('show-monitor',{});reply(200,{ok:true});return;}
  if(req.method==='GET'&&req.url==='/scene'){this.lastSeen=Date.now();reply(this.scene?200:404,this.scene||{error:'Prepare a scene on Windows first'});return;}
  if(req.method!=='POST'||!['/frame','/phone-scene'].includes(req.url)){reply(404,{error:'Unknown endpoint'});return;}
  const chunks=[];let size=0,failed=false;
  req.on('data',chunk=>{size+=chunk.length;if(size>2*1024*1024){if(!failed)reply(413,{error:'Too large'});failed=true;}else if(!failed)chunks.push(chunk);});
  req.on('end',()=>{if(failed)return;const data=Buffer.concat(chunks);
   if(req.url==='/frame'){
    if(data.length<4||data[0]!==255||data[1]!==216||data.at(-2)!==255||data.at(-1)!==217){reply(400,{error:'JPEG required'});return;}
    this.lastSeen=Date.now();this.onEvent('frame',{image:'data:image/jpeg;base64,'+data.toString('base64'),recording:req.headers['x-film-recording']==='1'});reply(200,{ok:true});
   }else{try{const s=JSON.parse(data);if(!validScene(s))throw Error();this.phoneScene=s;this.lastSeen=Date.now();this.onEvent('scene-ready',{});reply(200,{ok:true});}catch{reply(400,{error:'Invalid scene'});}}
  });
  req.on('error',()=>{});
 }
}
module.exports={PhoneLink,validScene};
