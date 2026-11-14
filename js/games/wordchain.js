Games.register({
  id: 'wordchain',
  title: 'Word Chain',
  blurb: 'Each word starts with the last letter of the one before. Keep the chain alive.',
  group: 'word',
  tags: ['vs bot', '2P', 'timed', 'online'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><ellipse cx="30" cy="40" rx="20" ry="12"/><ellipse cx="60" cy="40" rx="20" ry="12"/><ellipse cx="90" cy="40" rx="20" ry="12"/><path d="M20 66 h80" opacity=".6"/></svg>`,
  help: 'Type a real word (3+ letters) that starts with the last letter of the previous word. No repeats. You have 15 seconds per turn; running out costs a heart and the next player gets a fresh letter. Lose all 3 hearts and you are out. Online: play the chain against a friend on another device; each of you types on your own turn.',
  mount(root, signal) {
    let mode = 'bot', level = 'med', timer = null, link = null, games = 0;
    signal.addEventListener('abort', () => clearInterval(timer));
    const stage = el('div', { class: 'stage' });
    const lvlTabs = tabs([['easy', 'Chatty bot'], ['med', 'Bookworm'], ['hard', 'Walking dictionary']], level, l => { level = l; start(); });
    root.append(el('div', { class: 'center' }, el('div', { class: 'row' },
      tabs([['bot', 'Vs Bot'], ['duel', 'Pass & Play'], ['online', 'Online']], mode, m => { mode = m; if (link) { link.close(); link = null; } lvlTabs.style.display = m === 'bot' ? '' : 'none'; start(); }), lvlTabs)), stage);

    const byFirst = {};
    for (const w of [...LISTS.four, ...LISTS.five, ...LISTS.long]) (byFirst[w[0]] ||= []).push(w);
    const LETTERS = 'abcdefghilmnoprstw';
    const TURN = 15;

    function start() {
      clearInterval(timer);
      if (mode === 'online' && !link?.open) {
        return Net.lobby(stage, 'wordchain', signal, l => { link = l; games = 0; link.onClose = () => { link = null; start(); }; start(); });
      }
      const online = mode === 'online';
      // Online: both sides draw letters from the same seeded stream, in the same order.
      const rng = online ? seeded(link.seed + games++) : Math.random;
      const names = mode === 'bot' ? ['You', 'Bot'] : online ? (link.me === 0 ? ['You', 'Friend'] : ['Friend', 'You']) : ['Player 1', 'Player 2'];
      const me = online ? link.me : 0;
      const lives = [3, 3], used = new Set(), chain = [];
      let turn = online ? (games - 1) % 2 : 0, letter = pick([...LETTERS], rng), over = false, t0 = 0, mine = 0;
      const myTurn = () => online ? turn === link.me : !(mode === 'bot' && turn === 1);
      const P = names.map(n => el('div', { class: 'player sk' }, el('div', { class: 'who' }, n), el('div', { class: 'pts' })));
      const need = el('div', { class: 'big' });
      const bar = el('div', { class: 'timer', style: 'width:min(420px,100%)' }, el('div', { style: 'width:100%' }));
      const input = el('input', { class: 'input', autocomplete: 'off', spellcheck: 'false', placeholder: 'type a word', style: 'max-width:340px;text-align:center' });
      const trail = el('div', { class: 'wc-trail' });
      input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(input.value.trim().toLowerCase()); });
      stage.replaceChildren(el('div', { class: 'center' }, el('div', { class: 'scoreboard' }, P), need, bar, input,
        el('button', { class: 'btn btn-primary', onclick: () => submit(input.value.trim().toLowerCase()) }, 'play word'), trail));

      const sync = () => {
        P.forEach((p, i) => { p.classList.toggle('turn', i === turn && !over); p.lastChild.textContent = '♥'.repeat(lives[i]) + '♡'.repeat(3 - lives[i]); });
        need.textContent = `${names[turn]}: starts with “${letter.toUpperCase()}”`;
        const waiting = !myTurn();
        input.disabled = waiting || over;
        if (!waiting && !over) { input.value = ''; input.focus(); }
      };
      const addLink = (w, who) => {
        chain.push(w);
        trail.prepend(el('span', { class: 'wc-link sk' + (who ? ' p1' : '') }, w));
      };
      function beginTurn() {
        clearInterval(timer);
        if (over) return;
        sync();
        t0 = Date.now();
        timer = setInterval(() => {
          const left = Math.max(0, TURN - (Date.now() - t0) / 1000);
          bar.firstChild.style.width = (100 * left / TURN) + '%';
          if (left <= 0 && (!online || turn === link.me)) { if (online) link.send('timeout'); timeout(); } // online: only the active player's clock decides
        }, 150);
        if (mode === 'bot' && turn === 1) botMove();
      }
      function next(w) {
        letter = w[w.length - 1];
        if (!byFirst[letter]) letter = pick([...LETTERS], rng); // dead-end letters (x, z...) get swapped
        turn = 1 - turn; beginTurn();
      }
      function submit(w) {
        if (over || !myTurn()) return;
        if (!/^[a-z]+$/.test(w) || w.length < 3) return toast('3+ letters');
        if (w[0] !== letter) return toast(`Must start with ${letter.toUpperCase()}`);
        if (used.has(w)) return toast('Already used');
        if (!Dict.has(w)) { Sfx.bad(); return toast('Not in my dictionary'); }
        if (online) link.send('word', w);
        used.add(w); addLink(w, turn); Sfx.good();
        if (turn === me) mine++;
        next(w);
      }
      function timeout() {
        clearInterval(timer);
        lives[turn]--; Sfx.bad();
        toast(`${names[turn]} ran out of time`);
        if (!lives[turn]) return end();
        letter = pick([...LETTERS], rng);
        turn = 1 - turn; beginTurn();
      }
      async function botMove() {
        const think = 1200 + rand(2600);
        await sleep(think);
        if (signal.aborted || over || turn !== 1) return;
        const miss = { easy: 0.2, med: 0.08, hard: 0.02 }[level] + chain.length * 0.004;
        const options = (byFirst[letter] || []).filter(w => !used.has(w));
        if (!options.length || Math.random() < miss) return; // stalls until the clock runs out
        const w = pick(options);
        used.add(w); addLink(w, 1); Sfx.scratch();
        next(w);
      }
      function end() {
        over = true; clearInterval(timer); sync();
        const loser = lives[0] ? 1 : 0, win = loser !== me;
        const title = mode === 'bot' ? (win ? 'You win!' : 'The bot wins') : online ? (win ? 'You win!' : 'Friend wins') : `${names[1 - loser]} wins!`;
        need.textContent = title;
        const s = Stats.record('wordchain', mode === 'bot' ? { win, score: mine } : online ? { win } : {});
        (mode === 'duel' || win) ? (Sfx.win(), celebrate()) : Sfx.lose();
        const body = el('div', {}, el('p', {}, `Chain length: ${chain.length} words.`), mode === 'bot' ? statRow(s, { best: 'most words' }) : null);
        if (online) {
          if (link?.open) modal(title, body, [{ label: 'Play again', primary: true }]).then(() => { if (link?.open) { need.textContent = 'Waiting for your friend...'; link.ready(start); } });
          return;
        }
        modal(title, body, [{ label: 'Play again', primary: true }]).then(v => v && start());
      }
      if (online) {
        link.on('word', w => {
          if (over || myTurn() || typeof w !== 'string' || w[0] !== letter || used.has(w)) return;
          used.add(w); addLink(w, turn); Sfx.scratch();
          next(w);
        });
        link.on('timeout', () => { if (!over && !myTurn()) timeout(); });
      }
      beginTurn();
    }
    start();
  },
});
