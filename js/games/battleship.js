Games.register({
  id: 'battleship',
  title: 'Battleships',
  blurb: 'Hunt the bot\'s hidden fleet on graph paper before it finds yours.',
  group: 'table',
  tags: ['vs bot', 'online', 'strategy'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M10 50 h76 l-10 14 H22 Z M30 50 V38 h30 v12 M44 38 V26"/><path d="M4 72 c10 -6 20 6 30 0 s20 6 30 0 s20 6 30 0"/><path d="M96 14 l12 12 M108 14 l-12 12"/><circle cx="102" cy="44" r="5"/></svg>`,
  help: 'Your fleet (left) is placed for you; reshuffle it before the first shot if you like. Click squares on the enemy sea (right) to fire. X is a hit, a dot is a miss. Sink all five ships (5, 4, 3, 3, 2) first to win. A hit earns another shot. Online: each player reshuffles their own fleet and presses Ready; the host fires first, and each side only learns hit, miss or sunk, never the other fleet.',
  mount(root, signal) {
    const N = 8, SHIPS = [5, 4, 3, 3, 2];
    let mode = 'bot', level = 'med', link = null;
    const stage = el('div', { class: 'stage' });
    const lvlTabs = tabs([['easy', 'Rookie'], ['med', 'Captain'], ['hard', 'Admiral']], level, l => { level = l; start(); });
    root.append(el('div', { class: 'center' }, el('div', { class: 'row' },
      tabs([['bot', 'Vs Bot'], ['online', 'Online']], mode, m => { mode = m; if (link) { link.close(); link = null; } lvlTabs.style.display = m === 'bot' ? '' : 'none'; start(); }), lvlTabs)), stage);

    function fleet() {
      const g = Array(N * N).fill(-1);
      SHIPS.forEach((len, id) => {
        for (;;) {
          const h = Math.random() < 0.5, r = rand(h ? N : N - len + 1), c = rand(h ? N - len + 1 : N);
          const idx = Array.from({ length: len }, (_, k) => (h ? r * N + c + k : (r + k) * N + c));
          if (idx.some(i => g[i] !== -1)) continue;
          idx.forEach(i => (g[i] = id));
          break;
        }
      });
      return g;
    }
    const nb = i => [i - N, i + N, i % N ? i - 1 : -1, i % N < N - 1 ? i + 1 : -1].filter(j => j >= 0 && j < N * N);

    function start() {
      if (mode === 'online' && !link?.open) {
        return Net.lobby(stage, 'battleship', signal, l => { link = l; link.onClose = () => { link = null; start(); }; start(); });
      }
      const online = mode === 'online', me = online ? link.me : 0;
      let mine = fleet();
      const theirs = online ? null : fleet();
      const shotAtMe = Array(N * N).fill(false), shotAtThem = Array(N * N).fill(false);
      let fired = false, over = false, busy = false, targets = [];
      // Online: we only ever know what the friend reported back, never their fleet.
      let placing = online, turn = 0, pending = false, revealed = null;
      const known = Array(N * N).fill(null), sunkCells = new Set();
      let theirSunk = 0;
      const msg = el('div', { class: 'msg' }, online ? 'Reshuffle your fleet, then press Ready' : 'Fire when ready');
      const mk = (cls, onclick) => Array.from({ length: N * N }, (_, i) => el('div', { class: 'bs-cell', onclick: onclick && (() => onclick(i)) }));
      const myCells = mk(), theirCells = mk(null, fire);
      const sunk = (g, shots, id) => g.every((v, i) => v !== id || shots[i]);
      const left = (g, shots) => SHIPS.filter((_, id) => !sunk(g, shots, id)).length;
      const myLeft = el('span'), theirLeft = el('span');
      const reshuffle = el('button', { class: 'btn btn-ghost', onclick: () => { if (fired || (online && !placing)) return; mine = fleet(); Sfx.scratch(); draw(); } }, 'reshuffle my fleet');
      const readyB = online ? el('button', { class: 'btn btn-primary', onclick: () => {
        if (!placing || readyB.disabled) return;
        readyB.disabled = true; reshuffle.disabled = true; msg.textContent = 'Waiting for your friend...'; Sfx.tap();
        link.ready(() => { placing = false; readyB.remove(); msg.textContent = turn === me ? 'Your shot' : 'Friend is aiming...'; draw(); });
      } }, 'Ready') : null;
      const draw = () => {
        myCells.forEach((c, i) => { c.className = 'bs-cell' + (mine[i] >= 0 ? ' ship' : '') + (shotAtMe[i] ? (mine[i] >= 0 ? ' hit' : ' miss') : '') + (mine[i] >= 0 && sunk(mine, shotAtMe, mine[i]) ? ' sunk' : ''); });
        if (online) theirCells.forEach((c, i) => { c.className = 'bs-cell enemy' + (known[i] ? ' ' + known[i] : '') + (sunkCells.has(i) ? ' sunk ship' : '') + (revealed && revealed[i] >= 0 ? ' ship' : ''); });
        else theirCells.forEach((c, i) => { c.className = 'bs-cell enemy' + (shotAtThem[i] ? (theirs[i] >= 0 ? ' hit' : ' miss') : '') + (theirs[i] >= 0 && sunk(theirs, shotAtThem, theirs[i]) ? ' sunk ship' : '') + (over && theirs[i] >= 0 ? ' ship' : ''); });
        myLeft.textContent = `${left(mine, shotAtMe)} ships afloat`; theirLeft.textContent = `${online ? SHIPS.length - theirSunk : left(theirs, shotAtThem)} ships afloat`;
        reshuffle.disabled = fired || (online && (!placing || readyB.disabled));
      };
      stage.replaceChildren(el('div', { class: 'center' }, msg, readyB, el('div', { class: 'bs-wrap' },
        el('div', { class: 'center' }, el('div', { class: 'who' }, 'Your sea · ', myLeft), el('div', { class: 'bs-grid sk' }, myCells), reshuffle),
        el('div', { class: 'center' }, el('div', { class: 'who' }, online ? "Friend's sea · " : "Bot's sea · ", theirLeft), el('div', { class: 'bs-grid sk' }, theirCells)))));
      draw();

      if (online) {
        // Defender: resolve the friend's shot against our own fleet and report only the outcome.
        link.on('shot', i => {
          if (over || placing || turn === me || shotAtMe[i]) return;
          shotAtMe[i] = true;
          const id = mine[i], hit = id >= 0, sank = hit && sunk(mine, shotAtMe, id), done = !left(mine, shotAtMe);
          link.send('result', { i, hit, sunk: sank ? mine.map((v, j) => (v === id ? j : -1)).filter(j => j >= 0) : null, done });
          if (hit) { Sfx.bad(); msg.textContent = sank ? `Friend sank your ${SHIPS[id]}-ship!` : 'Friend hit you!'; }
          else { Sfx.tap(); turn = me; msg.textContent = 'Friend missed. Your shot.'; }
          draw();
          if (done) end(false);
        });
        // Attacker: learn what our shot did.
        link.on('result', ({ i, hit, sunk: cells, done }) => {
          if (!pending) return;
          pending = false; known[i] = hit ? 'hit' : 'miss';
          if (cells) { cells.forEach(j => sunkCells.add(j)); theirSunk++; }
          if (hit) { Sfx.good(); msg.textContent = cells ? `You sank their ${cells.length}-ship!` : 'Hit! Shoot again.'; }
          else { Sfx.scratch(); turn = 1 - me; msg.textContent = 'Splash. Friend is aiming...'; }
          draw();
          if (done) { link.send('fleet', mine); end(true); }
        });
        // After a loss, the winner shows us where their ships were.
        link.on('fleet', g => { revealed = g; draw(); });
      }

      function fire(i) {
        if (online) {
          if (over || placing || pending || turn !== me || known[i]) return;
          pending = true; fired = true; Sfx.tap();
          return link.send('shot', i);
        }
        if (over || busy || shotAtThem[i]) return;
        fired = true; shotAtThem[i] = true;
        const id = theirs[i];
        if (id >= 0) {
          Sfx.good();
          msg.textContent = sunk(theirs, shotAtThem, id) ? `You sank their ${SHIPS[id]}-ship!` : 'Hit! Shoot again.';
          draw();
          if (!left(theirs, shotAtThem)) return end(true);
          return;
        }
        Sfx.scratch(); msg.textContent = 'Splash. Bot is aiming...'; draw(); botTurn();
      }
      function botPick() {
        const free = i => !shotAtMe[i];
        if (level !== 'easy') {
          targets = targets.filter(free);
          // Prefer extending a line of 2+ unsunk hits.
          const hits = shotAtMe.map((s, i) => (s && mine[i] >= 0 && !sunk(mine, shotAtMe, mine[i]) ? i : -1)).filter(i => i >= 0);
          for (const a of hits) for (const d of [1, N]) {
            if (!hits.includes(a + d) || (d === 1 && (a + 1) % N === 0)) continue;
            let lo = a, hi = a + d;
            while (hits.includes(lo - d) && (d === N || lo % N)) lo -= d;
            while (hits.includes(hi + d) && (d === N || (hi + 1) % N)) hi += d;
            const ends = [lo - d, hi + d].filter(j => j >= 0 && j < N * N && free(j) && (d === N || Math.floor(j / N) === Math.floor(a / N)));
            if (ends.length) return pick(ends);
          }
          if (targets.length) return targets.pop();
        }
        const open = shotAtMe.map((s, i) => (s ? -1 : i)).filter(i => i >= 0);
        const parity = level === 'hard' ? open.filter(i => ((i % N) + Math.floor(i / N)) % 2 === 0) : open;
        return pick(parity.length ? parity : open);
      }
      async function botTurn() {
        busy = true;
        for (;;) {
          await sleep(650);
          if (signal.aborted) return;
          const i = botPick();
          shotAtMe[i] = true;
          const id = mine[i];
          if (id >= 0) {
            Sfx.bad();
            if (sunk(mine, shotAtMe, id)) { msg.textContent = `Bot sank your ${SHIPS[id]}-ship!`; targets = []; }
            else { msg.textContent = 'Bot hit you!'; targets.push(...nb(i).filter(j => !shotAtMe[j])); }
            draw();
            if (!left(mine, shotAtMe)) return end(false);
            continue;
          }
          msg.textContent = 'Bot missed. Your shot.'; Sfx.tap(); draw(); busy = false; return;
        }
      }
      function end(win) {
        over = true; draw();
        const shots = online ? known.filter(Boolean).length : shotAtThem.filter(Boolean).length;
        const s = Stats.record('battleship', { win, score: win ? shots : null, best: 'low' });
        win ? (Sfx.win(), celebrate()) : Sfx.lose();
        const body = el('div', {}, el('p', {}, win ? `You won in ${shots} shots.` : online ? 'Your friend found every ship.' : 'The bot found every ship.'), statRow(s, { best: 'fewest shots' }));
        if (online) {
          msg.textContent = win ? 'Fleet destroyed!' : 'Your fleet sank';
          setTimeout(() => !signal.aborted && link?.open && modal(win ? 'Fleet destroyed!' : 'Your fleet sank', body, [{ label: 'New battle', primary: true }])
            .then(() => { if (link?.open) { msg.textContent = 'Waiting for your friend...'; link.ready(start); } }), 700);
          return;
        }
        modal(win ? 'Fleet destroyed!' : 'Your fleet sank', body, [{ label: 'New battle', primary: true }]).then(v => v && start());
      }
    }
    start();
  },
});
