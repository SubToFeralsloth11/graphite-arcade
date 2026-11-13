Games.register({
  id: 'breakout',
  title: 'Eraser Breakout',
  blurb: 'Bounce an eraser into rows of scribbled bricks. Catch power-ups.',
  group: 'arcade',
  tags: ['solo', 'classic', 'levels'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M10 10 h30 v10 h-30 z M45 10 h30 v10 h-30 z M80 10 h30 v10 h-30 z M28 24 h30 v10 h-30 z" class="fill"/><circle cx="66" cy="50" r="5"/><path d="M40 70 h40" stroke-width="5"/><path d="M58 42 l-8 -8" stroke-dasharray="3 3"/></svg>`,
  help: 'Move the paddle with the mouse, your finger, or ←/→. Space or a tap launches the eraser. Shaded bricks take more hits. Catch falling power-ups: W = wide paddle, M = multi-ball, S = slow ball, ♥ = extra life. Clear every brick to move to the next page.',
  mount(root, signal) {
    const dust = Dust();
    const LAYOUTS = [
      ['1111111111', '1111111111', '1111111111', '1111111111'],
      ['2222222222', '1111111111', '1.1.1.1.1.', '.1.1.1.1.1', '1111111111'],
      ['..33333...', '.2222222..', '1111111111', '2.2.2.2.2.', '1111111111', '.1111111..'],
      ['3333333333', '2........2', '2.111111.2', '2.1....1.2', '2.111111.2', '3333333333'],
      ['1.2.3.3.2.1', '.1.2.3.2.1.', '3333333333', '2222222222', '1111111111', '1111111111'],
    ];
    function layout(g) {
      const L = LAYOUTS[(g.level - 1) % LAYOUTS.length], boost = Math.floor((g.level - 1) / LAYOUTS.length);
      g.bricks = [];
      const cols = 10, bw = (g.W - 40) / cols, bh = 22;
      L.forEach((row, r) => [...row].slice(0, cols).forEach((ch, c) => {
        if (ch === '.') return;
        const hp = Math.min(4, +ch + boost);
        g.bricks.push({ x: 20 + c * bw + 2, y: 50 + r * (bh + 6), w: bw - 4, h: bh, hp, max: hp });
      }));
    }
    const newBall = g => ({ x: g.pad.x, y: g.pad.y - 12, vx: 0, vy: 0, r: 8, stuck: true });
    function launch(g, b) { const a = -Math.PI / 2 + (Math.random() - .5) * .8; b.vx = Math.cos(a) * g.speed; b.vy = Math.sin(a) * g.speed; b.stuck = false; }

    Arcade.mount(root, signal, {
      id: 'breakout', title: 'Eraser Breakout', h: 460,
      intro: 'Smash every brick. Do not let the eraser fall off the page.',
      keysHelp: 'Mouse/finger or ←/→ to move · Space or tap to launch · P pause',
      pads: [['left', '◀'], ['fire', 'launch'], ['right', '▶']],
      init(g) {
        g.level = 1; g.lives = 3; g.pad = { x: g.W / 2, y: g.H - 30, w: 100, h: 12 };
        g.speed = 380; layout(g); g.balls = [newBall(g)]; g.drops = []; g.wide = 0; g.slow = 0; g.lastPtr = g.ptr.x;
        g.info = 'page 1 · ♥ 3';
      },
      update(g, dt) {
        const pad = g.pad;
        g.wide -= dt; g.slow -= dt;
        pad.w += ((g.wide > 0 ? 160 : 100) - pad.w) * Math.min(1, dt * 6);
        const dir = (g.keys.has('right') ? 1 : 0) - (g.keys.has('left') ? 1 : 0);
        if (dir) pad.x += dir * 560 * dt;
        else if (g.ptr.x !== g.lastPtr) pad.x = g.ptr.x;
        g.lastPtr = g.ptr.x;
        pad.x = clamp(pad.x, pad.w / 2, g.W - pad.w / 2);
        const launchNow = g.pressed.has('fire') || g.pressed.has('tap');
        const sp = g.slow > 0 ? .65 : 1;
        for (const b of g.balls) {
          if (b.stuck) { b.x = pad.x; b.y = pad.y - 12; if (launchNow) { launch(g, b); Sfx.tap(); } continue; }
          const steps = 3;
          for (let s = 0; s < steps; s++) {
            b.x += b.vx * sp * dt / steps; b.y += b.vy * sp * dt / steps;
            if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
            if (b.x > g.W - b.r) { b.x = g.W - b.r; b.vx = -Math.abs(b.vx); }
            if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
            if (b.vy > 0 && b.y + b.r > pad.y && b.y < pad.y + pad.h && Math.abs(b.x - pad.x) < pad.w / 2 + b.r) {
              const off = (b.x - pad.x) / (pad.w / 2), a = -Math.PI / 2 + off * 1.05, v = Math.hypot(b.vx, b.vy);
              b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v; b.y = pad.y - b.r; Sfx.tap();
            }
            for (const br of g.bricks) {
              if (br.hp <= 0 || b.x + b.r < br.x || b.x - b.r > br.x + br.w || b.y + b.r < br.y || b.y - b.r > br.y + br.h) continue;
              const ox = Math.min(b.x + b.r - br.x, br.x + br.w - (b.x - b.r)), oy = Math.min(b.y + b.r - br.y, br.y + br.h - (b.y - b.r));
              if (ox < oy) b.vx = b.x < br.x + br.w / 2 ? -Math.abs(b.vx) : Math.abs(b.vx);
              else b.vy = b.y < br.y + br.h / 2 ? -Math.abs(b.vy) : Math.abs(b.vy);
              br.hp--; g.score += 10; Sfx.scratch(); dust.burst(b.x, b.y, 6, 90);
              if (br.hp <= 0) {
                g.score += 10 * br.max; dust.burst(br.x + br.w / 2, br.y + br.h / 2, 14, 140);
                if (Math.random() < .14) g.drops.push({ x: br.x + br.w / 2, y: br.y, kind: pick(['W', 'M', 'S', 'W', 'M', '♥']) });
              }
              const v = Math.min(720, Math.hypot(b.vx, b.vy) * 1.004), m = Math.hypot(b.vx, b.vy);
              b.vx *= v / m; b.vy *= v / m;
              break;
            }
          }
          if (Math.abs(b.vy) < 80 && !b.stuck) b.vy = b.vy < 0 ? -80 : 80;
          if (b.y > g.H + 20) b.dead = true;
        }
        g.balls = g.balls.filter(b => !b.dead);
        if (!g.balls.length) {
          g.lives--; Sfx.bad();
          if (g.lives <= 0) return g.end({ win: false, title: 'Out of erasers', msg: `You reached page ${g.level}.` });
          g.balls = [newBall(g)];
        }
        for (const d of g.drops) {
          d.y += 150 * dt;
          if (d.y > pad.y - 10 && d.y < pad.y + 14 && Math.abs(d.x - pad.x) < pad.w / 2 + 10) {
            d.got = true; Sfx.good();
            if (d.kind === 'W') g.wide = 12;
            if (d.kind === 'S') g.slow = 8;
            if (d.kind === '♥') g.lives++;
            if (d.kind === 'M') { const src = g.balls.find(b => !b.stuck) || g.balls[0]; for (const a of [-.5, .5]) { const v = g.speed; g.balls.push({ x: src.x, y: src.y, r: 8, stuck: false, vx: Math.cos(-Math.PI / 2 + a) * v, vy: Math.sin(-Math.PI / 2 + a) * v }); } }
          }
        }
        g.drops = g.drops.filter(d => !d.got && d.y < g.H + 20);
        g.bricks = g.bricks.filter(b => b.hp > 0);
        if (!g.bricks.length) {
          g.score += 250 * g.level; g.level++; g.speed = Math.min(560, 380 + g.level * 25);
          toast(`Page ${g.level}!`); Sfx.win(); celebrate(10);
          layout(g); g.balls = [newBall(g)]; g.drops = [];
        }
        g.info = `page ${g.level} · ♥ ${g.lives}`;
        dust.update(dt);
      },
      draw(g, P) {
        P.paper(g.W, g.H);
        for (const br of g.bricks) {
          P.rect(br.x, br.y, br.w, br.h, { w: 1.8 });
          if (br.hp > 1) P.hatchRect(br.x, br.y, br.w, br.h, { a: .15 + br.hp * .1, gap: 8 - br.hp, cross: br.hp > 2 });
          if (br.hp < br.max) P.line(br.x + br.w * .3, br.y + 3, br.x + br.w * .5, br.y + br.h - 3, { w: 1, a: .6 });
        }
        for (const d of g.drops) { P.rect(d.x - 13, d.y - 11, 26, 22, { w: 1.6 }); P.text(d.kind, d.x, d.y + 1, { size: 20 }); }
        const pad = g.pad;
        P.rect(pad.x - pad.w / 2, pad.y, pad.w, pad.h, { w: 2.4 });
        P.hatchRect(pad.x - pad.w / 2, pad.y, pad.w, pad.h, { a: .5, gap: 4 });
        for (const b of g.balls) {
          P.ctx.save(); P.ctx.translate(b.x, b.y); P.ctx.rotate(g.t * 4);
          P.rect(-b.r, -b.r * .7, b.r * 2, b.r * 1.4, { w: 2 }); P.line(-b.r * .3, -b.r * .7, -b.r * .3, b.r * .7, { w: 1.2 });
          P.ctx.restore();
        }
        if (g.balls.some(b => b.stuck)) P.text('space / tap to launch', g.W / 2, g.H - 70, { size: 22, a: .45 });
        if (g.slow > 0) P.text('slow', 30, g.H - 14, { size: 18, align: 'left', a: .5 });
        dust.draw(P);
      },
    });
  },
});
