Games.register({
  id: 'sketchit',
  title: 'Sketch It',
  blurb: 'Draw a doodle from memory and get marked on accuracy, or draw a concept and let friends judge it.',
  group: 'button',
  tags: ['solo', '2-6P', 'drawing'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><rect x="14" y="8" width="62" height="62" rx="4"/><path d="M26 54 L44 26 L62 54 Z" opacity=".5"/><path d="M28 56 L45 28 L60 52 Z"/><path d="M84 66 L104 14 l8 3 L92 69 z M84 66 l4 -12"/></svg>`,
  help: 'From memory: a doodle appears for a few seconds, then vanishes. Redraw it in the same place and size, and press Done. You are marked on how much of the original you traced and how little stray pencil you added. Three doodles per game, each shown for less time. Concept: each artist gets a secret prompt and 60 seconds to draw it, then everyone else rates it out of 5 for likeness and 5 for creativity. Highest total after everyone has drawn wins.',
  mount(root, signal) {
    const S = 200; // logical drawing size
    const DOODLES = {
      house: 'M40 170 V90 L100 40 L160 90 V170 Z M85 170 V125 H115 V170',
      star: 'M100 25 L120 80 L178 80 L131 114 L149 170 L100 136 L51 170 L69 114 L22 80 L80 80 Z',
      fish: 'M30 100 Q90 40 150 100 Q90 160 30 100 Z M150 100 L180 70 L180 130 Z',
      cat: 'M50 110 A50 50 0 1 0 150 110 A50 50 0 1 0 50 110 M58 82 L62 40 L92 64 M142 82 L138 40 L108 64',
      tree: 'M100 25 L155 115 H45 Z M88 115 V172 H112 V115',
      sun: 'M72 100 A28 28 0 1 0 128 100 A28 28 0 1 0 72 100 M100 25 V52 M100 148 V175 M25 100 H52 M148 100 H175 M47 47 L66 66 M134 134 L153 153 M153 47 L134 66 M47 153 L66 134',
      heart: 'M100 170 C20 110 40 40 100 75 C160 40 180 110 100 170 Z',
      boat: 'M28 130 H172 L145 165 H55 Z M100 130 V35 L152 115 H100',
      envelope: 'M28 55 H172 V150 H28 Z M28 55 L100 112 L172 55',
      umbrella: 'M25 100 Q100 15 175 100 Z M100 100 V160 Q100 178 82 170',
      mushroom: 'M30 105 Q100 20 170 105 Z M78 105 V165 H122 V105',
      cup: 'M50 60 H140 L130 165 H60 Z M140 85 Q178 90 168 125 Q160 140 134 135',
      rocket: 'M100 20 Q140 60 130 140 H70 Q60 60 100 20 Z M70 120 L45 160 L72 145 M130 120 L155 160 L128 145 M88 75 A12 12 0 1 0 112 75 A12 12 0 1 0 88 75',
      snail: 'M40 150 H160 M100 150 A40 40 0 1 1 100 70 A28 28 0 1 1 100 126 A14 14 0 1 1 100 98 M150 150 Q175 125 160 100 M160 100 L152 80 M160 100 L172 82',
    };
    const CONCEPTS = ['a haunted toaster', 'the world\'s laziest superhero', 'a cat that is also a cloud', 'Monday morning', 'a dragon at the dentist', 'a very fast snail', 'the sound of thunder', 'a robot learning to dance', 'a castle made of sweets', 'a fish riding a bike', 'happiness', 'a tiny giant', 'the last slice of pizza', 'a volcano on holiday', 'a shy ghost', 'a tree that grows socks', 'homework eating a dog', 'an alien\'s first day at school', 'a penguin in the desert', 'time running out', 'a grumpy sun', 'a bus full of ducks', 'a moon made of cheese', 'a wizard\'s untidy bedroom', 'an octopus doing chores', 'a dinosaur in a tiny car', 'a sandwich with feelings', 'the scariest pencil', 'a snowman in summer', 'a dog\'s dream'];
    let mode = 'memory';
    const stage = el('div', { class: 'stage' });
    root.append(el('div', { class: 'center' }, tabs([['memory', 'From memory'], ['concept', 'Concept (judged)']], mode, m => { mode = m; start(); })), stage);
    function start() { mode === 'memory' ? memory() : conceptSetup(); }

    /** A pencil canvas: pointer drawing with undo; strokes kept in logical 0..S coords. */
    function pad() {
      const c = el('canvas', { class: 'bt-draw sk' });
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = c.height = S * 2 * dpr;
      const ctx = c.getContext('2d');
      ctx.scale(2 * dpr, 2 * dpr);
      const strokes = []; let cur = null, guide = null, locked = false;
      const at = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * S, (e.clientY - r.top) / r.height * S]; };
      const draw = () => {
        ctx.clearRect(0, 0, S, S);
        ctx.lineCap = ctx.lineJoin = 'round';
        if (guide) { ctx.strokeStyle = guide.color; ctx.lineWidth = 3; ctx.stroke(new Path2D(guide.d)); }
        ctx.strokeStyle = 'rgba(45,45,49,.9)'; ctx.lineWidth = 2.6;
        for (const s of strokes) { ctx.beginPath(); s.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); if (s.length === 1) ctx.lineTo(s[0][0] + .1, s[0][1]); ctx.stroke(); }
      };
      c.addEventListener('pointerdown', e => { if (locked) return; e.preventDefault(); try { c.setPointerCapture(e.pointerId); } catch {} cur = [at(e)]; strokes.push(cur); draw(); }, { signal });
      c.addEventListener('pointermove', e => { if (!cur) return; cur.push(at(e)); draw(); }, { signal });
      const up = () => { if (cur) Sfx.tap(); cur = null; };
      c.addEventListener('pointerup', up, { signal }); c.addEventListener('pointercancel', up, { signal });
      return {
        el: c, strokes, draw,
        set guide(g) { guide = g; draw(); },
        set locked(v) { locked = v; },
        undo() { strokes.pop(); draw(); },
        clear() { strokes.length = 0; draw(); },
        snapshot() { const img = el('canvas', { class: 'sk', width: S * 2, height: S * 2 }); img.getContext('2d').drawImage(c, 0, 0, S * 2, S * 2); return img; },
      };
    }
    const tools = p => el('div', { class: 'row' }, el('button', { class: 'btn btn-ghost', onclick: () => p.undo() }, 'undo'), el('button', { class: 'btn btn-ghost', onclick: () => p.clear() }, 'clear'));

    /** Accuracy: F-score of (reference covered by your lines) and (your lines near the reference), on a 100px grid. */
    function mark(d, strokes) {
      const N = 100, k = N / S;
      const mask = (fn, w) => {
        const cv = new OffscreenCanvas(N, N), x = cv.getContext('2d');
        x.scale(k, k); x.lineCap = x.lineJoin = 'round'; x.lineWidth = w; x.strokeStyle = '#000'; fn(x);
        const a = x.getImageData(0, 0, N, N).data, out = new Uint8Array(N * N);
        for (let i = 0; i < out.length; i++) out[i] = a[i * 4 + 3] > 40 ? 1 : 0;
        return out;
      };
      const ref = x => x.stroke(new Path2D(d));
      const you = x => { for (const s of strokes) { x.beginPath(); s.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); if (s.length === 1) x.lineTo(s[0][0] + .1, s[0][1]); x.stroke(); } };
      const rThin = mask(ref, 3), rFat = mask(ref, 22), yThin = mask(you, 3), yFat = mask(you, 22);
      let rt = 0, rh = 0, yt = 0, yh = 0;
      for (let i = 0; i < N * N; i++) { if (rThin[i]) { rt++; if (yFat[i]) rh++; } if (yThin[i]) { yt++; if (rFat[i]) yh++; } }
      if (!yt) return 0;
      const R = rh / rt, P = yh / yt;
      return R + P ? Math.round(100 * 2 * P * R / (P + R)) : 0;
    }

    function memory() {
      const picks = shuffle(Object.keys(DOODLES)).slice(0, 3), SHOW = [5, 4, 3], marks = [];
      let round = 0;
      const p = pad();
      const msg = el('div', { class: 'msg' });
      const done = el('button', { class: 'btn btn-primary', onclick: submit }, 'Done');
      const ctl = el('div', { class: 'row' }, tools(p), done);
      stage.replaceChildren(el('div', { class: 'center' }, msg, p.el, ctl));
      async function show() {
        const name = picks[round];
        p.clear(); p.locked = true; done.disabled = true;
        for (let t = SHOW[round]; t > 0; t--) {
          msg.textContent = `Doodle ${round + 1}/3: memorise the ${name}... ${t}`;
          p.guide = { d: DOODLES[name], color: 'rgba(45,45,49,.9)' };
          await sleep(1000); if (signal.aborted) return;
        }
        p.guide = null; p.locked = false; done.disabled = false; Sfx.scratch();
        msg.textContent = `Now draw the ${name} from memory`;
      }
      async function submit() {
        if (!p.strokes.length) return toast('Draw something first!');
        const name = picks[round], m = mark(DOODLES[name], p.strokes);
        marks.push(m); p.locked = true; done.disabled = true;
        p.guide = { d: DOODLES[name], color: 'rgba(138,59,59,.55)' };
        msg.textContent = `${name}: ${m}% ${m >= 80 ? '(brilliant!)' : m >= 60 ? '(nice)' : m >= 40 ? '(sort of)' : '(abstract art?)'}`;
        m >= 60 ? Sfx.good() : Sfx.bad();
        await sleep(2200); if (signal.aborted) return;
        if (++round < 3) return show();
        const total = Math.round(marks.reduce((a, b) => a + b, 0) / 3);
        const s = Stats.record('sketchit', { score: total });
        msg.textContent = `Average accuracy ${total}%${s.newBest ? ' · new best!' : ''} (${marks.join('% · ')}%)`;
        total >= 70 ? (Sfx.win(), celebrate()) : Sfx.tap();
        ctl.replaceChildren(el('button', { class: 'btn btn-primary', onclick: memory }, 'Play again'));
      }
      show();
    }

    function conceptSetup() {
      let n = 3;
      const count = el('div', { class: 'big' });
      const draw = () => (count.textContent = `${n} players`);
      stage.replaceChildren(el('div', { class: 'center panel sk', style: 'max-width:440px;margin:0 auto' },
        el('p', { class: 'muted', style: 'margin:0;text-align:center' }, 'Pass the device around. Each player draws once; everyone else judges.'),
        count,
        el('div', { class: 'row' }, el('button', { class: 'btn', onclick: () => { n = Math.max(2, n - 1); draw(); } }, '−'), el('button', { class: 'btn', onclick: () => { n = Math.min(6, n + 1); draw(); } }, '+')),
        el('button', { class: 'btn btn-primary', onclick: () => concept(n) }, 'Start')));
      draw();
    }

    function concept(n) {
      const names = Array.from({ length: n }, (_, i) => `Player ${i + 1}`), totals = Array(n).fill(0);
      const prompts = shuffle([...CONCEPTS]);
      let artist = 0;
      const turn = () => {
        const prompt = prompts[artist];
        stage.replaceChildren(el('div', { class: 'center panel sk', style: 'max-width:460px;margin:0 auto' },
          el('div', { class: 'big' }, `${names[artist]}, you're up`), el('p', { class: 'muted' }, 'Everyone else look away while the prompt is shown.'),
          el('button', { class: 'btn btn-primary', onclick: () => drawIt(prompt) }, 'Show my prompt')));
      };
      function drawIt(prompt) {
        const p = pad();
        let left = 60;
        const timer = el('div', { class: 'msg' });
        const finish = () => { clearInterval(tick); judge(prompt, p); };
        const tick = setInterval(() => { if (signal.aborted) return clearInterval(tick); left--; timer.textContent = `Draw: ${prompt} · ${left}s`; if (left <= 0) finish(); }, 1000);
        timer.textContent = `Draw: ${prompt} · ${left}s`;
        stage.replaceChildren(el('div', { class: 'center' }, timer, p.el, el('div', { class: 'row' }, tools(p), el('button', { class: 'btn btn-primary', onclick: finish }, 'Finished'))));
        Sfx.scratch();
      }
      function judge(prompt, p) {
        p.locked = true;
        const judges = names.map((_, i) => i).filter(i => i !== artist);
        let j = 0, sum = 0;
        const box = el('div', { class: 'center' });
        stage.replaceChildren(el('div', { class: 'center' }, el('div', { class: 'big' }, `"${prompt}"`), el('div', { class: 'muted' }, `by ${names[artist]}`), p.el, box));
        const stars = (label, on) => {
          let v = 0;
          const row = el('div', { class: 'bt-stars' });
          const paint = () => row.replaceChildren(...[1, 2, 3, 4, 5].map(i => el('button', { 'aria-label': `${i} stars`, onclick: () => { v = i; Sfx.tap(); paint(); on(i); } }, i <= v ? '★' : '☆')));
          paint();
          return el('div', { class: 'row' }, el('span', { style: 'min-width:90px' }, label), row);
        };
        const ask = () => {
          let a = 0, b = 0;
          const ok = el('button', { class: 'btn btn-primary', disabled: true, onclick: () => { sum += a + b; j++; Sfx.scratch(); j < judges.length ? ask() : reveal(); } }, 'Submit score');
          const check = () => (ok.disabled = !(a && b));
          box.replaceChildren(el('div', { class: 'msg' }, `${names[judges[j]]} judges`), stars('Likeness', v => { a = v; check(); }), stars('Creativity', v => { b = v; check(); }), ok);
        };
        const reveal = () => {
          const avg = Math.round(sum / judges.length * 10) / 10;
          totals[artist] += avg; Sfx.good();
          box.replaceChildren(el('div', { class: 'big' }, `${avg} / 10`),
            el('button', { class: 'btn btn-primary', onclick: () => (++artist < n ? turn() : results()) }, artist + 1 < n ? 'Next artist' : 'Results'));
        };
        ask();
      }
      function results() {
        const best = Math.max(...totals), winners = names.filter((_, i) => totals[i] === best);
        Stats.record('sketchit', {});
        Sfx.win(); celebrate();
        stage.replaceChildren(el('div', { class: 'center panel sk', style: 'max-width:440px;margin:0 auto' },
          el('div', { class: 'big' }, `${winners.join(' & ')} win${winners.length > 1 ? '' : 's'}!`),
          ...names.map((nm, i) => el('div', {}, `${nm}: ${Math.round(totals[i] * 10) / 10}`)),
          el('button', { class: 'btn btn-primary', onclick: () => concept(n) }, 'Play again')));
      }
      turn();
    }
    start();
  },
});
