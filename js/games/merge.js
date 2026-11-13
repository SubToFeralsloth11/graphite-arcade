Games.register({
  id: 'merge',
  title: '2048 Doodles',
  blurb: 'Slide numbered sketches together. Twos make fours, fours make eights...',
  group: 'arcade',
  tags: ['solo', 'puzzle', 'swipe'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M30 6 h60 v68 h-60 z M60 6 v68 M30 40 h60"/><text x="38" y="30" font-size="16" stroke-width="1.4">2</text><text x="68" y="30" font-size="16" stroke-width="1.4">2</text><text x="64" y="64" font-size="14" stroke-width="1.4">4</text><path d="M44 52 h8 M48 48 l4 4 l-4 4"/></svg>`,
  help: 'Use the arrow keys, WASD or swipe to slide every tile. Two tiles with the same number merge into one. A new 2 (or sometimes 4) appears after each move. Reach 2048 to win, then keep going for a higher score. You lose when the board is full and nothing can merge. Z undoes one move.',
  mount(root, signal) {
    const N = 4, S = 96, GAP = 12, OX = 22, OY = 22;
    let id = 0;
    const DIR = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1], swleft: [-1, 0], swright: [1, 0], swup: [0, -1], swdown: [0, 1] };
    function add(g) {
      const empty = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!g.grid[r][c]) empty.push([r, c]);
      if (!empty.length) return;
      const [r, c] = pick(empty);
      g.grid[r][c] = { v: Math.random() < .9 ? 2 : 4, id: id++, r, c, pr: r, pc: c, born: 0 };
    }
    const canMove = g => {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const t = g.grid[r][c]; if (!t) return true;
        if (c < N - 1 && g.grid[r][c + 1]?.v === t.v) return true;
        if (r < N - 1 && g.grid[r + 1][c]?.v === t.v) return true;
      }
      return false;
    };
    function move(g, [dx, dy]) {
      const before = JSON.stringify(g.grid.map(row => row.map(t => t && t.v)));
      const snapshot = { grid: g.grid.map(row => row.map(t => t && { ...t })), score: g.score };
      const order = [...Array(N).keys()];
      if (dx > 0 || dy > 0) order.reverse();
      const next = Array.from({ length: N }, () => Array(N).fill(null));
      g.ghosts = [];
      for (let line = 0; line < N; line++) {
        let target = 0, last = null;
        for (const i of order) {
          const r = dy ? i : line, c = dy ? line : i, t = g.grid[r][c];
          if (!t) continue;
          t.pr = r; t.pc = c; t.born = 1; t.pop = 0;
          if (last && last.v === t.v && !last.merged) {
            last.v *= 2; last.merged = true; last.pop = .15; g.score += last.v;
            g.ghosts.push({ ...t, r: last.r, c: last.c });
            if (last.v === 2048 && !g.won) { g.won = true; Sfx.win(); celebrate(); toast('2048! Keep going.'); }
            continue;
          }
          const pos = order[target++];
          const nr = dy ? pos : line, nc = dy ? line : pos;
          t.r = nr; t.c = nc; t.merged = false; next[nr][nc] = t; last = t;
        }
      }
      g.grid = next;
      for (const row of g.grid) for (const t of row) if (t) t.merged = false;
      if (JSON.stringify(g.grid.map(row => row.map(t => t && t.v))) === before) { g.ghosts = []; return; }
      g.undo = snapshot; g.anim = 0; Sfx.tap();
      add(g);
      if (!canMove(g)) g.end({ win: g.won, title: g.won ? 'Board full' : 'Stuck!', msg: `Biggest tile: ${Math.max(...g.grid.flat().map(t => t.v))}.` });
    }
    Arcade.mount(root, signal, {
      id: 'merge', title: '2048 Doodles', w: OX * 2 + N * S + (N - 1) * GAP, h: OY * 2 + N * S + (N - 1) * GAP,
      intro: 'Slide the tiles and merge matching numbers. Aim for 2048.',
      keysHelp: 'Arrows/WASD or swipe · Z undo · P pause',
      pads: [['left', '◀'], ['up', '▲'], ['down', '▼'], ['right', '▶']],
      init(g) { g.grid = Array.from({ length: N }, () => Array(N).fill(null)); g.ghosts = []; g.anim = 1; g.undo = null; add(g); add(g); },
      update(g, dt) {
        g.anim = Math.min(1, g.anim + dt * 8);
        for (const t of g.grid.flat()) if (t) { t.born = Math.min(1, t.born + dt * 6); t.pop = Math.max(0, (t.pop || 0) - dt); }
        if (g.anim < 1) return;
        g.ghosts = [];
        if (g.pressed.has('KeyZ') && g.undo) { g.grid = g.undo.grid; g.score = g.undo.score; g.undo = null; Sfx.scratch(); return; }
        for (const k of g.pressed) if (DIR[k]) { move(g, DIR[k]); break; }
        g.info = `biggest ${Math.max(...g.grid.flat().map(t => t ? t.v : 0))}`;
      },
      draw(g, P) {
        P.paper(g.W, g.H, { ruled: false });
        const pos = (r, c) => [OX + c * (S + GAP), OY + r * (S + GAP)];
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const [x, y] = pos(r, c); P.rect(x, y, S, S, { a: .2, w: 1.4 }); }
        const e = 1 - (1 - g.anim) ** 3;
        const tile = (t, ghost) => {
          const [ax, ay] = pos(t.pr, t.pc), [bx, by] = pos(t.r, t.c);
          const x = ax + (bx - ax) * e, y = ay + (by - ay) * e;
          const sc = ghost ? 1 : (t.born < 1 ? t.born : 1) * (1 + (t.pop || 0));
          const ctx = P.ctx; ctx.save(); ctx.translate(x + S / 2, y + S / 2); ctx.scale(sc, sc);
          const lvl = Math.log2(t.v);
          P.rect(-S / 2 + 3, -S / 2 + 3, S - 6, S - 6, { w: 2.2 });
          if (lvl > 1) P.hatchRect(-S / 2 + 3, -S / 2 + 3, S - 6, S - 6, { a: Math.min(.55, lvl * .05), gap: Math.max(3, 11 - lvl), cross: lvl > 6 });
          if (lvl >= 11) P.rect(-S / 2 + 9, -S / 2 + 9, S - 18, S - 18, { w: 1.4 });
          const size = t.v < 100 ? 52 : t.v < 1000 ? 44 : t.v < 10000 ? 36 : 28;
          ctx.fillStyle = '#f5f2e9'; ctx.font = `700 ${size}px Caveat, cursive`;
          const tw = ctx.measureText(t.v).width; ctx.fillRect(-tw / 2 - 4, -size * .35, tw + 8, size * .7);
          P.text(String(t.v), 0, 2, { size });
          ctx.restore();
        };
        if (g.anim < 1) for (const t of g.ghosts) tile(t, true);
        for (const t of g.grid.flat()) if (t) tile(t, false);
      },
    });
  },
});
