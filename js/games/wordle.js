Games.register({
  id: 'wordle',
  title: 'Wordle',
  blurb: 'Six tries to find the hidden five-letter word.',
  group: 'word',
  tags: ['daily', 'solo', '2P duel', 'online'],
  daily: true,
  icon: `<svg viewBox="0 0 120 80" class="doodle"><rect x="6" y="20" width="20" height="20" class="fill"/><rect x="30" y="20" width="20" height="20"/><circle cx="40" cy="30" r="7"/><rect x="54" y="20" width="20" height="20"/><rect x="78" y="20" width="20" height="20" class="fill"/><path d="M8 52 h18 M32 52 h18 M56 52 h18 M80 52 h18" opacity=".5"/><path d="M100 64 l12 -12" /></svg>`,
  help: 'Guess the word in 6 tries. A filled tile means the letter is in the right spot. A circled, cross-hatched tile means the letter is in the word but somewhere else. A crossed-out letter is not in the word. Daily is the same puzzle for everyone each day; Duel lets a friend pick the word. Online: one of you picks a word on your own device while the other guesses on theirs (the picker watches live); roles swap every round.',
  mount(root, signal) {
    let mode = 'daily', link = null, rnd = 0, tally = [0, 0];
    const stage = el('div', { class: 'stage' });
    root.append(el('div', { class: 'center' }, tabs([['daily', 'Daily'], ['practice', 'Practice'], ['duel', 'Duel (pass & play)'], ['online', 'Online']], mode, m => { mode = m; if (link) { link.close(); link = null; } start(); }), stage));
    let keyHandler = null;
    onKeys(signal, k => keyHandler && keyHandler(k));

    function start() {
      keyHandler = null;
      if (mode === 'online' && !link?.open) {
        return Net.lobby(stage, 'wordle', signal, l => { link = l; rnd = 0; tally = [0, 0]; link.onClose = () => { link = null; start(); }; start(); });
      }
      if (mode === 'online') {
        const setter = rnd++ % 2; // host picks first, then roles swap
        if (setter === link.me) {
          link.on('secret', null);
          askSecret(w => { play(w, 'watch'); link.send('secret', w); });
        } else {
          stage.replaceChildren(el('div', { class: 'panel sk center', style: 'max-width:440px;margin:0 auto' },
            el('div', { class: 'big' }, 'Your turn to guess'), el('p', { class: 'muted' }, 'Your friend is picking a five-letter word...')));
          link.on('secret', w => play(w, 'guess'));
        }
      } else if (mode === 'duel') {
        secretPrompt(stage, { title: 'Player 1: pick a word', exactLen: 5, onDone: w => play(w) });
      } else if (mode === 'daily') {
        play(pick(LISTS.five, dailyRng(1)));
      } else play(pick(LISTS.five));
    }

    /** Online word entry: like secretPrompt but no hand-over screen (the guesser is on another device). */
    function askSecret(onDone) {
      const input = el('input', { class: 'input', autocomplete: 'off', spellcheck: 'false', placeholder: 'five letters', maxlength: 5 });
      const submit = () => {
        const w = input.value.trim().toLowerCase();
        if (!/^[a-z]{5}$/.test(w)) return toast('Needs exactly 5 letters');
        if (!Dict.has(w)) return toast("That's not in my dictionary");
        Sfx.scratch();
        onDone(w);
      };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
      stage.replaceChildren(el('div', { class: 'panel sk center', style: 'max-width:440px;margin:0 auto' },
        el('div', { class: 'big' }, 'Pick a word for your friend'),
        el('p', { class: 'muted', style: 'margin:0' }, 'They guess it on their device while you watch.'),
        input, el('button', { class: 'btn btn-primary', onclick: submit }, 'Lock it in')));
      setTimeout(() => input.focus(), 50);
    }

    function score(guess, answer) {
      const res = Array(5).fill('absent'), left = {};
      for (let i = 0; i < 5; i++) if (guess[i] === answer[i]) res[i] = 'correct'; else left[answer[i]] = (left[answer[i]] || 0) + 1;
      for (let i = 0; i < 5; i++) if (res[i] !== 'correct' && left[guess[i]]) { res[i] = 'present'; left[guess[i]]--; }
      return res;
    }

    /** role: undefined offline, 'guess' or 'watch' online. */
    function play(answer, role) {
      const saveKey = mode === 'daily' ? `wordle:${todayKey()}` : null;
      const guesses = saveKey ? Store.get(saveKey, []) : [];
      let cur = '', done = false;
      const rows = Array.from({ length: 6 }, () => el('div', { class: 'wordle-row' }, Array.from({ length: 5 }, () => el('div', { class: 'tile' }))));
      const kb = keyboard(k => keyHandler(k));
      const msg = el('div', { class: 'msg' });
      stage.replaceChildren(el('div', { class: 'wordle-grid' }, rows), msg, kb.el);

      const paint = (r, g, animate) => {
        const res = score(g, answer);
        [...rows[r].children].forEach((t, i) => {
          t.textContent = g[i];
          const apply = () => { t.classList.add(res[i], 'filled'); kb.mark(g[i], res[i]); };
          if (animate) { setTimeout(() => { t.classList.add('flip'); Sfx.tap(); }, i * 220); setTimeout(apply, i * 220 + 250); } else apply();
        });
        return res;
      };
      guesses.forEach((g, r) => paint(r, g, false));
      if (guesses.includes(answer) || guesses.length >= 6) { done = true; finish(guesses.includes(answer), false); }
      if (role === 'watch') {
        msg.textContent = `Your friend is guessing ${answer.toUpperCase()}...`;
        link.on('guess', g => {
          if (done || !/^[a-z]{5}$/.test(g)) return;
          guesses.push(g);
          paint(guesses.length - 1, g, true);
          if (g === answer || guesses.length === 6) { done = true; setTimeout(() => finish(g === answer, true), 1400); }
        });
      } else if (role === 'guess') msg.textContent = "Guess your friend's word";

      function drawCur() {
        const row = rows[guesses.length];
        [...row.children].forEach((t, i) => { t.textContent = cur[i] || ''; t.classList.toggle('filled', !!cur[i]); });
      }
      keyHandler = k => {
        if (done || role === 'watch') return;
        if (k === 'enter') submit();
        else if (k === 'back') { cur = cur.slice(0, -1); drawCur(); }
        else if (/^[a-z]$/.test(k) && cur.length < 5) { cur += k; Sfx.tap(); drawCur(); }
      };
      function submit() {
        const row = rows[guesses.length];
        const bad = m => { toast(m); Sfx.bad(); row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake'); };
        if (cur.length < 5) return bad('Not enough letters');
        if (!Dict.has(cur)) return bad('Not in word list');
        guesses.push(cur);
        if (saveKey) Store.set(saveKey, guesses);
        if (role) link.send('guess', cur);
        paint(guesses.length - 1, cur, true);
        const won = cur === answer;
        cur = '';
        if (won || guesses.length === 6) { done = true; setTimeout(() => finish(won, true), 1400); }
      }
      function finish(won, fresh) {
        const praise = ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'];
        msg.textContent = won ? `${praise[guesses.length - 1]}  ${guesses.length}/6` : `The word was ${answer.toUpperCase()}`;
        if (!fresh) return;
        if (role) {
          const iWon = role === 'guess' ? won : !won, winner = iWon ? link.me : 1 - link.me;
          tally[winner]++;
          Stats.record('wordle', { win: iWon });
          iWon ? (Sfx.win(), celebrate()) : Sfx.lose();
          const title = role === 'guess' ? (won ? praise[guesses.length - 1] : 'Stumped!') : (won ? 'They got it' : 'You stumped them!');
          if (!link?.open) return;
          modal(title, el('div', {},
            el('p', {}, won ? `Solved in ${guesses.length}. ` : 'Not solved. ', 'The word was ', el('b', {}, answer.toUpperCase())),
            el('p', {}, `Score: You ${tally[link.me]} – Friend ${tally[1 - link.me]}`)), [{ label: 'Next round', primary: true }])
            .then(() => { if (link?.open) { msg.textContent = 'Waiting for your friend...'; link.ready(start); } });
          return;
        }
        const s = Stats.record('wordle', { win: won, score: won ? guesses.length : null, best: 'low' });
        if (mode === 'daily') Stats.markDaily('wordle', won ? `${guesses.length}/6` : 'X/6');
        won ? (Sfx.win(), celebrate()) : Sfx.lose();
        const grid = guesses.map(g => score(g, answer).map(r => r === 'correct' ? '■' : r === 'present' ? '◩' : '□').join('')).join('\n');
        modal(won ? praise[guesses.length - 1] : 'So close', el('div', {},
          el('p', {}, won ? `Solved in ${guesses.length}.` : `It was `, won ? null : el('b', {}, answer.toUpperCase())),
          statRow(s, { best: 'fewest' }),
          el('pre', { style: 'text-align:center;font-size:20px;line-height:1.1;margin:8px 0 0' }, grid)),
          [{ label: 'Copy result', value: 'copy' }, { label: mode === 'daily' ? 'Practice more' : 'Play again', primary: true, value: 'again' }])
          .then(v => {
            if (v === 'copy') { navigator.clipboard?.writeText(`Graphite Wordle ${mode === 'daily' ? todayKey() : ''} ${won ? guesses.length : 'X'}/6\n${grid}`); toast('Copied'); }
            if (v === 'again') { if (mode === 'daily') { mode = 'practice'; root.querySelector('.tab:nth-child(2)').click(); } else start(); }
          });
      }
    }
    start();
  },
});
