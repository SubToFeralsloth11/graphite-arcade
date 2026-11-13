Games.register({
  id: 'racer',
  title: 'Doodle Racer',
  blurb: 'Weave through sketched traffic on an endless highway. Keep the tank topped up and the paint unscratched.',
  group: 'arcade',
  tags: ['solo', 'driving', 'endless'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M20 0 V80 M100 0 V80"/><path d="M60 4 V20 M60 32 V48 M60 60 V76" stroke-dasharray="1 0"/><rect x="30" y="44" width="18" height="30" rx="3"/><path d="M33 52 h12"/><rect x="70" y="10" width="18" height="28" rx="3" class="fill"/><path d="M108 30 h8 v12 h-8 z"/></svg>`,
  help: 'Left/right (A/D) steer, Up holds the gas for extra speed, Down brakes. On touch use the pads or drag on the road. The two left lanes are oncoming traffic; the right lanes drift along slower than you, and later on they change lanes (watch the blinkers). Fuel drains as you drive: grab F cans or you will coast to a stop. ★ is bonus points, the wrench fixes a dent, and oil slicks send you spinning. Brushing past a car without touching it scores a close call. Three crashes and the car is a write-off. Everything gets faster the further you go.',
  mount(root, signal) {
    const dust = Dust();
    const W = 480, H = 600, L = 60, R = 420, LW = 90, PY = H - 110;
    const laneX = i => L + LW * (i + .5);
    const SIZES = { car: [30, 52], van: [34, 64], truck: [38, 92] };
    const info = g => `♥ ${3 - g.dents} · ${Math.round(g.v * .4 / 5) * 5} km/h`;
    const base = g => 240 + Math.min(260, g.dist * .011);

    function spawnCar(g) {
      const busy = new Set(g.cars.filter(c => c.y < 200).map(c => c.lane));
      const lanes = [0, 1, 2, 3].filter(i => !busy.has(i));
      if (lanes.length <= 1) return false;
      const lane = pick(lanes), oncoming = lane < 2;
      const kind = pick(g.dist > 1500 ? ['car', 'car', 'van', 'truck'] : ['car', 'car', 'van']);
      const [w, h] = SIZES[kind];
      const v = oncoming ? -(130 + rand(70) + Math.min(80, g.dist * .002)) : base(g) * (.35 + Math.random() * .25);
      g.cars.push({ lane, x: laneX(lane), tx: laneX(lane), y: -h, w, h, v, kind, oncoming, shade: rand(3), blink: 0, side: 0, passed: false });
      return true;
    }

    function spawnItem(g, kind) {
      const lane = rand(4), wy = -g.dist - 50;
      if (g.cars.some(c => c.lane === lane && c.y < 120)) return false;
      g.items.push({ x: laneX(lane) + (Math.random() - .5) * 30, wy, kind });
      return true;
    }

    function crash(g, c) {
      const p = g.p;
      g.dents++; p.inv = 1.8; g.v *= .4; Sfx.bad();
      dust.burst((p.x + c.x) / 2, PY - 20, 26, 200);
      p.x += p.x < c.x ? -14 : 14;
      g.info = info(g);
      if (g.dents >= 3) {
        g.dead = true;
        g.end({ win: false, title: 'Wrecked', msg: `You drove ${(g.dist / 2500).toFixed(1)} km.` });
      }
    }

    function drawCar(P, g, x, y, w, h, { flip = false, tilt = 0, shade = 0, player = false, kind = 'car', blink = 0, spin = 0 } = {}) {
      const ctx = P.ctx, hw = w / 2, hh = h / 2;
      ctx.save(); ctx.translate(x, y); ctx.rotate((flip ? Math.PI : 0) + tilt + spin);
      ctx.fillStyle = INK(.85);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) ctx.fillRect(sx * hw - (sx > 0 ? 2 : 3), sy * (hh - 14) - 6, 5, 12);
      ctx.fillStyle = '#f5f2e9'; ctx.fillRect(-hw, -hh, w, h);
      P.rect(-hw, -hh, w, h, { w: player ? 2.8 : 2.2 });
      if (player) {
        P.line(-4, -hh + 2, -4, hh - 2, { w: 2.2, a: .6 }); P.line(4, -hh + 2, 4, hh - 2, { w: 2.2, a: .6 });
      } else P.hatchRect(-hw, -hh, w, h, { a: .14 + shade * .12, gap: 6 - shade, cross: shade === 2 });
      if (kind === 'truck') {
        P.rect(-hw + 3, -hh + 4, w - 6, 20, { w: 1.6 });
        P.line(-hw, -hh + 28, hw, -hh + 28, { w: 2 });
        P.line(-hw + 6, -hh + 36, -hw + 6, hh - 6, { w: 1, a: .4 }); P.line(hw - 6, -hh + 36, hw - 6, hh - 6, { w: 1, a: .4 });
      } else {
        ctx.fillStyle = '#f5f2e9'; ctx.fillRect(-hw + 5, -hh + 12, w - 10, h * .45);
        P.rect(-hw + 5, -hh + 12, w - 10, h * .45, { w: 1.6 });
        P.hatchRect(-hw + 6, -hh + 13, w - 12, 8, { a: .6, gap: 2.5 });
      }
      ctx.fillStyle = INK(.75);
      ctx.beginPath(); ctx.arc(-hw + 6, -hh + 3, 2.4, 0, 7); ctx.arc(hw - 6, -hh + 3, 2.4, 0, 7); ctx.fill();
      if (blink && Math.floor(g.t * 7) % 2) {
        const bx = blink > 0 ? hw + 4 : -hw - 4;
        ctx.beginPath(); ctx.arc(bx, -hh + 6, 3.4, 0, 7); ctx.arc(bx, hh - 6, 3.4, 0, 7); ctx.fill();
      }
      ctx.restore();
    }

    Arcade.mount(root, signal, {
      id: 'racer', title: 'Doodle Racer', w: W, h: H,
      intro: 'Dodge traffic, grab fuel, go as far as you can.',
      keysHelp: '←/→ steer · ↑ gas · ↓ brake · drag on touch · P pause',
      pads: [['left', '◀'], ['down', 'brake'], ['up', 'gas'], ['right', '▶']],
      init(g) {
        g.p = { x: laneX(2), vx: 0, tilt: 0, inv: 1, spin: 0, slide: 0, rot: 0 };
        g.v = 120; g.dist = 0; g.fuel = 100; g.dents = 0; g.bonus = 0; g.dead = false;
        g.cars = []; g.items = []; g.trees = []; g.pops = [];
        g.spawnT = 1.2; g.fuelT = 7; g.itemT = 4; g.nextTree = H + 40; g.nextKm = 1;
        g.info = info(g);
      },
      update(g, dt) {
        const p = g.p, k = g.keys;
        dust.update(dt);
        let target = base(g) * (k.has('up') ? 1.35 : 1) * (k.has('down') ? .45 : 1);
        const off = p.x < L + 10 || p.x > R - 10;
        if (off) target *= .55;
        if (g.fuel <= 0) target = 0;
        g.v += clamp(target - g.v, -440 * dt, (g.fuel <= 0 ? 60 : 220) * dt);
        if (g.fuel <= 0) g.v = Math.max(0, g.v - 40 * dt);
        g.dist += g.v * dt;
        g.fuel = Math.max(0, g.fuel - dt * (1.6 + g.v / 320));
        if (g.fuel <= 0 && g.v < 4) { g.dead = true; return g.end({ win: false, title: 'Out of fuel', msg: `You coasted to a stop after ${(g.dist / 2500).toFixed(1)} km.` }); }

        let steer = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
        if (!steer && g.ptr.down) steer = clamp((g.ptr.x - p.x) / 40, -1, 1);
        if (p.spin > 0) { p.spin -= dt; steer = 0; p.x += p.slide * dt; p.rot += 11 * dt; } else p.rot = 0;
        p.vx += (steer * 310 - p.vx) * Math.min(1, dt * 9);
        p.x = clamp(p.x + p.vx * dt, 24, W - 24);
        p.tilt = p.vx / 310 * .14;
        p.inv -= dt;
        if (off && g.v > 60 && Math.random() < dt * 20) dust.burst(p.x, PY + 26, 2, 60);

        g.spawnT -= dt * g.v / 300;
        if (g.spawnT <= 0) g.spawnT = spawnCar(g) ? Math.max(.38, 1.15 - g.dist * .000035) * (.7 + Math.random() * .6) : .15;
        if ((g.fuelT -= dt) <= 0) g.fuelT = spawnItem(g, 'fuel') ? Math.min(13, 7.5 + g.dist * .00012) + Math.random() * 2 : .3;
        if ((g.itemT -= dt) <= 0) {
          g.itemT = 3.5 + Math.random() * 3;
          const r = Math.random();
          spawnItem(g, g.dents && r < .12 ? 'wrench' : g.dist > 3000 && r < .45 ? 'oil' : 'star');
        }

        for (const c of g.cars) {
          c.y += (g.v - c.v) * dt;
          if (!c.oncoming && g.dist > 2500 && !c.blink && c.x === c.tx && c.y > 30 && c.y < PY - 170 && Math.random() < dt * .3) {
            const nl = c.lane === 2 ? 3 : 2;
            if (!g.cars.some(o => o !== c && o.lane === nl && Math.abs(o.y - c.y) < (o.h + c.h) / 2 + 60)) { c.blink = .9; c.side = nl > c.lane ? 1 : -1; c.nl = nl; }
          }
          if (c.blink > 0 && (c.blink -= dt) <= 0) { c.blink = 0; c.lane = c.nl; c.tx = laneX(c.nl); }
          c.x = Math.abs(c.tx - c.x) < 1 ? c.tx : c.x + clamp(c.tx - c.x, -75 * dt, 75 * dt);
          if (c.x === c.tx && !c.blink) c.side = 0;
        }
        // Cars in the same lane never drive through each other: the one behind matches the speed of the one in front.
        for (const a of g.cars) for (const b of g.cars) {
          if (a === b || a.lane !== b.lane) continue;
          const behind = a.oncoming ? b.y < a.y : b.y > a.y;
          if (behind && Math.abs(a.y - b.y) - (a.h + b.h) / 2 < 26) b.v = a.v;
        }
        g.cars = g.cars.filter(c => c.y < H + 120 && c.y > -500);

        const pb = { x: p.x - 13, y: PY - 24, w: 26, h: 48 };
        for (const c of g.cars) {
          const cb = { x: c.x - c.w / 2 + 2, y: c.y - c.h / 2 + 2, w: c.w - 4, h: c.h - 4 };
          if (p.inv <= 0 && hit(pb, cb)) { c.passed = true; crash(g, c); if (g.dead) return; continue; }
          if (!c.passed && c.y - c.h / 2 > PY + 24) {
            c.passed = true;
            const gap = Math.abs(c.x - p.x) - (c.w + 26) / 2;
            if (p.inv <= 0 && gap < 14) { g.bonus += 30; Sfx.tap(); g.pops.push({ x: p.x, y: PY - 40, s: 'close! +30', life: 1 }); }
          }
        }

        for (const it of g.items) {
          const sy = it.wy + g.dist;
          if (it.got || Math.abs(it.x - p.x) > 26 || Math.abs(sy - PY) > 36) continue;
          it.got = true;
          if (it.kind === 'fuel') { g.fuel = Math.min(100, g.fuel + 35); Sfx.good(); g.pops.push({ x: p.x, y: PY - 40, s: 'fuel +35', life: 1 }); }
          if (it.kind === 'star') { g.bonus += 100; Sfx.good(); g.pops.push({ x: p.x, y: PY - 40, s: '+100', life: 1 }); }
          if (it.kind === 'wrench') { g.dents = Math.max(0, g.dents - 1); Sfx.good(); g.pops.push({ x: p.x, y: PY - 40, s: 'dent fixed', life: 1 }); }
          if (it.kind === 'oil' && p.spin <= 0 && p.inv <= 0) { p.spin = .8; p.slide = (Math.random() < .5 ? -1 : 1) * 90; g.v *= .75; Sfx.bad(); }
          if (it.kind !== 'oil') dust.burst(it.x, sy, 10, 120);
        }
        g.items = g.items.filter(it => !(it.got && it.kind !== 'oil') && it.wy + g.dist < H + 60);

        while (g.nextTree > -g.dist - 100) {
          const left = Math.random() < .5;
          g.trees.push({ x: left ? 10 + rand(38) : R + 12 + rand(38), wy: g.nextTree, s: .7 + Math.random() * .6, bush: Math.random() < .35 });
          g.nextTree -= 34 + rand(70);
        }
        g.trees = g.trees.filter(t => t.wy + g.dist < H + 60);

        for (const pp of g.pops) { pp.life -= dt; pp.y -= 40 * dt; }
        g.pops = g.pops.filter(pp => pp.life > 0);
        const km = g.dist / 2500;
        if (km >= g.nextKm) { toast(`${g.nextKm} km!`); Sfx.good(); g.nextKm++; }
        g.score = Math.floor(g.dist / 25) + g.bonus;
        g.info = info(g);
      },
      draw(g, P) {
        const ctx = P.ctx, p = g.p;
        P.paper(W, H, { oy: -g.dist, ox: null });
        P.shade(0, 0, L, H, .05); P.shade(R, 0, W - R, H, .05);
        // Road and scenery sit in world space under a scrolling camera, so their pencil wobble does not jitter.
        ctx.save(); ctx.translate(0, g.dist);
        const top = -g.dist - 100, y0 = Math.floor(top / 100) * 100;
        for (let y = y0; y < -g.dist + H + 100; y += 100) {
          P.line(L, y, L, y + 100, { w: 2.6 }); P.line(R, y, R, y + 100, { w: 2.6 });
          P.line(L + LW * 2 - 3, y, L + LW * 2 - 3, y + 100, { w: 1.5, a: .7 }); P.line(L + LW * 2 + 3, y, L + LW * 2 + 3, y + 100, { w: 1.5, a: .7 });
          for (const i of [1, 3]) P.line(L + LW * i, y + 20, L + LW * i, y + 62, { w: 1.8, a: .55 });
        }
        for (const t of g.trees) {
          if (t.bush) { P.circle(t.x - 5, t.wy, 7 * t.s, { w: 1.5, a: .6 }); P.circle(t.x + 5, t.wy + 2, 6 * t.s, { w: 1.5, a: .6 }); }
          else { P.circle(t.x, t.wy, 13 * t.s, { w: 1.8, a: .75 }); P.hatchCircle(t.x, t.wy, 12 * t.s, { a: .25, gap: 4 }); P.circle(t.x + 2, t.wy - 2, 4 * t.s, { w: 1.2, a: .5 }); }
        }
        for (const it of g.items) {
          if (it.got && it.kind !== 'oil') continue;
          const { x, wy } = it;
          if (it.kind === 'fuel') {
            ctx.fillStyle = '#f5f2e9'; ctx.fillRect(x - 11, wy - 13, 22, 26);
            P.rect(x - 11, wy - 13, 22, 26, { w: 2 }); P.line(x + 3, wy - 13, x + 8, wy - 19, { w: 2 });
            P.text('F', x, wy + 1, { size: 22 });
          } else if (it.kind === 'star') P.text('★', x, wy, { size: 32 });
          else if (it.kind === 'wrench') { P.line(x - 10, wy + 10, x + 6, wy - 6, { w: 4 }); P.circle(x + 8, wy - 8, 6, { w: 2.4 }); }
          else {
            ctx.fillStyle = INK(.55); ctx.beginPath(); ctx.ellipse(x, wy, 24, 14, .3, 0, 7); ctx.fill();
            ctx.fillStyle = INK(.3); ctx.beginPath(); ctx.ellipse(x + 14, wy + 8, 8, 5, 0, 0, 7); ctx.fill();
          }
        }
        ctx.restore();

        for (const c of g.cars) drawCar(P, g, c.x, c.y, c.w, c.h, { flip: c.oncoming, shade: c.shade, kind: c.kind, blink: c.side * (c.oncoming ? -1 : 1) * (c.blink > 0 || c.x !== c.tx ? 1 : 0), tilt: (c.tx - c.x) * -.004 });
        if (!g.dead && !(p.inv > 0 && Math.floor(g.t * 12) % 2)) drawCar(P, g, p.x, PY, 30, 52, { player: true, tilt: p.tilt, spin: p.rot });
        dust.draw(P);
        for (const pp of g.pops) P.text(pp.s, pp.x, pp.y, { size: 22, a: Math.min(.9, pp.life * 1.5) });

        const low = g.fuel < 25 && Math.floor(g.t * 4) % 2;
        P.text('fuel', 14, 22, { size: 20, align: 'left', a: low ? .4 : .85 });
        ctx.fillStyle = '#f5f2e9'; ctx.fillRect(50, 14, 100, 14);
        P.shade(50, 14, g.fuel, 14, low ? .25 : .45);
        P.rect(50, 14, 100, 14, { w: 1.6 });
        if (g.fuel <= 0) P.text('out of fuel…', W / 2, H / 2 - 60, { size: 36, a: .6 });
      },
    });
  },
});
