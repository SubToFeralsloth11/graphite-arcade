Games.register({
  id: 'mines',
  title: 'Minefield',
  blurb: 'Sweep the sketch grid using number clues. Do not poke a mine.',
  group: 'table',
  tags: ['solo', 'logic', 'timed'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M10 10 H110 V70 H10 Z M43 10 V70 M77 10 V70 M10 40 H110"/><circle cx="60" cy="25" r="7" class="fill"/><path d="M60 13 v-2 M60 37 v2 M48 25 h-2 M72 25 h2"/><path d="M24 58 V46 l10 4 l-10 4"/><path d="M92 50 v12" stroke-width="3"/></svg>`,
  help: 'Click a square to uncover it. Numbers say how many mines touch that square. Right-click (or switch to flag mode) to flag a mine. Click a number whose flags are all placed to clear its neighbours. Your first click is always safe.',
  mount(root, signal) {
    const LV = { easy: [9, 10], med: [12, 22], hard: [15, 40] };
    let level = 'easy', flagMode = false, timer = null;
    signal.addEventListener('abort', () => clearInterval(timer));
    const stage = el('div', { class: 'stage' });
    root.append(el('div', { class: 'center' }, tabs([['easy', 'Small 9×9'], ['med', 'Medium 12×12'], ['hard', 'Large 15×15']], level, l => { level = l; start(); })), stage);

    function start() {
      clearInterval(timer);
      const [N, M] = LV[level];
      let mines = null, revealed = 0, over = false, t0 = 0, flags = 0;
      const open = Array(N * N).fill(false), flag = Array(N * N).fill(false);
      const around = i => { const r = Math.floor(i / N), c = i % N, out = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if ((dr || dc) && rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc); } return out; };
      const count = i => around(i).filter(j => mines[j]).length;
      const clock = el('span', {}, '0'), left = el('span', {}, M);
      const flagBtn = el('button', { class: 'btn btn-ghost', onclick: () => { flagMode = !flagMode; drawFlagBtn(); Sfx.tap(); } });
      const drawFlagBtn = () => (flagBtn.textContent = flagMode ? 'mode: ⚑ flag' : 'mode: dig');
      drawFlagBtn();
      const cells = Array.from({ length: N * N }, (_, i) => el('div', { class: 'mn-cell', onclick: () => (flagMode ? toggle(i) : dig(i)), oncontextmenu: e => { e.preventDefault(); toggle(i); } }));
      stage.replaceChildren(el('div', { class: 'center' },
        el('div', { class: 'row' }, el('span', { class: 'chip' }, '⚑ ', left), el('span', { class: 'chip' }, clock, 's'), flagBtn,
          el('button', { class: 'btn btn-ghost', onclick: () => { Sfx.scratch(); start(); } }, 'new board')),
        el('div', { class: 'mn-grid sk', style: `grid-template-columns:repeat(${N},1fr);max-width:${N * 38}px` }, cells)));

      function layMines(safe) {
        mines = Array(N * N).fill(false);
        const banned = new Set([safe, ...around(safe)]);
        const spots = shuffle([...Array(N * N).keys()].filter(i => !banned.has(i))).slice(0, M);
        spots.forEach(i => (mines[i] = true));
        t0 = Date.now();
        timer = setInterval(() => (clock.textContent = Math.floor((Date.now() - t0) / 1000)), 500);
      }
      function show(i) {
        const c = cells[i];
        c.className = 'mn-cell open';
        const n = count(i);
        c.textContent = n || '';
        if (n) c.dataset.n = n;
      }
      function dig(i) {
        if (over || flag[i]) return;
        if (!mines) layMines(i);
        if (open[i]) return chord(i);
        if (mines[i]) return boom(i);
        const stack = [i];
        while (stack.length) {
          const j = stack.pop();
          if (open[j] || flag[j]) continue;
          open[j] = true; revealed++; show(j);
          if (!count(j)) stack.push(...around(j));
        }
        Sfx.tap();
        if (revealed === N * N - M) win();
      }
      function chord(i) {
        const n = count(i), ns = around(i);
        if (!n || ns.filter(j => flag[j]).length !== n) return;
        for (const j of ns) if (!open[j] && !flag[j]) { dig(j); if (over) return; }
      }
      function toggle(i) {
        if (over || open[i]) return;
        flag[i] = !flag[i]; flags += flag[i] ? 1 : -1;
        cells[i].classList.toggle('flag', flag[i]);
        cells[i].textContent = flag[i] ? '⚑' : '';
        left.textContent = M - flags; Sfx.scratch();
      }
      function boom(i) {
        over = true; clearInterval(timer); Sfx.lose();
        mines.forEach((m, j) => { if (m && !flag[j]) { cells[j].className = 'mn-cell open mine'; cells[j].textContent = '✹'; } else if (!m && flag[j]) cells[j].classList.add('wrong'); });
        cells[i].classList.add('boom');
        const s = Stats.record('mines', { win: false });
        setTimeout(() => !signal.aborted && modal('Boom!', el('div', {}, el('p', {}, 'You stepped on a mine.'), statRow(s)), [{ label: 'Try again', primary: true }]).then(v => v && start()), 600);
      }
      function win() {
        over = true; clearInterval(timer);
        const secs = Math.round((Date.now() - t0) / 1000);
        mines.forEach((m, j) => { if (m) { cells[j].classList.add('flag'); cells[j].textContent = '⚑'; } });
        const key = `mines:best:${level}`, prev = Store.get(key, null), best = prev == null || secs < prev;
        if (best) Store.set(key, secs);
        const s = Stats.record('mines', { win: true });
        Sfx.win(); celebrate();
        modal(best ? 'New record!' : 'Field cleared', el('div', {}, el('p', {}, `Cleared in ${secs}s. Best on this size: ${best ? secs : prev}s.`), statRow(s)), [{ label: 'Play again', primary: true }]).then(v => v && start());
      }
    }
    start();
  },
});
