Games.register({
  id: 'fifteen',
  title: 'Slide 15',
  blurb: 'The classic sliding tile puzzle, drawn on scrap card. Put 1 to 15 back in order.',
  group: 'button',
  tags: ['solo', 'puzzle'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><rect x="30" y="6" width="68" height="68"/><path d="M47 6 v68 M64 6 v51 M81 6 v68 M30 23 h68 M30 40 h68 M30 57 h51"/><text x="34" y="20" font-size="12">1</text><text x="51" y="20" font-size="12">2</text></svg>`,
  help: 'Click a tile next to the gap (or use the arrow keys) to slide it. Arrange the tiles 1-15 in order with the gap at the bottom right. Fewer moves is better.',
  mount(root, signal) {
    const N = 4;
    const stage = el('div', { class: 'stage' });
    root.append(stage);
    let onKey = null;
    onKeys(signal, (k, e) => { if (onKey && k.startsWith('Arrow')) { e.preventDefault(); onKey(k); } });
    function start() {
      const b = [...Array(N * N - 1).keys()].map(i => i + 1).concat(0);
      let gap = N * N - 1, moves = 0, over = false;
      const nb = g => [g - N, g + N, g % N ? g - 1 : -1, g % N < N - 1 ? g + 1 : -1].filter(i => i >= 0 && i < N * N);
      for (let k = 0; k < 300; k++) { const t = pick(nb(gap)); [b[gap], b[t]] = [b[t], b[gap]]; gap = t; }
      const msg = el('div', { class: 'msg' });
      const grid = el('div', { class: 'bt-grid', style: `grid-template-columns:repeat(${N},1fr)` });
      stage.replaceChildren(el('div', { class: 'center' }, msg, grid, el('button', { class: 'btn btn-ghost', onclick: start }, 'shuffle')));
      const draw = () => {
        grid.replaceChildren(...b.map((v, i) => el('button', { class: 'bt-cell bt-tile' + (v ? '' : ' gap') + (v === i + 1 ? ' home' : ''), onclick: () => slide(i) }, v || '')));
        if (!over) msg.textContent = `Moves: ${moves}`;
      };
      function slide(i) {
        if (over || !nb(gap).includes(i)) return;
        [b[gap], b[i]] = [b[i], b[gap]]; gap = i; moves++; Sfx.tap(); draw();
        if (b.every((v, j) => v === (j + 1) % (N * N))) {
          over = true;
          const s = Stats.record('fifteen', { win: true, score: moves, best: 'low' });
          Sfx.win(); celebrate();
          msg.textContent = `Solved in ${moves} moves!${s.newBest ? ' New best!' : ''}`;
        }
      }
      // Arrow moves the tile on that side of the gap into it (tile moves in arrow direction).
      onKey = k => { const r = (gap / N) | 0, c = gap % N; const t = { ArrowUp: r < N - 1 ? gap + N : -1, ArrowDown: r ? gap - N : -1, ArrowLeft: c < N - 1 ? gap + 1 : -1, ArrowRight: c ? gap - 1 : -1 }[k]; if (t >= 0) slide(t); };
      draw();
    }
    start();
  },
});
