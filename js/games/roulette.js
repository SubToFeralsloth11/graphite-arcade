Games.register({
  id: 'roulette',
  title: 'Paper Roulette',
  blurb: 'A spitball tube loaded with ink blots and blank wads. Aim at the Examiner, or at yourself. Three rounds. No resits.',
  group: 'button',
  tags: ['vs bot', '2P', 'strategy', 'tense'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M14 46 L84 30 L88 46 L18 62 Z"/><path d="M84 30 l14 -4 l3 14 l-13 6"/><circle cx="104" cy="56" r="6" class="hatch"/><path d="M30 20 c6 -8 14 -8 18 0" opacity=".6"/><circle cx="96" cy="16" r="3" class="fill"/></svg>`,
  help: 'The tube is loaded with a known number of ink blots (live) and blank wads, in a hidden order. On your turn flick the next one at your opponent or at yourself. Ink costs the target one page (life). Flick a blank at yourself and you keep the turn; otherwise the turn passes. Each load hands out stationery items that bend the rules (tap one to use it, as many as you like before flicking). Lose all your pages and you are out. Win three rounds against the Examiner to pass, each round with more pages, more blots and more items. Pass & Play pits two people against each other with the same rules.',
  mount(root, signal) {
    const ITEMS = {
      lens: { name: 'Magnifier', icon: '🔍', desc: 'Peek at the next wad.' },
      fold: { name: 'Double Fold', icon: '📐', desc: 'Next ink hit costs 2 pages.' },
      tape: { name: 'Sticky Tape', icon: '🩹', desc: 'Tape back 1 page.' },
      clip: { name: 'Paperclip', icon: '📎', desc: "Opponent's next turn is skipped." },
      rubber: { name: 'Eraser', icon: '🧽', desc: 'Rub out the next wad (you see what it was).' },
      flip: { name: 'Correction Fluid', icon: '🖌', desc: 'Turn the next wad into the other kind (blindly).' },
      note: { name: "Note from Mum", icon: '✉', desc: 'Reveals one random later wad.' },
    };
    const ROUNDS = [{ hp: 2, items: 0 }, { hp: 4, items: 2 }, { hp: 6, items: 4 }];
    let mode = 'bot';
    const stage = el('div', { class: 'stage' });
    root.append(el('div', { class: 'center' }, tabs([['bot', 'Vs Examiner'], ['duel', 'Pass & Play']], mode, m => { mode = m; game(); })), stage);

    function game() {
      const names = mode === 'bot' ? ['The Student (you)', 'The Examiner'] : ['Player 1', 'Player 2'];
      let roundIx = 0, wins = [0, 0];
      const top = el('div', { class: 'scoreboard' });
      const tube = el('div', { class: 'row', style: 'gap:6px;min-height:40px;justify-content:center' });
      const log = el('div', { class: 'bt-story sk', style: 'height:150px' });
      const items = [el('div', { class: 'row', style: 'justify-content:center' }), el('div', { class: 'row', style: 'justify-content:center' })];
      const acts = el('div', { class: 'row', style: 'justify-content:center' });
      const banner = el('div', { class: 'big', style: 'text-align:center' });
      stage.replaceChildren(el('div', { class: 'center', style: 'max-width:680px;margin:0 auto' }, banner, top, tube, acts, items[0], items[1], log));
      const say = (t, cls) => { log.append(el('p', { class: cls || '' }, t)); log.scrollTop = log.scrollHeight; };
      const wait = ms => sleep(ms).then(() => { if (signal.aborted) throw new Error('gone'); });

      let S; // round state
      function newRound() {
        const R = ROUNDS[roundIx];
        S = { hp: [R.hp, R.hp], max: R.hp, inv: [[], []], shells: [], known: [{}, {}], turn: roundIx % 2, fold: false, skip: [false, false], busy: false, over: false };
        log.replaceChildren();
        say(`Round ${roundIx + 1}. ${R.hp} pages each.`, 'bt-room');
        load();
      }
      function load() {
        const R = ROUNDS[roundIx];
        const n = 2 + rand(3 + roundIx * 2);
        const live = Math.max(1, Math.min(n - 1, Math.round(n / 2 + (Math.random() - .5) * 2)));
        S.shells = shuffle([...Array(live).fill(1), ...Array(n - live).fill(0)]);
        S.known = [{}, {}];
        S.reveal = { live, blank: n - live };
        for (let p = 0; p < 2; p++) for (let k = 0; k < R.items && S.inv[p].length < 8; k++) S.inv[p].push(pick(Object.keys(ITEMS)));
        say(`Loading the tube: ${live} ink blot${live > 1 ? 's' : ''}, ${n - live} blank${n - live === 1 ? '' : 's'}.${R.items ? ` Everyone gets ${R.items} item${R.items > 1 ? 's' : ''}.` : ''}`, 'muted');
        Sfx.scratch();
      }
      const remaining = () => ({ live: S.shells.filter(x => x).length, blank: S.shells.filter(x => !x).length });

      function draw() {
        banner.textContent = `Round ${roundIx + 1} of 3`;
        top.replaceChildren(...names.map((n, i) => el('div', { class: 'player sk' + (i === S.turn && !S.over ? ' turn' : '') },
          el('div', { class: 'who' }, n + (S.skip[i] ? ' (clipped)' : '')),
          el('div', { class: 'pts', style: 'font-size:28px;letter-spacing:2px' }, '▯'.repeat(S.hp[i]) + '·'.repeat(S.max - S.hp[i])),
          el('div', { class: 'muted', style: 'font-size:14px' }, `rounds won ${wins[i]}`))));
        const me = mode === 'bot' ? 0 : S.turn;
        const r = remaining();
        tube.replaceChildren(el('span', { class: 'muted' }, `tube: ${r.live} ink · ${r.blank} blank`),
          ...S.shells.map((x, i) => el('span', { class: 'bt-slot', style: 'width:28px;height:28px;font-size:16px' }, S.known[me][i] == null ? '?' : S.known[me][i] ? '●' : '○')),
          S.fold ? el('span', { class: 'chip' }, 'double fold!') : null);
        items.forEach((box, p) => {
          const mine = mode === 'duel' ? p === S.turn : p === 0;
          box.replaceChildren(el('span', { class: 'muted', style: 'min-width:120px' }, `${names[p]}'s pencil case:`),
            ...(S.inv[p].length ? S.inv[p].map((it, k) => el('button', { class: 'btn btn-ghost', title: ITEMS[it].desc, disabled: !mine || !canAct(p), onclick: () => useItem(p, k) }, `${ITEMS[it].icon} ${ITEMS[it].name}`)) : [el('span', { class: 'muted' }, 'empty')]));
        });
        const p = S.turn, other = 1 - p;
        acts.replaceChildren(...(S.over ? [] : [
          el('button', { class: 'btn btn-primary', disabled: !canAct(p) || !human(p), onclick: () => fire(p, other) }, `Flick at ${mode === 'bot' && other === 1 ? 'the Examiner' : names[other]}`),
          el('button', { class: 'btn', disabled: !canAct(p) || !human(p), onclick: () => fire(p, p) }, 'Flick at yourself')]));
      }
      const human = p => mode === 'duel' || p === 0;
      const canAct = p => !S.busy && !S.over && S.turn === p && S.shells.length > 0;

      async function useItem(p, k, fromBot) {
        if (!fromBot && !canAct(p)) return;
        const it = S.inv[p][k], who = names[p];
        if (it === 'tape' && S.hp[p] >= S.max) { if (!fromBot) toast('Your pages are all intact.'); return; }
        if (it === 'fold' && S.fold) { if (!fromBot) toast('Already folded.'); return; }
        if (it === 'clip' && S.skip[1 - p]) { if (!fromBot) toast('They are already clipped.'); return; }
        if (it === 'rubber' && S.shells.length < 2) { if (!fromBot) toast("You can't rub out the last wad."); return; }
        S.inv[p].splice(k, 1); Sfx.tap();
        if (it === 'lens') { S.known[p][0] = S.shells[0]; say(`${who} squints through the magnifier${human(p) ? `: it's ${S.shells[0] ? 'INK' : 'blank'}.` : '. Hmm.'}`); }
        if (it === 'fold') { S.fold = true; say(`${who} folds the wad twice. The next ink hit costs 2 pages.`); }
        if (it === 'tape') { S.hp[p]++; say(`${who} tapes a page back in.`); }
        if (it === 'clip') { S.skip[1 - p] = true; say(`${who} paperclips ${names[1 - p]}'s sleeve to the desk.`); }
        if (it === 'rubber') {
          const x = S.shells.shift(); S.known.forEach(k => shiftKnown(k));
          say(`${who} rubs out the next wad. It was ${x ? 'an ink blot' : 'a blank'}.`);
        }
        if (it === 'flip') { S.shells[0] = 1 - S.shells[0]; S.known.forEach(k => { if (k[0] != null) k[0] = 1 - k[0]; }); say(`${who} dabs correction fluid on the next wad. Something changed.`); }
        if (it === 'note') {
          if (S.shells.length < 2) say(`${who} reads a note from Mum: "Eat your vegetables." Useless.`);
          else { const i = 1 + rand(S.shells.length - 1); S.known[p][i] = S.shells[i]; say(`${who} reads a note from Mum${human(p) ? `: wad #${i + 1} is ${S.shells[i] ? 'INK' : 'blank'}.` : '.'}`); }
        }
        draw();
      }
      const shiftKnown = k => { const n = {}; for (const i in k) if (+i > 0) n[+i - 1] = k[i]; Object.keys(k).forEach(i => delete k[i]); Object.assign(k, n); };

      async function fire(p, target) {
        if (!canAct(p)) return;
        S.busy = true; draw();
        const self = p === target;
        say(`${names[p]} raises the tube at ${self ? 'themself' : names[target]}...`);
        await wait(900 + rand(700));
        const x = S.shells.shift(); S.known.forEach(shiftKnown);
        const dmg = S.fold ? 2 : 1; S.fold = false;
        if (x) {
          S.hp[target] = Math.max(0, S.hp[target] - dmg); Sfx.bad();
          stage.classList.add('shake'); setTimeout(() => stage.classList.remove('shake'), 400);
          say(`SPLAT! Ink. ${names[target]} loses ${dmg} page${dmg > 1 ? 's' : ''}.`, 'bt-room');
        } else { Sfx.tap(); say('*pff* ... a blank wad bounces off.'); }
        draw();
        if (S.hp[target] <= 0) return roundOver(1 - target);
        await wait(600);
        if (!(self && !x)) nextTurn(); // blank at yourself keeps your turn
        if (!S.shells.length) return reload();
        S.busy = false; draw(); maybeBot();
      }
      function nextTurn() {
        S.turn = 1 - S.turn;
        if (S.skip[S.turn]) { S.skip[S.turn] = false; say(`${names[S.turn]} is paperclipped and loses the turn.`, 'muted'); S.turn = 1 - S.turn; }
      }
      async function reload() {
        S.busy = true; draw();
        say('The tube is empty.', 'muted');
        await wait(1000);
        load(); S.busy = false; draw(); maybeBot();
      }
      async function roundOver(w) {
        S.over = true; wins[w]++; draw();
        say(`${names[1 - w]} is out of pages. ${names[w]} takes round ${roundIx + 1}.`, 'bt-room');
        await wait(1200);
        if (mode === 'bot' && w === 1) return finish(1);
        if (roundIx === 2 || (mode === 'duel' && Math.max(...wins) === 2)) return finish(wins[0] > wins[1] ? 0 : 1);
        roundIx++;
        acts.replaceChildren(el('button', { class: 'btn btn-primary', onclick: () => { newRound(); draw(); maybeBot(); } }, `On to round ${roundIx + 1}`));
      }
      function finish(w) {
        Stats.record('roulette', { win: mode === 'bot' ? w === 0 : undefined, score: mode === 'bot' ? roundIx + (w === 0 ? 1 : 0) : undefined });
        (mode === 'duel' || w === 0) ? (Sfx.win(), celebrate(40)) : Sfx.lose();
        const title = mode === 'bot' ? (w === 0 ? 'You passed!' : 'Failed.') : `${names[w]} wins!`;
        say(mode === 'bot' && w === 1 ? `The Examiner stamps your paper: FAIL. You reached round ${roundIx + 1}.` : title, 'bt-room');
        acts.replaceChildren(el('button', { class: 'btn btn-primary', onclick: game }, 'Sit the exam again'));
        modal(title, mode === 'bot' ? (w === 0 ? 'Three rounds survived. The Examiner grudgingly hands you an A*.' : `You made it to round ${roundIx + 1} of 3.`) : `${wins[0]} – ${wins[1]}`, [{ label: 'OK', primary: true }]);
      }

      /** The Examiner: uses what it knows, plays the odds otherwise. */
      async function maybeBot() {
        if (mode !== 'bot' || S.turn !== 1 || S.over || S.busy) return;
        S.busy = true; draw();
        try {
          await wait(900);
          const inv = S.inv[1], has = it => inv.indexOf(it);
          const use = async it => { const k = has(it); if (k < 0) return false; S.busy = false; await useItem(1, k, true); S.busy = true; await wait(800); return true; };
          if (S.hp[1] < S.max) await use('tape');
          if (S.hp[1] < S.max - 1) await use('tape');
          if (S.known[1][0] == null && has('lens') >= 0) await use('lens');
          if (S.known[1][0] == null && S.shells.length > 2 && has('note') >= 0) await use('note');
          if (!S.shells.length) return;
          let k = S.known[1][0];
          const r = remaining(), pLive = k != null ? k : r.live / (r.live + r.blank);
          if (k === 0 && has('flip') >= 0) { await use('flip'); k = 1; }
          else if (k == null && pLive < .5 && has('rubber') >= 0) { await use('rubber'); if (!S.shells.length || S.turn !== 1) return; }
          const pNow = S.known[1][0] != null ? S.known[1][0] : remaining().live / S.shells.length;
          if (pNow >= .5 && !S.skip[0] && has('clip') >= 0) await use('clip');
          if (pNow >= .99 && has('fold') >= 0) await use('fold');
          S.busy = false;
          const target = pNow >= .5 ? 0 : 1;
          await fire(1, target);
        } catch { /* unmounted */ }
      }
      newRound(); draw(); maybeBot();
    }
    game();
  },
});
