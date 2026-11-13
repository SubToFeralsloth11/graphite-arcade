Games.register({
  id: 'snake',
  title: 'Margin Snake',
  blurb: 'The classic, scribbled across graph paper. Eat, grow, do not bite yourself.',
  group: 'arcade',
  tags: ['solo', 'classic', 'speed'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M10 60 H50 V30 H90 V50" stroke-width="7"/><circle cx="96" cy="50" r="2" class="fill"/><circle cx="104" cy="20" r="6"/><path d="M104 14 l3 -5"/></svg>`,
  help: 'Steer with the arrow keys, WASD, or swipe. Eat apples to grow; the snake speeds up as it gets longer. Every fifth apple drops a gold star worth extra, but only for a few seconds. Hitting a wall, a rock, or yourself ends the run. In Wrap mode the walls loop around.',
  mount(root, signal) {
    const C = 30, COLS = 24, ROWS = 14;
    let wrap = false;
    const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0], swup: [0, -1], swdown: [0, 1], swleft: [-1, 0], swright: [1, 0] };
    const tabsEl = tabs([['walls', 'Walls'], ['wrap', 'Wrap']], 'walls', m => { wrap = m === 'wrap'; game.restart(); });
    root.append(el('div', { class: 'center' }, tabsEl));
    const dust = Dust();

    const free = g => {
      for (;;) {
        const c = [rand(COLS), rand(ROWS)];
        if (!g.body.some(b => b[0] === c[0] && b[1] === c[1]) && !g.rocks.some(b => b[0] === c[0] && b[1] === c[1]) && !(g.food && g.food[0] === c[0] && g.food[1] === c[1])) return c;
      }
    };
    const game = Arcade.mount(root, signal, {
      id: 'snake', title: 'Margin Snake', w: COLS * C, h: ROWS * C,
      intro: 'Eat apples, grow long, and keep away from your tail.',
      keysHelp: 'Arrows/WASD or swipe · P pause',
      pads: [['left', '◀'], ['up', '▲'], ['down', '▼'], ['right', '▶']],
      init(g) {
        g.body = [[6, 7], [5, 7], [4, 7]]; g.dir = [1, 0]; g.queue = []; g.step = 0; g.eaten = 0; g.rocks = []; g.food = null;
        g.food = free(g); g.star = null; g.prev = g.body.map(b => [...b]);
      },
      update(g, dt) {
        for (const k of g.pressed) if (DIRS[k]) g.queue.push(DIRS[k]);
        g.queue = g.queue.slice(-3);
        const speed = Math.max(.055, .14 - g.eaten * .003);
        g.step += dt;
        if (g.star && (g.star.t -= dt) <= 0) g.star = null;
        dust.update(dt);
        if (g.step < speed) return;
        g.step = 0;
        while (g.queue.length) {
          const d = g.queue.shift();
          if (d[0] !== -g.dir[0] || d[1] !== -g.dir[1]) { if (d[0] !== g.dir[0] || d[1] !== g.dir[1]) { g.dir = d; break; } }
        }
        g.prev = g.body.map(b => [...b]);
        let [x, y] = g.body[0]; x += g.dir[0]; y += g.dir[1];
        if (wrap) { x = (x + COLS) % COLS; y = (y + ROWS) % ROWS; }
        const dead = x < 0 || y < 0 || x >= COLS || y >= ROWS || g.body.slice(0, -1).some(b => b[0] === x && b[1] === y) || g.rocks.some(b => b[0] === x && b[1] === y);
        if (dead) { dust.burst(g.body[0][0] * C + 15, g.body[0][1] * C + 15, 30, 200); return g.end({ win: false, title: 'Ouch', msg: `Length ${g.body.length}.` }); }
        g.body.unshift([x, y]);
        if (x === g.food[0] && y === g.food[1]) {
          g.eaten++; g.score += 10; Sfx.good(); dust.burst(x * C + 15, y * C + 15, 10);
          g.food = free(g);
          if (g.eaten % 5 === 0) g.star = { c: free(g), t: 5 };
          if (g.eaten % 7 === 0 && g.rocks.length < 8) g.rocks.push(free(g));
        } else if (g.star && x === g.star.c[0] && y === g.star.c[1]) {
          g.score += 50; g.star = null; Sfx.win(); dust.burst(x * C + 15, y * C + 15, 20, 180);
        } else g.body.pop();
        g.info = `length ${g.body.length}`;
      },
      draw(g, P) {
        const ctx = P.ctx;
        P.paper(g.W, g.H, { ruled: false });
        ctx.strokeStyle = 'rgba(70,110,160,.12)'; ctx.lineWidth = 1; ctx.beginPath();
        for (let i = 1; i < COLS; i++) { ctx.moveTo(i * C, 0); ctx.lineTo(i * C, g.H); }
        for (let i = 1; i < ROWS; i++) { ctx.moveTo(0, i * C); ctx.lineTo(g.W, i * C); }
        ctx.stroke();
        if (!wrap) P.rect(2, 2, g.W - 4, g.H - 4, { w: 3 });
        for (const [x, y] of g.rocks) { P.poly([[x * C + 4, y * C + 24], [x * C + 9, y * C + 6], [x * C + 22, y * C + 4], [x * C + 27, y * C + 22]]); P.hatchRect(x * C + 6, y * C + 6, 20, 18, { a: .5, gap: 3, cross: true }); }
        const [fx, fy] = g.food, bob = Math.sin(g.t * 6) * 1.5;
        P.circle(fx * C + 15, fy * C + 17 + bob, 9); P.line(fx * C + 15, fy * C + 8 + bob, fx * C + 18, fy * C + 3 + bob, { w: 1.8 });
        P.hatchCircle(fx * C + 15, fy * C + 17 + bob, 8, { a: .3, gap: 4 });
        if (g.star) { const s = g.star, a = s.t < 1.5 && Math.floor(g.t * 8) % 2 ? .3 : .9; P.text('★', s.c[0] * C + 15, s.c[1] * C + 16, { size: 30, a }); }
        const pts = g.body.map(([x, y]) => [x * C + 15, y * C + 15]);
        for (let i = pts.length - 1; i > 0; i--) {
          const a = pts[i], b = pts[i - 1];
          if (Math.abs(a[0] - b[0]) > C || Math.abs(a[1] - b[1]) > C) continue;
          P.line(a[0], a[1], b[0], b[1], { w: 18 - Math.min(8, i * .3), a: .75, r: .6 });
        }
        const [hx, hy] = pts[0];
        P.circle(hx, hy, 11, { w: 2.4 });
        ctx.fillStyle = '#f5f2e9';
        const ex = g.dir[1] ? 5 : 0, ey = g.dir[0] ? 5 : 0;
        ctx.beginPath(); ctx.arc(hx + g.dir[0] * 4 + ex, hy + g.dir[1] * 4 + ey, 3, 0, 7); ctx.arc(hx + g.dir[0] * 4 - ex, hy + g.dir[1] * 4 - ey, 3, 0, 7); ctx.fill();
        dust.draw(P);
      },
    });
  },
});
