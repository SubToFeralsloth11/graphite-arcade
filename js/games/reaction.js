Games.register({
  id: 'reaction',
  title: 'Quick Draw',
  blurb: 'Wait for the page to say DRAW, then slap the button. Too early and you fumble.',
  group: 'button',
  tags: ['solo', '2P', 'reflex'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><circle cx="60" cy="42" r="26"/><path d="M60 42 V24 M60 42 L74 50"/><path d="M52 10 h16 M60 10 v6"/><path d="M96 24 l10 -8 M100 40 h12 M96 56 l10 8"/></svg>`,
  help: 'Press the big button (or Space) the moment it says DRAW. Five rounds; your score is the average time in milliseconds, lower is better. Press early and that round costs a 1000 ms penalty. In 2P, left player uses A and right player uses L; first to press wins the round.',
  mount(root, signal) {
    let mode = 'solo', run = 0;
    const stage = el('div', { class: 'stage' });
    root.append(el('div', { class: 'center' }, tabs([['solo', 'Solo'], ['duel', '2P Duel']], mode, m => { mode = m; start(); })), stage);
    let onKey = null;
    onKeys(signal, (k, e) => { if (onKey && (k === ' ' || k === 'a' || k === 'l')) { e.preventDefault(); onKey(k); } });

    function start() {
      const id = ++run;
      const alive = () => id === run && !signal.aborted;
      const times = [], wins = [0, 0];
      let state = 'idle', t0 = 0, timer = 0;
      const btn = el('button', { class: 'bt-big sk' }, 'Tap to start');
      const msg = el('div', { class: 'msg' }, mode === 'solo' ? '5 rounds. Lower is better.' : 'Player 1: A or left pad · Player 2: L or right pad');
      const log = el('div', { class: 'muted' });
      const side = who => el('button', { class: 'btn bt-side', onpointerdown: e => { e.preventDefault(); if (state !== 'idle' && state !== 'done') press(who); } }, who === 'a' ? 'P1 tap' : 'P2 tap');
      stage.replaceChildren(el('div', { class: 'center' }, msg, mode === 'duel' ? el('div', { class: 'row' }, side('a'), btn, side('l')) : btn, log));
      const set = (s, text) => { state = s; btn.textContent = text; btn.dataset.s = s; };
      const arm = () => {
        set('wait', 'wait for it...');
        timer = setTimeout(() => { if (!alive()) return; set('go', 'DRAW!'); Sfx.good(); t0 = performance.now(); }, 1200 + rand(2800));
      };
      const finish = () => {
        set('done', 'Play again');
        if (mode === 'solo') {
          const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
          const s = Stats.record('reaction', { score: avg, best: 'low' });
          msg.textContent = `Average: ${avg} ms${s.newBest ? ' (new best!)' : ''}`;
          avg < 300 ? (Sfx.win(), celebrate()) : Sfx.tap();
        } else {
          Stats.record('reaction', {});
          msg.textContent = `Player ${wins[0] > wins[1] ? 1 : 2} wins ${Math.max(...wins)}–${Math.min(...wins)}!`;
          Sfx.win(); celebrate();
        }
      };
      const press = who => {
        if (state === 'idle' || state === 'done') { if (state === 'done') return start(); times.length = 0; return arm(); }
        if (state === 'wait') {
          clearTimeout(timer); Sfx.bad();
          if (mode === 'solo') { times.push(1000); log.textContent = times.map(t => t + 'ms').join(' · '); msg.textContent = 'Too early! +1000 ms'; }
          else { const other = who === 'l' ? 0 : 1; wins[other]++; msg.textContent = `Player ${2 - other} jumped the gun. Point to Player ${other + 1}.`; log.textContent = `${wins[0]} – ${wins[1]}`; }
        } else if (state === 'go') {
          const t = Math.round(performance.now() - t0);
          if (mode === 'solo') { times.push(t); log.textContent = times.map(t => t + 'ms').join(' · '); msg.textContent = `${t} ms`; }
          else { const w = who === 'l' ? 1 : 0; wins[w]++; msg.textContent = `Player ${w + 1} draws first (${t} ms)`; log.textContent = `${wins[0]} – ${wins[1]}`; }
          Sfx.tap();
        } else return;
        const over = mode === 'solo' ? times.length >= 5 : Math.max(...wins) >= 3;
        if (over) return finish();
        set('pause', '...');
        setTimeout(() => alive() && arm(), 900);
      };
      btn.addEventListener('pointerdown', e => { e.preventDefault(); if (mode === 'solo' || state === 'idle' || state === 'done') press('a'); });
      onKey = k => {
        if (mode === 'solo') { if (k === ' ') press(' '); }
        else if (k === 'a' || k === 'l') press(k);
        else if (k === ' ' && (state === 'idle' || state === 'done')) press('a');
      };
    }
    start();
  },
});
