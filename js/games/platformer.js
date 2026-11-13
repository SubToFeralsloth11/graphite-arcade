Games.register({
  id: 'platformer',
  title: 'Sketch Quest',
  blurb: 'Run, jump and stomp through endless hand-drawn levels.',
  group: 'arcade',
  tags: ['solo', 'platformer', 'endless'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M4 70 H50 M70 70 H116 M50 70 V78 M70 70 V78"/><circle cx="30" cy="30" r="6"/><path d="M30 36 V52 M30 52 l-7 12 M30 52 l8 10 M30 42 l-9 5 M30 42 l9 -6"/><path d="M78 58 l5 -8 l5 8 l5 -8 l5 8"/><path d="M104 70 V30 l-14 6 l14 6"/><circle cx="62" cy="40" r="4" class="fill"/></svg>`,
  help: 'Arrows or A/D to run, Up, W or Space to jump (hold for higher jumps). Stomp on scribble blobs to squash them, grab coins, avoid spikes and pits, and touch the flag to finish the level. Levels get longer and nastier. You have 3 lives; the halfway flag is a checkpoint.',
  mount(root, signal) {
    const T = 30, ROWS = 14, G = 1900, RUN = 230, JUMP = 650;
    const dust = Dust();
    let seed = rand(1e9);

    function build(n) {
      const rng = seeded(seed + n * 7919);
      const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
      const len = 90 + n * 25;
      const map = Array.from({ length: ROWS }, () => Array(len).fill(' '));
      const ents = [], coins = [];
      let h = 3, x = 0, cp = null;
      const col = (c, hh) => { for (let r = ROWS - hh; r < ROWS; r++) map[r][c] = '#'; };
      while (x < 8) col(x++, h);
      while (x < len - 12) {
        if (!cp && x > len / 2) { cp = { x: x * T + 5, y: (ROWS - h - 1) * T }; map[ROWS - h - 1][x] = 'C'; col(x++, h); col(x++, h); continue; }
        const f = rng();
        if (f < .25) { // flat run, maybe enemy and coins
          const w = ri(4, 7);
          for (let i = 0; i < w; i++) col(x + i, h);
          if (rng() < .4 + n * .08) ents.push({ x: (x + ri(1, w - 2)) * T, y: (ROWS - h - 1) * T + 6, w: 24, h: 24, vx: rng() < .5 ? -55 - n * 6 : 55 + n * 6, dead: 0 });
          if (rng() < .5) for (let i = 1; i < w - 1; i++) coins.push({ x: (x + i) * T + T / 2, y: (ROWS - h - 2.5) * T });
          x += w;
        } else if (f < .45) { // step up or down
          h = clamp(h + (rng() < .5 ? -1 : 1) * ri(1, 2), 2, 7);
          const w = ri(2, 4); for (let i = 0; i < w; i++) col(x + i, h); x += w;
        } else if (f < .65) { // gap, sometimes with a floating platform and coins over it
          const w = ri(2, Math.min(4, 2 + (n >> 1)));
          if (w >= 3 && rng() < .6) {
            const py = ROWS - h - 3;
            for (let i = 0; i < w; i++) { map[py][x + i] = '='; coins.push({ x: (x + i) * T + T / 2, y: (py - 1) * T + T / 2 }); }
          }
          x += w; h = clamp(h + ri(-1, 1), 2, 6); col(x++, h); col(x++, h);
        } else if (f < .8) { // spikes
          const w = ri(1, n > 2 ? 3 : 2);
          col(x++, h);
          for (let i = 0; i < w; i++) { col(x, h); map[ROWS - h - 1][x] = '^'; x++; }
          col(x++, h);
        } else if (f < .9) { // spring up to a high ledge
          col(x, h); map[ROWS - h - 1][x] = 'S'; x++;
          const hh = Math.min(10, h + 4), w = ri(3, 5);
          for (let i = 0; i < w; i++) { map[ROWS - hh][x + 1 + i] = '='; coins.push({ x: (x + 1 + i) * T + T / 2, y: (ROWS - hh - 1) * T + T / 2 }); }
          for (let i = 0; i < w + 2; i++) col(x + i, h);
          x += w + 2;
        } else { // staircase of floating blocks
          const steps = ri(2, 3);
          for (let i = 0; i < steps; i++) { map[ROWS - h - 2 - i * 2][x + i * 2] = '='; map[ROWS - h - 2 - i * 2][x + i * 2 + 1] = '='; }
          for (let i = 0; i < steps * 2 + 1; i++) col(x + i, h);
          coins.push({ x: (x + steps * 2) * T, y: (ROWS - h - 3 - steps * 2) * T });
          x += steps * 2 + 1;
        }
      }
      while (x < len) col(x++, h);
      const flag = { x: (len - 5) * T, y: (ROWS - h - 4) * T, w: 12, h: 4 * T };
      return { map, len, ents, coins, flag, cp, start: { x: 2 * T, y: (ROWS - 4 - 1) * T } };
    }

    const tileAt = (L, x, y) => { const c = Math.floor(x / T), r = Math.floor(y / T); if (c < 0 || c >= L.len) return '#'; if (r < 0) return ' '; if (r >= ROWS) return ' '; return L.map[r][c]; };
    const solid = ch => ch === '#' || ch === '=';

    function loadLevel(g, n) {
      g.level = n; g.L = build(n);
      g.spawn = { ...g.L.start };
      g.timeLeft = 120 + n * 20;
      respawn(g);
      g.info = `level ${n} · ♥ ${g.lives}`;
    }
    function respawn(g) {
      g.p = { x: g.spawn.x, y: g.spawn.y, w: 18, h: 26, vx: 0, vy: 0, ground: false, coyote: 0, buffer: 0, face: 1, run: 0, inv: 1 };
      g.cam = Math.max(0, g.p.x - 200);
    }
    function hurt(g) {
      if (g.p.inv > 0) return;
      g.lives--; Sfx.bad(); dust.burst(g.p.x + 9, g.p.y + 13, 20, 200);
      g.info = `level ${g.level} · ♥ ${g.lives}`;
      if (g.lives <= 0) return g.end({ win: false, title: 'Out of lives', msg: `You reached level ${g.level}.` });
      respawn(g);
    }

    // Collision against each tile's actual box: '#' fills the tile, '=' is the thin plank drawn at y+2..y+14.
    const PLANK_TOP = 2, PLANK_H = 12;
    function boxes(g, o) {
      const out = [];
      const c0 = Math.floor(o.x / T), c1 = Math.floor((o.x + o.w) / T), r0 = Math.floor(o.y / T), r1 = Math.floor((o.y + o.h) / T);
      for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) {
        const ch = c < 0 || c >= g.L.len ? '#' : r < 0 || r >= ROWS ? ' ' : g.L.map[r][c];
        if (ch === '#') out.push({ x: c * T, y: r * T, w: T, h: T });
        else if (ch === '=') out.push({ x: c * T, y: r * T + PLANK_TOP, w: T, h: PLANK_H });
      }
      return out.filter(b => hit(o, b));
    }
    function moveX(g, o, dx) {
      o.x += dx;
      let hitAny = false;
      for (const b of boxes(g, o)) {
        if (dx > 0) o.x = Math.min(o.x, b.x - o.w - .01);
        else if (dx < 0) o.x = Math.max(o.x, b.x + b.w + .01);
        hitAny = true;
      }
      return hitAny;
    }
    function moveY(g, o, dy) {
      o.y += dy;
      let res = 0;
      for (const b of boxes(g, o)) {
        if (dy > 0) { o.y = Math.min(o.y, b.y - o.h); res = 1; }
        else if (dy < 0) { o.y = Math.max(o.y, b.y + b.h); res = -1; }
      }
      return res;
    }

    Arcade.mount(root, signal, {
      id: 'platformer', title: 'Sketch Quest', h: 420,
      intro: 'Reach the flag at the end of each level. Stomp the blobs!',
      keysHelp: '←/→ or A/D run · ↑, W or Space jump · P pause',
      pads: [['left', '◀'], ['right', '▶'], ['up', 'jump']],
      init(g) { seed = rand(1e9); g.lives = 3; loadLevel(g, 1); },
      update(g, dt) {
        const p = g.p, k = g.keys;
        p.inv = Math.max(0, p.inv - dt);
        const dir = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
        const accel = p.ground ? 2200 : 1300;
        if (dir) { p.vx = clamp(p.vx + dir * accel * dt, -RUN, RUN); p.face = dir; }
        else p.vx *= p.ground ? Math.pow(.0005, dt) : Math.pow(.2, dt);
        if (g.pressed.has('up') || g.pressed.has('fire')) p.buffer = .12;
        p.buffer -= dt; p.coyote -= dt;
        if (p.buffer > 0 && p.coyote > 0) { p.vy = -JUMP; p.buffer = 0; p.coyote = 0; p.ground = false; Sfx.tap(); }
        const holding = k.has('up') || k.has('fire');
        p.vy += G * dt * (p.vy < 0 && !holding ? 2.2 : 1);
        p.vy = Math.min(p.vy, 900);
        moveX(g, p, p.vx * dt);
        if (p.x < g.cam) { p.x = g.cam; p.vx = 0; }
        const wasGround = p.ground;
        const c = moveY(g, p, p.vy * dt);
        p.ground = c === 1;
        if (c) p.vy = 0;
        if (p.ground) { p.coyote = .1; if (!wasGround) dust.burst(p.x + 9, p.y + p.h, 5, 60); }
        p.run += Math.abs(p.vx) * dt * .05;

        // tile hazards and pickups under the player
        for (const [xx, yy] of [[p.x + 4, p.y + p.h - 4], [p.x + p.w - 4, p.y + p.h - 4], [p.x + 9, p.y + 6]]) {
          const ch = tileAt(g.L, xx, yy);
          if (ch === '^' && (yy % T) > T * .4) return hurt(g);
          if (ch === 'S' && p.vy >= 0) { p.vy = -JUMP * 1.55; Sfx.good(); dust.burst(xx, yy, 8); }
          if (ch === 'C' && g.spawn.x !== g.L.cp.x) { g.spawn = { ...g.L.cp }; toast('Checkpoint!'); Sfx.good(); }
        }
        if (p.y > ROWS * T + 40) return hurt(g);

        for (const cn of g.L.coins) if (!cn.got && Math.abs(cn.x - (p.x + 9)) < 18 && Math.abs(cn.y - (p.y + 13)) < 22) { cn.got = true; g.score += 10; Sfx.tap(); dust.burst(cn.x, cn.y, 6, 80); }
        for (const e of g.L.ents) {
          if (e.dead) { e.dead += dt; continue; }
          if (Math.abs(e.x - p.x) > 900) continue;
          const vx = e.vx * dt;
          const ahead = e.vx > 0 ? e.x + e.w + 2 : e.x - 2;
          if (moveX(g, e, vx) || !solid(tileAt(g.L, ahead, e.y + e.h + 4))) e.vx *= -1;
          if (hit(p, e)) {
            if (p.vy > 50 && p.y + p.h - e.y < 16) { e.dead = .01; p.vy = -JUMP * .6; g.score += 50; Sfx.good(); dust.burst(e.x + 12, e.y + 12, 14); }
            else hurt(g);
          }
        }
        if (hit(p, g.L.flag)) {
          const bonus = 200 + Math.round(g.timeLeft) * 2;
          g.score += bonus; Sfx.win(); celebrate(12); toast(`Level ${g.level} clear! +${bonus}`);
          loadLevel(g, g.level + 1);
          return;
        }
        g.timeLeft -= dt;
        if (g.timeLeft <= 0) { g.timeLeft = 60; hurt(g); }
        g.cam += (clamp(p.x - 260, 0, g.L.len * T - g.W) - g.cam) * Math.min(1, dt * 8);
        dust.update(dt);
      },
      draw(g, P) {
        const { L, p } = g, cam = Math.round(g.cam), ctx = P.ctx;
        P.paper(g.W, g.H, { ox: cam * .3 });
        // far hills (parallax)
        for (let i = -1; i < 5; i++) { const hx = i * 260 - (cam * .3) % 260; P.line(hx, 330, hx + 130, 230, { a: .18 }); P.line(hx + 130, 230, hx + 260, 330, { a: .18 }); }
        const c0 = Math.floor(cam / T), c1 = Math.min(L.len, c0 + Math.ceil(g.W / T) + 2);
        for (let c = c0; c < c1; c++) {
          const x = c * T - cam;
          let topR = -1;
          for (let r = 0; r < ROWS; r++) {
            const ch = L.map[r][c], y = r * T;
            if (ch === '#') {
              if (topR < 0) topR = r;
              if (r === 0 || L.map[r - 1][c] !== '#') P.line(x, y, x + T, y, { w: 2.4 });
              if (c > 0 && L.map[r][c - 1] !== '#') P.line(x, y, x, y + T, { a: .6 });
              if (c < L.len - 1 && L.map[r][c + 1] !== '#') P.line(x + T, y, x + T, y + T, { a: .6 });
            } else if (ch === '=') {
              P.rect(x + 1, y + 2, T - 2, 12, { w: 1.8 }); P.hatchRect(x + 1, y + 2, T - 2, 12, { a: .3, gap: 4 });
            } else if (ch === '^') {
              P.poly([[x + 2, y + T], [x + 8, y + 12], [x + 14, y + T], [x + 20, y + 12], [x + 28, y + T]], { closed: false });
            } else if (ch === 'S') {
              P.poly([[x + 4, y + T], [x + 26, y + T - 4], [x + 4, y + T - 8], [x + 26, y + T - 12], [x + 4, y + T - 16]], { closed: false, w: 1.8 });
              P.line(x + 2, y + T - 18, x + 28, y + T - 18, { w: 3 });
            } else if (ch === 'C') {
              const on = g.spawn.x === L.cp.x;
              P.line(x + 8, y + T, x + 8, y - 20); P.poly([[x + 8, y - 20], [x + 26, y - 13], [x + 8, y - 6]]);
              if (on) P.hatch(c => { c.moveTo(x + 8, y - 20); c.lineTo(x + 26, y - 13); c.lineTo(x + 8, y - 6); }, [x + 8, y - 20, 18, 14], { a: .6, gap: 3 });
            }
          }
          if (topR >= 0) P.hatchRect(x, topR * T, T, (ROWS - topR) * T, { a: .16, gap: 7 });
        }
        for (const cn of L.coins) {
          if (cn.got || cn.x < cam - 20 || cn.x > cam + g.W + 20) continue;
          const bob = Math.sin(g.t * 4 + cn.x) * 3, sq = Math.abs(Math.cos(g.t * 3 + cn.x));
          ctx.save(); ctx.translate(cn.x - cam, cn.y + bob); ctx.scale(.35 + sq * .65, 1);
          P.circle(0, 0, 8, { w: 1.8 }); P.line(0, -4, 0, 4, { w: 1.4 });
          ctx.restore();
        }
        for (const e of L.ents) {
          if (e.dead > .4 || e.x < cam - 40 || e.x > cam + g.W + 40) continue;
          const x = e.x - cam, y = e.y, sq = e.dead ? .3 : 1 + Math.sin(g.t * 10) * .06;
          ctx.save(); ctx.translate(x + 12, y + 24); ctx.scale(1 / sq, sq);
          P.circle(0, -12, 12); P.hatchCircle(0, -12, 11, { a: .45, gap: 3, cross: true });
          ctx.fillStyle = '#f5f2e9'; ctx.fillRect(-7 + (e.vx > 0 ? 3 : -1), -17, 5, 6); ctx.fillRect(1 + (e.vx > 0 ? 3 : -1), -17, 5, 6);
          ctx.restore();
        }
        const f = L.flag;
        if (f.x - cam < g.W + 40) {
          const fx = f.x - cam;
          P.line(fx, f.y, fx, f.y + f.h, { w: 2.6 });
          const wv = Math.sin(g.t * 5) * 4;
          P.poly([[fx, f.y], [fx + 40, f.y + 10 + wv], [fx, f.y + 22]]);
          P.hatch(c => { c.moveTo(fx, f.y); c.lineTo(fx + 40, f.y + 10 + wv); c.lineTo(fx, f.y + 22); }, [fx, f.y, 40, 24], { a: .5, gap: 3 });
        }
        // stick figure hero
        if (!(p.inv > 0 && Math.floor(g.t * 12) % 2)) {
          const x = p.x - cam + 9, y = p.y, s = p.face, ph = p.run;
          const legA = p.ground ? Math.sin(ph) * 8 : 6, legB = p.ground ? -Math.sin(ph) * 8 : -4;
          P.circle(x, y + 5, 5.5, { w: 2.2 });
          P.line(x + s * 2, y + 3, x + s * 4, y + 4, { w: 1.5 });
          P.line(x, y + 11, x - s * 1, y + 19, { w: 2.4 });
          P.line(x - s, y + 19, x - s + legA, y + p.h, { w: 2.2 }); P.line(x - s, y + 19, x - s + legB, y + p.h, { w: 2.2 });
          const arm = p.ground ? Math.sin(ph) * 6 : -6;
          P.line(x, y + 13, x - arm, y + 18, { w: 2 }); P.line(x, y + 13, x + arm + s * 3, y + 17 - (p.ground ? 0 : 8), { w: 2 });
        }
        dust.draw(P, cam);
        P.text(`⏱ ${Math.max(0, Math.ceil(g.timeLeft))}`, g.W - 14, 22, { size: 24, align: 'right' });
      },
    });
  },
});
