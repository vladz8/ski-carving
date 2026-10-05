/* The Physics of Ski Carving - interactive figures and page behaviour. */
(function () {
'use strict';

/* ================= helpers ================= */
const NS = 'http://www.w3.org/2000/svg';
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const G = 9.81;

function S(tag, attrs, parent, text) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) { const v = attrs[k]; if (v !== undefined && v !== null) e.setAttribute(k, v); }
  if (text !== undefined && text !== null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
function setA(el, attrs) {
  for (const k in attrs) {
    const v = attrs[k];
    el.setAttribute(k, typeof v === 'number' ? (Math.round(v * 100) / 100).toString() : v);
  }
  return el;
}
function clearNode(n) { while (n.firstChild) n.removeChild(n.firstChild); }
function P(arr) { return arr.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' '); }
function tangents(pts) {
  const n = pts.length - 1;
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    return [dx / L, dy / L];
  });
}
function polyLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
function quadD(xA, xB, y0, depth) { const xm = (xA + xB) / 2; return 'M' + xA + ' ' + y0 + ' Q' + xm + ' ' + (y0 + 2 * depth).toFixed(2) + ' ' + xB + ' ' + y0; }
function arrow(parent, x1, y1, x2, y2, cls, head) {
  head = head || 9;
  const g = S('g', { class: cls }, parent);
  const a = Math.atan2(y2 - y1, x2 - x1);
  const bx = x2 - head * Math.cos(a), by = y2 - head * Math.sin(a), w = head * 0.55;
  S('line', { x1: x1.toFixed(2), y1: y1.toFixed(2), x2: bx.toFixed(2), y2: by.toFixed(2), class: 'a-line' }, g);
  S('polygon', { points: P([[x2, y2], [bx - w * Math.sin(a), by + w * Math.cos(a)], [bx + w * Math.sin(a), by - w * Math.cos(a)]]), class: 'a-head' }, g);
  return g;
}
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/* text with mixed maths: parts = [[string, isMath], ...] */
function mtext(parent, attrs, parts) {
  const t = S('text', attrs, parent);
  parts.forEach(([s, m]) => S('tspan', m ? { class: 't-mi' } : null, t, s));
  return t;
}
/* "R_sc" with a real subscript inside SVG text */
function rscText(el, pre, post) {
  clearNode(el);
  el.appendChild(document.createTextNode(pre));
  S('tspan', { 'baseline-shift': 'sub', 'font-size': '72%' }, el, 'sc');
  el.appendChild(document.createTextNode(post));
}
function bindRange(id, outId, fmt, cb) {
  const inp = document.getElementById(id);
  if (!inp) return { set() {} };
  const out = outId ? document.getElementById(outId) : null;
  const lo = +inp.min, hi = +inp.max;
  const upd = () => {
    const v = +inp.value;
    inp.style.setProperty('--p', ((v - lo) / (hi - lo) * 100).toFixed(2) + '%');
    if (out) out.textContent = fmt(v);
    cb(v);
  };
  inp.addEventListener('input', upd);
  upd();
  return { inp, set(v) { inp.value = v; upd(); } };
}
function bindSeg(id, cb) {
  const seg = document.getElementById(id);
  if (!seg) return;
  const btns = $$('button', seg);
  btns.forEach(b => b.addEventListener('click', () => {
    btns.forEach(x => {
      const on = x === b;
      x.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (x.hasAttribute('aria-selected')) x.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    cb(b.dataset.val);
  }));
}
function onFirstView(el, cb) {
  if (!('IntersectionObserver' in window)) { cb(); return; }
  const io = new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) { io.disconnect(); cb(); } });
  }, { threshold: 0.35 });
  io.observe(el);
}
function makeTip(container) {
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.setAttribute('role', 'status');
  container.appendChild(tip);
  return {
    show(html, x, y) {
      tip.innerHTML = html;
      const w = container.clientWidth;
      tip.style.left = clamp(x, 90, Math.max(90, w - 90)) + 'px';
      tip.style.top = y + 'px';
      tip.classList.add('show');
    },
    hide() { tip.classList.remove('show'); }
  };
}
function svgToBox(svg, box, x, y) {
  const r = svg.getBoundingClientRect(), br = box.getBoundingClientRect(), vb = svg.viewBox.baseVal;
  return [r.left - br.left + x * r.width / vb.width, r.top - br.top + y * r.height / vb.height];
}

/* ================= the two skis ================= */
const SKI = {
  SL: { key: 'SL', len: 1.65, Lc: 1.4057, Rsc: 12.26, printed: 12, hw: 0.0321, tip: 0.160, tail: 0.084, lim: [45, 50] },
  GS: { key: 'GS', len: 1.88, Lc: 1.6787, Rsc: 28.99, printed: 30, hw: 0.0335, tip: 0.130, tail: 0.071, lim: [65, 70] }
};
Object.keys(SKI).forEach(k => { const s = SKI[k]; s.sag = s.Lc * s.Lc / (8 * s.Rsc); });

/* Top-view outline of a ski in metres: x along the ski (tail negative), y across. */
function outline(s, n) {
  n = n || 140;
  const xb = s.Lc / 2, xa = -xb, R = s.Rsc, hw = s.hw;
  const side = x => hw + R - Math.sqrt(R * R - x * x);
  const hc = side(xb);
  const half = x => {
    if (x >= xa && x <= xb) return side(x);
    if (x > xb) { const t = Math.min(1, (x - xb) / s.tip); return hc * (1 + 0.07 * Math.sin(Math.PI * 0.8 * t)) * Math.sqrt(Math.max(0, 1 - t * t * t)); }
    const t = Math.min(1, (xa - x) / s.tail); return hc * (1 + 0.02 * t) * Math.sqrt(Math.max(0, 1 - Math.pow(t, 6)));
  };
  const x0 = xa - s.tail, x1 = xb + s.tip, top = [];
  for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; top.push([x, half(x)]); }
  const poly = top.concat(top.slice().reverse().map(p => [p[0], -p[1]]));
  return { poly, hc, x0, x1, half };
}

/* ================= page chrome ================= */
function chrome() {
  const nav = $('#nav'), bar = $('#progress');
  const onScroll = () => {
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    if (nav) nav.classList.toggle('scrolled', y > 8);
    const h = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = 'scaleX(' + (h > 0 ? clamp(y / h, 0, 1) : 0).toFixed(4) + ')';
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  const links = $$('#rail a');
  const map = {};
  links.forEach(a => { map[a.dataset.s] = a; });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => {
      es.forEach(e => {
        if (!e.isIntersecting) return;
        links.forEach(a => a.classList.remove('on'));
        const a = map[e.target.id];
        if (a) a.classList.add('on');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(id => { const el = document.getElementById(id); if (el) io.observe(el); });
  }

  $$('.more-btn').forEach(btn => {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (!panel) return;
    const label = btn.querySelector('span');
    const body = panel.querySelector('.deeper-body');
    const base = label.textContent;
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      // Longer drop-downs take a little longer, so every one opens at a calm, similar pace.
      const h = body ? body.offsetHeight : 0;
      const ms = reduceMotion ? 0 : Math.round(clamp(380 + h * 0.3, 420, 950));
      panel.style.transitionDuration = ms + 'ms';
      holdStill(btn, ms + 80);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.classList.toggle('open', open);
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (open) panel.removeAttribute('inert'); else panel.setAttribute('inert', '');
      label.textContent = open ? 'Show less' : base;
    });
  });
}

/* While a drop-down opens or closes, the column around it can grow in both directions
   (it is centred on desktop), which pushes the button up or down the screen. This keeps
   the button where it was by scrolling the page by the same amount, every frame,
   until the animation ends or the reader scrolls themselves. */
function holdStill(el, ms) {
  const root = document.documentElement;
  const top0 = el.getBoundingClientRect().top;
  const t0 = performance.now();
  let stop = false;
  const cancel = () => { stop = true; };
  const evs = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
  evs.forEach(e => window.addEventListener(e, cancel, { passive: true, once: true }));
  const prev = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  const done = () => {
    root.style.scrollBehavior = prev;
    evs.forEach(e => window.removeEventListener(e, cancel));
  };
  const step = now => {
    if (stop) { done(); return; }
    const d = el.getBoundingClientRect().top - top0;
    if (Math.abs(d) >= 0.5) window.scrollBy(0, d);
    if (now - t0 < ms) requestAnimationFrame(step); else done();
  };
  requestAnimationFrame(step);
}

/* The "swoosh": each chapter's text and figure glide in from opposite sides the first time it scrolls into view. */
function swoosh() {
  if (reduceMotion || !('IntersectionObserver' in window) || !document.body.animate) return;
  const io = new IntersectionObserver(es => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const sec = e.target, flip = sec.classList.contains('flip'), narrow = window.innerWidth <= 940;
      const dT = narrow ? [0, 34] : [flip ? 60 : -60, 0];
      const dF = narrow ? [0, 46] : [flip ? -80 : 80, 0];
      const opts = (delay, dur) => ({ duration: dur, delay, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
      const text = sec.querySelector('.ch-text'), fig = sec.querySelector('.ch-fig');
      const num = sec.querySelector('.ch-num'), h = sec.querySelector('h2');
      if (num) num.animate([{ transform: 'translateY(14px)', opacity: 0 }, { transform: 'none', opacity: 1 }], opts(0, 600));
      if (h) h.animate([{ transform: 'translate(' + dT[0] + 'px,' + dT[1] + 'px)', opacity: 0 }, { transform: 'none', opacity: 1 }], opts(40, 900));
      if (text) Array.from(text.children).filter(c => c !== num && c !== h).forEach((c, i) =>
        c.animate([{ transform: 'translate(' + dT[0] * 0.7 + 'px,' + dT[1] * 0.7 + 'px)', opacity: 0 }, { transform: 'none', opacity: 1 }], opts(120 + i * 60, 900)));
      if (fig) fig.animate([{ transform: 'translate(' + dF[0] + 'px,' + dF[1] + 'px) scale(.965)', opacity: 0 }, { transform: 'none', opacity: 1 }], opts(90, 1050));
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  $$('.chapter').forEach(s => io.observe(s));
}

function heroTracks() {
  const svg = $('#heroTracks');
  if (!svg) return;
  const defs = [
    { x: 1010, a: 95, ph: 0.0, w: 1.0 },
    { x: 1190, a: 120, ph: 0.6, w: 0.85 },
    { x: 1350, a: 80, ph: 1.3, w: 0.7 },
    { x: 790, a: 70, ph: 2.1, w: 0.5 }
  ];
  const lines = [];
  defs.forEach((d, j) => {
    const pts = [], N = 160;
    for (let i = 0; i <= N; i++) { const u = i / N; pts.push([d.x + d.a * Math.sin(2 * Math.PI * u * 1.6 + d.ph) - 140 * u, -40 + 980 * u]); }
    const T = tangents(pts);
    [-7, 7].forEach(o => {
      const q = pts.map((p, i) => [p[0] - T[i][1] * o, p[1] + T[i][0] * o]);
      const el = S('polyline', { points: P(q), opacity: (0.9 * d.w).toFixed(2) }, svg);
      lines.push([el, polyLen(q), j]);
    });
  });
  if (reduceMotion || !document.body.animate) return;
  lines.forEach(([el, L, j]) => {
    el.style.strokeDasharray = L.toFixed(1);
    el.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 2800, delay: 200 + j * 280, easing: 'cubic-bezier(.45,.05,.2,1)', fill: 'backwards' });
  });
}

/* ================= 01  skid vs carve ================= */
function fig1() {
  const svg = $('#f1');
  if (!svg) return;
  const N = 220, top = 24, bot = 338, amp = 64;
  const layers = [];
  [{ cx: 140, kind: 'skid' }, { cx: 420, kind: 'carve' }].forEach(c => {
    const pts = [];
    for (let i = 0; i <= N; i++) { const u = i / N; pts.push([c.cx - amp * Math.cos(2.5 * Math.PI * u), top + (bot - top) * u]); }
    const T = tangents(pts), Nn = T.map(t => [-t[1], t[0]]);
    const curv = pts.map((p, i) => { const a = T[Math.max(0, i - 2)], b = T[Math.min(N, i + 2)]; return a[0] * b[1] - a[1] * b[0]; });
    const g = S('g', null, svg);
    const strokes = [], decos = [];
    if (c.kind === 'skid') {
      strokes.push([S('polyline', { points: P(pts), class: 'skid-band' }, g), polyLen(pts)]);
      const rnd = mulberry32(11);
      for (let i = 6; i < N - 3; i += 6) {
        const p = pts[i], n = Nn[i], t = T[i], a = 12, k = 0.5;
        decos.push([i / N, S('line', {
          x1: (p[0] - n[0] * a + t[0] * a * k).toFixed(1), y1: (p[1] - n[1] * a + t[1] * a * k).toFixed(1),
          x2: (p[0] + n[0] * a - t[0] * a * k).toFixed(1), y2: (p[1] + n[1] * a - t[1] * a * k).toFixed(1), class: 'skid-scuff' }, g)]);
      }
      for (let i = 4; i < N - 4; i += 3) {
        const cv = curv[i];
        if (Math.abs(cv) < 0.03) continue;
        const side = cv > 0 ? -1 : 1, p = pts[i], n = Nn[i];
        for (let k = 0; k < 2; k++) {
          const d = 19 + rnd() * 24, j = (rnd() - 0.5) * 12;
          decos.push([i / N, S('circle', { cx: (p[0] + n[0] * side * d + T[i][0] * j).toFixed(1), cy: (p[1] + n[1] * side * d + T[i][1] * j).toFixed(1), r: (0.9 + rnd() * 1.8).toFixed(2), class: 'spray' }, g)]);
        }
      }
    } else {
      [-8, 8].forEach(o => {
        const q = pts.map((p, i) => [p[0] + Nn[i][0] * o, p[1] + Nn[i][1] * o]);
        strokes.push([S('polyline', { points: P(q), class: 'carve-line' }, g), polyLen(q)]);
      });
    }
    const sk = S('g', { class: 'skis' }, g);
    S('rect', { x: -18, y: -10, width: 36, height: 4, rx: 2 }, sk);
    S('rect', { x: -18, y: 6, width: 36, height: 4, rx: 2 }, sk);
    const place = u => {
      const i = clamp(Math.round(u * N), 0, N), p = pts[i], t = T[i];
      let a = deg(Math.atan2(t[1], t[0]));
      if (c.kind === 'skid') a += (curv[i] >= 0 ? 1 : -1) * 38;
      sk.setAttribute('transform', 'translate(' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ') rotate(' + a.toFixed(1) + ')');
    };
    place(1);
    S('text', { x: c.cx, y: 380, 'text-anchor': 'middle', class: 't t-b' }, svg, c.kind === 'skid' ? 'Skid' : 'Carve');
    S('text', { x: c.cx, y: 402, 'text-anchor': 'middle', class: 't t-s t-m' }, svg, c.kind === 'skid' ? 'skis slide sideways' : 'edges cut clean lines');
    layers.push({ strokes, decos, place });
  });

  let running = false;
  function play() {
    if (reduceMotion || running) return;
    running = true;
    const t0 = performance.now(), dur = 2800;
    layers.forEach(l => {
      l.strokes.forEach(([el, L]) => { el.style.strokeDasharray = L.toFixed(1); el.style.strokeDashoffset = L.toFixed(1); });
      l.decos.forEach(([, el]) => { el.style.opacity = 0; });
    });
    const step = now => {
      const u = clamp((now - t0) / dur, 0, 1), e = ease(u);
      layers.forEach(l => {
        l.strokes.forEach(([el, L]) => { el.style.strokeDashoffset = (L * (1 - e)).toFixed(1); });
        l.decos.forEach(([du, el]) => { el.style.opacity = du <= e ? '' : 0; });
        l.place(e);
      });
      if (u < 1) requestAnimationFrame(step);
      else {
        layers.forEach(l => l.strokes.forEach(([el]) => { el.style.strokeDasharray = ''; el.style.strokeDashoffset = ''; }));
        running = false;
      }
    };
    requestAnimationFrame(step);
  }
  const btn = $('#f1-replay');
  if (btn) btn.addEventListener('click', play);
  onFirstView(svg, play);
}

/* ================= 02  the hidden circle ================= */
function fig2() {
  const svg = $('#f2');
  if (!svg) return;
  const VW = 560, VH = 380;
  let ski = SKI.SL, o = outline(ski), t = 0;

  const circ = S('circle', { class: 'ln-acc2' }, svg);
  const rline = S('line', { class: 'ln-dash' }, svg);
  const cdot = S('circle', { r: 3.5, class: 'f-acc' }, svg);
  const skiP = S('polygon', { class: 'f-ski' }, svg);
  const chord = S('line', { class: 'ln-thin', 'stroke-dasharray': '4 4' }, svg);
  const cA = S('circle', { r: 4.5, class: 'f-acc ring-surface' }, svg);
  const cB = S('circle', { r: 4.5, class: 'f-acc ring-surface' }, svg);
  const depthT = S('text', { class: 't t-s t-b fade' }, svg);
  const rT = S('text', { class: 't t-b fade' }, svg);
  const skiT = S('text', { class: 't t-s t-m fade' }, svg, 'the ski');
  const sbL = S('line', { class: 'ln' }, svg), sbE1 = S('line', { class: 'ln' }, svg), sbE2 = S('line', { class: 'ln' }, svg);
  const sbT = S('text', { class: 't t-s t-m' }, svg);

  function cam() {
    const R = ski.Rsc, hw = ski.hw;
    const xc = (o.x0 + o.x1) / 2, W0 = (o.x1 - o.x0) * 1.3;
    const E = 2 * R + hw + 0.12;
    const W1 = Math.max(E * VW / VH, 2 * R) * 1.16;
    const W = W0 * Math.pow(W1 / W0, t), f = (W - W0) / (W1 - W0);
    return { k: VW / W, cx: xc * (1 - f), cy: -(hw + R) * f };
  }
  function draw() {
    const c = cam(), k = c.k;
    const X = x => VW / 2 + (x - c.cx) * k, Y = y => VH / 2 - (y - c.cy) * k;
    const R = ski.Rsc, hw = ski.hw, xb = ski.Lc / 2;
    setA(circ, { cx: X(0), cy: Y(-(hw + R)), r: R * k });
    setA(rline, { x1: X(0), y1: Y(-(hw + R)), x2: X(0), y2: Y(-hw) });
    setA(cdot, { cx: X(0), cy: Y(-(hw + R)) });
    setA(skiP, { points: P(o.poly.map(p => [X(p[0]), Y(p[1])])) });
    setA(chord, { x1: X(-xb), y1: Y(-o.hc), x2: X(xb), y2: Y(-o.hc) });
    setA(cA, { cx: X(-xb), cy: Y(-o.hc) });
    setA(cB, { cx: X(xb), cy: Y(-o.hc) });
    depthT.textContent = 'the curve is only ' + Math.round(ski.sag * 1000) + ' mm deep';
    setA(depthT, { x: X(-0.3), y: Y(-o.hc) + 24 });
    depthT.style.opacity = t < 0.16 ? 1 : 0;
    rscText(rT, 'R', ' = ' + R.toFixed(2) + ' m');
    const my = (Y(-(hw + R)) + Y(-hw)) / 2;
    setA(rT, { x: X(0) + 10, y: clamp(my, 48, VH - 44) });
    rT.style.opacity = t > 0.4 ? 1 : 0;
    setA(skiT, { x: X(xb) + 12, y: Y(0) + 4 });
    skiT.style.opacity = t > 0.62 ? 1 : 0;
    const opts = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];
    let L = opts[0];
    opts.forEach(v => { if (v * k <= 140) L = v; });
    const x0 = 18, y0 = VH - 14, x1 = x0 + L * k;
    setA(sbL, { x1: x0, y1: y0, x2: x1, y2: y0 });
    setA(sbE1, { x1: x0, y1: y0 - 5, x2: x0, y2: y0 + 5 });
    setA(sbE2, { x1: x1, y1: y0 - 5, x2: x1, y2: y0 + 5 });
    setA(sbT, { x: x0, y: y0 - 9 });
    sbT.textContent = L >= 1 ? L + ' m' : Math.round(L * 100) + ' cm';
  }
  function readouts() {
    $('#f2-r').innerHTML = ski.Rsc.toFixed(2) + ' m <small>printed ' + ski.printed + ' m</small>';
    $('#f2-c').textContent = ski.Lc.toFixed(2) + ' m';
    $('#f2-s').textContent = Math.round(ski.sag * 1000) + ' mm';
  }
  const playBtn = $('#f2-play');
  const z = bindRange('f2-z', 'f2-zo', v => Math.round(v) + '%', v => {
    t = v / 100;
    draw();
    if (playBtn) playBtn.textContent = t > 0.5 ? 'Zoom in' : 'Zoom out';
  });
  bindSeg('f2-ski', v => { ski = SKI[v]; o = outline(ski); readouts(); draw(); });
  readouts();
  let raf = 0;
  if (playBtn) playBtn.addEventListener('click', () => {
    cancelAnimationFrame(raf);
    const from = t, to = t > 0.5 ? 0 : 1, t0 = performance.now(), dur = reduceMotion ? 1 : 2400;
    const step = now => {
      const u = clamp((now - t0) / dur, 0, 1);
      z.set((from + (to - from) * ease(u)) * 100);
      if (u < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  });
}

/* ================= 03  tipping flattens the curve ================= */
function fig3() {
  const svg = $('#f3');
  if (!svg) return;
  const ski = SKI.SL;
  const fy = 280, px = 56, Wc = 130, Th = 16;
  S('text', { x: 18, y: 26, class: 't t-s t-m' }, svg, 'From the end');
  S('line', { x1: 14, y1: fy, x2: 226, y2: fy, class: 'floor' }, svg);
  const proj = S('line', { class: 'ln-dash' }, svg);
  const sec = S('g', null, svg);
  S('rect', { x: 0, y: -Th, width: Wc, height: Th, rx: 3, class: 'f-ski' }, sec);
  S('line', { x1: 0, y1: 0, x2: Wc, y2: 0, class: 'ln-acc' }, sec);
  const dimG = S('g', null, svg);
  const arc = S('path', { class: 'ln-thin' }, svg);
  const phT = S('text', { class: 't t-mi t-b' }, svg, 'φ');
  const wT = mtext(svg, { 'text-anchor': 'middle', class: 't t-s t-m' }, [['width × cos ', false], ['φ', true]]);

  const xA = 268, xB = 540, y0 = 96, dF = 84;
  S('text', { x: 268, y: 26, class: 't t-s t-m' }, svg, 'From above: what the snow sees');
  S('line', { x1: xA, y1: y0, x2: xB, y2: y0, class: 'ln-thin' }, svg);
  S('path', { d: quadD(xA, xB, y0, dF), class: 'ln-dash' }, svg);
  const tipP = S('path', { class: 'ln-acc' }, svg);
  [xA, xB].forEach(x => S('circle', { cx: x, cy: y0, r: 4.5, class: 'f-acc ring-surface' }, svg));
  S('text', { x: xA, y: y0 - 12, class: 't t-s t-m' }, svg, 'contact');
  S('text', { x: xB, y: y0 - 12, 'text-anchor': 'end', class: 't t-s t-m' }, svg, 'contact');
  S('text', { x: (xA + xB) / 2, y: y0 + dF + 20, 'text-anchor': 'middle', class: 't t-s t-m' }, svg, 'flat');
  const tipT = S('text', { 'text-anchor': 'middle', class: 't t-s t-b' }, svg, 'tipped');

  function draw(phi) {
    const c = Math.cos(rad(phi)), s = Math.sin(rad(phi));
    sec.setAttribute('transform', 'translate(' + px + ' ' + fy + ') rotate(' + (-phi) + ')');
    const fx = px + Wc * c, fyy = fy - Wc * s;
    setA(proj, { x1: fx, y1: fyy, x2: fx, y2: fy });
    proj.style.opacity = phi > 2 ? 1 : 0;
    clearNode(dimG);
    if (Wc * c > 26) {
      const mid = (px + fx) / 2;
      arrow(dimG, mid, fy + 16, fx, fy + 16, 'arr-dim', 7);
      arrow(dimG, mid, fy + 16, px, fy + 16, 'arr-dim', 7);
    }
    setA(wT, { x: (px + Math.max(fx, px + 60)) / 2 + 8, y: fy + 38 });
    const r = 42;
    setA(arc, { d: 'M' + (px + r) + ' ' + fy + ' A' + r + ' ' + r + ' 0 0 0 ' + (px + r * c).toFixed(2) + ' ' + (fy - r * s).toFixed(2) });
    arc.style.opacity = phi > 4 ? 1 : 0;
    const hm = rad(phi / 2);
    setA(phT, { x: px + (r + 12) * Math.cos(hm), y: fy - (r + 12) * Math.sin(hm) + 6 });
    phT.style.opacity = phi > 8 ? 1 : 0;
    setA(tipP, { d: quadD(xA, xB, y0, dF * c) });
    setA(tipT, { x: (xA + xB) / 2, y: y0 + dF * c - 10 });
    tipT.style.opacity = phi > 3 ? 1 : 0;
    $('#f3-d').innerHTML = (ski.sag * 1000 * c).toFixed(1) + ' mm <small>flat: ' + (ski.sag * 1000).toFixed(1) + ' mm</small>';
    $('#f3-r').textContent = (ski.Rsc / c).toFixed(1) + ' m';
  }
  bindRange('f3-phi', 'f3-phio', v => v + '°', draw);
}

/* ================= 04  the ski has to bend ================= */
function fig4() {
  const svg = $('#f4');
  if (!svg) return;
  const ski = SKI.SL, sMM = ski.sag * 1000;
  const xA = 64, xB = 496, xm = (xA + xB) / 2, fy = 150, vs = 3;
  S('text', { x: 18, y: 24, class: 't t-s t-m' }, svg, 'From the side (heights ×10)');
  S('line', { x1: 18, y1: fy, x2: 542, y2: fy, class: 'floor' }, svg);
  const body = S('polyline', { class: 's-ski', 'stroke-width': 14 }, svg);
  const tipL = S('polyline', { class: 's-ski', 'stroke-width': 14 }, svg);
  const tailL = S('polyline', { class: 's-ski', 'stroke-width': 14 }, svg);
  const edge = S('polyline', { class: 'ln-acc' }, svg);
  [xA, xB].forEach(x => S('circle', { cx: x, cy: fy, r: 4.5, class: 'f-acc ring-surface' }, svg));
  const pushG = S('g', null, svg);
  const pushT = S('text', { class: 't t-s t-acc', 'text-anchor': 'end' }, svg, 'push');
  const gapG = S('g', null, svg);
  const gapT = S('text', { class: 't t-s t-b' }, svg);

  const y0 = 262, ds = 2.2;
  S('text', { x: 18, y: 222, class: 't t-s t-m' }, svg, 'From above: the line the edge draws (depth ×7)');
  S('line', { x1: xA, y1: y0, x2: xB, y2: y0, class: 'ln-thin' }, svg);
  S('path', { d: quadD(xA, xB, y0, sMM * ds), class: 'ln-dash' }, svg);
  const trace = S('path', { class: 'ln-acc' }, svg);
  [xA, xB].forEach(x => S('circle', { cx: x, cy: y0, r: 4.5, class: 'f-acc ring-surface' }, svg));
  S('line', { x1: 392, y1: 238, x2: 416, y2: 238, class: 'ln-dash' }, svg);
  S('text', { x: 422, y: 242, class: 't t-s t-m' }, svg, 'flat sidecut');
  const trT = S('text', { 'text-anchor': 'middle', class: 't t-s t-b' }, svg);

  let phi = 60, push = 0;
  function draw() {
    const c = Math.cos(rad(phi)), s = Math.sin(rad(phi)), tn = Math.tan(rad(phi));
    const need = sMM * tn;                       // bend needed at the middle, mm (camber left out)
    const bend = Math.min(push * 0.6, need);     // a linear spring: bend grows with push until the edge touches
    const f = need > 1e-9 ? bend / need : 1;
    const gapMid = sMM * s * (1 - f);
    const N = 60, e = [], b = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, x = xA + (xB - xA) * u, h = gapMid * 4 * u * (1 - u);
      e.push([x, fy - h * vs]);
      b.push([x, fy - h * vs - 7]);
    }
    setA(edge, { points: P(e) });
    setA(body, { points: P(b) });
    setA(tipL, { points: P([[xB, fy - 7], [xB + 20, fy - 9], [xB + 34, fy - 15], [xB + 44, fy - 26]]) });
    setA(tailL, { points: P([[xA, fy - 7], [xA - 16, fy - 9], [xA - 26, fy - 17]]) });

    clearNode(pushG);
    const yTop = fy - gapMid * vs - 15, L = 18 + push * 0.5;
    if (push > 0) arrow(pushG, xm, yTop - 6 - L, xm, yTop - 3, 'arr-acc', 11);
    setA(pushT, { x: xm - 10, y: yTop - 10 - L / 2 });
    pushT.style.opacity = push > 0 ? 1 : 0;

    clearNode(gapG);
    if (gapMid > 2) {
      const ye = fy - gapMid * vs, gx = xm + 26;
      arrow(gapG, gx, (fy + ye) / 2, gx, ye + 1, 'arr-dim', 6);
      arrow(gapG, gx, (fy + ye) / 2, gx, fy - 1, 'arr-dim', 6);
      setA(gapT, { x: gx + 8, y: (fy + ye) / 2 + 4 });
      gapT.textContent = 'gap ' + gapMid.toFixed(1) + ' mm';
      gapT.style.opacity = 1;
    } else gapT.style.opacity = 0;

    const depth = sMM * (c + f * tn * s);
    setA(trace, { d: quadD(xA, xB, y0, depth * ds) });
    setA(trT, { x: xm, y: y0 + depth * ds + 18 });
    trT.textContent = phi === 0 ? 'flat ski' : (f >= 0.9999 ? 'tipped and bent' : (push > 0 ? 'bending' : 'tipped only'));
    const R = ski.Lc * ski.Lc / (8 * depth / 1000);
    $('#f4-gap').textContent = gapMid.toFixed(1) + ' mm';
    $('#f4-bend').innerHTML = bend.toFixed(1) + ' mm <small>of ' + need.toFixed(1) + ' needed</small>';
    $('#f4-r').textContent = R.toFixed(1) + ' m';
    const note = $('#f4-note');
    if (f >= 0.9999) {
      note.textContent = phi === 0 ? 'A flat ski already touches along its whole edge.' : 'The edge now touches along its whole length. Pushing harder changes nothing on a hard floor.';
      note.className = 'note ok';
    } else {
      note.textContent = 'The edge touches the floor only at its ends.';
      note.className = 'note';
    }
  }
  bindRange('f4-phi', 'f4-phio', v => v + '°', v => { phi = v; draw(); });
  bindRange('f4-push', 'f4-pusho', v => v + '%', v => { push = v; draw(); });
}

/* ================= 05  three circles ================= */
function fig5() {
  const svg = $('#f5');
  if (!svg) return;
  const VW = 560, VH = 420;
  let ski = SKI.SL, phi = 60;
  const cFlat = S('circle', { class: 'ln-thin' }, svg);
  const cTip = S('circle', { class: 'ln-dash' }, svg);
  const cReal = S('circle', { class: 'ln-acc' }, svg);
  const rLine = S('line', { class: 'ln-thin', 'stroke-dasharray': '3 4' }, svg);
  const ctr = S('circle', { r: 3.5, class: 'f-acc' }, svg);
  const rT = S('text', { class: 't t-s t-b' }, svg);
  const skiP = S('polygon', { class: 'f-ski' }, svg);
  const skiT = S('text', { class: 't t-s t-m' }, svg, 'ski (to scale)');
  const sbL = S('line', { class: 'ln' }, svg), sbE1 = S('line', { class: 'ln' }, svg), sbE2 = S('line', { class: 'ln' }, svg);
  const sbT = S('text', { class: 't t-s t-m' }, svg);
  function draw() {
    const H = ski.key === 'SL' ? 26 : 62, k = VH / H, ox = VW / 2, oy = VH - 2 * k;
    const X = x => ox + x * k, Y = y => oy - y * k;
    const c = Math.cos(rad(phi));
    const Rf = ski.Rsc, Rt = ski.Rsc / c, Rr = ski.Rsc * c;
    setA(cFlat, { cx: X(0), cy: Y(Rf), r: Rf * k });
    setA(cTip, { cx: X(0), cy: Y(Rt), r: Rt * k });
    setA(cReal, { cx: X(0), cy: Y(Rr), r: Rr * k });
    setA(rLine, { x1: X(0), y1: Y(Rr), x2: X(0), y2: Y(0) });
    setA(ctr, { cx: X(0), cy: Y(Rr) });
    rT.textContent = Rr.toFixed(1) + ' m';
    setA(rT, { x: X(0) + 8, y: (Y(Rr) + Y(0)) / 2 + 4 });
    const o = outline(ski, 60);
    setA(skiP, { points: P(o.poly.map(p => [X(p[0]), Y(p[1])])) });
    setA(skiT, { x: X(o.x1) + 8, y: Y(0) + 16 });
    const L = ski.key === 'SL' ? 5 : 10, x0 = 18, y0 = VH - 14, x1 = x0 + L * k;
    setA(sbL, { x1: x0, y1: y0, x2: x1, y2: y0 });
    setA(sbE1, { x1: x0, y1: y0 - 5, x2: x0, y2: y0 + 5 });
    setA(sbE2, { x1: x1, y1: y0 - 5, x2: x1, y2: y0 + 5 });
    setA(sbT, { x: x0, y: y0 - 9 });
    sbT.textContent = L + ' m';
    $('#f5-a').textContent = Rf.toFixed(1) + ' m';
    $('#f5-b').textContent = Rt.toFixed(1) + ' m';
    $('#f5-c').textContent = Rr.toFixed(1) + ' m';
  }
  bindRange('f5-phi', 'f5-phio', v => v + '°', v => { phi = v; draw(); });
  bindSeg('f5-ski', v => { ski = SKI[v]; draw(); });
}

/* ================= 06  the experiment ================= */
function fig6() {
  const panels = { rig: $('#f6-rig'), arc: $('#f6-arc'), photos: $('#f6-photos') };
  bindSeg('f6-tabs', v => { Object.keys(panels).forEach(k => { if (panels[k]) panels[k].hidden = k !== v; }); });
  rig();
  arcDemo();
}
function rig() {
  const svg = $('#f6a');
  if (!svg) return;
  const phi = 45, c = Math.cos(rad(phi)), s = Math.sin(rad(phi));
  const fy = 196, Px = 250, Py = fy;
  S('text', { x: 18, y: 22, class: 't t-s t-m' }, svg, 'From the end, at the middle of the ski');
  // wedge (behind the ski, at its end)
  const H = 100, wx = Px + H / Math.tan(rad(phi));
  S('polygon', { points: P([[Px, fy], [wx, fy - H], [wx, fy]]), class: 'wedge' }, svg);
  S('text', { x: wx + 8, y: fy - 90, class: 't t-s t-m' }, svg, 'wedge');
  S('text', { x: wx + 8, y: fy - 74, class: 't t-s t-m' }, svg, '(at each end)');
  // paper and floor
  S('rect', { x: 118, y: fy - 4, width: 300, height: 4, class: 'paper' }, svg);
  S('line', { x1: 24, y1: fy, x2: 536, y2: fy, class: 'floor' }, svg);
  S('text', { x: 124, y: fy + 20, class: 't t-s t-m' }, svg, 'paper on the floor');
  // ski cross-section: base from the edge P up the slope, body on the upper-left side
  const Wc = 118, Th = 18, u = [c, -s], n = [-s, -c], dn = [s, c];
  const p0 = [Px, Py], p1 = [Px + u[0] * Wc, Py + u[1] * Wc], p2 = [p1[0] + n[0] * Th, p1[1] + n[1] * Th], p3 = [Px + n[0] * Th, Py + n[1] * Th];
  S('polygon', { points: P([p0, p1, p2, p3]), class: 'f-ski' }, svg);
  S('line', { x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1], class: 'ln-acc' }, svg);
  // phone held flat against the base
  const pc = [Px + u[0] * Wc * 0.62 + dn[0] * 6, Py + u[1] * Wc * 0.62 + dn[1] * 6];
  const ph = S('g', { transform: 'translate(' + pc[0].toFixed(1) + ' ' + pc[1].toFixed(1) + ') rotate(' + (-phi) + ')' }, svg);
  S('rect', { x: -26, y: 0, width: 52, height: 9, rx: 3, class: 'f-ink' }, ph);
  S('line', { x1: pc[0] + 16, y1: pc[1] + 14, x2: 418, y2: 174, class: 'ln-thin' }, svg);
  mtext(svg, { x: 422, y: 170, class: 't t-s t-b' }, [['phone reads ', false], ['φ', true]]);
  S('text', { x: 422, y: 186, class: 't t-s t-m' }, svg, 'under load');
  // angle
  const r = 34;
  S('path', { d: 'M' + (Px + r) + ' ' + fy + ' A' + r + ' ' + r + ' 0 0 0 ' + (Px + r * c).toFixed(1) + ' ' + (fy - r * s).toFixed(1), class: 'ln-thin' }, svg);
  S('text', { x: Px + r + 6, y: fy - 9, class: 't t-mi t-b' }, svg, 'φ');
  // load
  const q = [Px + u[0] * Wc * 0.3 + n[0] * Th, Py + u[1] * Wc * 0.3 + n[1] * Th];
  arrow(svg, q[0], q[1] - 92, q[0], q[1] - 3, 'arr-acc', 11);
  S('text', { x: q[0] + 10, y: q[1] - 74, class: 't t-s t-acc' }, svg, 'load');
  // pencil against the edge
  S('line', { x1: Px - 5, y1: Py - 8, x2: Px - 44, y2: Py - 76, class: 'pencil' }, svg);
  S('line', { x1: Px - 1, y1: Py - 1, x2: Px - 6, y2: Py - 10, class: 'ln' }, svg);
  S('text', { x: Px - 50, y: Py - 82, 'text-anchor': 'end', class: 't t-s t-m' }, svg, 'pencil');

  // from above
  S('text', { x: 18, y: 236, class: 't t-s t-m' }, svg, 'From above');
  S('rect', { x: 40, y: 248, width: 480, height: 156, rx: 4, class: 'paper' }, svg);
  const ski = SKI.SL, o = outline(ski, 90), k = 420 / ski.len, cx = 280, cy = 312;
  const X = x => cx + (x - (o.x0 + o.x1) / 2) * k, Y = y => cy - y * k;
  const xb = ski.Lc / 2;
  [-xb, xb].forEach(x => S('rect', { x: X(x) - 11, y: cy - 4, width: 22, height: 36, rx: 2, class: 'wedge' }, svg));
  S('polygon', { points: P(o.poly.map(p => [X(p[0]), Y(p[1])])) , class: 'f-ski' }, svg);
  const tr = [];
  for (let i = 0; i <= 60; i++) { const x = -xb + 2 * xb * i / 60; tr.push([X(x), Y(-o.half(x)) + 3]); }
  S('polyline', { points: P(tr), class: 'ln-acc' }, svg);
  S('text', { x: X(-xb), y: cy + 50, 'text-anchor': 'middle', class: 't t-s t-m' }, svg, 'wedge');
  S('text', { x: X(xb), y: cy + 50, 'text-anchor': 'middle', class: 't t-s t-m' }, svg, 'wedge');
  S('line', { x1: X(0), y1: Y(-ski.hw) + 6, x2: X(0), y2: 368, class: 'ln-thin' }, svg);
  S('text', { x: X(0), y: 384, 'text-anchor': 'middle', class: 't t-s t-b' }, svg, 'pencil line = the carved arc');
}
function arcDemo() {
  const svg = $('#f6b');
  if (!svg) return;
  const xA = 56, xB = 504, xm = (xA + xB) / 2, y0 = 64, ds = 4.4;
  S('rect', { x: 16, y: 16, width: 528, height: 270, rx: 6, class: 'paper' }, svg);
  const arcP = S('path', { class: 'ln-acc' }, svg);
  S('line', { x1: xA, y1: y0, x2: xB, y2: y0, class: 'ln-ink', 'stroke-dasharray': '2 5' }, svg);
  [xA, xB].forEach(x => S('circle', { cx: x, cy: y0, r: 4.5, class: 'f-ink ring-surface' }, svg));
  S('text', { x: xm, y: y0 - 14, 'text-anchor': 'middle', class: 't t-s t-b' }, svg, 'string between the ends: chord c = 1.41 m');
  const dimG = S('g', null, svg);
  const sT = S('text', { class: 't t-s t-b' }, svg);
  const pT = S('text', { 'text-anchor': 'middle', class: 't t-s t-m' }, svg, 'pencil line');
  bindRange('f6-s', 'f6-so', v => v.toFixed(1) + ' mm', v => {
    const d = v * ds;
    setA(arcP, { d: quadD(xA, xB, y0, d) });
    clearNode(dimG);
    arrow(dimG, xm, y0 + d / 2, xm, y0 + 2, 'arr-dim', 7);
    arrow(dimG, xm, y0 + d / 2, xm, y0 + d - 2, 'arr-dim', 7);
    setA(sT, { x: xm + 10, y: y0 + d / 2 + 5 });
    sT.textContent = 'sagitta s = ' + v.toFixed(1) + ' mm';
    setA(pT, { x: xA + 0.86 * (xB - xA), y: y0 + 4 * 0.86 * 0.14 * d + 20 });
    $('#f6-r').textContent = (1.41 * 1.41 / (8 * v / 1000)).toFixed(2) + ' m';
  });
}

/* ================= 07  results chart ================= */
function fig7() {
  const svg = $('#f7');
  if (!svg) return;
  const box = svg.closest('figure'), tip = makeTip(box);
  const x0 = 58, x1 = 540, y0 = 16, y1 = 334, xmin = -3, xmax = 65, ymax = 2.2;
  const X = a => x0 + (a - xmin) / (xmax - xmin) * (x1 - x0), Y = r => y1 - r / ymax * (y1 - y0);
  [0.5, 1, 1.5, 2].forEach(v => S('line', { x1: x0, y1: Y(v), x2: x1, y2: Y(v), class: 'grid' }, svg));
  [0, 0.5, 1, 1.5, 2].forEach(v => S('text', { x: x0 - 9, y: Y(v) + 4, 'text-anchor': 'end', class: 't t-s t-m' }, svg, v.toFixed(1)));
  S('line', { x1: x0, y1: y1, x2: x1, y2: y1, class: 'ln-thin' }, svg);
  [0, 15, 30, 45, 60].forEach(v => {
    S('line', { x1: X(v), y1: y1, x2: X(v), y2: y1 + 5, class: 'ln-thin' }, svg);
    S('text', { x: X(v), y: y1 + 21, 'text-anchor': 'middle', class: 't t-s t-m' }, svg, v + '°');
  });
  mtext(svg, { x: (x0 + x1) / 2, y: y1 + 46, 'text-anchor': 'middle', class: 't t-s' }, [['Edge angle ', false], ['φ', true]]);
  S('text', { x: 14, y: (y0 + y1) / 2, transform: 'rotate(-90 14 ' + (y0 + y1) / 2 + ')', 'text-anchor': 'middle', class: 't t-s' }, svg, 'carved radius ÷ sidecut radius');

  const cosPts = [], invPts = [];
  for (let a = 0; a <= 65.001; a += 0.5) {
    cosPts.push([X(a), Y(Math.cos(rad(a)))]);
    const iv = 1 / Math.cos(rad(a));
    if (iv <= ymax) invPts.push([X(a), Y(iv)]);
  }
  S('polyline', { points: P(invPts), class: 'ln-dash' }, svg);
  S('polyline', { points: P(cosPts), class: 'ln-ink' }, svg);
  mtext(svg, { x: X(56) - 10, y: Y(1 / Math.cos(rad(56))) + 2, 'text-anchor': 'end', class: 't t-s t-m' }, [['1/cos ', false], ['φ', true], ['  tipping only', false]]);
  mtext(svg, { x: X(65), y: Y(Math.cos(rad(65))) + 24, 'text-anchor': 'end', class: 't t-s t-b' }, [['cos ', false], ['φ', true], ['  tipped and bent', false]]);

  const D = [
    { ski: 'SL', phi: 0, R: 12.80, dR: 0.34, Rs: 12.26, P: 12.26, d: '+4.4%', off: -1, note: 'flat trace, a check of the method' },
    { ski: 'GS', phi: 0, R: 29.40, dR: 1.23, Rs: 28.99, P: 28.99, d: '+1.4%', off: 1, note: 'flat trace, a check of the method' },
    { ski: 'SL', phi: 29.8, R: 10.11, dR: 0.69, Rs: 12.26, P: 10.64, d: '−4.9%', note: 'average of two traces' },
    { ski: 'GS', phi: 29.4, R: 25.20, dR: 0.91, Rs: 28.99, P: 25.26, d: '−0.2%' },
    { ski: 'SL', phi: 44.0, R: 9.00, dR: 0.18, Rs: 12.26, P: 8.82, d: '+2.1%' },
    { ski: 'GS', phi: 45.0, R: 21.25, dR: 0.65, Rs: 28.99, P: 20.50, d: '+3.7%' },
    { ski: 'SL', phi: 57.9, R: 6.48, dR: 0.10, Rs: 12.26, P: 6.52, d: '−0.5%' },
    { ski: 'GS', phi: 59.1, R: 14.41, dR: 0.31, Rs: 28.99, P: 14.89, d: '−3.2%' }
  ];
  const marks = S('g', null, svg), hits = S('g', null, svg);
  D.forEach(p => {
    const r = p.R / p.Rs, dr = p.dR / p.Rs, x = X(p.phi + (p.off || 0)), y = Y(r);
    S('line', { x1: x, y1: Y(r - dr), x2: x, y2: Y(r + dr), class: 'err' }, marks);
    S('line', { x1: x - 4, y1: Y(r - dr), x2: x + 4, y2: Y(r - dr), class: 'err' }, marks);
    S('line', { x1: x - 4, y1: Y(r + dr), x2: x + 4, y2: Y(r + dr), class: 'err' }, marks);
    if (p.ski === 'SL') S('circle', { cx: x, cy: y, r: 5, class: 'f-sl ring-surface' }, marks);
    else S('rect', { x: x - 5, y: y - 5, width: 10, height: 10, rx: 1.5, class: 'f-gs ring-surface' }, marks);
    const h = S('circle', { cx: x, cy: y, r: 15, class: 'hit', tabindex: 0, role: 'button',
      'aria-label': p.ski + ' ski at ' + p.phi + ' degrees: radius ' + p.R.toFixed(2) + ' metres, predicted ' + p.P.toFixed(2) }, hits);
    const show = () => {
      const pos = svgToBox(svg, box, x, y);
      tip.show('<strong>' + p.ski + ' ski · φ = ' + p.phi + '°</strong><br>R = ' + p.R.toFixed(2) + ' ± ' + p.dR.toFixed(2) + ' m<br>predicted ' + p.P.toFixed(2) + ' m (' + p.d + ')' + (p.note ? '<br><span style="opacity:.75">' + p.note + '</span>' : ''), pos[0], pos[1]);
    };
    h.addEventListener('pointerenter', show);
    h.addEventListener('focus', show);
    h.addEventListener('click', show);
    h.addEventListener('pointerleave', () => tip.hide());
    h.addEventListener('blur', () => tip.hide());
  });
}

/* ================= 08  on the slope ================= */
function fig8() {
  const svg = $('#f8'), strip = $('#f8s');
  if (!svg) return;
  let ski = SKI.SL, v = 33;
  const sy = 312, P0 = [330, sy], Lb = 118;
  S('rect', { x: 0, y: sy, width: 560, height: 48, class: 'snowfill' }, svg);
  S('line', { x1: 8, y1: sy, x2: 552, y2: sy, class: 'floor' }, svg);
  S('text', { x: 14, y: 24, class: 't t-s t-m' }, svg, '← centre of the turn');
  const vert = S('line', { class: 'ln-thin', 'stroke-dasharray': '3 4' }, svg);
  const arcP = S('path', { class: 'ln-thin' }, svg);
  const phT = S('text', { class: 't t-mi t-b' }, svg, 'φ');
  const skierG = S('g', null, svg);
  const forceG = S('g', null, svg);
  const overT = S('text', { x: 280, y: 58, 'text-anchor': 'middle', class: 't t-b t-warn' }, svg, '');

  function drawSkier(phi, ok) {
    clearNode(skierG);
    const g = S('g', { transform: 'translate(' + P0[0] + ' ' + P0[1] + ') rotate(' + (-phi) + ')', opacity: ok ? 1 : 0.35 }, skierG);
    S('rect', { x: 0, y: -9, width: 46, height: 9, rx: 2, class: 'f-ski' }, g);
    S('line', { x1: 9, y1: -16, x2: 0, y2: -Lb - 30, class: 'skier' }, g);
    S('circle', { cx: 0, cy: -Lb - 62, r: 15, class: 'skier-head' }, g);
    S('circle', { cx: 0, cy: -Lb, r: 6, class: 'com' }, g);
  }
  function stripDraw(vmax) {
    if (!strip) return;
    clearNode(strip);
    const X = s => 20 + (s - 5) / 80 * 520;
    S('line', { x1: X(5), y1: 34, x2: X(85), y2: 34, class: 'ln-thin' }, strip);
    for (let s = 10; s <= 80; s += 10) {
      S('line', { x1: X(s), y1: 31, x2: X(s), y2: 37, class: 'ln-thin' }, strip);
      S('text', { x: X(s), y: 52, 'text-anchor': 'middle', class: 't t-s t-m' }, strip, String(s));
    }
    S('rect', { x: X(ski.lim[0]), y: 27, width: X(ski.lim[1]) - X(ski.lim[0]), height: 14, rx: 3, class: 'band' }, strip);
    S('text', { x: X(ski.lim[0]) + 2, y: 18, class: 't t-s t-b' }, strip, 'my limit');
    S('line', { x1: X(vmax), y1: 22, x2: X(vmax), y2: 44, class: 'ln-ink' }, strip);
    S('text', { x: X(vmax) - 5, y: 18, 'text-anchor': 'end', class: 't t-s t-b' }, strip, 'model limit');
    const cx = X(v);
    S('polygon', { points: P([[cx, 30], [cx - 6, 20], [cx + 6, 20]]), class: 'f-acc' }, strip);
  }
  function draw() {
    const vm = v / 3.6, sphi = vm * vm / (G * ski.Rsc), vmax = Math.sqrt(G * ski.Rsc) * 3.6;
    const ok = sphi < 0.9995;
    const phi = ok ? deg(Math.asin(sphi)) : 76;
    drawSkier(phi, ok);
    clearNode(forceG);
    const nx = -Math.sin(rad(phi)), ny = -Math.cos(rad(phi));
    setA(vert, { x1: P0[0], y1: P0[1], x2: P0[0], y2: P0[1] - 92 });
    const r = 64;
    setA(arcP, { d: 'M' + P0[0] + ' ' + (P0[1] - r) + ' A' + r + ' ' + r + ' 0 0 0 ' + (P0[0] + nx * r).toFixed(1) + ' ' + (P0[1] + ny * r).toFixed(1) });
    const hm = rad(phi / 2);
    setA(phT, { x: P0[0] - Math.sin(hm) * (r + 14) - 4, y: P0[1] - Math.cos(hm) * (r + 14) + 6 });
    const showAng = ok && phi > 9;
    arcP.style.opacity = showAng ? 1 : 0; phT.style.opacity = showAng ? 1 : 0; vert.style.opacity = ok ? 1 : 0;
    if (ok) {
      const com = [P0[0] + nx * Lb, P0[1] + ny * Lb], W = 62;
      arrow(forceG, com[0], com[1] + 8, com[0], com[1] + 8 + W, 'arr-ink', 10);
      S('text', { x: com[0] - 10, y: com[1] + 8 + W - 4, 'text-anchor': 'end', class: 't t-s t-b' }, forceG, 'weight');
      const F = Math.min(W / Math.cos(rad(phi)), 210);
      arrow(forceG, P0[0] + 14, P0[1] - 2, P0[0] + 14 + nx * F, P0[1] - 2 + ny * F, 'arr-acc', 11);
      S('text', { x: P0[0] + 26, y: P0[1] - 44, class: 't t-s t-acc' }, forceG, 'push from the snow');
      const Hh = Math.min(W * Math.tan(rad(phi)), 300);
      if (Hh > 14) {
        arrow(forceG, P0[0] + 14, sy + 18, P0[0] + 14 - Hh, sy + 18, 'arr-muted', 9);
        S('text', { x: P0[0] + 22, y: sy + 23, class: 't t-s t-m' }, forceG, 'sideways part turns you');
      }
      overT.textContent = '';
      $('#f8-phi').textContent = phi.toFixed(1) + '°';
      $('#f8-r').textContent = (ski.Rsc * Math.cos(rad(phi))).toFixed(1) + ' m';
      $('#f8-load').textContent = (1 / Math.cos(rad(phi))).toFixed(2) + ' × weight';
      const n = $('#f8-note');
      n.textContent = 'Balanced carve: the skis tip to ' + phi.toFixed(0) + '° and carve a ' + (ski.Rsc * Math.cos(rad(phi))).toFixed(1) + ' m turn.';
      n.className = 'note ok';
    } else {
      overT.textContent = 'No balanced carve at this speed';
      $('#f8-phi').textContent = '—';
      $('#f8-r').textContent = '—';
      $('#f8-load').textContent = '—';
      const n = $('#f8-note');
      n.textContent = 'Above ' + vmax.toFixed(1) + ' km/h no edge angle balances the turn: the ski would still carve, but the turn it cuts is tighter than any lean can hold. Racers ski here "dynamically", never settling into balance.';
      n.className = 'note bad';
    }
    $('#f8-max').textContent = vmax.toFixed(1) + ' km/h';
    stripDraw(vmax);
  }
  bindRange('f8-v', 'f8-vo', x => (x % 1 ? x.toFixed(1) : x) + ' km/h', x => { v = x; draw(); });
  bindSeg('f8-ski', k => { ski = SKI[k]; draw(); });
}

/* ================= 09  the impossible reading ================= */
function fig9() {
  const svg = $('#f9');
  if (!svg) return;
  const box = svg.closest('figure'), tip = makeTip(box);
  const x0 = 50, x1 = 540, y0 = 18, y1 = 298, ymax = 18;
  const X = a => x0 + a / 90 * (x1 - x0), Y = g => y1 - g / ymax * (y1 - y0);
  [4, 8, 12, 16].forEach(v => S('line', { x1: x0, y1: Y(v), x2: x1, y2: Y(v), class: 'grid' }, svg));
  [0, 4, 8, 12, 16].forEach(v => S('text', { x: x0 - 9, y: Y(v) + 4, 'text-anchor': 'end', class: 't t-s t-m' }, svg, String(v)));
  S('line', { x1: x0, y1: y1, x2: x1, y2: y1, class: 'ln-thin' }, svg);
  [0, 15, 30, 45, 60, 75, 90].forEach(v => {
    S('line', { x1: X(v), y1: y1, x2: X(v), y2: y1 + 5, class: 'ln-thin' }, svg);
    S('text', { x: X(v), y: y1 + 21, 'text-anchor': 'middle', class: 't t-s t-m' }, svg, v + '°');
  });
  mtext(svg, { x: (x0 + x1) / 2, y: y1 + 46, 'text-anchor': 'middle', class: 't t-s' }, [['Edge angle ', false], ['φ', true]]);
  S('text', { x: 14, y: (y0 + y1) / 2, transform: 'rotate(-90 14 ' + (y0 + y1) / 2 + ')', 'text-anchor': 'middle', class: 't t-s' }, svg, 'gap under the middle (mm)');
  const d = SKI.GS.sag * 1000, cam = 3.36, gmax = Math.hypot(d, cam);
  const pts = [];
  for (let a = 0; a <= 90.001; a += 1) pts.push([X(a), Y(d * Math.sin(rad(a)) + cam * Math.cos(rad(a)))]);
  S('line', { x1: x0, y1: Y(gmax), x2: x1, y2: Y(gmax), class: 'ln-acc2', 'stroke-dasharray': '7 5' }, svg);
  S('text', { x: x1, y: Y(gmax) - 8, 'text-anchor': 'end', class: 't t-s t-acc' }, svg, 'the most any angle can give: ' + gmax.toFixed(1) + ' mm');
  S('polyline', { points: P(pts), class: 'ln-ink' }, svg);
  const R = [[30.4, 8], [44.0, 12], [60.6, 16]];
  const hits = [];
  R.forEach(([a, g]) => {
    S('circle', { cx: X(a), cy: Y(g), r: 6, class: 'f-surface', stroke: 'currentColor' }, svg).setAttribute('style', 'stroke:var(--ink-2);stroke-width:2');
    hits.push([a, g, 'Ruler reading at ' + a + '°: ' + g + ' mm<br>prediction ' + (d * Math.sin(rad(a)) + cam * Math.cos(rad(a))).toFixed(1) + ' mm']);
  });
  S('circle', { cx: X(60.6), cy: Y(16), r: 12, class: 'warn-ring' }, svg);
  S('text', { x: X(60.6) + 18, y: Y(16) + 5, class: 't t-s t-warn' }, svg, '16 mm: impossible');
  S('circle', { cx: X(60.6), cy: Y(11.5), r: 6, class: 'f-acc ring-surface' }, svg);
  S('text', { x: X(60.6) + 14, y: Y(11.5) + 20, class: 't t-s t-b' }, svg, 'paper stack: 11.5 mm');
  hits.push([60.6, 11.5, 'Paper stack at 60.6°: 11.5 mm<br>prediction ' + (d * Math.sin(rad(60.6)) + cam * Math.cos(rad(60.6))).toFixed(1) + ' mm']);
  hits.forEach(([a, g, html]) => {
    const h = S('circle', { cx: X(a), cy: Y(g), r: 14, class: 'hit', tabindex: 0, role: 'button', 'aria-label': html.replace('<br>', ', ') }, svg);
    const show = () => { const p = svgToBox(svg, box, X(a), Y(g)); tip.show(html, p[0], p[1]); };
    h.addEventListener('pointerenter', show);
    h.addEventListener('focus', show);
    h.addEventListener('click', show);
    h.addEventListener('pointerleave', () => tip.hide());
    h.addEventListener('blur', () => tip.hide());
  });
}

/* ================= about: the two skis ================= */
function figA() {
  const svg = $('#fA');
  if (!svg) return;
  const k = 470 / 1.88, left = 44;
  [['SL', 62, 'Slalom (SL)'], ['GS', 176, 'Giant slalom (GS)']].forEach(([key, cy, name]) => {
    const s = SKI[key], o = outline(s, 120);
    const X = x => left + (x - o.x0) * k, Y = y => cy - y * k;
    S('polygon', { points: P(o.poly.map(p => [X(p[0]), Y(p[1])])), class: 'f-ski' }, svg);
    S('text', { x: left, y: cy - 26, class: 't t-b' }, svg, name + ' · ' + Math.round(s.len * 100) + ' cm');
    S('text', { x: left, y: cy + 38, class: 't t-s t-m' }, svg, 'printed radius ' + s.printed + ' m · measured ' + s.Rsc.toFixed(2) + ' m');
  });
}

/* ================= start ================= */
chrome();
heroTracks();
swoosh();
[fig1, fig2, fig3, fig4, fig5, fig6, fig7, fig8, fig9, figA].forEach(f => {
  try { f(); } catch (err) { if (window.console) console.error(err); }
});
})();
