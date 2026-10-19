const { app, BrowserWindow, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const output = path.join(__dirname, 'test-output');
fs.mkdirSync(output, { recursive: true });
const errors = [];
const downloads = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1280, height: 800, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, offscreen: true } });
  setTimeout(() => { fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: false, error: 'Test timeout' })); app.exit(1); }, 20000);
  window.webContents.on('console-message', (_event, details) => {
    if (details.level === 'error') errors.push(details.message);
  });
  window.webContents.on('render-process-gone', (_event, details) => errors.push(JSON.stringify(details)));
  session.defaultSession.on('will-download', (_event, item) => {
    const target = path.join(output, item.getFilename());
    item.setSavePath(target);
    item.on('done', (_e, state) => downloads.push({ target, state }));
  });
  try {
    await window.loadFile(path.join(__dirname, 'index.html'));
    await delay(1500);
    const counts = await window.webContents.executeJavaScript(`(() => {
      const save = () => { document.querySelector('#save').click(); return JSON.parse(localStorage.getItem('film-space-universal-scene')).people.length; };
      const initial = save();
      document.querySelector('#add').click();
      const added = save();
      document.querySelector('#remove').click();
      return { initial, added, removed: save() };
    })()`);
    if (counts.initial !== 2 || counts.added !== 3 || counts.removed !== 2) throw new Error('Scene add/delete test failed: ' + JSON.stringify(counts));
    const editing = await window.webContents.executeJavaScript(`(() => {
      const $=s=>document.querySelector(s);
      const change=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new Event('change'));};
      const save=()=>{$('#save').click();return JSON.parse(localStorage.getItem('film-space-universal-scene'));};
      for(const type of ['car','bike','wall','sphere','child','box','cone','cylinder','circle','plane','torus']) {change('#shape',type);$('#add').click();}
      change('#objectName','Yellow prop');change('#positiony',2);change('#scalex',2);change('#rotationy',45);
      $('[data-color="#facc15"]').click();change('#floorSize',50);
      const before=save();$('#duplicate').click();$('#remove').click();$('#load').click();const after=save();
      if(JSON.stringify(before.objects)!==JSON.stringify(after.objects))throw Error('Scene roundtrip changed objects');
      const prop=after.objects.at(-1);
      if(prop.name!=='Yellow prop'||prop.color!=='#facc15'||prop.scale[0]!==2||prop.position[1]!==2||after.floorSize!==50)throw Error('Inspector data lost');
      $('#lock').click();if($('#lock').textContent!=='Unlock viewpoint')throw Error('Lock toggle failed');
      $('#add').click();$('#remove').click();$('#lock').click();if($('#lock').textContent!=='Lock viewpoint')throw Error('Unlock failed');
      return {types:after.objects.map(p=>p.type),prop,floorSize:after.floorSize};
    })()`);
    await window.webContents.executeJavaScript("document.querySelector('#record').click(); window.dispatchEvent(new KeyboardEvent('keydown', {key:'w'}));");
    await delay(1400);
    await window.webContents.executeJavaScript("window.dispatchEvent(new KeyboardEvent('keyup', {key:'w'})); document.querySelector('#record').click();");
    await delay(700);
    await window.webContents.executeJavaScript("document.querySelector('#exportPath').click();");
    await delay(700);
    const capture = await window.webContents.capturePage();
    fs.writeFileSync(path.join(output, 'windows-studio.png'), capture.toPNG());
    const pathFile = path.join(output, 'film-space-camera-path.json');
    const data = JSON.parse(fs.readFileSync(pathFile, 'utf8'));
    if (data.samples.length < 10) throw new Error('Too few camera samples');
    if (JSON.stringify(data.samples[0].position) === JSON.stringify(data.samples.at(-1).position)) throw new Error('Camera did not move');
    const video = downloads.find(d => /\.(mp4|webm)$/.test(d.target));
    if (!video || video.state !== 'completed' || fs.statSync(video.target).size < 1000) throw new Error('Video export failed');
    if (errors.length) throw new Error(errors.join('\n'));
    const result = { passed: true, counts, editing, samples: data.samples.length, downloads };
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    app.exit(0);
  } catch (error) {
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: false, error: String(error), errors }, null, 2));
    console.error(error);
    app.exit(1);
  }
});
