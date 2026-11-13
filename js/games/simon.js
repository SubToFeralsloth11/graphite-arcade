Games.register({
  id: 'simon',
  title: 'Copycat',
  blurb: 'Four scribbled pads light up in a pattern. Repeat it. It gets longer. It always gets longer.',
  group: 'button',
  tags: ['solo', 'memory'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><rect x="30" y="6" width="28" height="30" rx="6"/><rect x="62" y="6" width="28" height="30" rx="6" class="hatch"/><rect x="30" y="42" width="28" height="30" rx="6"/><rect x="62" y="42" width="28" height="30" rx="6"/></svg>`,
  help: 'Watch the pads flash, then press them in the same order (or use keys 1-4). Each round adds one more step. One mistake ends the run. Score = longest sequence you repeated.',
  mount(root, signal) {
    const NOTES = [330, 392, 494, 587];
    const pads = NOTES.map((_, i) => el('button', { class: 'bt-pad sk', onclick: () => input(i) }, String(i + 1)));
    const msg = el('div', { class: 'msg' }, 'Press start');
    const go = el('button', { class: 'btn btn-primary', onclick: () => start() }, 'Start');
    root.append(el('div', { class: 'center' }, msg, el('div', { class: 'bt-pads' }, pads), go));
    onKeys(signal, k => /^[1-4]$/.test(k) && input(+k - 1));
    let seq = [], pos = 0, listening = false;
    const flash = async i => {
      pads[i].classList.add('lit'); Sfx._tone(NOTES[i], 0, .25);
      await sleep(320); pads[i].classList.remove('lit'); await sleep(140);
    };
    async function play() {
      listening = false; msg.textContent = `Watch... (${seq.length})`;
      await sleep(500);
      for (const i of seq) { if (signal.aborted) return; await flash(i); }
      pos = 0; listening = true; msg.textContent = 'Your turn';
    }
    function start() { go.style.visibility = 'hidden'; seq = [rand(4)]; play(); }
    async function input(i) {
      if (!listening) return;
      flash(i);
      if (seq[pos] !== i) {
        listening = false; Sfx.lose();
        const score = seq.length - 1;
        const s = Stats.record('simon', { score });
        msg.textContent = `Wrong pad! You got ${score}${s.newBest ? ' (new best!)' : ''}`;
        go.textContent = 'Again'; go.style.visibility = '';
        return;
      }
      if (++pos === seq.length) { listening = false; Sfx.good(); seq.push(rand(4)); await sleep(500); if (!signal.aborted) play(); }
    }
  },
});
