import * as THREE from "three";

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
scene.add(new THREE.AxesHelper(1.4));

const camera = new THREE.PerspectiveCamera(54, 1, 0.05, 300);
const people = [];
let selected = null;
let mode = "edit";
let orbitTarget = new THREE.Vector3(0, 1, 0);
let orbitRadius = 8;
let orbitYaw = 0.3;
let orbitPitch = 0.25;
let cameraYaw = 0;
let cameraPitch = 0;
let cameraPosition = new THREE.Vector3(0, 1.6, 4);
let lockedView = null;
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

function status(message) { document.querySelector("#status").textContent = message; }
function makePerson(x = 0, z = 0, rotation = 0) {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0x596173, roughness: 0.9 });
  root.userData.clothing = material;
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
  for (const p of people) p.userData.clothing.color.setHex(p === person ? 0x278bff : 0x596173);
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
  camera.rotation.set(cameraPitch, cameraYaw, 0);
}
function setMode(next) {
  if (mode === next) return;
  if (next === "camera") {
    updateEditCamera();
    cameraPosition.copy(camera.position);
    const direction = orbitTarget.clone().sub(camera.position);
    cameraYaw = Math.atan2(-direction.x, -direction.z);
    cameraPitch = Math.atan2(direction.y, Math.hypot(direction.x, direction.z));
  } else {
    orbitTarget.copy(camera.position).add(new THREE.Vector3(0, 0, -4).applyQuaternion(camera.quaternion));
    orbitRadius = 4;
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
  if (!pointers.has(event.pointerId)) return;
  const old = pointers.get(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 2 && mode === "edit") {
    const pts = [...pointers.values()];
    const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    if (drag?.pinchDistance) orbitRadius = THREE.MathUtils.clamp(orbitRadius * drag.pinchDistance / distance, 1.5, 30);
    drag = { pinchDistance: distance };
  } else if (drag?.type === "person" && selected) {
    const point = groundHit(event);
    if (point) selected.position.set(point.x, 0, point.z);
  } else if (drag?.type === "view") {
    const dx = event.clientX - old.x, dy = event.clientY - old.y;
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
  if (mode === "edit") orbitRadius = THREE.MathUtils.clamp(orbitRadius * Math.exp(event.deltaY * 0.001), 1.5, 30);
  event.preventDefault();
}, { passive: false });

function moveCamera(dt) {
  const speed = (pressed.has("Shift") ? 5 : 2.5) * dt;
  const keys = new Set([...pressed, ...touchMove]);
  const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
  const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
  if (keys.has("w") || keys.has("ArrowUp") || keys.has("forward")) cameraPosition.addScaledVector(forward, speed);
  if (keys.has("s") || keys.has("ArrowDown") || keys.has("back")) cameraPosition.addScaledVector(forward, -speed);
  if (keys.has("a") || keys.has("ArrowLeft") || keys.has("left")) cameraPosition.addScaledVector(right, -speed);
  if (keys.has("d") || keys.has("ArrowRight") || keys.has("right")) cameraPosition.addScaledVector(right, speed);
  if (keys.has("q")) cameraPosition.y -= speed;
  if (keys.has("e")) cameraPosition.y += speed;
  cameraPosition.y = Math.max(0.15, cameraPosition.y);
}
addEventListener("keydown", event => {
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
document.querySelector("#add").onclick = () => select(makePerson(Math.random() * 2 - 1, Math.random() * 2 - 1));
document.querySelector("#remove").onclick = () => {
  if (!selected) return;
  people.splice(people.indexOf(selected), 1);
  scene.remove(selected);
  selected = null;
};
document.querySelector("#rotate").onclick = () => { if (selected) selected.rotation.y += Math.PI / 8; };
document.querySelector("#heightDown").onclick = () => { if (mode === "edit") orbitTarget.y -= 0.15; else cameraPosition.y -= 0.15; };
document.querySelector("#heightUp").onclick = () => { if (mode === "edit") orbitTarget.y += 0.15; else cameraPosition.y += 0.15; };
document.querySelector("#lens").onchange = applyLens;
document.querySelector("#lock").onclick = () => {
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
    format: "film-space-universal-v1",
    people: people.map(p => ({ position: p.position.toArray(), rotationY: p.rotation.y })),
    lens: Number(document.querySelector("#lens").value),
    camera: { position: cameraPosition.toArray(), yaw: cameraYaw, pitch: cameraPitch },
    orbit: { target: orbitTarget.toArray(), radius: orbitRadius, yaw: orbitYaw, pitch: orbitPitch }
  };
}
function restoreScene(data) {
  if (data?.format !== "film-space-universal-v1" || !Array.isArray(data.people)) throw new Error("Not a Film Space Universal scene");
  while (people.length) scene.remove(people.pop());
  for (const p of data.people) makePerson(p.position[0], p.position[2], p.rotationY);
  orbitTarget.fromArray(data.orbit.target);
  orbitRadius = data.orbit.radius;
  orbitYaw = data.orbit.yaw;
  orbitPitch = data.orbit.pitch;
  cameraPosition.fromArray(data.camera.position);
  cameraYaw = data.camera.yaw;
  cameraPitch = data.camera.pitch;
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
  download("film-space-camera-path.json", new Blob([JSON.stringify({ format: "film-space-camera-path-v1", fps: 30, samples: path }, null, 2)], { type: "application/json" }));
};
document.querySelector("#record").onclick = () => {
  if (recorder) { recorder.stop(); return; }
  if (!canvas.captureStream || !window.MediaRecorder) { status("Video recording unavailable here; use your device screen recorder"); return; }
  setMode("camera");
  const mime = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm"].find(m => MediaRecorder.isTypeSupported(m));
  if (!mime) { status("Video recording unavailable here; use your device screen recorder"); return; }
  const stream = canvas.captureStream(30);
  const chunks = [];
  recorder = new MediaRecorder(stream, { mimeType: mime });
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  recorder.onstop = () => {
    download(mime.includes("mp4") ? "film-space-motion.mp4" : "film-space-motion.webm", new Blob(chunks, { type: mime }));
    stream.getTracks().forEach(t => t.stop());
    recorder = null;
    document.querySelector("#record").textContent = "Record video";
    document.querySelector("#record").classList.remove("recording");
    status("Video saved");
  };
  path = [];
  recordStart = performance.now();
  recorder.start();
  document.querySelector("#record").textContent = "Stop recording";
  document.querySelector("#record").classList.add("recording");
  status("Recording camera move");
};

makePerson(0, 0, 0);
makePerson(-1.5, -1.5, 0.5);
let previous = performance.now();
let sampleTime = 0;
function frame(now) {
  const dt = Math.min((now - previous) / 1000, 0.05);
  previous = now;
  if (mode === "edit") updateEditCamera();
  else { moveCamera(dt); updateCameraMode(); }
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
