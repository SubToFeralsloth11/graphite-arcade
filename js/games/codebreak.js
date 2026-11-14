Games.register({
  id: 'codebreak',
  title: 'Codebreaker',
  blurb: 'Crack a hidden code of four symbols in ten tries. Dots tell you how close you are.',
  group: 'button',
  tags: ['solo', '2P', 'online', 'logic', 'daily'],
  daily: true,
  icon: `<svg viewBox="0 0 120 80" class="doodle"><circle cx="22" cy="40" r="9"/><rect x="38" y="31" width="18" height="18"/><path d="M74 30 l10 18 h-20 z"/><path d="M98 30 l4 8 l8 1 l-6 6 l2 8 l-8 -4 l-8 4 l2 -8 l-6 -6 l8 -1 z"/></svg>`,
  help: 'Pick four symbols (repeats allowed) and press Check. A dark dot means right symbol in the right place; a hollow dot means right symbol in the wrong place. Crack it within 10 guesses. Pass & Play: player 1 secretly sets the code first. Online: one player sets the code on their own device and watches the other guess; roles swap each round.',
  mount(root, signal) {
    const SYM = ['●', '■', '▲', '★', '♥', '◆'];
    let mode = 'daily', link = null, round = 0;
    const stage = el('div', { class: 'stage' });
    root.append(el('div', { class: 'center' }, tabs([['daily', 'Daily'], ['free', 'Random'], ['duel', 'Pass & Play'], ['online', 'Online']], mode, m => { mode = m; if (link) { link.close(); link = null; } start(); })), stage);
    function start() {
      if (mode === 'online') {
        if (!link?.open) return Net.lobby(stage, 'codebreak', signal, l => { link = l; round = 0; link.onClose = () => { link = null; start(); }; start(); });
        // Setter alternates: host on even rounds, guest on odd ones.
        if (round % 2 === link.me) return setCode(code => { link.send('code', code); watch(code); }, 'Set a code for your friend', 'They crack it on their own device.');
        stage.replaceChildren(el('div', { class: 'center' }, el('div', { class: 'msg' }, 'Your friend is setting a code...')));
        return link.on('code', code => play(code));
      }
      if (mode === 'duel') return setCode(code => play(code));
      const rng = mode === 'daily' ? dailyRng(77) : Math.random;
      play(Array.from({ length: 4 }, () => Math.floor(rng() * 6)));
    }
    function setCode(done, title = 'Player 1: set the code', sub = 'Player 2, look away!') {
      const code = [];
      const slots = el('div', { class: 'row bt-code' });
      const draw = () => slots.replaceChildren(...[0, 1, 2, 3].map(i => el('span', { class: 'bt-slot' }, code[i] != null ? '?' : '')));
      stage.replaceChildren(el('div', { class: 'center panel sk', style: 'max-width:460px;margin:0 auto' },
        el('div', { class: 'big' }, title), el('div', { class: 'muted' }, sub), slots,
        el('div', { class: 'row' }, SYM.map((s, i) => el('button', { class: 'btn', onclick: () => { if (code.length < 4) { code.push(i); Sfx.tap(); draw(); if (code.length === 4) setTimeout(() => done(code), 300); } } }, s))),
        el('button', { class: 'btn btn-ghost', onclick: () => { code.pop(); draw(); } }, 'undo')));
      draw();
    }
    const line = (g, fb) => el('div', { class: 'row bt-code' }, [0, 1, 2, 3].map(i => el('span', { class: 'bt-slot' }, g[i] != null ? SYM[g[i]] : '')),
      el('span', { class: 'bt-pegs' }, fb ? '●'.repeat(fb[0]) + '○'.repeat(fb[1]) || '–' : ''));
    function feedback(code, guess) {
      let black = 0, white = 0;
      const cc = [0, 0, 0, 0, 0, 0], gc = [0, 0, 0, 0, 0, 0];
      guess.forEach((g, i) => { if (g === code[i]) black++; else { cc[code[i]]++; gc[g]++; } });
      for (let i = 0; i < 6; i++) white += Math.min(cc[i], gc[i]);
      return [black, white];
    }
    function onlineEnd(won, text, msg) {
      round++;
      Stats.record('codebreak', { win: won });
      won ? (Sfx.win(), celebrate()) : Sfx.lose();
      msg.textContent = text;
      setTimeout(() => !signal.aborted && link?.open && modal(won ? 'You win!' : 'Friend wins', text, [{ label: 'Next round', primary: true }])
        .then(() => { if (link?.open) { msg.textContent = 'Waiting for your friend...'; link.ready(start); } }), 600);
    }
    /** Online setter's view: their own code on top, the friend's guesses arriving below. */
    function watch(code) {
      const rows = [];
      const msg = el('div', { class: 'msg' }, 'Friend is guessing: 0 of 10');
      const board = el('div', { class: 'center', style: 'gap:6px' });
      stage.replaceChildren(el('div', { class: 'center' }, el('div', { class: 'muted' }, 'Your code'), line(code), msg, board));
      link.on('guess', g => {
        if (rows.length >= 10 || rows.some(r => r.fb[0] === 4)) return;
        const fb = feedback(code, g); rows.push({ g, fb }); Sfx.scratch();
        board.replaceChildren(...rows.map(r => line(r.g, r.fb)));
        if (fb[0] === 4) return onlineEnd(false, `Friend cracked it in ${rows.length}.`, msg);
        if (rows.length >= 10) return onlineEnd(true, 'Friend ran out of tries. Your code held!', msg);
        msg.textContent = `Friend is guessing: ${rows.length} of 10`;
      });
    }
    function play(code) {
      const daily = mode === 'daily';
      let guess = [], rows = [], over = daily && !!Stats.dailyDone('codebreak');
      const board = el('div', { class: 'center', style: 'gap:6px' });
      const msg = el('div', { class: 'msg' });
      const pad = el('div', { class: 'row' }, SYM.map((s, i) => el('button', { class: 'btn', style: 'font-size:22px', onclick: () => { if (!over && guess.length < 4) { guess.push(i); Sfx.tap(); draw(); } } }, s)));
      const ctl = el('div', { class: 'row' },
        el('button', { class: 'btn btn-ghost', onclick: () => { guess.pop(); draw(); } }, 'del'),
        el('button', { class: 'btn btn-primary', onclick: check }, 'Check'));
      stage.replaceChildren(el('div', { class: 'center' }, msg, board, pad, ctl));
      function draw() {
        board.replaceChildren(...rows.map(r => line(r.g, r.fb)), over ? null : line(guess));
        msg.textContent = over && daily && !rows.length ? `Daily done: ${Stats.dailyDone('codebreak')}` : over ? msg.textContent : `Guess ${rows.length + 1} of 10`;
      }
      function check() {
        if (over || guess.length < 4) return;
        const [black, white] = feedback(code, guess);
        if (mode === 'online') link.send('guess', guess);
        rows.push({ g: guess, fb: [black, white] }); guess = [];
        if (black === 4 || rows.length >= 10) {
          over = true; const won = black === 4;
          if (mode === 'online') { draw(); return onlineEnd(won, won ? `Cracked in ${rows.length}!` : `Out of tries. It was ${code.map(i => SYM[i]).join(' ')}`, msg); }
          Stats.record('codebreak', { win: won, score: won ? rows.length : undefined, best: 'low' });
          if (daily) Stats.markDaily('codebreak', won ? `${rows.length}/10` : 'X/10');
          won ? (Sfx.win(), celebrate()) : Sfx.lose();
          msg.textContent = won ? `Cracked in ${rows.length}!` : `Out of tries. It was ${code.map(i => SYM[i]).join(' ')}`;
          if (!daily) ctl.replaceChildren(el('button', { class: 'btn btn-primary', onclick: start }, 'Again'));
        } else Sfx.scratch();
        draw();
      }
      draw();
    }
    start();
  },
});
