Games.register({
  id: 'mathsprint',
  title: 'Mental Maths',
  blurb: 'Sums scrawled on the board. Type answers fast; they get harder as you go.',
  group: 'button',
  tags: ['solo', 'text', 'timed'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M18 28 h16 M26 20 v16 M46 28 h14 M74 22 h14 M74 32 h14 M18 56 l12 12 M30 56 l-12 12 M46 62 h14 M53 56 v1 M53 68 v1"/><path d="M80 50 c10 -6 20 4 10 12 l-10 8 h18"/></svg>`,
  help: '60 seconds. Type the answer and press Enter. Every 5 correct answers the numbers get bigger and new operations join in. A wrong answer costs 3 seconds.',
  mount(root, signal) {
    const stage = el('div', { class: 'stage' });
    root.append(stage);
    function start() {
      let score = 0, left = 60, ans = 0, over = false;
      const q = el('div', { class: 'big' });
      const timer = el('div', { class: 'msg' });
      const input = el('input', { class: 'input', type: 'text', inputmode: 'numeric', autocomplete: 'off', style: 'text-align:center;width:140px' });
      stage.replaceChildren(el('div', { class: 'center panel sk', style: 'max-width:440px;margin:0 auto' }, timer, q, el('form', { onsubmit: submit }, input)));
      const next = () => {
        const lvl = Math.floor(score / 5), top = 10 + lvl * 8;
        const op = pick(lvl < 1 ? ['+', '-'] : lvl < 3 ? ['+', '-', '×'] : ['+', '-', '×', '÷']);
        let a = 1 + rand(top), b = 1 + rand(top);
        if (op === '×') { a = 2 + rand(Math.min(12, 4 + lvl * 2)); b = 2 + rand(12); }
        if (op === '÷') { b = 2 + rand(11); a = b * (1 + rand(12)); }
        if (op === '-' && b > a) [a, b] = [b, a];
        ans = op === '+' ? a + b : op === '-' ? a - b : op === '×' ? a * b : a / b;
        q.textContent = `${a} ${op} ${b}`;
      };
      const draw = () => (timer.textContent = `${Math.max(0, left)}s · ${score} right`);
      const tick = setInterval(() => { if (signal.aborted) return clearInterval(tick); left--; draw(); if (left <= 0) end(); }, 1000);
      function submit(e) {
        e.preventDefault();
        if (over || input.value.trim() === '') return;
        if (+input.value === ans) { score++; Sfx.good(); next(); }
        else { left -= 3; Sfx.bad(); q.classList.add('shake'); setTimeout(() => q.classList.remove('shake'), 400); if (left <= 0) end(); }
        input.value = ''; draw();
      }
      function end() {
        if (over) return;
        clearInterval(tick); over = true; input.disabled = true;
        const s = Stats.record('mathsprint', { score });
        Sfx.win(); if (s.newBest) celebrate();
        q.textContent = `${score} correct`;
        timer.textContent = s.newBest ? 'New best!' : `Best: ${s.best}`;
        stage.firstChild.append(el('button', { class: 'btn btn-primary', onclick: start }, 'Again'));
      }
      next(); draw(); input.focus();
    }
    start();
  },
});
