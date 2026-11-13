Games.register({
  id: 'ladder',
  title: 'Word Ladder',
  blurb: 'Climb from one word to another, changing a single letter each step.',
  group: 'word',
  tags: ['daily', 'puzzle'],
  daily: true,
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M40 76 L48 4 M80 76 L72 4 M42 62 h36 M44 46 h33 M46 30 h29 M47 15 h27"/><path d="M92 20 c8 -6 16 -2 18 6" /><path d="M8 66 c6 -8 14 -8 20 0"/></svg>`,
  help: 'Get from the top word to the goal word. Each step changes exactly one letter and must be a real word. "Par" is the shortest route I know. Hints reveal the next word on a shortest path from where you are.',
  mount(root, signal) {
    let mode = 'daily', keyHandler = null;
    const stage = el('div', { class: 'stage' });
    root.append(el('div', { class: 'center' }, tabs([['daily', 'Daily'], ['random', 'Random']], mode, m => { mode = m; start(); })), stage);
    onKeys(signal, k => keyHandler && keyHandler(k));

    const oneOff = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++d > 1) return false; return d === 1; };
    const neighbors = (w, set) => {
      const out = [];
      for (let i = 0; i < w.length; i++) for (let c = 97; c < 123; c++) {
        const ch = String.fromCharCode(c); if (ch === w[i]) continue;
        const n = w.slice(0, i) + ch + w.slice(i + 1); if (set.has(n)) out.push(n);
      }
      return out;
    };
    const COMMON = new Set(LISTS.four);
    const ALL4 = new Set(Dict.ofLen(4));
    function bfs(from, to, set) {
      const prev = new Map([[from, null]]), q = [from];
      while (q.length) {
        const w = q.shift();
        if (w === to) { const path = []; for (let x = to; x; x = prev.get(x)) path.unshift(x); return path; }
        for (const n of neighbors(w, set)) if (!prev.has(n)) { prev.set(n, w); q.push(n); }
      }
      return null;
    }
    function makePuzzle(rng) {
      for (let tries = 0; tries < 200; tries++) {
        const a = pick(LISTS.four, rng);
        // BFS out through common words, pick a target 3..5 steps away
        const dist = new Map([[a, 0]]), q = [a], far = [];
        while (q.length) {
          const w = q.shift(), d = dist.get(w);
          if (d >= 3 && d <= 5) far.push(w);
          if (d >= 5) continue;
          for (const n of neighbors(w, COMMON)) if (!dist.has(n)) { dist.set(n, d + 1); q.push(n); }
        }
        if (far.length) { const b = pick(far, rng); return { a, b, par: bfs(a, b, COMMON).length - 1 }; }
      }
      return { a: 'cold', b: 'warm', par: 4 };
    }

    function start() {
      const p = makePuzzle(mode === 'daily' ? dailyRng(2) : Math.random);
      play(p);
    }

    function play({ a, b, par }) {
      const saveKey = mode === 'daily' ? `ladder:${todayKey()}` : null;
      let chain = saveKey ? Store.get(saveKey, [a]) : [a];
      let cur = '', hints = 0, done = false;
      const ladder = el('div', { class: 'ladder' });
      const info = el('div', { class: 'row', style: 'justify-content:center' });
      const kb = keyboard(k => keyHandler(k));
      stage.replaceChildren(el('div', { class: 'center' }, info, ladder,
        el('div', { class: 'row' },
          el('button', { class: 'btn btn-ghost', onclick: () => { if (done || chain.length < 2) return; chain.pop(); save(); Sfx.scratch(); render(); } }, 'undo step'),
          el('button', { class: 'btn btn-ghost', onclick: hint }, 'hint'),
          el('button', { class: 'btn btn-ghost', onclick: () => { if (done) return; chain = [a]; save(); render(); } }, 'restart')),
        kb.el));
      const save = () => saveKey && Store.set(saveKey, chain);
      const rung = (w, prev, cls = '') => el('div', { class: 'rung ' + cls }, [...w.padEnd(4)].map((c, i) => el('div', { class: 'tile' + (c.trim() ? ' filled' : '') + (prev && prev[i] !== c && c.trim() ? ' changed' : '') }, c)));
      function render() {
        const last = chain[chain.length - 1];
        info.replaceChildren(el('span', { class: 'chip' }, `par ${par}`), el('span', { class: 'chip' }, `steps ${chain.length - 1}`), hints ? el('span', { class: 'chip' }, `hints ${hints}`) : null);
        ladder.replaceChildren(...chain.map((w, i) => rung(w, chain[i - 1])), done ? null : rung(cur, null, 'entry'), done ? null : rung(b, last, 'goal'));
      }
      function hint() {
        if (done) return;
        const path = bfs(chain[chain.length - 1], b, COMMON) || bfs(chain[chain.length - 1], b, ALL4);
        if (!path) return toast('No route from here, try undo');
        hints++; cur = path[1]; Sfx.scratch(); render();
      }
      keyHandler = k => {
        if (done) return;
        if (k === 'back') { cur = cur.slice(0, -1); render(); }
        else if (/^[a-z]$/.test(k) && cur.length < 4) { cur += k; Sfx.tap(); render(); }
        else if (k === 'enter') submit();
      };
      function submit() {
        const last = chain[chain.length - 1];
        const shake = m => { toast(m); Sfx.bad(); const r = $('.rung.entry', ladder); r && r.classList.add('shake'); };
        if (cur.length < 4) return shake('Four letters please');
        if (!oneOff(cur, last)) return shake('Change exactly one letter');
        if (!ALL4.has(cur)) return shake('Not a word I know');
        if (chain.includes(cur)) return shake('Already on the ladder');
        chain.push(cur); cur = ''; save(); Sfx.good();
        if (chain[chain.length - 1] === b) win(true);
        else if (oneOff(chain[chain.length - 1], b)) { chain.push(b); save(); win(true); }
        render();
      }
      function win(fresh) {
        done = true; keyHandler = null;
        const steps = chain.length - 1;
        if (!fresh) return;
        const s = Stats.record('ladder', { win: true, score: steps - par, best: 'low' });
        if (mode === 'daily') Stats.markDaily('ladder', `${steps} steps`);
        Sfx.win(); celebrate();
        const verdict = steps <= par ? (steps < par ? 'Under par?! Wizard.' : 'Right on par. Perfect climb.') : `${steps - par} over par.`;
        setTimeout(() => modal('Made it to the top', el('div', {}, el('p', {}, `${steps} steps. ${verdict}${hints ? ` (${hints} hints)` : ''}`), statRow(s, { best: 'best vs par' })),
          [{ label: 'New ladder', primary: true }]).then(v => { if (v) { if (mode === 'daily') root.querySelector('.tab:nth-child(2)').click(); else start(); } }), 600);
      }
      if (chain[chain.length - 1] === b) win(false);
      render();
    }
    start();
  },
});
