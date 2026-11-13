Games.register({
  id: 'plane',
  title: 'Paper Squadron',
  blurb: 'Fly a paper plane through waves of doodled fighters and a blimp boss.',
  group: 'arcade',
  tags: ['solo', 'shooter', 'endless'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M14 40 L60 30 L44 40 L60 50 Z M44 40 L28 46"/><path d="M66 40 H80 M86 40 H96" stroke-dasharray="4 5"/><path d="M100 26 l12 -6 l-4 8 l4 8 l-12 -4 z" class="fill"/><path d="M20 66 q10 -8 20 0 q10 -8 20 0" /></svg>`,
  help: 'Arrows or WASD to fly, hold Space (or the fire pad) to shoot. On touch, drag on the sky to steer; your plane fires on its own. Shoot down fighters, dodge their pellets, and pick up stars: S = spread shot, O = shield, ♥ = extra life. Every fifth wave a blimp boss turns up.',
  mount(root, signal) {
    const dust = Dust();
    let touchFly = false;

    function spawnWave(g) {
      g.wave++;
      g.info = `wave ${g.wave} · ♥ ${g.lives}`;
      if (g.wave % 5 === 0) {
        const hp = 40 + g.wave * 8;
        g.foes.push({ kind: 'boss', x: g.W + 40, y: 150, w: 150, h: 70, hp, max: hp, t: 0, cd: 1 });
        toast('Blimp incoming!');
        return;
      }
      const n = 4 + Math.min(10, g.wave), pattern = g.wave % 3;
      for (let i = 0; i < n; i++) {
        const base = { x: g.W + 30 + i * 55, w: 34, h: 18, hp: 1 + Math.floor(g.wave / 4), t: rand(100), cd: 1 + Math.random() * 2 };
        if (pattern === 0) g.foes.push({ ...base, kind: 'sine', y0: 60 + rand(g.H - 120), y: 0 });
        else if (pattern === 1) g.foes.push({ ...base, kind: 'dive', y: i % 2 ? 50 : g.H - 70, y0: 0 });
        else g.foes.push({ ...base, kind: 'line', y: 70 + (i % 4) * 85, y0: 0 });
      }
    }

    Arcade.mount(root, signal, {
      id: 'plane', title: 'Paper Squadron', h: 420,
      intro: 'Clear the waves. Every fifth one brings a boss.',
      keysHelp: 'Arrows/WASD fly · hold Space to fire · drag on touch screens · P pause',
      init(g) {
        g.p = { x: 90, y: g.H / 2, w: 36, h: 16, cd: 0, inv: 1.5, spread: 0, shield: 0 };
        g.lives = 3; g.wave = 0; g.foes = []; g.shots = []; g.pellets = []; g.loot = []; g.next = 1.2; g.scroll = 0;
        g.clouds = Array.from({ length: 6 }, (_, i) => ({ x: i * 140 + rand(60), y: 30 + rand(g.H - 80), s: .4 + Math.random() * .6 }));
        g.info = 'wave 1 · ♥ 3';
      },
      update(g, dt) {
        const p = g.p, k = g.keys;
        g.scroll += dt * 120;
        if (g.ptr.down) touchFly = true;
        let dx = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0), dy = (k.has('down') ? 1 : 0) - (k.has('up') ? 1 : 0);
        if (dx || dy) { const m = Math.hypot(dx, dy); p.x += dx / m * 290 * dt; p.y += dy / m * 290 * dt; touchFly = false; }
        else if (g.ptr.down) { p.x += clamp(g.ptr.x + 30 - p.x, -400 * dt, 400 * dt); p.y += clamp(g.ptr.y - p.y, -400 * dt, 400 * dt); }
        p.x = clamp(p.x, 20, g.W * .7); p.y = clamp(p.y, 20, g.H - 20);
        p.tilt = (p.tilt || 0) + ((dy || 0) * .25 - (p.tilt || 0)) * Math.min(1, dt * 10);
        p.inv -= dt; p.shield -= dt; p.spread -= dt; p.cd -= dt;
        if ((k.has('fire') || touchFly) && p.cd <= 0) {
          p.cd = .17;
          const angs = p.spread > 0 ? [-.18, 0, .18] : [0];
          for (const a of angs) g.shots.push({ x: p.x + 20, y: p.y, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620 });
          Sfx.tap();
        }
        if (!g.foes.length) { g.next -= dt; if (g.next <= 0) { spawnWave(g); g.next = 1.5; } }

        for (const s of g.shots) { s.x += s.vx * dt; s.y += s.vy * dt; }
        g.shots = g.shots.filter(s => s.x < g.W + 20 && s.y > -20 && s.y < g.H + 20 && !s.dead);
        for (const b of g.pellets) { b.x += b.vx * dt; b.y += b.vy * dt; }
        g.pellets = g.pellets.filter(b => b.x > -20 && b.x < g.W + 20 && b.y > -20 && b.y < g.H + 20 && !b.dead);

        const shoot = (f, speed = 200) => {
          const a = Math.atan2(p.y - f.y, p.x - f.x);
          g.pellets.push({ x: f.x, y: f.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed });
        };
        for (const f of g.foes) {
          f.t += dt; f.cd -= dt;
          if (f.kind === 'boss') {
            f.x += (g.W - 120 - f.x) * Math.min(1, dt);
            f.y = 150 + Math.sin(f.t * .8) * 100;
            if (f.cd <= 0) {
              f.cd = Math.max(.5, 1.4 - g.wave * .04);
              if (Math.floor(f.t) % 4 < 2) shoot(f, 230);
              else for (let i = -2; i <= 2; i++) g.pellets.push({ x: f.x - 60, y: f.y, vx: -200, vy: i * 60 });
            }
          } else {
            f.x -= (110 + g.wave * 6) * dt;
            if (f.kind === 'sine') f.y = f.y0 + Math.sin(f.t * 2.5) * 50;
            if (f.kind === 'dive' && f.x < g.W - 100) f.y += clamp(p.y - f.y, -90 * dt, 90 * dt);
            if (f.cd <= 0 && f.x < g.W - 20) { f.cd = Math.max(1.2, 3.5 - g.wave * .15) + Math.random(); shoot(f, 170 + g.wave * 5); }
            if (f.x < -50) { f.gone = true; g.score = Math.max(0, g.score - 5); }
          }
          const box = { x: f.x - f.w / 2, y: f.y - f.h / 2, w: f.w, h: f.h };
          for (const s of g.shots) if (!s.dead && hit({ x: s.x - 4, y: s.y - 2, w: 8, h: 4 }, box)) {
            s.dead = true; f.hp--; dust.burst(s.x, s.y, 3, 60);
            if (f.hp <= 0 && !f.gone) {
              f.gone = true; Sfx.good(); dust.burst(f.x, f.y, f.kind === 'boss' ? 50 : 14, f.kind === 'boss' ? 260 : 150);
              g.score += f.kind === 'boss' ? 500 : 25;
              if (f.kind === 'boss' || Math.random() < .12) g.loot.push({ x: f.x, y: f.y, kind: pick(f.kind === 'boss' ? ['life', 'spread'] : ['spread', 'shield', 'spread', 'life']) });
            }
          }
          if (hit(box, { x: p.x - 16, y: p.y - 7, w: 32, h: 14 }) && f.kind !== 'boss') { f.gone = true; dust.burst(f.x, f.y, 12); hurt(); }
        }
        g.foes = g.foes.filter(f => !f.gone);
        for (const b of g.pellets) if (!b.dead && Math.abs(b.x - p.x) < 15 && Math.abs(b.y - p.y) < 8) { b.dead = true; hurt(); }
        for (const l of g.loot) {
          l.x -= 60 * dt;
          if (Math.hypot(l.x - p.x, l.y - p.y) < 26) {
            l.got = true; Sfx.good();
            if (l.kind === 'spread') { p.spread = 10; toast('Spread shot!'); }
            if (l.kind === 'shield') { p.shield = 8; toast('Shield!'); }
            if (l.kind === 'life') { g.lives++; toast('+1 life'); }
            g.info = `wave ${g.wave} · ♥ ${g.lives}`;
          }
        }
        g.loot = g.loot.filter(l => !l.got && l.x > -20);
        for (const c of g.clouds) { c.x -= 50 * c.s * dt; if (c.x < -120) { c.x = g.W + 60; c.y = 30 + rand(g.H - 80); } }
        dust.update(dt);

        function hurt() {
          if (p.inv > 0) return;
          if (p.shield > 0) { p.shield = 0; p.inv = 1; Sfx.bad(); return; }
          g.lives--; p.inv = 2; p.spread = 0; Sfx.bad(); dust.burst(p.x, p.y, 24, 200);
          g.info = `wave ${g.wave} · ♥ ${g.lives}`;
          if (g.lives <= 0) g.end({ win: false, title: 'Shot down', msg: `You made it to wave ${g.wave}.` });
        }
      },
      draw(g, P) {
        const ctx = P.ctx, p = g.p;
        P.paper(g.W, g.H, { ox: g.scroll });
        for (const c of g.clouds) {
          const a = .2 + c.s * .2;
          ctx.save(); ctx.translate(c.x, c.y); ctx.scale(c.s, c.s);
          P.circle(0, 0, 22, { a }); P.circle(26, -10, 26, { a }); P.circle(54, 0, 20, { a });
          ctx.restore();
        }
        for (const f of g.foes) {
          ctx.save(); ctx.translate(f.x, f.y);
          if (f.kind === 'boss') {
            ctx.scale(1, .45); P.circle(0, 0, 72, { w: 2.6 });
            P.hatchCircle(0, 0, 70, { a: .25, gap: 6 }); ctx.restore();
            ctx.save(); ctx.translate(f.x, f.y);
            P.rect(-25, 30, 50, 16); P.poly([[60, -5], [85, -28], [85, 28]]);
            for (let i = -40; i <= 40; i += 20) P.line(i, -30, i, 30, { a: .3, w: 1.2 });
            P.rect(-50, -48, 100, 6, { a: .4 }); P.hatchRect(-50, -48, 100 * f.hp / f.max, 6, { a: .8, gap: 2 });
          } else {
            ctx.scale(-1, 1);
            P.poly([[-17, 0], [10, -9], [17, 0], [10, 9]]);
            P.line(0, -3, 6, -16, { w: 2.2 }); P.line(0, 3, 6, 16, { w: 2.2 });
            P.hatchRect(-6, -4, 18, 8, { a: .5, gap: 3 });
            P.line(-18, -7 + Math.sin(g.t * 40) * 7, -18, 7 - Math.sin(g.t * 40) * 7, { w: 1.2, a: .5 });
          }
          ctx.restore();
        }
        for (const s of g.shots) P.line(s.x - 8, s.y, s.x + 4, s.y, { w: 2.4, r: .5 });
        for (const b of g.pellets) { P.circle(b.x, b.y, 4, { w: 1.6 }); P.hatchCircle(b.x, b.y, 4, { a: .8, gap: 2 }); }
        for (const l of g.loot) { P.circle(l.x, l.y, 13); P.text(l.kind === 'spread' ? 'S' : l.kind === 'shield' ? 'O' : '♥', l.x, l.y + 1, { size: 20 }); }
        if (!(p.inv > 0 && Math.floor(g.t * 14) % 2)) {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.tilt || 0);
          P.poly([[-20, -2], [22, 0], [-20, -12], [-8, 0], [-20, 12], [22, 0]], { w: 2.2 });
          P.hatch(c => { c.moveTo(-20, -12); c.lineTo(22, 0); c.lineTo(-8, 0); }, [-20, -12, 42, 12], { a: .35, gap: 4 });
          if (p.shield > 0) P.circle(0, 0, 28, { a: .4 + Math.sin(g.t * 10) * .2 });
          ctx.restore();
          if (Math.floor(g.t * 10) % 2) P.line(p.x - 34, p.y + 2, p.x - 24, p.y + 1, { a: .4, w: 1.2 });
        }
        dust.draw(P);
        if (!g.foes.length && g.wave) P.text(`wave ${g.wave + 1}`, g.W / 2, g.H / 2, { size: 42, a: .5 });
      },
    });
  },
});
