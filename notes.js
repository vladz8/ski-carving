/* Raw Notes: a zoomable, draggable view of Vlad's GoodNotes whiteboard.
   The board is cut into 512 px image tiles at five zoom levels (notes/tiles/<level>/<col>_<row>.webp),
   like an online map: only the tiles you can see are loaded, at the sharpness the current zoom needs.
   World units are PDF points of the cropped board (W × H). */
(function () {
'use strict';

const W = 3216, H = 14996, T = 512, BASE = 0.09375, LEVELS = 5;
const scaleOf = z => BASE * Math.pow(2, z);          // tile pixels per board point at level z
/* Parts of the board, as rectangles in board points, and the chapter of the site each one belongs to. */
const SECTIONS = [
  { name: 'Measurements', ch: 'Chapter 2', r: [250, 560, 2700, 1400] },
  { name: 'The sidecut circle and the fit', ch: 'Chapter 2', r: [100, 2050, 3000, 2250] },
  { name: 'Tipping and the gap', ch: 'Chapters 3–4', r: [1100, 4500, 1500, 1500] },
  { name: 'The bend and R = Rsc cos φ', ch: 'Chapters 4–5', r: [880, 6050, 1050, 1850] },
  { name: 'Measuring R at home', ch: 'Chapter 6', r: [1820, 7950, 1350, 2000] },
  { name: 'Error bars and χ²', ch: 'Chapter 7', r: [1780, 10050, 950, 1100] },
  { name: 'Testing the shape of the law', ch: 'Chapter 7', r: [1460, 11330, 900, 1250] },
  { name: 'On the slope', ch: 'Chapter 8', r: [1260, 12930, 800, 1990] }
];

const $ = s => document.querySelector(s);
const view = $('#nv'), world = $('#nv-world');
if (!view || !world) return;
const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

let k = 0.1, tx = 0, ty = 0;     // screen px per board point, and where the board's top-left corner sits on screen
let vw = 0, vh = 0, minK = 0.05;
const MAXK = 2.5;
let anim = 0, raf = 0;

/* ---------- tiles ---------- */
const backdrop = document.createElement('img');
backdrop.src = 'notes/overview.webp';
backdrop.alt = '';
backdrop.className = 'nv-back';
backdrop.draggable = false;
backdrop.style.width = W + 'px';
backdrop.style.height = H + 'px';
world.appendChild(backdrop);
world.style.width = W + 'px';
world.style.height = H + 'px';

const tiles = new Map();          // key "z/i_j" -> img
function levelFor(kk) {
  const want = kk * (window.devicePixelRatio || 1);
  for (let z = 0; z < LEVELS; z++) if (scaleOf(z) >= want * 0.85) return z;
  return LEVELS - 1;
}
function updateTiles() {
  const z = levelFor(k), s = scaleOf(z);
  if (z <= 1) { tiles.forEach(img => img.remove()); tiles.clear(); return; }   // the backdrop is sharp enough
  const pw = Math.ceil(W * s), ph = Math.ceil(H * s);
  const nx = Math.ceil(pw / T), ny = Math.ceil(ph / T);
  const x0 = -tx / k, y0 = -ty / k, x1 = (vw - tx) / k, y1 = (vh - ty) / k;
  const i0 = clamp(Math.floor(x0 * s / T) - 1, 0, nx - 1), i1 = clamp(Math.floor(x1 * s / T) + 1, 0, nx - 1);
  const j0 = clamp(Math.floor(y0 * s / T) - 1, 0, ny - 1), j1 = clamp(Math.floor(y1 * s / T) + 1, 0, ny - 1);
  const keep = new Set();
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const key = z + '/' + i + '_' + j;
    keep.add(key);
    if (tiles.has(key)) continue;
    const img = document.createElement('img');
    img.alt = '';
    img.draggable = false;
    img.decoding = 'async';
    img.className = 'nv-tile';
    const tw = Math.min(T, pw - i * T), th = Math.min(T, ph - j * T);
    img.style.left = (i * T / s) + 'px';
    img.style.top = (j * T / s) + 'px';
    img.style.width = ((tw + 0.6) / s) + 'px';    // a hair of overlap hides seams between tiles
    img.style.height = ((th + 0.6) / s) + 'px';
    img.onload = () => img.classList.add('in');
    img.src = 'notes/tiles/' + key + '.webp';
    world.appendChild(img);
    tiles.set(key, img);
  }
  // Drop tiles from other levels once this level's tiles are on screen, and anything far off screen.
  tiles.forEach((img, key) => {
    if (keep.has(key)) return;
    const lz = +key.split('/')[0];
    if (lz !== z || !img.complete) { if (lz !== z) setTimeout(() => { if (!keep.has(key) && tiles.get(key) === img) { img.remove(); tiles.delete(key); } }, 400); return; }
    img.remove(); tiles.delete(key);
  });
}

/* ---------- view ---------- */
function fitWidthK() { return Math.min(MAXK, (vw - (vw > 700 ? 64 : 24)) / W); }
function clampView(kk, x, y) {
  const bw = W * kk, bh = H * kk, m = 48;
  x = bw <= vw ? (vw - bw) / 2 : clamp(x, vw - bw - m, m);
  y = bh <= vh ? (vh - bh) / 2 : clamp(y, vh - bh - m, m);
  return [x, y];
}
function apply() {
  [tx, ty] = clampView(k, tx, ty);
  world.style.transform = 'translate(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px) scale(' + k.toFixed(5) + ')';
  if (!raf) raf = requestAnimationFrame(() => { raf = 0; updateTiles(); updateMini(); updateToc(); });
  const zo = $('#nv-zoom');
  if (zo) zo.textContent = Math.round(k * 100) + '%';
}
function zoomAt(nk, cx, cy) {
  nk = clamp(nk, minK, MAXK);
  const wx = (cx - tx) / k, wy = (cy - ty) / k;
  k = nk; tx = cx - wx * k; ty = cy - wy * k;
  apply();
}
function stopAnim() { cancelAnimationFrame(anim); anim = 0; }
function animateTo(k1, x1, y1, ms) {
  stopAnim();
  [x1, y1] = clampView(k1, x1, y1);
  if (reduceMotion || !ms) { k = k1; tx = x1; ty = y1; apply(); return; }
  const k0 = k, c0 = [(vw / 2 - tx) / k, (vh / 2 - ty) / k], c1 = [(vw / 2 - x1) / k1, (vh / 2 - y1) / k1];
  const t0 = performance.now(), ease = t => 1 - Math.pow(1 - t, 3);
  const step = now => {
    const u = clamp((now - t0) / ms, 0, 1), e = ease(u);
    k = Math.exp(Math.log(k0) + (Math.log(k1) - Math.log(k0)) * e);
    const cx = c0[0] + (c1[0] - c0[0]) * e, cy = c0[1] + (c1[1] - c0[1]) * e;
    tx = vw / 2 - cx * k; ty = vh / 2 - cy * k;
    apply();
    anim = u < 1 ? requestAnimationFrame(step) : 0;
  };
  anim = requestAnimationFrame(step);
}
function zoomBy(f, cx, cy, ms) {
  if (cx === undefined) { cx = vw / 2; cy = vh / 2; }
  const nk = clamp(k * f, minK, MAXK), wx = (cx - tx) / k, wy = (cy - ty) / k;
  animateTo(nk, cx - wx * nk, cy - wy * nk, ms === undefined ? 320 : ms);
}
function fitWidth(ms) {
  const nk = fitWidthK();
  animateTo(nk, (vw - W * nk) / 2, ty / k * nk, ms);
}
function goToRect(r, ms) {
  const nk = clamp(Math.min(vw * 0.94 / r[2], 1.2), minK, MAXK);
  animateTo(nk, vw / 2 - (r[0] + r[2] / 2) * nk, 20 - r[1] * nk, ms);
}
function resize() {
  const old = [vw, vh];
  vw = view.clientWidth; vh = view.clientHeight;
  minK = Math.min(fitWidthK(), vh / H) * 0.9;
  if (!old[0]) return;
  const cx = (old[0] / 2 - tx) / k, cy = (old[1] / 2 - ty) / k;
  tx = vw / 2 - cx * k; ty = vh / 2 - cy * k;
  apply();
}

/* ---------- input ---------- */
const pts = new Map();
let last = null, pinch = null, lastTap = 0, moved = 0;
view.addEventListener('pointerdown', e => {
  if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
  stopAnim();
  view.setPointerCapture(e.pointerId);
  pts.set(e.pointerId, [e.clientX, e.clientY]);
  moved = 0;
  if (pts.size === 1) last = [e.clientX, e.clientY];
  if (pts.size === 2) {
    const [a, b] = [...pts.values()];
    pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k };
  }
  view.classList.add('grabbing');
});
view.addEventListener('pointermove', e => {
  if (!pts.has(e.pointerId)) return;
  const r = view.getBoundingClientRect();
  pts.set(e.pointerId, [e.clientX, e.clientY]);
  if (pts.size >= 2 && pinch) {
    const [a, b] = [...pts.values()];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]), mx = (a[0] + b[0]) / 2 - r.left, my = (a[1] + b[1]) / 2 - r.top;
    if (pinch.mx !== undefined) { tx += mx - pinch.mx; ty += my - pinch.my; }
    pinch.mx = mx; pinch.my = my;
    zoomAt(pinch.k * d / pinch.d, mx, my);
    moved = 99;
  } else if (last) {
    const dx = e.clientX - last[0], dy = e.clientY - last[1];
    moved += Math.abs(dx) + Math.abs(dy);
    tx += dx; ty += dy; last = [e.clientX, e.clientY];
    apply();
  }
});
function endPointer(e) {
  if (!pts.has(e.pointerId)) return;
  pts.delete(e.pointerId);
  if (pts.size < 2) pinch = null;
  if (pts.size === 1) last = [...pts.values()][0];
  if (!pts.size) {
    last = null;
    view.classList.remove('grabbing');
    if (e.pointerType === 'touch' && moved < 8 && e.type === 'pointerup') {      // double-tap to zoom in
      const now = performance.now(), r = view.getBoundingClientRect();
      if (now - lastTap < 320) { zoomBy(2, e.clientX - r.left, e.clientY - r.top); lastTap = 0; } else lastTap = now;
    }
  }
}
view.addEventListener('pointerup', endPointer);
view.addEventListener('pointercancel', endPointer);
view.addEventListener('dblclick', e => {
  const r = view.getBoundingClientRect();
  zoomBy(e.shiftKey ? 0.5 : 2, e.clientX - r.left, e.clientY - r.top);
});
view.addEventListener('wheel', e => {
  e.preventDefault();
  stopAnim();
  const r = view.getBoundingClientRect(), unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vh : 1;
  if (e.ctrlKey || e.metaKey) {
    zoomAt(k * Math.exp(-e.deltaY * unit * 0.0025), e.clientX - r.left, e.clientY - r.top);
  } else {
    tx -= (e.shiftKey ? e.deltaY : e.deltaX) * unit;
    ty -= (e.shiftKey ? 0 : e.deltaY) * unit;
    apply();
  }
}, { passive: false });
view.addEventListener('keydown', e => {
  const step = 90, map = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step], PageUp: [0, vh * 0.8], PageDown: [0, -vh * 0.8] };
  if (map[e.key]) { e.preventDefault(); animateTo(k, tx + map[e.key][0], ty + map[e.key][1], 160); }
  else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(1.5); }
  else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBy(1 / 1.5); }
  else if (e.key === '0') { e.preventDefault(); fitWidth(400); }
});
// Safari's own pinch gestures would zoom the whole page; the viewer handles pinching itself.
['gesturestart', 'gesturechange'].forEach(ev => view.addEventListener(ev, e => e.preventDefault()));

/* ---------- buttons ---------- */
const on = (id, f) => { const b = $(id); if (b) b.addEventListener('click', f); };
on('#nv-in', () => zoomBy(1.5));
on('#nv-out', () => zoomBy(1 / 1.5));
on('#nv-fit', () => fitWidth(450));
const full = $('#nv-full'), stage = $('.nv-stage');
if (full && stage && stage.requestFullscreen) {
  full.hidden = false;
  full.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else stage.requestFullscreen().catch(() => {}); });
  document.addEventListener('fullscreenchange', () => setTimeout(resize, 60));
}
const intro = $('#nv-intro');
on('#nv-intro-x', () => { if (intro) intro.classList.add('gone'); view.focus({ preventScroll: true }); });

/* ---------- minimap ---------- */
const mini = $('#nv-mini'), miniView = $('#nv-mini-view');
function updateMini() {
  if (!mini || !miniView) return;
  const mw = mini.clientWidth, s = mw / W;
  const x = clamp(-tx / k, 0, W), y = clamp(-ty / k, 0, H);
  const x2 = clamp((vw - tx) / k, 0, W), y2 = clamp((vh - ty) / k, 0, H);
  miniView.style.transform = 'translate(' + (x * s).toFixed(1) + 'px,' + (y * s).toFixed(1) + 'px)';
  miniView.style.width = Math.max(4, (x2 - x) * s).toFixed(1) + 'px';
  miniView.style.height = Math.max(4, (y2 - y) * s).toFixed(1) + 'px';
}
if (mini) {
  const jump = e => {
    const r = mini.getBoundingClientRect(), s = r.width / W;
    const wx = (e.clientX - r.left) / s, wy = (e.clientY - r.top) / s;
    tx = vw / 2 - wx * k; ty = vh / 2 - wy * k; apply();
  };
  mini.addEventListener('pointerdown', e => { stopAnim(); mini.setPointerCapture(e.pointerId); jump(e); mini.dataset.drag = '1'; });
  mini.addEventListener('pointermove', e => { if (mini.dataset.drag) jump(e); });
  ['pointerup', 'pointercancel'].forEach(ev => mini.addEventListener(ev, () => { delete mini.dataset.drag; }));
}

/* ---------- table of contents ---------- */
const toc = $('#nv-toc'), tocBtns = [];
if (toc) SECTIONS.forEach((sec, i) => {
  const li = document.createElement('li'), b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = '<span class="n">' + String(i + 1).padStart(2, '0') + '</span><span class="t"></span><span class="c"></span>';
  b.querySelector('.t').textContent = sec.name;
  b.querySelector('.c').textContent = sec.ch;
  b.addEventListener('click', () => { if (intro) intro.classList.add('gone'); goToRect(sec.r, 650); });
  li.appendChild(b); toc.appendChild(li); tocBtns.push(b);
});
let activeSec = -1;
function updateToc() {
  const cy = (vh * 0.4 - ty) / k;
  let a = -1;
  SECTIONS.forEach((s, i) => { if (cy >= s.r[1] - 150) a = i; });
  if (a === activeSec) return;
  activeSec = a;
  tocBtns.forEach((b, i) => b.classList.toggle('on', i === a));
  const b = tocBtns[a];
  if (b && toc.scrollWidth > toc.clientWidth + 4) {             // the chip row on phones: keep the active chip in view
    const t = b.parentElement.offsetLeft - toc.clientWidth / 2 + b.offsetWidth / 2;
    toc.scrollTo({ left: Math.max(0, t), behavior: reduceMotion ? 'auto' : 'smooth' });
  }
}

/* ---------- start ---------- */
vw = view.clientWidth; vh = view.clientHeight;
minK = Math.min(fitWidthK(), vh / H) * 0.9;
k = fitWidthK(); tx = (vw - W * k) / 2; ty = 24;
apply();
window.addEventListener('resize', resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe(view);
})();
