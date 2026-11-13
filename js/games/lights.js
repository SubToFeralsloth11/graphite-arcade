Games.register({
  id: 'lights',
  title: 'Lights Out',
  blurb: 'Every tap flips a square and its neighbours. Rub out every shaded square.',
  group: 'button',
  tags: ['solo', 'puzzle', 'daily'],
  daily: true,
  icon: `<svg viewBox="0 0 120 80" class="doodle"><rect x="30" y="8" width="20" height="20" class="hatch"/><rect x="50" y="8" width="20" height="20"/><rect x="70" y="8" width="20" height="20" class="hatch"/><rect x="30" y="28" width="20" height="20"/><rect x="50" y="28" width="20" height="20" class="hatch"/><rect x="70" y="28" width="20" height="20"/><rect x="30" y="48" width="20" height="20" class="hatch"/><rect x="50" y="48" width="20" height="20"/><rect x="70" y="48" width="20" height="20"/></svg>`,
  help: 'Clicking a square flips it and the squares directly above, below, left and right. Make the whole grid blank. Fewer moves is better. Every puzzle is solvable. The Daily puzzle is the same for everyone today.',
  mount(root, signal) {
    const N = 5;
    let mode = 'daily';
    const stage = el('div', { class: 'stage' });
    root.append(el('div', { class: 'center' }, tabs([['daily', 'Daily'], ['free', 'Random']], mode, m => { mode = m; start(); })), stage);
    function start() {
      const rng = mode === 'daily' ? dailyRng(31) : Math.random;
      const b = Array(N * N).fill(false);
      const flip = i => { const r = (i / N) | 0, c = i % N; for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < N && cc >= 0 && cc < N) b[rr * N + cc] = !b[rr * N + cc]; } };
      // Scramble by random presses so it is always solvable.
      for (let k = 0; k < 10 + Math.floor(rng() * 8); k++) flip(Math.floor(rng() * N * N));
      if (b.every(x => !x)) flip(12);
      let moves = 0, over = mode === 'daily' && !!Stats.dailyDone('lights');
      const msg = el('div', { class: 'msg' });
      const cells = b.map((_, i) => el('button', { class: 'bt-cell', onclick: () => press(i) }));
      stage.replaceChildren(el('div', { class: 'center' }, msg, el('div', { class: 'bt-grid', style: `grid-template-columns:repeat(${N},1fr)` }, cells),
        el('button', { class: 'btn btn-ghost', onclick: () => start() }, 'reset')));
      const draw = () => { cells.forEach((c, i) => c.classList.toggle('on', b[i])); msg.textContent = over && mode === 'daily' ? `Daily done: ${Stats.dailyDone('lights')}` : `Moves: ${moves}`; };
      function press(i) {
        if (over) return;
        flip(i); moves++; Sfx.tap(); draw();
        if (b.every(x => !x)) {
          over = true;
          Stats.record('lights', { win: true, score: moves, best: 'low' });
          if (mode === 'daily') Stats.markDaily('lights', `${moves} moves`);
          Sfx.win(); celebrate(); draw();
          msg.textContent = `Lights out in ${moves} moves!`;
        }
      }
      draw();
    }
    start();
  },
});
