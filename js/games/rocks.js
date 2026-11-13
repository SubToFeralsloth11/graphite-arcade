Games.register({
  id: 'rocks',
  title: 'Eraser Rocks',
  blurb: 'Spin, thrust and blast scribbled rocks into crumbs before they crowd the page.',
  group: 'arcade',
  tags: ['solo', 'shooter', 'classic'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M30 46 l14 -6 l-14 -6 l3 6 z"/><path d="M50 40 h8 M64 40 h8" stroke-dasharray="3 4"/><path d="M80 18 l14 -6 l16 6 l2 16 l-14 12 l-16 -4 l-6 -12 z" class="fill"/><path d="M14 64 l8 -4 l8 4 l-2 8 l-10 2 z"/><path d="M94 60 l6 -2 l4 4 l-4 6 l-6 -2 z"/></svg>`,
  help: 'Left/right (or A/D) spin the ship, Up thrusts, Space fires, Down warps you to a random spot (it needs a few seconds to recharge). Big rocks split into smaller, faster ones. Clear every rock to start the next page, which brings more and quicker rocks. From page 2 a saucer drops in and shoots at you. Shot rocks sometimes leave power-ups: T = triple shot, O = shield. Extra life every 5000 points. On touch, hold a finger on the page: the ship turns toward it, flies if it is far away, and fires on its own.',
  mount(root, signal) {
    const dust = Dust();
    const SIZES = { 3: { r: 40, pts: 20 }, 2: { r: 23, pts: 50 }, 1: { r: 12, pts: 100 } };

    const wrap = (o, m) => {
      if (o.x < -m) o.x += 720 + m * 2; else if (o.x > 720 + m) o.x -= 720 + m * 2;
      if (o.y < -m) o.y += 420 + m * 2; else if (o.y > 420 + m) o.y -= 420 + m * 2;
    };

    function rock(x, y, size, speed) {
      const r = SIZES[size].r, n = 8 + size * 2, a = Math.random() * Math.PI * 2;
      const shape = Array.from({ length: n }, (_, i) => { const t = i / n * Math.PI * 2, rr = r * (.72 + Math.random() * .36); return [Math.cos(t) * rr, Math.sin(t) * rr]; });
      return { x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r, size, shape, rot: Math.random() * 6, spin: (Math.random() - .5) * 1.6 };
    }

    function startWave(g) {
      g.wave++;
      g.rocks = [];
      const n = Math.min(11, 3 + g.wave), sp = 38 + g.wave * 7;
      for (let i = 0; i < n; i++) {
        let x, y;
        do { x = rand(g.W); y = rand(g.H); } while (Math.hypot(x - g.s.x, y - g.s.y) < 170);
        g.rocks.push(rock(x, y, 3, sp * (.7 + Math.random() * .6)));
      }
      g.ufoT = 14 + rand(10);
      g.info = info(g);
    }
    const info = g => `page ${g.wave} · ♥ ${g.lives}`;

    function hurt(g) {
      const s = g.s;
      if (s.dead || s.inv > 0) return;
      if (s.shield > 0) { s.shield = 0; s.inv = 1; Sfx.bad(); dust.burst(s.x, s.y, 10, 120); return; }
      s.dead = true; s.respawn = 1.4; g.lives--; Sfx.bad(); dust.burst(s.x, s.y, 36, 220);
      g.info = info(g);
      if (g.lives <= 0) g.end({ win: false, title: 'Erased', msg: `You reached page ${g.wave}.` });
    }

    function smash(g, r, i) {
      g.rocks.splice(i, 1);
      addScore(g, SIZES[r.size].pts);
      dust.burst(r.x, r.y, 6 + r.size * 5, 60 + r.size * 40); Sfx.tap();
      if (r.size > 1) {
        const sp = Math.hypot(r.vx, r.vy) * 1.25 + 15;
        for (let k = 0; k < 2; k++) g.rocks.push(rock(r.x, r.y, r.size - 1, sp * (.8 + Math.random() * .4)));
      }
      if (Math.random() < .06) g.loot.push({ x: r.x, y: r.y, kind: pick(['T', 'O']), life: 9 });
    }

    function addScore(g, n) {
      g.score += n;
      if (g.score >= g.nextLife) { g.nextLife += 5000; g.lives++; toast('+1 life'); Sfx.good(); g.info = info(g); }
    }

    Arcade.mount(root, signal, {
      id: 'rocks', title: 'Eraser Rocks', h: 420,
      intro: 'Blast the rocks to crumbs. Watch out for the saucer.',
      keysHelp: '←/→ spin · ↑ thrust · Space fire · ↓ warp · hold a finger on the page to fly on touch · P pause',
      pads: [['left', '⟲'], ['right', '⟳'], ['up', 'thrust'], ['fire', 'fire'], ['down', 'warp']],
      init(g) {
        g.s = { x: g.W / 2, y: g.H / 2, vx: 0, vy: 0, a: -Math.PI / 2, inv: 2, cd: 0, warp: 0, triple: 0, shield: 0, dead: false, respawn: 0, thrust: false };
        g.lives = 3; g.wave = 0; g.nextLife = 5000; g.bullets = []; g.ufos = []; g.zaps = []; g.loot = []; g.next = 0;
        startWave(g);
      },
      update(g, dt) {
        const s = g.s, k = g.keys;
        dust.update(dt);
        if (s.dead) {
          if ((s.respawn -= dt) <= 0 && g.lives > 0 && !g.rocks.some(r => Math.hypot(r.x - g.W / 2, r.y - g.H / 2) < r.r + 70)) {
            Object.assign(s, { x: g.W / 2, y: g.H / 2, vx: 0, vy: 0, a: -Math.PI / 2, inv: 2.2, dead: false, triple: 0 });
          }
        } else {
          let turn = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0), thrust = k.has('up'), fire = k.has('fire');
          if (g.ptr.down && !turn) {
            const want = Math.atan2(g.ptr.y - s.y, g.ptr.x - s.x);
            let d = want - s.a; d = Math.atan2(Math.sin(d), Math.cos(d));
            s.a += clamp(d, -5 * dt, 5 * dt);
            thrust = thrust || Math.hypot(g.ptr.x - s.x, g.ptr.y - s.y) > 110;
            fire = true;
          }
          s.a += turn * 4.4 * dt;
          s.thrust = thrust;
          if (thrust) { s.vx += Math.cos(s.a) * 320 * dt; s.vy += Math.sin(s.a) * 320 * dt; }
          const drag = Math.pow(.6, dt); s.vx *= drag; s.vy *= drag;
          const sp = Math.hypot(s.vx, s.vy);
          if (sp > 340) { s.vx *= 340 / sp; s.vy *= 340 / sp; }
          s.x += s.vx * dt; s.y += s.vy * dt; wrap(s, 12);
          s.inv -= dt; s.cd -= dt; s.warp -= dt; s.triple -= dt; s.shield -= dt;
          if (fire && s.cd <= 0 && g.bullets.length < (s.triple > 0 ? 15 : 6)) {
            s.cd = .2;
            for (const off of s.triple > 0 ? [-.2, 0, .2] : [0]) {
              const a = s.a + off;
              g.bullets.push({ x: s.x + Math.cos(a) * 16, y: s.y + Math.sin(a) * 16, vx: Math.cos(a) * 470 + s.vx * .5, vy: Math.sin(a) * 470 + s.vy * .5, life: .85 });
            }
            Sfx.tap();
          }
          if (g.pressed.has('down') && s.warp <= 0) {
            dust.burst(s.x, s.y, 14, 140);
            s.x = 40 + rand(g.W - 80); s.y = 40 + rand(g.H - 80); s.vx = s.vy = 0; s.warp = 4; s.inv = Math.max(s.inv, .5);
            dust.burst(s.x, s.y, 14, 140); Sfx.scratch();
          }
        }

        for (const b of g.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; wrap(b, 2); }
        for (const r of g.rocks) { r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.spin * dt; wrap(r, r.r); }

        for (const b of g.bullets) {
          if (b.life <= 0) continue;
          for (let i = g.rocks.length - 1; i >= 0; i--) {
            const r = g.rocks[i];
            if ((b.x - r.x) ** 2 + (b.y - r.y) ** 2 < (r.r * .9) ** 2) { b.life = 0; smash(g, r, i); break; }
          }
          for (const u of g.ufos) if (!u.dead && Math.abs(b.x - u.x) < u.r * 1.4 && Math.abs(b.y - u.y) < u.r * .7) {
            b.life = 0; u.dead = true; addScore(g, u.small ? 1000 : 300); Sfx.good(); dust.burst(u.x, u.y, 30, 200);
            g.loot.push({ x: u.x, y: u.y, kind: pick(['T', 'O']), life: 9 });
          }
        }
        g.bullets = g.bullets.filter(b => b.life > 0);

        if (!s.dead) for (const r of g.rocks) if (Math.hypot(r.x - s.x, r.y - s.y) < r.r * .85 + 9) { hurt(g); break; }

        // Saucer: flies across with a wobble and takes aimed shots that get sharper on later pages.
        if (g.wave >= 2 && (g.ufoT -= dt) <= 0) {
          g.ufoT = Math.max(9, 24 - g.wave) + rand(8);
          const small = g.wave >= 4 && Math.random() < .45, dir = Math.random() < .5 ? 1 : -1;
          g.ufos.push({ x: dir > 0 ? -30 : g.W + 30, y0: 60 + rand(g.H - 120), y: 0, dir, small, r: small ? 11 : 17, t: 0, cd: 1.2 });
        }
        for (const u of g.ufos) {
          u.t += dt; u.x += u.dir * (u.small ? 130 : 90) * dt; u.y = u.y0 + Math.sin(u.t * 2) * 50;
          if ((u.cd -= dt) <= 0 && !s.dead) {
            u.cd = u.small ? .9 : 1.5;
            const err = u.small ? Math.max(.04, .3 - g.wave * .03) : .6, a = Math.atan2(s.y - u.y, s.x - u.x) + (Math.random() - .5) * err;
            g.zaps.push({ x: u.x, y: u.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, life: 1.8 });
          }
          if (!s.dead && Math.abs(s.x - u.x) < u.r * 1.4 + 8 && Math.abs(s.y - u.y) < u.r + 6) { u.dead = true; dust.burst(u.x, u.y, 24, 180); hurt(g); }
          if (u.x < -60 || u.x > g.W + 60) u.gone = true;
        }
        g.ufos = g.ufos.filter(u => !u.dead && !u.gone);
        for (const z of g.zaps) {
          z.x += z.vx * dt; z.y += z.vy * dt; z.life -= dt; wrap(z, 2);
          if (!s.dead && Math.hypot(z.x - s.x, z.y - s.y) < 11) { z.life = 0; hurt(g); }
        }
        g.zaps = g.zaps.filter(z => z.life > 0);

        for (const l of g.loot) {
          l.life -= dt;
          if (!s.dead && Math.hypot(l.x - s.x, l.y - s.y) < 24) {
            l.life = 0; Sfx.good();
            if (l.kind === 'T') { s.triple = 10; toast('Triple shot!'); } else { s.shield = 10; toast('Shield!'); }
          }
        }
        g.loot = g.loot.filter(l => l.life > 0);

        if (!g.rocks.length && !g.ufos.length) {
          if (!g.next) { g.next = 1.6; addScore(g, 250 * g.wave); Sfx.good(); }
          if ((g.next -= dt) <= 0) { g.next = 0; startWave(g); }
        }
      },
      draw(g, P) {
        const ctx = P.ctx, s = g.s;
        P.paper(g.W, g.H, { ruled: true, ox: null });
        for (const r of g.rocks) {
          ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
          ctx.fillStyle = '#f5f2e9'; ctx.beginPath(); r.shape.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.fill();
          P.poly(r.shape, { w: r.size > 1 ? 2.3 : 1.9 });
          P.hatch(c => r.shape.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)), [-r.r, -r.r, r.r * 2, r.r * 2], { a: .18 + r.size * .06, gap: 6 - r.size });
          if (r.size > 1) { P.circle(r.r * .25, -r.r * .2, r.r * .18, { w: 1.2, a: .5 }); P.circle(-r.r * .3, r.r * .3, r.r * .12, { w: 1.2, a: .5 }); }
          ctx.restore();
        }
        for (const u of g.ufos) {
          ctx.save(); ctx.translate(u.x, u.y);
          const R = u.r;
          P.poly([[-R * 1.4, 0], [-R * .6, -R * .45], [R * .6, -R * .45], [R * 1.4, 0], [R * .6, R * .45], [-R * .6, R * .45]], { w: 2 });
          P.line(-R * 1.4, 0, R * 1.4, 0, { w: 1.4, a: .6 });
          P.hatch(c => c.arc(0, -R * .45, R * .55, Math.PI, 0), [-R * .55, -R, R * 1.1, R * .55], { a: .55, gap: 3 });
          P.circle(0, -R * .45, R * .55, { w: 1.6, a: .7 });
          ctx.restore();
        }
        ctx.fillStyle = INK(.9);
        for (const b of g.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 2.4, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = INK(.8); ctx.lineWidth = 2;
        for (const z of g.zaps) { ctx.beginPath(); ctx.arc(z.x, z.y, 4, 0, Math.PI * 2); ctx.stroke(); }
        for (const l of g.loot) {
          if (l.life < 2 && Math.floor(g.t * 8) % 2) continue;
          P.circle(l.x, l.y, 13); P.text(l.kind, l.x, l.y + 1, { size: 20 });
        }
        if (!s.dead && !(s.inv > 0 && Math.floor(g.t * 12) % 2)) {
          ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
          const shape = [[17, 0], [-11, -11], [-6, 0], [-11, 11]];
          ctx.fillStyle = '#f5f2e9'; ctx.beginPath(); shape.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.fill();
          P.poly(shape, { w: 2.3 });
          P.hatch(c => { c.moveTo(17, 0); c.lineTo(-11, -11); c.lineTo(-6, 0); }, [-11, -11, 28, 11], { a: .4, gap: 3 });
          if (s.thrust) {
            const f = 10 + Math.random() * 8;
            ctx.strokeStyle = INK(.7); ctx.lineWidth = 1.6; ctx.beginPath();
            ctx.moveTo(-8, -4); ctx.lineTo(-8 - f, 0); ctx.lineTo(-8, 4); ctx.stroke();
          }
          if (s.shield > 0) P.circle(0, 0, 24, { a: .35 + Math.sin(g.t * 9) * .15 });
          ctx.restore();
        }
        dust.draw(P);
        if (s.warp > 0 && !s.dead) { ctx.fillStyle = INK(.25); ctx.fillRect(10, g.H - 12, 60 * (1 - s.warp / 4), 4); }
        if (g.next > 0) P.text(`page ${g.wave + 1}`, g.W / 2, g.H / 2, { size: 44, a: .5 });
      },
    });
  },
});
