Games.register({
  id: 'scramble',
  title: 'Scramble',
  blurb: 'Unjumble the letters before the clock (or the bot) beats you.',
  group: 'word',
  tags: ['timed', 'vs bot', '2P', 'online'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><rect x="8" y="24" width="22" height="22" transform="rotate(-10 19 35)"/><rect x="36" y="18" width="22" height="22" transform="rotate(8 47 29)"/><rect x="64" y="28" width="22" height="22" transform="rotate(-4 75 39)"/><rect x="92" y="20" width="22" height="22" transform="rotate(12 103 31)"/><path d="M20 62 c20 12 60 12 84 -2 l-6 -4 m6 4 l-8 3"/></svg>`,
  help: 'Click tiles or type to spell the word. Any real word using all the letters counts. Solo: 90 seconds, longer words score more, a hint costs half the points. Vs Bot: first to 5 words wins the race. Pass & Play: each player gets a 60-second turn; most points wins. Online: race a friend on another device through the same scrambles; first to solve each word takes the point, first to 5 wins.',
  mount(root, signal) {
    let mode = 'solo', keyHandler = null, timers = [], link = null, games = 0;
    const clear = () => { timers.forEach(clearInterval); timers.forEach(clearTimeout); timers = []; };
    signal.addEventListener('abort', clear);
    const stage = el('div', { class: 'stage' });
    root.append(el('div', { class: 'center' }, tabs([['solo', 'Solo sprint'], ['bot', 'Race the bot'], ['duel', 'Pass & Play'], ['online', 'Online race']], mode, m => { mode = m; if (link) { link.close(); link = null; } start(); })), stage);
    onKeys(signal, k => keyHandler && keyHandler(k));

    const scramble = (w, rng) => { let s; do s = shuffle([...w], rng).join(''); while (s === w && new Set(w).size > 1); return s; };
    const pool = rng => shuffle(LISTS.long.concat(LISTS.five.filter((_, i) => i % 3 === 0)), rng);
    const pts = w => w.length * 10;

    /** Renders one puzzle board. Calls onSolve(word, hintsUsed). rng (optional) fixes the scramble order. */
    function board(host, word, onSolve, rng) {
      let letters = [...scramble(word, rng)].map((c, i) => ({ c, i, used: false }));
      let built = [], hints = 0;
      const tilesEl = el('div', { class: 'scr-tiles' });
      const answerEl = el('div', { class: 'scr-tiles' });
      const render = () => {
        tilesEl.replaceChildren(...letters.map(l => el('div', { class: 'tile filled' + (l.used ? ' used' : ''), onclick: () => add(l) }, l.c)));
        answerEl.replaceChildren(...Array.from({ length: word.length }, (_, i) => el('div', { class: 'tile' + (built[i] ? ' filled' : '') + (i < hints ? ' correct' : ''), onclick: () => i >= hints && back(i) }, built[i]?.c || '')));
      };
      const add = l => { if (l.used || built.length >= word.length) return; l.used = true; built.push(l); Sfx.tap(); render(); check(); };
      const back = (i = built.length - 1) => { if (built.length <= hints || i < hints) return; built.splice(i).forEach(l => l.used = false); render(); };
      const check = () => {
        if (built.length < word.length) return;
        const w = built.map(l => l.c).join('');
        if (w === word || (Dict.has(w) && [...w].sort().join('') === [...word].sort().join(''))) { Sfx.good(); onSolve(w, hints); }
        else { Sfx.bad(); answerEl.classList.remove('shake'); void answerEl.offsetWidth; answerEl.classList.add('shake'); setTimeout(() => { built.slice(hints).forEach(l => l.used = false); built = built.slice(0, hints); render(); }, 350); }
      };
      const hint = () => {
        if (hints >= word.length - 1) return;
        built.forEach(l => l.used = false); built = [];
        hints++;
        for (let i = 0; i < hints; i++) { const l = letters.find(x => !x.used && x.c === word[i]); l.used = true; built.push(l); }
        Sfx.scratch(); render();
      };
      const reshuffle = () => { letters = shuffle(letters); Sfx.scratch(); render(); };
      host.replaceChildren(tilesEl, answerEl,
        el('div', { class: 'row', style: 'justify-content:center' },
          el('button', { class: 'btn btn-ghost', onclick: reshuffle }, 'shuffle'),
          el('button', { class: 'btn btn-ghost', onclick: () => back() }, 'undo'),
          el('button', { class: 'btn btn-ghost', onclick: hint }, 'hint')));
      render();
      keyHandler = k => {
        if (k === 'back') back();
        else if (k === ' ') reshuffle();
        else if (/^[a-z]$/.test(k)) { const l = letters.find(x => !x.used && x.c === k); if (l) add(l); }
      };
      return { hint, get hints() { return hints; } };
    }

    function timerBar(secs, onTick, onEnd) {
      const bar = el('div', { class: 'timer', style: 'width:min(520px,100%)' }, el('div', { style: 'width:100%' }));
      const t0 = Date.now();
      const iv = setInterval(() => {
        const left = Math.max(0, secs - (Date.now() - t0) / 1000);
        bar.firstChild.style.width = (100 * left / secs) + '%';
        onTick(Math.ceil(left));
        if (left <= 0) { clearInterval(iv); onEnd(); }
      }, 200);
      timers.push(iv);
      return bar;
    }

    function start() {
      clear(); keyHandler = null;
      if (mode === 'online' && !link?.open) {
        return Net.lobby(stage, 'scramble', signal, l => { link = l; games = 0; link.onClose = () => { link = null; start(); }; start(); });
      }
      if (mode === 'solo') solo();
      else if (mode === 'bot') botPick();
      else if (mode === 'online') onlineRace();
      else duel();
    }

    function solo() {
      let score = 0, solved = 0, done = false;
      const words = pool();
      const scoreEl = el('div', { class: 'big' }, '0');
      const clock = el('span', {}, '90');
      const host = el('div');
      const bar = timerBar(90, s => clock.textContent = s, () => finish());
      const next = () => board(host, words.pop(), (w, hints) => { score += Math.round(pts(w) / (hints ? 2 : 1)); solved++; scoreEl.textContent = score; next(); });
      const skip = el('button', { class: 'btn', onclick: () => { Sfx.scratch(); score = Math.max(0, score - 5); scoreEl.textContent = score; next(); } }, 'skip (-5)');
      stage.replaceChildren(el('div', { class: 'center' }, el('div', { class: 'row' }, scoreEl, el('span', { class: 'muted' }, 'points  ·  '), clock, el('span', { class: 'muted' }, 's')), bar, host, skip));
      next();
      function finish() {
        if (done) return; done = true; keyHandler = null;
        const s = Stats.record('scramble', { win: solved > 0, score });
        Sfx.win(); if (s.newBest) celebrate();
        modal(s.newBest ? 'New best!' : "Time's up", el('div', {}, el('p', {}, `${solved} words, ${score} points.`), statRow(s, { best: 'high score' })), [{ label: 'Again', primary: true }]).then(v => v && start());
      }
    }

    function botPick() {
      const lv = [['easy', 'Sleepy (slow)', [9000, 16000]], ['med', 'Sharp', [5500, 10000]], ['hard', 'Dictionary brain', [3000, 6500]]];
      stage.replaceChildren(el('div', { class: 'panel sk center', style: 'max-width:440px;margin:0 auto' },
        el('div', { class: 'big' }, 'Pick your opponent'),
        ...lv.map(([id, name, range]) => el('button', { class: 'btn', style: 'width:100%', onclick: () => race(name, range) }, name))));
    }

    function race(botName, [lo, hi]) {
      let me = 0, bot = 0, round = 0;
      const words = pool();
      const P = [el('div', { class: 'player sk turn' }, el('div', { class: 'who' }, 'You'), el('div', { class: 'pts' }, '0')),
                 el('div', { class: 'player sk' }, el('div', { class: 'who' }, botName), el('div', { class: 'pts' }, '0'))];
      const msg = el('div', { class: 'msg' }, 'First to 5!');
      const host = el('div');
      const think = el('div', { class: 'timer', style: 'width:min(520px,100%)' }, el('div', { style: 'width:0%' }));
      stage.replaceChildren(el('div', { class: 'center' }, el('div', { class: 'scoreboard' }, P), msg, el('div', { class: 'muted', style: 'font-size:15px' }, 'bot is thinking...'), think, host));
      const nextRound = () => {
        clear();
        if (me >= 5 || bot >= 5) return end();
        round++;
        const word = words.pop();
        const dur = lo + Math.random() * (hi - lo) + word.length * 400;
        const t0 = Date.now();
        timers.push(setInterval(() => { think.firstChild.style.width = Math.min(100, 100 * (Date.now() - t0) / dur) + '%'; }, 120));
        timers.push(setTimeout(() => {
          if (settled) return; settled = true;
          bot++; P[1].lastChild.textContent = bot; Sfx.bad();
          msg.textContent = `Bot got it: ${word.toUpperCase()}`;
          keyHandler = null;
          timers.push(setTimeout(nextRound, 1300));
        }, dur));
        let settled = false;
        board(host, word, () => { if (settled) return; settled = true; me++; P[0].lastChild.textContent = me; msg.textContent = pick(['Nice!', 'Quick!', 'Got it!', 'Beat it!']); keyHandler = null; clear(); timers.push(setTimeout(nextRound, 700)); });
      };
      const end = () => {
        const won = me > bot;
        const s = Stats.record('scramble', { win: won });
        won ? (Sfx.win(), celebrate()) : Sfx.lose();
        modal(won ? 'You win the race' : 'The bot wins', el('div', {}, el('p', {}, `${me} – ${bot}`), statRow(s, { best: 'high score' })), [{ label: 'Rematch', primary: true }]).then(v => v && start());
      };
      nextRound();
    }

    /** Online race: both sides get the same words and scrambles from a shared seed; the host referees who solved first. */
    function onlineRace() {
      const rng = seeded(link.seed + games++);
      const words = pool(rng);
      const score = [0, 0];
      let round = 0, settled = true;
      const names = link.me === 0 ? ['You', 'Friend'] : ['Friend', 'You'];
      const P = names.map(n => el('div', { class: 'player sk' + (n === 'You' ? ' turn' : '') }, el('div', { class: 'who' }, n), el('div', { class: 'pts' }, '0')));
      const msg = el('div', { class: 'msg' }, 'First to 5!');
      const host = el('div');
      stage.replaceChildren(el('div', { class: 'center' }, el('div', { class: 'scoreboard' }, P), msg, host));
      const award = (p, w) => {
        if (settled) return;
        settled = true; keyHandler = null;
        score[p]++; P[p].lastChild.textContent = score[p];
        if (p === link.me) { Sfx.good(); msg.textContent = pick(['Nice!', 'Quick!', 'Got it!', 'Beat it!']); } else { Sfx.bad(); msg.textContent = `Friend got it: ${w.toUpperCase()}`; }
        timers.push(setTimeout(() => { if (link?.open) link.ready(nextRound); }, 1000));
      };
      const nextRound = () => {
        if (score[0] >= 5 || score[1] >= 5) return end();
        const word = words[round++];
        settled = false;
        msg.textContent = 'First to 5!';
        board(host, word, w => {
          if (settled) return;
          if (link.host) { link.send('point', { p: 0, w }); award(0, w); } else { link.send('claim', { r: round, w }); keyHandler = null; msg.textContent = 'Checking...'; }
        }, rng);
      };
      if (link.host) link.on('claim', ({ r, w }) => { if (r === round && !settled) { link.send('point', { p: 1, w }); award(1, w); } });
      else link.on('point', ({ p, w }) => award(p, w));
      const end = () => {
        const won = score[link.me] > score[1 - link.me];
        Stats.record('scramble', { win: won });
        won ? (Sfx.win(), celebrate()) : Sfx.lose();
        if (link?.open) modal(won ? 'You win the race' : 'Friend wins the race', `You ${score[link.me]} – Friend ${score[1 - link.me]}`, [{ label: 'Rematch', primary: true }])
          .then(() => { if (link?.open) { msg.textContent = 'Waiting for your friend...'; link.ready(start); } });
      };
      nextRound();
    }

    function duel() {
      const scores = [0, 0];
      const names = ['Player 1', 'Player 2'];
      const words = pool();
      const P = names.map(n => el('div', { class: 'player sk' }, el('div', { class: 'who' }, n), el('div', { class: 'pts' }, '0')));
      const turn = p => {
        P.forEach((x, i) => x.classList.toggle('turn', i === p));
        const area = el('div', { class: 'center' });
        stage.replaceChildren(el('div', { class: 'center' }, el('div', { class: 'scoreboard' }, P), area));
        area.replaceChildren(el('div', { class: 'big' }, `${names[p]}, ready?`), el('p', { class: 'muted' }, '60 seconds. Pass the device!'),
          el('button', { class: 'btn btn-primary', onclick: go }, 'Go!'));
        function go() {
          const host = el('div');
          const clock = el('span', {}, '60');
          const bar = timerBar(60, s => clock.textContent = s, () => { keyHandler = null; clear(); Sfx.scratch(); p === 0 ? turn(1) : end(); });
          const next = () => board(host, words.pop(), (w, h) => { scores[p] += Math.round(pts(w) / (h ? 2 : 1)); P[p].lastChild.textContent = scores[p]; next(); });
          area.replaceChildren(el('div', {}, clock, 's'), bar, host, el('button', { class: 'btn', onclick: () => next() }, 'skip'));
          next();
        }
      };
      const end = () => {
        Sfx.win(); celebrate();
        const tie = scores[0] === scores[1];
        Stats.record('scramble', {});
        modal(tie ? "It's a tie" : `${names[scores[1] > scores[0] ? 1 : 0]} wins`, `${scores[0]} vs ${scores[1]}`, [{ label: 'Rematch', primary: true }]).then(v => v && start());
      };
      turn(0);
    }
    start();
  },
});
