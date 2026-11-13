Games.register({
  id: 'golf',
  title: 'Desk Golf',
  blurb: 'Nine hand-drawn minigolf holes with bumpers, sand, water and a windmill. Pull back, aim, putt.',
  group: 'arcade',
  tags: ['solo', 'physics', 'levels'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M8 14 h104 v56 h-104 z"/><path d="M50 14 v30 M70 70 v-30" stroke-width="5"/><circle cx="24" cy="54" r="4" class="fill"/><path d="M28 50 l14 -12" stroke-dasharray="3 4"/><circle cx="94" cy="30" r="5"/><path d="M94 30 v-20 l12 5 l-12 5"/></svg>`,
  help: 'Drag anywhere on the course and pull back like a slingshot: the further you pull, the harder the putt, and you shoot when you let go. Keyboard: ←/→ to aim, ↑/↓ for power, Space to putt. Bumpers are extra bouncy, sand slows the ball, arrows on the green mark slopes, and water costs a stroke and puts you back where you hit from. Each hole has a par; your total strokes over nine holes is your score, so lower is better. A hole is picked up after 8 strokes.',
  mount(root, signal) {
    const W = 720, H = 440, R = 7, CUP = 10, MAXV = 840, CAP = 8;
    const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    const HOLES = [
      { name: 'Warm-up', par: 2, tee: [160, 220], cup: [560, 196], poly: rect(100, 140, 520, 160) },
      { name: 'Dogleg', par: 3, tee: [150, 120], cup: [580, 320], poly: [[80, 60], [330, 60], [330, 250], [640, 250], [640, 390], [80, 390]] },
      { name: 'The Wall', par: 3, tee: [130, 130], cup: [590, 130], poly: rect(60, 70, 600, 300), blocks: [[340, 70, 40, 210]] },
      { name: 'Pinball', par: 3, tee: [110, 220], cup: [620, 220], poly: rect(60, 60, 600, 320), bumpers: [[250, 150, 24], [250, 290, 24], [380, 220, 30], [500, 130, 22], [500, 310, 22], [560, 220, 16]] },
      { name: 'Sand Trap', par: 3, tee: [120, 300], cup: [608, 216], poly: rect(60, 80, 600, 280), zones: [{ type: 'water', x: 250, y: 80, w: 90, h: 190 }, { type: 'sand', ell: true, x: 450, y: 140, w: 130, h: 170 }] },
      { name: 'Windmill', par: 3, tee: [120, 220], cup: [600, 220], poly: rect(60, 80, 600, 280), blocks: [[350, 80, 20, 110], [350, 250, 20, 110]], spin: [{ x: 360, y: 220, len: 56, w: 1.7 }] },
      { name: 'Zig-zag', par: 4, tee: [120, 320], cup: [590, 320], poly: rect(60, 60, 600, 320), blocks: [[200, 60, 24, 230], [340, 150, 24, 230], [480, 60, 24, 230]], zones: [{ type: 'sand', ell: true, x: 250, y: 70, w: 80, h: 60 }] },
      { name: 'Uphill U-turn', par: 3, tee: [120, 130], cup: [120, 310], poly: rect(60, 60, 600, 320), blocks: [[60, 205, 480, 30]], zones: [{ type: 'slope', x: 200, y: 235, w: 340, h: 145, ax: 90, ay: 0 }, { type: 'slope', x: 200, y: 60, w: 340, h: 145, ax: 70, ay: 0 }] },
      { name: 'Grand Finale', par: 4, tee: [110, 120], cup: [610, 110], poly: rect(40, 50, 640, 340), zones: [{ type: 'water', x: 300, y: 50, w: 90, h: 250 }, { type: 'sand', ell: true, x: 470, y: 150, w: 90, h: 120 }], bumpers: [[540, 310, 20], [630, 250, 18]], sliders: [{ x: 330, y: 300, w: 30, h: 36, ay: 27, sp: 2.2 }] },
    ];
    const PAR = HOLES.reduce((s, h) => s + h.par, 0);
    const dust = Dust();
    const NAMES = { '-3': 'Albatross!', '-2': 'Eagle!', '-1': 'Birdie!', '0': 'Par', '1': 'Bogey', '2': 'Double bogey', '3': 'Triple bogey' };
    const label = (s, par) => s === 1 ? 'Hole in one!' : NAMES[s - par] || `+${s - par}`;

    const inZone = (z, x, y) => z.ell ? ((x - z.x - z.w / 2) / (z.w / 2)) ** 2 + ((y - z.y - z.h / 2) / (z.h / 2)) ** 2 < 1 : x > z.x && x < z.x + z.w && y > z.y && y < z.y + z.h;
    const segsOf = pts => pts.map((p, i) => { const q = pts[(i + 1) % pts.length]; return { ax: p[0], ay: p[1], bx: q[0], by: q[1] }; });

    function loadHole(g) {
      const h = HOLES[g.hole];
      g.h = h;
      g.statics = [...segsOf(h.poly), ...(h.blocks || []).flatMap(b => segsOf(rect(...b)))];
      g.ball = { x: h.tee[0], y: h.tee[1], vx: 0, vy: 0, roll: 0 };
      g.last = [...h.tee]; g.strokes = 0; g.state = 'aim'; g.timer = 0; g.aim = null;
      g.kAng = Math.atan2(h.cup[1] - h.tee[1], h.cup[0] - h.tee[0]); g.kPow = .45;
      g.img = null; g.banner = 1.6;
      g.info = `hole ${g.hole + 1}/9 · par ${h.par} · ${h.name}`;
    }
    function movers(g) {
      const out = [], h = g.h, t = g.t;
      for (const s of h.spin || []) {
        const a = t * s.w;
        for (const k of [0, Math.PI / 2]) {
          const cc = Math.cos(a + k), ss = Math.sin(a + k);
          out.push({ ax: s.x - cc * s.len, ay: s.y - ss * s.len, bx: s.x + cc * s.len, by: s.y + ss * s.len, vel: (qx, qy) => [-(qy - s.y) * s.w, (qx - s.x) * s.w] });
        }
      }
      for (const s of h.sliders || []) {
        const y = s.y + s.ay + Math.sin(t * s.sp) * s.ay, vy = Math.cos(t * s.sp) * s.ay * s.sp;
        for (const seg of segsOf(rect(s.x, y, s.w, s.h))) out.push({ ...seg, vel: () => [0, vy] });
      }
      return out;
    }
    function collideSeg(b, s) {
      const dx = s.bx - s.ax, dy = s.by - s.ay, l2 = dx * dx + dy * dy || 1;
      const u = clamp(((b.x - s.ax) * dx + (b.y - s.ay) * dy) / l2, 0, 1);
      const qx = s.ax + dx * u, qy = s.ay + dy * u;
      let nx = b.x - qx, ny = b.y - qy;
      const d = Math.hypot(nx, ny);
      if (d >= R || d < 1e-6) return;
      nx /= d; ny /= d;
      b.x = qx + nx * R; b.y = qy + ny * R;
      let [svx, svy] = s.vel ? s.vel(qx, qy) : [0, 0];
      const rvx = b.vx - svx, rvy = b.vy - svy, vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        b.vx -= 1.75 * vn * nx; b.vy -= 1.75 * vn * ny;
        if (-vn > 50) { Sfx.tap(); dust.burst(qx, qy, 3, 50); }
      }
      if (s.vel) { const push = svx * nx + svy * ny; if (push > 0) { b.vx += nx * push * .3; b.vy += ny * push * .3; } }
    }
    function collideBumper(b, [cx, cy, r]) {
      let nx = b.x - cx, ny = b.y - cy;
      const d = Math.hypot(nx, ny);
      if (d >= r + R) return;
      nx /= d; ny /= d;
      b.x = cx + nx * (r + R); b.y = cy + ny * (r + R);
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        b.vx -= 2.2 * vn * nx; b.vy -= 2.2 * vn * ny;
        const sp = Math.hypot(b.vx, b.vy); if (sp > MAXV) { b.vx *= MAXV / sp; b.vy *= MAXV / sp; }
        Sfx.tap(); dust.burst(cx + nx * r, cy + ny * r, 6, 90); b.bumped = .15;
      }
    }
    function shoot(g, ang, pow) {
      const b = g.ball;
      b.vx = Math.cos(ang) * pow * MAXV; b.vy = Math.sin(ang) * pow * MAXV;
      g.last = [b.x, b.y]; g.strokes++; g.score++; g.state = 'roll'; g.aim = null;
      Sfx.scratch();
    }
    function finishHole(g, sunk) {
      g.card.push(g.strokes);
      g.state = 'done'; g.timer = 2.4;
      g.result = sunk ? label(g.strokes, g.h.par) : 'Picked up';
      if (sunk && g.strokes <= g.h.par) { Sfx.win(); if (g.strokes < g.h.par) celebrate(g.strokes === 1 ? 24 : 10); }
      else Sfx.good();
    }

    function renderHole(h) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cv = document.createElement('canvas'); cv.width = W * dpr; cv.height = H * dpr;
      const c = cv.getContext('2d'); c.scale(dpr, dpr);
      const OP = Pencil(c);
      OP.paper(W, H);
      const course = cx => { cx.moveTo(...h.poly[0]); for (const p of h.poly.slice(1)) cx.lineTo(...p); cx.closePath(); };
      // off-course area: cross hatched
      OP.hatch(cx => { cx.rect(0, 0, W, H); course(cx); }, [0, 0, W, H], { a: .22, gap: 7, cross: true });
      c.save(); c.beginPath(); course(c); c.clip();
      c.fillStyle = '#f5f2e9'; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(70,110,160,.1)'; c.lineWidth = 1; c.beginPath();
      for (let x = 0; x < W; x += 20) { c.moveTo(x, 0); c.lineTo(x, H); }
      for (let y = 0; y < H; y += 20) { c.moveTo(0, y); c.lineTo(W, y); }
      c.stroke();
      for (const z of h.zones || []) {
        const shape = cx => z.ell ? cx.ellipse(z.x + z.w / 2, z.y + z.h / 2, z.w / 2, z.h / 2, 0, 0, 7) : cx.rect(z.x, z.y, z.w, z.h);
        if (z.type === 'water') {
          c.fillStyle = 'rgba(70,110,160,.16)'; c.beginPath(); shape(c); c.fill();
          c.save(); c.beginPath(); shape(c); c.clip();
          c.strokeStyle = 'rgba(70,110,160,.45)'; c.lineWidth = 1.2; c.beginPath();
          for (let y = z.y + 10; y < z.y + z.h; y += 14) for (let x = z.x - 10 + (y % 28 ? 0 : 10); x < z.x + z.w; x += 22) { c.moveTo(x, y); c.quadraticCurveTo(x + 5, y - 4, x + 10, y); c.quadraticCurveTo(x + 15, y + 4, x + 20, y); }
          c.stroke(); c.restore();
          c.strokeStyle = 'rgba(70,110,160,.6)'; c.lineWidth = 2; c.beginPath(); shape(c); c.stroke();
        } else if (z.type === 'sand') {
          c.save(); c.beginPath(); shape(c); c.clip();
          c.fillStyle = INK(.06); c.fillRect(z.x, z.y, z.w, z.h);
          c.fillStyle = INK(.4);
          for (let i = 0; i < z.w * z.h / 55; i++) c.fillRect(z.x + Math.random() * z.w, z.y + Math.random() * z.h, 1.4, 1.4);
          c.restore();
          c.setLineDash([5, 4]); c.strokeStyle = INK(.55); c.lineWidth = 1.6; c.beginPath(); shape(c); c.stroke(); c.setLineDash([]);
        } else if (z.type === 'slope') {
          c.strokeStyle = INK(.22); c.lineWidth = 1.4;
          const ang = Math.atan2(z.ay, z.ax);
          for (let y = z.y + 24; y < z.y + z.h - 10; y += 40) for (let x = z.x + 26; x < z.x + z.w - 10; x += 56) {
            c.save(); c.translate(x, y); c.rotate(ang); c.beginPath(); c.moveTo(-10, 0); c.lineTo(10, 0); c.moveTo(4, -5); c.lineTo(10, 0); c.lineTo(4, 5); c.stroke(); c.restore();
          }
        }
      }
      c.restore();
      for (const b of h.blocks || []) { OP.hatchRect(...b, { a: .45, gap: 4, cross: true }); OP.rect(...b, { w: 2.4 }); }
      OP.poly(h.poly, { w: 3.2 });
      for (const [x, y, r] of h.bumpers || []) { c.fillStyle = '#f5f2e9'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); OP.circle(x, y, r, { w: 2.4 }); OP.circle(x, y, r * .55, { w: 1.4, a: .5 }); }
      // tee mat and cup
      const [tx, ty] = h.tee;
      OP.rect(tx - 14, ty - 14, 28, 28, { w: 1.2, a: .45 });
      const [cx, cy] = h.cup;
      c.fillStyle = INK(.85); c.beginPath(); c.arc(cx, cy, CUP, 0, 7); c.fill();
      OP.circle(cx, cy, CUP + 2, { w: 1.6, a: .6 });
      return cv;
    }

    Arcade.mount(root, signal, {
      id: 'golf', title: 'Desk Golf', w: W, h: H, best: 'low', scoreLabel: 'strokes',
      intro: `Nine holes, par ${PAR}. Drag back from anywhere to aim and let go to putt.`,
      keysHelp: 'Drag back + release to putt · or ←/→ aim, ↑/↓ power, Space putt · P pause',
      init(g) {
        g.hole = 0; g.card = []; g.wasDown = false;
        loadHole(g);
      },
      update(g, dt) {
        const b = g.ball, h = g.h, k = g.keys;
        dust.update(dt);
        g.banner -= dt;
        if (b.bumped) b.bumped -= dt;

        if (g.state === 'aim') {
          // pointer: slingshot drag
          if (g.ptr.down && !g.wasDown) g.aim = { sx: g.ptr.x, sy: g.ptr.y };
          if (g.aim) {
            const dx = g.aim.sx - g.ptr.x, dy = g.aim.sy - g.ptr.y, l = Math.hypot(dx, dy);
            g.aim.pow = Math.min(1, l / 170); g.aim.ang = Math.atan2(dy, dx);
            if (!g.ptr.down) { if (g.aim.pow > .04) shoot(g, g.aim.ang, g.aim.pow); else g.aim = null; }
          }
          if (k.has('left')) g.kAng -= 1.6 * dt;
          if (k.has('right')) g.kAng += 1.6 * dt;
          if (k.has('up')) g.kPow = Math.min(1, g.kPow + .6 * dt);
          if (k.has('down')) g.kPow = Math.max(.05, g.kPow - .6 * dt);
          if (g.pressed.has('fire') && !g.aim) shoot(g, g.kAng, g.kPow);
          // a resting ball still gets shoved by the windmill or a sliding block
          if (g.state === 'aim') for (const s of movers(g)) { collideSeg(b, s); if (Math.hypot(b.vx, b.vy) > 7) { g.state = 'roll'; g.aim = null; } }
        } else if (g.state === 'roll') {
          const segs = [...g.statics, ...movers(g)];
          const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 2.5));
          const hs = dt / steps;
          for (let i = 0; i < steps && g.state === 'roll'; i++) {
            let fric = 150;
            for (const z of h.zones || []) if (inZone(z, b.x, b.y)) {
              if (z.type === 'sand') fric = 620;
              else if (z.type === 'slope') { b.vx += z.ax * hs; b.vy += z.ay * hs; }
              else if (z.type === 'water') { g.state = 'splash'; g.timer = 1; g.strokes++; g.score++; Sfx.bad(); dust.burst(b.x, b.y, 18, 120); break; }
            }
            if (g.state !== 'roll') break;
            const sp = Math.hypot(b.vx, b.vy);
            if (sp > 0) { const ns = Math.max(0, sp - fric * hs) * Math.exp(-.35 * hs); b.vx *= ns / sp; b.vy *= ns / sp; }
            b.x += b.vx * hs; b.y += b.vy * hs; b.roll += Math.hypot(b.vx, b.vy) * hs;
            if (b.vx || b.vy) b.heading = Math.atan2(b.vy, b.vx);
            for (const s of segs) collideSeg(b, s);
            for (const bp of h.bumpers || []) collideBumper(b, bp);
            const dc = Math.hypot(b.x - h.cup[0], b.y - h.cup[1]), spd = Math.hypot(b.vx, b.vy);
            if (dc < CUP - 2 && spd < 460) { g.state = 'sink'; g.timer = .6; b.vx = (h.cup[0] - b.x) * 6; b.vy = (h.cup[1] - b.y) * 6; Sfx.good(); }
            else if (dc < CUP + 4 && spd < 460) { const pull = 1400 * hs; b.vx += (h.cup[0] - b.x) / dc * pull; b.vy += (h.cup[1] - b.y) / dc * pull; }
          }
          if (g.state === 'roll' && Math.hypot(b.vx, b.vy) < 7) {
            b.vx = b.vy = 0;
            if (g.strokes >= CAP) finishHole(g, false);
            else { g.state = 'aim'; g.kAng = Math.atan2(h.cup[1] - b.y, h.cup[0] - b.x); }
          }
        } else if (g.state === 'sink') {
          b.x += (h.cup[0] - b.x) * Math.min(1, dt * 10); b.y += (h.cup[1] - b.y) * Math.min(1, dt * 10);
          if ((g.timer -= dt) <= 0) { dust.burst(h.cup[0], h.cup[1], 12, 90); finishHole(g, true); }
        } else if (g.state === 'splash') {
          if ((g.timer -= dt) <= 0) {
            b.x = g.last[0]; b.y = g.last[1]; b.vx = b.vy = 0;
            if (g.strokes >= CAP) finishHole(g, false); else g.state = 'aim';
          }
        } else if (g.state === 'done') {
          if ((g.timer -= dt) <= 0 || (g.timer < 1.6 && (g.pressed.has('fire') || g.pressed.has('tap')))) {
            if (g.hole === HOLES.length - 1) {
              const rel = g.score - PAR, rs = rel === 0 ? 'even par' : rel > 0 ? `${rel} over par` : `${-rel} under par`;
              return g.end({ win: rel <= 0, title: rel < 0 ? 'Under par!' : rel === 0 ? 'Right on par' : 'Round complete', msg: `${g.score} strokes over 9 holes, ${rs}. Card: ${g.card.join(' · ')}` });
            }
            g.hole++; loadHole(g); g.wasDown = g.ptr.down; return;
          }
        }
        g.wasDown = g.ptr.down;
        g.info = `hole ${g.hole + 1}/9 · par ${h.par} · stroke ${g.strokes}`;
      },
      draw(g, P) {
        const ctx = P.ctx, h = g.h, b = g.ball;
        g.img ||= renderHole(h);
        ctx.drawImage(g.img, 0, 0, W, H);
        // moving hazards
        for (const s of movers(g)) { ctx.strokeStyle = INK(.85); ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s.ax, s.ay); ctx.lineTo(s.bx, s.by); ctx.stroke(); }
        for (const s of h.sliders || []) {
          const y = s.y + s.ay + Math.sin(g.t * s.sp) * s.ay;
          ctx.fillStyle = '#f5f2e9'; ctx.fillRect(s.x, y, s.w, s.h);
          P.hatchRect(s.x, y, s.w, s.h, { a: .5, gap: 4 });
          ctx.strokeStyle = INK(.9); ctx.lineWidth = 2.4; ctx.strokeRect(s.x, y, s.w, s.h);
        }
        for (const sp of h.spin || []) { ctx.fillStyle = INK(.9); ctx.beginPath(); ctx.arc(sp.x, sp.y, 6, 0, 7); ctx.fill(); }
        // flag
        const [cx, cy] = h.cup, wave = Math.sin(g.t * 4) * 3;
        const near = Math.hypot(b.x - cx, b.y - cy) < 60 && g.state !== 'done';
        if (!near) {
          P.line(cx, cy, cx, cy - 42, { w: 2.2, r: .4 });
          ctx.fillStyle = INK(.35); ctx.strokeStyle = INK(.85); ctx.lineWidth = 1.6; ctx.beginPath();
          ctx.moveTo(cx, cy - 42); ctx.quadraticCurveTo(cx + 12, cy - 40 + wave, cx + 22, cy - 35 + wave); ctx.lineTo(cx, cy - 28); ctx.closePath(); ctx.fill(); ctx.stroke();
          P.text(String(g.hole + 1), cx + 9, cy - 36, { size: 13, a: .9 });
        }
        // aim guide
        if (g.state === 'aim') {
          const a = g.aim && g.aim.pow != null ? g.aim : { ang: g.kAng, pow: g.kPow };
          const len = 30 + a.pow * 170, ux = Math.cos(a.ang), uy = Math.sin(a.ang);
          ctx.setLineDash([4, 6]); ctx.lineWidth = 2; ctx.strokeStyle = INK(.55); ctx.beginPath();
          ctx.moveTo(b.x + ux * 12, b.y + uy * 12); ctx.lineTo(b.x + ux * len, b.y + uy * len); ctx.stroke(); ctx.setLineDash([]);
          ctx.beginPath(); ctx.moveTo(b.x + ux * len, b.y + uy * len); ctx.lineTo(b.x + ux * (len - 9) - uy * 5, b.y + uy * (len - 9) + ux * 5);
          ctx.moveTo(b.x + ux * len, b.y + uy * len); ctx.lineTo(b.x + ux * (len - 9) + uy * 5, b.y + uy * (len - 9) - ux * 5); ctx.stroke();
          if (g.aim && g.aim.pow != null) { ctx.strokeStyle = INK(.25); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(g.aim.sx, g.aim.sy); ctx.lineTo(g.ptr.x, g.ptr.y); ctx.stroke(); }
          // power meter
          const mx = b.x - 22, my = b.y + 16;
          ctx.strokeStyle = INK(.5); ctx.lineWidth = 1.2; ctx.strokeRect(mx, my, 44, 6);
          ctx.fillStyle = INK(a.pow > .85 ? .8 : .5); ctx.fillRect(mx + 1, my + 1, 42 * a.pow, 4);
        }
        // ball
        if (g.state === 'splash') {
          const k = 1 - g.timer;
          ctx.strokeStyle = 'rgba(70,110,160,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, 4 + k * 22, 0, 7); ctx.moveTo(b.x + 2 + k * 12, b.y); ctx.arc(b.x, b.y, 2 + k * 12, 0, 7); ctx.stroke();
        } else if (g.state !== 'done') {
          const sink = g.state === 'sink' ? clamp(g.timer / .6, 0, 1) : 1;
          const r = R * (.5 + sink * .5) * (b.bumped > 0 ? 1.2 : 1);
          if (g.state !== 'sink') { ctx.fillStyle = INK(.15); ctx.beginPath(); ctx.ellipse(b.x + 2, b.y + 3, r, r * .7, 0, 0, 7); ctx.fill(); }
          ctx.fillStyle = '#fbfaf5'; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 7); ctx.fill();
          ctx.strokeStyle = INK(.9); ctx.lineWidth = 1.8; ctx.stroke();
          ctx.save(); ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 7); ctx.clip();
          const ang = b.heading || 0, off = Math.sin(b.roll / R) * r;
          ctx.strokeStyle = INK(.45); ctx.lineWidth = 1.2; ctx.beginPath();
          ctx.moveTo(b.x + Math.cos(ang) * off - Math.sin(ang) * r, b.y + Math.sin(ang) * off + Math.cos(ang) * r);
          ctx.lineTo(b.x + Math.cos(ang) * off + Math.sin(ang) * r, b.y + Math.sin(ang) * off - Math.cos(ang) * r);
          ctx.stroke(); ctx.restore();
        }
        dust.draw(P);
        // header
        P.text(`Hole ${g.hole + 1} · ${h.name}`, 16, 22, { size: 24, align: 'left', a: .8 });
        P.text(`par ${h.par} · stroke ${g.strokes}`, W - 16, 22, { size: 22, align: 'right', a: .7 });
        if (g.banner > 0 && g.state === 'aim' && !g.strokes) P.text(`Hole ${g.hole + 1} · par ${h.par}`, W / 2, H - 24, { size: 30, a: Math.min(.75, g.banner) });
        if (g.state === 'done') {
          ctx.fillStyle = 'rgba(245,242,233,.88)'; ctx.fillRect(W / 2 - 220, H / 2 - 72, 440, 144);
          P.rect(W / 2 - 220, H / 2 - 72, 440, 144, { w: 2 });
          P.text(g.result, W / 2, H / 2 - 38, { size: 40 });
          P.text(`${g.strokes} stroke${g.strokes === 1 ? '' : 's'} on a par ${h.par}`, W / 2, H / 2 + 2, { size: 22, a: .7 });
          const cells = HOLES.map((hh, i) => g.card[i] != null ? String(g.card[i]) : '·').join('  ');
          const rel = g.score - HOLES.slice(0, g.card.length).reduce((s, hh) => s + hh.par, 0);
          P.text(`${cells}   (${rel === 0 ? 'E' : rel > 0 ? '+' + rel : rel})`, W / 2, H / 2 + 40, { size: 22, a: .8 });
        }
      },
    });
  },
});
