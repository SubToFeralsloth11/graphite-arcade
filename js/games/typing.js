Games.register({
  id: 'typing',
  title: 'Speed Scribe',
  blurb: 'Copy the line as fast as you can. Words per minute, written in pencil.',
  group: 'button',
  tags: ['solo', 'text', 'race'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><rect x="14" y="30" width="92" height="40" rx="6"/><path d="M24 42 h8 M38 42 h8 M52 42 h8 M66 42 h8 M80 42 h8 M30 56 h60"/><path d="M60 26 L74 6 l6 4 L66 28 z"/></svg>`,
  help: 'Type the sentence shown, exactly. Letters turn dark when right and get crossed out when wrong. Finish three lines; score is your words per minute (with mistakes left uncorrected costing a word each).',
  mount(root, signal) {
    const LINES = [
      'the quick brown fox jumps over the lazy dog',
      'a sharp pencil is worth more than a blunt pen',
      'doodles in the margin are the best part of class',
      'never trust a ruler that has been chewed on',
      'the eraser wore out long before the pencil did',
      'some homework was eaten by an actual dog today',
      'draw a line then draw another one next to it',
      'paper planes fly further when you fold them twice',
      'the teacher said to stop drawing and kept watching',
      'every notebook ends with a page of tiny cubes',
      'lead pencils have never had any lead in them',
      'a snail on a skateboard is still fairly slow',
    ];
    const stage = el('div', { class: 'stage' });
    root.append(stage);
    function start() {
      const lines = shuffle([...LINES]).slice(0, 3);
      let li = 0, t0 = 0, chars = 0, errors = 0;
      const target = el('div', { class: 'bt-type' });
      const input = el('input', { class: 'input bt-plain', autocomplete: 'off', spellcheck: 'false', placeholder: 'start typing...', style: 'width:min(560px,90vw)' });
      const msg = el('div', { class: 'msg' }, 'Line 1 of 3');
      stage.replaceChildren(el('div', { class: 'center' }, msg, target, input));
      const draw = () => {
        const v = input.value, L = lines[li];
        target.replaceChildren(...[...L].map((c, i) => el('span', { class: i >= v.length ? '' : v[i] === c ? 'ok' : 'bad' }, c)));
      };
      input.addEventListener('input', () => {
        if (!t0) t0 = performance.now();
        Sfx.tap();
        draw();
        const L = lines[li];
        if (input.value.length >= L.length) {
          chars += L.length;
          for (let i = 0; i < L.length; i++) if (input.value[i] !== L[i]) errors++;
          li++; input.value = '';
          if (li >= lines.length) return done();
          msg.textContent = `Line ${li + 1} of 3`; draw();
        }
      });
      function done() {
        const mins = (performance.now() - t0) / 60000;
        const wpm = Math.max(0, Math.round((chars / 5 - errors) / mins));
        const s = Stats.record('typing', { score: wpm });
        input.disabled = true; Sfx.win(); if (s.newBest) celebrate();
        msg.textContent = `${wpm} WPM · ${errors} mistake${errors === 1 ? '' : 's'}${s.newBest ? ' · new best!' : ''}`;
        target.replaceChildren(el('button', { class: 'btn btn-primary', onclick: start }, 'Again'));
      }
      draw(); input.focus();
    }
    start();
  },
});
