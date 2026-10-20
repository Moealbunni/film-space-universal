import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";

const canvas = document.querySelector("#stage");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x222b39);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x383838);
scene.add(new THREE.HemisphereLight(0xffffff, 0x667080, 2.3));
const sun = new THREE.DirectionalLight(0xffffff, 2.1);
sun.position.set(4, 8, 5);
scene.add(sun);

const checker = document.createElement('canvas');
checker.width = checker.height = 64;
const checkerContext = checker.getContext('2d');
checkerContext.fillStyle = '#383838'; checkerContext.fillRect(0, 0, 64, 64);
checkerContext.fillStyle = '#575757'; checkerContext.fillRect(0, 0, 32, 32); checkerContext.fillRect(32, 32, 32, 32);
const checkerTexture = new THREE.CanvasTexture(checker);
checkerTexture.wrapS = checkerTexture.wrapT = THREE.RepeatWrapping;
checkerTexture.repeat.set(10, 10);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ map: checkerTexture, roughness: 1 }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
const grid = new THREE.GridHelper(20, 20, 0x828282, 0x525252);
grid.position.y = 0.004;
scene.add(grid);
const axes = new THREE.AxesHelper(1.4); scene.add(axes);

const camera = new THREE.PerspectiveCamera(54, 1, 0.05, 300);
camera.rotation.order="YXZ";
const people = [];
let selected = null;
let mode = "edit";
let orbitTarget = new THREE.Vector3(0, 1, 0);
let orbitRadius = 8;
let orbitYaw = 0.3;
let orbitPitch = 0.25;
let orbitRoll = 0;
let cameraYaw = 0;
let cameraPitch = 0;
let cameraRoll = 0;
const cameraLocks = {position:{}, rotation:{}};
let lensLocked = false;
let cameraPosition = new THREE.Vector3(0, 1.6, 4);
let lockedView = null;
let viewLocked = false;
let orientationZero = null;
let orientationCurrent = null;
let motionEnabled = false;
let recorder = null;
let recordStart = 0;
let path = [];
const pressed = new Set();
const pointers = new Map();
let drag = null;
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const touchMove = new Set();

const transform = new TransformControls(camera, canvas);
const transformHelper = transform.getHelper(); scene.add(transformHelper);
transform.addEventListener('objectChange',()=>{enforceObjectLocks();refreshEditor();});
function enforceObjectLocks() {
 for(const p of people) for(const kind of ['position','rotation','scale']) for(const axis of ['x','y','z']) {
  const v=p.userData.locks?.[kind]?.[axis];if(v!==undefined)p[kind][axis]=v;
 }
}
function cameraConstraints() {
 for(const kind of ['position','rotation']) for(const axis of ['x','y','z']) {
  const v=cameraLocks[kind][axis];if(v!==undefined)camera[kind][axis]=v;
 }
 if(mode==='camera'){cameraPosition.copy(camera.position);cameraYaw=camera.rotation.y;cameraPitch=camera.rotation.x;cameraRoll=camera.rotation.z;}
}
function adoptView() {
 cameraPosition.copy(camera.position);const e=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');cameraPitch=e.x;cameraYaw=e.y;cameraRoll=e.z;orbitRoll=e.z;
 orbitTarget.copy(camera.position).add(new THREE.Vector3(0,0,-4).applyQuaternion(camera.quaternion));orbitRadius=4;
 orbitYaw=Math.atan2(camera.position.x-orbitTarget.x,camera.position.z-orbitTarget.z);orbitPitch=Math.asin((camera.position.y-orbitTarget.y)/4);
}
function status(message) { document.querySelector("#status").textContent = message; }
function makePerson(x = 0, z = 0, rotation = 0) {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0x596173, roughness: 0.9 });
  root.userData.clothing = material;
  root.userData.type = "person"; root.name = "Person " + (people.length + 1);
  const skin = new THREE.MeshStandardMaterial({ color: 0xc2996b, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.48, 0.18), material);
  body.position.y = 1.22;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), skin);
  head.position.y = 1.62;
  root.add(body, head);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.82, 0.13), material);
    leg.position.set(side * 0.11, 0.58, 0);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.24), skin);
    foot.position.set(side * 0.11, 0.04, 0.02);
    const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.38, 0.11), material);
    upperArm.position.set(side * 0.24, 1.28, 0);
    upperArm.rotation.z = -side * 0.35;
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.34, 0.09), skin);
    forearm.position.set(side * 0.38, 1.08, 0);
    forearm.rotation.z = -side * 0.15;
    root.add(leg, foot, upperArm, forearm);
  }
  root.position.set(x, 0, z);
  root.rotation.y = rotation;
  scene.add(root);
  people.push(root);
  return root;
}
function select(person) {
  selected = person;
  if(person)transform.attach(person);else transform.detach();
  refreshEditor();
}
function makeObject(type) {
  if (type === 'person' || type === 'child') {
    const p = makePerson(); p.userData.type = type;
    if (type === 'child') { p.scale.setScalar(.65); p.name = 'Child'; }
    return p;
  }
  const root = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({color:'#e6ad42', roughness:.75});
  root.userData.clothing = mat; root.userData.type = type; root.name = type[0].toUpperCase()+type.slice(1);
  function part(g,x,y,z,material=mat) { const m=new THREE.Mesh(g,material);m.position.set(x,y,z);root.add(m);return m; }
  const box=(w,h,d,x,y,z,m=mat)=>part(new THREE.BoxGeometry(w,h,d),x,y,z,m);
  if(type==='car') {
    box(1.8,.65,3.6,0,.65,0); box(1.5,.7,1.8,0,1.3,-.15);
    const rubber=new THREE.MeshStandardMaterial({color:'#20242b'});
    for(const x of [-.92,.92]) for(const z of [-1.1,1.1]) part(new THREE.CylinderGeometry(.38,.38,.22,24),x,.38,z,rubber).rotation.z=Math.PI/2;
  } else if(type==='bike') {
    for(const z of [-.7,.7]) part(new THREE.TorusGeometry(.38,.06,8,32),0,.44,z).rotation.y=Math.PI/2;
    box(.12,.1,1.4,0,.65,0);box(.12,.7,.12,0,.9,.7);box(.7,.08,.1,0,1.25,.7);box(.35,.08,.35,0,1,-.3);box(.08,.5,.08,0,.75,-.3);
  } else {
    const geometries={box:()=>new THREE.BoxGeometry(1,1,1),wall:()=>new THREE.BoxGeometry(4,2.5,.2),sphere:()=>new THREE.SphereGeometry(.5,32,24),cylinder:()=>new THREE.CylinderGeometry(.5,.5,1,32),cone:()=>new THREE.ConeGeometry(.5,1,32),circle:()=>new THREE.CylinderGeometry(.5,.5,.04,32),plane:()=>new THREE.BoxGeometry(3,.05,3),torus:()=>new THREE.TorusGeometry(.5,.15,12,32)};
    part(geometries[type](),0,type==='wall'?1.25:type==='plane'?.025:type==='circle'?.02:.5,0);
  }
  scene.add(root); people.push(root); return root;
}
function refreshEditor() {
  const list=document.querySelector('#objects'); if(!list)return;
  list.replaceChildren(...people.map((p,i)=>{const o=document.createElement('option');o.value=i;o.textContent=p.name;o.selected=p===selected;return o;}));
  if(!selected)list.selectedIndex=-1;
  document.querySelector('#inspector').disabled=!selected;
  if(!selected)return;
  for(const kind of ['position','rotation','scale']) for(const axis of ['x','y','z']) {
    const locked=selected.userData.locks?.[kind]?.[axis]!==undefined;
    const b=document.querySelector(`[data-object-lock="${kind}-${axis}"]`);if(b){b.textContent=locked?'🔒':'🔓';b.setAttribute('aria-pressed',String(locked));}
    document.querySelector('#'+kind+axis).disabled=locked;
  }
  document.querySelector('#objectName').value=selected.name;
  document.querySelector('#color').value='#'+selected.userData.clothing.color.getHexString();
  for(const kind of ['position','rotation','scale']) for(const axis of ['x','y','z']) document.querySelector('#'+kind+axis).value=(kind==='rotation'?THREE.MathUtils.radToDeg(selected[kind][axis]):selected[kind][axis]).toFixed(2);
}
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  applyLens();
}
function applyLens() {
  const focal = Number(document.querySelector("#lens").value);
  camera.fov = 2 * Math.atan(36 / (2 * focal * camera.aspect)) * 180 / Math.PI;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

function updateEditCamera() {
  const cp = Math.cos(orbitPitch);
  camera.position.set(
    orbitTarget.x + orbitRadius * Math.sin(orbitYaw) * cp,
    orbitTarget.y + orbitRadius * Math.sin(orbitPitch),
    orbitTarget.z + orbitRadius * Math.cos(orbitYaw) * cp
  );
  camera.lookAt(orbitTarget);
  camera.rotateZ(orbitRoll);
}
function updateCameraMode() {
  camera.position.copy(cameraPosition);
  if (motionEnabled && orientationCurrent && orientationZero) {
    cameraYaw = THREE.MathUtils.degToRad(orientationCurrent.alpha - orientationZero.alpha);
    cameraPitch = THREE.MathUtils.clamp(
      THREE.MathUtils.degToRad(orientationCurrent.beta - orientationZero.beta),
      -1.35, 1.35
    );
  }
  camera.rotation.order = "YXZ";
  camera.rotation.set(cameraPitch, cameraYaw, cameraRoll);
}
function setMode(next) {
  if (mode === next) return;
  if (next === "camera") {
    adoptView();
  } else {
    orbitTarget.copy(camera.position).add(new THREE.Vector3(0, 0, -4).applyQuaternion(camera.quaternion));
    orbitRadius = 4; orbitRoll=cameraRoll;
    orbitYaw = Math.atan2(camera.position.x - orbitTarget.x, camera.position.z - orbitTarget.z);
    orbitPitch = Math.asin((camera.position.y - orbitTarget.y) / orbitRadius);
  }
  mode = next;
  document.querySelector("#mode").textContent = next === "edit" ? "Camera mode" : "Edit mode";
  status(next === "edit" ? "Edit mode" : "Camera mode");
}

function pointerNdc(event) {
  const rect = canvas.getBoundingClientRect();
  return new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
}
function groundHit(event) {
  raycaster.setFromCamera(pointerNdc(event), camera);
  const point = new THREE.Vector3();
  return raycaster.ray.intersectPlane(groundPlane, point) ? point : null;
}
canvas.addEventListener("pointerdown", event => {
  if(transform.enabled && (transform.axis || transform.dragging))return;
  canvas.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (mode !== "edit" || pointers.size > 1) { drag = { type: "view", x: event.clientX, y: event.clientY }; return; }
  raycaster.setFromCamera(pointerNdc(event), camera);
  const hit = raycaster.intersectObjects(people, true)[0];
  if (hit) {
    let p = hit.object;
    while (p.parent && !people.includes(p)) p = p.parent;
    select(p);
    drag = { type: "person", x: event.clientX, y: event.clientY };
  } else {
    select(null);
    drag = { type: "view", x: event.clientX, y: event.clientY };
  }
});
canvas.addEventListener("pointermove", event => {
  if(transform.enabled && transform.dragging)return;
  if (!pointers.has(event.pointerId)) return;
  const old = pointers.get(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 2 && mode === "edit" && !viewLocked) {
    const pts = [...pointers.values()];
    const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    if (drag?.pinchDistance) orbitRadius = THREE.MathUtils.clamp(orbitRadius * drag.pinchDistance / distance, 1.5, 30);
    drag = { pinchDistance: distance };
  } else if (drag?.type === "person" && selected) {
    const point = groundHit(event);
    if (point) selected.position.set(point.x, selected.position.y, point.z);
    enforceObjectLocks(); refreshEditor();
  } else if (drag?.type === "view" && !viewLocked) {
    const sensitivity=Number(document.querySelector("#sensitivity").value);
    const dx = (event.clientX - old.x)*sensitivity, dy = (event.clientY - old.y)*sensitivity;
    if (mode === "edit") {
      orbitYaw -= dx * 0.006;
      orbitPitch = THREE.MathUtils.clamp(orbitPitch + dy * 0.006, -1.2, 1.4);
    } else if (!motionEnabled) {
      cameraYaw -= dx * 0.005;
      cameraPitch = THREE.MathUtils.clamp(cameraPitch - dy * 0.005, -1.4, 1.4);
    }
  }
});
function endPointer(event) { pointers.delete(event.pointerId); drag = null; }
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("wheel", event => {
  if (!viewLocked) {
    if (mode === "edit") orbitRadius = THREE.MathUtils.clamp(orbitRadius * Math.exp(event.deltaY * 0.001), .25, 150);
    else cameraPosition.addScaledVector(new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion), -event.deltaY*.005*Number(document.querySelector("#speed").value));
  }
  event.preventDefault();
}, { passive: false });

function moveCamera(dt) {
  if(viewLocked)return;
  const speed = (pressed.has("Shift") ? 2 : 1) * Number(document.querySelector("#speed").value) * dt;
  const keys = new Set([...pressed, ...touchMove]);
  const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
  const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
  if (keys.has("w") || keys.has("ArrowUp") || keys.has("forward")) cameraPosition.addScaledVector(forward, speed);
  if (keys.has("s") || keys.has("ArrowDown") || keys.has("back")) cameraPosition.addScaledVector(forward, -speed);
  if (keys.has("a") || keys.has("ArrowLeft") || keys.has("left")) cameraPosition.addScaledVector(right, -speed);
  if (keys.has("d") || keys.has("ArrowRight") || keys.has("right")) cameraPosition.addScaledVector(right, speed);
  if (keys.has("q") || keys.has("down")) cameraPosition.y -= speed;
  if (keys.has("e") || keys.has("up")) cameraPosition.y += speed;
  cameraPosition.y = Math.max(0.15, cameraPosition.y);
}
addEventListener("keydown", event => {
  if (/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
  pressed.add(event.key.length === 1 ? event.key.toLowerCase() : event.key);
});
addEventListener("keyup", event => pressed.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));
addEventListener("blur", () => { pressed.clear(); touchMove.clear(); pointers.clear(); drag = null; });
for (const button of document.querySelectorAll("[data-move]")) {
  const action = button.dataset.move;
  button.addEventListener("pointerdown", event => { button.setPointerCapture(event.pointerId); touchMove.add(action); });
  button.addEventListener("pointerup", () => touchMove.delete(action));
  button.addEventListener("pointercancel", () => touchMove.delete(action));
}
document.querySelector("#mode").onclick = () => setMode(mode === "edit" ? "camera" : "edit");
document.querySelector("#add").onclick = () => select(makeObject(document.querySelector("#shape").value));
document.querySelector("#remove").onclick = () => {
  if (!selected) return;
  people.splice(people.indexOf(selected), 1);
  scene.remove(selected);
  select(null);
};
document.querySelector("#rotate").onclick = () => { if (selected) { selected.rotation.y += Math.PI / 8; enforceObjectLocks();refreshEditor(); } };
document.querySelector("#heightDown").onclick = () => { if(viewLocked)return; if (mode === "edit") orbitTarget.y -= 0.15; else cameraPosition.y -= 0.15; };
document.querySelector("#heightUp").onclick = () => { if(viewLocked)return; if (mode === "edit") orbitTarget.y += 0.15; else cameraPosition.y += 0.15; };
document.querySelector("#lens").onchange = applyLens;
document.querySelector("#lock").onclick = () => {
  viewLocked = !viewLocked;
  document.querySelector("#lock").textContent=viewLocked?"Unlock viewpoint":"Lock viewpoint";refreshCameraLocks();
  if(!viewLocked){status("Viewpoint unlocked");return;}
  lockedView = { mode, position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), orbitTarget: orbitTarget.toArray(), orbitRadius, orbitYaw, orbitPitch, cameraYaw, cameraPitch };
  status("Viewpoint locked");
};
document.querySelector("#return").onclick = () => {
  if (!lockedView) return;
  setMode(lockedView.mode);
  orbitTarget.fromArray(lockedView.orbitTarget);
  orbitRadius = lockedView.orbitRadius;
  orbitYaw = lockedView.orbitYaw;
  orbitPitch = lockedView.orbitPitch;
  cameraPosition.fromArray(lockedView.position);
  cameraYaw = lockedView.cameraYaw;
  cameraPitch = lockedView.cameraPitch;
  status("Returned to locked view");
};
addEventListener("deviceorientation", event => { orientationCurrent = { alpha: event.alpha || 0, beta: event.beta || 0, gamma: event.gamma || 0 }; });
document.querySelector("#calibrate").onclick = async () => {
  try {
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result !== "granted") throw new Error("Motion permission was denied");
    }
    if (!orientationCurrent) throw new Error("No phone orientation data yet. Try again after moving the phone.");
    orientationZero = { ...orientationCurrent };
    motionEnabled = true;
    setMode("camera");
    status("Phone orientation active");
  } catch (error) { status(error.message); }
};

function sceneData() {
  return {
    format: "film-space-universal-v2",
    floorSize: Number(document.querySelector("#floorSize").value),
    objects: people.map(p=>({type:p.userData.type,name:p.name,color:"#"+p.userData.clothing.color.getHexString(),position:p.position.toArray(),rotation:p.rotation.toArray().slice(0,3),scale:p.scale.toArray(),locks:p.userData.locks || {}})),
    cameraLocks, lensLocked, cameraRoll,
    people: people.map(p => ({ position: p.position.toArray(), rotationY: p.rotation.y })),
    lens: Number(document.querySelector("#lens").value),
    camera: { position: cameraPosition.toArray(), yaw: cameraYaw, pitch: cameraPitch },
    orbit: { target: orbitTarget.toArray(), radius: orbitRadius, yaw: orbitYaw, pitch: orbitPitch, roll: orbitRoll }
  };
}
function restoreScene(data) {
  if (!["film-space-universal-v1","film-space-universal-v2"].includes(data?.format) || !Array.isArray(data.objects || data.people)) throw new Error("Not a Film Space Universal scene");
  while (people.length) scene.remove(people.pop());
  for (const d of (data.objects || data.people.map(p=>({type:'person',position:p.position,rotation:[0,p.rotationY,0],scale:[1,1,1]})))) {
    const p=makeObject(d.type);p.position.fromArray(d.position);p.rotation.set(...d.rotation);p.scale.fromArray(d.scale);if(d.name)p.name=d.name;if(d.color)p.userData.clothing.color.set(d.color);p.userData.locks=d.locks || {};
  }
  document.querySelector('#floorSize').value=data.floorSize || 20; resizeFloor();
  orbitTarget.fromArray(data.orbit.target);
  orbitRadius = data.orbit.radius;
  orbitYaw = data.orbit.yaw;
  orbitPitch = data.orbit.pitch;orbitRoll=data.orbit.roll || 0;
  cameraPosition.fromArray(data.camera.position);
  cameraYaw = data.camera.yaw;
  cameraPitch = data.camera.pitch; cameraRoll=data.cameraRoll || 0;
  cameraLocks.position=data.cameraLocks?.position || {};cameraLocks.rotation=data.cameraLocks?.rotation || {};
  lensLocked=Boolean(data.lensLocked);document.querySelector('#lens').disabled=lensLocked;refreshCameraLocks();
  document.querySelector("#lens").value = String(data.lens);
  document.querySelector("#lens").dispatchEvent(new Event("change"));
  select(null);
  status("Scene loaded");
}
function download(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
document.querySelector("#save").onclick = () => { localStorage.setItem("film-space-universal-scene", JSON.stringify(sceneData())); status("Scene saved on this device"); };
document.querySelector("#load").onclick = () => {
  try { restoreScene(JSON.parse(localStorage.getItem("film-space-universal-scene"))); }
  catch (error) { status(error.message); }
};
document.querySelector("#exportScene").onclick = () => download("film-space-scene.json", new Blob([JSON.stringify(sceneData(), null, 2)], { type: "application/json" }));
document.querySelector("#importScene").onclick = () => document.querySelector("#importFile").click();
document.querySelector("#importFile").onchange = async event => {
  try { restoreScene(JSON.parse(await event.target.files[0].text())); }
  catch (error) { status(error.message); }
  event.target.value = "";
};
document.querySelector("#exportPath").onclick = () => {
  if (!path.length) { status("Record a camera move first"); return; }
  download("film-space-camera-path.json", new Blob([JSON.stringify({ format: "film-space-camera-path-v1", fps: 60, samples: path }, null, 2)], { type: "application/json" }));
};
document.querySelector("#record").onclick = () => {
  if (recorder) { recorder.stop(); return; }
  if (!document.querySelector("#phoneMonitor").hidden) { status("Phone monitor is open. Record on iPhone, or return to the desktop editor to record the Windows scene."); return; }
  if (!canvas.captureStream || !window.MediaRecorder) { status("Video recording unavailable here; use your device screen recorder"); return; }
  setMode("camera");
  const mime = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm"].find(m => MediaRecorder.isTypeSupported(m));
  if (!mime) { status("Video recording unavailable here; use your device screen recorder"); return; }
  grid.visible=false; axes.visible=false;transformHelper.visible=false;
  renderer.render(scene,camera);
  const stream = canvas.captureStream(60);
  const chunks = [];
  recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12000000 });
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  recorder.onstop = () => {
    download(mime.includes("mp4") ? "film-space-motion.mp4" : "film-space-motion.webm", new Blob(chunks, { type: mime }));
    stream.getTracks().forEach(t => t.stop());
    recorder = null; grid.visible=true; axes.visible=true;
    document.querySelector("#record").textContent = "Record video";
    document.querySelector("#record").classList.remove("recording");
    status("Video saved");
  };
  path = [];
  recordStart = performance.now();
  recorder.start();
  document.querySelector("#record").textContent = "Stop recording";
  document.querySelector("#record").classList.add("recording");
  status("Recording camera move · 60 fps target");
};

document.querySelector('#objects').onchange=e=>select(people[Number(e.target.value)]);
document.querySelector('#objectName').onchange=e=>{if(selected){selected.name=e.target.value;refreshEditor();}};
document.querySelector('#color').oninput=e=>{if(selected)selected.userData.clothing.color.set(e.target.value);};
for(const kind of ['position','rotation','scale']) for(const axis of ['x','y','z']) document.querySelector('#'+kind+axis).onchange=e=>{
 if(!selected)return;const v=Number(e.target.value);if(!Number.isFinite(v))return;
 selected[kind][axis]=kind==='rotation'?THREE.MathUtils.degToRad(v):kind==='scale'?Math.max(.01,v):v;refreshEditor();
};
for(const b of document.querySelectorAll('[data-color]'))b.onclick=()=>{if(selected){selected.userData.clothing.color.set(b.dataset.color);refreshEditor();}};
for(const b of document.querySelectorAll('[data-size]'))b.onclick=()=>{if(selected){selected.scale.multiplyScalar(Number(b.dataset.size));enforceObjectLocks();refreshEditor();}};
document.querySelector('#duplicate').onclick=()=>{if(!selected)return;const old=selected,p=makeObject(old.userData.type);p.name=old.name+' copy';p.position.copy(old.position).add(new THREE.Vector3(1,0,0));p.rotation.copy(old.rotation);p.scale.copy(old.scale);p.userData.clothing.color.copy(old.userData.clothing.color);select(p);};
function resizeFloor(){const size=THREE.MathUtils.clamp(Number(document.querySelector('#floorSize').value)||20,2,200);floor.scale.set(size/20,size/20,1);grid.scale.setScalar(size/20);checkerTexture.repeat.set(10,10);}
document.querySelector('#floorSize').onchange=resizeFloor;
for(const button of document.querySelectorAll('[data-object-lock]'))button.onclick=()=>{
 if(!selected)return;const [kind,axis]=button.dataset.objectLock.split('-');selected.userData.locks ||= {};selected.userData.locks[kind] ||= {};
 if(selected.userData.locks[kind][axis]!==undefined)delete selected.userData.locks[kind][axis];else selected.userData.locks[kind][axis]=selected[kind][axis];refreshEditor();
};
for(const button of document.querySelectorAll('[data-object-reset]'))button.onclick=()=>{
 if(!selected)return;const kind=button.dataset.objectReset;selected[kind].set(...(kind==='scale'?[1,1,1]:[0,0,0]));selected.userData.locks ||= {};selected.userData.locks[kind]={};refreshEditor();
};
for(const button of document.querySelectorAll('[data-transform]'))button.onclick=()=>{transform.setMode(button.dataset.transform);};
for(const button of document.querySelectorAll('[data-lift]'))button.onclick=()=>{if(selected){selected.position.y+=Number(button.dataset.lift);enforceObjectLocks();refreshEditor();}};
function refreshCameraLocks(){for(const button of document.querySelectorAll('[data-camera-lock]')){const [kind,axis]=button.dataset.cameraLock.split('-');const locked=cameraLocks[kind][axis]!==undefined;button.textContent=locked?'🔒':'🔓';button.setAttribute('aria-pressed',String(locked));document.querySelector('#cam'+kind+axis).disabled=locked || viewLocked;}document.querySelector('#lensLock').textContent=lensLocked?'Unlock lens':'Lock lens';}
for(const button of document.querySelectorAll('[data-camera-lock]'))button.onclick=()=>{
 adoptView();const [kind,axis]=button.dataset.cameraLock.split('-');if(cameraLocks[kind][axis]!==undefined)delete cameraLocks[kind][axis];else cameraLocks[kind][axis]=camera[kind][axis];refreshCameraLocks();
};
for(const kind of ['position','rotation'])for(const axis of ['x','y','z'])document.querySelector('#cam'+kind+axis).onchange=e=>{if(viewLocked)return;const v=Number(e.target.value);if(!Number.isFinite(v))return;camera[kind][axis]=kind==='rotation'?THREE.MathUtils.degToRad(v):v;adoptView();};
for(const button of document.querySelectorAll('[data-camera-reset]'))button.onclick=()=>{
 const kind=button.dataset.cameraReset;cameraLocks[kind]={};if(kind==='position')camera.position.set(0,1.6,4);else camera.rotation.set(0,0,0);adoptView();refreshCameraLocks();
};
document.querySelector('#resetCamera').onclick=()=>{viewLocked=false;document.querySelector('#lock').textContent='Lock viewpoint';cameraLocks.position={};cameraLocks.rotation={};camera.position.set(0,1.6,4);camera.rotation.set(0,0,0);adoptView();refreshCameraLocks();};
document.querySelector('#lensLock').onclick=()=>{lensLocked=!lensLocked;document.querySelector('#lens').disabled=lensLocked;refreshCameraLocks();};
refreshCameraLocks();
makePerson(0, 0, 0);
makePerson(-1.5, -1.5, 0.5);
refreshEditor();
let previous = performance.now();
let sampleTime = 0;
function frame(now) {
  const dt = Math.min((now - previous) / 1000, 0.05);
  previous = now;
  if (mode === "edit") updateEditCamera();
  else { moveCamera(dt); updateCameraMode(); }
  enforceObjectLocks(); cameraConstraints();
  transform.enabled=mode==='edit' && !recorder;
  transformHelper.visible=transform.enabled;
  const quick=document.querySelector('#quickObject');quick.hidden=!selected || mode!=='edit' || Boolean(recorder);
  if(selected && !quick.hidden){const pt=new THREE.Box3().setFromObject(selected).getCenter(new THREE.Vector3()).project(camera);quick.style.left=Math.max(430,Math.min(innerWidth-230,(pt.x+1)*innerWidth/2))+'px';quick.style.top=Math.max(65,Math.min(innerHeight-90,(-pt.y+1)*innerHeight/2))+'px';}
  for(const kind of ['position','rotation'])for(const axis of ['x','y','z']){const input=document.querySelector('#cam'+kind+axis);if(document.activeElement!==input)input.value=(kind==='rotation'?THREE.MathUtils.radToDeg(camera.rotation[axis]):camera.position[axis]).toFixed(2);}
  if (recorder && now - sampleTime >= 1000 / 30) {
    path.push({
      time: (now - recordStart) / 1000,
      position: camera.position.toArray(),
      quaternion: camera.quaternion.toArray(),
      lensMm: Number(document.querySelector("#lens").value)
    });
    sampleTime = now;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Pairing and preview stay outside the render canvas and cannot enter desktop exports.
const $link=id=>document.querySelector('#'+id);
let lastPhoneFrame=0, phoneConnected=false;
function previewWaitingStatus(){return phoneConnected?'Connected, but no preview received — close the iPhone menu and keep its scene visible.':'Waiting for iPhone — connect using the pairing QR.';}
for(const b of document.querySelectorAll('[data-speed]'))b.onclick=()=>{$link('speed').value=b.dataset.speed;$link('sensitivity').value=b.dataset.speed==='0.25'?'0.35':'0.7';status(b.textContent+' camera speed');};
$link('cameraShortcut').onclick=()=>{$link('cameraPanel').open=true;$link('cameraPanel').scrollIntoView({block:'start',behavior:'smooth'});};
$link('showPhone').onclick=()=>{$link('phoneMonitor').hidden=false;if(performance.now()-lastPhoneFrame>3000)$link('monitorStatus').textContent=previewWaitingStatus();};
$link('hidePhone').onclick=()=>{$link('phoneMonitor').hidden=true;};
function linkScene(){return {format:'film-space-link-v1',floorSize:Number($link('floorSize').value),lens:Number($link('lens').value),objects:people.map(p=>{const e=new THREE.Euler().setFromQuaternion(p.quaternion,'YXZ');return {type:p.userData.type,name:p.name,color:'#'+p.userData.clothing.color.getHexString(),position:p.position.toArray(),rotation:[e.x,e.y,e.z],scale:p.scale.toArray()};})};}
function receiveLinkScene(data){
 if(recorder)throw Error('Stop desktop recording before replacing the scene.');
 const saved=sceneData();saved.objects=data.objects;saved.floorSize=data.floorSize;saved.lens=data.lens;
 // Incoming rotations are YXZ. Convert them to the editor's object Euler order.
 saved.objects=saved.objects.map(o=>{const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rotation,'YXZ'));const e=new THREE.Euler().setFromQuaternion(q,'XYZ');return {...o,rotation:[e.x,e.y,e.z],locks:{}};});
 restoreScene(saved);
}
$link('startLink').onclick=async()=>{try{
 if(!window.filmLink)throw Error('Use the packaged desktop app for Wi-Fi pairing.');
 const info=await window.filmLink.start();if(!info.links.length){await window.filmLink.stop();throw Error('No private network address found. Connect Windows to Wi-Fi.');}
 const address=$link('linkAddress');address.replaceChildren(...info.addresses.map((ip,i)=>new Option(ip,String(i))));address.hidden=info.links.length<2;
 const show=()=>{const i=Number(address.value)||0;$link('pairQr').src=info.qr[i];$link('pairQr').hidden=false;$link('pairText').value=info.links[i];$link('pairText').hidden=false;};address.onchange=show;show();
 await window.filmLink.prepare(linkScene());$link('stopLink').disabled=false;$link('startLink').disabled=true;$link('linkStatus').textContent='Ready to pair. Allow this app on Private networks if Windows asks.';
}catch(e){$link('linkStatus').textContent=e.message;}};
$link('stopLink').onclick=async()=>{await window.filmLink?.stop();$link('startLink').disabled=false;$link('stopLink').disabled=true;$link('pairQr').hidden=true;$link('pairText').hidden=true;$link('linkAddress').hidden=true;$link('phoneMonitor').hidden=true;$link('phoneImage').removeAttribute('src');$link('linkStatus').textContent='Sharing stopped; previous QR is invalid.';};
$link('preparePhone').onclick=async()=>{try{if(!window.filmLink)throw Error('Open the desktop app.');await window.filmLink.prepare(linkScene());$link('linkStatus').textContent='Scene ready. On iPhone tap Load desktop scene.';}catch(e){$link('linkStatus').textContent=e.message;}};
$link('receivePhone').onclick=async()=>{try{const data=await window.filmLink?.receive();if(!data)throw Error('On iPhone tap Send scene to desktop first.');receiveLinkScene(data);setMode("edit");$link("phoneMonitor").hidden=true;$link('linkStatus').textContent='Phone scene loaded — edit it here, then Prepare scene for phone to send your changes back.';}catch(e){$link('linkStatus').textContent=e.message;}};
window.filmLink?.onEvent((type,data)=>{
 if(type==='show-monitor')$link('showPhone').click();
 if(type==='frame'){lastPhoneFrame=performance.now();$link('phoneImage').src=data.image;$link('monitorStatus').textContent=data.recording?'● iPhone is recording':'iPhone live camera';}
 if(type==='status'){phoneConnected=data.connected;if(!$link('stopLink').disabled)$link('linkStatus').textContent=data.connected?'iPhone connected on local Wi-Fi':'Waiting for iPhone. Check same Wi-Fi and Private-network firewall access.';}
 if(type==='scene-ready')$link('linkStatus').textContent='Phone sent a scene. Tap Load received phone scene to replace the desktop scene.';
});
setInterval(()=>{if(performance.now()-lastPhoneFrame>3000)$link('monitorStatus').textContent=previewWaitingStatus();},1000);
