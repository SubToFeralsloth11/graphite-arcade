Games.register({
  id: 'defense',
  title: 'Margin Defense',
  blurb: 'Doodles are marching down the margin. Build and upgrade pencil towers to stop every wave.',
  group: 'arcade',
  tags: ['solo', 'strategy', 'waves'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M0 20 H40 V60 H80 V20 H120" stroke-width="10" stroke-opacity=".25"/><path d="M0 20 H40 V60 H80 V20 H120" stroke-dasharray="4 5"/><rect x="50" y="22" width="16" height="16"/><path d="M58 30 L74 22 M71 20 l6 0 l-2 5"/><circle cx="96" cy="44" r="7"/><circle cx="18" cy="20" r="6" class="fill"/><circle cx="40" cy="44" r="5" class="fill"/></svg>`,
  help: 'Doodles walk the dashed path; each one that reaches the end costs a heart (big ones cost more). Pick a tower in the sidebar (or press 1-4) and click empty squares to build it. Pencils fire quick darts, Erasers slow and nibble everything close by, Ink pots lob splashy blots, and Rulers snipe from far away. Click a tower to see its range, then upgrade it (U) or sell it back for 60% (X). Between waves you can press Space or "send" to start early for bonus gold. » (or F) doubles the game speed. Every fifth wave brings a boss.',
  mount(root, signal) {
    const dust = Dust();
    const W = 720, H = 420, C = 30, FW = 600, COLS = 20, ROWS = 14, TAU = Math.PI * 2;
    const MAPS = [
      [[-1, 2], [4, 2], [4, 10], [9, 10], [9, 3], [14, 3], [14, 11], [18, 11], [18, 14]],
      [[-1, 7], [3, 7], [3, 2], [8, 2], [8, 11], [13, 11], [13, 5], [17, 5], [17, -1]],
      [[-1, 11], [5, 11], [5, 5], [2, 5], [2, 1], [10, 1], [10, 9], [15, 9], [15, 3], [18, 3], [18, 14]],
    ];
    const TOWERS = [
      { id: 'pencil', name: 'Pencil', cost: 50, range: 100, rate: .55, dmg: 9 },
      { id: 'eraser', name: 'Eraser', cost: 70, range: 72, rate: 1.1, dmg: 4 },
      { id: 'ink', name: 'Ink pot', cost: 110, range: 108, rate: 1.7, dmg: 24, splash: 46 },
      { id: 'ruler', name: 'Ruler', cost: 160, range: 210, rate: 2.2, dmg: 80 },
    ];
    const FOES = {
      blob: { hp: 30, speed: 46, gold: 5, pts: 10, r: 10, leak: 1 },
      runner: { hp: 18, speed: 92, gold: 4, pts: 12, r: 8, leak: 1 },
      brute: { hp: 130, speed: 30, gold: 12, pts: 30, r: 13, leak: 2 },
      boss: { hp: 500, speed: 24, gold: 100, pts: 300, r: 20, leak: 10 },
    };
    const MAXLVL = 4;
    const stat = t => {
      const T = TOWERS[t.type], l = t.lvl - 1;
      return { range: T.range * (1 + .12 * l), dmg: T.dmg * (1 + .65 * l), rate: T.rate * (1 - .12 * l), slow: .55 - .07 * l, splash: T.splash };
    };
    const upCost = t => Math.round(TOWERS[t.type].cost * .75 * t.lvl);
    const hpMul = w => 1 + (w - 1) * .22 + (w - 1) ** 2 * .012;
    const info = g => `wave ${g.wave} · ♥ ${g.lives} · $${g.gold}`;

    const BTN = TOWERS.map((_, i) => ({ x: FW + 8, y: 50 + i * 56, w: 104, h: 50 }));
    const UP = { x: FW + 8, y: 300, w: 104, h: 30 }, SELL = { x: FW + 8, y: 336, w: 104, h: 30 };
    const SEND = { x: FW + 8, y: 378, w: 70, h: 34 }, FAST = { x: FW + 82, y: 378, w: 30, h: 34 };
    const inBox = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

    function buildPath(g, map) {
      g.pts = map.map(([cx, cy]) => [cx * C + C / 2, cy * C + C / 2]);
      g.segs = []; let total = 0;
      for (let i = 1; i < g.pts.length; i++) {
        const [ax, ay] = g.pts[i - 1], [bx, by] = g.pts[i], len = Math.hypot(bx - ax, by - ay);
        g.segs.push({ ax, ay, bx, by, len, start: total }); total += len;
      }
      g.total = total;
      g.path = new Set();
      for (let i = 1; i < map.length; i++) {
        const [ax, ay] = map[i - 1], [bx, by] = map[i], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
        for (let s = 0; s <= n; s++) {
          const cx = ax + Math.sign(bx - ax) * s, cy = ay + Math.sign(by - ay) * s;
          if (cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS) g.path.add(cx + ',' + cy);
        }
      }
    }
    function posAt(g, d) {
      for (const s of g.segs) if (d <= s.start + s.len) { const f = (d - s.start) / s.len; return [s.ax + (s.bx - s.ax) * f, s.ay + (s.by - s.ay) * f, Math.atan2(s.by - s.ay, s.bx - s.ax)]; }
      const s = g.segs[g.segs.length - 1];
      return [s.bx, s.by, 0];
    }

    function makeWave(w) {
      const q = [], n = 8 + Math.floor(w * 1.6), rush = w % 4 === 2, pace = Math.max(.5, 1 - w * .02);
      for (let i = 0; i < n; i++) {
        let type = 'blob';
        if (rush) type = 'runner';
        else if (w >= 4 && i % 5 === 4) type = 'brute';
        else if (w >= 3 && i % 3 === 2) type = 'runner';
        q.push({ type, gap: (type === 'runner' ? .45 : type === 'brute' ? 1.1 : .75) * pace });
      }
      if (w % 5 === 0) q.push({ type: 'boss', gap: 1.5 });
      return q;
    }

    function sendWave(g) {
      if (g.phase !== 'build') return;
      if (g.wave > 0 && g.timer > 1) { const b = Math.ceil(g.timer); g.gold += b; pop(g, FW / 2, 30, `early +$${b}`); }
      g.wave++; g.phase = 'wave'; g.queue = makeWave(g.wave); g.spawnT = 0;
      if (g.wave % 5 === 0) toast('Boss wave!'); else Sfx.scratch();
      g.info = info(g);
    }

    function pop(g, x, y, s) { g.pops.push({ x, y, s, life: 1 }); }

    function damage(g, e, n) {
      if (e.dead) return;
      e.hp -= n; e.flash = .08;
      if (e.hp > 0) return;
      const F = FOES[e.type];
      e.dead = true; g.gold += F.gold; g.score += F.pts; g.kills++;
      dust.burst(e.x, e.y, e.type === 'boss' ? 40 : 10, e.type === 'boss' ? 220 : 110);
      pop(g, e.x, e.y - 10, `+$${F.gold}`);
      if (e.type === 'boss') Sfx.good();
      g.info = info(g);
    }

    function inRange(g, t, r) {
      let best = null;
      for (const e of g.foes) if (!e.dead && (e.x - t.x) ** 2 + (e.y - t.y) ** 2 <= r * r && (!best || e.d > best.d)) best = e;
      return best;
    }

    function towerAt(g, cx, cy) { return g.towers.find(t => t.cx === cx && t.cy === cy); }

    function handleInput(g) {
      const pr = g.pressed;
      TOWERS.forEach((T, i) => { if (pr.has('Digit' + (i + 1))) { g.build = g.build === i ? null : i; g.sel = null; } });
      if (pr.has('fire')) sendWave(g);
      if (pr.has('KeyF')) g.fast = !g.fast;
      if (pr.has('KeyU')) upgrade(g);
      if (pr.has('KeyX')) sell(g);
      if (!pr.has('tap')) return;
      const { x, y } = g.ptr;
      if (x >= FW) {
        BTN.forEach((b, i) => { if (inBox(b, x, y)) { g.build = g.build === i ? null : i; g.sel = null; Sfx.tap(); } });
        if (g.sel && inBox(UP, x, y)) upgrade(g);
        if (g.sel && inBox(SELL, x, y)) sell(g);
        if (inBox(SEND, x, y)) sendWave(g);
        if (inBox(FAST, x, y)) { g.fast = !g.fast; Sfx.tap(); }
        return;
      }
      const cx = Math.floor(x / C), cy = Math.floor(y / C), t = towerAt(g, cx, cy);
      if (t) { g.sel = g.sel === t ? null : t; g.build = null; Sfx.tap(); return; }
      if (g.build != null && !g.path.has(cx + ',' + cy)) {
        const T = TOWERS[g.build];
        if (g.gold < T.cost) { Sfx.bad(); toast('Not enough gold'); return; }
        g.gold -= T.cost;
        g.towers.push({ type: g.build, cx, cy, x: cx * C + C / 2, y: cy * C + C / 2, lvl: 1, cd: 0, ang: -Math.PI / 2, spent: T.cost, kick: 0 });
        dust.burst(cx * C + C / 2, cy * C + C / 2, 10, 90); Sfx.good();
        g.info = info(g);
        return;
      }
      g.sel = null;
    }

    function upgrade(g) {
      const t = g.sel;
      if (!t || t.lvl >= MAXLVL) return;
      const c = upCost(t);
      if (g.gold < c) { Sfx.bad(); toast('Not enough gold'); return; }
      g.gold -= c; t.spent += c; t.lvl++; Sfx.good(); dust.burst(t.x, t.y, 12, 100);
      g.info = info(g);
    }
    function sell(g) {
      const t = g.sel;
      if (!t) return;
      const back = Math.round(t.spent * .6);
      g.gold += back; g.towers.splice(g.towers.indexOf(t), 1); g.sel = null;
      pop(g, t.x, t.y, `+$${back}`); dust.burst(t.x, t.y, 14, 120); Sfx.scratch();
      g.info = info(g);
    }

    function step(g, dt) {
      dust.update(dt);
      if (g.phase === 'build') { if ((g.timer -= dt) <= 0) sendWave(g); }
      else if (g.queue.length && (g.spawnT -= dt) <= 0) {
        const { type, gap } = g.queue.shift(), F = FOES[type], hp = Math.round(F.hp * hpMul(g.wave));
        g.foes.push({ type, d: 0, hp, max: hp, speed: F.speed * (1 + g.wave * .012), r: F.r, slowT: 0, slowF: 1, x: -20, y: 0, ang: 0, flash: 0, bob: Math.random() * 6 });
        g.spawnT = gap;
      }

      for (const e of g.foes) {
        e.slowT -= dt; e.flash -= dt;
        e.d += e.speed * (e.slowT > 0 ? e.slowF : 1) * dt;
        [e.x, e.y, e.ang] = posAt(g, e.d);
        if (e.d >= g.total && !e.dead) {
          e.dead = true; e.leaked = true;
          g.lives = Math.max(0, g.lives - FOES[e.type].leak); Sfx.bad();
          g.info = info(g);
          if (g.lives <= 0) return g.end({ win: false, title: 'Overrun', msg: `You held the margin until wave ${g.wave} and erased ${g.kills} doodles.` });
        }
      }

      for (const t of g.towers) {
        const s = stat(t), T = TOWERS[t.type];
        t.cd -= dt; t.kick = Math.max(0, t.kick - dt * 5);
        const e = inRange(g, t, s.range);
        if (e && T.id !== 'eraser') t.ang = Math.atan2(e.y - t.y, e.x - t.x);
        if (!e || t.cd > 0) continue;
        t.cd = s.rate; t.kick = 1;
        if (T.id === 'pencil') g.shots.push({ x: t.x, y: t.y, tgt: e, tx: e.x, ty: e.y, dmg: s.dmg });
        else if (T.id === 'ruler') { damage(g, e, s.dmg); g.beams.push({ x0: t.x, y0: t.y, x1: e.x, y1: e.y, life: .18 }); Sfx.tap(); }
        else if (T.id === 'ink') g.blobs.push({ x0: t.x, y0: t.y, x1: e.x, y1: e.y, t: 0, dur: .55, dmg: s.dmg, splash: s.splash });
        else {
          for (const f of g.foes) if (!f.dead && (f.x - t.x) ** 2 + (f.y - t.y) ** 2 <= s.range * s.range) { damage(g, f, s.dmg); f.slowF = f.slowT > 0 ? Math.min(f.slowF, s.slow) : s.slow; f.slowT = 1.2; }
          g.rings.push({ x: t.x, y: t.y, r: s.range, life: .35 });
        }
      }

      for (const s of g.shots) {
        if (!s.tgt.dead) { s.tx = s.tgt.x; s.ty = s.tgt.y; }
        const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy), mv = 480 * dt;
        s.ang = Math.atan2(dy, dx);
        if (d <= mv + 4) { s.done = true; if (!s.tgt.dead) damage(g, s.tgt, s.dmg); }
        else { s.x += dx / d * mv; s.y += dy / d * mv; }
      }
      g.shots = g.shots.filter(s => !s.done);
      for (const b of g.blobs) {
        b.t += dt;
        if (b.t >= b.dur) {
          b.done = true;
          for (const e of g.foes) if (!e.dead && (e.x - b.x1) ** 2 + (e.y - b.y1) ** 2 <= (b.splash + e.r) ** 2) damage(g, e, b.dmg);
          g.stains.push({ x: b.x1, y: b.y1, r: b.splash * .55, life: 5, rot: Math.random() * 6 });
          if (g.stains.length > 30) g.stains.shift();
          dust.burst(b.x1, b.y1, 10, 100);
        }
      }
      g.blobs = g.blobs.filter(b => !b.done);
      for (const list of [g.beams, g.rings, g.stains, g.pops]) for (const v of list) v.life -= dt;
      g.beams = g.beams.filter(v => v.life > 0); g.rings = g.rings.filter(v => v.life > 0);
      g.stains = g.stains.filter(v => v.life > 0); g.pops = g.pops.filter(v => v.life > 0);
      for (const p of g.pops) p.y -= 30 * dt;
      g.foes = g.foes.filter(e => !e.dead);

      if (g.phase === 'wave' && !g.queue.length && !g.foes.length) {
        const bonus = 15 + g.wave * 4;
        g.gold += bonus; g.score += 25 * g.wave; g.phase = 'build'; g.timer = 12;
        toast(`Wave ${g.wave} held! +$${bonus}`); Sfx.good();
        g.info = info(g);
      }
    }

    function drawTower(P, g, t, ghost) {
      const ctx = P.ctx, T = TOWERS[t.type], o = ghost ? { a: .35 } : {};
      ctx.save(); ctx.translate(t.x, t.y);
      if (!ghost) { ctx.fillStyle = '#f5f2e9'; ctx.fillRect(-13, -13, 26, 26); }
      if (T.id === 'pencil') {
        P.rect(-11, -11, 22, 22, { w: 1.8, ...o });
        ctx.rotate(t.ang);
        const k = t.kick * 3;
        P.rect(-9 - k, -4, 15, 8, { w: 1.8, ...o });
        P.poly([[6 - k, -4], [14 - k, 0], [6 - k, 4]], { w: 1.8, ...o });
        P.line(-9 - k, -1, 6 - k, -1, { w: 1, a: .4 });
      } else if (T.id === 'eraser') {
        P.rect(-12, -9, 24, 18, { w: 2, ...o });
        P.hatchRect(-12, -9, 11, 18, { a: ghost ? .2 : .5, gap: 3 });
        P.line(-1, -9, -1, 9, { w: 1.6, ...o });
      } else if (T.id === 'ink') {
        P.circle(0, 0, 11, { w: 2, ...o });
        P.hatchCircle(0, 0, 7, { a: ghost ? .3 : .85, gap: 2 });
        P.line(-8, -10, 8, -10, { w: 2.4, ...o });
      } else {
        P.circle(0, 0, 8, { w: 1.8, ...o });
        ctx.rotate(t.ang);
        P.rect(-6, -3.5, 28, 7, { w: 1.8, ...o });
        for (let i = 0; i < 6; i++) P.line(-2 + i * 4, -3.5, -2 + i * 4, i % 2 ? -1 : .5, { w: 1, a: .55 });
      }
      ctx.restore();
      ctx.fillStyle = INK(.8);
      for (let i = 1; i < t.lvl; i++) { ctx.beginPath(); ctx.arc(t.x - (t.lvl - 2) * 4 + (i - 1) * 8, t.y + 12, 2.2, 0, TAU); ctx.fill(); }
    }

    function drawFoe(P, g, e) {
      const ctx = P.ctx, bob = Math.sin(g.t * 9 + e.bob) * 1.5;
      ctx.save(); ctx.translate(e.x, e.y + bob);
      if (e.slowT > 0) { ctx.strokeStyle = INK(.35); ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.arc(0, 0, e.r + 5, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = e.flash > 0 ? INK(.35) : '#f5f2e9';
      if (e.type === 'runner') {
        ctx.rotate(e.ang);
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-7, -7); ctx.lineTo(-7, 7); ctx.fill();
        P.poly([[10, 0], [-7, -7], [-7, 7]], { w: 2 });
        P.line(-9, -3, -15, -3, { w: 1.2, a: .5 }); P.line(-9, 3, -15, 3, { w: 1.2, a: .5 });
      } else if (e.type === 'brute') {
        ctx.fillRect(-13, -13, 26, 26);
        P.rect(-13, -13, 26, 26, { w: 2.4 });
        P.hatchRect(-13, -13, 26, 26, { a: .45, gap: 4, cross: true });
        ctx.fillStyle = '#f5f2e9'; ctx.fillRect(-8, -6, 5, 5); ctx.fillRect(3, -6, 5, 5);
      } else {
        const r = e.r;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
        P.circle(0, 0, r, { w: e.type === 'boss' ? 3 : 2 });
        P.hatchCircle(0, 0, r - 1, { a: e.type === 'boss' ? .4 : .2, gap: e.type === 'boss' ? 3 : 5, cross: e.type === 'boss' });
        ctx.fillStyle = INK(.9);
        const ex = r * .35, ey = -r * .2;
        ctx.beginPath(); ctx.arc(-ex, ey, r * .14, 0, TAU); ctx.arc(ex, ey, r * .14, 0, TAU); ctx.fill();
        if (e.type === 'boss') P.poly([[-12, -r + 2], [-12, -r - 12], [-6, -r - 5], [0, -r - 14], [6, -r - 5], [12, -r - 12], [12, -r + 2]], { w: 2, closed: false });
      }
      ctx.restore();
      if (e.hp < e.max) {
        const w = e.r * 2 + 4;
        ctx.fillStyle = INK(.15); ctx.fillRect(e.x - w / 2, e.y - e.r - 9, w, 4);
        ctx.fillStyle = INK(.75); ctx.fillRect(e.x - w / 2, e.y - e.r - 9, w * Math.max(0, e.hp / e.max), 4);
      }
    }

    function button(P, b, label, { on = false, off = false, size = 20 } = {}) {
      const ctx = P.ctx;
      ctx.fillStyle = '#f5f2e9'; ctx.fillRect(b.x, b.y, b.w, b.h);
      if (on) P.hatchRect(b.x, b.y, b.w, b.h, { a: .2, gap: 5 });
      P.rect(b.x, b.y, b.w, b.h, { w: on ? 2.6 : 1.6, a: off ? .35 : .85 });
      P.text(label, b.x + b.w / 2, b.y + b.h / 2 + 1, { size, a: off ? .35 : .9 });
    }

    Arcade.mount(root, signal, {
      id: 'defense', title: 'Margin Defense', w: W, h: H,
      intro: 'Build towers beside the path. Do not let the doodles reach the end.',
      keysHelp: 'Click to build/select · 1-4 pick tower · U upgrade · X sell · Space send wave · F fast · P pause',
      init(g) {
        buildPath(g, pick(MAPS));
        g.gold = 120; g.lives = 20; g.wave = 0; g.kills = 0; g.phase = 'build'; g.timer = 25; g.queue = [];
        g.towers = []; g.foes = []; g.shots = []; g.blobs = []; g.beams = []; g.rings = []; g.stains = []; g.pops = [];
        g.build = 0; g.sel = null; g.fast = false;
        g.info = info(g);
      },
      update(g, dt) {
        handleInput(g);
        step(g, dt);
        if (g.fast && g.lives > 0) step(g, dt);
      },
      draw(g, P) {
        const ctx = P.ctx;
        P.paper(W, H, { ruled: false });
        ctx.strokeStyle = 'rgba(70,110,160,.09)'; ctx.lineWidth = 1; ctx.beginPath();
        for (let x = C; x < FW; x += C) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
        for (let y = C; y < H; y += C) { ctx.moveTo(0, y); ctx.lineTo(FW, y); }
        ctx.stroke();

        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, FW, H); ctx.clip();
        ctx.lineJoin = ctx.lineCap = 'round';
        const trace = () => { ctx.beginPath(); g.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); };
        trace(); ctx.strokeStyle = INK(.7); ctx.lineWidth = 28; ctx.stroke();
        trace(); ctx.strokeStyle = '#efebe0'; ctx.lineWidth = 24; ctx.stroke();
        trace(); ctx.strokeStyle = INK(.22); ctx.lineWidth = 1.6; ctx.setLineDash([6, 8]); ctx.stroke(); ctx.setLineDash([]);
        for (const s of g.stains) {
          ctx.fillStyle = INK(Math.min(.3, s.life * .1));
          ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * .7, s.rot, 0, TAU); ctx.fill();
        }
        ctx.restore();
        const [sx, sy] = g.pts[0], [ex, ey] = g.pts[g.pts.length - 1];
        P.text('start', clamp(sx, 26, FW - 26), clamp(sy, 12, H - 12) + (sy < 0 ? 10 : 0), { size: 18, a: .55 });
        P.text('end', clamp(ex, 20, FW - 20), clamp(ey, 12, H - 12) + (ey > H ? -12 : ey < 0 ? 12 : 0), { size: 18, a: .55 });

        if (g.sel) { ctx.fillStyle = INK(.05); ctx.beginPath(); ctx.arc(g.sel.x, g.sel.y, stat(g.sel).range, 0, TAU); ctx.fill(); P.circle(g.sel.x, g.sel.y, stat(g.sel).range, { w: 1.4, a: .45 }); }
        for (const t of g.towers) drawTower(P, g, t, false);
        for (const r of g.rings) P.circle(r.x, r.y, r.r * (1 - r.life / .35 * .6), { w: 1.4, a: r.life * 1.6 });
        for (const e of g.foes) drawFoe(P, g, e);

        ctx.strokeStyle = INK(.9); ctx.lineWidth = 2;
        for (const s of g.shots) { const c = Math.cos(s.ang) * 6, d = Math.sin(s.ang) * 6; ctx.beginPath(); ctx.moveTo(s.x - c, s.y - d); ctx.lineTo(s.x + c, s.y + d); ctx.stroke(); }
        for (const b of g.blobs) {
          const f = b.t / b.dur, x = b.x0 + (b.x1 - b.x0) * f, y = b.y0 + (b.y1 - b.y0) * f - Math.sin(f * Math.PI) * 40;
          ctx.fillStyle = INK(.85); ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
        }
        for (const b of g.beams) { ctx.strokeStyle = INK(b.life * 4); ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1, b.y1); ctx.stroke(); }
        dust.draw(P);
        for (const p of g.pops) P.text(p.s, p.x, p.y, { size: 18, a: Math.min(.9, p.life * 1.5) });

        const { x: mx, y: my } = g.ptr;
        if (g.build != null && mx < FW) {
          const cx = Math.floor(mx / C), cy = Math.floor(my / C), ok = cx >= 0 && cy >= 0 && cy < ROWS && !g.path.has(cx + ',' + cy) && !towerAt(g, cx, cy);
          const ghost = { type: g.build, x: cx * C + C / 2, y: cy * C + C / 2, lvl: 1, ang: -Math.PI / 2, kick: 0 };
          if (ok) { P.circle(ghost.x, ghost.y, TOWERS[g.build].range, { w: 1.2, a: .3 }); drawTower(P, g, ghost, true); }
          else { P.line(ghost.x - 8, ghost.y - 8, ghost.x + 8, ghost.y + 8, { a: .4 }); P.line(ghost.x + 8, ghost.y - 8, ghost.x - 8, ghost.y + 8, { a: .4 }); }
        }

        P.shade(FW, 0, W - FW, H, .04);
        P.line(FW, 0, FW, H, { w: 2.4 });
        P.text(`$${g.gold}`, FW + 10, 18, { size: 24, align: 'left' });
        P.text(`♥ ${g.lives}`, W - 10, 18, { size: 22, align: 'right' });
        TOWERS.forEach((T, i) => {
          const b = BTN[i], off = g.gold < T.cost;
          ctx.fillStyle = '#f5f2e9'; ctx.fillRect(b.x, b.y, b.w, b.h);
          if (g.build === i) P.hatchRect(b.x, b.y, b.w, b.h, { a: .18, gap: 5 });
          P.rect(b.x, b.y, b.w, b.h, { w: g.build === i ? 2.6 : 1.5, a: off ? .4 : .85 });
          drawTower(P, g, { type: i, x: b.x + 20, y: b.y + b.h / 2, lvl: 1, ang: -Math.PI / 4, kick: 0 }, off);
          P.text(T.name, b.x + 40, b.y + 17, { size: 18, align: 'left', a: off ? .4 : .9 });
          P.text(`$${T.cost}  ${i + 1}`, b.x + 40, b.y + 36, { size: 16, align: 'left', a: off ? .35 : .6 });
        });
        if (g.sel) {
          const t = g.sel, max = t.lvl >= MAXLVL, c = upCost(t);
          P.text(`${TOWERS[t.type].name} lv ${t.lvl}`, FW + 60, 284, { size: 18 });
          button(P, UP, max ? 'max level' : `upgrade $${c}`, { off: max || g.gold < c, size: 17 });
          button(P, SELL, `sell $${Math.round(t.spent * .6)}`, { size: 17 });
        } else if (g.build != null) {
          const T = TOWERS[g.build], desc = ['quick darts', 'slows nearby', 'splash blots', 'long snipe'][g.build];
          P.text(desc, FW + 60, 290, { size: 18, a: .6 });
          P.text(`range ${T.range}`, FW + 60, 312, { size: 16, a: .5 });
        }
        button(P, SEND, g.phase === 'build' ? `send ${Math.ceil(g.timer)}` : `wave ${g.wave}`, { off: g.phase !== 'build', size: 18 });
        button(P, FAST, '»', { on: g.fast, size: 22 });
      },
    });
  },
});
