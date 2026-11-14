Games.register({
  id: 'ghost',
  title: 'Ghost',
  blurb: 'Take turns adding letters. Finish a word, or paint yourself into a corner, and you get spooked.',
  group: 'word',
  tags: ['vs bot', '2P', 'strategy', 'online'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M38 74 V34 c0 -36 48 -36 48 0 V74 l-8 -7 l-8 7 l-8 -7 l-8 7 l-8 -7 z"/><circle cx="54" cy="34" r="3" class="fill"/><circle cx="70" cy="34" r="3" class="fill"/><path d="M56 48 c4 4 8 4 12 0"/><path d="M96 20 h14 M100 30 h10" opacity=".6"/></svg>`,
  help: 'Players take turns adding one letter to the end of a growing fragment. You lose the round if you complete a real word of 4+ letters, or if your letter makes a fragment that no word starts with. Each lost round earns a letter of G-H-O-S-T. Spell GHOST and you are out. Online: same rules with a friend on another device; take turns typing letters. (The bot knows about 100,000 words up to 9 letters.)',
  mount(root, signal) {
    let mode = 'bot', keyHandler = null, link = null, first = 0;
    const stage = el('div', { class: 'stage' });
    root.append(el('div', { class: 'center' }, tabs([['bot', 'Vs Bot'], ['duel', 'Pass & Play'], ['online', 'Online']], mode, m => { mode = m; if (link) { link.close(); link = null; } start(); })), stage);
    onKeys(signal, k => keyHandler && keyHandler(k));
    const GHOST = 'ghost';
    const isLoss = f => (f.length >= 4 && Dict.has(f)) || !Dict.hasPrefix(f);

    /** Bot picks a letter: safe moves first, preferring ones where most continuations end on the human's turn. */
    function botMove(frag, level) {
      const opts = [];
      for (let c = 97; c < 123; c++) {
        const f = frag + String.fromCharCode(c);
        if (isLoss(f)) continue;
        const [a, b] = Dict.range(f);
        let good = 0, total = 0;
        for (let i = a; i < b; i++) {
          const w = Dict.sorted[i]; if (w.length < 4) continue;
          // shortest-word-wins: skip words that contain a shorter 4+ word prefix past the fragment
          let blocked = false;
          for (let L = Math.max(4, f.length + 1); L < w.length; L++) if (Dict.has(w.slice(0, L))) { blocked = true; break; }
          if (blocked) continue;
          total++;
          if ((w.length - f.length) % 2 === 1) good++; // human places the final letter
        }
        if (total) opts.push({ c: String.fromCharCode(c), score: good / total + Math.random() * (level === 'easy' ? 1 : .08), total });
      }
      if (!opts.length) { // forced: any letter that keeps a prefix alive, else give up gracefully
        for (let c = 97; c < 123; c++) { const ch = String.fromCharCode(c); if (Dict.hasPrefix(frag + ch)) return ch; }
        return 'q';
      }
      if (!frag) return pick(opts).c; // keep openings varied
      opts.sort((x, y) => y.score - x.score);
      return opts[0].c;
    }

    function start() {
      keyHandler = null;
      if (mode === 'online' && !link?.open) {
        return Net.lobby(stage, 'ghost', signal, l => { link = l; first = 0; link.onClose = () => { link = null; start(); }; start(); });
      }
      if (mode === 'bot') {
        stage.replaceChildren(el('div', { class: 'panel sk center', style: 'max-width:440px;margin:0 auto' },
          el('div', { class: 'big' }, 'Choose a ghost'),
          el('button', { class: 'btn', style: 'width:100%', onclick: () => play(['You', 'Casper (easy)'], 'easy') }, 'Casper: friendly, a bit random'),
          el('button', { class: 'btn', style: 'width:100%', onclick: () => play(['You', 'Banshee (hard)'], 'hard') }, 'Banshee: counts every letter')));
      } else if (mode === 'online') play(link.me === 0 ? ['You', 'Friend'] : ['Friend', 'You'], null);
      else play(['Player 1', 'Player 2'], null);
    }

    function play(names, level) {
      const online = mode === 'online';
      const ghosts = [0, 0];
      let frag = '', starter = online ? first : 0, turn = starter, busy = false;
      const P = names.map(n => el('div', { class: 'player sk' }, el('div', { class: 'who' }, n), el('div', { class: 'ghost-letters' })));
      const fragEl = el('div', { class: 'ghost-frag' });
      const msg = el('div', { class: 'msg' });
      const kb = keyboard(k => keyHandler(k), { enter: false });
      const giveUp = el('button', { class: 'btn btn-ghost', onclick: () => { if (!busy && isHumanTurn()) { if (online) link.send('giveup'); lose(turn, `${names[turn]} gave up on ${frag.toUpperCase() || 'nothing'}.`); } } }, "I'm stuck (lose round)");
      stage.replaceChildren(el('div', { class: 'center' }, el('div', { class: 'scoreboard' }, P), fragEl, msg, kb.el, giveUp));
      const isHumanTurn = () => online ? turn === link.me : !level || turn === 0;
      const draw = (fresh) => {
        P.forEach((p, i) => {
          p.classList.toggle('turn', i === turn);
          p.lastChild.replaceChildren(...[...GHOST].map((c, j) => el('span', { class: j < ghosts[i] ? 'lost' : 'safe' }, c)));
        });
        fragEl.replaceChildren(...[...frag].map((c, i) => el('span', { class: fresh && i === frag.length - 1 ? 'new' : '' }, c)), frag ? '' : el('span', { class: 'muted' }, '_'));
        if (!busy) msg.textContent = isHumanTurn() ? `${names[turn]}: add a letter` : `${names[turn]} is thinking...`;
      };
      const add = async c => {
        frag += c; Sfx.tap(); draw(true);
        if (frag.length >= 4 && Dict.has(frag)) return lose(turn, `${names[turn]} spelled ${frag.toUpperCase()}.`);
        if (!Dict.hasPrefix(frag)) return lose(turn, `No word starts with ${frag.toUpperCase()}.`);
        turn = 1 - turn; draw();
        if (level && !isHumanTurn()) { busy = true; draw(); await sleep(700 + Math.random() * 700); if (signal.aborted) return; busy = false; add(botMove(frag, level)); }
      };
      const lose = async (p, why) => {
        busy = true;
        ghosts[p]++;
        Sfx.scratch();
        draw();
        msg.textContent = `${why} ${names[p]} gets a ${GHOST[ghosts[p] - 1].toUpperCase()}.`;
        if (ghosts[p] >= 5) {
          const humanWon = online ? p !== link.me : level ? p === 1 : null;
          Stats.record('ghost', { win: online || level ? humanWon : undefined });
          humanWon !== false ? (Sfx.win(), celebrate()) : Sfx.lose();
          await sleep(800);
          if (online) {
            first = 1 - first;
            const title = humanWon ? 'You win!' : 'Friend wins';
            return !signal.aborted && link?.open && modal(title, `${names[p]} ${p === link.me ? 'are' : 'is'} now a GHOST.`, [{ label: 'Play again', primary: true }])
              .then(() => { if (link?.open) { msg.textContent = 'Waiting for your friend...'; link.ready(start); } });
          }
          return modal(`${names[1 - p]} wins`, `${names[p]} is now a GHOST.`, [{ label: 'Play again', primary: true }]).then(v => v && start());
        }
        await sleep(2200);
        if (signal.aborted) return;
        const reset = () => {
          frag = ''; starter = 1 - starter; turn = starter; busy = false;
          $$('.key', kb.el).forEach(k => k.classList.remove('absent', 'present', 'correct'));
          draw();
        };
        if (online) { if (link?.open) link.ready(reset); return; } // both sides reset together so no letter lands mid-pause
        reset();
        if (level && !isHumanTurn()) { busy = true; await sleep(800); busy = false; add(botMove('', level)); }
      };
      keyHandler = k => { if (!busy && isHumanTurn() && /^[a-z]$/.test(k)) { if (online) link.send('letter', k); add(k); } };
      if (online) {
        link.on('letter', c => { if (!busy && !isHumanTurn() && /^[a-z]$/.test(c)) add(c); });
        link.on('giveup', () => { if (!busy && !isHumanTurn()) lose(turn, `${names[turn]} gave up on ${frag.toUpperCase() || 'nothing'}.`); });
      }
      draw();
    }
    start();
  },
});
