'use strict';
/* Online two-player rooms over WebRTC (PeerJS public broker; no server of our own).
   Host is always player 0, guest player 1. Messages are {t: type, d: data}. */
const Net = (() => {
  const PEERJS = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  const PREFIX = 'graphite-arcade-';
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid confusion with 1/0
  let loading = null;

  function loadLib() {
    if (window.Peer) return Promise.resolve();
    return loading || (loading = new Promise((ok, fail) => {
      const s = el('script', { src: PEERJS });
      s.onload = ok;
      s.onerror = () => { loading = null; fail(new Error('Could not load the online library. Are you offline?')); };
      document.head.append(s);
    }));
  }

  /** Wrap a PeerJS DataConnection in a small typed-message link. */
  function makeLink(peer, conn, me, seed, signal) {
    const handlers = {};
    let closed = false, meReady = null, themReady = false;
    const tryGo = () => { if (meReady && themReady) { const fn = meReady; meReady = null; themReady = false; fn(); } };
    const link = {
      me, host: me === 0, seed,
      /** Mark this side ready (e.g. for the next round); fn runs once both sides are ready. */
      ready(fn) { meReady = fn; link.send('_ready'); tryGo(); },
      /** Send a typed message to the other player. */
      send(t, d) { if (!closed && conn.open) conn.send({ t, d }); },
      /** Register the handler for a message type (replaces any previous one). */
      on(t, fn) { handlers[t] = fn; return link; },
      /** Called once when the other player leaves or the connection drops. */
      onClose: null,
      get open() { return !closed; },
      close() {
        if (closed) return;
        closed = true;
        try { conn.close(); } catch { /* already closed */ }
        peer.destroy();
      },
    };
    conn.on('data', m => {
      if (!m) return;
      if (m.t === '_ready') { themReady = true; return tryGo(); }
      if (handlers[m.t]) handlers[m.t](m.d);
    });
    const lost = () => {
      if (closed) return;
      closed = true; peer.destroy();
      if (!signal.aborted) { toast('The other player left', 2600); Sfx.bad(); link.onClose && link.onClose(); }
    };
    conn.on('close', lost);
    conn.on('error', lost);
    signal.addEventListener('abort', () => link.close());
    return link;
  }

  /**
   * Show a host/join room panel in `container`. Resolves onReady(link) once both
   * players are connected. Everything is torn down when `signal` aborts.
   */
  function lobby(container, gameId, signal, onReady) {
    const status = el('p', { class: 'muted', style: 'margin:8px 0 0;min-height:24px' });
    const codeIn = el('input', { class: 'input', placeholder: 'CODE', maxlength: 4, autocomplete: 'off', spellcheck: 'false', style: 'max-width:140px;text-align:center;text-transform:uppercase;letter-spacing:4px' });
    let peer = null;
    const reset = () => { if (peer) { peer.destroy(); peer = null; } };
    signal.addEventListener('abort', reset);
    const fail = msg => { reset(); status.textContent = msg; Sfx.bad(); };

    async function host() {
      reset();
      status.textContent = 'Opening a room...';
      try { await loadLib(); } catch (e) { return fail(e.message); }
      if (signal.aborted) return;
      const code = Array.from({ length: 4 }, () => pick(ALPHA)).join('');
      const p = peer = new Peer(PREFIX + gameId + '-' + code);
      p.on('open', () => {
        container.replaceChildren(panel(
          el('div', { class: 'big' }, 'Room ', el('span', { class: 'scribble-u', style: 'letter-spacing:6px' }, code)),
          el('p', { class: 'muted' }, 'Tell your friend this code. They open this game, pick Online, and join with it.'),
          el('p', {}, 'Waiting for them to join...'),
          el('button', { class: 'btn', onclick: () => { reset(); draw(); } }, 'Cancel')));
      });
      p.on('connection', conn => {
        if (peer !== p) return conn.close();
        conn.on('open', () => {
          const seed = rand(2 ** 31);
          conn.send({ t: 'hello', d: { seed } });
          peer = null; // ownership moves to the link
          Sfx.good();
          onReady(makeLink(p, conn, 0, seed, signal));
        });
      });
      p.on('error', e => fail(e.type === 'unavailable-id' ? 'That code clashed, try again.' : 'Could not open a room: ' + (e.type || e.message)));
    }

    async function join() {
      const code = codeIn.value.trim().toUpperCase();
      if (!/^[A-Z]{4}$/.test(code)) return toast('Codes are 4 letters');
      reset();
      status.textContent = 'Connecting...';
      try { await loadLib(); } catch (e) { return fail(e.message); }
      if (signal.aborted) return;
      const p = peer = new Peer();
      p.on('open', () => {
        const conn = p.connect(PREFIX + gameId + '-' + code, { reliable: true });
        const timer = setTimeout(() => { if (peer === p) fail('No answer. Check the code.'); }, 12000);
        conn.on('data', m => {
          if (m?.t !== 'hello' || peer !== p) return;
          clearTimeout(timer);
          peer = null;
          Sfx.good();
          onReady(makeLink(p, conn, 1, m.d.seed, signal));
        });
      });
      p.on('error', e => fail(e.type === 'peer-unavailable' ? 'No room with that code.' : 'Could not connect: ' + (e.type || e.message)));
    }

    const panel = (...kids) => el('div', { class: 'panel sk center', style: 'max-width:440px;margin:0 auto' }, ...kids);
    function draw() {
      status.textContent = '';
      codeIn.value = '';
      container.replaceChildren(panel(
        el('div', { class: 'big' }, 'Play online'),
        el('p', { class: 'muted' }, 'Two devices, one room code.'),
        el('button', { class: 'btn btn-primary', onclick: host }, 'Host a room'),
        el('p', { class: 'muted', style: 'margin:14px 0 6px' }, 'or join a friend'),
        el('div', { class: 'row', style: 'justify-content:center' }, codeIn, el('button', { class: 'btn', onclick: join }, 'Join')),
        status));
    }
    codeIn.addEventListener('keydown', e => { if (e.key === 'Enter') join(); });
    draw();
  }

  return { lobby };
})();
