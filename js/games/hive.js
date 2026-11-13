Games.register({
  id: 'hive',
  title: 'Letter Hive',
  blurb: 'Seven letters, one in the middle. How many words can you spin?',
  group: 'word',
  tags: ['daily', 'chill'],
  daily: true,
  icon: `<svg viewBox="0 0 120 80" class="doodle"><polygon points="60,22 74,30 74,46 60,54 46,46 46,30" class="fill"/><polygon points="60,2 72,9 72,22 60,22 48,22 48,9" opacity=".8"/><polygon points="88,30 100,37 100,52 88,58 76,52 76,37"/><polygon points="32,30 44,37 44,52 32,58 20,52 20,37"/><path d="M96 14 c4 -4 10 -2 10 3 c0 4 -6 4 -6 0" /></svg>`,
  help: 'Make words of 4+ letters using the hive. Every word must use the centre letter; letters can repeat. 4-letter words score 1, longer words score 1 per letter. A pangram uses all seven letters and earns +7. Climb the ranks!',
  mount(root, signal) {
    let mode = 'daily', keyHandler = null;
    const stage = el('div', { class: 'stage' });
    root.append(el('div', { class: 'center' }, tabs([['daily', 'Daily hive'], ['random', 'Random hive']], mode, m => { mode = m; start(); })), stage);
    onKeys(signal, k => keyHandler && keyHandler(k));

    const RANKS = [['Doodler', 0], ['Sketcher', .05], ['Shader', .12], ['Inker', .22], ['Illustrator', .35], ['Artist', .5], ['Master', .7]];
    const wordScore = (w, letters) => (w.length === 4 ? 1 : w.length) + (new Set(w).size === 7 ? 7 : 0);

    function makeHive(rng) {
      const seeds = Dict.sorted.filter(w => w.length >= 7 && new Set(w).size === 7 && !/s/.test(w));
      for (let i = 0; i < 300; i++) {
        const letters = [...new Set(pick(seeds, rng))];
        const center = pick(letters, rng);
        const set = new Set(letters);
        const answers = Dict.sorted.filter(w => w.length >= 4 && w.includes(center) && [...w].every(c => set.has(c)));
        if (answers.length >= 25 && answers.length <= 110) return { center, outer: shuffle(letters.filter(c => c !== center), rng), answers };
      }
    }

    function start() {
      stage.replaceChildren(el('p', { class: 'muted', style: 'text-align:center' }, 'Building the hive...'));
      setTimeout(() => play(makeHive(mode === 'daily' ? dailyRng(3) : Math.random)), 20);
    }

    function play({ center, outer, answers }) {
      const saveKey = mode === 'daily' ? `hive:${todayKey()}` : null;
      const found = saveKey ? Store.get(saveKey, []) : [];
      const answerSet = new Set(answers);
      const max = answers.reduce((s, w) => s + wordScore(w), 0);
      let cur = '';
      const letters = [center, ...outer];
      const entry = el('div', { class: 'hive-entry' });
      const hive = el('div', { class: 'hive' });
      const right = el('div', { class: 'panel sk' });
      const placeHex = () => {
        const pos = [[102, 108], [102, 16], [182, 62], [182, 154], [102, 200], [22, 154], [22, 62]];
        hive.replaceChildren(...letters.map((c, i) => {
          const h = el('div', { class: 'hex' + (i === 0 ? ' center' : ''), style: `left:${pos[i][0]}px;top:${pos[i][1] - 8}px`, onclick: () => type(c),
            html: `<svg viewBox="0 0 96 84"><defs><pattern id="hexhatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="rgba(255,255,255,.5)"/><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(45,45,49,.35)" stroke-width="2"/></pattern></defs><polygon points="24,2 72,2 94,42 72,82 24,82 2,42"/><text x="48" y="44">${c}</text></svg>` });
          return h;
        }));
      };
      const type = c => { if (cur.length < 15) { cur += c; Sfx.tap(); drawEntry(); } };
      const drawEntry = () => entry.replaceChildren(...[...cur].map(c => el('span', { class: c === center ? 'c' : letters.includes(c) ? '' : 'muted' }, c)));
      const drawRight = () => {
        const score = found.reduce((s, w) => s + wordScore(w), 0);
        const ri = RANKS.reduce((r, [_, t], i) => score >= Math.ceil(t * max) ? i : r, 0);
        const nextAt = RANKS[ri + 1] ? Math.ceil(RANKS[ri + 1][1] * max) : null;
        right.replaceChildren(
          el('div', { class: 'row', style: 'justify-content:space-between' }, el('span', { class: 'big' }, RANKS[ri][0]), el('span', { class: 'big' }, score)),
          el('div', { class: 'rank-bar' }, RANKS.flatMap((r, i) => [i ? el('div', { class: 'seg' }) : null, el('div', { class: 'dot' + (i <= ri ? ' on' : ''), title: r[0] })])),
          el('div', { class: 'muted', style: 'font-size:16px;margin-bottom:8px' }, nextAt ? `${nextAt - score} points to ${RANKS[ri + 1][0]}` : 'Top rank reached!', ` · ${found.length} of ${answers.length} words`),
          el('ul', { class: 'found' }, [...found].sort().map(w => el('li', { class: new Set(w).size === 7 ? 'pangram' : '' }, w))));
        return ri;
      };
      const submit = () => {
        const w = cur; cur = ''; drawEntry();
        const bad = m => { toast(m); Sfx.bad(); entry.classList.remove('shake'); void entry.offsetWidth; entry.classList.add('shake'); };
        if (w.length < 4) return bad('Too short');
        if (!w.includes(center)) return bad(`Missing centre letter ${center.toUpperCase()}`);
        if ([...w].some(c => !letters.includes(c))) return bad('Bad letters');
        if (found.includes(w)) return bad('Already found');
        if (!answerSet.has(w)) return bad('Not in word list');
        const prevRank = drawRight();
        found.push(w); if (saveKey) Store.set(saveKey, found);
        const pts = wordScore(w);
        const pang = new Set(w).size === 7;
        toast(pang ? `Pangram! +${pts}` : pts >= 6 ? `Awesome! +${pts}` : pts > 1 ? `Nice +${pts}` : 'Good +1');
        pang ? (Sfx.win(), celebrate()) : Sfx.good();
        const ri = drawRight();
        if (ri > prevRank) {
          toast(`New rank: ${RANKS[ri][0]}`, 2200);
          if (ri >= 5 && !(saveKey && Stats.dailyDone('hive'))) { Stats.record('hive', { win: true, score: found.reduce((s, x) => s + wordScore(x), 0) }); }
          if (saveKey && ri >= 4) Stats.markDaily('hive', RANKS[ri][0]);
        }
      };
      const reshuffle = () => { letters.splice(1, 6, ...shuffle(letters.slice(1))); Sfx.scratch(); placeHex(); };
      keyHandler = k => {
        if (k === 'enter') submit();
        else if (k === 'back') { cur = cur.slice(0, -1); drawEntry(); }
        else if (k === ' ') reshuffle();
        else if (/^[a-z]$/.test(k)) type(k);
      };
      stage.replaceChildren(el('div', { class: 'hive-wrap' },
        el('div', { class: 'center' }, entry, hive,
          el('div', { class: 'row' },
            el('button', { class: 'btn', onclick: () => { cur = cur.slice(0, -1); drawEntry(); } }, 'delete'),
            el('button', { class: 'btn btn-ghost', onclick: reshuffle }, 'shuffle'),
            el('button', { class: 'btn btn-primary', onclick: submit }, 'enter')),
          el('button', { class: 'btn btn-ghost', onclick: () => modal('Give up?', 'Reveal every word in this hive.', [{ label: 'Cancel' }, { label: 'Reveal', primary: true, value: 'y' }]).then(v => {
            if (v !== 'y') return;
            modal('All words', el('div', { style: 'max-height:50vh;overflow:auto' }, el('ul', { class: 'found' }, answers.map(w => el('li', { class: new Set(w).size === 7 ? 'pangram' : '', style: found.includes(w) ? '' : 'color:var(--soft)' }, w)))));
          }) }, 'reveal answers')),
        right));
      placeHex(); drawEntry(); drawRight();
    }
    start();
  },
});
