Games.register({
  id: 'pong',
  title: 'Paper Pong',
  blurb: 'Table tennis on lined paper. Play the bot or a friend on one keyboard.',
  group: 'arcade',
  tags: ['vs bot', '2P', 'classic'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M14 20 v30 M106 30 v30" stroke-width="5"/><path d="M60 6 v68" stroke-dasharray="5 6"/><circle cx="80" cy="34" r="5" class="fill"/><path d="M74 36 l-14 6 l-12 -4" stroke-dasharray="2 4"/></svg>`,
  help: 'First to 7 wins. Vs Bot: move with ↑/↓, W/S or the mouse/finger. Pass & Play: left player uses W/S, right player uses ↑/↓ (on touch, each player drags on their own half). Where the ball hits your paddle changes its angle, and every rally speeds it up.',
  mount(root, signal) {
    let mode = 'bot', level = 'med';
    const dust = Dust();
    const BOT = { easy: [260, .2], med: [380, .08], hard: [520, .02] };
    const lvlTabs = tabs([['easy', 'Easy'], ['med', 'Normal'], ['hard', 'Hard']], level, l => { level = l; game.restart(); });
    root.append(el('div', { class: 'center' }, el('div', { class: 'row' },
      tabs([['bot', 'Vs Bot'], ['duel', 'Pass & Play']], mode, m => { mode = m; lvlTabs.style.display = m === 'bot' ? '' : 'none'; game.restart(); }), lvlTabs)));
    const PH = 80, PW = 12;
    function serve(g, toward) {
      g.ball = { x: g.W / 2, y: g.H / 2, vx: 0, vy: 0, wait: 1, toward };
      g.trail = [];
    }
    const game = Arcade.mount(root, signal, {
      id: 'pong', title: 'Paper Pong', h: 420,
      intro: 'First to 7 points wins.',
      keysHelp: 'Vs Bot: ↑/↓ or mouse · 2P: W/S and ↑/↓ · P pause',
      init(g) {
        g.l = { y: g.H / 2 }; g.r = { y: g.H / 2 }; g.pts = [0, 0]; g.rally = 0; g.aim = g.H / 2; g.lastPtr = g.ptr.y;
        serve(g, Math.random() < .5 ? -1 : 1);
        g.info = mode === 'bot' ? `you vs bot (${level})` : 'left vs right';
      },
      update(g, dt) {
        const k = g.keys, b = g.ball, sp = 420;
        if (mode === 'bot') {
          const d = (k.has('down') ? 1 : 0) - (k.has('up') ? 1 : 0);
          if (d) g.l.y += d * sp * dt;
          else if (g.ptr.y !== g.lastPtr || g.ptr.down) g.l.y += clamp(g.ptr.y - g.l.y, -900 * dt, 900 * dt);
          g.lastPtr = g.ptr.y;
          const [bs, err] = BOT[level];
          if (b.vx > 0) { if (Math.random() < dt * 3) g.aim = b.y + (Math.random() - .5) * PH * err * 10; }
          else g.aim = g.H / 2;
          g.r.y += clamp(g.aim - g.r.y, -bs * dt, bs * dt);
        } else {
          g.l.y += ((k.has('KeyS') ? 1 : 0) - (k.has('KeyW') ? 1 : 0)) * sp * dt;
          g.r.y += ((k.has('ArrowDown') ? 1 : 0) - (k.has('ArrowUp') ? 1 : 0)) * sp * dt;
          if (g.ptr.down) { const side = g.ptr.x < g.W / 2 ? g.l : g.r; side.y += clamp(g.ptr.y - side.y, -900 * dt, 900 * dt); }
        }
        g.l.y = clamp(g.l.y, PH / 2, g.H - PH / 2); g.r.y = clamp(g.r.y, PH / 2, g.H - PH / 2);
        if (b.wait > 0) {
          b.wait -= dt;
          if (b.wait <= 0) { const a = (Math.random() - .5) * .8; b.vx = Math.cos(a) * 320 * b.toward; b.vy = Math.sin(a) * 320; g.rally = 0; }
          return;
        }
        b.x += b.vx * dt; b.y += b.vy * dt;
        g.trail.push([b.x, b.y]); if (g.trail.length > 8) g.trail.shift();
        if (b.y < 8) { b.y = 8; b.vy = Math.abs(b.vy); Sfx.tap(); }
        if (b.y > g.H - 8) { b.y = g.H - 8; b.vy = -Math.abs(b.vy); Sfx.tap(); }
        const paddle = (p, x, dir) => {
          if (Math.sign(b.vx) !== -dir) return;
          if (Math.abs(b.x - x) < PW / 2 + 8 && Math.abs(b.y - p.y) < PH / 2 + 8) {
            const off = (b.y - p.y) / (PH / 2), v = Math.min(820, Math.hypot(b.vx, b.vy) * 1.06), a = off * 1;
            b.vx = Math.cos(a) * v * dir; b.vy = Math.sin(a) * v; b.x = x + dir * (PW / 2 + 8);
            g.rally++; Sfx.scratch(); dust.burst(b.x, b.y, 8, 100);
          }
        };
        paddle(g.l, 30, 1); paddle(g.r, g.W - 30, -1);
        if (b.x < -20 || b.x > g.W + 20) {
          const scorer = b.x < 0 ? 1 : 0;
          g.pts[scorer]++;
          dust.burst(scorer ? 10 : g.W - 10, b.y, 20, 200);
          if (mode === 'bot') { g.score = g.pts[0]; scorer ? Sfx.bad() : Sfx.good(); } else Sfx.good();
          if (g.pts[scorer] >= 7) {
            const win = mode === 'bot' ? scorer === 0 : undefined;
            const title = mode === 'bot' ? (win ? 'You win!' : 'The bot wins') : `${scorer ? 'Right' : 'Left'} player wins!`;
            return g.end({ win, title, msg: `${g.pts[0]} - ${g.pts[1]}` });
          }
          serve(g, scorer ? -1 : 1);
        }
        dust.update(dt);
      },
      draw(g, P) {
        P.paper(g.W, g.H);
        for (let y = 10; y < g.H; y += 26) P.line(g.W / 2, y, g.W / 2, y + 12, { a: .35, w: 1.6 });
        P.text(String(g.pts[0]), g.W / 2 - 60, 50, { size: 64, a: .35 });
        P.text(String(g.pts[1]), g.W / 2 + 60, 50, { size: 64, a: .35 });
        for (const [p, x] of [[g.l, 30], [g.r, g.W - 30]]) { P.rect(x - PW / 2, p.y - PH / 2, PW, PH, { w: 2.2 }); P.hatchRect(x - PW / 2, p.y - PH / 2, PW, PH, { a: .55, gap: 3 }); }
        g.trail.forEach(([x, y], i) => P.circle(x, y, 2 + i * .5, { a: i * .04, w: 1 }));
        const b = g.ball;
        if (b.wait <= 0 || Math.floor(g.t * 6) % 2) { P.circle(b.x, b.y, 8, { w: 2.2 }); P.hatchCircle(b.x, b.y, 7, { a: .5, gap: 3 }); }
        if (g.rally >= 5) P.text(`rally ${g.rally}`, g.W / 2, g.H - 24, { size: 22, a: .4 });
        dust.draw(P);
      },
    });
  },
});
