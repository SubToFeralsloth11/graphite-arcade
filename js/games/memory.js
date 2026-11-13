Games.register({
  id: 'memory',
  title: 'Doodle Memory',
  blurb: 'Flip the sketch cards and find every matching pair.',
  group: 'table',
  tags: ['solo', '2P', 'chill'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><rect x="14" y="10" width="36" height="52" transform="rotate(-8 32 36)" class="fill"/><rect x="62" y="12" width="36" height="52" transform="rotate(7 80 38)"/><path d="M72 38 l8 -12 l8 12 z"/><path d="M80 44 v10"/><path d="M104 70 c4 -6 10 -6 12 0"/></svg>`,
  help: 'Flip two cards per turn. Find a match and they stay face up. Solo: finish in as few flips as you can. Pass & Play: a match earns a point and another turn; the most pairs wins.',
  mount(root, signal) {
    let mode = 'solo', level = 8;
    const stage = el('div', { class: 'stage' });
    root.append(el('div', { class: 'center' }, el('div', { class: 'row' },
      tabs([['solo', 'Solo'], ['duel', 'Pass & Play']], mode, m => { mode = m; start(); }),
      tabs([[6, 'Small'], [8, 'Classic'], [10, 'Big']], level, l => { level = l; start(); })), stage));

    const D = {
      sun: '<circle cx="50" cy="50" r="16"/><path d="M50 18 v-10 M50 82 v10 M18 50 h-10 M82 50 h10 M27 27 l-7 -7 M73 73 l7 7 M73 27 l7 -7 M27 73 l-7 7"/>',
      house: '<path d="M22 84 V48 L50 22 L78 48 V84 Z M42 84 V62 h16 v22"/><path d="M64 32 V20 h8 v20"/>',
      fish: '<path d="M14 50 C30 26 62 26 76 50 C62 74 30 74 14 50 Z M76 50 l14 -14 v28 z"/><circle cx="30" cy="46" r="3"/>',
      star: '<path d="M50 12 L60 40 L90 40 L66 58 L75 88 L50 70 L25 88 L34 58 L10 40 L40 40 Z"/>',
      heart: '<path d="M50 84 C20 62 10 44 22 30 C32 20 46 24 50 36 C54 24 68 20 78 30 C90 44 80 62 50 84 Z"/>',
      tree: '<path d="M50 12 L24 52 h14 L20 74 h60 L62 52 h14 Z M50 74 v16"/>',
      cloud: '<path d="M24 68 C10 68 10 48 26 48 C26 30 50 26 56 40 C62 30 82 34 78 50 C92 52 90 68 76 68 Z"/><path d="M34 78 l-4 8 M50 78 l-4 8 M66 78 l-4 8"/>',
      moon: '<path d="M62 14 C36 18 26 50 40 72 C52 88 74 88 84 74 C60 76 44 50 62 14 Z"/><path d="M20 30 l4 4 m0 -4 l-4 4"/>',
      umbrella: '<path d="M12 50 C14 20 86 20 88 50 C80 44 72 44 66 50 C60 44 40 44 34 50 C28 44 20 44 12 50 Z M50 50 v32 c0 8 -12 8 -12 0"/>',
      cup: '<path d="M22 36 h48 l-6 46 H28 Z M70 46 c14 0 14 20 -2 20"/><path d="M36 26 c0 -8 6 -8 6 -16 M50 26 c0 -8 6 -8 6 -16"/>',
      flower: '<circle cx="50" cy="38" r="8"/><path d="M50 30 c-6 -18 12 -18 0 0 M58 38 c18 -6 18 12 0 0 M50 46 c6 18 -12 18 0 0 M42 38 c-18 6 -18 -12 0 0 M50 46 v42 M50 70 c-10 -8 -18 -4 -18 -4 c8 8 18 4 18 4"/>',
      cat: '<path d="M26 40 L28 16 L42 30 h16 L72 16 L74 40 C78 70 22 70 26 40 Z"/><circle cx="40" cy="42" r="2.5"/><circle cx="60" cy="42" r="2.5"/><path d="M46 52 h8 l-4 4 z M30 52 h-16 M30 56 l-14 4 M70 52 h16 M70 56 l14 4"/>',
      bolt: '<path d="M56 10 L26 54 h22 L40 90 L76 42 H52 Z"/>',
      key: '<circle cx="30" cy="50" r="14"/><path d="M44 50 h44 M76 50 v12 M86 50 v10"/>',
      boat: '<path d="M14 62 h72 l-12 18 H26 Z M50 62 V14 L76 52 H50"/><path d="M8 88 c10 -6 20 6 30 0 s20 6 30 0 s20 6 30 0"/>',
      apple: '<path d="M50 32 C30 20 14 40 22 62 C30 86 46 84 50 78 C54 84 70 86 78 62 C86 40 70 20 50 32 Z M50 32 C50 22 54 16 60 12"/><path d="M52 22 c8 -8 16 -4 18 -2 c-8 6 -14 4 -18 2"/>',
    };

    function start() {
      const kinds = shuffle(Object.keys(D)).slice(0, level);
      const deck = shuffle([...kinds, ...kinds]);
      const names = mode === 'solo' ? null : ['Player 1', 'Player 2'];
      const score = [0, 0];
      let open = [], flips = 0, matched = 0, turn = 0, lock = false;
      const t0 = Date.now();
      const cols = level === 6 ? 4 : level === 8 ? 4 : 5;
      const grid = el('div', { class: 'mem-grid', style: `grid-template-columns:repeat(${cols},1fr);max-width:${cols * 130}px` });
      const P = names && names.map(n => el('div', { class: 'player sk' }, el('div', { class: 'who' }, n), el('div', { class: 'pts' }, '0')));
      const info = el('div', { class: 'msg' });
      const cards = deck.map((kind, i) => {
        const c = el('div', { class: 'mcard', onclick: () => flip(i) },
          el('div', { class: 'face back sk' }),
          el('div', { class: 'face front sk', html: `<svg viewBox="0 0 100 100" class="doodle">${D[kind]}</svg>` }));
        return c;
      });
      grid.append(...cards);
      stage.replaceChildren(el('div', { class: 'center' }, P ? el('div', { class: 'scoreboard' }, P) : null, info, grid));
      const sync = () => {
        if (P) P.forEach((p, i) => { p.classList.toggle('turn', i === turn); p.lastChild.textContent = score[i]; });
        info.textContent = names ? `${names[turn]}'s turn` : `${flips} flips · ${matched}/${level} pairs`;
      };
      async function flip(i) {
        if (lock || open.includes(i) || cards[i].classList.contains('matched')) return;
        cards[i].classList.add('up'); Sfx.tap();
        open.push(i);
        if (open.length < 2) return;
        flips++; lock = true;
        const [a, b] = open;
        if (deck[a] === deck[b]) {
          await sleep(350);
          cards[a].classList.add('matched'); cards[b].classList.add('matched');
          matched++; score[turn]++; Sfx.good();
        } else {
          await sleep(850);
          if (signal.aborted) return;
          cards[a].classList.remove('up'); cards[b].classList.remove('up'); Sfx.scratch();
          if (names) turn = 1 - turn;
        }
        open = []; lock = false; sync();
        if (matched === level) finish();
      }
      function finish() {
        const secs = Math.round((Date.now() - t0) / 1000);
        Sfx.win(); celebrate();
        if (!names) {
          const s = Stats.record('memory', { win: true, score: flips, best: 'low' });
          const perfect = flips === level;
          modal(s.newBest ? 'New record!' : perfect ? 'Photographic!' : 'All matched', el('div', {}, el('p', {}, `${flips} flips in ${secs}s (perfect would be ${level}).`), statRow(s, { best: 'fewest flips' })),
            [{ label: 'Shuffle again', primary: true }]).then(v => v && start());
        } else {
          Stats.record('memory', {});
          const tie = score[0] === score[1];
          modal(tie ? "It's a draw" : `${names[score[1] > score[0] ? 1 : 0]} wins`, `${score[0]} pairs to ${score[1]}.`, [{ label: 'Rematch', primary: true }]).then(v => v && start());
        }
      }
      sync();
    }
    start();
  },
});
