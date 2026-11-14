'use strict';
/* Shared helpers: DOM, randomness, storage, stats, sound, dictionary, UI widgets. */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function el(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) {
    if (k == null || k === false) continue;
    e.append(k.nodeType ? k : document.createTextNode(k));
  }
  return e;
}

const rand = n => Math.floor(Math.random() * n);
const pick = (a, rng = Math.random) => a[Math.floor(rng() * a.length)];
function shuffle(a, rng = Math.random) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function seeded(seed) { // mulberry32
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const dayNumber = () => Math.floor(new Date(todayKey() + 'T00:00:00Z').getTime() / 86400000);
const dailyRng = salt => seeded(dayNumber() * 7919 + salt);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- storage & stats ---------- */
const Store = {
  get(k, d) { try { const v = localStorage.getItem('ga:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ga:' + k, JSON.stringify(v)); } catch {} },
};

const Stats = {
  all() { return Store.get('stats', {}); },
  of(id) { return this.all()[id] || { played: 0, won: 0, best: null, streak: 0, maxStreak: 0 }; },
  /** best: 'high' keeps max score, 'low' keeps min (moves, steps). */
  record(id, { win, score, best = 'high' } = {}) {
    const all = this.all();
    const s = all[id] || { played: 0, won: 0, best: null, streak: 0, maxStreak: 0 };
    s.played++;
    if (win) { s.won++; s.streak++; s.maxStreak = Math.max(s.maxStreak, s.streak); } else if (win === false) s.streak = 0;
    if (score != null && (s.best == null || (best === 'high' ? score > s.best : score < s.best))) { s.best = score; s.newBest = true; }
    else s.newBest = false;
    all[id] = s;
    Store.set('stats', all);
    Activity.touch();
    return s;
  },
  dailyDone(id) { return Store.get(`daily:${id}:${todayKey()}`, null); },
  markDaily(id, result) { Store.set(`daily:${id}:${todayKey()}`, result); },
};

const Activity = {
  touch() {
    const a = Store.get('activity', { last: null, streak: 0 });
    const t = todayKey();
    if (a.last === t) return;
    const y = new Date(); y.setDate(y.getDate() - 1);
    a.streak = a.last === todayKey(y) ? a.streak + 1 : 1;
    a.last = t;
    Store.set('activity', a);
    window.dispatchEvent(new Event('activity'));
  },
  streak() {
    const a = Store.get('activity', { last: null, streak: 0 });
    const y = new Date(); y.setDate(y.getDate() - 1);
    return a.last === todayKey() || a.last === todayKey(y) ? a.streak : 0;
  },
};

/* ---------- pencil sounds (synthesised, no assets) ---------- */
const Sfx = {
  ctx: null,
  muted: Store.get('muted', false),
  _ac() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); return this.ctx; },
  _noise(dur, freq, gain) {
    if (this.muted) return;
    const ac = this._ac(), len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = .8;
    const g = ac.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(ac.destination); src.start();
  },
  _tone(freq, t0, dur, gain = .08, type = 'triangle') {
    if (this.muted) return;
    const ac = this._ac(), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    const t = ac.currentTime + t0;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + .05);
  },
  tap() { this._noise(.05, 3200 + rand(1200), .35); },
  scratch() { this._noise(.16, 2200 + rand(800), .5); },
  good() { this._tone(660, 0, .15); this._tone(880, .08, .2); },
  bad() { this._tone(220, 0, .22, .07, 'sawtooth'); },
  win() { [523, 659, 784, 1046].forEach((f, i) => this._tone(f, i * .1, .35)); },
  lose() { [392, 330, 262].forEach((f, i) => this._tone(f, i * .14, .4, .07)); },
  toggle() { this.muted = !this.muted; Store.set('muted', this.muted); return this.muted; },
};

/* ---------- dictionary ---------- */
const Dict = (() => {
  const words = window.WORDS_RAW.split(' ');
  for (const k in LISTS) for (const w of LISTS[k]) words.push(w);
  const sorted = [...new Set(words)].sort();
  const set = new Set(sorted);
  const byLen = {};
  const lowerBound = p => { let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < p) lo = m + 1; else hi = m; } return lo; };
  return {
    sorted,
    has(w) {
      w = w.toLowerCase();
      if (set.has(w)) return true;
      // plurals / 3rd-person: foods, boxes, berries, wolves, knives
      if (w.length < 4 || !w.endsWith('s') || w.endsWith('ss')) return false;
      if (set.has(w.slice(0, -1))) return true;
      if (w.endsWith('es') && set.has(w.slice(0, -2))) return true;
      if (w.endsWith('ies') && set.has(w.slice(0, -3) + 'y')) return true;
      if (w.endsWith('ves')) { const s = w.slice(0, -3); return set.has(s + 'f') || set.has(s + 'fe'); }
      return false;
    },
    ofLen(n) { return byLen[n] || (byLen[n] = sorted.filter(w => w.length === n)); },
    /** [start, end) index range of words beginning with prefix p. */
    range(p) { const a = lowerBound(p); const b = lowerBound(p + '{'); return [a, b]; },
    hasPrefix(p) { const [a, b] = this.range(p); return b > a; },
  };
})();

/* ---------- UI widgets ---------- */
function toast(msg, ms = 1600) {
  const t = el('div', { class: 'toast' }, msg);
  $('#toasts').append(t);
  setTimeout(() => t.remove(), ms);
}

function modal(title, body, actions = [{ label: 'OK', primary: true }]) {
  return new Promise(resolve => {
    const close = v => { bg.remove(); resolve(v); };
    const bg = el('div', { class: 'modal-bg', onclick: e => { if (e.target === bg) close(null); } },
      el('div', { class: 'modal sk' },
        el('h3', { class: 'scribble-u' }, title),
        el('div', { class: 'body' }, body),
        el('div', { class: 'actions' }, actions.map(a =>
          el('button', { class: 'btn' + (a.primary ? ' btn-primary' : ''), onclick: () => close(a.value ?? a.label) }, a.label)))));
    document.body.append(bg);
    const primary = bg.querySelector('.btn-primary'); if (primary) primary.focus();
  });
}

function statRow(s, labels = {}) {
  const pct = s.played ? Math.round(100 * s.won / s.played) : 0;
  return el('div', { class: 'statrow' },
    el('div', {}, el('b', {}, s.played), 'played'),
    el('div', {}, el('b', {}, pct + '%'), 'won'),
    el('div', {}, el('b', {}, s.streak), 'streak'),
    s.best != null ? el('div', {}, el('b', {}, s.best), labels.best || 'best') : null);
}

function celebrate(n = 22) {
  const marks = ['✎', '★', '✓', '~', '✦', '♪', '!'];
  for (let i = 0; i < n; i++) {
    const c = el('div', { class: 'confetti' }, pick(marks));
    c.style.left = (10 + Math.random() * 80) + 'vw';
    c.style.top = (5 + Math.random() * 20) + 'vh';
    c.style.animationDelay = (Math.random() * .4) + 's';
    document.body.append(c);
    setTimeout(() => c.remove(), 2000);
  }
}

/** Segmented tab control. modes: [[value,label],...]. */
function tabs(modes, current, onChange) {
  const wrap = el('div', { class: 'tabs' });
  const render = () => {
    wrap.replaceChildren(...modes.map(([v, label]) =>
      el('button', { class: 'tab' + (v === current ? ' on' : ''), onclick: () => { if (v === current) return; current = v; Sfx.tap(); render(); onChange(v); } }, label)));
  };
  render();
  return wrap;
}

/** On-screen QWERTY. Returns {el, mark(letter,state), reset()}. */
function keyboard(onKey, { enter = true } = {}) {
  const rows = ['qwertyuiop', 'asdfghjkl', (enter ? '>' : '') + 'zxcvbnm' + (enter ? '<' : '')];
  const keys = {};
  const rank = { absent: 1, present: 2, correct: 3 };
  const root = el('div', { class: 'kb' }, rows.map(r => el('div', { class: 'kb-row' }, [...r].map(c => {
    const label = c === '>' ? 'enter' : c === '<' ? 'del' : c;
    const k = el('button', { class: 'key' + (c === '>' || c === '<' ? ' wide' : ''), onclick: e => { e.currentTarget.blur(); onKey(c === '>' ? 'enter' : c === '<' ? 'back' : c); } }, label);
    keys[c] = k;
    return k;
  }))));
  return {
    el: root,
    mark(c, state) {
      const k = keys[c]; if (!k) return;
      const prev = k.dataset.state;
      if (prev && rank[prev] >= rank[state]) return;
      k.dataset.state = state; k.classList.remove('absent', 'present', 'correct'); k.classList.add(state);
    },
    disable(c) { if (keys[c]) keys[c].disabled = true; },
  };
}

/** Global physical keyboard hookup, auto-removed when the game unmounts. */
function onKeys(signal, fn) {
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'Enter') fn('enter', e);
    else if (e.key === 'Backspace') fn('back', e);
    else if (/^[a-z]$/i.test(e.key)) fn(e.key.toLowerCase(), e);
    else fn(e.key, e);
  }, { signal });
}

/** Secret word entry for pass-and-play: hidden input, validated against dictionary. */
function secretPrompt(container, { title, hint, minLen = 3, maxLen = 12, exactLen, onDone }) {
  const input = el('input', { class: 'input', type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: '•••••', maxlength: exactLen || maxLen });
  const show = el('label', { class: 'muted' }, el('input', { type: 'checkbox', onchange: e => { input.type = e.target.checked ? 'text' : 'password'; } }), ' peek');
  const submit = () => {
    const w = input.value.trim().toLowerCase();
    if (!/^[a-z]+$/.test(w)) return toast('Letters only');
    if (exactLen && w.length !== exactLen) return toast(`Needs exactly ${exactLen} letters`);
    if (w.length < minLen || w.length > maxLen) return toast(`Between ${minLen} and ${maxLen} letters`);
    if (!Dict.has(w)) return toast("That's not in my dictionary");
    Sfx.scratch();
    container.replaceChildren(el('div', { class: 'panel sk center', style: 'max-width:440px;margin:0 auto' },
      el('div', { class: 'big' }, 'Pass it over'),
      el('p', { class: 'muted' }, 'Hand the screen to the guesser. No peeking!'),
      el('button', { class: 'btn btn-primary', onclick: () => onDone(w) }, "I'm the guesser, start")));
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  container.replaceChildren(el('div', { class: 'panel sk center', style: 'max-width:440px;margin:0 auto' },
    el('div', { class: 'big' }, title),
    el('p', { class: 'muted', style: 'margin:0' }, hint || 'The guesser should look away.'),
    input, show,
    el('button', { class: 'btn btn-primary', onclick: submit }, 'Lock it in')));
  setTimeout(() => input.focus(), 50);
}

/* ---------- game registry ---------- */
const Games = {
  list: [],
  map: {},
  register(g) { this.list.push(g); this.map[g.id] = g; },
};
