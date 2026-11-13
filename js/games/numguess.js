Games.register({
  id: 'numguess',
  title: 'Higher, Lower',
  blurb: 'Guess the number in your head of the bot, or make the bot guess yours. Type it in.',
  group: 'button',
  tags: ['vs bot', 'text', 'quick'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M30 60 L46 20 L56 60 M36 46 h16"/><path d="M70 30 l10 -12 l10 12 M80 18 v44 M70 50 l10 12 l10 -12"/></svg>`,
  help: 'You guess: the bot picks 1-100 and says higher or lower after each typed guess. Bot guesses: think of a number 1-100 and press Higher, Lower or Correct. The bot catches liars.',
  mount(root, signal) {
    let mode = 'you';
    const stage = el('div', { class: 'stage' });
    root.append(el('div', { class: 'center' }, tabs([['you', 'You guess'], ['bot', 'Bot guesses']], mode, m => { mode = m; start(); })), stage);
    function start() { mode === 'you' ? youGuess() : botGuess(); }

    function youGuess() {
      const secret = 1 + rand(100);
      let tries = 0, done = false;
      const msg = el('div', { class: 'big' }, '1 – 100');
      const log = el('div', { class: 'bt-log' });
      const input = el('input', { class: 'input', type: 'number', min: 1, max: 100, placeholder: 'your guess', style: 'width:140px;text-align:center' });
      const submit = e => {
        e.preventDefault();
        const g = Math.round(+input.value); input.value = ''; input.focus();
        if (done || !(g >= 1 && g <= 100)) return toast('A number from 1 to 100');
        tries++;
        if (g === secret) {
          done = true; Sfx.win(); celebrate();
          const s = Stats.record('numguess', { win: true, score: tries, best: 'low' });
          msg.textContent = `${g}! Got it in ${tries}${s.newBest ? ' (new best)' : ''}`;
          stage.append(el('div', { class: 'center' }, el('button', { class: 'btn btn-primary', onclick: start }, 'Again')));
        } else {
          Sfx.tap(); msg.textContent = g < secret ? `Higher than ${g}` : `Lower than ${g}`;
          log.prepend(el('span', { class: 'chip' }, `${g} ${g < secret ? '↑' : '↓'}`));
        }
      };
      stage.replaceChildren(el('div', { class: 'center panel sk', style: 'max-width:440px;margin:0 auto' }, msg, el('form', { class: 'row', onsubmit: submit }, input, el('button', { class: 'btn' }, 'Guess')), log));
      input.focus();
    }

    function botGuess() {
      let lo = 1, hi = 100, tries = 0, g = 0;
      const msg = el('div', { class: 'big' });
      const sub = el('div', { class: 'muted' }, 'Think of a number from 1 to 100.');
      const btns = el('div', { class: 'row' },
        el('button', { class: 'btn', onclick: () => answer('hi') }, 'Higher'),
        el('button', { class: 'btn btn-primary', onclick: () => answer('ok') }, 'Correct!'),
        el('button', { class: 'btn', onclick: () => answer('lo') }, 'Lower'));
      stage.replaceChildren(el('div', { class: 'center panel sk', style: 'max-width:440px;margin:0 auto' }, sub, msg, btns));
      const ask = () => { g = Math.floor((lo + hi) / 2); tries++; msg.textContent = `Is it ${g}?`; };
      const end = text => { btns.replaceChildren(el('button', { class: 'btn btn-primary', onclick: start }, 'Again')); sub.textContent = text; };
      function answer(a) {
        Sfx.tap();
        if (a === 'ok') { Stats.record('numguess', {}); msg.textContent = `${g}!`; return end(`Bot got it in ${tries} guesses.`); }
        if (a === 'hi') lo = g + 1; else hi = g - 1;
        if (lo > hi) { Sfx.bad(); msg.textContent = 'Hmm.'; return end('That does not add up. Did you change your number?'); }
        ask();
      }
      ask();
    }
    start();
  },
});
