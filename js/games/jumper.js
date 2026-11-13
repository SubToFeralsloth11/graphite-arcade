Games.register({
  id: 'jumper',
  title: 'Scribble Jump',
  blurb: 'Bounce up an endless page of ledges. Springs help, crumbly ones do not.',
  group: 'arcade',
  tags: ['solo', 'endless', 'jumping'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M10 70 h30 M60 50 h30 M30 28 h30 M76 14 h28" stroke-width="4"/><path d="M86 50 v-6 l4 -2 l-8 -2 l8 -2" /><circle cx="48" cy="58" r="7"/><path d="M44 66 l-3 6 M52 66 l3 6"/></svg>`,
  help: 'You jump automatically whenever you land. Steer with ←/→, A/D, or hold the left/right half of the screen. Walk off one side to come back on the other. Plain ledges are safe, dashed ones crumble after one bounce, moving ones slide, and springs launch you sky high. Watch out for scribble monsters: land on them to squash them, bump them from below and you fall.',
  mount(root, signal) {
    const dust = Dust();
    const JUMP = 720, G = 1500;
    function addLedge(g, y) {
      const h = -y / 100, r = Math.random();
      const kind = h > 15 && r < Math.min(.22, h * .004) ? 'crumble' : h > 8 && r < Math.min(.45, .12 + h * .004) ? 'move' : 'plain';
      const l = { x: 20 + rand(g.W - 110), y, w: 70, kind, vx: kind === 'move' ? (60 + Math.min(120, h)) * (Math.random() < .5 ? -1 : 1) : 0 };
      if (kind !== 'crumble' && Math.random() < .08) l.spring = 10 + rand(40);
      g.ledges.push(l);
      if (h > 20 && kind === 'plain' && !l.spring && Math.random() < Math.min(.12, h * .002)) g.mons.push({ x: l.x + 35, y: y - 26, t: rand(10), base: l.x + 35 });
    }
    Arcade.mount(root, signal, {
      id: 'jumper', title: 'Scribble Jump', w: 400, h: 600, scoreLabel: 'height',
      intro: 'Keep bouncing upward. Do not fall off the bottom of the page.',
      keysHelp: '←/→ or A/D, or hold a side of the page · P pause',
      init(g) {
        g.ledges = []; g.mons = []; g.cam = 0; g.top = g.H - 20;
        g.p = { x: g.W / 2, y: g.H - 80, vx: 0, vy: -JUMP, face: 1, squash: 0 };
        g.ledges.push({ x: g.W / 2 - 40, y: g.H - 30, w: 80, kind: 'plain', vx: 0 });
        while (g.top > -g.H) { g.top -= 45 + rand(40); addLedge(g, g.top); }
      },
      update(g, dt) {
        const p = g.p;
        let dir = (g.keys.has('right') ? 1 : 0) - (g.keys.has('left') ? 1 : 0);
        if (!dir && g.ptr.down) dir = g.ptr.x > g.W / 2 ? 1 : -1;
        p.vx += (dir * 330 - p.vx) * Math.min(1, dt * 10);
        if (dir) p.face = dir;
        p.x += p.vx * dt;
        if (p.x < -15) p.x = g.W + 15; if (p.x > g.W + 15) p.x = -15;
        const oy = p.y;
        p.vy += G * dt; p.y += p.vy * dt;
        p.squash = Math.max(0, p.squash - dt * 4);
        for (const l of g.ledges) {
          if (l.vx) { l.x += l.vx * dt; if (l.x < 0 || l.x + l.w > g.W) l.vx *= -1; }
          if (l.gone) { l.fall = (l.fall || 0) + dt * 600; continue; }
          if (!p.fallen && p.vy > 0 && oy <= l.y && p.y >= l.y && p.x > l.x - 8 && p.x < l.x + l.w + 8) {
            p.y = l.y; p.squash = 1;
            const spr = l.spring != null && Math.abs(p.x - (l.x + l.spring + 6)) < 14;
            p.vy = spr ? -JUMP * 1.7 : -JUMP;
            spr ? (Sfx.good(), dust.burst(p.x, l.y, 12, 160)) : Sfx.tap();
            if (l.kind === 'crumble') { l.gone = true; dust.burst(l.x + l.w / 2, l.y, 10, 90); }
          }
        }
        for (const m of g.mons) {
          m.t += dt; m.x = m.base + Math.sin(m.t * 2) * 20;
          if (m.dead) continue;
          if (Math.abs(p.x - m.x) < 26 && Math.abs(p.y - 10 - m.y) < 26) {
            if (p.vy > 0 && p.y < m.y + 6) { m.dead = true; p.vy = -JUMP; g.score += 50; g.bonus = (g.bonus || 0) + 50; Sfx.good(); dust.burst(m.x, m.y, 20, 180); }
            else if (!p.fallen) { p.fallen = true; p.vy = Math.max(p.vy, 200); Sfx.bad(); }
          }
        }
        if (p.fallen) p.vx = 0;
        g.cam = Math.min(g.cam, p.y - g.H * .45);
        g.score = Math.max(g.score, Math.floor(-g.cam / 10) + (g.bonus || 0));
        while (g.top > g.cam - 60) { g.top -= 45 + rand(Math.min(110, 40 + -g.top / 120)); addLedge(g, g.top); }
        g.ledges = g.ledges.filter(l => l.y < g.cam + g.H + 40);
        g.mons = g.mons.filter(m => m.y < g.cam + g.H + 40);
        if (p.y > g.cam + g.H + 40) return g.end({ win: false, title: 'Fell off the page', msg: `Height ${g.score}.` });
        dust.update(dt);
      },
      draw(g, P) {
        const ctx = P.ctx, p = g.p;
        P.paper(g.W, g.H, { oy: g.cam, ox: null });
        ctx.save(); ctx.translate(0, -g.cam);
        for (const l of g.ledges) {
          const y = l.y + (l.fall || 0);
          if (l.kind === 'crumble') { for (let x = l.x; x < l.x + l.w; x += 14) P.line(x, y, x + 9, y + (l.gone ? 6 : 0), { w: 3 }); }
          else { P.line(l.x, y, l.x + l.w, y, { w: 3.4 }); P.hatchRect(l.x, y, l.w, 7, { a: l.kind === 'move' ? .55 : .25, gap: 4 }); }
          if (l.spring != null) { const sx = l.x + l.spring; P.poly([[sx, y], [sx + 12, y - 4], [sx, y - 8], [sx + 12, y - 12]], { closed: false, w: 1.6 }); P.line(sx - 2, y - 13, sx + 14, y - 13, { w: 2.4 }); }
        }
        for (const m of g.mons) {
          if (m.dead) continue;
          P.circle(m.x, m.y, 15); P.hatchCircle(m.x, m.y, 14, { a: .5, gap: 3, cross: true });
          for (let i = -2; i <= 2; i++) P.line(m.x + i * 6, m.y + 13, m.x + i * 7, m.y + 20 + Math.sin(m.t * 10 + i) * 2, { w: 1.4 });
          ctx.fillStyle = '#f5f2e9'; ctx.fillRect(m.x - 7, m.y - 6, 5, 5); ctx.fillRect(m.x + 2, m.y - 6, 5, 5);
        }
        ctx.save(); ctx.translate(p.x, p.y);
        const sq = 1 - p.squash * .25; ctx.scale(1 / sq, sq);
        P.circle(0, -16, 15, { w: 2.4 });
        ctx.fillStyle = INK(.85); ctx.fillRect(p.face * 5 - 2, -22, 3, 5); ctx.fillRect(p.face * 5 + 5, -22, 3, 5);
        P.line(p.face * 14, -14, p.face * 22, -16, { w: 3 });
        P.line(-6, -2, -9, 0, { w: 2.2 }); P.line(6, -2, 9, 0, { w: 2.2 });
        if (p.fallen) P.text('x x', p.face * 3, -18, { size: 14 });
        ctx.restore();
        dust.draw(P);
        ctx.restore();
      },
    });
  },
});
