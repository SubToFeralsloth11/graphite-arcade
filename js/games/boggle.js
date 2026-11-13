Games.register({
  id: 'boggle',
  title: 'Letter Grid',
  blurb: 'Chain touching letters into words before the sand runs out.',
  group: 'word',
  tags: ['timed', 'vs bot'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><rect x="20" y="6" width="22" height="22"/><rect x="48" y="6" width="22" height="22"/><rect x="76" y="6" width="22" height="22"/><rect x="20" y="34" width="22" height="22"/><rect x="48" y="34" width="22" height="22"/><rect x="76" y="34" width="22" height="22"/><path d="M31 17 L59 45 L87 17" stroke-width="3.4"/><path d="M30 68 h60" opacity=".6"/></svg>`,
  help: 'Make words of 3+ letters from neighbouring tiles (including diagonals), using each tile once per word. Click tiles or just type, then press Enter. Points: 3-4 letters 1, 5 letters 2, 6 letters 3, 7 letters 5, 8+ letters 11. Vs Bot: words you both find cancel out.',
  mount(root, signal) {
    let mode = 'solo', level = 'med', timer = null, keyHandler = null;
    const stage = el('div', { class: 'stage' });
    signal.addEventListener('abort', () => clearInterval(timer));
    const lvlTabs = tabs([['easy', 'Napping bot'], ['med', 'Reader bot'], ['hard', 'Lexicon bot']], level, l => { level = l; start(); });
    lvlTabs.style.display = 'none';
    root.append(el('div', { class: 'center' }, el('div', { class: 'row' },
      tabs([['solo', 'Solo 2:00'], ['bot', 'Vs Bot']], mode, m => { mode = m; lvlTabs.style.display = m === 'bot' ? '' : 'none'; start(); }), lvlTabs)), stage);
    onKeys(signal, (k, e) => keyHandler && keyHandler(k, e));

    const DICE = ['aaeegn', 'abbjoo', 'achops', 'affkps', 'aoottw', 'cimotu', 'deilrx', 'delrvy', 'distty', 'eeghnw', 'eeinsu', 'ehrtvw', 'eiosst', 'elrtty', 'himnqu', 'hlnnrz'];
    const points = w => (w.length <= 4 ? 1 : w.length === 5 ? 2 : w.length === 6 ? 3 : w.length === 7 ? 5 : 11);
    const near = (a, b) => a !== b && Math.abs((a >> 2) - (b >> 2)) <= 1 && Math.abs((a & 3) - (b & 3)) <= 1;
    /** Any tile path spelling s (tiles may hold 'qu'), or null. */
    function pathFor(tiles, s) {
      const go = (path, rest) => {
        if (!rest) return path;
        for (let i = 0; i < 16; i++) {
          if (path.includes(i) || (path.length && !near(path[path.length - 1], i)) || !rest.startsWith(tiles[i])) continue;
          const r = go([...path, i], rest.slice(tiles[i].length)); if (r) return r;
        }
        return null;
      };
      return go([], s);
    }
    function solve(tiles) {
      const out = new Set();
      const dfs = (path, s) => {
        if (s.length >= 3 && Dict.has(s)) out.add(s);
        if (s.length >= 9) return;
        const last = path[path.length - 1];
        for (let i = 0; i < 16; i++) {
          if (path.includes(i) || !near(last, i)) continue;
          const t = s + tiles[i];
          if (Dict.hasPrefix(t)) dfs([...path, i], t);
        }
      };
      for (let i = 0; i < 16; i++) dfs([i], tiles[i]);
      return [...out];
    }

    function start() {
      clearInterval(timer);
      let tiles;
      do tiles = shuffle(DICE).map(d => { const c = pick([...d]); return c === 'q' ? 'qu' : c; }); while (solve(tiles).length < 40);
      const mine = new Set();
      let cur = '', path = [], left = 120, done = false;
      const cells = tiles.map((t, i) => el('div', { class: 'bg-tile', onclick: () => tap(i) }, t === 'qu' ? 'Qu' : t));
      const entry = el('div', { class: 'hive-entry' });
      const list = el('ul', { class: 'found' });
      const score = el('span', { class: 'big' }, '0');
      const clock = el('span', {}, '2:00');
      const bar = el('div', { class: 'timer', style: 'width:100%' }, el('div', { style: 'width:100%' }));
      const render = () => {
        const p = cur && (path.length ? path : pathFor(tiles, cur));
        cells.forEach((c, i) => c.classList.toggle('on', !!p && p.includes(i)));
        entry.textContent = cur || ' ';
        entry.classList.toggle('bad', !!cur && !p);
      };
      const tap = i => {
        if (done) return;
        if (path.length && path[path.length - 1] === i) return submit();
        if (path.includes(i) || (path.length && !near(path[path.length - 1], i))) return;
        if (!path.length && cur) cur = '';
        path.push(i); cur += tiles[i]; Sfx.tap(); render();
      };
      const submit = () => {
        const w = cur; cur = ''; path = [];
        if (w.length < 3) { render(); return; }
        if (mine.has(w)) toast('Already found');
        else if (!pathFor(tiles, w)) { toast('Not on the grid'); Sfx.bad(); }
        else if (!Dict.has(w)) { toast('Not a word'); Sfx.bad(); }
        else {
          mine.add(w); Sfx.good();
          list.prepend(el('li', {}, w));
          score.textContent = [...mine].reduce((n, x) => n + points(x), 0);
        }
        render();
      };
      keyHandler = (k, e) => {
        if (done) return;
        if (k === 'enter') submit();
        else if (k === 'back') { e.preventDefault(); path = []; cur = cur.slice(0, -1); render(); }
        else if (k === 'Escape') { cur = ''; path = []; render(); }
        else if (/^[a-z]$/.test(k)) { path = []; cur += k; render(); }
      };
      stage.replaceChildren(el('div', { class: 'hive-wrap' },
        el('div', { class: 'center' }, el('div', { class: 'bg-grid sk' }, cells), entry,
          el('div', { class: 'row' }, el('button', { class: 'btn btn-ghost', onclick: () => { cur = ''; path = []; render(); } }, 'clear'), el('button', { class: 'btn btn-primary', onclick: submit }, 'enter'))),
        el('div', { class: 'panel sk' }, el('div', { class: 'row' }, score, el('span', { class: 'muted' }, 'points · '), clock), bar, list)));
      render();
      const t0 = Date.now();
      timer = setInterval(() => {
        left = Math.max(0, 120 - (Date.now() - t0) / 1000);
        const s = Math.ceil(left);
        clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        bar.firstChild.style.width = (100 * left / 120) + '%';
        if (left <= 0) finish();
      }, 250);

      function finish() {
        clearInterval(timer); done = true; keyHandler = null;
        const all = solve(tiles).sort((a, b) => b.length - a.length || a.localeCompare(b));
        const mineScore = [...mine].reduce((n, x) => n + points(x), 0);
        const missed = all.filter(w => !mine.has(w)).slice(0, 12);
        if (mode === 'solo') {
          const s = Stats.record('boggle', { win: mineScore > 0, score: mineScore });
          Sfx.win(); if (s.newBest) celebrate();
          return modal(s.newBest ? 'New best!' : "Time's up", el('div', {},
            el('p', {}, `${mine.size} words, ${mineScore} points. The grid held ${all.length}.`),
            missed.length ? el('p', { class: 'muted' }, 'You missed: ' + missed.join(', ')) : null,
            statRow(s, { best: 'high score' })), [{ label: 'New grid', primary: true }]).then(v => v && start());
        }
        // Bot finds a share of the solvable words, favouring short common ones.
        const share = { easy: 0.12, med: 0.22, hard: 0.38 }[level];
        const bot = new Set(all.filter(w => Math.random() < share * (w.length <= 4 ? 1.4 : w.length <= 6 ? 0.8 : 0.4)));
        const uniq = set => [...set].filter(w => !(set === mine ? bot : mine).has(w));
        const myPts = uniq(mine).reduce((n, x) => n + points(x), 0), botPts = uniq(bot).reduce((n, x) => n + points(x), 0);
        const win = myPts > botPts;
        Stats.record('boggle', { win: myPts === botPts ? undefined : win });
        win ? (Sfx.win(), celebrate()) : Sfx.lose();
        modal(win ? 'You out-spelled the bot' : myPts === botPts ? 'Dead heat' : 'The bot wins', el('div', {},
          el('p', {}, `Unique points: you ${myPts}, bot ${botPts}.`),
          el('p', { class: 'muted' }, `Bot found ${bot.size}: ${[...bot].slice(0, 14).join(', ')}${bot.size > 14 ? '…' : ''}`)),
          [{ label: 'Rematch', primary: true }]).then(v => v && start());
      }
    }
    start();
  },
});
