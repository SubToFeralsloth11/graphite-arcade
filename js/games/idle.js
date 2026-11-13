Games.register({
  id: 'idle',
  title: 'Doodle Factory',
  blurb: 'Click to doodle, hire helpers, and grow a sketch empire while you are away.',
  group: 'arcade',
  tags: ['solo', 'idle', 'saves'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M20 66 L84 14 l10 10 L30 76 L16 78 Z M84 14 l6 -5 l10 10 l-6 5 M24 70 l6 6"/><path d="M60 70 h46 M70 60 h36 M80 50 h26" stroke-dasharray="5 4"/><path d="M8 20 l6 0 M11 17 v6 M100 40 l5 0 M102 37 v6"/></svg>`,
  help: 'Click the big pencil to draw doodles. Spend doodles on helpers that draw for you every second, and on upgrades that boost clicks and helpers. Your factory keeps working (at half speed, up to 8 hours) while you are away. Once you have drawn a million doodles in one run you can Graduate: start over, but every gold star you earn makes everything 10% faster forever.',
  mount(root, signal) {
    const HELPERS = [
      ['kid', 'Doodling kid', 15, .1, 'scribbles in the margins'],
      ['student', 'Bored student', 100, 1, 'should be taking notes'],
      ['artist', 'Sketch artist', 1100, 8, 'draws a cat in 4 lines'],
      ['studio', 'Comic studio', 12000, 47, 'panels by the dozen'],
      ['press', 'Printing press', 130000, 260, 'stamps doodles flat'],
      ['school', 'Art school', 1.4e6, 1400, 'graduates more doodlers'],
      ['robot', 'Pencil robot', 2e7, 7800, 'never needs sharpening'],
      ['moon', 'Moon base', 3.3e8, 44000, 'doodles in low gravity'],
    ];
    const UPGRADES = [
      ['sharp1', 'Sharper pencil', 'clicks ×2', 100, s => s.total >= 50, { click: 2 }],
      ['eraser', 'Pink eraser', 'kids ×2', 500, s => s.owned.kid >= 10, { kid: 2 }],
      ['sharp2', 'Mechanical pencil', 'clicks ×2', 5000, s => s.total >= 3000, { click: 2 }],
      ['coffee', 'Coffee for students', 'students ×2', 5000, s => s.owned.student >= 10, { student: 2 }],
      ['ruler', 'Steel ruler', 'artists ×2', 50000, s => s.owned.artist >= 10, { artist: 2 }],
      ['lead', '2B lead', 'everything ×1.5', 1e5, s => s.total >= 5e4, { all: 1.5 }],
      ['clickpct', 'Inspired hand', 'clicks also add 1% of /sec', 2e5, s => s.total >= 1e5, { clickPct: .01 }],
      ['ink', 'Ink pens', 'studios ×2', 6e5, s => s.owned.studio >= 10, { studio: 2 }],
      ['rollers', 'Faster rollers', 'presses ×2', 6e6, s => s.owned.press >= 10, { press: 2 }],
      ['charcoal', 'Charcoal sticks', 'everything ×2', 2e7, s => s.total >= 1e7, { all: 2 }],
      ['tenure', 'Tenure', 'schools ×2', 7e7, s => s.owned.school >= 10, { school: 2 }],
      ['ai', 'Robot upgrade', 'robots ×2', 1e9, s => s.owned.robot >= 10, { robot: 2 }],
    ];
    const KEY = 'idle:save';
    const fresh = stars => ({ doodles: 0, total: 0, run: 0, clicks: 0, owned: Object.fromEntries(HELPERS.map(h => [h[0], 0])), ups: [], stars: stars || 0, last: Date.now() });
    let s = Object.assign(fresh(), Store.get(KEY, {}));
    s.owned = Object.assign(fresh().owned, s.owned);

    const fmt = n => {
      if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1) : Math.floor(n).toString();
      const u = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'], e = Math.min(u.length - 1, Math.floor(Math.log10(n) / 3));
      return (n / 10 ** (e * 3)).toFixed(2).replace(/\.?0+$/, '') + u[e];
    };
    const mult = id => s.ups.reduce((m, u) => m * (UPGRADES.find(x => x[0] === u)[5][id] || 1), 1);
    const starMult = () => 1 + s.stars * .1;
    const rateOf = h => h[3] * mult(h[0]) * mult('all') * starMult();
    const perSec = () => HELPERS.reduce((a, h) => a + rateOf(h) * s.owned[h[0]], 0);
    const perClick = () => (1 * mult('click') + perSec() * s.ups.reduce((a, u) => a + (UPGRADES.find(x => x[0] === u)[5].clickPct || 0), 0)) * starMult();
    const cost = h => Math.ceil(h[2] * 1.15 ** s.owned[h[0]]);
    const starsAvail = () => Math.floor(Math.sqrt(s.run / 1e6));
    const save = () => { s.last = Date.now(); Store.set(KEY, s); };
    const gain = n => { s.doodles += n; s.total += n; s.run += n; };

    // offline earnings
    const away = Math.min(8 * 3600, (Date.now() - s.last) / 1000);
    if (away > 30 && perSec() > 0) {
      const got = perSec() * away * .5;
      gain(got);
      setTimeout(() => !signal.aborted && modal('Welcome back', el('p', {}, `While you were away for ${Math.round(away / 60)} min your helpers drew ${fmt(got)} doodles.`)), 100);
    }

    const counter = el('div', { class: 'big' }), rateEl = el('div', { class: 'muted' });
    const doodleZone = el('div', { class: 'idle-zone' });
    const pencil = el('button', { class: 'idle-pencil', 'aria-label': 'Draw a doodle', html: `<svg viewBox="0 0 120 120" class="doodle" style="width:150px;height:150px"><path d="M24 96 L84 24 l14 12 L38 108 L20 112 Z M84 24 l8 -9 l14 12 l-8 9 M28 100 l8 8"/><path d="M40 92 L92 30" stroke-width="1.4"/></svg>`, onclick: e => clickDraw(e) });
    const shop = el('div', { class: 'idle-shop' }), upsEl = el('div', { class: 'idle-ups' }), statsEl = el('div', { class: 'muted', style: 'font-size:15px;text-align:center' });
    const gradBtn = el('button', { class: 'btn', onclick: graduate });
    root.append(el('div', { class: 'idle-wrap' },
      el('div', { class: 'panel sk center idle-main' }, counter, rateEl, el('div', { style: 'position:relative' }, pencil, doodleZone), statsEl, gradBtn),
      el('div', { class: 'idle-side' }, el('h3', { class: 'section-title', style: 'margin:0 0 8px' }, 'Upgrades'), upsEl, el('h3', { class: 'section-title', style: 'margin:10px 0 8px' }, 'Helpers'), shop)));

    const SCRIBS = ['☺', '★', '✎', '♥', '✿', '☁', '♪', '⌂', '☼', '✈'];
    function clickDraw(e) {
      const n = perClick(); gain(n); s.clicks++; Sfx.tap();
      const r = pencil.getBoundingClientRect();
      const f = el('span', { class: 'idle-float' }, `+${fmt(n)} ${pick(SCRIBS)}`);
      f.style.left = ((e.clientX || r.left + r.width / 2) - r.left - 20 + rand(30)) + 'px';
      f.style.top = ((e.clientY || r.top + r.height / 2) - r.top - 30) + 'px';
      doodleZone.append(f); setTimeout(() => f.remove(), 900);
      pencil.classList.remove('wiggle'); void pencil.offsetWidth; pencil.classList.add('wiggle');
      draw();
    }

    function buy(h) {
      const c = cost(h); if (s.doodles < c) return;
      s.doodles -= c; s.owned[h[0]]++; Sfx.good(); save(); renderShop(); draw();
    }
    function buyUp(u) {
      if (s.doodles < u[3]) return;
      s.doodles -= u[3]; s.ups.push(u[0]); Sfx.good(); celebrate(8); save(); renderShop(); draw();
    }
    async function graduate() {
      const n = starsAvail() - s.stars;
      if (n <= 0) return;
      const ok = await modal('Graduate?', el('p', {}, `Start a fresh factory and keep ${s.stars + n} gold stars (+${(s.stars + n) * 10}% to everything). Helpers, upgrades and doodles reset.`), [{ label: 'Not yet' }, { label: 'Graduate', primary: true, value: 'yes' }]);
      if (ok !== 'yes') return;
      const stars = s.stars + n;
      Stats.record('idle', { win: true, score: Math.floor(s.run) });
      s = fresh(stars); save(); Sfx.win(); celebrate(); renderShop(); draw();
    }

    let shopSig = '';
    function renderShop() {
      const visible = HELPERS.filter((h, i) => i === 0 || s.owned[HELPERS[i - 1][0]] > 0 || s.total >= h[2] * .5);
      const ups = UPGRADES.filter(u => !s.ups.includes(u[0]) && u[4](s));
      const sig = visible.length + '|' + ups.map(u => u[0]).join() + '|' + HELPERS.map(h => s.owned[h[0]]).join();
      if (sig === shopSig) return refreshAfford();
      shopSig = sig;
      shop.replaceChildren(...visible.map(h => el('button', { class: 'idle-item sk', 'data-id': h[0], onclick: () => buy(h) },
        el('div', { class: 'idle-name' }, h[1], el('span', { class: 'idle-own' }, s.owned[h[0]])),
        el('div', { class: 'muted', style: 'font-size:14px' }, `${h[4]} · ${fmt(rateOf(h))}/s each`),
        el('div', { class: 'idle-cost' }, `✎ ${fmt(cost(h))}`))),
        ...(visible.length < HELPERS.length ? [el('div', { class: 'idle-item locked sk' }, '??? keep doodling')] : []));
      upsEl.replaceChildren(...(ups.length ? ups.map(u => el('button', { class: 'idle-up sk', 'data-cost': u[3], title: u[2], onclick: () => buyUp(u) },
        el('b', {}, u[1]), el('span', { class: 'muted' }, ` ${u[2]} · ✎ ${fmt(u[3])}`))) : [el('p', { class: 'muted', style: 'margin:0' }, 'Nothing yet. Keep growing.')]));
      refreshAfford();
    }
    function refreshAfford() {
      for (const b of shop.querySelectorAll('[data-id]')) b.classList.toggle('cant', s.doodles < cost(HELPERS.find(h => h[0] === b.dataset.id)));
      for (const b of upsEl.querySelectorAll('[data-cost]')) b.classList.toggle('cant', s.doodles < +b.dataset.cost);
    }
    function draw() {
      counter.textContent = `${fmt(s.doodles)} doodles`;
      rateEl.textContent = `${fmt(perSec())} per second · ${fmt(perClick())} per click`;
      statsEl.textContent = `${fmt(s.total)} drawn all time · ${s.clicks} clicks${s.stars ? ` · ★ ${s.stars} gold stars (+${s.stars * 10}%)` : ''}`;
      const n = starsAvail() - s.stars;
      gradBtn.textContent = n > 0 ? `Graduate for +${n} ★` : `Graduate (at ${fmt(((s.stars + 1) ** 2) * 1e6)} this run)`;
      gradBtn.disabled = n <= 0;
      renderShop();
    }

    let lastT = performance.now(), saveT = 0;
    const tick = setInterval(() => {
      const now = performance.now(), dt = (now - lastT) / 1000; lastT = now;
      gain(perSec() * dt);
      if ((saveT += dt) > 5) { saveT = 0; save(); }
      draw();
    }, 200);
    signal.addEventListener('abort', () => { clearInterval(tick); save(); });
    if (!Stats.of('idle').played) Activity.touch();
    draw();
  },
});
