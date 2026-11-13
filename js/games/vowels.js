Games.register({
  id: 'vowels',
  title: 'Vowel Thief',
  blurb: 'Someone rubbed out all the vowels. Type the word back before the timer runs dry.',
  group: 'button',
  tags: ['solo', 'text', 'timed'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M12 40 h14 M34 40 h14 M56 40 h14"/><text x="12" y="34" font-size="22">B</text><text x="56" y="34" font-size="22">N</text><path d="M80 52 l20 -20 l10 10 l-20 20 z M80 52 l10 10"/></svg>`,
  help: 'You see a word with its vowels (A E I O U) removed, like "PNCL". Type the full word and press Enter. 60 seconds; each correct word scores 1 point per letter. Press Enter on an empty box to skip.',
  mount(root, signal) {
    const stage = el('div', { class: 'stage' });
    root.append(stage);
    const pool = [...LISTS.five, ...LISTS.long].filter(w => w.replace(/[aeiou]/g, '').length >= 3);
    function start() {
      let score = 0, left = 60, word = '', over = false;
      const clue = el('div', { class: 'big', style: 'letter-spacing:6px' });
      const timer = el('div', { class: 'msg' });
      const input = el('input', { class: 'input', autocomplete: 'off', spellcheck: 'false', placeholder: 'full word', style: 'text-align:center' });
      const log = el('div', { class: 'bt-log' });
      stage.replaceChildren(el('div', { class: 'center panel sk', style: 'max-width:520px;margin:0 auto' }, timer, clue, el('form', { onsubmit: submit }, input), log));
      const next = () => { word = pick(pool); clue.textContent = word.replace(/[aeiou]/g, '').toUpperCase(); };
      const tick = setInterval(() => {
        if (signal.aborted) return clearInterval(tick);
        left--; draw();
        if (left <= 0) end();
      }, 1000);
      const draw = () => (timer.textContent = `${left}s · ${score} pts`);
      function submit(e) {
        e.preventDefault();
        if (over) return;
        const v = input.value.trim().toLowerCase(); input.value = '';
        const skel = s => s.replace(/[aeiou]/g, '');
        if (!v) { log.prepend(el('span', { class: 'chip', style: 'text-decoration:line-through' }, word)); next(); return; }
        // Any real word with the same consonant skeleton counts.
        if (v === word || (skel(v) === skel(word) && Dict.has(v))) { score += v.length; Sfx.good(); log.prepend(el('span', { class: 'chip' }, v)); next(); }
        else { Sfx.bad(); input.classList.add('shake'); setTimeout(() => input.classList.remove('shake'), 400); }
        draw();
      }
      function end() {
        clearInterval(tick); over = true; input.disabled = true;
        const s = Stats.record('vowels', { score });
        Sfx.win(); if (s.newBest) celebrate();
        clue.textContent = `${score} points`;
        timer.textContent = `Time! The last one was ${word.toUpperCase()}.${s.newBest ? ' New best!' : ''}`;
        log.before(el('button', { class: 'btn btn-primary', onclick: start }, 'Again'));
      }
      next(); draw(); input.focus();
    }
    start();
  },
});
