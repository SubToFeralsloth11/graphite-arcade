Games.register({
  id: 'wordsearch',
  title: 'Word Search',
  blurb: 'Circle hidden words in a grid of letters. A new sheet every day.',
  group: 'word',
  daily: true,
  tags: ['daily', 'solo', 'chill'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M10 8 H110 V72 H10 Z"/><path d="M20 24 h4 M36 24 h4 M52 24 h4 M68 24 h4 M84 24 h4 M20 44 h4 M84 44 h4 M20 62 h4 M36 62 h4 M52 62 h4"/><rect x="32" y="36" width="60" height="16" rx="8" transform="rotate(-6 62 44)"/></svg>`,
  help: 'Find every word in the list. Click the first letter, then the last letter (or drag across them). Words run across, down, diagonally, and on bigger sheets backwards too. Daily: one shared sheet per day; your time is your score.',
  mount(root, signal) {
    let mode = Stats.dailyDone('wordsearch') ? 'free' : 'daily', timer = null;
    const stage = el('div', { class: 'stage' });
    signal.addEventListener('abort', () => clearInterval(timer));
    root.append(el('div', { class: 'center' }, tabs([['daily', 'Daily sheet'], ['free', 'Endless']], mode, m => { mode = m; start(); })), stage);

    function build(rng) {
      const N = 10;
      const dirs = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
      const pool = shuffle(LISTS.long.filter(w => w.length <= 8).concat(LISTS.five), rng);
      const g = Array(N * N).fill(null), placed = [];
      for (const w of pool) {
        if (placed.length >= 9) break;
        if (placed.some(p => p.w.includes(w) || w.includes(p.w))) continue;
        for (let t = 0; t < 120; t++) {
          const [dr, dc] = dirs[Math.floor(rng() * (placed.length < 5 ? 4 : 8))];
          const r = Math.floor(rng() * N), c = Math.floor(rng() * N);
          const er = r + dr * (w.length - 1), ec = c + dc * (w.length - 1);
          if (er < 0 || er >= N || ec < 0 || ec >= N) continue;
          const idx = [...w].map((_, k) => (r + dr * k) * N + c + dc * k);
          if (idx.some((i, k) => g[i] != null && g[i] !== w[k])) continue;
          idx.forEach((i, k) => (g[i] = w[k]));
          placed.push({ w, idx });
          break;
        }
      }
      const abc = 'eeeeaaaiioonnrrsttlcdumhgpbfywkvxzjq';
      for (let i = 0; i < g.length; i++) if (g[i] == null) g[i] = abc[Math.floor(rng() * abc.length)];
      return { N, g, placed };
    }

    function start() {
      clearInterval(timer);
      const daily = mode === 'daily';
      const { N, g, placed } = build(daily ? dailyRng(4421) : Math.random);
      const found = new Set();
      let anchor = null, dragging = false, preview = [];
      const t0 = Date.now();
      const clock = el('span', {}, '0:00');
      timer = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }, 500);
      const cells = g.map((ch, i) => el('div', { class: 'ws-cell', 'data-i': i }, ch));
      const list = el('ul', { class: 'ws-list' }, placed.map(p => el('li', { 'data-w': p.w }, p.w)));
      const grid = el('div', { class: 'ws-grid sk', style: `grid-template-columns:repeat(${N},1fr)` }, cells);
      const lineTo = (a, b) => {
        const ar = Math.floor(a / N), ac = a % N, br = Math.floor(b / N), bc = b % N;
        const dr = Math.sign(br - ar), dc = Math.sign(bc - ac), len = Math.max(Math.abs(br - ar), Math.abs(bc - ac));
        if (!(ar === br || ac === bc || Math.abs(br - ar) === Math.abs(bc - ac))) return [a];
        return Array.from({ length: len + 1 }, (_, k) => (ar + dr * k) * N + ac + dc * k);
      };
      const show = idx => { preview.forEach(i => cells[i].classList.remove('sel')); preview = idx; idx.forEach(i => cells[i].classList.add('sel')); };
      const commit = idx => {
        show([]);
        const word = idx.map(i => g[i]).join(''), rev = [...word].reverse().join('');
        const hit = placed.find(p => !found.has(p.w) && (p.w === word || p.w === rev) && (p.idx.join() === idx.join() || p.idx.join() === [...idx].reverse().join()));
        if (!hit) { if (idx.length > 1) Sfx.bad(); return; }
        found.add(hit.w); Sfx.good();
        hit.idx.forEach(i => cells[i].classList.add('found'));
        list.querySelector(`[data-w="${hit.w}"]`).classList.add('got');
        if (found.size === placed.length) finish();
      };
      const cellAt = e => { const t = document.elementFromPoint(e.clientX, e.clientY); return t?.classList.contains('ws-cell') ? +t.dataset.i : null; };
      grid.addEventListener('pointerdown', e => {
        const i = cellAt(e); if (i == null) return;
        e.preventDefault();
        if (anchor != null && anchor !== i) { const idx = lineTo(anchor, i); anchor = null; return commit(idx); }
        anchor = i; dragging = true; show([i]); Sfx.tap();
      });
      grid.addEventListener('pointermove', e => { const i = cellAt(e); if (i != null && anchor != null) show(lineTo(anchor, i)); });
      document.addEventListener('pointerup', e => {
        if (!dragging) return; dragging = false;
        const i = cellAt(e);
        if (i != null && i !== anchor) { const idx = lineTo(anchor, i); anchor = null; commit(idx); }
      }, { signal });
      stage.replaceChildren(el('div', { class: 'ws-wrap' },
        grid,
        el('div', { class: 'panel sk' }, el('div', { class: 'row' }, el('span', { class: 'big' }, clock), el('span', { class: 'muted' }, daily ? `daily sheet · ${todayKey()}` : 'endless')), list,
          el('button', { class: 'btn btn-ghost', style: 'margin-top:12px', onclick: () => { Sfx.scratch(); start(); } }, daily ? 'restart' : 'new sheet'))));

      function finish() {
        clearInterval(timer);
        const secs = Math.round((Date.now() - t0) / 1000);
        const first = daily && !Stats.dailyDone('wordsearch');
        const s = Stats.record('wordsearch', { win: true, score: secs, best: 'low' });
        if (first) Stats.markDaily('wordsearch', `${secs}s`);
        Sfx.win(); celebrate();
        modal(s.newBest ? 'New record!' : 'Sheet cleared', el('div', {}, el('p', {}, `All ${placed.length} words in ${secs} seconds.`), statRow(s, { best: 'fastest (s)' })),
          [{ label: daily ? 'Endless mode' : 'New sheet', primary: true }]).then(v => { if (v) { mode = 'free'; start(); } });
      }
    }
    start();
  },
});
