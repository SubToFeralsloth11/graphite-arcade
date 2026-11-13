Games.register({
  id: 'hilo',
  title: 'Card Sharp',
  blurb: 'Higher or lower than the last card? Build a streak, cash out before it all goes wrong.',
  group: 'button',
  tags: ['solo', 'luck', 'quick'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><rect x="26" y="12" width="34" height="50" rx="4" transform="rotate(-8 43 37)"/><rect x="60" y="14" width="34" height="50" rx="4" transform="rotate(6 77 39)"/><text x="66" y="44" font-size="20">7</text></svg>`,
  help: 'A card is shown. Guess whether the next card is higher or lower (aces are high, equal cards count as a loss). Each right guess doubles your pot. Bank it any time to add it to your total; one wrong guess loses the pot. You have 10 cards per game.',
  mount(root, signal) {
    const R = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'], S = ['♠', '♥', '♦', '♣'];
    const stage = el('div', { class: 'stage' });
    root.append(stage);
    function start() {
      const deck = shuffle(Array.from({ length: 52 }, (_, i) => i));
      let cur = deck.pop(), pot = 0, bank = 0, dealt = 1;
      const card = el('div', { class: 'bt-card sk' });
      const info = el('div', { class: 'msg' });
      const odds = el('div', { class: 'muted' });
      const btns = el('div', { class: 'row' },
        el('button', { class: 'btn', onclick: () => guess(1) }, 'Higher ▲'),
        el('button', { class: 'btn', onclick: () => guess(-1) }, 'Lower ▼'),
        el('button', { class: 'btn btn-primary', onclick: cash }, 'Bank'));
      stage.replaceChildren(el('div', { class: 'center' }, info, card, odds, btns));
      const rank = c => c % 13;
      const draw = () => {
        card.textContent = R[rank(cur)] + S[(cur / 13) | 0];
        card.classList.toggle('red', ((cur / 13) | 0) % 3 !== 0);
        const hi = deck.filter(c => rank(c) > rank(cur)).length, lo = deck.filter(c => rank(c) < rank(cur)).length;
        odds.textContent = `odds: higher ${Math.round(hi / deck.length * 100)}% · lower ${Math.round(lo / deck.length * 100)}%`;
        info.textContent = `Card ${dealt}/10 · pot ${pot} · banked ${bank}`;
      };
      function guess(dir) {
        if (dealt >= 10) return;
        const next = deck.pop(); dealt++;
        const ok = Math.sign(rank(next) - rank(cur)) === dir;
        cur = next;
        if (ok) { pot = pot ? pot * 2 : 10; Sfx.good(); }
        else { pot = 0; Sfx.bad(); card.classList.add('shake'); setTimeout(() => card.classList.remove('shake'), 400); }
        draw();
        if (dealt >= 10) cash();
      }
      function cash() {
        bank += pot; pot = 0; Sfx.scratch(); draw();
        if (dealt >= 10) {
          const s = Stats.record('hilo', { score: bank });
          info.textContent = `Final: ${bank} points${s.newBest ? ' (new best!)' : ''}`;
          if (s.newBest && bank) { Sfx.win(); celebrate(); }
          btns.replaceChildren(el('button', { class: 'btn btn-primary', onclick: start }, 'Deal again'));
        }
      }
      draw();
    }
    start();
  },
});
