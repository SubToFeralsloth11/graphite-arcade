Games.register({
  id: 'crossy',
  title: 'Doodle Hop',
  blurb: 'Hop a boxy doodle chick forever forward over roads, rivers and train tracks before the eraser comes for you.',
  group: 'arcade',
  tags: ['solo', 'endless', 'reflex'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M0 30 H120 M0 52 H120" /><path d="M8 41 H22 M36 41 H50 M64 41 H78 M92 41 H106" stroke-dasharray="4 4"/><path d="M70 34 h26 l4 -5 h-26 z M70 34 v12 h26 v-12 M96 46 l4 -5 v-12" /><path d="M70 34 v12 h26 v-12 z" class="fill"/><path d="M12 8 h16 l4 -6 h-16 z M12 8 v16 h16 v-16 M28 24 l4 -6 v-16"/><path d="M14 24 v6 h4 v-6"/><path d="M48 60 h18 l5 -6 h-18 z M48 60 v14 h18 v-14 M66 74 l5 -6 v-14"/><path d="M48 60 v14 h18 v-14 z" class="fill"/><path d="M57 54 l3 -4 l3 4 M62 66 h6"/><circle cx="54" cy="64" r="1.5"/></svg>`,
  help: 'Hop with the arrow keys or WASD, swipe in any direction, tap the page (hops forward) or use the pads. Your score is the furthest row you reach. Dodge cars and trucks, ride logs or stand on lily pads to cross rivers (the water and the screen edge both end the run), and get off the tracks when the warning light flashes. The page keeps scrolling forward, so dawdle too long and the eraser rubs you out. Grab coins on the way.',
  mount(root, signal) {
    const C = 48, COLS = 11, W = COLS * C, H = 640;
    const BASE = H - 1.4 * C, SPAN = COLS + 8, K = .32, PAPER = '#f5f2e9';
    const dust = Dust();
    const diff = r => Math.min(1, Math.max(0, r) / 180);
    let pats = null;

    /** Cheap graphite hatching: a tiny tiled pattern instead of clip-and-stroke per face. */
    function patterns(ctx) {
      const mk = (gap, a, flip) => {
        const s = gap * 3, c = document.createElement('canvas'); c.width = c.height = s;
        const x = c.getContext('2d'); x.strokeStyle = INK(a); x.lineWidth = 1.1; x.beginPath();
        for (let i = -s; i <= s; i += gap) { if (flip) { x.moveTo(i, 0); x.lineTo(i + s, s); } else { x.moveTo(i, s); x.lineTo(i + s, 0); } }
        x.stroke();
        return ctx.createPattern(c, 'repeat');
      };
      return { dark: mk(4, .5, false), mid: mk(5, .34, true), light: mk(7, .22, false) };
    }

    /* ---------- world generation ---------- */
    function newRow(g, r) {
      const G = g.gen, d = diff(r), prev = G.prev;
      const row = { r, type: 'grass', block: new Uint8Array(COLS), coin: -1, objs: null, v: 0, pads: null, train: null, tufts: [] };
      if (r < 0) {
        for (let c = 0; c < COLS; c++) if (r <= -3 || c < 2 || c > COLS - 3) row.block[c] = Math.random() < .7 ? 1 : 2;
      } else if (r < 4) {
        for (let c = 0; c < COLS; c++) if ((c < 3 || c > COLS - 4) && Math.random() < .3) row.block[c] = Math.random() < .7 ? 1 : 2;
      } else {
        if (G.left <= 0) {
          const opts = [['grass', 3], ['road', 3 + 2 * d], ['river', 2 + 1.5 * d], ['rail', .8 + d]].filter(o => o[0] !== G.type);
          let roll = Math.random() * opts.reduce((s, o) => s + o[1], 0);
          G.type = opts.find(o => (roll -= o[1]) < 0)?.[0] || 'grass';
          G.left = G.type === 'grass' ? 1 + rand(2) : G.type === 'road' ? 1 + rand(2 + Math.floor(d * 3)) : G.type === 'river' ? 1 + rand(d > .4 ? 3 : 2) : 1 + (Math.random() < .25);
        }
        G.left--;
        row.type = G.type;
        if (row.type === 'grass') {
          for (let c = 0; c < COLS; c++) {
            if (c === G.path || (prev.pads && prev.pads[c])) continue;
            if (Math.random() < .14 + d * .14 + (c === 0 || c === COLS - 1 ? .15 : 0)) row.block[c] = Math.random() < .72 ? 1 : 2;
          }
        } else if (row.type === 'road') {
          const truck = Math.random() < .28, w = truck ? 2.3 : 1.35;
          lane(row, w, (2.2 + Math.random() * 2.6) * (1 - d * .3), (Math.random() < .5 ? 1 : -1) * (1.3 + Math.random() * 1.8) * (1 + d * .9), truck ? 'truck' : 'car');
        } else if (row.type === 'river') {
          if ((prev.type === 'grass' || prev.pads) && Math.random() < .3) {
            row.pads = new Uint8Array(COLS); row.pads[G.path] = 1;
            for (let i = 2 + rand(3); i > 0; i--) row.pads[rand(COLS)] = 1;
          } else {
            const dir = prev.type === 'river' && prev.v ? -Math.sign(prev.v) : (Math.random() < .5 ? 1 : -1);
            lane(row, 2 + rand(d > .5 ? 2 : 3), 1.4 + Math.random() * 1.6 + d * 1.4, dir * (.9 + Math.random() * 1.1) * (1 + d * .6), 'log');
          }
        } else {
          row.train = { on: false, t: 1.5 + Math.random() * 5, x: 0, w: 7 + rand(5), dir: Math.random() < .5 ? 1 : -1, v: 26, rang: false };
        }
        // lily pads always include the path column, so only drift it on rows you can cross from anywhere
        if (row.type !== 'grass' && !row.pads) G.path = clamp(G.path + rand(3) - 1, 1, COLS - 2);
      }
      if (row.type === 'grass') {
        for (let i = 0; i < 4; i++) row.tufts.push(Math.random() * W, (Math.random() - .5) * C * .7);
        if (r > 4 && Math.random() < .12) { const c = rand(COLS); if (!row.block[c]) row.coin = c; }
      } else if (row.pads && Math.random() < .3) { const c = G.path; row.coin = c; }
      G.prev = row;
      return row;
    }
    function lane(row, w, gap, v, kind) {
      const n = Math.max(1, Math.floor(SPAN / (w + gap))), step = SPAN / n, off = Math.random() * step;
      row.v = v; row.kind = kind;
      row.objs = Array.from({ length: n }, (_, i) => ({ x: -4 + off + i * step + (Math.random() - .5) * (step - w) * .3, w, look: rand(3) }));
    }
    const rowOf = (g, r) => {
      let row = g.rows.get(r);
      if (!row) { while (g.genTo < r) g.rows.set(++g.genTo, newRow(g, g.genTo)); row = g.rows.get(r); }
      return row;
    };

    /* ---------- player ---------- */
    function pos(g) {
      const f = g.f, h = f.hop;
      if (!h) return { x: f.x, r: f.r, lift: 0 };
      const k = clamp(h.t / h.dur, 0, 1), e = k * k * (3 - 2 * k);
      return { x: h.x0 + (h.x1 - h.x0) * e, r: h.r0 + (h.r1 - h.r0) * e, lift: Math.sin(k * Math.PI) };
    }
    function tryHop(g, dx, dr) {
      const f = g.f, r1 = f.r + dr, row = rowOf(g, r1);
      f.face = dr > 0 ? 0 : dr < 0 ? 2 : dx > 0 ? 1 : 3;
      let x1 = f.x + dx;
      if (row.type !== 'river' || row.pads) x1 = Math.round(x1);
      if (x1 < -.3 || x1 > COLS - .7) { f.bump = .12; return; }
      x1 = clamp(x1, 0, COLS - 1);
      if (row.type === 'grass' && row.block[x1]) { f.bump = .12; f.bumpDir = [dx, dr]; Sfx.tap(); return; }
      f.hop = { x0: f.x, r0: f.r, x1, r1, t: 0, dur: .13 };
      if (dr > 0) g.started = true;
      Sfx.tap();
    }
    function land(g) {
      const f = g.f, h = f.hop;
      f.x = h.x1; f.r = h.r1; f.hop = null; f.squash = .14;
      if (f.r > g.score) g.score = f.r;
      const row = rowOf(g, f.r), c = Math.round(f.x);
      if (row.coin >= 0 && row.coin === c) {
        row.coin = -1; g.coins++; Store.set('crossy-coins', Store.get('crossy-coins', 0) + 1);
        Sfx.good(); g.pops.push({ x: c, r: f.r, t: 1 });
      }
    }
    function die(g, how) {
      if (g.dead) return;
      const p = pos(g);
      g.dead = { how, t: how === 'eraser' ? 1.6 : 1.1, x: p.x, r: p.r };
      g.f.hop = null; g.f.x = p.x;
      if (how !== 'eraser') { Sfx.bad(); dust.burst(sx(p.x), rowY(g, p.r), how === 'splash' ? 16 : 28, how === 'train' ? 260 : 150); }
      else Sfx.scratch();
    }
    const sx = x => x * C + C / 2;
    const rowY = (g, r) => BASE - (r - g.cam) * C;

    const DIR = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0], swup: [0, 1], swdown: [0, -1], swleft: [-1, 0], swright: [1, 0], fire: [0, 1] };
    const SW = ['swup', 'swdown', 'swleft', 'swright'];

    Arcade.mount(root, signal, {
      id: 'crossy', title: 'Doodle Hop', w: W, h: H,
      intro: 'Hop forward as far as you can. Do not stop for long: the eraser is right behind you.',
      keysHelp: 'Arrows/WASD or swipe to hop · tap hops forward · P pause',
      pads: [['left', '◀'], ['up', '▲'], ['down', '▼'], ['right', '▶']],
      scoreLabel: 'rows',
      init(g) {
        g.rows = new Map(); g.genTo = -8; g.gen = { type: 'grass', left: 0, path: 5, prev: { type: 'grass', pads: null } };
        g.cam = -1.8; g.f = { x: 5, r: 0, hop: null, face: 0, squash: 0, bump: 0, bumpDir: [0, 0] };
        g.coins = 0; g.pops = []; g.dead = null; g.started = false; g.grace = 3; g.queue = null; g.tapPend = false;
        rowOf(g, 18);
        g.info = 'coins 0';
      },
      update(g, dt) {
        const f = g.f, pr = g.pressed;
        dust.update(dt);
        for (const p of g.pops) p.t -= dt;
        g.pops = g.pops.filter(p => p.t > 0);

        // move traffic, logs and trains on every live row
        const lo = Math.floor(g.cam) - 4;
        for (const [r, row] of g.rows) {
          if (r < lo) { g.rows.delete(r); continue; }
          if (row.objs) for (const o of row.objs) {
            o.x += row.v * dt;
            if (o.x > COLS + 4) o.x -= SPAN; else if (o.x + o.w < -4) o.x += SPAN;
          }
          const tr = row.train;
          if (tr) {
            if (tr.on) {
              tr.x += tr.dir * tr.v * dt;
              if (tr.dir > 0 ? tr.x > COLS + 2 : tr.x + tr.w < -2) { tr.on = false; tr.rang = false; tr.t = Math.max(1.8, 3 + Math.random() * 4 - diff(r) * 1.5); }
            } else if ((tr.t -= dt) <= 0) { tr.on = true; tr.x = tr.dir > 0 ? -tr.w - 2 : COLS + 2; }
            if (!tr.on && tr.t < 1.2 && !tr.rang) { tr.rang = true; if (r - g.cam < 12 && r - g.cam > -2) { Sfx.tap(); setTimeout(() => Sfx.tap(), 160); } }
          }
        }

        if (g.dead) {
          g.dead.t -= dt;
          if (g.dead.how === 'eraser' && g.dead.t < .9) g.dead.r += 9 * dt;
          if (g.dead.t <= 0) {
            const why = { eraser: 'Rubbed out', squash: 'Flattened', splash: 'Splash!', train: 'Derailed' }[g.dead.how];
            g.end({ win: false, title: why, msg: `You hopped ${g.score} row${g.score === 1 ? '' : 's'} and grabbed ${g.coins} coin${g.coins === 1 ? '' : 's'}.` });
          }
          return;
        }

        // input: buffer one hop so quick taps during a hop are not lost
        for (const k of pr) if (DIR[k]) g.queue = DIR[k];
        if (pr.has('tap')) g.tapPend = true;
        if (g.tapPend && !g.ptr.down) { if (!SW.some(s => pr.has(s))) g.queue = DIR.up; g.tapPend = false; }
        if (!f.hop && g.queue) { tryHop(g, ...g.queue); g.queue = null; }
        if (f.hop && (f.hop.t += dt) >= f.hop.dur) land(g);
        f.squash = Math.max(0, f.squash - dt); f.bump = Math.max(0, f.bump - dt);

        // camera: follow forward hops, and creep on its own once the run is going
        if ((g.grace -= dt) <= 0) g.started = true;
        if (g.started) g.cam += (.42 + Math.min(.5, g.score * .004)) * dt;
        const target = f.r - 2.2;
        if (target > g.cam) g.cam += (target - g.cam) * Math.min(1, dt * 4);
        rowOf(g, Math.ceil(g.cam) + 16);

        const p = pos(g), cr = Math.round(p.r), row = rowOf(g, cr);
        if (p.r < g.cam - 1.1) return die(g, 'eraser');
        const pl = p.x + .5 - .28, pr2 = p.x + .5 + .28;
        if (row.type === 'road' && p.lift < .7) {
          for (const o of row.objs) if (pr2 > o.x + .06 && pl < o.x + o.w - .06) return die(g, 'squash');
        }
        if (row.train && row.train.on) {
          const tr = row.train;
          if (pr2 > tr.x && pl < tr.x + tr.w) return die(g, 'train');
        }
        if (!f.hop && row.type === 'river') {
          if (row.pads) { if (!row.pads[Math.round(f.x)]) return die(g, 'splash'); }
          else {
            const cx = f.x + .5, o = row.objs.find(o => cx > o.x + .08 && cx < o.x + o.w - .08);
            if (!o) return die(g, 'splash');
            f.x += row.v * dt;
            if (f.x < -.45 || f.x > COLS - .55) return die(g, 'splash');
          }
        }
        g.info = `coins ${g.coins}`;
      },
      draw(g, P) {
        const ctx = P.ctx;
        if (!pats) pats = patterns(ctx);
        P.paper(W, H, { ruled: false });
        const rlo = Math.floor(g.cam - 2), rhi = Math.ceil(g.cam + (BASE + C) / C + 1);
        const t = g.t;

        // ground strips (far to near, cheap fills, one batched path per kind)
        const tufts = [], waves = [], dashes = [], edges = [], ties = [];
        for (let r = rhi; r >= rlo; r--) {
          const row = rowOf(g, r), y = rowY(g, r), top = y - C / 2;
          if (row.type === 'grass') {
            if (r & 1) { ctx.fillStyle = INK(.035); ctx.fillRect(0, top, W, C); }
            for (let i = 0; i < row.tufts.length; i += 2) tufts.push(row.tufts[i], y + row.tufts[i + 1]);
          } else if (row.type === 'road') {
            ctx.fillStyle = INK(.11); ctx.fillRect(0, top, W, C);
            const up = rowOf(g, r + 1).type === 'road';
            (up ? dashes : edges).push(top);
            if (rowOf(g, r - 1).type !== 'road') edges.push(top + C);
          } else if (row.type === 'river') {
            ctx.fillStyle = 'rgba(70,110,160,.14)'; ctx.fillRect(0, top, W, C);
            waves.push(y, r);
            if (rowOf(g, r + 1).type !== 'river') edges.push(top);
            if (rowOf(g, r - 1).type !== 'river') edges.push(top + C);
          } else {
            ctx.fillStyle = INK(.05); ctx.fillRect(0, top, W, C);
            ties.push(y);
          }
        }
        ctx.lineCap = 'round';
        ctx.strokeStyle = INK(.3); ctx.lineWidth = 1.2; ctx.beginPath();
        for (let i = 0; i < tufts.length; i += 2) { const x = tufts[i], y = tufts[i + 1]; ctx.moveTo(x, y); ctx.lineTo(x - 3, y - 7); ctx.moveTo(x + 4, y); ctx.lineTo(x + 5, y - 9); ctx.moveTo(x + 8, y); ctx.lineTo(x + 11, y - 6); }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(70,110,160,.4)'; ctx.beginPath();
        for (let i = 0; i < waves.length; i += 2) for (let k = 0; k < 2; k++) {
          const y = waves[i] - 8 + k * 16, off = ((t * 18 * (waves[i + 1] & 1 ? 1 : -1) + k * 29) % 64 + 64) % 64;
          for (let x = -64 + off; x < W; x += 64) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 8, y - 4, x + 16, y); ctx.quadraticCurveTo(x + 24, y + 4, x + 32, y); }
        }
        ctx.stroke();
        ctx.strokeStyle = INK(.4); ctx.lineWidth = 2; ctx.setLineDash([16, 14]); ctx.beginPath();
        for (const y of dashes) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
        ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = INK(.65); ctx.lineWidth = 2.2; ctx.beginPath();
        for (const y of edges) { ctx.moveTo(0, y); ctx.lineTo(W, y + .5); }
        ctx.stroke();
        if (ties.length) {
          ctx.fillStyle = INK(.25);
          for (const y of ties) for (let x = 6; x < W; x += 22) ctx.fillRect(x, y - 15, 7, 30);
          ctx.strokeStyle = INK(.75); ctx.lineWidth = 2.4; ctx.beginPath();
          for (const y of ties) { ctx.moveTo(0, y - 9); ctx.lineTo(W, y - 9); ctx.moveTo(0, y + 9); ctx.lineTo(W, y + 9); }
          ctx.stroke();
        }

        // objects, far rows first so nearer blocks overlap them
        const p = g.dead ? { x: g.dead.x, r: g.dead.r, lift: 0 } : pos(g), pRow = Math.round(p.r);
        for (let r = rhi; r >= rlo; r--) {
          const row = rowOf(g, r), y = rowY(g, r);
          if (row.type === 'grass') {
            for (let c = 0; c < COLS; c++) if (row.block[c]) row.block[c] === 1 ? tree(ctx, sx(c), y, c + r) : rock(ctx, sx(c), y);
          } else if (row.type === 'river') {
            if (row.pads) for (let c = 0; c < COLS; c++) { if (row.pads[c]) lily(ctx, sx(c), y, c * 1.7 + r, t); }
            else for (const o of row.objs) if (o.x < COLS + .5 && o.x + o.w > -.5) log(ctx, o.x * C, y, o.w * C);
          } else if (row.type === 'road') {
            for (const o of row.objs) if (o.x < COLS + .5 && o.x + o.w > -.5) car(ctx, o.x * C, y, o.w * C, row.v > 0 ? 1 : -1, row.kind, o.look);
          } else rail(ctx, row.train, y, t);
          if (row.coin >= 0) coin(ctx, sx(row.coin), y, t);
          if (r === pRow && !(g.dead && g.dead.how === 'train')) hopper(g, ctx, p);
        }
        dust.draw(P);
        for (const q of g.pops) P.text('+1', sx(q.x), rowY(g, q.r) - 40 - (1 - q.t) * 30, { size: 26, a: Math.min(.9, q.t * 1.5) });
        if (g.dead && g.dead.how === 'eraser') eraser(g, ctx);
        // creeping danger: smudge along the bottom edge
        const grd = ctx.createLinearGradient(0, H - 40, 0, H);
        grd.addColorStop(0, INK(0)); grd.addColorStop(1, INK(.18));
        ctx.fillStyle = grd; ctx.fillRect(0, H - 40, W, 40);
        P.text(String(g.score), 16, 34, { size: 46, align: 'left', a: .8 });
        if (g.coins) P.text(`◎ ${g.coins}`, W - 14, 30, { size: 26, align: 'right', a: .65 });
        if (!g.started && g.t < 3) P.text('hop forward!', W / 2, rowY(g, 0) + 34, { size: 24, a: .55 });
      },
    });

    /* ---------- faux-3D drawing ---------- */
    /** Oblique box: footprint (x,y,w,d) on the ground, raised from z0 to z1. Top drifts up-right, so south and west faces show. */
    function box(ctx, x, y, w, d, z0, z1, south = pats.dark, west = pats.mid, top = null) {
      const h = z1 - z0, bx = K * z0, by = -z0, ox = K * h;
      ctx.translate(x, y);
      ctx.lineWidth = 1.5; ctx.strokeStyle = INK(.8); ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by + d); ctx.lineTo(bx + ox, by + d - h); ctx.lineTo(bx + ox, by - h); ctx.closePath();
      ctx.fillStyle = PAPER; ctx.fill(); ctx.fillStyle = west; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, by + d); ctx.lineTo(bx + w, by + d); ctx.lineTo(bx + w + ox, by + d - h); ctx.lineTo(bx + ox, by + d - h); ctx.closePath();
      ctx.fillStyle = PAPER; ctx.fill(); ctx.fillStyle = south; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.rect(bx + ox, by - h, w, d);
      ctx.fillStyle = PAPER; ctx.fill(); if (top) { ctx.fillStyle = top; ctx.fill(); } ctx.stroke();
      ctx.lineWidth = .8; ctx.strokeStyle = INK(.35); ctx.strokeRect(bx + ox + .9, by - h - .7, w, d);
      ctx.translate(-x, -y);
    }
    function shadow(ctx, cx, cy, rx, a = .14) { ctx.fillStyle = INK(a); ctx.beginPath(); ctx.ellipse(cx + 3, cy + 4, rx, rx * .45, 0, 0, 7); ctx.fill(); }
    function tree(ctx, cx, cy, seed) {
      const tall = 30 + (seed * 7 % 3) * 9;
      shadow(ctx, cx + 6, cy, C * .42);
      box(ctx, cx - 5, cy - 4, 10, 8, 0, 12, pats.dark, pats.dark);
      box(ctx, cx - C * .36, cy - C * .3, C * .72, C * .6, 12, 12 + tall, pats.mid, pats.light, pats.light);
    }
    function rock(ctx, cx, cy) {
      shadow(ctx, cx, cy, C * .34);
      box(ctx, cx - C * .32, cy - C * .24, C * .64, C * .48, 0, 14, pats.dark, pats.mid);
      ctx.strokeStyle = INK(.4); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - 6 + 4.5, cy - 16); ctx.lineTo(cx + 2 + 4.5, cy - 11); ctx.lineTo(cx + 9 + 4.5, cy - 14); ctx.stroke();
    }
    function lily(ctx, cx, cy, ph, t) {
      const b = Math.sin(t * 1.7 + ph) * 1.2;
      ctx.fillStyle = PAPER; ctx.strokeStyle = INK(.75); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(cx, cy + b); ctx.ellipse(cx, cy + b, C * .4, C * .3, 0, .35, Math.PI * 2 - .35); ctx.closePath(); ctx.fill();
      ctx.fillStyle = pats.light; ctx.fill(); ctx.stroke();
      ctx.lineWidth = .9; ctx.strokeStyle = INK(.35); ctx.beginPath();
      ctx.moveTo(cx, cy + b); ctx.lineTo(cx - 10, cy - 7 + b); ctx.moveTo(cx, cy + b); ctx.lineTo(cx - 12, cy + 5 + b); ctx.moveTo(cx, cy + b); ctx.lineTo(cx + 2, cy + 11 + b);
      ctx.stroke();
    }
    function log(ctx, x, cy, w) {
      box(ctx, x + 2, cy - C * .3, w - 4, C * .6, -2, 7, pats.dark, pats.dark, null);
      ctx.strokeStyle = INK(.4); ctx.lineWidth = 1.1; ctx.beginPath();
      const tx = x + 2 + K * 7, ty = cy - C * .3 - 7;
      for (let i = 14; i < w - 18; i += 22) { ctx.moveTo(tx + i, ty + 8); ctx.lineTo(tx + i + 12, ty + 8); ctx.moveTo(tx + i + 7, ty + 19); ctx.lineTo(tx + i + 18, ty + 19); }
      ctx.stroke();
      ctx.beginPath(); ctx.ellipse(tx + w - 12, ty + C * .3, 3.5, 7, 0, 0, 7); ctx.stroke();
    }
    function car(ctx, x, cy, w, dir, kind, look) {
      const d = C * .62, y = cy - d / 2;
      shadow(ctx, x + w / 2, cy, w * .5, .1);
      ctx.fillStyle = INK(.85);
      for (const wx of [x + 8, x + w - 18]) ctx.fillRect(wx, y + d - 3, 10, 5);
      if (kind === 'truck') {
        const cab = C * .62, cargoX = dir > 0 ? x + 2 : x + cab + 2;
        box(ctx, cargoX, y, w - cab - 4, d, 3, 40, pats.dark, pats.mid, look === 1 ? pats.light : null);
        box(ctx, dir > 0 ? x + w - cab : x + 2, y + 2, cab - 4, d - 4, 3, 26, pats.mid, pats.mid);
        const wx = (dir > 0 ? x + w - 9 : x + 4) + K * 26;
        ctx.fillStyle = INK(.5); ctx.fillRect(wx, y + 4 - 26 + 6, 5, d - 12);
      } else {
        box(ctx, x + 2, y, w - 4, d, 3, 16, look === 2 ? pats.mid : pats.dark, pats.light, look === 0 ? pats.light : null);
        const cw = w * .5, cxp = x + (dir > 0 ? w * .18 : w * .32);
        box(ctx, cxp, y + 4, cw, d - 8, 16, 28, pats.light, pats.light);
        const fx = (dir > 0 ? cxp + cw - 4 : cxp + 1) + K * 28;
        ctx.fillStyle = INK(.55); ctx.fillRect(fx, y + 4 - 28 + 2, 3, d - 12);
        ctx.fillStyle = INK(.9); const hx = dir > 0 ? x + w - 4 : x + 1;
        ctx.fillRect(hx + K * 9, y + d - 12, 3, 4);
      }
    }
    function rail(ctx, tr, cy, t) {
      // signal post at the left edge
      const warn = tr.on || tr.t < 1.2, blink = warn && Math.floor(t * 6) % 2;
      box(ctx, 6, cy - 22, 6, 6, 0, 30, pats.dark, pats.dark);
      ctx.strokeStyle = INK(.85); ctx.lineWidth = 1.6; ctx.fillStyle = blink ? INK(.85) : PAPER;
      ctx.beginPath(); ctx.arc(9 + K * 30, cy - 22 - 30 + 2, 6, 0, 7); ctx.fill(); ctx.stroke();
      if (blink) { ctx.strokeStyle = INK(.45); ctx.lineWidth = 1.2; ctx.beginPath(); for (let a = 0; a < 6.28; a += .9) { const ex = 9 + K * 30, ey = cy - 50; ctx.moveTo(ex + Math.cos(a) * 9, ey + Math.sin(a) * 9); ctx.lineTo(ex + Math.cos(a) * 13, ey + Math.sin(a) * 13); } ctx.stroke(); }
      if (!tr.on) return;
      const d = C * .7, y = cy - d / 2, carLen = 3;
      for (let i = 0; i < tr.w; i += carLen) {
        const x0 = (tr.x + i) * C, len = Math.min(carLen, tr.w - i) * C - 4;
        if (x0 > W || x0 + len < -20) continue;
        const nose = tr.dir > 0 ? i + carLen >= tr.w : i === 0;
        box(ctx, x0, y, len, d, 3, nose ? 44 : 38, pats.dark, pats.mid, nose ? pats.light : null);
        ctx.fillStyle = INK(.6);
        for (let k = 10; k < len - 14; k += 22) ctx.fillRect(x0 + k, y + d - 22, 12, 9);
      }
    }
    function coin(ctx, cx, cy, t) {
      const z = 18 + Math.sin(t * 3 + cx) * 3, s = Math.abs(Math.cos(t * 2.4 + cx * .1));
      shadow(ctx, cx, cy, 7, .1);
      const x = cx + K * z, y = cy - z;
      ctx.fillStyle = PAPER; ctx.strokeStyle = INK(.85); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(x, y, 2 + 8 * s, 10, 0, 0, 7); ctx.fill(); ctx.fillStyle = INK(.3); ctx.fill(); ctx.stroke();
      if (s > .4) { ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, 4 * s, 5.5, 0, 0, 7); ctx.stroke(); }
    }
    function hopper(g, ctx, p) {
      const f = g.f, dead = g.dead, cx = sx(p.x), cy = rowY(g, p.r);
      if (dead && dead.how === 'splash') {
        const k = 1 - dead.t / 1.1;
        ctx.strokeStyle = 'rgba(70,110,160,' + (.7 * (1 - k)).toFixed(3) + ')'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(cx, cy, 6 + k * 22, 3 + k * 10, 0, 0, 7); ctx.moveTo(cx + 3 + k * 12, cy); ctx.ellipse(cx, cy, 3 + k * 12, 1.5 + k * 5, 0, 0, 7); ctx.stroke();
        return;
      }
      const flat = dead && dead.how === 'squash';
      const sq = Math.sin(clamp(f.squash / .14, 0, 1) * Math.PI) * .32;
      const stretch = p.lift * .14;
      let w = C * .5 * (1 + sq * .7 - stretch * .5), d = C * .44, h = 24 * (1 - sq + stretch);
      if (flat) { w = C * .78; h = 4; d = C * .6; }
      const z0 = p.lift * 22;
      let bx = 0, by = 0;
      if (f.bump > 0) { const s = Math.sin(f.bump / .12 * Math.PI) * 4; bx = f.bumpDir[0] * s; by = -f.bumpDir[1] * s; }
      shadow(ctx, cx, cy, C * .26 * (1 - p.lift * .3), .18);
      const x = cx - w / 2 + bx, y = cy - d / 2 + by;
      box(ctx, x, y, w, d, z0, z0 + h, pats.mid, pats.light, null);
      if (flat) return;
      // face details on the top (and front when facing down)
      const tx = x + K * (z0 + h), ty = y - z0 - h, mx = tx + w / 2, my = ty + d / 2;
      ctx.fillStyle = INK(.85);
      const FACE = [[0, -1], [1, 0], [0, 1], [-1, 0]][f.face], ex = FACE[0], ey = FACE[1];
      // comb tuft
      ctx.strokeStyle = INK(.8); ctx.lineWidth = 1.6; ctx.beginPath();
      ctx.moveTo(mx - ex * 3 - 2, my - ey * 3); ctx.lineTo(mx - ex * 3, my - ey * 3 - 6); ctx.lineTo(mx - ex * 3 + 2, my - ey * 3 - 1); ctx.lineTo(mx - ex * 3 + 4, my - ey * 3 - 5);
      ctx.stroke();
      if (f.face === 2) {
        // facing the viewer: eyes and beak on the front face
        const fy = y + d - z0 - h * .55, fx = x + w / 2 + K * (z0 + h * .55);
        ctx.fillRect(fx - 7, fy - 5, 3, 3); ctx.fillRect(fx + 4, fy - 5, 3, 3);
        ctx.beginPath(); ctx.moveTo(fx - 4, fy); ctx.lineTo(fx + 4, fy); ctx.lineTo(fx, fy + 6); ctx.closePath(); ctx.fill();
      } else {
        const px = -ey, py = ex; // perpendicular for the eye pair
        ctx.fillRect(mx + ex * 6 + px * 5 - 1.5, my + ey * 6 + py * 5 - 1.5, 3, 3);
        ctx.fillRect(mx + ex * 6 - px * 5 - 1.5, my + ey * 6 - py * 5 - 1.5, 3, 3);
        ctx.beginPath(); ctx.moveTo(mx + ex * 9 + px * 3, my + ey * 9 + py * 3); ctx.lineTo(mx + ex * 15, my + ey * 15); ctx.lineTo(mx + ex * 9 - px * 3, my + ey * 9 - py * 3); ctx.closePath(); ctx.fill();
      }
    }
    function eraser(g, ctx) {
      const dd = g.dead, k = clamp((1.6 - dd.t) / .7, 0, 1), px = sx(dd.x), py = rowY(g, dd.r);
      const ey = -90 + (py + 90) * k * k, ex = px;
      // rubbed-out streaks behind it
      ctx.strokeStyle = 'rgba(245,242,233,.85)'; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(ex - 22, -20); ctx.lineTo(ex - 22, ey); ctx.moveTo(ex + 14, -20); ctx.lineTo(ex + 14, ey); ctx.stroke();
      box(ctx, ex - 46, ey - 26, 92, 34, 6, 44, pats.mid, pats.light, null);
      box(ctx, ex - 46, ey - 26, 34, 34, 44, 47, pats.dark, pats.dark, pats.dark);
      ctx.font = '700 18px Caveat, cursive'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK(.75);
      ctx.fillText('ERASER', ex + K * 44 + 10, ey - 26 - 44 + 17);
    }
  },
});
