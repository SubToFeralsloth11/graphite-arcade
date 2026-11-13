Games.register({
  id: 'pig',
  title: 'Pig Dice',
  blurb: 'Roll and keep rolling... until a 1 wipes your turn. Push your luck to 100.',
  group: 'button',
  tags: ['vs bot', '2P', 'luck'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><rect x="20" y="20" width="36" height="36" rx="6" transform="rotate(-10 38 38)"/><circle cx="32" cy="32" r="3" class="fill"/><circle cx="44" cy="44" r="3" class="fill"/><rect x="66" y="24" width="36" height="36" rx="6" transform="rotate(8 84 42)"/><circle cx="84" cy="42" r="3" class="fill"/></svg>`,
  help: 'On your turn, Roll as often as you like; each roll adds to your turn total. Roll a 1 and you lose the turn total and your turn ends. Hold to bank the turn total. First to 100 wins.',
  mount(root, signal) {
    const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    let mode = 'bot';
    const stage = el('div', { class: 'stage' });
    root.append(el('div', { class: 'center' }, tabs([['bot', 'Vs Bot'], ['duel', 'Pass & Play']], mode, m => { mode = m; start(); })), stage);
    function start() {
      const names = mode === 'bot' ? ['You', 'Bot'] : ['Player 1', 'Player 2'];
      const score = [0, 0];
      let turn = 0, pot = 0, busy = false, over = false;
      const P = names.map(n => el('div', { class: 'player sk' }, el('div', { class: 'who' }, n), el('div', { class: 'pts' }, 0)));
      const die = el('div', { class: 'big', style: 'font-size:90px' }, '⚀');
      const msg = el('div', { class: 'msg' });
      const rollB = el('button', { class: 'btn btn-primary', onclick: () => human(roll) }, 'Roll');
      const holdB = el('button', { class: 'btn', onclick: () => human(hold) }, 'Hold');
      stage.replaceChildren(el('div', { class: 'center' }, el('div', { class: 'scoreboard' }, P), die, msg, el('div', { class: 'row' }, rollB, holdB)));
      const isBot = () => mode === 'bot' && turn === 1;
      const draw = () => {
        P.forEach((p, i) => { p.classList.toggle('turn', i === turn && !over); p.lastChild.textContent = score[i]; });
        if (!over) msg.textContent = `${names[turn]}: turn total ${pot}`;
        rollB.disabled = holdB.disabled = over || isBot() || busy;
      };
      const human = f => { if (!isBot() && !busy && !over) f(); };
      async function roll() {
        busy = true; draw();
        for (let i = 0; i < 6; i++) { die.textContent = pick(FACES); Sfx.tap(); await sleep(60); if (signal.aborted) return; }
        const r = 1 + rand(6); die.textContent = FACES[r - 1]; busy = false;
        if (r === 1) { pot = 0; Sfx.bad(); msg.textContent = `${names[turn]} rolled a 1!`; busy = true; await sleep(900); if (signal.aborted) return; busy = false; return next(); }
        pot += r; draw();
        if (score[turn] + pot >= 100) return hold();
        if (isBot()) botStep();
      }
      function hold() {
        score[turn] += pot; pot = 0; Sfx.scratch();
        if (score[turn] >= 100) {
          over = true; draw();
          Stats.record('pig', { win: mode === 'bot' ? turn === 0 : undefined });
          (mode === 'duel' || turn === 0) ? (Sfx.win(), celebrate()) : Sfx.lose();
          msg.textContent = `${names[turn]} reach${turn === 0 && mode === 'bot' ? '' : 'es'} 100!`;
          stage.firstChild.append(el('button', { class: 'btn btn-primary', onclick: start }, 'Play again'));
          return;
        }
        next();
      }
      function next() { turn = 1 - turn; pot = 0; draw(); if (isBot()) botStep(); }
      async function botStep() {
        await sleep(500); if (signal.aborted || over) return;
        const behind = score[0] - score[1];
        const target = score[0] >= 71 ? 100 : behind > 20 ? 25 : 20; // chase hard when the human is close to winning
        pot < target ? roll() : hold();
      }
      draw();
    }
    start();
  },
});
