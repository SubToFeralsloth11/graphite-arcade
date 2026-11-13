Games.register({
  id: 'blackjack',
  title: 'Twenty-One',
  blurb: 'Get closer to 21 than the dealer without going bust. Bet pencil-chips, double down.',
  group: 'button',
  tags: ['vs bot', 'cards', 'luck'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><rect x="30" y="14" width="34" height="50" rx="4" transform="rotate(-6 47 39)"/><rect x="56" y="16" width="34" height="50" rx="4" transform="rotate(8 73 41)"/><text x="36" y="40" font-size="16">A</text><text x="64" y="44" font-size="16">K</text></svg>`,
  help: 'Hit to take a card, Stand to stop. Aces count 1 or 11, face cards 10. Double: double your bet, take exactly one card. Dealer hits until 17. Blackjack (21 with two cards) pays 3:2. You start with 100 chips; your best chip count is saved.',
  mount(root, signal) {
    const R = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'], S = ['♠', '♥', '♦', '♣'];
    const stage = el('div', { class: 'stage' });
    root.append(stage);
    let chips = 100, bet = 10;
    const value = h => { let v = 0, a = 0; for (const c of h) { const r = c % 13; v += r === 0 ? 11 : Math.min(10, r + 1); if (r === 0) a++; } while (v > 21 && a--) v -= 10; return v; };
    const cardEl = (c, hidden) => el('span', { class: 'bt-mini sk' + (!hidden && ((c / 13) | 0) % 3 ? ' red' : '') }, hidden ? '?' : R[c % 13] + S[(c / 13) | 0]);
    function table() {
      if (chips <= 0) chips = 100;
      bet = Math.min(bet, chips);
      const betEl = el('div', { class: 'big' });
      const drawBet = () => (betEl.textContent = `Bet ${bet}`);
      const adj = d => { bet = Math.max(5, Math.min(chips, bet + d)); Sfx.tap(); drawBet(); };
      stage.replaceChildren(el('div', { class: 'center panel sk', style: 'max-width:460px;margin:0 auto' },
        el('div', { class: 'msg' }, `Chips: ${chips}`), betEl,
        el('div', { class: 'row' }, el('button', { class: 'btn', onclick: () => adj(-5) }, '−5'), el('button', { class: 'btn', onclick: () => adj(5) }, '+5'), el('button', { class: 'btn', onclick: () => { bet = chips; drawBet(); } }, 'all in')),
        el('button', { class: 'btn btn-primary', onclick: deal }, 'Deal')));
      drawBet();
    }
    function deal() {
      const deck = shuffle(Array.from({ length: 52 * 2 }, (_, i) => i % 52));
      const you = [deck.pop(), deck.pop()], dealer = [deck.pop(), deck.pop()];
      let stake = bet, done = false;
      const dEl = el('div', { class: 'row' }), yEl = el('div', { class: 'row' });
      const dv = el('div', { class: 'muted' }), yv = el('div', { class: 'muted' });
      const msg = el('div', { class: 'msg' });
      const ctl = el('div', { class: 'row' },
        el('button', { class: 'btn btn-primary', onclick: () => act('hit') }, 'Hit'),
        el('button', { class: 'btn', onclick: () => act('stand') }, 'Stand'),
        el('button', { class: 'btn', onclick: () => act('double') }, 'Double'));
      stage.replaceChildren(el('div', { class: 'center' }, el('div', {}, 'Dealer'), dEl, dv, el('div', { style: 'height:10px' }), yEl, yv, el('div', {}, 'You'), msg, ctl));
      const draw = () => {
        dEl.replaceChildren(...dealer.map((c, i) => cardEl(c, i === 1 && !done)));
        yEl.replaceChildren(...you.map(c => cardEl(c)));
        dv.textContent = done ? value(dealer) : '';
        yv.textContent = value(you);
        if (!done) msg.textContent = `Stake ${stake} · chips ${chips}`;
      };
      async function act(a) {
        if (done) return;
        Sfx.scratch();
        if (a === 'double') { if (you.length !== 2 || chips < stake * 2) return toast('Can only double on two cards with enough chips'); stake *= 2; you.push(deck.pop()); return settle(); }
        if (a === 'hit') { you.push(deck.pop()); draw(); if (value(you) >= 21) settle(); return; }
        settle();
      }
      async function settle() {
        done = true; draw();
        const yvv = value(you), bj = yvv === 21 && you.length === 2;
        if (yvv <= 21 && !bj) while (value(dealer) < 17) { await sleep(500); if (signal.aborted) return; dealer.push(deck.pop()); Sfx.tap(); draw(); }
        const d = value(dealer), dbj = d === 21 && dealer.length === 2;
        let delta, text;
        if (yvv > 21) [delta, text] = [-stake, 'Bust!'];
        else if (bj && !dbj) [delta, text] = [Math.floor(stake * 1.5), 'Blackjack!'];
        else if (dbj && !bj) [delta, text] = [-stake, 'Dealer blackjack'];
        else if (d > 21 || yvv > d) [delta, text] = [stake, d > 21 ? 'Dealer busts, you win' : 'You win'];
        else if (yvv < d) [delta, text] = [-stake, 'Dealer wins'];
        else [delta, text] = [0, 'Push'];
        chips += delta;
        Stats.record('blackjack', { win: delta > 0 ? true : delta < 0 ? false : undefined, score: chips });
        delta > 0 ? Sfx.good() : delta < 0 ? Sfx.bad() : Sfx.tap();
        if (bj && delta > 0) celebrate();
        msg.textContent = `${text} (${delta >= 0 ? '+' : ''}${delta}) · chips ${chips}${chips <= 0 ? ' · broke! refilled to 100' : ''}`;
        ctl.replaceChildren(el('button', { class: 'btn btn-primary', onclick: table }, 'Next hand'));
      }
      draw();
      if (value(you) === 21) settle();
    }
    table();
  },
});
