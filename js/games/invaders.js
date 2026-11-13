Games.register({
  id: 'invaders',
  title: 'Doodle Invaders',
  blurb: 'Rows of scribbled aliens march down the page. Hide behind eraser bunkers and shoot back.',
  group: 'arcade',
  tags: ['solo', 'classic', 'shooter'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M22 14 h16 v10 h-16 z M18 24 l-4 6 M42 24 l4 6 M26 10 l-3 -5 M34 10 l3 -5"/><path d="M52 14 h16 v10 h-16 z M48 24 l-4 6 M72 24 l4 6" /><path d="M82 14 h16 v10 h-16 z M78 24 l-4 6 M102 24 l4 6"/><path d="M60 36 v10" stroke-dasharray="3 3"/><path d="M30 56 q10 -10 20 0 v6 h-20 z M70 56 q10 -10 20 0 v6 h-20 z" class="fill"/><path d="M50 74 h20 M56 74 v-6 h8 v6 M60 68 v-4"/></svg>`,
  help: 'Move with ←/→ or A/D and shoot with Space (or the fire pad). On touch, hold your finger on the page: the cannon slides under it and fires on its own. Aliens speed up as their numbers shrink and every wave starts lower and shoots more. The eraser bunkers soak up shots from both sides, so they wear away. Shoot the saucer at the top for a mystery bonus. Extra life every 2000 points.',
  mount(root, signal) {
    const W = 720, H = 500, COLS = 11, ROWS = 5, SX = 46, SY = 36, PY = H - 34, SHIELD_Y = H - 116, CELL = 4;
    const dust = Dust();
    const SHIELD = [
      '....##########....',
      '...############...',
      '..##############..',
      '.################.',
      '##################',
      '##################',
      '##################',
      '#####........#####',
      '####..........####',
      '###............###',
    ];
    const POINTS = [30, 20, 20, 10, 10];

    function buildShields(g) {
      g.shields = [];
      const sw = SHIELD[0].length * CELL;
      for (let i = 0; i < 4; i++) {
        const x0 = Math.round(W * (i + 1) / 5 - sw / 2);
        SHIELD.forEach((row, r) => [...row].forEach((ch, c) => {
          if (ch === '#') g.shields.push({ x: x0 + c * CELL, y: SHIELD_Y + r * CELL, a: .45 + Math.random() * .25, on: true });
        }));
      }
    }
    function newWave(g) {
      g.wave++;
      g.aliens = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) g.aliens.push({ r, c, type: r === 0 ? 0 : r < 3 ? 1 : 2, alive: true });
      g.fx = 60; g.fy = 64 + Math.min(6, g.wave - 1) * 14; g.fdir = 1; g.drop = 0; g.walk = 0;
      g.eshots = []; g.shots = []; g.ecd = 1.5;
      buildShields(g);
      if (g.wave > 1) { toast(`Wave ${g.wave}`); g.banner = 1.6; }
      g.info = `wave ${g.wave} · ♥ ${g.lives}`;
    }
    const alienPos = (g, a) => ({ x: g.fx + a.c * SX, y: g.fy + a.r * SY });

    function sketch(ctx, path, w = 2, a = .85) {
      ctx.lineCap = ctx.lineJoin = 'round';
      ctx.lineWidth = w; ctx.strokeStyle = INK(a); ctx.beginPath(); path(ctx, 0); ctx.stroke();
      ctx.lineWidth = w * .55; ctx.strokeStyle = INK(a * .5); ctx.beginPath(); path(ctx, .7); ctx.stroke();
    }
    function drawAlien(ctx, type, x, y, frame, a = .85) {
      ctx.save(); ctx.translate(x, y);
      const f = frame ? 1 : -1;
      if (type === 0) {
        ctx.fillStyle = INK(.14); ctx.beginPath(); ctx.moveTo(-10, 4); ctx.lineTo(0, -11); ctx.lineTo(10, 4); ctx.closePath(); ctx.fill();
        sketch(ctx, (c, o) => {
          c.moveTo(-10 + o, 4); c.lineTo(0, -11 + o); c.lineTo(10 - o, 4); c.closePath();
          c.moveTo(-6, 4); c.lineTo(-8 - f * 3, 11); c.moveTo(0, 4); c.lineTo(f * 2, 11); c.moveTo(6, 4); c.lineTo(8 + f * 3, 11);
        }, 2, a);
      } else if (type === 1) {
        ctx.fillStyle = INK(.12); ctx.fillRect(-11, -6, 22, 12);
        sketch(ctx, (c, o) => {
          c.rect(-11 + o, -6 + o, 22, 12);
          c.moveTo(-6, -6); c.lineTo(-10, -12); c.moveTo(6, -6); c.lineTo(10, -12);
          c.moveTo(-11, 0); c.lineTo(-16, frame ? -7 : 7); c.moveTo(11, 0); c.lineTo(16, frame ? -7 : 7);
          c.moveTo(-6, 6); c.lineTo(-8 + f, 11); c.moveTo(6, 6); c.lineTo(8 - f, 11);
        }, 2, a);
        ctx.strokeStyle = INK(.3); ctx.lineWidth = 1; ctx.beginPath();
        for (let i = -8; i < 10; i += 4) { ctx.moveTo(i, 5); ctx.lineTo(i + 3, -5); }
        ctx.stroke();
      } else {
        ctx.fillStyle = INK(.1); ctx.beginPath(); ctx.ellipse(0, -1, 13, 8, 0, 0, 7); ctx.fill();
        sketch(ctx, (c, o) => {
          c.ellipse(o * .5, -1 + o * .3, 13, 8, 0, 0, 7);
          for (let i = -9; i <= 9; i += 6) { c.moveTo(i, 6); c.quadraticCurveTo(i + f * 3, 9, i - f * 2, 12); }
        }, 2, a);
      }
      ctx.fillStyle = INK(a);
      ctx.beginPath(); ctx.arc(-4, type === 0 ? -1 : -1, 1.8, 0, 7); ctx.arc(4, -1, 1.8, 0, 7); ctx.fill();
      ctx.restore();
    }

    Arcade.mount(root, signal, {
      id: 'invaders', title: 'Doodle Invaders', w: W, h: H,
      intro: 'Shoot every alien before they reach the bottom of the page.',
      keysHelp: '←/→ or A/D move · Space fire · hold a finger on the page to move + auto-fire · P pause',
      pads: [['left', '◀'], ['fire', 'fire'], ['right', '▶']],
      init(g) {
        g.p = { x: W / 2, inv: 0, cd: 0, tilt: 0 };
        g.lives = 3; g.wave = 0; g.nextLife = 2000; g.ufo = null; g.ufoT = 14; g.banner = 0; g.dead = 0; g.popups = [];
        newWave(g);
      },
      update(g, dt) {
        const p = g.p, k = g.keys;
        dust.update(dt);
        g.banner -= dt;
        for (const t of g.popups) { t.t -= dt; t.y -= 20 * dt; }
        g.popups = g.popups.filter(t => t.t > 0);
        if (g.dead > 0) { g.dead -= dt; if (g.dead <= 0) { p.x = W / 2; p.inv = 1.6; } else return; }

        // player
        const dir = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
        const prevX = p.x;
        if (dir) p.x += dir * 330 * dt;
        else if (g.ptr.down) p.x += clamp(g.ptr.x - p.x, -420 * dt, 420 * dt);
        p.x = clamp(p.x, 24, W - 24);
        p.tilt += ((p.x - prevX) / Math.max(dt, 1e-3) / 330 * .12 - p.tilt) * Math.min(1, dt * 12);
        p.inv -= dt; p.cd -= dt;
        if ((k.has('fire') || g.ptr.down) && p.cd <= 0 && g.shots.length < 2) { g.shots.push({ x: p.x, y: PY - 16 }); p.cd = .38; Sfx.tap(); }

        // formation
        const alive = g.aliens.filter(a => a.alive);
        if (!alive.length) { g.score += 100 * g.wave; Sfx.win(); celebrate(8); return newWave(g); }
        const frac = alive.length / g.aliens.length;
        const speed = (22 + (1 - frac) * 150 + (alive.length === 1 ? 120 : 0)) * (1 + (g.wave - 1) * .12);
        if (g.drop > 0) { const d = Math.min(g.drop, 120 * dt); g.fy += d; g.drop -= d; }
        else {
          g.fx += g.fdir * speed * dt; g.walk += speed * dt;
          let minX = 1e9, maxX = -1e9;
          for (const a of alive) { const x = g.fx + a.c * SX; minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
          if (maxX > W - 26 && g.fdir > 0) { g.fx -= maxX - (W - 26); g.fdir = -1; g.drop = 16; }
          if (minX < 26 && g.fdir < 0) { g.fx += 26 - minX; g.fdir = 1; g.drop = 16; }
        }
        let lowest = 0;
        for (const a of alive) {
          const { x, y } = alienPos(g, a);
          lowest = Math.max(lowest, y + 11);
          if (y + 12 > SHIELD_Y) for (const s of g.shields) if (s.on && Math.abs(s.x + 2 - x) < 15 && Math.abs(s.y + 2 - y) < 13) s.on = false;
        }
        if (lowest >= PY - 14) { dust.burst(p.x, PY, 30, 200); return g.end({ win: false, title: 'Invaded!', msg: `They landed on wave ${g.wave}.` }); }

        // enemy fire: bottom-most alien in a random column, aimed loosely at the player
        g.ecd -= dt;
        if (g.ecd <= 0 && g.eshots.length < 2 + Math.floor(g.wave / 2)) {
          g.ecd = Math.max(.25, 1.1 - g.wave * .08) * (.5 + Math.random()) * (.5 + frac * .7);
          const cols = {};
          for (const a of alive) if (!cols[a.c] || cols[a.c].r < a.r) cols[a.c] = a;
          const list = Object.values(cols);
          const near = list.reduce((b, a) => Math.abs(alienPos(g, a).x - p.x) < Math.abs(alienPos(g, b).x - p.x) ? a : b);
          const shooter = Math.random() < .4 ? near : pick(list);
          const pos = alienPos(g, shooter);
          g.eshots.push({ x: pos.x, y: pos.y + 12, v: 200 + g.wave * 14 + Math.random() * 40, kind: rand(2) });
        }

        // UFO
        g.ufoT -= dt;
        if (!g.ufo && g.ufoT <= 0 && alive.length > 6) { const d = Math.random() < .5 ? 1 : -1; g.ufo = { x: d > 0 ? -40 : W + 40, d }; g.ufoT = 18 + Math.random() * 10; }
        if (g.ufo) { g.ufo.x += g.ufo.d * 120 * dt; if (g.ufo.x < -60 || g.ufo.x > W + 60) g.ufo = null; }

        const hitShield = (x, y, big) => {
          for (const s of g.shields) {
            if (!s.on || x < s.x - 1 || x > s.x + CELL + 1 || y < s.y - 2 || y > s.y + CELL + 2) continue;
            for (const o of g.shields) if (o.on && Math.hypot(o.x - s.x, o.y - s.y) < (big ? 10 : 7) * (.6 + Math.random() * .6)) o.on = false;
            dust.burst(x, y, 5, 70); return true;
          }
          return false;
        };

        // player shots
        for (const s of g.shots) {
          const steps = 3;
          for (let i = 0; i < steps && !s.dead; i++) {
            s.y -= 640 * dt / steps;
            if (s.y < 10) { s.dead = true; break; }
            if (hitShield(s.x, s.y, false)) { s.dead = true; break; }
            for (const a of alive) {
              if (!a.alive) continue;
              const pos = alienPos(g, a);
              if (Math.abs(pos.x - s.x) < 14 && Math.abs(pos.y - s.y) < 12) {
                a.alive = false; s.dead = true; g.score += POINTS[a.r]; Sfx.scratch();
                dust.burst(pos.x, pos.y, 14, 140); break;
              }
            }
            if (!s.dead && g.ufo && Math.abs(g.ufo.x - s.x) < 26 && Math.abs(40 - s.y) < 12) {
              const pts = pick([50, 100, 150, 300]);
              g.score += pts; g.popups.push({ x: g.ufo.x, y: 40, text: `+${pts}`, t: 1.2 });
              dust.burst(g.ufo.x, 40, 26, 180); g.ufo = null; s.dead = true; Sfx.good();
            }
            for (const e of g.eshots) if (!e.dead && Math.abs(e.x - s.x) < 6 && Math.abs(e.y - s.y) < 10) { e.dead = s.dead = true; dust.burst(s.x, s.y, 6, 80); }
          }
        }
        g.shots = g.shots.filter(s => !s.dead);

        // enemy shots
        for (const e of g.eshots) {
          e.y += e.v * dt;
          if (e.y > H) e.dead = true;
          else if (hitShield(e.x, e.y + 6, true)) e.dead = true;
          else if (p.inv <= 0 && Math.abs(e.x - p.x) < 18 && e.y + 6 > PY - 10 && e.y < PY + 10) {
            e.dead = true;
            g.lives--; Sfx.bad(); dust.burst(p.x, PY, 36, 220);
            g.info = `wave ${g.wave} · ♥ ${g.lives}`;
            if (g.lives <= 0) return g.end({ win: false, title: 'Cannon down', msg: `You held out until wave ${g.wave}.` });
            g.dead = 1.1; g.eshots = []; g.shots = []; return;
          }
        }
        g.eshots = g.eshots.filter(e => !e.dead);
        if (g.score >= g.nextLife) { g.nextLife += 2000; g.lives++; Sfx.good(); toast('Extra life!'); }
        g.info = `wave ${g.wave} · ♥ ${g.lives}`;
      },
      draw(g, P) {
        const ctx = P.ctx, p = g.p;
        P.paper(W, H);
        P.line(10, PY + 16, W - 10, PY + 16, { w: 2, a: .5 });
        // shields
        for (const s of g.shields) if (s.on) { ctx.fillStyle = INK(s.a); ctx.fillRect(s.x, s.y, CELL + .4, CELL + .4); }
        const frame = Math.floor(g.walk / 18) % 2;
        for (const a of g.aliens) if (a.alive) { const { x, y } = alienPos(g, a); drawAlien(ctx, a.type, x, y, frame); }
        if (g.ufo) {
          const u = g.ufo;
          ctx.save(); ctx.translate(u.x, 40);
          ctx.fillStyle = INK(.15); ctx.beginPath(); ctx.ellipse(0, 0, 24, 7, 0, 0, 7); ctx.fill();
          sketch(ctx, c => { c.ellipse(0, 0, 24, 7, 0, 0, 7); c.moveTo(-10, -4); c.quadraticCurveTo(0, -18, 10, -4); });
          ctx.fillStyle = INK(.8);
          for (let i = -16; i <= 16; i += 8) { ctx.beginPath(); ctx.arc(i, 1, 1.6 + (Math.floor(g.t * 8 + i) % 2), 0, 7); ctx.fill(); }
          ctx.restore();
        }
        ctx.lineCap = 'round';
        for (const s of g.shots) { ctx.strokeStyle = INK(.9); ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, s.y + 12); ctx.stroke(); }
        for (const e of g.eshots) {
          ctx.strokeStyle = INK(.85); ctx.lineWidth = 2; ctx.beginPath();
          if (e.kind) { const w = Math.sin(g.t * 30) * 3; ctx.moveTo(e.x - w, e.y - 6); ctx.lineTo(e.x + w, e.y - 2); ctx.lineTo(e.x - w, e.y + 2); ctx.lineTo(e.x + w, e.y + 6); }
          else { ctx.moveTo(e.x, e.y - 6); ctx.lineTo(e.x, e.y + 6); ctx.moveTo(e.x - 3, e.y + (Math.floor(g.t * 12) % 2 ? -2 : 2)); ctx.lineTo(e.x + 3, e.y + (Math.floor(g.t * 12) % 2 ? 2 : -2)); }
          ctx.stroke();
        }
        if (g.dead <= 0 && !(p.inv > 0 && Math.floor(g.t * 14) % 2)) {
          ctx.save(); ctx.translate(p.x, PY); ctx.rotate(p.tilt);
          ctx.fillStyle = INK(.18); ctx.fillRect(-20, -2, 40, 12);
          sketch(ctx, (c, o) => { c.rect(-20 + o, -2, 40, 12); c.moveTo(-12, -2); c.lineTo(-8, -9 + o); c.lineTo(8, -9); c.lineTo(12, -2); c.moveTo(0, -9); c.lineTo(o, -18); }, 2.2);
          ctx.restore();
        }
        for (const t of g.popups) P.text(t.text, t.x, t.y, { size: 26, a: Math.min(.9, t.t) });
        dust.draw(P);
        for (let i = 0; i < g.lives - 1 && i < 6; i++) { ctx.save(); ctx.translate(30 + i * 30, H - 6); ctx.scale(.45, .45); sketch(ctx, c => { c.rect(-20, -2, 40, 12); c.moveTo(-12, -2); c.lineTo(-8, -9); c.lineTo(8, -9); c.lineTo(12, -2); c.moveTo(0, -9); c.lineTo(0, -18); }, 2.4, .6); ctx.restore(); }
        if (g.banner > 0) P.text(`wave ${g.wave}`, W / 2, H / 2 + 20, { size: 46, a: Math.min(.6, g.banner) });
      },
    });
  },
});
