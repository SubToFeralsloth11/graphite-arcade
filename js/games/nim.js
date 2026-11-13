Games.register({
  id: 'nim',
  title: 'Last Pencil',
  blurb: 'Rows of pencils. Take some from one row. Whoever takes the last pencil loses.',
  group: 'button',
  tags: ['vs bot', '2P', 'strategy'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M30 14 v16 M40 14 v16 M50 14 v16 M60 14 v16"/><path d="M40 40 v16 M50 40 v16 M60 40 v16 M70 40 v16 M80 40 v16"/><path d="M54 64 v12 M64 64 v12"/></svg>`,
  help: 'On your turn click a pencil: you take it and every pencil to its right in that row. You must take at least one, from one row only. Whoever is forced to take the very last pencil loses. Easy bot plays loosely; Clever bot knows the maths.',
  mount(root, signal) {
    let mode = 'bot', level = 'hard', first = 0;
    const stage = el('div', { class: 'stage' });
    const lvl = tabs([['easy', 'Easy'], ['hard', 'Clever']], level, l => { level = l; start(); });
    root.append(el('div', { class: 'center' }, el('div', { class: 'row' }, tabs([['bot', 'Vs Bot'], ['duel', 'Pass & Play']], mode, m => { mode = m; lvl.style.display = m === 'bot' ? '' : 'none'; start(); }), lvl)), stage);
    function botMove(rows) {
      const moves = [];
      rows.forEach((n, r) => { for (let k = 1; k <= n; k++) moves.push([r, k]); });
      if (level === 'easy' && Math.random() < .5) return pick(moves);
      for (const [r, k] of shuffle(moves)) {
        const nx = rows.slice(); nx[r] -= k;
        const big = nx.filter(n => n > 1).length, ones = nx.filter(n => n === 1).length;
        const x = nx.reduce((a, b) => a ^ b, 0);
        // Misère Nim: losing positions for the mover are xor 0 with some heap > 1, or all heaps ≤ 1 with an odd count of ones.
        if (big ? x === 0 : ones % 2 === 1) return [r, k];
      }
      return pick(moves);
    }
    function start() {
      const rows = [3, 5, 7];
      let turn = first, over = false, busy = false;
      const names = mode === 'bot' ? ['You', 'Bot'] : ['Player 1', 'Player 2'];
      const msg = el('div', { class: 'msg' });
      const board = el('div', { class: 'center' });
      stage.replaceChildren(el('div', { class: 'center' }, msg, board));
      const draw = () => {
        board.replaceChildren(...rows.map((n, r) => el('div', { class: 'row', style: 'min-height:56px' },
          Array.from({ length: n }, (_, i) => el('button', { class: 'bt-pencil', title: `take ${n - i}`, onclick: () => human(r, n - i), onmouseenter: e => hl(e, r, i), onmouseleave: () => hl(null) })))));
        if (!over) msg.textContent = mode === 'bot' && turn === 1 ? 'Bot is thinking...' : `${names[turn]}: take pencils`;
      };
      const hl = (e, r, i) => $$('.bt-pencil', board).forEach(b => b.classList.remove('pick')) || (e && [...board.children[r].children].slice(i).forEach(b => b.classList.add('pick')));
      const take = (r, k) => {
        rows[r] -= k; Sfx.scratch();
        if (rows.every(n => n === 0)) {
          over = true; const w = 1 - turn; draw();
          first = 1 - first;
          Stats.record('nim', { win: mode === 'bot' ? w === 0 : undefined });
          msg.textContent = `${names[turn]} took the last pencil. ${names[w]} win${w === 0 && mode === 'bot' ? '' : 's'}!`;
          (mode === 'duel' || w === 0) ? (Sfx.win(), celebrate()) : Sfx.lose();
          board.append(el('button', { class: 'btn btn-primary', onclick: start }, 'Again'));
          return;
        }
        turn = 1 - turn; draw();
        if (mode === 'bot' && turn === 1) bot();
      };
      const human = (r, k) => { if (!over && !busy && !(mode === 'bot' && turn === 1)) take(r, k); };
      async function bot() { busy = true; await sleep(700); if (signal.aborted) return; busy = false; take(...botMove(rows)); }
      draw();
      if (mode === 'bot' && turn === 1) bot();
    }
    start();
  },
});
