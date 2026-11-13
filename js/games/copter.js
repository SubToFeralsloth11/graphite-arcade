Games.register({
  id: 'copter',
  title: 'Pencil Copter',
  blurb: 'Hold to climb, let go to drop. Thread a doodled chopper through a cave that keeps closing in.',
  group: 'arcade',
  tags: ['solo', 'one-button', 'endless'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M0 14 Q30 24 60 10 T120 16 V0 H0 Z" class="fill"/><path d="M0 70 Q30 58 60 68 T120 62 V80 H0 Z" class="fill"/><path d="M34 28 H74 M54 28 V34"/><ellipse cx="54" cy="42" rx="13" ry="8"/><path d="M41 41 H22 M22 35 V47"/><path d="M48 50 l-3 5 M60 50 l3 5 M41 55 H68"/><rect x="92" y="30" width="10" height="24" class="fill"/></svg>`,
  help: 'Hold Space, Up, the climb pad, or press and hold anywhere on the cave to lift the copter; let go to sink. The cave narrows, twists harder and scrolls faster the further you fly, and pencil-stub pillars start blocking the way. Grab stars for 25 bonus points each. Touching anything ends the flight.',
  mount(root, signal) {
    const dust = Dust();
    const SEG = 24, PX = 160;
    const holding = g => g.keys.has('fire') || g.keys.has('up') || g.ptr.down;

    /** Grow the cave ahead of the camera: a wandering centre line, a gap that shrinks with distance, plus pillars and stars. */
    function extend(g) {
      for (let last = g.cave[g.cave.length - 1]; last.x < g.scroll + g.W + SEG * 2; last = g.cave[g.cave.length - 1]) {
        const x = last.x + SEG;
        const gap = Math.max(118, 300 - x * .011);
        if (x > 900) {
          const wig = Math.min(10, 2.5 + x * .0004);
          g.cv = clamp(g.cv + (Math.random() - .5) * wig * .9, -wig, wig);
        }
        let c = g.center + g.cv;
        const lo = 16 + gap / 2, hi = g.H - 16 - gap / 2;
        if (c < lo) { c = lo; g.cv = Math.abs(g.cv); }
        if (c > hi) { c = hi; g.cv = -Math.abs(g.cv); }
        g.center = c;
        const jag = x > 600 ? 5 : 0;
        const seg = { x, top: c - gap / 2 + (Math.random() - .5) * jag, bot: c + gap / 2 + (Math.random() - .5) * jag };
        g.cave.push(seg);
        if (x > 1600 && x >= g.nextBlock) {
          g.nextBlock = x + Math.max(240, 760 - x * .014) + rand(260);
          if (Math.random() < .5) {
            const h = clamp(gap * .3, 34, 70), off = (Math.random() - .5) * (gap - h) * .5;
            g.blocks.push({ x, y: c - h / 2 + off, w: 22, h, hang: 0 });
          } else {
            const h = clamp(gap * .42, 40, 100), up = Math.random() < .5;
            g.blocks.push({ x, y: up ? seg.top - 30 : seg.bot - h, w: 22, h: h + 30, hang: up ? 1 : -1 });
          }
        } else if (x > 500 && Math.random() < .03 && !g.blocks.some(b => Math.abs(b.x - x) < 80)) {
          g.stars.push({ x, y: c + (Math.random() - .5) * gap * .5 });
        }
      }
      while (g.cave[1].x < g.scroll - SEG) g.cave.shift();
      g.blocks = g.blocks.filter(b => b.x > g.scroll - 40);
      g.stars = g.stars.filter(s => s.x > g.scroll - 30 && !s.got);
    }

    function caveAt(g, wx) {
      const cv = g.cave, i = clamp(Math.floor((wx - cv[0].x) / SEG), 0, cv.length - 2), a = cv[i], b = cv[i + 1], f = clamp((wx - a.x) / SEG, 0, 1);
      return { top: a.top + (b.top - a.top) * f, bot: a.bot + (b.bot - a.bot) * f };
    }

    function crash(g) {
      const p = g.p;
      dust.burst(PX, p.y, 34, 230); Sfx.bad();
      g.dead = true;
      g.end({ win: false, title: 'Crashed', msg: `You flew ${Math.floor(g.scroll / 10)} m and grabbed ${g.got} star${g.got === 1 ? '' : 's'}.` });
    }

    Arcade.mount(root, signal, {
      id: 'copter', title: 'Pencil Copter', h: 420,
      intro: 'Hold to climb, release to fall. How far can you fly?',
      keysHelp: 'Hold Space / ↑ / click / touch to climb · P pause',
      pads: [['up', 'hold to climb']],
      init(g) {
        g.p = { y: g.H / 2, vy: 0, tilt: 0 };
        g.scroll = 0; g.go = false; g.dead = false; g.cv = 0; g.center = g.H / 2; g.bonus = 0; g.got = 0; g.nextBlock = 0; g.nextMile = 500;
        g.cave = [{ x: -SEG * 3, top: 60, bot: g.H - 60 }]; g.blocks = []; g.stars = []; g.smoke = []; g.smokeT = 0;
        extend(g);
        g.info = '0 m';
      },
      update(g, dt) {
        const p = g.p, hold = holding(g);
        dust.update(dt);
        for (const s of g.smoke) s.life -= dt;
        g.smoke = g.smoke.filter(s => s.life > 0);
        if (!g.go) {
          p.y = g.H / 2 + Math.sin(g.t * 3) * 6;
          if (!hold) return;
          g.go = true; p.vy = -120;
        }
        g.speed = 230 + Math.min(230, g.scroll * .006);
        g.scroll += g.speed * dt;
        p.vy = clamp(p.vy + (hold ? -1050 : 880) * dt, -330, 380);
        p.y += p.vy * dt;
        p.tilt += (clamp(p.vy / 1000, -.28, .34) - p.tilt) * Math.min(1, dt * 10);
        extend(g);

        const wx = g.scroll + PX;
        for (const ox of [-18, -4, 10, 20]) {
          const c = caveAt(g, wx + ox);
          if (p.y - 9 < c.top || p.y + 11 > c.bot) return crash(g);
        }
        const box = { x: wx - 20, y: p.y - 9, w: 40, h: 19 };
        for (const b of g.blocks) if (hit(box, b)) return crash(g);
        for (const s of g.stars) if (!s.got && Math.hypot(s.x - wx, s.y - p.y) < 24) {
          s.got = true; g.got++; g.bonus += 25; Sfx.good(); dust.burst(PX + s.x - wx, s.y, 12, 140);
        }
        if ((g.smokeT -= dt) <= 0) { g.smokeT = .06; g.smoke.push({ x: wx - 26, y: p.y + 2, life: .9, r: 2 + Math.random() * 2 }); }

        const m = Math.floor(g.scroll / 10);
        if (m >= g.nextMile) { toast(`${g.nextMile} m!`); Sfx.good(); g.nextMile += 500; }
        g.score = m + g.bonus;
        g.info = `${m} m`;
      },
      draw(g, P) {
        const ctx = P.ctx, p = g.p, cv = g.cave;
        P.paper(g.W, g.H, { ox: g.scroll });
        // Terrain is drawn in world coordinates under a camera transform so the pencil wobble stays put while it scrolls.
        ctx.save(); ctx.translate(-g.scroll, 0);
        const x0 = cv[0].x, x1 = cv[cv.length - 1].x;
        const topPath = c => { c.moveTo(x0, 0); for (const s of cv) c.lineTo(s.x, s.top); c.lineTo(x1, 0); c.closePath(); };
        const botPath = c => { c.moveTo(x0, g.H); for (const s of cv) c.lineTo(s.x, s.bot); c.lineTo(x1, g.H); c.closePath(); };
        ctx.fillStyle = INK(.06);
        ctx.beginPath(); topPath(ctx); ctx.fill();
        ctx.beginPath(); botPath(ctx); ctx.fill();
        P.hatch(topPath, [x0, 0, x1 - x0, g.H], { a: .26, gap: 6 });
        P.hatch(botPath, [x0, 0, x1 - x0, g.H], { a: .26, gap: 6 });
        for (let i = 1; i < cv.length; i++) {
          P.line(cv[i - 1].x, cv[i - 1].top, cv[i].x, cv[i].top, { w: 2.4 });
          P.line(cv[i - 1].x, cv[i - 1].bot, cv[i].x, cv[i].bot, { w: 2.4 });
        }
        for (const b of g.blocks) {
          ctx.fillStyle = '#f5f2e9'; ctx.fillRect(b.x, b.y, b.w, b.h);
          P.rect(b.x, b.y, b.w, b.h, { w: 2.2 });
          P.hatchRect(b.x, b.y, b.w, b.h, { a: .45, gap: 4 });
          P.line(b.x + b.w / 3, b.y + 4, b.x + b.w / 3, b.y + b.h - 4, { w: 1, a: .4 });
          P.line(b.x + b.w * 2 / 3, b.y + 4, b.x + b.w * 2 / 3, b.y + b.h - 4, { w: 1, a: .4 });
          if (b.hang) {
            const tipY = b.hang > 0 ? b.y + b.h : b.y, d = b.hang * 16;
            P.poly([[b.x, tipY], [b.x + b.w / 2, tipY + d], [b.x + b.w, tipY]], { w: 2 });
            P.hatch(c => { c.moveTo(b.x + b.w / 2 - 4, tipY + d * .75); c.lineTo(b.x + b.w / 2, tipY + d); c.lineTo(b.x + b.w / 2 + 4, tipY + d * .75); }, [b.x, Math.min(tipY, tipY + d), b.w, 16], { a: .9, gap: 2 });
          }
        }
        for (const s of g.stars) P.text('★', s.x, s.y + Math.sin(g.t * 4 + s.x) * 3, { size: 28 });
        ctx.lineWidth = 1.2;
        for (const s of g.smoke) {
          ctx.strokeStyle = INK(s.life * .35);
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r + (1 - s.life) * 9, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();

        if (!g.dead) {
          ctx.save(); ctx.translate(PX, p.y); ctx.rotate(p.tilt);
          P.line(-12, -1, -36, -4, { w: 2.4 }); P.line(-12, 4, -36, -1, { w: 1.6 });
          const tr = 7 * Math.cos(g.t * 40);
          P.line(-36, -2 - tr, -36, -2 + tr, { w: 1.6, r: .4 });
          ctx.save(); ctx.scale(1.4, .82);
          ctx.fillStyle = '#f5f2e9'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
          P.circle(0, 0, 11, { w: 2.2 }); P.hatchCircle(-2, 0, 10, { a: .35, gap: 4 });
          ctx.restore();
          P.line(3, -7, 13, -1, { w: 1.6 });
          P.line(-8, 9, -10, 14, { w: 1.6 }); P.line(8, 9, 10, 14, { w: 1.6 }); P.line(-16, 14, 16, 14, { w: 2 });
          P.line(0, -9, 0, -14, { w: 2 });
          const L = 26 * Math.abs(Math.cos(g.t * 26)) + 4;
          P.line(-L, -14, L, -14, { w: 2.4, r: .4 });
          ctx.restore();
        }
        dust.draw(P);
        if (!g.go) P.text('hold to fly', g.W / 2, g.H / 2 + 70, { size: 32, a: .5 });
      },
    });
  },
});
