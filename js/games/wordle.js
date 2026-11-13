Games.register({
  id: 'wordle',
  title: 'Wordle',
  blurb: 'Six tries to find the hidden five-letter word.',
  group: 'word',
  tags: ['daily', 'solo', '2P duel'],
  daily: true,
  icon: `<svg viewBox="0 0 120 80" class="doodle"><rect x="6" y="20" width="20" height="20" class="fill"/><rect x="30" y="20" width="20" height="20"/><circle cx="40" cy="30" r="7"/><rect x="54" y="20" width="20" height="20"/><rect x="78" y="20" width="20" height="20" class="fill"/><path d="M8 52 h18 M32 52 h18 M56 52 h18 M80 52 h18" opacity=".5"/><path d="M100 64 l12 -12" /></svg>`,
  help: 'Guess the word in 6 tries. A filled tile means the letter is in the right spot. A circled, cross-hatched tile means the letter is in the word but somewhere else. A crossed-out letter is not in the word. Daily is the same puzzle for everyone each day; Duel lets a friend pick the word.',
  mount(root, signal) {
    let mode = 'daily';
    const stage = el('div', { class: 'stage' });
    root.append(el('div', { class: 'center' }, tabs([['daily', 'Daily'], ['practice', 'Practice'], ['duel', 'Duel (pass & play)']], mode, m => { mode = m; start(); }), stage));
    let keyHandler = null;
    onKeys(signal, k => keyHandler && keyHandler(k));

    function start() {
      keyHandler = null;
      if (mode === 'duel') {
        secretPrompt(stage, { title: 'Player 1: pick a word', exactLen: 5, onDone: w => play(w) });
      } else if (mode === 'daily') {
        play(pick(LISTS.five, dailyRng(1)));
      } else play(pick(LISTS.five));
    }

    function score(guess, answer) {
      const res = Array(5).fill('absent'), left = {};
      for (let i = 0; i < 5; i++) if (guess[i] === answer[i]) res[i] = 'correct'; else left[answer[i]] = (left[answer[i]] || 0) + 1;
      for (let i = 0; i < 5; i++) if (res[i] !== 'correct' && left[guess[i]]) { res[i] = 'present'; left[guess[i]]--; }
      return res;
    }

    function play(answer) {
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

      function drawCur() {
        const row = rows[guesses.length];
        [...row.children].forEach((t, i) => { t.textContent = cur[i] || ''; t.classList.toggle('filled', !!cur[i]); });
      }
      keyHandler = k => {
        if (done) return;
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
        paint(guesses.length - 1, cur, true);
        const won = cur === answer;
        cur = '';
        if (won || guesses.length === 6) { done = true; setTimeout(() => finish(won, true), 1400); }
      }
      function finish(won, fresh) {
        const praise = ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'];
        msg.textContent = won ? `${praise[guesses.length - 1]}  ${guesses.length}/6` : `The word was ${answer.toUpperCase()}`;
        if (!fresh) return;
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
