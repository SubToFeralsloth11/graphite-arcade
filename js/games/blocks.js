Games.register({
  id: 'blocks',
  title: 'Falling Blocks',
  blurb: 'Stack pencilled tetrominoes, clear lines, hold a piece for later. Gets faster every level.',
  group: 'arcade',
  tags: ['solo', 'classic', 'puzzle'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M20 70 h80 M20 70 V10 M100 70 V10"/><path d="M24 56 h14 v10 h-14 z M38 56 h14 v10 h-14 z M52 56 h14 v10 h-14 z M80 56 h14 v10 h-14 z M80 46 h14 v10 h-14 z" class="fill"/><path d="M52 16 h14 v10 h-14 z M66 16 h14 v10 h-14 z M66 26 h14 v10 h-14 z M66 6 h14 v10 h-14 z"/><path d="M73 40 v8" stroke-dasharray="2 3"/></svg>`,
  help: 'Move with ←/→, rotate with ↑ or X (Z rotates the other way), ↓ to soft drop, Space to hard drop, C or Shift to hold a piece for later. On touch: use the pads, or tap the board to rotate, swipe sideways to move, swipe down to drop and swipe up to hold. The dashed outline shows where the piece will land. Clear several lines at once and chain clears back to back for big points. Every 10 lines the level goes up and pieces fall faster.',
  mount(root, signal) {
    const COLS = 10, ROWS = 22, HID = 2, C = 24, BX = 104, BY = 12, W = 448, H = (ROWS - HID) * C + BY * 2;
    const SHAPES = [
      [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
      [[1, 1], [1, 1]],
      [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
      [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
      [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
      [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
      [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    ];
    const KICKS = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0], [-1, -1], [1, -1]];
    const LINE_PTS = [0, 100, 300, 500, 800];
    const dust = Dust();

    const rotCW = m => m.map((row, r) => row.map((_, c) => m[m.length - 1 - c][r]));
    const rotCCW = m => m.map((row, r) => row.map((_, c) => m[c][m.length - 1 - r]));
    const cellsOf = p => { const out = []; p.m.forEach((row, r) => row.forEach((v, c) => { if (v) out.push([p.x + c, p.y + r]); })); return out; };
    const fits = (g, p) => cellsOf(p).every(([x, y]) => x >= 0 && x < COLS && y < ROWS && (y < 0 || g.board[y][x] < 0));
    const gravity = lvl => Math.max(.016, Math.pow(.8 - (lvl - 1) * .007, lvl - 1));

    function nextType(g) {
      if (g.queue.length < 7) { const bag = shuffle([0, 1, 2, 3, 4, 5, 6]); g.queue.push(...bag); }
      return g.queue.shift();
    }
    function spawn(g, t = nextType(g)) {
      const m = SHAPES[t].map(r => [...r]);
      const p = { t, m, x: Math.floor((COLS - m.length) / 2), y: t === 0 ? 0 : 1 };
      p.vx = p.x; p.vy = p.y;
      g.piece = p; g.lockT = 0; g.resets = 0; g.fall = 0; g.canHold = true;
      if (!fits(g, p)) { g.piece = null; g.end({ win: false, title: 'Topped out', msg: `${g.lines} lines on level ${g.level}.` }); }
    }
    function tryMove(g, dx, dy) {
      const p = g.piece, q = { ...p, x: p.x + dx, y: p.y + dy };
      if (!fits(g, q)) return false;
      p.x = q.x; p.y = q.y;
      if (dx) bumpLock(g);
      return true;
    }
    function tryRotate(g, dir) {
      const p = g.piece; if (p.t === 1) return;
      const m = dir > 0 ? rotCW(p.m) : rotCCW(p.m);
      for (const [kx, ky] of (p.t === 0 ? [...KICKS, [0, 1], [0, -2]] : KICKS)) {
        const q = { ...p, m, x: p.x + kx, y: p.y + ky };
        if (fits(g, q)) { p.m = m; p.x = q.x; p.y = q.y; bumpLock(g); Sfx.tap(); return; }
      }
    }
    function bumpLock(g) { if (g.lockT > 0 && g.resets < 15) { g.lockT = 0; g.resets++; } }
    const ghostY = g => { const p = g.piece; let y = p.y; while (fits(g, { ...p, y: y + 1 })) y++; return y; };

    function lock(g) {
      const p = g.piece;
      let allHidden = true;
      for (const [x, y] of cellsOf(p)) { if (y >= 0) g.board[y][x] = p.t; if (y >= HID) allHidden = false; }
      g.piece = null;
      if (allHidden) return g.end({ win: false, title: 'Topped out', msg: `${g.lines} lines on level ${g.level}.` });
      const full = [];
      for (let y = 0; y < ROWS; y++) if (g.board[y].every(v => v >= 0)) full.push(y);
      if (full.length) {
        g.combo++;
        const n = full.length;
        g.score += LINE_PTS[n] * g.level * (n === 4 && g.lastTetris ? 1.5 : 1) + Math.max(0, g.combo - 1) * 50 * g.level;
        g.score = Math.round(g.score);
        g.lastTetris = n === 4;
        g.clearing = { rows: full, t: 0, dur: .32 };
        n === 4 ? Sfx.win() : Sfx.good();
        for (const y of full) for (let x = 0; x < COLS; x += 2) dust.burst(BX + x * C + C, BY + (y - HID) * C + C / 2, 3, 120);
        if (n === 4) g.flash = { text: 'FOUR LINES!', t: 1.2 };
        else if (g.combo > 1) g.flash = { text: `combo ×${g.combo}`, t: 1 };
      } else { g.combo = 0; Sfx.scratch(); spawn(g); }
    }
    function finishClear(g) {
      const rows = g.clearing.rows;
      g.board = g.board.filter((_, y) => !rows.includes(y));
      while (g.board.length < ROWS) g.board.unshift(Array(COLS).fill(-1));
      const before = g.level;
      g.lines += rows.length;
      g.level = 1 + Math.floor(g.lines / 10);
      if (g.level > before) { g.flash = { text: `level ${g.level}`, t: 1.4 }; toast(`Level ${g.level}!`); }
      g.clearing = null;
      spawn(g);
    }
    function hold(g) {
      if (!g.canHold) return;
      const t = g.piece.t;
      if (g.held == null) { g.held = t; spawn(g); } else { const h = g.held; g.held = t; spawn(g, h); }
      g.canHold = false; Sfx.tap();
    }
    function hardDrop(g) {
      const p = g.piece, y = ghostY(g);
      g.score += (y - p.y) * 2;
      for (const [x, cy] of cellsOf(p)) dust.burst(BX + x * C + C / 2, BY + (cy - HID) * C, 2, 60);
      p.y = y; p.vy = y;
      for (const [x, cy] of cellsOf(p)) dust.burst(BX + x * C + C / 2, BY + (cy - HID + 1) * C, 3, 90);
      lock(g);
    }

    // Draw a batch of cells: one clip per piece type for the pattern, then one stroke for all outlines.
    function pattern(ctx, t, x, y, w, h) {
      const g = t === 1 ? 5 : t === 0 ? 5 : 6;
      ctx.beginPath();
      if (t === 0) for (let i = y + 3; i < y + h; i += g) { ctx.moveTo(x, i); ctx.lineTo(x + w, i); }
      else if (t === 4) for (let i = x + 3; i < x + w; i += g) { ctx.moveTo(i, y); ctx.lineTo(i, y + h); }
      else {
        const back = t === 3 || t === 1 || t === 6;
        for (let i = -h; i < w; i += t === 6 ? 4 : g) {
          if (t !== 3) { ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); }
          if (back) { ctx.moveTo(x + i, y); ctx.lineTo(x + i + h, y + h); }
        }
      }
      ctx.stroke();
      if (t === 5) { ctx.fillStyle = INK(.12); ctx.fillRect(x, y, w, h); }
    }
    function drawCells(ctx, cells, ox, oy, s, a = 1) {
      const by = new Map();
      for (const c of cells) { if (!by.has(c[2])) by.set(c[2], []); by.get(c[2]).push(c); }
      for (const [t, list] of by) {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        ctx.save(); ctx.beginPath();
        for (const [x, y] of list) { const px = ox + x * s, py = oy + y * s; ctx.rect(px + 1, py + 1, s - 2, s - 2); x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px + s); y1 = Math.max(y1, py + s); }
        ctx.clip();
        ctx.lineWidth = 1.1; ctx.strokeStyle = INK(.42 * a);
        pattern(ctx, t, x0, y0, x1 - x0, y1 - y0);
        ctx.restore();
      }
      ctx.lineWidth = 1.8; ctx.strokeStyle = INK(.8 * a); ctx.lineJoin = 'round'; ctx.beginPath();
      for (const [x, y, , k] of cells) {
        const j = (n => (Math.sin(n * 91.7 + k * 13.1) * 43758.5) % 1)(x * 7 + y * 13);
        const px = ox + x * s + 1.5, py = oy + y * s + 1.5, q = s - 3;
        ctx.moveTo(px + j, py); ctx.lineTo(px + q, py - j * .6); ctx.lineTo(px + q + j * .5, py + q); ctx.lineTo(px - j * .4, py + q + j * .3); ctx.closePath();
      }
      ctx.stroke();
    }
    function preview(ctx, P, t, cx, cy, s, a = 1) {
      const m = SHAPES[t], cells = [];
      let minx = 9, maxx = -1, miny = 9, maxy = -1;
      m.forEach((row, r) => row.forEach((v, c) => { if (v) { minx = Math.min(minx, c); maxx = Math.max(maxx, c); miny = Math.min(miny, r); maxy = Math.max(maxy, r); } }));
      m.forEach((row, r) => row.forEach((v, c) => { if (v) cells.push([c - minx, r - miny, t, r * 4 + c]); }));
      drawCells(ctx, cells, cx - (maxx - minx + 1) * s / 2, cy - (maxy - miny + 1) * s / 2, s, a);
    }

    Arcade.mount(root, signal, {
      id: 'blocks', title: 'Falling Blocks', w: W, h: H,
      intro: 'Fill whole rows to clear them. Hold a spare piece with C. Do not let the stack reach the top.',
      keysHelp: '←/→ move · ↑/X rotate · Z rotate back · ↓ soft drop · Space hard drop · C/Shift hold · P pause',
      pads: [['left', '◀'], ['rot', '⟳'], ['right', '▶'], ['down', '▼'], ['drop', '⤓'], ['hold', 'hold']],
      init(g) {
        g.board = Array.from({ length: ROWS }, () => Array(COLS).fill(-1));
        g.queue = []; g.held = null; g.lines = 0; g.level = 1; g.combo = 0; g.lastTetris = false;
        g.clearing = null; g.flash = null; g.das = 0; g.dasDir = 0;
        spawn(g);
        g.info = 'level 1 · 0 lines';
      },
      update(g, dt) {
        dust.update(dt);
        if (g.flash && (g.flash.t -= dt) <= 0) g.flash = null;
        if (g.clearing) { if ((g.clearing.t += dt) >= g.clearing.dur) finishClear(g); return; }
        const p = g.piece; if (!p) return;
        const pr = g.pressed, k = g.keys;
        if (pr.has('KeyC') || pr.has('ShiftLeft') || pr.has('ShiftRight') || pr.has('hold') || pr.has('swup')) { g.drag = null; hold(g); return; }
        if (pr.has('up') || pr.has('KeyX') || pr.has('rot')) tryRotate(g, 1);
        if (pr.has('KeyZ') || pr.has('KeyQ')) tryRotate(g, -1);
        // Touch: drag sideways to slide column by column; a tap that did not drag rotates.
        if (pr.has('tap')) g.drag = { ax: g.ptr.x, moved: false };
        if (g.drag) {
          while (g.ptr.x - g.drag.ax > C * .9) { g.drag.ax += C * .9; g.drag.moved = true; tryMove(g, 1, 0); }
          while (g.drag.ax - g.ptr.x > C * .9) { g.drag.ax -= C * .9; g.drag.moved = true; tryMove(g, -1, 0); }
          if (!g.ptr.down) {
            if (!g.drag.moved && !['swleft', 'swright', 'swup', 'swdown'].some(s => pr.has(s))) tryRotate(g, 1);
            g.drag = null;
          }
        }
        // Delayed auto-shift: one step on press, then repeat while held.
        const dir = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
        if (pr.has('left') || pr.has('right')) { g.dasDir = pr.has('left') ? -1 : 1; tryMove(g, g.dasDir, 0); g.das = .17; }
        else if (dir && dir === g.dasDir) { g.das -= dt; while (g.das <= 0) { g.das += .045; if (!tryMove(g, dir, 0)) break; } }
        else if (dir) { g.dasDir = dir; g.das = .17; tryMove(g, dir, 0); }
        else g.dasDir = 0;
        if (pr.has('Space') || pr.has('drop') || pr.has('swdown')) { hardDrop(g); return; }
        const soft = k.has('down');
        const iv = gravity(g.level), step = soft ? Math.min(.035, iv) : iv;
        g.fall += dt;
        while (g.fall >= step) { g.fall -= step; if (tryMove(g, 0, 1)) { if (soft) g.score += 1; } else { g.fall = 0; break; } }
        if (!fits(g, { ...p, y: p.y + 1 })) {
          g.lockT += dt;
          if (g.lockT >= .5) lock(g);
        } else g.lockT = 0;
        if (g.piece) { const f = Math.min(1, dt * 28); g.piece.vx += (g.piece.x - g.piece.vx) * f; g.piece.vy += (g.piece.y - g.piece.vy) * Math.min(1, dt * 34); }
        g.info = `level ${g.level} · ${g.lines} lines`;
      },
      draw(g, P) {
        const ctx = P.ctx;
        P.paper(W, H, { ruled: false });
        const bw = COLS * C, bh = (ROWS - HID) * C;
        // grid paper inside the well
        ctx.strokeStyle = 'rgba(70,110,160,.12)'; ctx.lineWidth = 1; ctx.beginPath();
        for (let i = 1; i < COLS; i++) { ctx.moveTo(BX + i * C, BY); ctx.lineTo(BX + i * C, BY + bh); }
        for (let i = 1; i < ROWS - HID; i++) { ctx.moveTo(BX, BY + i * C); ctx.lineTo(BX + bw, BY + i * C); }
        ctx.stroke();
        P.line(BX - 3, BY - 4, BX - 3, BY + bh + 3, { w: 3 }); P.line(BX + bw + 3, BY - 4, BX + bw + 3, BY + bh + 3, { w: 3 }); P.line(BX - 3, BY + bh + 3, BX + bw + 3, BY + bh + 3, { w: 3 });
        if (g.board.slice(HID, HID + 3).some(r => r.some(v => v >= 0))) P.shade(BX, BY, bw, 3 * C, .06 + Math.sin(g.t * 8) * .03);

        const cells = [];
        g.board.forEach((row, y) => { if (y >= HID) row.forEach((v, x) => { if (v >= 0) cells.push([x, y - HID, v, 0]); }); });
        ctx.save(); ctx.beginPath(); ctx.rect(BX, BY, bw, bh); ctx.clip();
        drawCells(ctx, cells, BX, BY, C);
        if (g.clearing) {
          const f = clamp(g.clearing.t / g.clearing.dur, 0, 1);
          for (const y of g.clearing.rows) {
            const py = BY + (y - HID) * C;
            ctx.fillStyle = '#f5f2e9'; ctx.fillRect(BX, py, bw * f, C);
            ctx.fillStyle = INK(.5); ctx.fillRect(BX + bw * f - 6, py + 2, 6, C - 4);
          }
        }
        const p = g.piece;
        if (p) {
          const gy = ghostY(g);
          ctx.setLineDash([3, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = INK(.45); ctx.beginPath();
          for (const [x, y] of cellsOf({ ...p, y: gy })) ctx.rect(BX + x * C + 3, BY + (y - HID) * C + 3, C - 6, C - 6);
          ctx.stroke(); ctx.setLineDash([]);
          const act = [];
          p.m.forEach((row, r) => row.forEach((v, c) => { if (v) act.push([c, r, p.t, r * 4 + c]); }));
          drawCells(ctx, act, BX + p.vx * C, BY + (p.vy - HID) * C, C, g.lockT > 0 ? .75 + Math.sin(g.t * 30) * .25 : 1);
        }
        ctx.restore();

        // side panels
        P.text('hold', 52, 26, { size: 22, a: .7 });
        P.rect(12, 42, 80, 64, { w: 1.6, a: .6 });
        if (g.held != null) preview(ctx, P, g.held, 52, 74, 16, g.canHold ? 1 : .35);
        const rx = BX + bw + 50;
        P.text('next', rx, 26, { size: 22, a: .7 });
        P.rect(rx - 40, 42, 80, 190, { w: 1.6, a: .6 });
        (g.queue || []).slice(0, 3).forEach((t, i) => preview(ctx, P, t, rx, 76 + i * 60, i ? 13 : 16, i ? .7 : 1));
        P.text('level', 52, 150, { size: 20, a: .6 }); P.text(String(g.level), 52, 178, { size: 34 });
        P.text('lines', 52, 222, { size: 20, a: .6 }); P.text(String(g.lines), 52, 250, { size: 34 });
        if (g.combo > 1) { P.text('combo', 52, 294, { size: 20, a: .6 }); P.text(`×${g.combo}`, 52, 322, { size: 30 }); }
        P.text('next level', rx, 270, { size: 18, a: .55 });
        P.rect(rx - 34, 284, 68, 10, { w: 1.2, a: .5 });
        ctx.fillStyle = INK(.45); ctx.fillRect(rx - 33, 285, 66 * ((g.lines % 10) / 10), 8);
        dust.draw(P);
        if (g.flash) P.text(g.flash.text, BX + bw / 2, BY + bh * .35, { size: 40, a: Math.min(.85, g.flash.t * 1.5) });
      },
    });
  },
});
