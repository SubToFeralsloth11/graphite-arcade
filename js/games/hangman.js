Games.register({
  id: 'hangman',
  title: 'Hangman',
  blurb: 'Guess letters before the doodle is finished. Or make the bot guess yours.',
  group: 'word',
  tags: ['vs bot', 'bot guesses', '2P', 'online'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M10 74 h46 M22 74 V8 h40 v10"/><circle cx="62" cy="26" r="8"/><path d="M62 34 v20 M62 40 l-9 8 M62 40 l9 8 M62 54 l-8 12 M62 54 l8 12"/><path d="M84 66 h8 M96 66 h8 M108 66 h8" opacity=".6"/></svg>`,
  help: 'Vs Bot: the bot picks a word, you guess letters. Bot Guesses: think of a word, tell the bot its length, then click every blank where its guessed letter appears (or "Not in my word"). Pass & Play: a friend types a secret word for you. Online: one of you types a secret word on your own device, the other guesses on theirs while the setter watches; roles swap every round. Eight wrong guesses and the doodle is done.',
  mount(root, signal) {
    const MAX = 8;
    let mode = 'solo', keyHandler = null, link = null, rnd = 0, tally = [0, 0];
    const stage = el('div', { class: 'stage' });
    root.append(el('div', { class: 'center' }, tabs([['solo', 'Vs Bot'], ['reverse', 'Bot Guesses'], ['duel', 'Pass & Play'], ['online', 'Online']], mode, m => { mode = m; if (link) { link.close(); link = null; } start(); })), stage);
    onKeys(signal, k => keyHandler && keyHandler(k));

    const drawing = () => {
      const parts = [
        'M20 230 h120', 'M50 230 V20 h90 v24', // gallows (always visible)
        'M150 64 m-20 0 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0', // head
        'M150 84 v62', 'M150 100 l-28 26', 'M150 100 l28 26', 'M150 146 l-22 42', 'M150 146 l22 42',
        'M140 58 l6 6 m0 -6 l-6 6', 'M154 58 l6 6 m0 -6 l-6 6', // x eyes
      ];
      const svg = el('div', { html: `<svg class="hang-svg" viewBox="0 0 220 240">${parts.map((d, i) => `<path class="part${i < 2 ? ' on' : ''}" d="${d}"/>`).join('')}</svg>` });
      return { el: svg, set(n) { $$('.part', svg).forEach((p, i) => i >= 2 && p.classList.toggle('on', i - 2 < n)); } };
    };

    function start() {
      keyHandler = null;
      if (mode === 'online' && !link?.open) {
        return Net.lobby(stage, 'hangman', signal, l => { link = l; rnd = 0; tally = [0, 0]; link.onClose = () => { link = null; start(); }; start(); });
      }
      if (mode === 'solo') guessGame(pick(LISTS.long.concat(LISTS.five)), 'bot');
      else if (mode === 'duel') secretPrompt(stage, { title: 'Player 1: secret word', minLen: 3, maxLen: 12, onDone: w => guessGame(w, 'friend') });
      else if (mode === 'online') onlineRound();
      else reverseSetup();
    }

    /* --- online: setter types a word on their device, guesser plays on theirs; roles swap --- */
    function onlineRound() {
      const setter = rnd++ % 2; // host sets first
      if (setter !== link.me) {
        stage.replaceChildren(el('div', { class: 'panel sk center', style: 'max-width:440px;margin:0 auto' },
          el('div', { class: 'big' }, 'Your turn to guess'), el('p', { class: 'muted' }, 'Your friend is picking a secret word...')));
        link.on('secret', w => guessGame(w, 'friend', 'guess'));
        return;
      }
      link.on('secret', null);
      const input = el('input', { class: 'input', autocomplete: 'off', spellcheck: 'false', placeholder: 'secret word', maxlength: 12 });
      const submit = () => {
        const w = input.value.trim().toLowerCase();
        if (!/^[a-z]+$/.test(w)) return toast('Letters only');
        if (w.length < 3 || w.length > 12) return toast('Between 3 and 12 letters');
        if (!Dict.has(w)) return toast("That's not in my dictionary");
        Sfx.scratch();
        guessGame(w, 'friend', 'watch');
        link.send('secret', w);
      };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
      stage.replaceChildren(el('div', { class: 'panel sk center', style: 'max-width:440px;margin:0 auto' },
        el('div', { class: 'big' }, 'Pick a secret word'),
        el('p', { class: 'muted', style: 'margin:0' }, 'Your friend guesses it on their device while you watch.'),
        input, el('button', { class: 'btn btn-primary', onclick: submit }, 'Lock it in')));
      setTimeout(() => input.focus(), 50);
    }

    /* --- human guesses (role: undefined offline, 'guess' or 'watch' online) --- */
    function guessGame(word, who, role) {
      const guessed = new Set();
      let wrong = 0, done = false;
      const pic = drawing();
      const slots = el('div', { class: 'slots' }, [...word].map(() => el('div', { class: 'slot' })));
      const info = el('div', { class: 'msg' }, role === 'watch' ? `Your friend is guessing ${word.toUpperCase()}...` : `${who === 'bot' ? 'The bot' : 'Your friend'} picked a ${word.length}-letter word.`);
      const lives = el('div', { class: 'muted', style: 'text-align:center' });
      const kb = keyboard(k => keyHandler(k), { enter: false });
      const sync = () => {
        [...slots.children].forEach((s, i) => { s.textContent = guessed.has(word[i]) ? word[i] : ''; });
        lives.textContent = `${MAX - wrong} wrong guesses left`;
        pic.set(wrong);
      };
      stage.replaceChildren(el('div', { class: 'hang-wrap' }, el('div', { class: 'panel sk' }, pic.el), el('div', {}, info, slots, lives, el('br'), kb.el)));
      sync();
      keyHandler = k => {
        if (role === 'watch' || done || !/^[a-z]$/.test(k) || guessed.has(k)) return;
        if (role) link.send('letter', k);
        guess(k);
      };
      if (role === 'watch') link.on('letter', k => { if (!done && /^[a-z]$/.test(k) && !guessed.has(k)) guess(k); });
      function guess(k) {
        guessed.add(k);
        if (word.includes(k)) { kb.mark(k, 'correct'); Sfx.good(); } else { kb.mark(k, 'absent'); wrong++; Sfx.scratch(); }
        sync();
        const won = [...word].every(c => guessed.has(c));
        if (won || wrong >= MAX) {
          done = true;
          if (!won) [...slots.children].forEach((s, i) => { if (!guessed.has(word[i])) { s.textContent = word[i]; s.classList.add('miss'); } });
          if (role) {
            const iWon = role === 'guess' ? won : !won;
            tally[iWon ? link.me : 1 - link.me]++;
            Stats.record('hangman', { win: iWon });
            iWon ? (Sfx.win(), celebrate()) : Sfx.lose();
            const title = role === 'guess' ? (won ? 'Saved him!' : 'Doodle complete') : (won ? 'They got it' : 'You stumped them!');
            info.textContent = title;
            setTimeout(() => !signal.aborted && link?.open && modal(title, el('div', {},
              el('p', {}, won ? `Solved with ${MAX - wrong} guesses to spare. ` : 'Not solved. ', 'The word was ', el('b', {}, word.toUpperCase())),
              el('p', {}, `Score: You ${tally[link.me]} – Friend ${tally[1 - link.me]}`)), [{ label: 'Next round', primary: true }])
              .then(() => { if (link?.open) { info.textContent = 'Waiting for your friend...'; link.ready(start); } }), 700);
            return;
          }
          const st = Stats.record('hangman', { win: won });
          won ? (Sfx.win(), celebrate()) : Sfx.lose();
          setTimeout(() => modal(won ? 'Saved him!' : 'Doodle complete', el('div', {},
            el('p', {}, won ? `You got it with ${MAX - wrong} guesses to spare.` : 'The word was ', won ? null : el('b', {}, word.toUpperCase())), statRow(st)),
            [{ label: 'Play again', primary: true }]).then(v => v && start()), 700);
        }
      }
    }

    /* --- bot guesses --- */
    function reverseSetup() {
      const sel = el('select', { class: 'input', style: 'width:auto;letter-spacing:0' }, Array.from({ length: 7 }, (_, i) => el('option', { value: i + 3, selected: i + 3 === 6 }, `${i + 3} letters`)));
      stage.replaceChildren(el('div', { class: 'panel sk center', style: 'max-width:460px;margin:0 auto' },
        el('div', { class: 'big' }, 'Think of a word'),
        el('p', { class: 'muted', style: 'margin:0;text-align:center' }, "Keep it in your head. I know about 100,000 words. Be honest when I guess!"),
        el('div', { class: 'row' }, 'It has', sel),
        el('button', { class: 'btn btn-primary', onclick: () => botGuesses(+sel.value) }, 'Start guessing')));
    }

    function botGuesses(len) {
      let pattern = Array(len).fill(null), wrong = 0, candidates = Dict.ofLen(len);
      const tried = new Set(), missed = [];
      let letter = null, marked = new Set(), done = false;
      const pic = drawing();
      const bubble = el('div', { class: 'bot-bubble sk' });
      const slots = el('div', { class: 'slots' });
      const triedEl = el('div', { class: 'muted', style: 'text-align:center' });
      const yes = el('button', { class: 'btn btn-primary', onclick: () => answer(true) }, 'Mark these');
      const no = el('button', { class: 'btn', onclick: () => answer(false) }, 'Not in my word');
      const pool = el('div', { class: 'muted', style: 'text-align:center;font-size:15px' });
      stage.replaceChildren(el('div', { class: 'hang-wrap' }, el('div', { class: 'panel sk' }, pic.el),
        el('div', { class: 'center' }, bubble, slots, el('div', { class: 'row' }, yes, no), triedEl, pool)));

      const draw = () => {
        slots.replaceChildren(...pattern.map((c, i) => el('div', {
          class: 'slot' + (!c && !done ? ' pickable' : '') + (marked.has(i) ? ' marked' : ''),
          onclick: () => { if (c || done) return; marked.has(i) ? marked.delete(i) : marked.add(i); Sfx.tap(); draw(); },
        }, c || (marked.has(i) ? letter : ''))));
        triedEl.textContent = missed.length ? 'Missed: ' + missed.join(' ').toUpperCase() : '';
        pool.textContent = `${candidates.length.toLocaleString()} possible words left in my head`;
        pic.set(wrong);
      };
      const end = async (botWon) => {
        done = true; yes.disabled = no.disabled = true; draw();
        Stats.record('hangman', { win: !botWon });
        if (botWon) { Sfx.lose(); bubble.textContent = `Got it! Your word is ${pattern.join('').toUpperCase()}.`; return modal('Bot wins', 'Read your mind. Rematch?', [{ label: 'Rematch', primary: true }]).then(v => v && start()); }
        Sfx.win(); celebrate();
        bubble.textContent = 'I give up!';
        const v = await modal('You stumped the bot', el('div', {}, el('p', {}, 'What was the word? (optional)'), el('input', { class: 'input', id: 'reveal' })), [{ label: 'Tell it', primary: true, value: 'tell' }, { label: 'Skip', value: 'skip' }]);
        const w = (document.getElementById('reveal')?.value || '').toLowerCase();
        if (v === 'tell' && w) {
          const ok = w.length === len && [...w].every((c, i) => pattern[i] ? pattern[i] === c : !tried.has(c));
          toast(ok ? (Dict.has(w) ? 'Huh, I missed that one!' : 'Never heard of it!') : "That doesn't match your answers...", 2600);
        }
      };
      const next = () => {
        marked = new Set();
        if (pattern.every(Boolean)) return end(true);
        if (wrong >= MAX || !candidates.length) return end(false);
        if (candidates.length === 1) {
          const w = candidates[0];
          bubble.textContent = `I think it's... ${w.toUpperCase()}? Mark the missing letters for me.`;
        }
        const freq = {};
        for (const w of candidates) for (const c of new Set(w)) if (!tried.has(c)) freq[c] = (freq[c] || 0) + 1;
        letter = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0];
        if (!letter) return end(false);
        tried.add(letter);
        if (candidates.length > 1) bubble.textContent = pick([`Is there an ${letter.toUpperCase()}?`, `Hmm... ${letter.toUpperCase()}?`, `Any ${letter.toUpperCase()}s?`, `I'll try ${letter.toUpperCase()}.`]);
        draw();
      };
      const answer = (has) => {
        if (done) return;
        if (has && !marked.size) return toast('Click the blanks where it appears');
        Sfx.scratch();
        if (has) {
          for (const i of marked) pattern[i] = letter;
        } else { wrong++; missed.push(letter); }
        candidates = candidates.filter(w => [...w].every((c, i) => pattern[i] ? c === pattern[i] : !tried.has(c)));
        next();
      };
      keyHandler = k => { if (k === 'enter') answer(marked.size > 0); };
      next();
    }
    start();
  },
});
