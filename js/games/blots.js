Games.register({
  id: 'blots',
  title: 'Ink Blots',
  blurb: 'Pilot a doodled rocket and blast drifting ink blots into smaller splats.',
  group: 'arcade',
  tags: ['solo', 'shooter', 'classic'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M30 50 l10 -24 l10 24 l-10 -6 z"/><path d="M40 20 v-8" stroke-dasharray="3 4"/><path d="M80 20 q10 -8 18 2 q8 10 -2 18 q-12 6 -18 -4 q-6 -10 2 -16 z" class="fill"/><path d="M90 60 q6 -4 10 2 q2 8 -6 8 q-8 -2 -4 -10 z" class="fill"/></svg>`,
  help: '←/→ (or A/D) rotate, ↑/W thrust, Space fires. The page wraps around at the edges. Big blots split into smaller ones when shot. Clear the page to get a new one with more blots. On touch screens use the pads under the page.',
  mount(root, signal) {
    const dust = Dust();
    const wrapPos = (o, W, H) => { o.x = (o.x + W) % W; o.y = (o.y + H) % H; };
    function blot(g, size, x, y) {
      const r = [0, 14, 26, 42][size], sp = (70 + Math.random() * 60) * (4 - size) * .5 + g.level * 5, a = Math.random() * 6.28;
      const shape = Array.from({ length: 11 }, () => .75 + Math.random() * .4);
      return { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r, size, shape, rot: Math.random() * 6, spin: (Math.random() - .5) * 1.2 };
    }
    function page(g) {
      g.blots = [];
      for (let i = 0; i < 2 + g.level; i++) {
        let x, y; do { x = rand(g.W); y = rand(g.H); } while (Math.hypot(x - g.ship.x, y - g.ship.y) < 160);
        g.blots.push(blot(g, 3, x, y));
      }
    }
    Arcade.mount(root, signal, {
      id: 'blots', title: 'Ink Blots', h: 440,
      intro: 'Shoot the blots. Big ones split. The edges wrap around.',
      keysHelp: '←/→ rotate · ↑ thrust · Space fire · P pause',
      pads: [['left', '⟲'], ['up', 'thrust'], ['right', '⟳'], ['fire', 'fire']],
      init(g) {
        g.ship = { x: g.W / 2, y: g.H / 2, a: -Math.PI / 2, vx: 0, vy: 0, inv: 2, cd: 0 };
        g.level = 1; g.lives = 3; g.shots = []; page(g); g.info = 'page 1 · ♥ 3'; g.ufoT = 20; g.ufo = null;
      },
      update(g, dt) {
        const s = g.ship, k = g.keys;
        const rot = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
        s.a += rot * 4.2 * dt;
        s.thrust = k.has('up');
        if (s.thrust) { s.vx += Math.cos(s.a) * 340 * dt; s.vy += Math.sin(s.a) * 340 * dt; }
        const sp = Math.hypot(s.vx, s.vy); if (sp > 360) { s.vx *= 360 / sp; s.vy *= 360 / sp; }
        s.vx *= Math.pow(.6, dt); s.vy *= Math.pow(.6, dt);
        s.x += s.vx * dt; s.y += s.vy * dt; wrapPos(s, g.W, g.H);
        s.inv -= dt; s.cd -= dt;
        if (k.has('fire') && s.cd <= 0 && g.shots.length < 8) {
          s.cd = .2; Sfx.tap();
          g.shots.push({ x: s.x + Math.cos(s.a) * 16, y: s.y + Math.sin(s.a) * 16, vx: Math.cos(s.a) * 560 + s.vx, vy: Math.sin(s.a) * 560 + s.vy, life: .85 });
        }
        for (const b of g.shots) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; wrapPos(b, g.W, g.H); }
        const born = [];
        for (const o of g.blots) {
          o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.spin * dt; wrapPos(o, g.W, g.H);
          for (const b of g.shots) {
            if (b.life <= 0 || Math.hypot(b.x - o.x, b.y - o.y) > o.r) continue;
            b.life = 0; o.dead = true; Sfx.scratch(); dust.burst(o.x, o.y, o.size * 8, 150);
            g.score += [0, 100, 50, 20][o.size];
            if (o.size > 1) born.push(blot(g, o.size - 1, o.x, o.y), blot(g, o.size - 1, o.x, o.y));
            break;
          }
          if (!o.dead && s.inv <= 0 && Math.hypot(s.x - o.x, s.y - o.y) < o.r + 10) crash(g);
        }
        g.blots = g.blots.filter(o => !o.dead).concat(born);
        g.shots = g.shots.filter(b => b.life > 0);
        // a scribble saucer drops by now and then
        if (!g.ufo && (g.ufoT -= dt) <= 0) { const left = Math.random() < .5; g.ufo = { x: left ? -30 : g.W + 30, y: 40 + rand(g.H - 80), vx: left ? 110 : -110, cd: 1.5, t: 0 }; }
        if (g.ufo) {
          const u = g.ufo; u.x += u.vx * dt; u.t += dt; u.y += Math.sin(u.t * 2) * 40 * dt; u.cd -= dt;
          if (u.cd <= 0) { u.cd = 1.4; const a = Math.atan2(s.y - u.y, s.x - u.x) + (Math.random() - .5) * .4; g.shots.push({ x: u.x, y: u.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, life: 1.6, foe: true }); }
          for (const b of g.shots) if (!b.foe && b.life > 0 && Math.abs(b.x - u.x) < 22 && Math.abs(b.y - u.y) < 12) { b.life = 0; u.dead = true; g.score += 300; Sfx.good(); dust.burst(u.x, u.y, 30, 200); }
          if (u.dead || u.x < -60 || u.x > g.W + 60) { g.ufo = null; g.ufoT = 15 + rand(15); }
        }
        for (const b of g.shots) if (b.foe && s.inv <= 0 && Math.hypot(b.x - s.x, b.y - s.y) < 12) { b.life = 0; crash(g); }
        if (!g.blots.length) { g.level++; g.score += 200; toast(`Page ${g.level}`); Sfx.win(); page(g); s.inv = 2; }
        g.info = `page ${g.level} · ♥ ${g.lives}`;
        dust.update(dt);
        function crash() {
          if (s.inv > 0) return;
          g.lives--; Sfx.bad(); dust.burst(s.x, s.y, 30, 220);
          if (g.lives <= 0) return g.end({ win: false, title: 'Splat', msg: `You reached page ${g.level}.` });
          Object.assign(s, { x: g.W / 2, y: g.H / 2, vx: 0, vy: 0, inv: 2.5 });
        }
      },
      draw(g, P) {
        const ctx = P.ctx, s = g.ship;
        P.paper(g.W, g.H);
        for (const o of g.blots) {
          const pts = o.shape.map((m, i) => { const t = o.rot + i / o.shape.length * 6.283; return [o.x + Math.cos(t) * o.r * m, o.y + Math.sin(t) * o.r * m]; });
          P.poly(pts, { w: 2.2 });
          P.hatch(c => { c.moveTo(...pts[0]); pts.forEach(p => c.lineTo(...p)); c.closePath(); }, [o.x - o.r, o.y - o.r, o.r * 2, o.r * 2], { a: .45, gap: 3, cross: o.size === 3 });
        }
        for (const b of g.shots) b.foe ? P.circle(b.x, b.y, 3.5, { w: 1.6 }) : P.line(b.x, b.y, b.x - b.vx * .015, b.y - b.vy * .015, { w: 2.4, r: .4 });
        if (g.ufo) { const u = g.ufo; P.circle(u.x, u.y - 5, 8); ctx.save(); ctx.translate(u.x, u.y); ctx.scale(1, .35); P.circle(0, 0, 24); ctx.restore(); P.hatchRect(u.x - 20, u.y - 2, 40, 5, { a: .5, gap: 3 }); }
        if (!(s.inv > 0 && Math.floor(g.t * 12) % 2)) {
          ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
          P.poly([[16, 0], [-10, -10], [-5, 0], [-10, 10]], { w: 2.2 });
          if (s.thrust) P.poly([[-7, -4], [-18 - Math.random() * 8, 0], [-7, 4]], { closed: false, w: 1.6 });
          ctx.restore();
        }
        dust.draw(P);
      },
    });
  },
});
