Games.register({
  id: 'crossing',
  title: 'Desk Crossing',
  blurb: 'Hop a doodled frog across busy roads and a river of logs and turtles to reach its five homes.',
  group: 'arcade',
  tags: ['solo', 'classic', 'levels'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M6 12 h108 M6 40 h108 M6 26 h20 M40 26 h20 M74 26 h20" stroke-dasharray="6 6"/><path d="M14 46 h40 a6 6 0 0 1 0 12 h-40 a6 6 0 0 1 0 -12 z M66 48 h30 v12 h-30 z"/><path d="M30 14 h20 v10 h-20 z M80 14 h14 v10 h-14 z" class="fill"/><ellipse cx="60" cy="70" rx="7" ry="6" class="fill"/><path d="M53 66 l-5 -4 M67 66 l5 -4 M53 74 l-5 4 M67 74 l5 4"/></svg>`,
  help: 'Hop with the arrow keys or WASD, swipe, tap the page (hops forward) or use the pads. Dodge the traffic, then ride the logs and turtles across the river: falling in the water or getting carried off the edge costs a frog. Turtles with a dotted outline are about to dive. Fill all five homes to clear the level; each level gets faster. Every new row is worth points, a fly in a home is a bonus, and spare time is added to your score.',
  mount(root, signal) {
    const C = 40, COLS = 16, ROWS = 13, W = COLS * C, H = ROWS * C, EXT = 6 * C, SPAN = W + EXT * 2;
    const HOMES = [2, 5, 8, 11, 14].map(c => c * C);
    const RIVER = r => r >= 1 && r <= 5, ROAD = r => r >= 7 && r <= 11;
    const LANES = {
      11: { kind: 'car', dir: -1, sp: 1.5, len: 1, gap: 3.2 },
      10: { kind: 'tractor', dir: 1, sp: 1.2, len: 1, gap: 3.6 },
      9: { kind: 'racer', dir: -1, sp: 2.6, len: 1, gap: 5 },
      8: { kind: 'car', dir: 1, sp: 1.8, len: 1, gap: 2.8 },
      7: { kind: 'truck', dir: -1, sp: 1.25, len: 2, gap: 4 },
      5: { kind: 'turtle', dir: -1, sp: 1.3, len: 3, gap: 2, dive: true },
      4: { kind: 'log', dir: 1, sp: 1.0, len: 3, gap: 3 },
      3: { kind: 'log', dir: 1, sp: 2.1, len: 5, gap: 3.2 },
      2: { kind: 'turtle', dir: -1, sp: 1.6, len: 2, gap: 2.6, dive: true },
      1: { kind: 'log', dir: 1, sp: 1.4, len: 4, gap: 3 },
    };
    const TIME = 30;
    const dust = Dust();

    function buildLanes(g) {
      g.lanes = {};
      const L = g.level, mul = Math.min(2.2, 1 + (L - 1) * .14);
      for (const [r, d] of Object.entries(LANES)) {
        const len = d.kind === 'log' ? Math.max(2, d.len - Math.floor((L - 1) / 2)) : d.len;
        const gap = d.gap + (d.kind === 'log' ? Math.min(2, (L - 1) * .3) : -Math.min(1, (L - 1) * .15));
        const n = Math.max(1, Math.floor(SPAN / ((len + gap) * C))), step = SPAN / n, off = Math.random() * step;
        const objs = Array.from({ length: n }, (_, i) => ({
          x: -EXT + off + i * step, w: len * C,
          dive: d.dive && L >= 2 && i % 2 === 0, ph: Math.random() * 8,
        }));
        g.lanes[r] = { ...d, v: d.dir * d.sp * mul * C, objs };
      }
      g.snake = L >= 3 ? { x: -60, dir: 1, v: 40 + L * 6 } : null;
    }
    const sunk = o => o.dive && (o.ph % 8) > 6.2 && (o.ph % 8) < 7.6;
    const warn = o => o.dive && (o.ph % 8) > 5.2 && !sunk(o);

    function resetFrog(g) {
      g.f = { x: 7.5 * C, row: ROWS - 1, hop: null, face: 0, best: ROWS - 1, dead: 0 };
      g.time = TIME; g.queue = null;
    }
    function die(g, how) {
      const f = g.f;
      if (f.dead) return;
      f.dead = .9; f.how = how; Sfx.bad();
      dust.burst(f.x, f.row * C + C / 2, how === 'splash' ? 18 : 26, how === 'splash' ? 100 : 180);
      g.lives--;
    }
    function frogPos(g) {
      const f = g.f;
      if (!f.hop) return { x: f.x, y: f.row * C + C / 2, lift: 0 };
      const h = f.hop, k = clamp(h.t / h.dur, 0, 1), e = k * k * (3 - 2 * k);
      return { x: h.x0 + (h.x1 - h.x0) * e, y: (h.r0 + (h.r1 - h.r0) * e) * C + C / 2, lift: Math.sin(k * Math.PI) };
    }
    function hop(g, dx, dy) {
      const f = g.f;
      const row = f.row + dy;
      if (row < 0 || row >= ROWS) return;
      let x = f.x + dx * C;
      if (x < C / 2 - 2 || x > W - C / 2 + 2) return;
      if (!RIVER(row)) x = clamp(Math.round((x - C / 2) / C) * C + C / 2, C / 2, W - C / 2);
      if (row === 0) { const hx = HOMES.reduce((b, h) => Math.abs(h - x) < Math.abs(b - x) ? h : b); if (Math.abs(hx - x) < C * .75) x = hx; }
      f.hop = { x0: f.x, r0: f.row, x1: x, r1: row, t: 0, dur: .14 };
      f.face = dy < 0 ? 0 : dy > 0 ? Math.PI : dx > 0 ? Math.PI / 2 : -Math.PI / 2;
      Sfx.tap();
    }
    function land(g) {
      const f = g.f, h = f.hop;
      f.x = h.x1; f.row = h.r1; f.hop = null;
      if (f.row < f.best) { g.score += 10 * (f.best - f.row); f.best = f.row; }
      if (f.row === 0) {
        const i = HOMES.findIndex(hx => Math.abs(hx - f.x) < C * .5);
        if (i < 0 || g.homes[i]) return die(g, 'bonk');
        g.homes[i] = true;
        let pts = 50 + Math.floor(g.time) * 10;
        if (g.fly && g.fly.i === i) { pts += 200; g.fly = null; g.popups.push({ x: f.x, y: C, text: 'fly +200', t: 1.2 }); }
        g.score += pts; Sfx.good(); dust.burst(f.x, C / 2, 16, 120);
        if (g.homes.every(Boolean)) {
          g.score += 1000 * g.level; g.level++; Sfx.win(); celebrate(12); toast(`Level ${g.level}!`);
          g.homes = HOMES.map(() => false); buildLanes(g); g.banner = 1.8;
        }
        resetFrog(g);
      }
    }
    function laneAt(g, r, x) {
      const L = g.lanes[r]; if (!L) return null;
      for (const o of L.objs) if (x > o.x + 6 && x < o.x + o.w - 6) return o;
      return null;
    }

    Arcade.mount(root, signal, {
      id: 'crossing', title: 'Desk Crossing', w: W, h: H,
      intro: 'Get five frogs home across the road and the river.',
      keysHelp: 'Arrows/WASD, swipe, or tap to hop forward · P pause',
      pads: [['left', '◀'], ['up', '▲'], ['down', '▼'], ['right', '▶']],
      init(g) {
        g.level = 1; g.lives = 3; g.homes = HOMES.map(() => false); g.fly = null; g.flyT = 6; g.popups = []; g.banner = 0; g.queue = null; g.tapPend = false;
        buildLanes(g); resetFrog(g);
        g.info = 'level 1 · ♥ 3';
      },
      update(g, dt) {
        const f = g.f, pr = g.pressed;
        dust.update(dt);
        g.banner -= dt;
        for (const t of g.popups) { t.t -= dt; t.y -= 18 * dt; }
        g.popups = g.popups.filter(t => t.t > 0);
        for (const L of Object.values(g.lanes)) for (const o of L.objs) {
          o.x += L.v * dt; o.ph += dt;
          if (o.x > W + EXT) o.x -= SPAN; else if (o.x + o.w < -EXT) o.x += SPAN;
        }
        if (g.snake) { const s = g.snake; s.x += s.dir * s.v * dt; if (s.x > W + 60) s.dir = -1; if (s.x < -60) s.dir = 1; }
        g.flyT -= dt;
        if (g.fly && (g.fly.t -= dt) <= 0) g.fly = null;
        if (!g.fly && g.flyT <= 0) { const free = g.homes.map((h, i) => h ? -1 : i).filter(i => i >= 0); if (free.length) g.fly = { i: pick(free), t: 5 }; g.flyT = 8 + Math.random() * 6; }

        if (f.dead) {
          if ((f.dead -= dt) <= 0) {
            if (g.lives <= 0) return g.end({ win: false, title: 'Squashed', msg: `You reached level ${g.level}.` });
            resetFrog(g);
          }
          g.info = `level ${g.level} · ♥ ${Math.max(0, g.lives)}`;
          return;
        }

        // input: buffer one hop so quick taps are not lost mid-hop
        const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0], swup: [0, -1], swdown: [0, 1], swleft: [-1, 0], swright: [1, 0] };
        for (const k of pr) if (DIR[k]) g.queue = DIR[k];
        if (pr.has('tap')) g.tapPend = true;
        if (g.tapPend && !g.ptr.down) { if (!['swup', 'swdown', 'swleft', 'swright'].some(s => pr.has(s))) g.queue = [0, -1]; g.tapPend = false; }
        if (!f.hop && g.queue) { hop(g, ...g.queue); g.queue = null; }

        if (f.hop) { f.hop.t += dt; if (f.hop.t >= f.hop.dur) land(g); }
        if (f.dead) return;
        g.time -= dt;
        if (g.time <= 0) return die(g, 'time');

        const pos = frogPos(g), row = Math.round((pos.y - C / 2) / C);
        if (ROAD(row) && pos.lift < .6) {
          for (const o of g.lanes[row].objs) if (pos.x + 12 > o.x + 3 && pos.x - 12 < o.x + o.w - 3) return die(g, 'squash');
        }
        if (row === 6 && g.snake && Math.abs(pos.x - g.snake.x) < 34 && !f.hop) return die(g, 'bite');
        if (!f.hop && RIVER(f.row)) {
          const o = laneAt(g, f.row, f.x);
          if (!o || sunk(o)) return die(g, 'splash');
          f.x += g.lanes[f.row].v * dt;
          if (f.x < 6 || f.x > W - 6) return die(g, 'splash');
        }
        if (f.hop && RIVER(f.hop.r0) && f.hop.t < f.hop.dur * .5) { const v = g.lanes[f.hop.r0].v * dt; f.hop.x0 += v; f.hop.x1 += RIVER(f.hop.r1) ? v : 0; }
        g.info = `level ${g.level} · ♥ ${g.lives}`;
      },
      draw(g, P) {
        const ctx = P.ctx;
        P.paper(W, H, { ruled: false });
        // river
        ctx.fillStyle = 'rgba(70,110,160,.10)'; ctx.fillRect(0, C, W, 5 * C);
        ctx.strokeStyle = 'rgba(70,110,160,.35)'; ctx.lineWidth = 1.2; ctx.beginPath();
        for (let r = 1; r <= 5; r++) for (let i = 0; i < 3; i++) {
          const y = r * C + 8 + i * 12, off = (g.t * 20 * (r % 2 ? 1 : -1) + i * 37) % 60;
          for (let x = -60 + off; x < W; x += 60) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 8, y - 4, x + 16, y); ctx.quadraticCurveTo(x + 24, y + 4, x + 32, y); }
        }
        ctx.stroke();
        // road
        P.shade(0, 7 * C, W, 5 * C, .08);
        ctx.strokeStyle = INK(.35); ctx.lineWidth = 2; ctx.setLineDash([18, 16]); ctx.beginPath();
        for (let r = 8; r <= 11; r++) { ctx.moveTo(0, r * C); ctx.lineTo(W, r * C); }
        ctx.stroke(); ctx.setLineDash([]);
        P.line(0, 7 * C, W, 7 * C, { w: 2.4 }); P.line(0, 12 * C, W, 12 * C, { w: 2.4 });
        P.line(0, 6 * C, W, 6 * C, { w: 2 }); P.line(0, C, W, C, { w: 2 });
        // safe strips: grass tufts
        ctx.strokeStyle = INK(.3); ctx.lineWidth = 1.2; ctx.beginPath();
        for (const r of [6, 12]) for (let x = 14; x < W; x += 38) { const y = r * C + 30; ctx.moveTo(x, y); ctx.lineTo(x - 3, y - 8); ctx.moveTo(x + 4, y); ctx.lineTo(x + 5, y - 10); ctx.moveTo(x + 8, y); ctx.lineTo(x + 11, y - 7); }
        ctx.stroke();
        // homes row: hedge with notches
        P.hatchRect(0, 0, W, C, { a: .45, gap: 4, cross: true });
        HOMES.forEach((hx, i) => {
          ctx.fillStyle = '#f5f2e9'; ctx.fillRect(hx - C * .6, 4, C * 1.2, C - 4);
          P.poly([[hx - C * .6, C], [hx - C * .6, 4], [hx + C * .6, 4], [hx + C * .6, C]], { closed: false, w: 1.8 });
          if (g.homes[i]) drawFrog(ctx, hx, C / 2 + 2, 0, 0, .55);
          else if (g.fly && g.fly.i === i) {
            const fx = hx + Math.sin(g.t * 9) * 3, fy = C / 2 + Math.cos(g.t * 7) * 2;
            ctx.fillStyle = INK(.8); ctx.beginPath(); ctx.arc(fx, fy, 3, 0, 7); ctx.fill();
            ctx.strokeStyle = INK(.5); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(fx - 4, fy - 3, 4, 2, -.5 + Math.sin(g.t * 40) * .3, 0, 7); ctx.ellipse(fx + 4, fy - 3, 4, 2, .5 - Math.sin(g.t * 40) * .3, 0, 7); ctx.stroke();
          }
        });
        // lane objects
        for (const [r, L] of Object.entries(g.lanes)) for (const o of L.objs) {
          if (o.x > W || o.x + o.w < 0) continue;
          const y = +r * C;
          if (L.kind === 'log') drawLog(ctx, o.x, y, o.w);
          else if (L.kind === 'turtle') drawTurtles(ctx, o, y, g.t);
          else drawCar(ctx, L.kind, o.x, y, o.w, L.dir);
        }
        if (g.snake) drawSnake(ctx, g.snake, g.t);
        // frog
        const f = g.f, pos = frogPos(g);
        if (f.dead) {
          const k = 1 - f.dead / .9;
          if (f.how === 'splash') { ctx.strokeStyle = INK(.6 * (1 - k)); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pos.x, pos.y, 6 + k * 18, 0, 7); ctx.arc(pos.x, pos.y, 2 + k * 10, 0, 7); ctx.stroke(); }
          else { P.line(pos.x - 12, pos.y - 12, pos.x + 12, pos.y + 12, { w: 3 }); P.line(pos.x + 12, pos.y - 12, pos.x - 12, pos.y + 12, { w: 3 }); }
        } else drawFrog(ctx, pos.x, pos.y, f.face, pos.lift, 1);
        // timer bar
        const tw = 150, tx = W - tw - 12, ty = H - 12;
        ctx.strokeStyle = INK(.5); ctx.lineWidth = 1.4; ctx.strokeRect(tx, ty - 6, tw, 8);
        ctx.fillStyle = INK(g.time < 8 && Math.floor(g.t * 6) % 2 ? .75 : .45); ctx.fillRect(tx + 1, ty - 5, (tw - 2) * clamp(g.time / TIME, 0, 1), 6);
        P.text('time', tx - 8, ty - 2, { size: 18, align: 'right', a: .55 });
        for (let i = 0; i < g.lives - 1 && i < 6; i++) drawFrog(ctx, 18 + i * 24, H - 12, 0, 0, .45);
        for (const t of g.popups) P.text(t.text, t.x, t.y, { size: 22, a: Math.min(.9, t.t) });
        dust.draw(P);
        if (g.banner > 0) P.text(`level ${g.level}`, W / 2, 6.5 * C, { size: 44, a: Math.min(.7, g.banner) });
      },
    });

    function sk(ctx, w, a, path) {
      ctx.lineCap = ctx.lineJoin = 'round';
      ctx.lineWidth = w; ctx.strokeStyle = INK(a); ctx.beginPath(); path(0); ctx.stroke();
      ctx.lineWidth = w * .5; ctx.strokeStyle = INK(a * .5); ctx.beginPath(); path(.8); ctx.stroke();
    }
    function drawFrog(ctx, x, y, face, lift, s) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(face); ctx.scale(s * (1 + lift * .18), s * (1 + lift * .18));
      if (lift > .05) { ctx.fillStyle = INK(.12); ctx.beginPath(); ctx.ellipse(0, 6 + lift * 6, 10, 5, 0, 0, 7); ctx.fill(); }
      const leg = 4 + lift * 7;
      sk(ctx, 2.2, .85, o => {
        ctx.moveTo(-7, -4); ctx.lineTo(-12, -9 - lift * 4); ctx.lineTo(-11 + o, -14 - lift * 3);
        ctx.moveTo(7, -4); ctx.lineTo(12, -9 - lift * 4); ctx.lineTo(11 - o, -14 - lift * 3);
        ctx.moveTo(-7, 5); ctx.lineTo(-14, 6 + leg * .5); ctx.lineTo(-10, 8 + leg);
        ctx.moveTo(7, 5); ctx.lineTo(14, 6 + leg * .5); ctx.lineTo(10, 8 + leg);
        ctx.ellipse(o * .5, 1, 9, 11, 0, 0, 7);
      });
      ctx.fillStyle = INK(.22); ctx.beginPath(); ctx.ellipse(0, 2, 7, 8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#f5f2e9'; ctx.strokeStyle = INK(.85); ctx.lineWidth = 1.6;
      for (const ex of [-5, 5]) { ctx.beginPath(); ctx.arc(ex, -8, 3.6, 0, 7); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = INK(.9); ctx.beginPath(); ctx.arc(-5, -9, 1.5, 0, 7); ctx.arc(5, -9, 1.5, 0, 7); ctx.fill();
      ctx.restore();
    }
    function drawLog(ctx, x, y, w) {
      ctx.fillStyle = 'rgba(245,242,233,.9)'; ctx.beginPath(); ctx.roundRect(x + 2, y + 6, w - 4, C - 12, 12); ctx.fill();
      ctx.fillStyle = INK(.12); ctx.fill();
      sk(ctx, 2, .8, o => { ctx.roundRect(x + 2 + o, y + 6, w - 4, C - 12, 12); });
      ctx.strokeStyle = INK(.4); ctx.lineWidth = 1.1; ctx.beginPath();
      for (let i = 18; i < w - 18; i += 22) { ctx.moveTo(x + i, y + 13); ctx.lineTo(x + i + 14, y + 13); ctx.moveTo(x + i + 8, y + 26); ctx.lineTo(x + i + 20, y + 26); }
      ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x + w - 12, y + C / 2, 4, 8, 0, 0, 7); ctx.ellipse(x + w - 12, y + C / 2, 1.5, 3.5, 0, 0, 7); ctx.stroke();
    }
    function drawTurtles(ctx, o, y, t) {
      const n = Math.round(o.w / C), s = sunk(o), wv = warn(o);
      if (s) {
        ctx.strokeStyle = 'rgba(70,110,160,.5)'; ctx.lineWidth = 1.4; ctx.beginPath();
        for (let i = 0; i < n; i++) ctx.arc(o.x + i * C + C / 2, y + C / 2, 6 + (t * 10 % 6), 0, 7);
        ctx.stroke(); return;
      }
      for (let i = 0; i < n; i++) {
        const cx = o.x + i * C + C / 2, cy = y + C / 2, bob = Math.sin(t * 4 + i) * 1.2;
        ctx.fillStyle = '#f5f2e9'; ctx.beginPath(); ctx.ellipse(cx, cy + bob, 15, 13, 0, 0, 7); ctx.fill();
        ctx.fillStyle = INK(.16); ctx.fill();
        if (wv) ctx.setLineDash([3, 4]);
        sk(ctx, 2, .85, oo => { ctx.ellipse(cx + oo * .4, cy + bob, 15, 13, 0, 0, 7); });
        ctx.setLineDash([]);
        ctx.strokeStyle = INK(.45); ctx.lineWidth = 1.1; ctx.beginPath();
        ctx.moveTo(cx - 7, cy - 6 + bob); ctx.lineTo(cx + 7, cy - 6 + bob); ctx.lineTo(cx + 9, cy + 4 + bob); ctx.lineTo(cx, cy + 9 + bob); ctx.lineTo(cx - 9, cy + 4 + bob); ctx.closePath();
        ctx.stroke();
        ctx.beginPath(); ctx.arc(cx - 18, cy + bob, 4, 0, 7); ctx.stroke();
      }
    }
    function drawCar(ctx, kind, x, y, w, dir) {
      ctx.save(); ctx.translate(x + w / 2, y + C / 2); if (dir < 0) ctx.scale(-1, 1);
      const hw = w / 2 - 3;
      ctx.fillStyle = '#f5f2e9';
      if (kind === 'truck') {
        ctx.fillRect(-hw, -13, w - 18, 26);
        ctx.fillStyle = INK(.14); ctx.fillRect(-hw, -13, w - 18, 26);
        sk(ctx, 2, .85, o => { ctx.rect(-hw + o, -13, w - 18, 26); ctx.rect(hw - 14, -10 + o, 14, 20); ctx.moveTo(hw - 4, -6); ctx.lineTo(hw - 4, 6); });
      } else if (kind === 'tractor') {
        sk(ctx, 2, .85, o => { ctx.rect(-12 + o, -8, 18, 16); ctx.rect(-2, -14, 10, 10); ctx.moveTo(8, -4); ctx.lineTo(14, -4); });
        ctx.fillStyle = INK(.7); ctx.fillRect(-14, -15, 9, 5); ctx.fillRect(-14, 10, 9, 5); ctx.fillRect(6, -12, 6, 4); ctx.fillRect(6, 8, 6, 4);
      } else {
        const lo = kind === 'racer' ? 9 : 11;
        ctx.fillRect(-hw, -lo, w - 6, lo * 2);
        ctx.fillStyle = INK(kind === 'racer' ? .3 : .1); ctx.fillRect(-hw, -lo, w - 6, lo * 2);
        sk(ctx, 2, .85, o => {
          ctx.roundRect(-hw + o, -lo, w - 6, lo * 2, 6);
          ctx.moveTo(2, -lo + 3); ctx.lineTo(8, -lo + 4); ctx.lineTo(8, lo - 4); ctx.lineTo(2, lo - 3);
        });
        ctx.fillStyle = INK(.8); ctx.fillRect(-hw + 4, -lo - 3, 7, 3); ctx.fillRect(hw - 12, -lo - 3, 7, 3); ctx.fillRect(-hw + 4, lo, 7, 3); ctx.fillRect(hw - 12, lo, 7, 3);
        if (kind === 'racer') { ctx.strokeStyle = INK(.35); ctx.lineWidth = 1.4; ctx.beginPath(); for (let i = 0; i < 3; i++) { ctx.moveTo(-hw - 6 - i * 5, -6 + i * 6); ctx.lineTo(-hw - 14 - i * 5, -6 + i * 6); } ctx.stroke(); }
      }
      ctx.restore();
    }
    function drawSnake(ctx, s, t) {
      const y = 6 * C + C / 2;
      sk(ctx, 5, .7, o => {
        for (let i = 0; i <= 12; i++) { const x = s.x - s.dir * i * 5, yy = y + Math.sin(t * 8 - i * .7) * 5 + o; i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
      });
      ctx.fillStyle = INK(.85); ctx.beginPath(); ctx.arc(s.x + s.dir * 3, y + Math.sin(t * 8) * 5, 5, 0, 7); ctx.fill();
    }
  },
});
