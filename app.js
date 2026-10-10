'use strict';
const $ = id => document.getElementById(id);
const DEF = {game:'valorant',sens:0.4,yaw:0.07,fov:103,mode:'grid',xType:'cross',xColor:'#00ffd5',xSize:8,xThick:2,xGap:4,xDot:3,xOutW:1,xOutC:'#000000',
  wall:'#1b2330',floor:'#10151d',ball:'#5ec8ff',mat:'glossy',sound:'standard',vol:50,fpsMode:'0',fpsCustom:120};
// base: FOVの基準アスペクト比 (Source系は4:3, その他は16:9)
const GAMES = {
  valorant:{yaw:.07,fov:103,min:103,max:103,base:16/9},
  apex:{yaw:.022,fov:90,min:70,max:110,base:4/3},
  ow2:{yaw:.0066,fov:103,min:80,max:103,base:16/9},
  custom:{yaw:.022,fov:103,min:30,max:150,base:16/9}
};
let s = {...DEF};
try { Object.assign(s, JSON.parse(localStorage.getItem('webaim') || '{}')); } catch (e) {}
const save = () => { try { localStorage.setItem('webaim', JSON.stringify(s)); } catch (e) {} };

/* ---------- Three.js ---------- */
const cv = $('c');
const renderer = new THREE.WebGLRenderer({canvas:cv, antialias:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(75, 1, .1, 200);
cam.rotation.order = 'YXZ';
scene.add(new THREE.AmbientLight(0xffffff, .7));
const dl = new THREE.DirectionalLight(0xffffff, .8); dl.position.set(.3, 1, 1); scene.add(dl);

function setFov() {
  const g = GAMES[s.game];
  cam.fov = 2 * Math.atan(Math.tan(s.fov * Math.PI / 360) / g.base) * 180 / Math.PI;
  cam.aspect = innerWidth / innerHeight;
  cam.updateProjectionMatrix();
}
function resize() {
  renderer.setSize(innerWidth, innerHeight); setFov();
  drawXh();
}
addEventListener('resize', resize);

let room;
function gridTex(bg, rx, ry) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = 3; x.strokeRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.repeat.set(rx, ry);
  return t;
}
function buildRoom() {
  if (room) { scene.remove(room); room.geometry.dispose(); room.userData.m.forEach(m => { m.map.dispose(); m.dispose(); }); }
  const mk = (bg, rx, ry) => new THREE.MeshBasicMaterial({map:gridTex(bg, rx, ry), side:THREE.BackSide});
  const wall = mk(s.wall, 10, 5), ceil = mk(s.wall, 10, 10), floor = mk(s.floor, 10, 10);
  room = new THREE.Mesh(new THREE.BoxGeometry(80, 40, 80), [wall, wall, ceil, floor, wall, wall]);
  room.userData.m = [wall, ceil, floor]; room.position.y = 8; scene.add(room);
}

/* ---------- 設定UI ---------- */
function rad() { return s.yaw * s.sens * Math.PI / 180; }
function drawXh() {
  // クロスヘアは実画面のピクセル(物理px)単位で canvas に描く。表示倍率(125%等)でも上下左右が崩れない
  const t = Math.round(s.xThick), g = Math.round(s.xGap), l = Math.round(s.xSize), o = Math.round(s.xOutW), d = Math.round(s.xDot);
  const h2 = v => -Math.floor(v / 2), sh = [];
  if (s.xType !== 'cross') sh.push([d, d, h2(d), h2(d), 1]);
  if (s.xType !== 'dot') sh.push([t, l, h2(t), -(g + l)], [t, l, h2(t), g], [l, t, -(g + l), h2(t)], [l, t, g, h2(t)]);
  const S = sh.filter(q => q[0] > 0 && q[1] > 0), dpr = window.devicePixelRatio || 1;
  document.querySelectorAll('canvas.xhc').forEach(cv => {
    cv.width = Math.round((cv.clientWidth || 300) * dpr); cv.height = Math.round((cv.clientHeight || 110) * dpr);
    const x = cv.getContext('2d'), cx = cv.width >> 1, cy = cv.height >> 1;
    const draw = (color, grow) => { x.fillStyle = color; S.forEach(([w, h, a, b, r]) => {
      if (r) { x.beginPath(); x.arc(cx + a + w / 2, cy + b + h / 2, w / 2 + grow, 0, 7); x.fill(); }
      else x.fillRect(cx + a - grow, cy + b - grow, w + 2 * grow, h + 2 * grow);
    }); };
    if (o > 0) draw(s.xOutC, o);
    draw(s.xColor, 0);
  });
}
function syncGame(reset) {
  const g = GAMES[s.game];
  if (reset) { if (s.game !== 'custom') s.yaw = g.yaw; s.fov = g.fov; }
  s.fov = Math.min(g.max, Math.max(g.min, s.fov));
  const f = $('fov'); f.min = g.min; f.max = g.max; f.disabled = g.min === g.max; f.value = s.fov;
  $('yaw').disabled = s.game !== 'custom'; $('yaw').value = s.yaw;
}
const clampEl = (el, v) => { v = Number(v); if (isNaN(v)) v = 0; if (el.min !== '' && v < +el.min) v = +el.min; if (el.max !== '' && v > +el.max) v = +el.max; return v; };
document.querySelectorAll('[data-k]').forEach(el => {
  const k = el.dataset.k, num = el.type === 'number' || el.type === 'range';
  if (num) s[k] = clampEl(el, s[k]);
  el.value = s[k];
  el.addEventListener('input', () => {
    if (num) { if (isNaN(parseFloat(el.value))) return; s[k] = clampEl(el, parseFloat(el.value)); } else s[k] = el.value;
    document.querySelectorAll(`[data-k="${k}"]`).forEach(o => { if (o !== el) o.value = s[k]; });
    if (k === 'fpsMode') $('fpsCL').hidden = s.fpsMode !== 'custom';
    if (k === 'game') syncGame(true);
    if (k === 'fov') syncGame(false);
    if (k === 'wall' || k === 'floor') buildRoom();
    if (k === 'vol' && mg) mg.gain.value = s.vol / 100;
    if (k.startsWith('x')) drawXh();
    setFov(); save();
  });
});
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { s.mode = b.dataset.mode; save(); startGame(); });
document.querySelectorAll('.tab').forEach(tb => tb.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.setAttribute('aria-selected', x === tb));
  document.querySelectorAll('.tp').forEach(p => p.hidden = p.id !== tb.dataset.t);
  drawXh();
});
$('openSet').onclick = () => { setBack = 'home'; show('settings'); };
$('back').onclick = () => show(setBack);
$('mp3').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  if (custom) URL.revokeObjectURL(custom.src);
  custom = new Audio(URL.createObjectURL(f)); s.sound = 'custom'; $('snd').value = 'custom'; save();
});
$('test').onclick = () => { ensureAudio(); playHit(); };

/* ---------- サウンド ---------- */
let ac, mg, custom = null, tone = null, looping = false;
const snd = () => (s.sound === 'custom' && !custom) ? 'standard' : s.sound;
const PRE = {standard:[880, .08, 'sine'], crisp:[1760, .05, 'triangle'], deep:[220, .16, 'sine']};
function ensureAudio() {
  if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); mg = ac.createGain(); mg.connect(ac.destination); }
  ac.resume(); mg.gain.value = s.vol / 100;
}
function playHit() {
  if (snd() === 'custom') { custom.volume = s.vol / 100; custom.loop = false; custom.currentTime = 0; custom.play().catch(() => {}); return; }
  const [f, d, ty] = PRE[snd()], t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = ty; o.frequency.setValueAtTime(f, t);
  if (snd() === 'deep') o.frequency.exponentialRampToValueAtTime(110, t + d);
  g.gain.setValueAtTime(.8, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
  o.connect(g).connect(mg); o.start(t); o.stop(t + d);
}
function loopOn() {
  if (looping) return; looping = true;
  if (snd() === 'custom') { custom.volume = s.vol / 100; custom.loop = true; custom.play().catch(() => {}); return; }
  tone = ac.createOscillator(); const g = ac.createGain(); g.gain.value = .25;
  tone.type = PRE[snd()][2]; tone.frequency.value = PRE[snd()][0] / 2; tone.connect(g).connect(mg); tone.start();
}
function loopOff() {
  if (!looping) return; looping = false;
  if (custom) custom.pause();
  if (tone) { try { tone.stop(); } catch (e) {} tone = null; }
}

/* ---------- ゲーム ---------- */
const D = 20, SP = 10, DUR = 60;
const ray = new THREE.Raycaster(), clock = new THREE.Clock();
let state = 'home', setBack = 'home', lockTimer = null, G = null, down = false, yaw = 0, pitch = 0, cdTimer = null;

function bounds() { const hh = D * Math.tan(cam.fov * Math.PI / 360); return {hw: hh * cam.aspect * .8, hh: hh * .8}; }
function cleanup() { if (!G) return; G.meshes.forEach(m => scene.remove(m)); G.geo.dispose(); G.mat.dispose(); G = null; }
function pick() { ray.setFromCamera({x:0, y:0}, cam); return ray.intersectObjects(G.meshes)[0]; }
function place(mesh) {
  const b = bounds(), six = G.m === 'six', cols = six ? 6 : 4, rows = 4, sp = (six ? 2.5 : 3.3 * G.r), cand = [];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = (i - (cols - 1) / 2) * sp, y = (j - (rows - 1) / 2) * sp;
    const same = mesh.visible && Math.abs(mesh.position.x - x) < .01 && Math.abs(mesh.position.y - y) < .01;
    if (!same && G.meshes.every(o => o === mesh || !o.visible || Math.hypot(o.position.x - x, o.position.y - y) >= G.r * 2.5)) cand.push([x, y]);
  }
  const [x, y] = cand[Math.random() * cand.length | 0] || [0, 0];
  mesh.position.set(x, y, -D); mesh.userData.t = G.el; mesh.visible = true;
}
function newGame() {
  cleanup();
  const m = s.mode, trk = m === 'track', six = m === 'six';
  const r = trk ? 1 : six ? .3 : 1.2, n = trk ? 1 : six ? 6 : 3;
  const opt = {color: s.ball}, C = s.mat === 'flat' ? THREE.MeshBasicMaterial : s.mat === 'matte' ? THREE.MeshLambertMaterial : THREE.MeshPhongMaterial;
  if (s.mat === 'glossy') opt.shininess = 90;
  G = {m, r, geo: new THREE.SphereGeometry(r, 24, 16), mat: new C(opt), meshes: [], el: 0, pts: 0, hits: 0, clicks: 0, on: 0, dir: 1, ft: 1, tk: .07};
  for (let i = 0; i < n; i++) {
    const mesh = new THREE.Mesh(G.geo, G.mat); mesh.visible = false; scene.add(mesh); G.meshes.push(mesh);
    if (trk) { mesh.position.set(0, 0, -D); mesh.visible = true; G.ft = rnd(); } else place(mesh);
  }
}
const rnd = () => .3 + Math.random() * 4.7;
const finalScore = () => G.m === 'track' ? G.pts : (G.clicks ? G.pts * Math.pow(G.hits / G.clicks, 2) : 0);

function update(dt) {
  dt = Math.min(dt, DUR - G.el); G.el += dt;
  if (G.m === 'track') {
    const m = G.meshes[0], lim = bounds().hw;
    m.position.x += G.dir * SP * dt;
    if (Math.abs(m.position.x) >= lim) { m.position.x = Math.sign(m.position.x) * lim; G.dir = -Math.sign(m.position.x); G.ft = rnd(); }
    else if ((G.ft -= dt) <= 0) { G.dir *= -1; G.ft = rnd(); }
    if (down && pick()) { G.pts += dt * 1000; G.on += dt; G.tk += dt; if (G.tk >= .07) { G.tk %= .07; playHit(); } } else G.tk = .07;
  }
  hud();
  if (G.el >= DUR) finish();
}
function hud() {
  $('hT').textContent = Math.max(0, DUR - G.el).toFixed(1);
  $('hS').textContent = Math.round(finalScore());
  $('hA').textContent = G.m === 'track' ? (G.el ? (G.on / G.el * 100).toFixed(0) + '%' : '-') : (G.clicks ? (G.hits / G.clicks * 100).toFixed(0) + '%' : '-');
}
function show(id) { ['home', 'settings', 'pause', 'result'].forEach(k => $(k).hidden = k !== id); $('hud').hidden = id === 'home' || id === 'settings'; if (id === 'settings') drawXh(); }
function finish() {
  state = 'result'; down = false; loopOff(); hud();
  document.exitPointerLock();
  const names = {grid:'Gridshot', six:'Sixshot', track:'Horizontal Tracking'};
  $('rM').textContent = names[G.m];
  $('rS').textContent = Math.round(finalScore()).toLocaleString();
  if (G.m === 'track') {
    $('rA').textContent = `トラッキング率 ${(G.on / DUR * 100).toFixed(1)}%`;
    $('rH').textContent = `Hit ${G.on.toFixed(1)}s / Miss ${(DUR - G.on).toFixed(1)}s`;
  } else {
    $('rA').textContent = `命中率 ${G.clicks ? (G.hits / G.clicks * 100).toFixed(1) : 0}%`;
    $('rH').textContent = `Hit ${G.hits} / Miss ${G.clicks - G.hits}`;
  }
  show('result');
}
function lock() {
  const p = cv.requestPointerLock({unadjustedMovement: true});
  if (p && p.catch) p.catch(() => cv.requestPointerLock());
}
function startGame() {
  ensureAudio(); clearInterval(cdTimer); $('cd').hidden = true;
  newGame(); yaw = pitch = 0; cam.rotation.set(0, 0, 0);
  show('none'); hud();
  enter();
}
// 全画面 → ポインターロックの順に取得し、ロック成功後にカウントダウンを始める
async function enter() {
  state = 'starting'; down = false; clearTimeout(lockTimer);
  lockTimer = setTimeout(() => { if (state === 'starting') pause(); }, 2500);
  try { if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); } catch (e) {}
  // Esc をページ側で受け取り、全画面を維持したままポーズできるようにする (Chrome/Edge)
  try { if (document.fullscreenElement && navigator.keyboard && navigator.keyboard.lock) await navigator.keyboard.lock(['Escape']); } catch (e) {}
  if (state === 'starting') lock();
}
function countdown() {
  clearInterval(cdTimer); state = 'countdown';
  let n = 3; const cd = $('cd'); cd.textContent = n; cd.hidden = false;
  cdTimer = setInterval(() => {
    if (--n > 0) { cd.textContent = n; return; }
    clearInterval(cdTimer); cd.hidden = true; state = 'playing'; clock.getDelta();
  }, 1000);
}
function pause() {
  clearInterval(cdTimer); clearTimeout(lockTimer); $('cd').hidden = true;
  state = 'paused'; down = false; loopOff(); show('pause'); $('hud').hidden = false;
}
function resume() {
  if (state !== 'paused') return;
  show('none'); enter();
}
function toMenu() {
  clearInterval(cdTimer); $('cd').hidden = true; state = 'home'; down = false; loopOff();
  if (document.pointerLockElement) document.exitPointerLock();
  if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  show('home');
}

/* ---------- 入力 ---------- */
$('pause').addEventListener('click', e => { if (!e.target.closest('button')) resume(); });
document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', e => {
  e.stopPropagation(); const a = b.dataset.act; if (a === 'resume') resume(); else if (a === 'retry') startGame(); else if (a === 'set') { setBack = state === 'result' ? 'result' : 'pause'; show('settings'); } else toMenu();
}));
addEventListener('keydown', e => {
  if (e.code === 'Escape' && (state === 'starting' || state === 'countdown' || state === 'playing')) {
    e.preventDefault();
    if (document.pointerLockElement === cv) document.exitPointerLock(); else pause();
  }
});
addEventListener('keydown', e => { if (e.code === 'KeyR' && (state === 'paused' || state === 'result') && $('settings').hidden) startGame(); });
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === cv) { if (state === 'starting') { clearTimeout(lockTimer); countdown(); } }
  else if (state === 'playing' || state === 'countdown') pause();
});
addEventListener('mousemove', e => {
  if ((state !== 'playing' && state !== 'countdown') || document.pointerLockElement !== cv) return;
  const k = rad(), lim = 89 * Math.PI / 180;
  yaw -= e.movementX * k; pitch = Math.max(-lim, Math.min(lim, pitch - e.movementY * k));
  cam.rotation.set(pitch, yaw, 0);
});
addEventListener('mousedown', e => {
  if (e.button !== 0 || state !== 'playing') return;
  down = true;
  if (G.m === 'track') return;
  G.clicks++;
  const h = pick();
  if (h) {
    const ms = (G.el - h.object.userData.t) * 1000;
    G.pts += ms <= 200 ? 1000 : ms >= 1000 ? 100 : 1000 - (ms - 200) * 900 / 800;
    G.hits++; place(h.object); playHit();
  }
  hud();
});
addEventListener('mouseup', e => { if (e.button === 0) down = false; });

/* ---------- メインループ (デルタタイム基準 / FPS上限) ---------- */
let last = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const cap = s.fpsMode === 'custom' ? s.fpsCustom : +s.fpsMode;
  if (cap && now - last < 1000 / cap - 1) return;
  last = now;
  const dt = Math.min(clock.getDelta(), .1);
  if (state === 'playing') update(dt);
  renderer.render(scene, cam);
}

buildRoom(); syncGame(false); drawXh(); resize(); $('fpsCL').hidden = s.fpsMode !== 'custom'; show('home');
requestAnimationFrame(loop);
