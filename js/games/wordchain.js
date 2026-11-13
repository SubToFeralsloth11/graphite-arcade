Games.register({
  id: 'wordchain',
  title: 'Word Chain',
  blurb: 'Each word starts with the last letter of the one before. Keep the chain alive.',
  group: 'word',
  tags: ['vs bot', '2P', 'timed'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><ellipse cx="30" cy="40" rx="20" ry="12"/><ellipse cx="60" cy="40" rx="20" ry="12"/><ellipse cx="90" cy="40" rx="20" ry="12"/><path d="M20 66 h80" opacity=".6"/></svg>`,
  help: 'Type a real word (3+ letters) that starts with the last letter of the previous word. No repeats. You have 15 seconds per turn; running out costs a heart and the next player gets a fresh letter. Lose all 3 hearts and you are out.',
  mount(root, signal) {
    let mode = 'bot', level = 'med', timer = null;
    signal.addEventListener('abort', () => clearInterval(timer));
    const stage = el('div', { class: 'stage' });
    const lvlTabs = tabs([['easy', 'Chatty bot'], ['med', 'Bookworm'], ['hard', 'Walking dictionary']], level, l => { level = l; start(); });
    root.append(el('div', { class: 'center' }, el('div', { class: 'row' },
      tabs([['bot', 'Vs Bot'], ['duel', 'Pass & Play']], mode, m => { mode = m; lvlTabs.style.display = m === 'bot' ? '' : 'none'; start(); }), lvlTabs)), stage);

    const byFirst = {};
    for (const w of [...LISTS.four, ...LISTS.five, ...LISTS.long]) (byFirst[w[0]] ||= []).push(w);
    const LETTERS = 'abcdefghilmnoprstw';
    const TURN = 15;

    function start() {
      clearInterval(timer);
      const names = mode === 'bot' ? ['You', 'Bot'] : ['Player 1', 'Player 2'];
      const lives = [3, 3], used = new Set(), chain = [];
      let turn = 0, letter = pick([...LETTERS]), over = false, t0 = 0, mine = 0;
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
        const botTurn = mode === 'bot' && turn === 1;
        input.disabled = botTurn || over;
        if (!botTurn && !over) { input.value = ''; input.focus(); }
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
          if (left <= 0) timeout();
        }, 150);
        if (mode === 'bot' && turn === 1) botMove();
      }
      function next(w) {
        letter = w[w.length - 1];
        if (!byFirst[letter]) letter = pick([...LETTERS]); // dead-end letters (x, z...) get swapped
        turn = 1 - turn; beginTurn();
      }
      function submit(w) {
        if (over || (mode === 'bot' && turn === 1)) return;
        if (!/^[a-z]+$/.test(w) || w.length < 3) return toast('3+ letters');
        if (w[0] !== letter) return toast(`Must start with ${letter.toUpperCase()}`);
        if (used.has(w)) return toast('Already used');
        if (!Dict.has(w)) { Sfx.bad(); return toast('Not in my dictionary'); }
        used.add(w); addLink(w, turn); Sfx.good();
        if (turn === 0) mine++;
        next(w);
      }
      function timeout() {
        clearInterval(timer);
        lives[turn]--; Sfx.bad();
        toast(`${names[turn]} ran out of time`);
        if (!lives[turn]) return end();
        letter = pick([...LETTERS]);
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
        const loser = lives[0] ? 1 : 0, win = loser === 1;
        need.textContent = `${names[1 - loser]} wins`;
        const s = Stats.record('wordchain', mode === 'bot' ? { win, score: mine } : {});
        (mode === 'duel' || win) ? (Sfx.win(), celebrate()) : Sfx.lose();
        modal(mode === 'bot' ? (win ? 'You win!' : 'The bot wins') : `${names[1 - loser]} wins!`,
          el('div', {}, el('p', {}, `Chain length: ${chain.length} words.`), mode === 'bot' ? statRow(s, { best: 'most words' }) : null),
          [{ label: 'Play again', primary: true }]).then(v => v && start());
      }
      beginTurn();
    }
    start();
  },
});
