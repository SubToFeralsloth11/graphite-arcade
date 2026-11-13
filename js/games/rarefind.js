Games.register({
  id: 'rarefind',
  title: 'Rare Find',
  blurb: 'You get a theme, you name one thing. Obvious answers score little; obscure ones score big.',
  group: 'button',
  tags: ['vs bot', '2P', 'text'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M40 20 h40 l14 16 l-34 36 l-34 -36 z M26 36 h68 M50 20 l-6 16 l16 36 l16 -36 l-6 -16"/><path d="M100 12 l3 6 l6 1 l-5 4 l1 6 l-5 -3 l-5 3 l1 -6 l-5 -4 l6 -1 z"/></svg>`,
  help: 'Each round shows a theme (like "Fruits"). Type one thing that fits and press Enter, within 20 seconds. Points depend on how rare the answer is: the first thing everyone thinks of scores 1, deep cuts score up to 10. Words the judges do not know for that theme score 0, and so does repeating a word you already used. In 2P, if both players give the same answer, both score 0. Five rounds.',
  mount(root, signal) {
    // Each list runs roughly from most to least commonly given.
    const THEMES = {
      Fruits: 'apple banana orange strawberry grape pear mango pineapple watermelon cherry peach lemon kiwi plum melon raspberry blueberry lime coconut apricot grapefruit pomegranate papaya nectarine blackberry fig cranberry passionfruit tangerine lychee guava date persimmon gooseberry quince kumquat dragonfruit durian rambutan mangosteen loquat jackfruit tamarind',
      Animals: 'dog cat lion elephant tiger horse cow monkey giraffe zebra bear pig rabbit mouse snake wolf fox sheep deer kangaroo panda goat penguin dolphin hippo rhino koala squirrel camel otter hedgehog badger leopard cheetah gorilla moose beaver raccoon sloth llama walrus armadillo lemur meerkat platypus wombat ocelot tapir okapi pangolin axolotl capybara aardvark narwhal quokka binturong',
      Colours: 'red blue green yellow purple orange pink black white brown grey silver gold turquoise violet maroon navy teal beige lilac indigo crimson magenta cyan lavender scarlet olive cream peach aqua burgundy khaki mauve ochre amber cerulean vermilion chartreuse puce taupe sepia ultramarine',
      Sports: 'football soccer basketball tennis cricket rugby golf swimming baseball hockey boxing volleyball badminton athletics cycling skiing netball snooker darts gymnastics surfing rowing karate judo wrestling archery fencing sailing skateboarding bowling squash lacrosse polo handball triathlon curling bobsleigh kabaddi hurling korfball sepaktakraw',
      Countries: 'france usa china japan germany spain italy england canada australia brazil india mexico russia ireland egypt scotland wales greece portugal sweden norway kenya argentina nigeria poland turkey thailand netherlands belgium denmark finland peru chile vietnam iceland morocco jamaica cuba nepal mongolia fiji bhutan latvia malta tonga eritrea vanuatu liechtenstein tuvalu',
      Vegetables: 'carrot potato broccoli pea onion cabbage tomato lettuce cucumber pepper sweetcorn cauliflower spinach mushroom bean celery garlic leek courgette zucchini aubergine eggplant sprout parsnip turnip beetroot radish asparagus kale pumpkin squash artichoke swede okra fennel chard rhubarb celeriac kohlrabi salsify jicama romanesco samphire',
      Instruments: 'piano guitar drums violin flute trumpet saxophone recorder cello clarinet harp keyboard ukulele bass trombone tuba triangle xylophone harmonica banjo oboe accordion tambourine bagpipes viola mandolin cymbals bassoon glockenspiel sitar harpsichord didgeridoo bongos marimba lute theremin kazoo zither bodhran dulcimer ocarina',
      Kitchen: 'fridge oven kettle toaster microwave spoon fork knife plate cup bowl pan sink dishwasher blender mug whisk spatula colander grater ladle peeler sieve tongs scales freezer saucepan corkscrew rollingpin teapot apron chopsticks mortar pestle mandoline ramekin tureen trivet zester cafetiere',
      Weather: 'rain sun snow wind cloud storm fog thunder lightning hail sleet drizzle frost rainbow hurricane tornado mist heatwave blizzard gale breeze drought monsoon flood typhoon cyclone dew smog humidity downpour squall haze whirlwind sirocco zephyr graupel virga',
      Body: 'arm leg head hand foot eye nose mouth ear finger toe knee elbow shoulder hair tooth heart brain neck back stomach lung liver chin cheek ankle wrist hip thumb skull rib spine kidney eyebrow eyelash nostril shin thigh calf knuckle collarbone tonsil pancreas spleen appendix sternum femur uvula clavicle',
      Clothing: 'shirt trousers jeans dress skirt jumper sweater coat jacket hat shoes socks scarf gloves boots shorts hoodie tie belt pyjamas cardigan blouse vest trainers sandals cap suit leggings beanie poncho dungarees waistcoat kilt blazer apron bowtie cravat sarong fedora espadrilles beret tabard kimono balaclava',
      Birds: 'robin eagle pigeon owl parrot penguin crow seagull sparrow duck swan flamingo chicken blackbird peacock ostrich hawk magpie pelican goose turkey kingfisher woodpecker falcon heron puffin wren starling toucan vulture emu kiwi cuckoo stork albatross hummingbird finch raven jay nightingale cormorant lark osprey kestrel ptarmigan hoopoe shoebill cassowary',
    };
    for (const k in THEMES) THEMES[k] = THEMES[k].split(' ');
    const points = (list, i) => 1 + Math.floor(9 * i / (list.length - 1));
    const norm = (list, w) => {
      w = w.trim().toLowerCase().replace(/[^a-z]/g, '');
      if (list.includes(w)) return w;
      for (const s of [w.replace(/ies$/, 'y'), w.replace(/es$/, ''), w.replace(/s$/, '')]) if (list.includes(s)) return s;
      return w;
    };
    let mode = 'bot', level = 'mid';
    const stage = el('div', { class: 'stage' });
    const lvl = tabs([['easy', 'Plain bot'], ['mid', 'Clever bot'], ['hard', 'Know-it-all']], level, l => { level = l; start(); });
    root.append(el('div', { class: 'center' }, el('div', { class: 'row' }, tabs([['bot', 'Vs Bot'], ['duel', 'Pass & Play']], mode, m => { mode = m; lvl.style.display = m === 'bot' ? '' : 'none'; start(); }), lvl)), stage);

    function start() {
      const names = mode === 'bot' ? ['You', 'Bot'] : ['Player 1', 'Player 2'];
      const themes = shuffle(Object.keys(THEMES)).slice(0, 5);
      const score = [0, 0], used = [new Set(), new Set()];
      let round = 0;
      const P = names.map(n => el('div', { class: 'player sk' }, el('div', { class: 'who' }, n), el('div', { class: 'pts' }, 0)));
      const body = el('div', { class: 'center' });
      stage.replaceChildren(el('div', { class: 'center' }, el('div', { class: 'scoreboard' }, P), body));
      const sync = () => P.forEach((p, i) => (p.lastChild.textContent = score[i]));

      /** Prompt one player for an answer; resolves to the raw text ('' on timeout). */
      const ask = (who, theme, secret) => new Promise(resolve => {
        let left = 20;
        const timer = el('div', { class: 'msg' });
        const input = el('input', { class: 'input bt-plain', type: secret ? 'password' : 'text', autocomplete: 'off', spellcheck: 'false', placeholder: 'one answer', style: 'text-align:center;max-width:320px' });
        const fin = v => { clearInterval(tick); resolve(v); };
        const tick = setInterval(() => { if (signal.aborted) return clearInterval(tick); left--; timer.textContent = `${names[who]} · ${left}s`; if (left <= 0) { Sfx.bad(); fin(''); } }, 1000);
        timer.textContent = `${names[who]} · ${left}s`;
        body.replaceChildren(el('div', { class: 'muted' }, `Round ${round + 1}/5`), el('div', { class: 'big' }, theme), timer,
          el('form', { class: 'row', onsubmit: e => { e.preventDefault(); if (input.value.trim()) fin(input.value); } }, input, el('button', { class: 'btn btn-primary' }, 'Lock in')),
          secret ? el('div', { class: 'muted' }, 'Hidden so the other player cannot copy.') : null);
        input.focus();
      });
      const botAnswer = (list, theme) => {
        const fresh = list.filter(w => !used[1].has(w));
        const [lo, hi] = { easy: [0, .35], mid: [.2, .75], hard: [.55, 1] }[level];
        const slice = fresh.slice(Math.floor(lo * fresh.length), Math.max(Math.floor(lo * fresh.length) + 1, Math.ceil(hi * fresh.length)));
        return Math.random() < .08 ? '' : pick(slice); // the odd blank, so it is beatable
      };
      const handoff = who => new Promise(resolve => body.replaceChildren(el('div', { class: 'big' }, `Pass to ${names[who]}`), el('button', { class: 'btn btn-primary', onclick: () => resolve() }, "I'm ready")));

      async function play() {
        const theme = themes[round], list = THEMES[theme];
        const raw = [];
        if (mode === 'bot') { raw[0] = await ask(0, theme, false); raw[1] = botAnswer(list, theme); }
        else { await handoff(0); raw[0] = await ask(0, theme, true); await handoff(1); raw[1] = await ask(1, theme, true); }
        if (signal.aborted) return;
        const ans = raw.map(r => norm(list, r || ''));
        const lines = ans.map((w, i) => {
          let pts = 0, why;
          if (!w) why = 'no answer';
          else if (!list.includes(w)) why = 'judges have not heard of that one';
          else if (used[i].has(w)) why = 'already used';
          else if (ans[0] === ans[1]) why = 'same answer, cancelled out';
          else { pts = points(list, list.indexOf(w)); why = pts >= 8 ? 'what a find!' : pts >= 5 ? 'nice and niche' : pts >= 3 ? 'fairly common' : 'everyone says that'; }
          if (w && list.includes(w)) used[i].add(w);
          score[i] += pts;
          return el('div', { class: 'panel sk', style: 'min-width:200px;text-align:center' },
            el('div', { class: 'muted' }, names[i]), el('div', { class: 'big' }, w || '—'), el('div', { class: 'big', style: 'font-size:28px' }, `+${pts}`), el('div', { class: 'muted' }, why));
        });
        sync();
        const deep = list.slice(-3).join(', ');
        ans[0] && list.includes(ans[0]) ? Sfx.good() : Sfx.bad();
        body.replaceChildren(el('div', { class: 'big' }, theme), el('div', { class: 'bt-pair' }, lines),
          el('div', { class: 'muted' }, `Rarest the judges know: ${deep}`),
          el('button', { class: 'btn btn-primary', onclick: () => (++round < 5 ? play() : end()) }, round < 4 ? 'Next theme' : 'Final score'));
      }
      function end() {
        const w = score[0] === score[1] ? null : score[0] > score[1] ? 0 : 1;
        Stats.record('rarefind', { win: mode === 'bot' && w != null ? w === 0 : undefined, score: mode === 'bot' ? score[0] : undefined });
        (w === 0 || (mode === 'duel' && w != null)) ? (Sfx.win(), celebrate()) : Sfx.lose();
        body.replaceChildren(el('div', { class: 'big' }, w == null ? 'A tie!' : `${names[w]} win${w === 0 && mode === 'bot' ? '' : 's'}!`),
          el('div', {}, `${score[0]} – ${score[1]}`), el('button', { class: 'btn btn-primary', onclick: start }, 'Play again'));
      }
      play();
    }
    start();
  },
});
