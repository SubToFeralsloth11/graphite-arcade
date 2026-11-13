Games.register({
  id: 'ttt',
  title: 'Noughts & Crosses',
  blurb: 'Three in a row on squared paper. The bot is either lazy or perfect.',
  group: 'table',
  tags: ['vs bot', '2P', 'quick'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M46 6 V74 M74 6 V74 M22 30 H98 M22 52 H98"/><path d="M28 10 l12 14 M40 10 l-12 14"/><circle cx="60" cy="41" r="7"/><path d="M80 57 l12 13 M92 57 l-12 13"/></svg>`,
  help: 'Take turns marking squares. Three in a row (across, down or diagonal) wins. Vs Bot: Doodler makes mistakes, Perfect never loses. The score carries over between rounds and the starter alternates.',
  mount(root, signal) {
    let mode = 'bot', level = 'easy', first = 0, tally = [0, 0];
    const stage = el('div', { class: 'stage' });
    const lvlTabs = tabs([['easy', 'Doodler'], ['hard', 'Perfect']], level, l => { level = l; tally = [0, 0]; start(); });
    root.append(el('div', { class: 'center' }, el('div', { class: 'row' },
      tabs([['bot', 'Vs Bot'], ['duel', 'Pass & Play']], mode, m => { mode = m; tally = [0, 0]; lvlTabs.style.display = m === 'bot' ? '' : 'none'; start(); }), lvlTabs)), stage);

    const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    const winner = b => LINES.find(([a, c, d]) => b[a] != null && b[a] === b[c] && b[a] === b[d]) || null;
    // Bot is player 1 (maximising). Scores shrink with depth so quick wins beat slow ones.
    function minimax(b, p) {
      const w = winner(b);
      if (w) return { s: b[w[0]] === 1 ? 1 : -1 };
      if (b.every(x => x != null)) return { s: 0 };
      let best = { s: p === 1 ? -2 : 2, m: -1 };
      for (const i of shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8])) {
        if (b[i] != null) continue;
        b[i] = p; const s = minimax(b, 1 - p).s * 0.9; b[i] = null;
        if (p === 1 ? s > best.s : s < best.s) best = { s, m: i };
      }
      return best;
    }
    const X = '<svg viewBox="0 0 100 100" class="doodle ink"><path d="M24 24 L76 76"/><path d="M76 24 L24 76"/></svg>';
    const O = '<svg viewBox="0 0 100 100" class="doodle ink"><path d="M50 20 C70 19 82 34 80 52 C78 72 60 82 44 79 C26 76 18 60 21 44 C24 30 36 21 54 22"/></svg>';

    function start() {
      const b = Array(9).fill(null);
      let turn = first, over = false, busy = false;
      const names = mode === 'bot' ? ['You (X)', 'Bot (O)'] : ['Player X', 'Player O'];
      const P = names.map((n, i) => el('div', { class: 'player sk' }, el('div', { class: 'who' }, n), el('div', { class: 'pts' }, tally[i])));
      const msg = el('div', { class: 'msg' });
      const cells = Array.from({ length: 9 }, (_, i) => el('button', { class: 'ttt-cell', onclick: () => human(i) }));
      stage.replaceChildren(el('div', { class: 'center' }, el('div', { class: 'scoreboard' }, P), msg, el('div', { class: 'ttt-grid' }, cells)));
      const sync = () => {
        P.forEach((p, i) => p.classList.toggle('turn', i === turn && !over));
        if (!over) msg.textContent = mode === 'bot' ? (turn === 0 ? 'Your move' : 'Bot is thinking...') : `${names[turn]} to move`;
      };
      function place(i) {
        b[i] = turn; cells[i].innerHTML = turn === 0 ? X : O; cells[i].disabled = true; Sfx.scratch();
        const w = winner(b);
        if (w) { over = true; w.forEach(j => cells[j].classList.add('win')); return end(turn); }
        if (b.every(x => x != null)) { over = true; return end(null); }
        turn = 1 - turn; sync();
        if (mode === 'bot' && turn === 1) bot();
      }
      function human(i) { if (!over && !busy && b[i] == null && !(mode === 'bot' && turn === 1)) place(i); }
      async function bot() {
        busy = true; sync();
        await sleep(350 + rand(350));
        if (signal.aborted) return;
        busy = false;
        const free = b.map((x, i) => (x == null ? i : -1)).filter(i => i >= 0);
        place(free.length === 9 ? pick([0, 2, 4, 6, 8]) : level === 'easy' && Math.random() < 0.4 ? pick(free) : minimax(b, 1).m);
      }
      function end(w) {
        sync();
        if (w != null) tally[w]++;
        P.forEach((p, i) => (p.lastChild.textContent = tally[i]));
        first = w == null ? 1 - first : 1 - w; // loser (or other player after a draw) starts next
        let title;
        if (mode === 'bot') {
          Stats.record('ttt', { win: w == null ? undefined : w === 0 });
          title = w == null ? 'Cat\'s game' : w === 0 ? 'You win!' : 'Bot wins';
          w === 0 ? (Sfx.win(), celebrate()) : w === 1 ? Sfx.lose() : Sfx.tap();
        } else {
          Stats.record('ttt', {});
          title = w == null ? 'Cat\'s game' : `${names[w]} wins!`;
          w != null ? (Sfx.win(), celebrate()) : Sfx.tap();
        }
        msg.textContent = title;
        setTimeout(() => !signal.aborted && modal(title, `Score: ${tally[0]} – ${tally[1]}`, [{ label: 'Next round', primary: true }]).then(v => v && start()), 600);
      }
      sync();
      if (mode === 'bot' && turn === 1) bot();
    }
    start();
  },
});
