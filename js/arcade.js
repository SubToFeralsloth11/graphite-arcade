'use strict';
/* Canvas arcade kit: pencil-style drawing helpers and the game-loop shell shared by the action games. */

const INK = a => `rgba(45,45,49,${a})`;

/** Pencil drawer. Lines wobble and "boil" (redraw slightly differently a few times a second) like a flipbook. */
function Pencil(ctx) {
  let seed = 0;
  const n = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233 + seed * 37.719) * 43758.5453; return s - Math.floor(s) - .5; };
  const P = {
    ctx,
    boil(t) { seed = Math.floor(t * 8) % 4; },
    paper(w, h, { ruled = true, ox = 0, oy = 0 } = {}) {
      ctx.fillStyle = '#f5f2e9'; ctx.fillRect(0, 0, w, h);
      if (!ruled) return;
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(70,110,160,.13)';
      ctx.beginPath();
      for (let y = ((-oy % 28) + 28) % 28; y < h; y += 28) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();
      if (ox != null) {
        const mx = ((60 - ox) % w + w) % w;
        ctx.strokeStyle = 'rgba(190,80,80,.14)'; ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, h); ctx.stroke();
      }
    },
    line(x1, y1, x2, y2, { w = 2, a = .85, r = 1.4 } = {}) {
      ctx.lineCap = 'round';
      for (let k = 0; k < 2; k++) {
        const q = k * 3.1;
        ctx.lineWidth = k ? w * .55 : w; ctx.strokeStyle = INK(k ? a * .55 : a);
        ctx.beginPath();
        ctx.moveTo(x1 + n(x1 + q, y1) * r, y1 + n(y1, x1 + q) * r);
        ctx.quadraticCurveTo((x1 + x2) / 2 + n(x2 + q, y1) * r * 1.6, (y1 + y2) / 2 + n(y2, x1 + q) * r * 1.6, x2 + n(x2, y2 + q) * r, y2 + n(y2 + q, x2) * r);
        ctx.stroke();
      }
    },
    poly(pts, o = {}) {
      const closed = o.closed !== false;
      for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; P.line(a[0], a[1], b[0], b[1], o); }
    },
    rect(x, y, w, h, o) { P.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], o); },
    circle(cx, cy, rad, { w = 2, a = .85, r = 1.2 } = {}) {
      const segs = Math.max(10, Math.min(36, rad * .9 | 0));
      for (let k = 0; k < 2; k++) {
        ctx.lineWidth = k ? w * .55 : w; ctx.strokeStyle = INK(k ? a * .55 : a);
        ctx.beginPath();
        const start = n(cx, cy + k) * 6;
        for (let i = 0; i <= segs + (k ? 0 : 1); i++) {
          const t = start + i / segs * Math.PI * 2, rr = rad + n(i + k * 9, cx) * r * 1.6;
          const x = cx + Math.cos(t) * rr, y = cy + Math.sin(t) * rr;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    },
    /** Diagonal graphite hatching clipped to a path. box = [x,y,w,h] bounds. */
    hatch(path, box, { a = .35, gap = 5, cross = false } = {}) {
      const [x, y, w, h] = box;
      ctx.save(); ctx.beginPath(); path(ctx); ctx.clip();
      ctx.lineWidth = 1.1; ctx.strokeStyle = INK(a); ctx.beginPath();
      for (let i = -h; i < w; i += gap) { ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); if (cross) { ctx.moveTo(x + i, y); ctx.lineTo(x + i + h, y + h); } }
      ctx.stroke(); ctx.restore();
    },
    hatchRect(x, y, w, h, o) { P.hatch(c => c.rect(x, y, w, h), [x, y, w, h], o); },
    hatchCircle(cx, cy, r, o) { P.hatch(c => c.arc(cx, cy, r, 0, Math.PI * 2), [cx - r, cy - r, r * 2, r * 2], o); },
    shade(x, y, w, h, a = .15) { ctx.fillStyle = INK(a); ctx.fillRect(x, y, w, h); },
    text(s, x, y, { size = 24, align = 'center', a = .9, font = 'Caveat', weight = 700, base = 'middle' } = {}) {
      ctx.font = `${weight} ${size}px ${font}, cursive`; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillStyle = INK(a);
      ctx.fillText(s, x, y);
    },
  };
  return P;
}

const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Little graphite dust puffs used for hits, pickups and explosions. */
function Dust() {
  const parts = [];
  return {
    burst(x, y, n = 10, speed = 120) {
      for (let i = 0; i < n; i++) { const t = Math.random() * 6.28, s = speed * (.3 + Math.random()); parts.push({ x, y, vx: Math.cos(t) * s, vy: Math.sin(t) * s, life: .4 + Math.random() * .4, r: 1 + Math.random() * 3 }); }
    },
    update(dt) {
      for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .95; p.vy *= .95; if ((p.life -= dt) <= 0) parts.splice(i, 1); }
    },
    draw(P, ox = 0, oy = 0) {
      for (const p of parts) { P.ctx.fillStyle = INK(Math.min(.7, p.life)); P.ctx.fillRect(p.x - ox - p.r / 2, p.y - oy - p.r / 2, p.r, p.r); }
    },
  };
}

const Arcade = {
  /**
   * cfg: { id, w, h, best:'high'|'low', title, intro, keysHelp, pads:[[key,label]], init(g), update(g,dt), draw(g,P) }
   * g gets: W, H, t, score, info, keys (held), pressed (this frame), ptr {x,y,down}, end({win,title,msg}).
   * Returns { restart() } so games with mode tabs can reset.
   */
  mount(root, signal, cfg) {
    const W = cfg.w || 720, H = cfg.h || 420;
    const canvas = el('canvas', { class: 'ar-canvas', width: W, height: H, style: `aspect-ratio:${W}/${H}` });
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
    const P = Pencil(ctx);
    const overlay = el('div', { class: 'ar-overlay' });
    const scoreEl = el('span', { class: 'chip' }), bestEl = el('span', { class: 'chip' }), infoEl = el('span', { class: 'chip' });
    const keys = new Set(), pressed = new Set(), ptr = { x: W / 2, y: H / 2, down: false };
    const pauseBtn = el('button', { class: 'btn btn-ghost', onclick: () => togglePause() }, 'pause');
    const pads = cfg.pads ? el('div', { class: 'ar-pads' }, cfg.pads.map(([k, label]) => {
      const up = () => keys.delete(k);
      return el('button', {
        class: 'btn ar-pad', onpointerdown: e => { e.preventDefault(); keys.add(k); pressed.add(k); if (state !== 'play' && state !== 'paused') start(); },
        onpointerup: up, onpointerleave: up, onpointercancel: up, oncontextmenu: e => e.preventDefault(),
      }, label);
    })) : null;
    root.append(el('div', { class: 'center' },
      el('div', { class: 'row' }, scoreEl, bestEl, infoEl, pauseBtn),
      el('div', { class: 'ar-wrap sk', style: `max-width:${Math.round(Math.min(W * 1.15, W * 640 / H)) + 12}px` }, canvas, overlay), pads,
      cfg.keysHelp ? el('p', { class: 'muted ar-help' }, cfg.keysHelp) : null));

    let state = 'ready', g, last = 0, hud = '';
    const fresh = () => {
      g = { W, H, t: 0, score: 0, info: '', keys, pressed, ptr, P, end };
      cfg.init(g);
    };
    function show(title, body, label) {
      overlay.replaceChildren(el('div', { class: 'ar-card sk' }, el('div', { class: 'big' }, title), body,
        el('button', { class: 'btn btn-primary', onclick: e => { e.stopPropagation(); state === 'paused' ? togglePause() : start(); } }, label),
        el('div', { class: 'muted', style: 'font-size:15px' }, state === 'paused' ? 'P or Esc to resume' : 'or press space')));
      overlay.hidden = false;
    }
    function start() { fresh(); state = 'play'; overlay.hidden = true; Sfx.scratch(); }
    function end({ win, title, msg } = {}) {
      if (state !== 'play') return;
      state = 'over';
      const s = Stats.record(cfg.id, { win, score: g.score, best: cfg.best || 'high' });
      win ? (Sfx.win(), celebrate()) : Sfx.lose();
      setTimeout(() => {
        if (signal.aborted || state !== 'over') return;
        show(s.newBest ? 'New best!' : (title || 'Game over'),
          el('div', {}, msg ? el('p', {}, msg) : null, statRow(s)), 'Play again');
      }, 500);
    }
    function togglePause() {
      if (state === 'play') { state = 'paused'; keys.clear(); show('Paused', el('p', { class: 'muted' }, 'Pencil down for a sec.'), 'Resume'); }
      else if (state === 'paused') { state = 'play'; overlay.hidden = true; }
    }

    const MAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'fire', Enter: 'fire', KeyJ: 'fire', KeyZ: 'fire' };
    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target.tagName === 'INPUT' || $('.modal-bg')) return;
      const k = MAP[e.code];
      if (k || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.code === 'KeyP' || e.code === 'Escape') return togglePause();
      if (state === 'paused') { if (e.code === 'Space') togglePause(); return; }
      if (state !== 'play') { if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) start(); return; }
      if (e.repeat) return;
      keys.add(e.code); pressed.add(e.code);
      if (k) { keys.add(k); pressed.add(k); }
    }, { signal });
    document.addEventListener('keyup', e => { keys.delete(e.code); const k = MAP[e.code]; if (k) keys.delete(k); }, { signal });

    const toLocal = e => { const r = canvas.getBoundingClientRect(); ptr.x = (e.clientX - r.left) / r.width * W; ptr.y = (e.clientY - r.top) / r.height * H; };
    let sx = 0, sy = 0;
    canvas.addEventListener('pointerdown', e => {
      e.preventDefault(); toLocal(e); ptr.down = true; sx = ptr.x; sy = ptr.y;
      try { canvas.setPointerCapture(e.pointerId); } catch {}
      if (state === 'play') pressed.add('tap');
    }, { signal });
    canvas.addEventListener('pointermove', e => toLocal(e), { signal });
    const lift = e => {
      if (!ptr.down) return;
      toLocal(e); ptr.down = false;
      const dx = ptr.x - sx, dy = ptr.y - sy;
      if (state === 'play' && Math.hypot(dx, dy) > 30) pressed.add(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'swright' : 'swleft') : (dy > 0 ? 'swdown' : 'swup'));
    };
    canvas.addEventListener('pointerup', lift, { signal });
    canvas.addEventListener('pointercancel', lift, { signal });
    overlay.addEventListener('click', () => { if (state === 'ready' || state === 'over') start(); });
    window.addEventListener('blur', () => { if (state === 'play') togglePause(); }, { signal });

    fresh();
    show(cfg.title, el('p', {}, cfg.intro), 'Start');

    function frame(ts) {
      if (signal.aborted) return;
      requestAnimationFrame(frame);
      const dt = Math.min(1 / 30, (ts - last) / 1000 || 0); last = ts;
      if (state === 'play') { g.t += dt; cfg.update(g, dt); }
      P.boil(ts / 1000);
      ctx.save(); cfg.draw(g, P); ctx.restore();
      pressed.clear();
      const best = Stats.of(cfg.id).best;
      const h = `${g.score}|${best}|${g.info}`;
      if (h !== hud) {
        hud = h;
        scoreEl.textContent = `${cfg.scoreLabel || 'score'} ${g.score}`;
        bestEl.textContent = `best ${best ?? '-'}`;
        infoEl.textContent = g.info; infoEl.hidden = !g.info;
      }
    }
    requestAnimationFrame(frame);
    return { restart() { state = 'ready'; fresh(); show(cfg.title, el('p', {}, cfg.intro), 'Start'); } };
  },
};
