Games.register({
  id: 'rps',
  title: 'Rock Paper Scissors',
  blurb: 'Best of nine against a bot that studies your habits. Try to be random. You are not.',
  group: 'button',
  tags: ['vs bot', '2P', 'quick'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M14 50 c0 -16 22 -18 26 -6 c4 12 -8 20 -18 18 c-6 -1 -8 -6 -8 -12 z"/><rect x="48" y="22" width="24" height="34" rx="2"/><path d="M52 30 h16 M52 38 h16 M52 46 h10"/><circle cx="88" cy="56" r="6"/><circle cx="104" cy="56" r="6"/><path d="M92 51 L106 20 M100 51 L86 20"/></svg>`,
  help: 'Rock beats scissors, scissors beat paper, paper beats rock. First to 5 wins. The bot remembers what you tend to play after each move and counters it. Keys: R, P, S. Pass & Play: player 1 picks with A/S/D, player 2 with J/K/L, hidden until both choose.',
  mount(root, signal) {
    const M = ['rock', 'paper', 'scissors'], ICON = ['✊', '✋', '✌'];
    let mode = 'bot', onKey = null;
    const stage = el('div', { class: 'stage' });
    root.append(el('div', { class: 'center' }, tabs([['bot', 'Vs Bot'], ['duel', 'Pass & Play']], mode, m => { mode = m; start(); })), stage);
    onKeys(signal, k => onKey && onKey(k));
    const beats = (a, b) => (a - b + 3) % 3 === 1;
    function start() {
      const score = [0, 0], names = mode === 'bot' ? ['You', 'Bot'] : ['Player 1', 'Player 2'];
      const memory = {}; let last = null; const picks = [null, null];
      const P = names.map(n => el('div', { class: 'player sk' }, el('div', { class: 'who' }, n), el('div', { class: 'pts' }, 0)));
      const show = el('div', { class: 'big', style: 'font-size:64px;min-height:70px' }, '?  vs  ?');
      const msg = el('div', { class: 'msg' }, 'Make your move');
      const btns = el('div', { class: 'row' }, M.map((m, i) => el('button', { class: 'btn', style: 'font-size:24px', onclick: () => choose(0, i) }, `${ICON[i]} ${m}`)));
      stage.replaceChildren(el('div', { class: 'center' }, el('div', { class: 'scoreboard' }, P), show, msg, mode === 'bot' ? btns : el('div', { class: 'muted' }, 'P1: A rock · S paper · D scissors      P2: J rock · K paper · L scissors')));
      onKey = k => {
        if (mode === 'bot') { const i = 'rps'.indexOf(k); if (i >= 0) choose(0, i); }
        else { let i = 'asd'.indexOf(k); if (i >= 0) return choose(0, i); i = 'jkl'.indexOf(k); if (i >= 0) choose(1, i); }
      };
      const botPick = () => {
        const seen = last == null ? null : memory[last];
        if (!seen || Math.random() < .2) return rand(3);
        const guess = seen.indexOf(Math.max(...seen)); // what the human usually plays next
        return (guess + 1) % 3;
      };
      function choose(p, i) {
        if (Math.max(...score) >= 5 || picks[p] != null) return;
        picks[p] = i; Sfx.tap();
        if (mode === 'bot') picks[1] = botPick();
        else if (picks[1 - p] == null) { msg.textContent = `${names[p]} has chosen...`; return; }
        resolve();
      }
      function resolve() {
        const [a, b] = picks;
        if (mode === 'bot') { if (last != null) (memory[last] ||= [0, 0, 0])[a]++; last = a; }
        show.textContent = `${ICON[a]}  vs  ${ICON[b]}`;
        if (a === b) msg.textContent = 'Draw';
        else { const w = beats(a, b) ? 0 : 1; score[w]++; msg.textContent = `${M[w ? b : a]} beats ${M[w ? a : b]}: ${names[w]} scores`; w === 0 || mode === 'duel' ? Sfx.good() : Sfx.bad(); }
        P.forEach((p, i) => (p.lastChild.textContent = score[i]));
        picks[0] = picks[1] = null;
        const w = score.findIndex(s => s >= 5);
        if (w >= 0) {
          Stats.record('rps', { win: mode === 'bot' ? w === 0 : undefined });
          (mode === 'duel' || w === 0) ? (Sfx.win(), celebrate()) : Sfx.lose();
          setTimeout(() => !signal.aborted && modal(`${names[w]} win${w === 0 && mode === 'bot' ? '' : 's'}!`, `${score[0]} – ${score[1]}`, [{ label: 'Rematch', primary: true }]).then(v => v && start()), 500);
        }
      }
    }
    start();
  },
});
