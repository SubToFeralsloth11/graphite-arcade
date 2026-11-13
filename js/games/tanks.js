Games.register({
  id: 'tanks',
  title: 'Paper Tanks',
  blurb: 'Roll a pencil tank around a walled sheet and out-shoot waves of AI tanks with bouncing shells.',
  group: 'arcade',
  tags: ['solo', 'shooter', 'waves'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><rect x="14" y="40" width="34" height="22"/><path d="M12 36 h38 M12 66 h38"/><circle cx="31" cy="51" r="7"/><path d="M38 51 H62"/><path d="M68 51 L92 30 L110 46" stroke-dasharray="4 5"/><rect x="74" y="8" width="16" height="16" class="fill"/><rect x="92" y="58" width="22" height="14" class="fill"/></svg>`,
  help: 'Left/right (A/D) turn your tank, up/down (W/S) drive forward and back. The turret follows your mouse once you move it over the page, otherwise it points where you are driving. Fire with Space, a click, or by tapping where you want to shoot (holding keeps firing). Shells bounce off walls once, so bank shots around cover, but your own ricochets can hit you too. Destroy every enemy to clear a wave: grey tanks sit still, tan ones roam, striped ones bank their shots off walls, dark ones are fast and fire in pairs, and big heavies take four hits. You have 3 hearts and get one back for each cleared wave (up to 5).',
  mount(root, signal) {
    const dust = Dust();
    const W = 720, H = 420, C = 30, TAU = Math.PI * 2;
    const LAYOUTS = [
      [[7, 3, 1, 4], [16, 7, 1, 4], [11, 6, 2, 2]],
      [[6, 2, 1, 4], [6, 8, 1, 4], [17, 2, 1, 4], [17, 8, 1, 4], [10, 6, 4, 2]],
      [[4, 3, 4, 1], [16, 10, 4, 1], [11, 1, 2, 4], [11, 9, 2, 4]],
      [[6, 3, 3, 3], [15, 8, 3, 3], [15, 3, 3, 1], [6, 10, 3, 1]],
      [[8, 2, 1, 10], [15, 2, 1, 10], [11, 6, 2, 2]],
      [[4, 3, 6, 1], [14, 3, 6, 1], [4, 10, 6, 1], [14, 10, 6, 1], [11, 5, 2, 4]],
      [[5, 5, 1, 4], [9, 1, 1, 4], [9, 9, 1, 4], [14, 5, 1, 4], [18, 1, 1, 4], [18, 9, 1, 4]],
    ];
    const KINDS = {
      grey:   { speed: 0,   fire: 2.4, bounces: 1, shell: 220, hp: 1, max: 1, bank: false, dodge: 0,  pts: 50,  r: 14 },
      tan:    { speed: 55,  fire: 1.9, bounces: 1, shell: 240, hp: 1, max: 1, bank: false, dodge: .3, pts: 75,  r: 14 },
      stripe: { speed: 45,  fire: 2.1, bounces: 2, shell: 250, hp: 1, max: 2, bank: true,  dodge: .5, pts: 120, r: 14 },
      dark:   { speed: 115, fire: 1.3, bounces: 0, shell: 330, hp: 2, max: 2, bank: false, dodge: .9, pts: 160, r: 14, burst: 2, lead: true },
      heavy:  { speed: 35,  fire: 1.5, bounces: 1, shell: 270, hp: 4, max: 3, bank: true,  dodge: 0,  pts: 260, r: 18 },
    };
    const EDGE = [{ x: -40, y: -40, w: W + 80, h: 46 }, { x: -40, y: H - 6, w: W + 80, h: 46 }, { x: -40, y: -40, w: 46, h: H + 80 }, { x: W - 6, y: -40, w: 46, h: H + 80 }];

    const circRect = (x, y, r, b) => { const nx = clamp(x, b.x, b.x + b.w), ny = clamp(y, b.y, b.y + b.h); return (x - nx) ** 2 + (y - ny) ** 2 < r * r; };
    const inWall = (g, x, y, r) => g.walls.some(b => circRect(x, y, r, b));
    const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
    const turn = (a, target, max) => a + clamp(angDiff(a, target), -max, max);
    const info = g => `wave ${g.wave} · ♥ ${g.lives} · ${g.foes.length} left`;

    function startWave(g) {
      g.wave++;
      let li; do { li = rand(LAYOUTS.length); } while (li === g.layout && LAYOUTS.length > 1);
      g.layout = g.wave === 1 ? 0 : li;
      g.blocks = LAYOUTS[g.layout].map(([x, y, w, h]) => ({ x: x * C, y: y * C, w: w * C, h: h * C }));
      g.walls = [...EDGE, ...g.blocks];
      g.shells = []; g.marks = []; g.scorch = [];
      Object.assign(g.player, { x: 60, y: H / 2, a: 0, ta: 0, inv: 1, cd: .4 });
      const pool = ['grey', 'tan'];
      if (g.wave >= 3) pool.push('stripe');
      if (g.wave >= 5) pool.push('dark');
      if (g.wave >= 7) pool.push('heavy');
      const n = Math.min(8, 1 + Math.ceil(g.wave * .7));
      const list = [pool[pool.length - 1]];
      while (list.length < n) list.push(pick(pool));
      g.foes = [];
      for (const kind of list) {
        const k = KINDS[kind];
        for (let tries = 0; tries < 300; tries++) {
          const x = 330 + rand(360), y = 30 + rand(H - 60);
          if (inWall(g, x, y, k.r + 8) || Math.hypot(x - g.player.x, y - g.player.y) < 260 || g.foes.some(f => Math.hypot(f.x - x, f.y - y) < 60)) continue;
          g.foes.push({ kind, x, y, r: k.r, a: Math.PI, ta: Math.PI, hp: k.hp, cd: 1.2 + Math.random() * 1.5, think: 0, aimT: Math.random() * .2, scan: Math.random() * TAU, trail: 0, odo: 0, stuck: 0, shot: null, kick: 0, fired: 0, tx: x, ty: y });
          break;
        }
      }
      g.rate = Math.max(.55, 1 - g.wave * .035);
      g.phase = 'intro'; g.timer = 1.6;
      g.info = info(g);
    }

    function tanks(g) { return [g.player, ...g.foes]; }

    function drive(g, t, dist) {
      const dx = Math.cos(t.a) * dist, dy = Math.sin(t.a) * dist, all = tanks(g);
      const blocked = (x, y) => inWall(g, x, y, t.r) || all.some(o => o !== t && (o.x - x) ** 2 + (o.y - y) ** 2 < (o.r + t.r) ** 2);
      let moved = 0;
      if (!blocked(t.x + dx, t.y)) { t.x += dx; moved += Math.abs(dx); }
      if (!blocked(t.x, t.y + dy)) { t.y += dy; moved += Math.abs(dy); }
      t.odo += moved * Math.sign(dist); t.trail += moved;
      if (t.trail > 8) { t.trail = 0; g.marks.push({ x: t.x, y: t.y, a: t.a, r: t.r }); if (g.marks.length > 600) g.marks.shift(); }
      return moved;
    }

    function fire(g, t, speed, bounces) {
      const mx = t.x + Math.cos(t.ta) * (t.r + 8), my = t.y + Math.sin(t.ta) * (t.r + 8);
      t.kick = 1;
      if (inWall(g, mx, my, 3)) { dust.burst(mx, my, 4, 50); return; }
      g.shells.push({ x: mx, y: my, vx: Math.cos(t.ta) * speed, vy: Math.sin(t.ta) * speed, b: bounces, owner: t, age: 0 });
      dust.burst(mx, my, 3, 40); Sfx.tap();
    }

    /** Simulate a shell from tank t along ang. True if it would reach the player before fading or hitting another enemy. */
    function trace(g, t, ang, bounces) {
      let x = t.x + Math.cos(ang) * (t.r + 8), y = t.y + Math.sin(ang) * (t.r + 8), vx = Math.cos(ang) * 6, vy = Math.sin(ang) * 6, b = bounces;
      if (inWall(g, x, y, 3)) return false;
      const p = g.player;
      for (let i = 0; i < 300; i++) {
        x += vx; if (inWall(g, x, y, 3)) { x -= vx; vx = -vx; if (--b < 0) return false; }
        y += vy; if (inWall(g, x, y, 3)) { y -= vy; vy = -vy; if (--b < 0) return false; }
        if ((x - p.x) ** 2 + (y - p.y) ** 2 < (p.r + 2) ** 2) return true;
        for (const f of g.foes) if ((f !== t || i > 8) && (x - f.x) ** 2 + (y - f.y) ** 2 < (f.r + 5) ** 2) return false;
      }
      return false;
    }

    function findShot(g, f, k) {
      const p = g.player;
      if (f.shot != null && trace(g, f, f.shot, k.bounces)) return f.shot;
      let tx = p.x, ty = p.y;
      if (k.lead) { const tt = Math.hypot(p.x - f.x, p.y - f.y) / k.shell; tx += p.vx * tt; ty += p.vy * tt; }
      const direct = Math.atan2(ty - f.y, tx - f.x) + (Math.random() - .5) * .08;
      if (trace(g, f, direct, k.bounces)) return direct;
      if (k.bank) for (let i = 0; i < 16; i++) {
        f.scan = (f.scan + TAU / 72) % TAU;
        if (trace(g, f, f.scan, k.bounces)) return f.scan;
      }
      return null;
    }

    function pickGoal(g, f) {
      const p = g.player;
      for (let i = 0; i < 20; i++) {
        let x, y;
        if (Math.random() < .6) { const a = Math.random() * TAU, d = 170 + rand(120); x = p.x + Math.cos(a) * d; y = p.y + Math.sin(a) * d; }
        else { const a = Math.random() * TAU, d = 50 + rand(120); x = f.x + Math.cos(a) * d; y = f.y + Math.sin(a) * d; }
        if (x < 30 || x > W - 30 || y < 30 || y > H - 30 || inWall(g, x, y, f.r + 6)) continue;
        f.tx = x; f.ty = y; f.stuck = 0; return;
      }
    }

    function hurt(g) {
      const p = g.player;
      if (p.inv > 0) return;
      g.lives--; p.inv = 1.5; Sfx.bad(); dust.burst(p.x, p.y, 22, 180);
      g.info = info(g);
      if (g.lives <= 0) { dust.burst(p.x, p.y, 40, 260); g.dead = true; g.end({ win: false, title: 'Tank down', msg: `You fell on wave ${g.wave}.` }); }
    }

    function updateFoe(g, f, dt) {
      const k = KINDS[f.kind], p = g.player;
      f.cd -= dt; f.think -= dt; f.aimT -= dt; f.kick = Math.max(0, f.kick - dt * 6);
      if (k.speed) {
        if (f.think <= 0) {
          f.think = .25 + Math.random() * .2;
          let threat = null;
          for (const s of g.shells) {
            if (s.owner !== p) continue;
            const dx = f.x - s.x, dy = f.y - s.y, d = Math.hypot(dx, dy), v = Math.hypot(s.vx, s.vy);
            if (d < 120 && (dx * s.vx + dy * s.vy) / (d * v) > .85) threat = s;
          }
          if (threat && Math.random() < k.dodge) {
            const v = Math.hypot(threat.vx, threat.vy), px = -threat.vy / v, py = threat.vx / v;
            const side = ((f.x - threat.x) * px + (f.y - threat.y) * py) >= 0 ? 1 : -1;
            f.tx = clamp(f.x + px * side * 70, 30, W - 30); f.ty = clamp(f.y + py * side * 70, 30, H - 30); f.stuck = 0;
          } else if (Math.hypot(f.tx - f.x, f.ty - f.y) < 16 || f.stuck > .5) pickGoal(g, f);
        }
        const want = Math.atan2(f.ty - f.y, f.tx - f.x);
        f.a = turn(f.a, want, 3.2 * dt);
        if (Math.abs(angDiff(f.a, want)) < .5) {
          const m = drive(g, f, k.speed * dt);
          f.stuck = m < k.speed * dt * .3 ? f.stuck + dt : 0;
        }
      }
      if (f.aimT <= 0) { f.aimT = .2; f.shot = findShot(g, f, k); }
      f.ta = turn(f.ta, f.shot ?? Math.atan2(p.y - f.y, p.x - f.x), 2.6 * dt);
      if (f.shot != null && f.cd <= 0 && Math.abs(angDiff(f.ta, f.shot)) < .06 && g.shells.filter(s => s.owner === f).length < k.max) {
        fire(g, f, k.shell, k.bounces);
        f.fired++;
        f.cd = k.burst && f.fired % k.burst ? .22 : k.fire * g.rate * (.8 + Math.random() * .4);
      }
    }

    function kill(g, f) {
      const k = KINDS[f.kind];
      g.foes.splice(g.foes.indexOf(f), 1);
      g.score += k.pts; Sfx.good(); dust.burst(f.x, f.y, 30, 200);
      g.scorch.push({ x: f.x, y: f.y, r: f.r + 6 });
      g.info = info(g);
    }

    function drawTank(P, t, g, style) {
      const ctx = P.ctx, s = t.r / 14;
      ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.a); ctx.scale(s, s);
      ctx.fillStyle = '#f5f2e9'; ctx.fillRect(-15, -14, 30, 28);
      P.rect(-15, -14, 30, 7, { w: 1.8 }); P.rect(-15, 7, 30, 7, { w: 1.8 });
      ctx.strokeStyle = INK(.45); ctx.lineWidth = 1; ctx.beginPath();
      const ph = ((-t.odo % 5) + 5) % 5;
      for (let x = -15 + ph; x < 15; x += 5) { ctx.moveTo(x, -13); ctx.lineTo(x, -8); ctx.moveTo(x, 8); ctx.lineTo(x, 13); }
      ctx.stroke();
      P.rect(-12, -8, 24, 16, { w: style === 'player' ? 2.8 : 2.2 });
      if (style === 'grey') P.hatchRect(-12, -8, 24, 16, { a: .3, gap: 4 });
      if (style === 'stripe') { P.line(-12, -3, 12, -3, { w: 1.6 }); P.line(-12, 3, 12, 3, { w: 1.6 }); }
      if (style === 'dark') P.hatchRect(-12, -8, 24, 16, { a: .65, gap: 3, cross: true });
      if (style === 'heavy') { P.hatchRect(-12, -8, 24, 16, { a: .45, gap: 4, cross: true }); P.rect(-9, -5, 18, 10, { w: 1.4 }); }
      if (style === 'player') P.line(-11, 0, -4, 0, { w: 1.4, a: .6 });
      ctx.rotate(t.ta - t.a);
      const kick = t.kick * 4;
      P.line(3 - kick, 0, 20 - kick, 0, { w: 4.2, r: .5 });
      ctx.fillStyle = '#f5f2e9'; ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, TAU); ctx.fill();
      P.circle(0, 0, 6.5, { w: 2 });
      if (style === 'player') { ctx.fillStyle = INK(.8); ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, TAU); ctx.fill(); }
      ctx.restore();
    }

    Arcade.mount(root, signal, {
      id: 'tanks', title: 'Paper Tanks', w: W, h: H,
      intro: 'Clear each sheet of enemy tanks. Shells bounce, so mind your ricochets.',
      keysHelp: '←/→ turn · ↑/↓ drive · mouse aims · Space or click fires · tap to shoot on touch · P pause',
      pads: [['left', '⟲'], ['up', '▲'], ['down', '▼'], ['right', '⟳'], ['fire', 'fire']],
      init(g) {
        g.player = { x: 60, y: H / 2, r: 14, a: 0, ta: 0, inv: 1, cd: 0, kick: 0, odo: 0, trail: 0, vx: 0, vy: 0 };
        g.lives = 3; g.wave = 0; g.layout = -1; g.foes = []; g.dead = false;
        g.mouseAim = false; g.lx = g.ptr.x; g.ly = g.ptr.y;
        startWave(g);
      },
      update(g, dt) {
        const p = g.player, k = g.keys;
        dust.update(dt);
        if (g.phase === 'intro' && (g.timer -= dt) <= 0) g.phase = 'fight';
        if (g.phase === 'clear') { if ((g.timer -= dt) <= 0) startWave(g); return; }

        const tr = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0), mv = (k.has('up') ? 1 : 0) - (k.has('down') ? 1 : 0);
        p.a += tr * 3.2 * dt;
        const ox = p.x, oy = p.y;
        if (mv) drive(g, p, mv * (mv > 0 ? 130 : 95) * dt);
        if (dt > 0) { p.vx = (p.x - ox) / dt; p.vy = (p.y - oy) / dt; }
        if (g.ptr.x !== g.lx || g.ptr.y !== g.ly) { g.mouseAim = true; g.lx = g.ptr.x; g.ly = g.ptr.y; }
        const tap = g.pressed.has('tap');
        if (g.mouseAim) { const want = Math.atan2(g.ptr.y - p.y, g.ptr.x - p.x); p.ta = tap ? want : turn(p.ta, want, 10 * dt); }
        else p.ta = turn(p.ta, p.a, 6 * dt);
        p.cd -= dt; p.inv -= dt; p.kick = Math.max(0, p.kick - dt * 6);
        if ((k.has('fire') || g.ptr.down) && p.cd <= 0 && g.shells.filter(s => s.owner === p).length < 5) { fire(g, p, 300, 1); p.cd = .32; }

        if (g.phase === 'fight') for (const f of [...g.foes]) updateFoe(g, f, dt);

        for (const s of g.shells) {
          s.age += dt;
          s.x += s.vx * dt;
          if (inWall(g, s.x, s.y, 3)) { s.x -= s.vx * dt; s.vx = -s.vx; if (--s.b < 0) s.dead = true; }
          s.y += s.vy * dt;
          if (inWall(g, s.x, s.y, 3)) { s.y -= s.vy * dt; s.vy = -s.vy; if (--s.b < 0) s.dead = true; }
          if (s.dead) dust.burst(s.x, s.y, 5, 60);
        }
        for (let i = 0; i < g.shells.length; i++) for (let j = i + 1; j < g.shells.length; j++) {
          const a = g.shells[i], b = g.shells[j];
          if (!a.dead && !b.dead && (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < 64) { a.dead = b.dead = true; dust.burst((a.x + b.x) / 2, (a.y + b.y) / 2, 8, 90); Sfx.tap(); }
        }
        for (const s of g.shells) {
          if (s.dead) continue;
          if ((s.owner !== p || s.age > .25) && (s.x - p.x) ** 2 + (s.y - p.y) ** 2 < (p.r + 3) ** 2) { s.dead = true; hurt(g); if (g.dead) return; continue; }
          if (s.owner !== p) continue;
          for (const f of g.foes) if ((s.x - f.x) ** 2 + (s.y - f.y) ** 2 < (f.r + 3) ** 2) {
            s.dead = true; f.hp--; dust.burst(s.x, s.y, 6, 80);
            if (f.hp <= 0) kill(g, f); else Sfx.tap();
            break;
          }
        }
        g.shells = g.shells.filter(s => !s.dead);

        if (g.phase === 'fight' && !g.foes.length) {
          g.phase = 'clear'; g.timer = 1.8; g.score += 100 * g.wave; g.lives = Math.min(5, g.lives + 1);
          g.info = info(g); Sfx.win(); toast(`Wave ${g.wave} cleared!`);
        }
      },
      draw(g, P) {
        const ctx = P.ctx;
        P.paper(W, H, { ruled: false });
        ctx.strokeStyle = 'rgba(70,110,160,.1)'; ctx.lineWidth = 1; ctx.beginPath();
        for (let x = C; x < W; x += C) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
        for (let y = C; y < H; y += C) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
        ctx.stroke();
        ctx.strokeStyle = INK(.1); ctx.lineWidth = 1.4; ctx.beginPath();
        for (const m of g.marks) {
          const c = Math.cos(m.a), s = Math.sin(m.a);
          for (const side of [-1, 1]) {
            const px = m.x - s * side * (m.r - 4), py = m.y + c * side * (m.r - 4);
            ctx.moveTo(px - c * 3, py - s * 3); ctx.lineTo(px + c * 3, py + s * 3);
          }
        }
        ctx.stroke();
        for (const s of g.scorch) P.hatchCircle(s.x, s.y, s.r, { a: .16, gap: 4, cross: true });
        for (const b of g.blocks) {
          P.shade(b.x, b.y, b.w, b.h, .05);
          P.rect(b.x, b.y, b.w, b.h, { w: 2.4 });
          P.hatchRect(b.x, b.y, b.w, b.h, { a: .32, gap: 5, cross: true });
        }
        P.rect(3, 3, W - 6, H - 6, { w: 3 });
        ctx.fillStyle = INK(.9);
        for (const s of g.shells) {
          ctx.beginPath(); ctx.arc(s.x, s.y, 3.6, 0, TAU); ctx.fill();
          const v = Math.hypot(s.vx, s.vy);
          ctx.strokeStyle = INK(.3); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx / v * 12, s.y - s.vy / v * 12); ctx.stroke();
        }
        for (const f of g.foes) drawTank(P, f, g, f.kind);
        const p = g.player;
        if (!g.dead && !(p.inv > 0 && Math.floor(g.t * 12) % 2)) drawTank(P, p, g, 'player');
        if (g.mouseAim && !g.dead) { ctx.strokeStyle = INK(.35); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(g.ptr.x, g.ptr.y, 7, 0, TAU); ctx.moveTo(g.ptr.x - 11, g.ptr.y); ctx.lineTo(g.ptr.x + 11, g.ptr.y); ctx.moveTo(g.ptr.x, g.ptr.y - 11); ctx.lineTo(g.ptr.x, g.ptr.y + 11); ctx.stroke(); }
        dust.draw(P);
        if (g.phase === 'intro') P.text(`wave ${g.wave}`, W / 2, H / 2, { size: 48, a: .5 });
        if (g.phase === 'clear') P.text('sheet cleared!', W / 2, H / 2, { size: 44, a: .55 });
      },
    });
  },
});
