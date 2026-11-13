Games.register({
  id: 'maze',
  title: 'Ink Maze',
  blurb: 'Gobble every dot in a pencilled maze while four scribble ghosts hunt you. Power pellets turn the tables.',
  group: 'arcade',
  tags: ['solo', 'classic', 'levels'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M6 8 h108 v64 h-108 z M24 24 h28 v10 h-28 z M68 24 h28 v10 h-28 z M24 48 h72"/><path d="M40 60 a10 10 0 1 1 0 -0.1 l-8 -6 z" class="fill"/><path d="M84 66 v-12 a8 8 0 0 1 16 0 v12 l-4 -3 l-4 3 l-4 -3 z"/><circle cx="58" cy="60" r="2" class="fill"/><circle cx="68" cy="60" r="2" class="fill"/><circle cx="16" cy="16" r="4"/></svg>`,
  help: 'Steer with the arrow keys, WASD, swipes or the pads. You can press a direction early and the scribbler turns at the next opening. Eat every dot to clear the maze. The four ghosts each hunt differently: Smudge chases you directly, Scrawl cuts you off, Doodle flanks, and Blot wanders when close. Eat a big power pellet and the ghosts turn hollow and run, so eat them for 200, 400, 800 and 1600. A bonus star shows up twice per level. The side tunnel wraps around. Each level the ghosts get quicker and the pellets wear off sooner.',
  mount(root, signal) {
    const MAP = [
      '###################',
      '#........#........#',
      '#o##.###.#.###.##o#',
      '#.................#',
      '#.##.#.#####.#.##.#',
      '#....#...#...#....#',
      '####.### # ###.####',
      '   #.#       #.#   ',
      '####.# ##-## #.####',
      '    .  #   #  .    ',
      '####.# ##### #.####',
      '   #.#       #.#   ',
      '####.# ##### #.####',
      '#........#........#',
      '#.##.###.#.###.##.#',
      '#o.#.....P.....#.o#',
      '##.#.#.#####.#.#.##',
      '#....#...#...#....#',
      '#.######.#.######.#',
      '#.................#',
      '###################',
    ];
    const C = 24, COLS = MAP[0].length, ROWS = MAP.length, W = COLS * C, H = ROWS * C;
    const DOOR = [9, 8], OUT = [9, 7], HOUSE_Y = 9;
    const DIRS = [[0, -1], [-1, 0], [0, 1], [1, 0]];
    const KEYDIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0], swup: [0, -1], swdown: [0, 1], swleft: [-1, 0], swright: [1, 0] };
    const MODES = [7, 20, 7, 20, 5, 20, 5, Infinity];
    const BONUS = [100, 300, 500, 700, 1000, 2000, 3000, 5000];
    const GHOSTS = [
      { name: 'Smudge', corner: [COLS - 3, -3], home: [9, 7], wait: 0 },
      { name: 'Scrawl', corner: [2, -3], home: [9, 9], wait: 1 },
      { name: 'Doodle', corner: [COLS - 1, ROWS], home: [8, 9], wait: 5 },
      { name: 'Blot', corner: [0, ROWS], home: [10, 9], wait: 9 },
    ];
    const dust = Dust();
    let start = [9, 15];
    MAP.forEach((row, y) => { const x = row.indexOf('P'); if (x >= 0) start = [x, y]; });

    const wall = (x, y) => { if (y < 0 || y >= ROWS) return true; const ch = MAP[y][((x % COLS) + COLS) % COLS]; return ch === '#' || ch === '-'; };
    const same = (a, b) => a[0] === b[0] && a[1] === b[1];

    /** Walk entity e (tile coords) dist tiles along the grid; choose(e) picks a direction at each tile centre. */
    function advance(e, dist, choose) {
      for (let guard = 0; dist > 1e-6 && guard < 8; guard++) {
        if (!e.dir[0] && !e.dir[1]) {
          const d = choose(e); if (!d) return;
          e.dir = d; e.tx = e.x + d[0]; e.ty = e.y + d[1];
        }
        const rem = Math.abs(e.tx - e.x) + Math.abs(e.ty - e.y);
        if (dist < rem) { e.x += e.dir[0] * dist; e.y += e.dir[1] * dist; return; }
        e.x = e.tx; e.y = e.ty; dist -= rem;
        if (e.x < 0) e.x += COLS; else if (e.x >= COLS) e.x -= COLS;
        e.tx = e.x; e.ty = e.y;
        const d = choose(e);
        if (!d) { e.dir = [0, 0]; return; }
        e.dir = d; e.tx = e.x + d[0]; e.ty = e.y + d[1];
      }
    }
    const reverse = e => { if (!e.dir[0] && !e.dir[1]) return; e.tx -= e.dir[0]; e.ty -= e.dir[1]; e.dir = [-e.dir[0], -e.dir[1]]; };
    const tileOf = e => [Math.round(e.x + COLS) % COLS, Math.round(e.y)];

    function resetLevel(g) {
      g.dots = MAP.map(row => [...row].map(ch => ch === '.' ? 1 : ch === 'o' ? 2 : 0));
      g.left = g.dots.flat().filter(Boolean).length; g.total = g.left; g.eatenDots = 0; g.bonusShown = 0; g.bonus = null;
      resetActors(g);
    }
    function resetActors(g) {
      g.pl = { x: start[0], y: start[1], tx: start[0], ty: start[1], dir: [0, 0], want: [-1, 0], face: [-1, 0], chomp: 0 };
      const lvlWait = Math.max(.4, 1 - (g.level - 1) * .12);
      g.ghosts = GHOSTS.map((d, i) => ({
        ...d, i, x: d.home[0], y: d.home[1], tx: d.home[0], ty: d.home[1], dir: [0, 0],
        state: i === 0 ? 'active' : 'house', wait: d.wait * lvlWait, path: null, fr: false,
      }));
      g.modeI = 0; g.modeT = MODES[0]; g.frightT = 0; g.chain = 0; g.ready = 1.6;
    }
    function ghostTarget(g, e) {
      if (e.state === 'eyes') return OUT;
      const pt = tileOf(g.pl), pd = g.pl.face;
      if (g.modeI % 2 === 0) return e.corner;
      if (e.i === 0) return pt;
      if (e.i === 1) return [pt[0] + pd[0] * 4, pt[1] + pd[1] * 4];
      if (e.i === 2) { const b = tileOf(g.ghosts[0]), v = [pt[0] + pd[0] * 2, pt[1] + pd[1] * 2]; return [v[0] * 2 - b[0], v[1] * 2 - b[1]]; }
      const t = tileOf(e);
      return Math.hypot(t[0] - pt[0], t[1] - pt[1]) > 8 ? pt : e.corner;
    }
    function ghostChoose(g, e) {
      if (e.state === 'eyes' && e.x === OUT[0] && e.y === OUT[1]) return null;
      const back = [-e.dir[0], -e.dir[1]];
      let opts = DIRS.filter(d => !wall(e.x + d[0], e.y + d[1]) && !same(d, back));
      if (!opts.length) opts = [back];
      if (e.fr && g.frightT > 0 && e.state === 'active') return pick(opts);
      const t = ghostTarget(g, e);
      let best = opts[0], bd = Infinity;
      for (const d of opts) { const dd = (e.x + d[0] - t[0]) ** 2 + (e.y + d[1] - t[1]) ** 2; if (dd < bd) { bd = dd; best = d; } }
      return best;
    }
    function playerChoose(e) {
      if (!wall(e.x + e.want[0], e.y + e.want[1])) return e.want;
      if ((e.dir[0] || e.dir[1]) && !wall(e.x + e.dir[0], e.y + e.dir[1])) return e.dir;
      return null;
    }
    function moveLinear(e, sp, dt) {
      let d = sp * dt;
      while (e.path && e.path.length && d > 0) {
        const [px, py] = e.path[0], dx = px - e.x, dy = py - e.y, l = Math.hypot(dx, dy);
        if (l <= d) { e.x = px; e.y = py; d -= l; e.path.shift(); }
        else { e.x += dx / l * d; e.y += dy / l * d; e.dir = [Math.sign(Math.round(dx)), Math.sign(Math.round(dy))]; d = 0; }
      }
      return !e.path || !e.path.length;
    }
    function eat(g, x, y) {
      const v = g.dots[y] && g.dots[y][x];
      if (!v) return;
      g.dots[y][x] = 0; g.left--; g.eatenDots++;
      if (v === 1) { g.score += 10; if (g.eatenDots % 2) Sfx.tap(); }
      else {
        g.score += 50; Sfx.good(); g.chain = 0;
        g.frightT = Math.max(1.5, 7 - (g.level - 1) * .8);
        for (const gh of g.ghosts) if (gh.state === 'active' || gh.state === 'exit' || gh.state === 'house') { gh.fr = true; if (gh.state === 'active') reverse(gh); }
      }
      if ((g.eatenDots === 70 || g.eatenDots === 170) && !g.bonus) g.bonus = { t: 9, pts: BONUS[Math.min(BONUS.length - 1, g.level - 1)] };
      if (!g.left) { g.clear = 2; Sfx.win(); }
    }

    let wallsImg = null;
    function renderWalls() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cv = document.createElement('canvas'); cv.width = W * dpr; cv.height = H * dpr;
      const c = cv.getContext('2d'); c.scale(dpr, dpr);
      const OP = Pencil(c);
      c.save(); c.beginPath();
      MAP.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') c.rect(x * C, y * C, C, C); }));
      c.clip(); c.fillStyle = INK(.06); c.fillRect(0, 0, W, H);
      c.lineWidth = 1; c.strokeStyle = INK(.22); c.beginPath();
      for (let i = -H; i < W; i += 6) { c.moveTo(i, H); c.lineTo(i + H, 0); }
      c.stroke(); c.restore();
      const solid = (x, y) => y >= 0 && y < ROWS && x >= 0 && x < COLS && MAP[y][x] === '#';
      // merge wall/open boundaries into long runs so lines look hand-ruled, not stitched
      for (let y = 0; y <= ROWS; y++) for (const side of [0, 1]) {
        let run = -1;
        for (let x = 0; x <= COLS; x++) {
          const a = solid(x, y - 1), b = solid(x, y), edge = x < COLS && (side ? a && !b && y < ROWS : b && !a && y > 0);
          if (edge && run < 0) run = x;
          if (!edge && run >= 0) { OP.line(run * C, y * C + (side ? -2 : 2), x * C, y * C + (side ? -2 : 2), { w: 2.2, r: 1 }); run = -1; }
        }
      }
      for (let x = 0; x <= COLS; x++) for (const side of [0, 1]) {
        let run = -1;
        for (let y = 0; y <= ROWS; y++) {
          const a = solid(x - 1, y), b = solid(x, y), edge = y < ROWS && (side ? a && !b && x < COLS : b && !a && x > 0);
          if (edge && run < 0) run = y;
          if (!edge && run >= 0) { OP.line(x * C + (side ? -2 : 2), run * C, x * C + (side ? -2 : 2), y * C, { w: 2.2, r: 1 }); run = -1; }
        }
      }
      c.setLineDash([4, 4]); c.lineWidth = 2; c.strokeStyle = INK(.6); c.beginPath();
      c.moveTo(DOOR[0] * C + 1, DOOR[1] * C + C / 2); c.lineTo(DOOR[0] * C + C - 1, DOOR[1] * C + C / 2); c.stroke();
      return cv;
    }

    function drawGhost(ctx, e, g) {
      const fr = e.fr && g.frightT > 0 && e.state !== 'eyes';
      const flash = fr && g.frightT < 2 && Math.floor(g.t * 6) % 2;
      const r = C * .46, wob = g.t * 10 + e.i;
      const body = c => {
        c.moveTo(-r, r); c.lineTo(-r, 0); c.arc(0, 0, r, Math.PI, 0); c.lineTo(r, r);
        for (let k = 3; k >= 0; k--) { const x = -r + k * r / 2; c.lineTo(x + r / 4, r - 4 - Math.sin(wob + k) * 1.5); c.lineTo(x, r + Math.sin(wob + k * 2) * 1.2); }
        c.closePath();
      };
      if (e.state !== 'eyes') {
        ctx.save(); ctx.beginPath(); body(ctx); ctx.fillStyle = '#f5f2e9'; ctx.fill();
        if (!fr) {
          ctx.clip(); ctx.lineWidth = 1.1; ctx.strokeStyle = INK(.5); ctx.beginPath();
          if (e.i === 0) for (let i = -2 * r; i < r; i += 3.5) { ctx.moveTo(i, r); ctx.lineTo(i + 2 * r, -r); }
          else if (e.i === 1) for (let i = -r; i < r; i += 4) { ctx.moveTo(-r, i); ctx.lineTo(r, i); }
          else if (e.i === 2) for (let i = -2 * r; i < r; i += 5) { ctx.moveTo(i, r); ctx.lineTo(i + 2 * r, -r); ctx.moveTo(i, -r); ctx.lineTo(i + 2 * r, r); }
          else for (let i = -r; i < r; i += 3.5) { ctx.moveTo(i, -r); ctx.lineTo(i, r); }
          ctx.stroke();
        }
        ctx.restore();
        ctx.lineJoin = 'round'; ctx.lineWidth = 2; ctx.strokeStyle = INK(flash ? .3 : .85);
        if (fr) ctx.setLineDash([3, 3]);
        ctx.beginPath(); body(ctx); ctx.stroke(); ctx.setLineDash([]);
        if (fr) {
          ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-r * .6, r * .35);
          for (let k = 1; k <= 4; k++) ctx.lineTo(-r * .6 + k * r * .3, r * .35 + (k % 2 ? -3 : 0));
          ctx.stroke();
          ctx.fillStyle = INK(.85); ctx.beginPath(); ctx.arc(-3.5, -2, 1.8, 0, 7); ctx.arc(3.5, -2, 1.8, 0, 7); ctx.fill();
          return;
        }
      }
      const [dx, dy] = e.dir;
      ctx.fillStyle = '#f5f2e9'; ctx.strokeStyle = INK(.85); ctx.lineWidth = 1.4;
      for (const ex of [-4, 4]) { ctx.beginPath(); ctx.ellipse(ex, -2, 3.4, 4.2, 0, 0, 7); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = INK(.95); ctx.beginPath(); ctx.arc(-4 + dx * 1.6, -2 + dy * 2, 1.8, 0, 7); ctx.arc(4 + dx * 1.6, -2 + dy * 2, 1.8, 0, 7); ctx.fill();
    }
    function drawPlayer(ctx, pl, k = 0) {
      const ang = Math.atan2(pl.face[1], pl.face[0]), r = C * .45;
      const mouth = k > 0 ? .3 + k * (Math.PI * 2 - .4) : .15 + Math.abs(Math.sin(pl.chomp * 9)) * .7;
      ctx.save(); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, mouth / 2, Math.PI * 2 - mouth / 2); ctx.closePath();
      ctx.fillStyle = INK(.2); ctx.fill();
      ctx.save(); ctx.clip(); ctx.strokeStyle = INK(.55); ctx.lineWidth = 1.2; ctx.beginPath();
      for (let i = 0; i < 7; i++) { const a = i * 2.3, rr = r * .8; ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); ctx.lineTo(Math.cos(a + 2.6) * rr, Math.sin(a + 2.6) * rr); }
      ctx.stroke(); ctx.restore();
      ctx.lineWidth = 2.2; ctx.strokeStyle = INK(.9); ctx.lineJoin = 'round'; ctx.stroke();
      ctx.fillStyle = INK(.9); ctx.beginPath(); ctx.arc(r * .25, -r * .5, 1.8, 0, 7); ctx.fill();
      ctx.restore();
    }
    // Draw at x and, near the tunnel edges, also at the wrapped position so it slides through smoothly.
    function wrapDraw(ctx, x, y, fn) {
      for (const ox of [0, -COLS, COLS]) {
        const px = (x + ox) * C + C / 2;
        if (px < -C || px > W + C) continue;
        ctx.save(); ctx.translate(px, y * C + C / 2); fn(); ctx.restore();
      }
    }

    Arcade.mount(root, signal, {
      id: 'maze', title: 'Ink Maze', w: W, h: H,
      intro: 'Eat every dot. Grab a power pellet to chase the ghosts back.',
      keysHelp: 'Arrows/WASD or swipe · press early to turn at the next gap · P pause',
      pads: [['left', '◀'], ['up', '▲'], ['down', '▼'], ['right', '▶']],
      init(g) {
        g.level = 1; g.lives = 3; g.popups = []; g.freeze = 0; g.dying = 0; g.clear = 0; g.extra = false;
        resetLevel(g);
        g.info = 'level 1 · ♥ 3';
      },
      update(g, dt) {
        const pl = g.pl;
        dust.update(dt);
        for (const t of g.popups) { t.t -= dt; t.y -= .8 * dt; }
        g.popups = g.popups.filter(t => t.t > 0);
        for (const k of g.pressed) if (KEYDIR[k]) pl.want = KEYDIR[k];
        g.info = `level ${g.level} · ♥ ${g.lives}`;

        if (g.clear > 0) {
          if ((g.clear -= dt) <= 0) { g.level++; g.score += 500 * (g.level - 1); toast(`Level ${g.level}!`); celebrate(10); resetLevel(g); }
          return;
        }
        if (g.dying > 0) {
          if ((g.dying -= dt) <= 0) {
            g.lives--;
            if (g.lives <= 0) return g.end({ win: false, title: 'Caught!', msg: `You reached level ${g.level}.` });
            resetActors(g);
          }
          return;
        }
        if (g.ready > 0) { g.ready -= dt; return; }
        if (g.freeze > 0) { g.freeze -= dt; return; }

        // player
        const sp = 7.4 * Math.min(1.2, 1 + (g.level - 1) * .04) * (g.frightT > 0 ? 1.08 : 1);
        if (same(pl.want, [-pl.dir[0], -pl.dir[1]]) && (pl.dir[0] || pl.dir[1])) reverse(pl);
        const bx = pl.x, by = pl.y;
        advance(pl, sp * dt, playerChoose);
        const moved = Math.abs(pl.x - bx) + Math.abs(pl.y - by);
        if (moved > 0 && moved < 2) pl.chomp += moved / 6;
        if (pl.dir[0] || pl.dir[1]) pl.face = pl.dir;
        const [ptx, pty] = tileOf(pl);
        eat(g, ptx, pty);
        if (g.bonus) {
          if ((g.bonus.t -= dt) <= 0) g.bonus = null;
          else if (ptx === 9 && pty === 11) { g.score += g.bonus.pts; g.popups.push({ x: 9, y: 11, text: `+${g.bonus.pts}`, t: 1.4 }); Sfx.win(); dust.burst(9 * C + C / 2, 11 * C + C / 2, 16, 120); g.bonus = null; }
        }
        if (!g.extra && g.score >= 10000) { g.extra = true; g.lives++; toast('Extra life!'); Sfx.good(); }
        if (g.clear > 0) return;

        // ghost modes
        if (g.frightT > 0) { g.frightT -= dt; if (g.frightT <= 0) for (const gh of g.ghosts) gh.fr = false; }
        else if ((g.modeT -= dt) <= 0) { g.modeI = Math.min(MODES.length - 1, g.modeI + 1); g.modeT = MODES[g.modeI]; for (const gh of g.ghosts) if (gh.state === 'active') reverse(gh); }

        const base = 7 * Math.min(1.2, .9 + g.level * .05);
        for (const e of g.ghosts) {
          if (e.state === 'house') {
            e.wait -= dt;
            if (e.wait <= 0 || (e.i === 2 && g.eatenDots >= 30) || (e.i === 3 && g.eatenDots >= 60)) { e.state = 'exit'; e.path = [[9, HOUSE_Y], [OUT[0], OUT[1]]]; }
            continue;
          }
          if (e.state === 'exit' || e.state === 'enter') {
            if (moveLinear(e, e.state === 'enter' ? 10 : 4, dt)) {
              if (e.state === 'enter') { e.state = 'exit'; e.fr = false; e.path = [[OUT[0], OUT[1]]]; }
              else { e.state = 'active'; e.x = OUT[0]; e.y = OUT[1]; e.tx = e.x; e.ty = e.y; e.dir = [0, 0]; }
            }
            continue;
          }
          let s = base;
          if (e.state === 'eyes') s = 15;
          else if (e.fr && g.frightT > 0) s = 4.2;
          else if (e.i === 0 && g.left < 25) s *= 1.1;
          if (e.state !== 'eyes' && e.y === 9 && (e.x < 4 || e.x > 14)) s *= .55;
          advance(e, s * dt, en => ghostChoose(g, en));
          if (e.state === 'eyes' && e.x === OUT[0] && e.y === OUT[1]) { e.state = 'enter'; e.path = [[9, HOUSE_Y]]; }
        }

        // collisions
        for (const e of g.ghosts) {
          if (e.state !== 'active') continue;
          let dx = Math.abs(e.x - pl.x); dx = Math.min(dx, COLS - dx);
          if (dx + Math.abs(e.y - pl.y) > .7) continue;
          if (e.fr && g.frightT > 0) {
            const pts = 200 * 2 ** g.chain++;
            g.score += pts; e.state = 'eyes'; e.fr = false; Sfx.good(); g.freeze = .45;
            g.popups.push({ x: e.x, y: e.y, text: String(pts), t: 1 });
            dust.burst(e.x * C + C / 2, e.y * C + C / 2, 16, 140);
          } else { g.dying = 1.5; Sfx.bad(); dust.burst(pl.x * C + C / 2, pl.y * C + C / 2, 24, 140); return; }
        }
      },
      draw(g, P) {
        const ctx = P.ctx;
        P.paper(W, H, { ruled: false });
        wallsImg ||= renderWalls();
        ctx.globalAlpha = g.clear > 0 && Math.floor(g.clear * 6) % 2 ? .35 : 1;
        ctx.drawImage(wallsImg, 0, 0, W, H);
        ctx.globalAlpha = 1;
        // dots
        ctx.fillStyle = INK(.75); ctx.beginPath();
        g.dots.forEach((row, y) => row.forEach((v, x) => { if (v === 1) { ctx.moveTo(x * C + C / 2 + 2.4, y * C + C / 2); ctx.arc(x * C + C / 2, y * C + C / 2, 2.4, 0, 7); } }));
        ctx.fill();
        const pulse = 6 + Math.sin(g.t * 8) * 1.2;
        g.dots.forEach((row, y) => row.forEach((v, x) => {
          if (v !== 2) return;
          const cx = x * C + C / 2, cy = y * C + C / 2;
          ctx.fillStyle = INK(.25); ctx.beginPath(); ctx.arc(cx, cy, pulse, 0, 7); ctx.fill();
          ctx.strokeStyle = INK(.85); ctx.lineWidth = 1.8; ctx.stroke();
        }));
        if (g.bonus) {
          const a = g.bonus.t < 2 && Math.floor(g.t * 8) % 2 ? .35 : .9;
          P.text('★', 9 * C + C / 2, 11 * C + C / 2 + 1, { size: 28, a });
        }
        for (const e of g.ghosts) {
          if (g.dying > 0 && g.dying < 1.1) break;
          const bob = e.state === 'house' ? Math.sin(g.t * 6 + e.i) * .15 : 0;
          wrapDraw(ctx, e.x, e.y + bob, () => drawGhost(ctx, e, g));
        }
        const pl = g.pl;
        const k = g.dying > 0 ? clamp((1.5 - g.dying) / 1.1, .001, 1) : 0;
        if (!(g.dying > 0 && k >= 1)) wrapDraw(ctx, pl.x, pl.y, () => drawPlayer(ctx, pl, k));
        for (const t of g.popups) P.text(t.text, t.x * C + C / 2, t.y * C + C / 2, { size: 22, a: Math.min(.9, t.t * 1.5) });
        dust.draw(P);
        for (let i = 0; i < g.lives - 1 && i < 5; i++) { ctx.save(); ctx.translate(14 + i * 20, H - 12); ctx.scale(.65, .65); drawPlayer(ctx, { face: [1, 0], chomp: .1 }); ctx.restore(); }
        if (g.ready > 0) P.text(g.level > 1 && g.eatenDots === 0 ? `level ${g.level}` : 'ready!', W / 2, 11 * C + C / 2, { size: 30, a: .85 });
        if (g.clear > 0) P.text('cleared!', W / 2, 11 * C + C / 2, { size: 30, a: .85 });
      },
    });
  },
});
