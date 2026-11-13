'use strict';
/* Hub page + hash router. */
(() => {
  const app = $('#app');
  let ctrl = null;

  const GREETINGS = ['Sharpen your pencil.', 'Pick a page, any page.', 'Back for more doodles?', 'The margins are waiting.', 'Fresh paper, fresh games.'];
  const GROUPS = [['word', 'Word games', 'letters, guesses and a little bit of panic'], ['table', 'Notebook games', 'the stuff you drew in the back of class']];

  function cardStat(g) {
    const s = Stats.of(g.id);
    if (!s.played) return 'not played yet, go on';
    const parts = [`played ${s.played}`];
    if (s.won) parts.push(`won ${s.won}`);
    if (s.best != null) parts.push(`best ${s.best}`);
    if (s.streak > 1) parts.push(`streak ${s.streak}`);
    return parts.join(' · ');
  }

  function hub() {
    document.title = 'Graphite Arcade';
    const dailies = Games.list.filter(g => g.daily);
    const doneCount = dailies.filter(g => Stats.dailyDone(g.id)).length;
    const total = Object.values(Stats.all()).reduce((n, s) => n + s.played, 0);
    const hero = el('section', { class: 'hero' },
      el('div', {},
        el('h1', {}, el('span', { class: 'scribble-u' }, pick(GREETINGS))),
        el('p', {}, `${Games.list.length} pencil-and-paper games with bots, daily puzzles, and pass-the-device modes for two.`),
        el('div', { class: 'row hero-actions' },
          el('button', { class: 'btn btn-primary', onclick: () => { Sfx.scratch(); location.hash = '#/' + pick(Games.list).id; } }, 'Surprise me'),
          total ? el('span', { class: 'muted' }, `${total} games played so far`) : null)),
      el('div', { class: 'today sk' },
        el('h3', {}, `Today's page  ${doneCount}/${dailies.length}`),
        el('ul', {}, dailies.map(g => {
          const r = Stats.dailyDone(g.id);
          return el('li', { onclick: () => (location.hash = '#/' + g.id) },
            el('span', { class: 'box' }, r ? '✓' : ''), el('span', { style: 'flex:1' }, g.title), el('span', { class: 'muted' }, r || 'to do'));
        })),
        el('p', { class: 'muted', style: 'margin:10px 0 0;font-size:16px' }, doneCount === dailies.length ? 'All dailies done. See you tomorrow!' : 'New puzzles every midnight.')));

    let i = 0;
    const sections = GROUPS.map(([gid, title, sub]) => el('section', {},
      el('div', { class: 'row', style: 'align-items:baseline' }, el('h2', { class: 'section-title scribble-u' }, title), el('span', { class: 'muted' }, sub)),
      el('div', { class: 'grid' }, Games.list.filter(g => g.group === gid).map(g => {
        const card = el('a', { class: 'card sk', href: '#/' + g.id, style: `animation-delay:${(i++) * 60}ms`, onclick: () => Sfx.scratch() },
          el('div', { class: 'icon', html: g.icon }),
          el('h3', {}, g.title),
          el('p', {}, g.blurb),
          el('div', { class: 'tags' }, g.tags.map(t => el('span', { class: 'tag' }, t))),
          el('div', { class: 'stat' }, cardStat(g)),
          g.daily && Stats.dailyDone(g.id) ? el('span', { class: 'done-mark' }, 'done ✓') : null);
        return card;
      }))));
    app.replaceChildren(hero, ...sections);
  }

  function game(g) {
    document.title = `${g.title} · Graphite Arcade`;
    const root = el('div');
    app.replaceChildren(
      el('div', { class: 'game-head' },
        el('a', { class: 'btn btn-ghost', href: '#/' }, '← all games'),
        el('h2', {}, el('span', { class: 'scribble-u' }, g.title)),
        el('button', { class: 'btn btn-ghost', onclick: () => modal(`How to play`, el('p', {}, g.help)) }, 'how to play'),
        el('button', { class: 'btn btn-ghost', onclick: () => modal(`${g.title} stats`, statRow(Stats.of(g.id))) }, 'stats')),
      root);
    g.mount(root, ctrl.signal);
    if (!Stats.of(g.id).played && !Store.get(`seen:${g.id}`)) { Store.set(`seen:${g.id}`, 1); modal('How to play', el('p', {}, g.help), [{ label: "Let's go", primary: true }]); }
  }

  function route() {
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    $$('.modal-bg').forEach(m => m.remove());
    const id = (location.hash.match(/^#\/(\w+)/) || [])[1];
    window.scrollTo(0, 0);
    Games.map[id] ? game(Games.map[id]) : hub();
  }

  function drawStreak() {
    const n = Activity.streak();
    $('#streak').textContent = n ? `${n} day streak` : 'start a streak today';
  }
  const mute = $('#mute');
  const drawMute = () => (mute.textContent = Sfx.muted ? 'sound: off' : 'sound: on');
  mute.addEventListener('click', () => { Sfx.toggle(); drawMute(); Sfx.tap(); });

  window.addEventListener('hashchange', route);
  window.addEventListener('activity', drawStreak);
  drawMute(); drawStreak(); route();
})();
