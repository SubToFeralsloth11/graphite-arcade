Games.register({
  id: 'stack',
  title: 'Notebook Tower',
  blurb: 'Drop sliding blocks on top of each other. Overhangs get erased.',
  group: 'arcade',
  tags: ['solo', 'one button', 'timing'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M30 70 h60 v-12 h-60 z M34 58 h52 v-12 h-52 z M40 46 h44 v-12 h-44 z" class="fill"/><path d="M60 22 h44 v-12 h-44 z"/><path d="M50 16 h-10 M46 12 l-6 4 l6 4"/></svg>`,
  help: 'A block slides back and forth. Press Space, click or tap to drop it. Any part that hangs over the block below is erased, so your tower gets thinner. Land a near-perfect drop to keep the full width; three perfect drops in a row widen the block again.',
  mount(root, signal) {
    const dust = Dust();
    const BH = 26;
    function next(g) {
      const top = g.tower[g.tower.length - 1], fromLeft = g.tower.length % 2 === 0;
      g.cur = { x: fromLeft ? 0 : g.W - top.w, w: top.w, dir: fromLeft ? 1 : -1, speed: Math.min(520, 170 + g.tower.length * 9) };
    }
    Arcade.mount(root, signal, {
      id: 'stack', title: 'Notebook Tower', h: 460, scoreLabel: 'height',
      intro: 'Tap or press Space to drop each block. Stack as high as you can.',
      keysHelp: 'Space, click or tap to drop · P pause',
      init(g) {
        g.tower = [{ x: g.W / 2 - 110, w: 220 }, { x: g.W / 2 - 110, w: 220 }];
        g.cam = 0; g.chips = []; g.combo = 0; g.flash = 0; next(g);
      },
      update(g, dt) {
        const c = g.cur;
        c.x += c.dir * c.speed * dt;
        if (c.x + c.w > g.W + 40 && c.dir > 0) c.dir = -1;
        if (c.x < -40 && c.dir < 0) c.dir = 1;
        if (g.pressed.has('fire') || g.pressed.has('tap')) {
          const top = g.tower[g.tower.length - 1];
          const l = Math.max(c.x, top.x), r = Math.min(c.x + c.w, top.x + top.w), y = g.H - 60 - g.tower.length * BH;
          if (r - l <= 0) {
            g.chips.push({ x: c.x, w: c.w, y, vy: 0, vx: c.dir * 60, rot: 0 });
            Sfx.lose(); return g.end({ win: false, title: 'Toppled', msg: `Your tower was ${g.score} blocks tall.` });
          }
          if (Math.abs(c.x - top.x) < 6) {
            g.combo++; g.flash = .4; Sfx.good(); dust.burst(top.x + top.w / 2, y + BH, 16, 160);
            let w = top.w;
            if (g.combo >= 3) w = Math.min(260, w + 16);
            g.tower.push({ x: top.x - (w - top.w) / 2, w });
            g.score += 1;
          } else {
            g.combo = 0; Sfx.scratch();
            if (c.x < l) g.chips.push({ x: c.x, w: l - c.x, y, vy: 0, vx: -60, rot: 0 });
            if (c.x + c.w > r) g.chips.push({ x: r, w: c.x + c.w - r, y, vy: 0, vx: 60, rot: 0 });
            g.tower.push({ x: l, w: r - l });
            g.score += 1;
          }
          next(g);
        }
        g.cam += (Math.max(0, (g.tower.length - 8) * BH) - g.cam) * Math.min(1, dt * 4);
        for (const ch of g.chips) { ch.vy += 1300 * dt; ch.y += ch.vy * dt; ch.x += ch.vx * dt; ch.rot += ch.vx * .01 * dt; }
        g.chips = g.chips.filter(ch => ch.y < g.H + g.cam + 100);
        g.flash -= dt; dust.update(dt);
        g.info = g.combo > 1 ? `perfect ×${g.combo}` : '';
      },
      draw(g, P) {
        const ctx = P.ctx;
        P.paper(g.W, g.H, { oy: -g.cam });
        ctx.save(); ctx.translate(0, g.cam);
        const yOf = i => g.H - 60 - i * BH;
        P.line(0, yOf(0) + BH, g.W, yOf(0) + BH, { w: 2.6 });
        const from = Math.max(0, g.tower.length - 22);
        g.tower.slice(from).forEach((b, j) => {
          const i = from + j, y = yOf(i) + 1;
          P.rect(b.x, y, b.w, BH - 2, { w: 1.8 });
          if (i % 3 === 0) P.hatchRect(b.x, y, b.w, BH - 2, { a: .22, gap: 6 });
          else if (i % 3 === 1) P.line(b.x + 6, y + BH / 2, b.x + b.w - 6, y + BH / 2, { a: .25, w: 1 });
        });
        if (g.cur) { const y = yOf(g.tower.length) + 1; P.rect(g.cur.x, y, g.cur.w, BH - 2, { w: 2.2 }); P.hatchRect(g.cur.x, y, g.cur.w, BH - 2, { a: .4, gap: 4 }); }
        for (const ch of g.chips) { ctx.save(); ctx.translate(ch.x + ch.w / 2, ch.y + BH / 2); ctx.rotate(ch.rot); P.rect(-ch.w / 2, -BH / 2, ch.w, BH - 2, { a: .6 }); ctx.restore(); }
        dust.draw(P);
        ctx.restore();
        if (g.flash > 0) P.text('perfect!', g.W / 2, 60, { size: 40, a: Math.min(1, g.flash * 3) });
        P.text(String(g.score), g.W - 30, 40, { size: 48, align: 'right', a: .3 });
      },
    });
  },
});
