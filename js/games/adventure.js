Games.register({
  id: 'adventure',
  title: 'The Lost Eraser',
  blurb: 'A tiny text adventure through a school after dark. Type commands or tap the hints.',
  group: 'button',
  tags: ['solo', 'text', 'story'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M20 66 V22 l40 -12 l40 12 V66 z"/><path d="M50 66 V44 h20 V66"/><path d="M30 30 h12 v10 h-12 z M78 30 h12 v10 h-12 z"/><path d="M14 20 c4 -2 6 -6 6 -10"/></svg>`,
  help: 'Type commands like "go north", "take key", "use key", "look" or "inventory" and press Enter (short forms like "n" work too). Or tap the suggested commands. Find your lost eraser and get out of the school.',
  mount(root, signal) {
    const stage = el('div', { class: 'stage' });
    root.append(stage);
    const ROOMS = {
      hall: { name: 'Main Hall', desc: 'A long dark hall. Trophy cabinets glint. Doors lead north to the classroom, east to the library and west to the canteen. The front door is south.', exits: { n: 'class', e: 'library', w: 'canteen', s: 'door' }, items: [] },
      class: { name: 'Classroom 3B', desc: 'Rows of desks, a chalkboard covered in sums. Your desk is here, but the eraser is not.', exits: { s: 'hall' }, items: ['torch'] },
      library: { name: 'Library', desc: 'Dusty shelves. It is far too dark to see the back of the room.', dark: true, darkDesc: 'Pitch black. Something rustles. Better not go further without light.', exits: { w: 'hall', n: 'office' }, items: ['key'] },
      canteen: { name: 'Canteen', desc: 'Chairs stacked on tables. A sandwich sits forgotten on a tray, looking strangely fresh.', exits: { e: 'hall' }, items: ['sandwich'] },
      office: { name: "Head's Office", desc: 'A locked drawer in the big desk. A school cat sleeps on the chair, guarding it.', exits: { s: 'library' }, items: [], locked: true },
      door: { name: 'Front Door', desc: 'The front door. Locked from the outside? No, it just needs a push.', exits: { n: 'hall' }, items: [] },
    };
    const DIR = { n: 'north', s: 'south', e: 'east', w: 'west' };
    function start() {
      const rooms = structuredClone(ROOMS);
      let here = 'hall', inv = [], turns = 0, catFed = false, drawerOpen = false, over = false;
      const log = el('div', { class: 'bt-story sk' });
      const input = el('input', { class: 'input bt-plain', autocomplete: 'off', spellcheck: 'false', placeholder: 'what now?', style: 'flex:1' });
      const hints = el('div', { class: 'row', style: 'flex-wrap:wrap;justify-content:center' });
      stage.replaceChildren(el('div', { class: 'center', style: 'max-width:640px;margin:0 auto' }, log,
        el('form', { class: 'row', style: 'width:100%', onsubmit: e => { e.preventDefault(); cmd(input.value); input.value = ''; } }, input, el('button', { class: 'btn' }, 'Go')), hints));
      const say = (t, cls) => { log.append(el('p', { class: cls || '' }, t)); log.scrollTop = log.scrollHeight; };
      const room = () => rooms[here];
      const lit = () => !room().dark || inv.includes('torch');
      function look() {
        const r = room();
        say(r.name, 'bt-room');
        say(lit() ? r.desc : r.darkDesc);
        if (lit() && r.items.length) say(`You see: ${r.items.join(', ')}.`);
        say(`Exits: ${Object.keys(r.exits).map(d => DIR[d]).join(', ')}.`, 'muted');
        drawHints();
      }
      function drawHints() {
        const r = room(), opts = ['look', ...Object.keys(r.exits).map(d => 'go ' + DIR[d])];
        if (lit()) r.items.forEach(i => opts.push('take ' + i));
        inv.forEach(i => opts.push('use ' + i));
        hints.replaceChildren(...opts.map(o => el('button', { class: 'btn btn-ghost', onclick: () => cmd(o) }, o)));
      }
      function cmd(raw) {
        if (over) return;
        const t = raw.trim().toLowerCase().replace(/^(go|walk|move) /, '').split(/\s+/);
        if (!t[0]) return;
        say('> ' + raw.trim(), 'bt-cmd'); turns++; Sfx.tap();
        const [v, ...rest] = t, obj = rest.join(' ').replace(/^the /, '');
        const d = { n: 'n', north: 'n', s: 's', south: 's', e: 'e', east: 'e', w: 'w', west: 'w' }[v];
        if (d) {
          const to = room().exits[d];
          if (!to) return say("You can't go that way.");
          if (here === 'library' && d === 'n' && !lit()) return say('You stumble into a shelf in the dark. Ouch.');
          if (to === 'door' && !inv.includes('eraser')) return say("You can't leave without your eraser. Mum paid good money for it.");
          here = to;
          if (to === 'door') return win();
          return look();
        }
        if (v === 'look' || v === 'l') return look();
        if (v === 'inventory' || v === 'i' || v === 'inv') return say(inv.length ? `You carry: ${inv.join(', ')}.` : 'Your pockets are empty.');
        if (v === 'take' || v === 'get' || v === 'grab') {
          const r = room();
          if (!lit()) return say('You can not see anything to take.');
          if (!r.items.includes(obj)) return say(`There is no ${obj || 'that'} here.`);
          r.items.splice(r.items.indexOf(obj), 1); inv.push(obj); Sfx.good(); say(`Taken: ${obj}.`); return drawHints();
        }
        if (v === 'use' || v === 'give' || v === 'feed' || v === 'open' || v === 'unlock') {
          if (obj && !inv.includes(obj) && obj !== 'drawer' && obj !== 'cat') return say(`You don't have a ${obj}.`);
          if (here === 'office' && (obj === 'sandwich' || v === 'feed')) {
            if (!inv.includes('sandwich')) return say('The cat sniffs your empty hands, unimpressed.');
            inv.splice(inv.indexOf('sandwich'), 1); catFed = true; Sfx.good(); say('The cat leaps down and devours the sandwich, then curls up in a corner, purring.'); return drawHints();
          }
          if (here === 'office' && (obj === 'key' || obj === 'drawer')) {
            if (!catFed) return say('The cat hisses and swipes at your hand. It wants something.');
            if (!inv.includes('key')) return say('The drawer is locked.');
            if (drawerOpen) return say('The drawer is already open.');
            drawerOpen = true; room().items.push('eraser'); Sfx.good(); say('Click! The drawer slides open. Inside: your eraser, confiscated weeks ago!'); return drawHints();
          }
          if (obj === 'torch') return say(inv.includes('torch') ? 'The torch is already on. Dark rooms are no problem now.' : 'No torch.');
          if (obj === 'eraser') return say('You rub out a rude doodle on the wall. Much better.');
          return say('Nothing happens.');
        }
        if (v === 'eat' && obj === 'sandwich') return say('It might be useful. You resist.');
        if (v === 'help' || v === '?') return say('Try: look, go north/south/east/west, take <thing>, use <thing>, inventory.');
        say("I don't understand that. Try 'help'.");
      }
      function win() {
        over = true;
        say(room().name, 'bt-room');
        say(`You push open the door into the cool night air, eraser in hand. Escaped in ${turns} turns!`);
        const s = Stats.record('adventure', { win: true, score: turns, best: 'low' });
        Sfx.win(); celebrate();
        hints.replaceChildren(el('button', { class: 'btn btn-primary', onclick: start }, s.newBest ? 'New best! Play again' : 'Play again'));
      }
      say('It is 9pm. You snuck back into school to find your lost eraser. The doors clicked shut behind you...', 'muted');
      look(); input.focus();
    }
    start();
  },
});
