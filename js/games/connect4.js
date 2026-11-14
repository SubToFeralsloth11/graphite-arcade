Games.register({
  id: 'connect4',
  title: 'Four in a Row',
  blurb: 'Drop pencil-shaded discs and line up four before the bot does.',
  group: 'table',
  tags: ['vs bot', '2P', 'online', 'strategy'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M14 8 V72 H106 V8"/><circle cx="30" cy="60" r="8" class="fill"/><circle cx="50" cy="60" r="8"/><circle cx="50" cy="40" r="8" class="fill"/><circle cx="70" cy="60" r="8" class="fill"/><circle cx="70" cy="40" r="8"/><circle cx="70" cy="20" r="8" class="fill"/><circle cx="90" cy="60" r="8"/></svg>`,
  help: 'Click a column to drop a disc; it falls to the lowest free spot. Four of yours in a line (across, down or diagonal) wins. Solid discs are player one, hatched discs are player two. Online: host a room and share the 4-letter code; the starter alternates each round.',
  mount(root, signal) {
    const R = 6, C = 7;
    let mode = 'bot', level = 'med', first = 0, link = null;
    const stage = el('div', { class: 'stage' });
    const lvlTabs = tabs([['easy', 'Casual'], ['med', 'Sharp'], ['hard', 'Grandmaster']], level, l => { level = l; start(); });
    root.append(el('div', { class: 'center' }, el('div', { class: 'row' },
      tabs([['bot', 'Vs Bot'], ['duel', 'Pass & Play'], ['online', 'Online']], mode, m => { mode = m; first = 0; if (link) { link.close(); link = null; } lvlTabs.style.display = m === 'bot' ? '' : 'none'; start(); }), lvlTabs)), stage);

    const WIN = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++)
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        const er = r + 3 * dr, ec = c + 3 * dc;
        if (er < R && ec >= 0 && ec < C) WIN.push([0, 1, 2, 3].map(k => (r + k * dr) * C + c + k * dc));
      }
    const winnerOf = b => WIN.find(w => b[w[0]] != null && w.every(i => b[i] === b[w[0]])) || null;
    const rowFor = (b, c) => { for (let r = R - 1; r >= 0; r--) if (b[r * C + c] == null) return r; return -1; };
    const ORDER = [3, 2, 4, 1, 5, 0, 6];
    function evalB(b, p) {
      let s = 0;
      for (const w of WIN) {
        let m = 0, o = 0;
        for (const i of w) { if (b[i] === p) m++; else if (b[i] === 1 - p) o++; }
        if (m && o) continue;
        s += m === 3 ? 6 : m === 2 ? 2 : 0;
        s -= o === 3 ? 5 : o === 2 ? 1 : 0;
      }
      for (let r = 0; r < R; r++) if (b[r * C + 3] === p) s += 3;
      return s;
    }
    // Negamax with alpha-beta; returns score for player p to move.
    function negamax(b, p, d, alpha, beta) {
      if (winnerOf(b)) return -1000 - d;
      if (d === 0) return evalB(b, p);
      let best = -Infinity, any = false;
      for (const c of ORDER) {
        const r = rowFor(b, c); if (r < 0) continue;
        any = true;
        b[r * C + c] = p; const v = -negamax(b, 1 - p, d - 1, -beta, -alpha); b[r * C + c] = null;
        if (v > best) best = v;
        if (v > alpha) alpha = v;
        if (alpha >= beta) break;
      }
      return any ? best : 0;
    }
    function botMove(b) {
      const open = ORDER.filter(c => rowFor(b, c) >= 0);
      if (level === 'easy' && Math.random() < 0.35) return pick(open);
      const depth = { easy: 2, med: 4, hard: 6 }[level];
      let best = -Infinity, moves = [];
      for (const c of open) {
        const r = rowFor(b, c);
        b[r * C + c] = 1; const v = -negamax(b, 0, depth - 1, -Infinity, Infinity); b[r * C + c] = null;
        if (v > best) { best = v; moves = [c]; } else if (v === best) moves.push(c);
      }
      return pick(moves);
    }

    function start() {
      if (mode === 'online' && !link?.open) {
        return Net.lobby(stage, 'connect4', signal, l => { link = l; first = 0; link.onClose = () => { link = null; start(); }; start(); });
      }
      const b = Array(R * C).fill(null);
      let turn = first, over = false, busy = false;
      const names = mode === 'bot' ? ['You', 'Bot'] : mode === 'online' ? (link.me === 0 ? ['You', 'Friend'] : ['Friend', 'You']) : ['Player 1', 'Player 2'];
      const P = names.map(n => el('div', { class: 'player sk' }, el('div', { class: 'who' }, n), el('div', { class: 'pts c4-key' })));
      P[0].lastChild.append(el('span', { class: 'c4-disc p0' })); P[1].lastChild.append(el('span', { class: 'c4-disc p1' }));
      const msg = el('div', { class: 'msg' });
      const cells = Array.from({ length: R * C }, (_, i) => el('div', { class: 'c4-cell', 'data-c': i % C }));
      const grid = el('div', { class: 'c4-grid sk', onclick: e => { const c = e.target.closest('.c4-cell')?.dataset.c; if (c != null) human(+c); } }, cells);
      stage.replaceChildren(el('div', { class: 'center' }, el('div', { class: 'scoreboard' }, P), msg, grid));
      const sync = () => {
        P.forEach((p, i) => p.classList.toggle('turn', i === turn && !over));
        if (!over) msg.textContent = mode === 'bot' ? (turn === 0 ? 'Your move' : 'Bot is thinking...') : mode === 'online' ? (turn === link.me ? 'Your move' : 'Friend is thinking...') : `${names[turn]} to move`;
      };
      function drop(c) {
        const r = rowFor(b, c); if (r < 0) return;
        const i = r * C + c;
        b[i] = turn; cells[i].replaceChildren(el('span', { class: `c4-disc p${turn} fall`, style: `--from:${-(r + 1) * 100}%` })); Sfx.tap();
        const w = winnerOf(b);
        if (w) { over = true; w.forEach(j => cells[j].classList.add('win')); return end(turn); }
        if (b.every(x => x != null)) { over = true; return end(null); }
        turn = 1 - turn; sync();
        if (mode === 'bot' && turn === 1) bot();
      }
      function human(c) {
        if (over || busy || (mode === 'bot' && turn === 1) || (mode === 'online' && turn !== link.me) || rowFor(b, c) < 0) return;
        if (mode === 'online') link.send('move', c);
        drop(c);
      }
      if (mode === 'online') link.on('move', c => { if (!over && turn !== link.me) drop(c); });
      async function bot() {
        busy = true; sync();
        await sleep(450);
        if (signal.aborted) return;
        busy = false;
        drop(botMove(b));
      }
      function end(w) {
        sync();
        first = 1 - first;
        const me = mode === 'online' ? link.me : 0;
        const title = w == null ? 'Board full, a draw' : mode === 'bot' ? (w === 0 ? 'You win!' : 'Bot wins') : mode === 'online' ? (w === me ? 'You win!' : 'Friend wins') : `${names[w]} wins!`;
        Stats.record('connect4', { win: mode !== 'duel' && w != null ? w === me : undefined });
        (w === me || (mode === 'duel' && w != null)) ? (Sfx.win(), celebrate()) : w != null ? Sfx.lose() : Sfx.tap();
        msg.textContent = title;
        const body = () => el('p', {}, w == null ? 'Nobody connected four.' : 'Four in a row.');
        if (mode === 'online') {
          setTimeout(() => !signal.aborted && link?.open && modal(title, body(), [{ label: 'Play again', primary: true }])
            .then(() => { if (link?.open) { msg.textContent = 'Waiting for your friend...'; link.ready(start); } }), 700);
          return;
        }
        setTimeout(() => !signal.aborted && modal(title, body(), [{ label: 'Play again', primary: true }]).then(v => v && start()), 700);
      }
      sync();
      if (mode === 'bot' && turn === 1) bot();
    }
    start();
  },
});
