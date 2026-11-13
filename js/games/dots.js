Games.register({
  id: 'dots',
  title: 'Dots & Boxes',
  blurb: 'The notebook-margin classic. Close a box, claim it, go again.',
  group: 'table',
  tags: ['vs bot', '2P', 'strategy'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><g class="fill" stroke="none"><circle cx="20" cy="12" r="3.5"/><circle cx="50" cy="12" r="3.5"/><circle cx="80" cy="12" r="3.5"/><circle cx="20" cy="42" r="3.5"/><circle cx="50" cy="42" r="3.5"/><circle cx="80" cy="42" r="3.5"/><circle cx="20" cy="72" r="3.5"/><circle cx="50" cy="72" r="3.5"/><circle cx="80" cy="72" r="3.5"/></g><path d="M20 12 H50 V42 H20 Z M50 42 H80 M80 42 V72"/><path d="M26 34 l18 -16 M26 24 l10 -8 M34 36 l10 -9" opacity=".7"/><path d="M96 50 l14 -14" /></svg>`,
  help: 'Take turns drawing a line between two neighbouring dots. Close the fourth side of a box and it is yours, and you move again. Most boxes wins. Tip: avoid drawing the third side of a box; that hands it to your opponent.',
  mount(root, signal) {
    let mode = 'bot', size = 4;
    const stage = el('div', { class: 'stage' });
    const sizeSel = el('select', { class: 'btn btn-ghost', onchange: e => { size = +e.target.value; start(); } },
      [3, 4, 5, 6].map(n => el('option', { value: n, selected: n === size }, `${n} x ${n} boxes`)));
    root.append(el('div', { class: 'center' }, el('div', { class: 'row' }, tabs([['bot', 'Vs Bot'], ['duel', 'Pass & Play']], mode, m => { mode = m; start(); }), sizeSel)), stage);

    function start() {
      const N = size, names = mode === 'bot' ? ['You', 'Bot'] : ['Player 1', 'Player 2'];
      const lines = new Map(); // key -> owner
      const boxes = new Map(); // "r,c" -> owner
      const all = [];
      for (let r = 0; r <= N; r++) for (let c = 0; c < N; c++) all.push(`h,${r},${c}`);
      for (let r = 0; r < N; r++) for (let c = 0; c <= N; c++) all.push(`v,${r},${c}`);
      const sides = (r, c) => [`h,${r},${c}`, `h,${r + 1},${c}`, `v,${r},${c}`, `v,${r},${c + 1}`];
      const boxesOf = k => { const [t, r, c] = k.split(','), R = +r, C = +c; return (t === 'h' ? [[R - 1, C], [R, C]] : [[R, C - 1], [R, C]]).filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N); };
      const count = (set, r, c) => sides(r, c).filter(s => set.has(s)).length;
      let turn = 0, last = null, busy = false, score = [0, 0];

      const G = 60, PAD = 30, W = PAD * 2 + G * N;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', `0 0 ${W} ${W}`); svg.setAttribute('class', 'dots-svg');
      const P = names.map(n => el('div', { class: 'player sk' }, el('div', { class: 'who' }, n), el('div', { class: 'pts' }, '0')));
      const msg = el('div', { class: 'msg' });
      stage.replaceChildren(el('div', { class: 'center' }, el('div', { class: 'scoreboard' }, P), msg, el('div', { class: 'panel sk', style: 'width:min(560px,100%)' }, svg)));

      const xy = k => { const [t, r, c] = k.split(','); const R = +r, C = +c; return t === 'h' ? [PAD + C * G, PAD + R * G, PAD + (C + 1) * G, PAD + R * G] : [PAD + C * G, PAD + R * G, PAD + C * G, PAD + (R + 1) * G]; };
      function render() {
        let s = '';
        for (const [k, o] of boxes) {
          const [r, c] = k.split(',').map(Number);
          const x = PAD + c * G + 6, y = PAD + r * G + 6, w = G - 12;
          const id = `hp${o}`;
          s += `<rect x="${x}" y="${y}" width="${w}" height="${w}" fill="url(#${id})" filter="url(#graphite)"/><text x="${x + w / 2}" y="${y + w / 2 + 8}" text-anchor="middle" font-family="Caveat" font-weight="700" font-size="26" fill="#2d2d31">${names[o][0]}</text>`;
        }
        for (const k of all) {
          const [x1, y1, x2, y2] = xy(k), o = lines.get(k);
          s += `<line class="hit" data-k="${k}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><line class="ln ${o == null ? 'free' : 'p' + o}${k === last ? ' last' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
        }
        for (let r = 0; r <= N; r++) for (let c = 0; c <= N; c++) s += `<circle class="dot" cx="${PAD + c * G}" cy="${PAD + r * G}" r="4.5"/>`;
        svg.innerHTML = `<defs>
          <pattern id="hp0" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#2d2d31" stroke-width="2.2" opacity=".55"/></pattern>
          <pattern id="hp1" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 0 L8 8 M8 0 L0 8" stroke="#4f4f56" stroke-width="1.2" opacity=".5"/></pattern></defs>${s}`;
        P.forEach((p, i) => { p.classList.toggle('turn', i === turn); p.lastChild.textContent = score[i]; });
        msg.textContent = boxes.size === N * N ? '' : mode === 'bot' && turn === 1 ? 'Bot is thinking...' : mode === 'bot' ? 'Your move' : `${names[turn]}'s move`;
      }

      function play(k) {
        if (lines.has(k)) return;
        lines.set(k, turn); last = k; Sfx.scratch();
        let got = 0;
        for (const [r, c] of boxesOf(k)) if (count(lines, r, c) === 4) { boxes.set(`${r},${c}`, turn); got++; }
        score[turn] += got;
        if (got) Sfx.good(); else turn = 1 - turn;
        render();
        if (boxes.size === N * N) return finish();
        if (mode === 'bot' && turn === 1) botTurn();
      }

      async function botTurn() {
        busy = true;
        await sleep(450 + Math.random() * 400);
        if (signal.aborted) return;
        busy = false;
        play(botChoose());
      }
      function botChoose() {
        const free = all.filter(k => !lines.has(k));
        const completes = (set, k) => boxesOf(k).filter(([r, c]) => count(set, r, c) === 3).length;
        const take = free.filter(k => completes(lines, k) > 0);
        if (take.length) return pick(take);
        const safe = free.filter(k => boxesOf(k).every(([r, c]) => count(lines, r, c) < 2));
        if (safe.length) return pick(safe);
        // Every move gives something away: give away the smallest chain.
        let best = null, bestCost = Infinity;
        for (const k of free) {
          const sim = new Set(lines.keys()); sim.add(k);
          let cost = 0, progress = true;
          while (progress) {
            progress = false;
            for (const m of all) if (!sim.has(m) && completes(sim, m)) { cost += completes(sim, m); sim.add(m); progress = true; }
          }
          if (cost < bestCost) { bestCost = cost; best = k; }
        }
        return best;
      }
      function finish() {
        const [a, b] = score, tie = a === b, w = a > b ? 0 : 1;
        const s = Stats.record('dots', { win: mode === 'bot' ? (tie ? undefined : w === 0) : undefined });
        (mode === 'duel' || (!tie && w === 0)) ? (Sfx.win(), celebrate()) : Sfx.lose();
        setTimeout(() => modal(tie ? 'Dead even' : `${names[w]} ${w === 0 && mode === 'bot' ? 'win' : 'wins'}!`, el('div', {}, el('p', {}, `${a} boxes to ${b}.`), mode === 'bot' ? statRow(s) : null),
          [{ label: 'New board', primary: true }]).then(v => v && start()), 500);
      }

      svg.addEventListener('click', e => {
        const k = e.target.dataset?.k;
        if (!k || busy || (mode === 'bot' && turn === 1)) return;
        play(k);
      });
      render();
    }
    start();
  },
});
