Games.register({
  id: 'explore',
  title: 'Sketchbook Halls',
  blurb: 'Wander a hand-drawn maze in first person, gather the lost pages and find the stairs down before the scribble finds you.',
  group: 'arcade',
  tags: ['solo', '3d', 'explore', 'endless'],
  icon: `<svg viewBox="0 0 120 80" class="doodle"><path d="M0 4 L42 28 V54 L0 78 M120 4 L78 28 V54 L120 78 M0 78 L42 54 H78 L120 78"/><rect x="42" y="28" width="36" height="26" class="fill"/><path d="M52 54 V36 H68 V54 M56 46 h8 M54 50 h12"/><path d="M14 52 l12 -5 l5 10 l-12 5 Z M18 53 l7 -3 M19 57 l6 -2"/><path d="M96 40 q4 -8 8 0 q4 8 -4 6 q-8 -2 0 -8" /></svg>`,
  help: 'W/↑ walks forward, S/↓ walks back, A/D or ←/→ turn, Q/E sidestep, hold Shift (or the run pad) to sprint while stamina lasts. Drag on the view with the mouse or a finger to look around. Every floor is a freshly drawn set of rooms, corridors and doors that swing open as you get close. Collect every lost page on the floor, then find the stairs to go down. A scribble creature wanders the halls and comes after you when it hears you nearby (sprinting makes more noise); if it touches you the run is over. M toggles the minimap, which fills in as you see more. Score is the number of pages you rescue.',
  mount(root, signal) {
    const STEP = 2, TS = 64, PLANE = .66, NEAR = .2, FOG0 = 3, FOG1 = 13, DOOR = 9;
    const PAPER = '#f5f2e9';
    const FOGS = Array.from({ length: 21 }, (_, i) => `rgba(245,242,233,${(i / 20).toFixed(2)})`);
    const fogOf = d => clamp((d - FOG0) / (FOG1 - FOG0), 0, 1);
    const J = Float32Array.from({ length: 64 }, () => (Math.random() - .5) * 1.4);

    // ---------- pre-drawn textures and sprites (once per mount) ----------
    const mk = (fn) => { const c = document.createElement('canvas'); c.width = TS; c.height = TS; const x = c.getContext('2d'); fn(x, Pencil(x)); return c; };
    const thin = { w: 1.1, a: .5, r: .6 };
    const wallpaper = (x, Q) => {
      x.fillStyle = '#f0ebdd'; x.fillRect(0, 0, TS, TS);
      x.strokeStyle = INK(.12); x.lineWidth = 1; x.beginPath();
      for (let i = 4; i < TS; i += 8) { x.moveTo(i, 0); x.lineTo(i, 52); }
      x.stroke();
      x.fillStyle = INK(.18);
      for (let i = 0; i < TS; i += 8) for (let j = 6; j < 50; j += 12) x.fillRect(i + ((j / 12 | 0) % 2 ? 4 : 0) - 1, j, 2, 2);
      Q.line(0, 53, TS, 53, { w: 1.6, a: .6, r: .5 });
      Q.hatchRect(0, 54, TS, 10, { a: .25, gap: 3 });
    };
    const TEX = [];
    TEX[1] = mk((x, Q) => { // plaster bricks
      x.fillStyle = '#efeadc'; x.fillRect(0, 0, TS, TS);
      for (let r = 0; r < 8; r++) {
        const y = r * 8, off = r % 2 ? 16 : 0;
        Q.line(0, y, TS, y, thin);
        for (let bx = off; bx < TS; bx += 32) {
          Q.line(bx, y, bx, y + 8, thin);
          if (Math.random() < .3) Q.hatchRect(bx, y, 32, 8, { a: .16, gap: 3 });
        }
      }
    });
    TEX[2] = mk((x, Q) => { // bookshelf
      x.fillStyle = '#e8e1cf'; x.fillRect(0, 0, TS, TS);
      for (const y of [3, 23, 43]) {
        for (let bx = 5; bx < 58;) {
          const bw = 3 + Math.random() * 5 | 0, bh = 11 + Math.random() * 7 | 0;
          if (bx + bw > 59) break;
          x.fillStyle = INK(.05 + Math.random() * .28); x.fillRect(bx, y + 19 - bh, bw, bh);
          x.strokeStyle = INK(.6); x.lineWidth = .8; x.strokeRect(bx + .5, y + 19.5 - bh, bw - 1, bh);
          bx += bw + (Math.random() < .15 ? 3 : 0);
        }
        Q.line(2, y + 19, 62, y + 19, { w: 2, a: .8, r: .5 });
      }
      Q.line(3, 0, 3, TS, { w: 2.2, a: .8, r: .4 }); Q.line(61, 0, 61, TS, { w: 2.2, a: .8, r: .4 });
      Q.hatchRect(0, 0, 3, TS, { a: .4, gap: 2 }); Q.hatchRect(61, 0, 3, TS, { a: .4, gap: 2 });
    });
    TEX[3] = mk(wallpaper);
    TEX[4] = mk((x, Q) => { // framed doodle on wallpaper
      wallpaper(x, Q);
      x.fillStyle = '#fbf8ef'; x.fillRect(16, 12, 32, 26);
      Q.rect(16, 12, 32, 26, { w: 2, a: .85, r: .5 }); Q.rect(13, 9, 38, 32, { w: 1.4, a: .6, r: .5 });
      Q.hatch(c => { c.rect(13, 9, 38, 32); c.rect(16, 12, 32, 26); }, [13, 9, 38, 32], { a: .3, gap: 3 });
      Q.poly([[18, 34], [27, 22], [33, 29], [38, 24], [46, 34]], { w: 1.2, a: .7, r: .4, closed: false });
      Q.circle(40, 18, 3, { w: 1, a: .7, r: .3 });
    });
    TEX[5] = mk((x, Q) => { // door
      x.fillStyle = '#e3d9c3'; x.fillRect(0, 0, TS, TS);
      for (let i = 16; i < TS; i += 16) Q.line(i, 0, i, TS, thin);
      Q.rect(8, 8, 20, 20, { w: 1.2, a: .6, r: .4 }); Q.rect(36, 8, 20, 20, { w: 1.2, a: .6, r: .4 });
      Q.rect(8, 36, 20, 22, { w: 1.2, a: .6, r: .4 }); Q.rect(36, 36, 20, 22, { w: 1.2, a: .6, r: .4 });
      Q.hatchRect(0, 0, TS, TS, { a: .12, gap: 4 });
      x.fillStyle = INK(.75); x.beginPath(); x.arc(53, 33, 2.6, 0, 7); x.fill();
      Q.rect(1, 1, 62, 62, { w: 2, a: .8, r: .4 });
    });
    TEX[6] = mk((x, Q) => { // door jamb
      x.fillStyle = '#d9d2c0'; x.fillRect(0, 0, TS, TS);
      Q.hatchRect(0, 0, TS, TS, { a: .35, gap: 3, cross: true });
    });
    const HATCH = mk(x => {
      x.strokeStyle = INK(.6); x.lineWidth = 1; x.beginPath();
      for (let i = -TS; i < TS; i += 3) { x.moveTo(i, TS); x.lineTo(i + TS, 0); }
      x.stroke(); x.strokeStyle = INK(.35); x.beginPath();
      for (let i = -TS; i < TS; i += 5) { x.moveTo(i, 0); x.lineTo(i + TS, TS); }
      x.stroke();
    });

    const SPR = {
      page: mk((x, Q) => {
        x.save(); x.translate(32, 32); x.rotate(-.12);
        x.fillStyle = '#fffdf6'; x.fillRect(-13, -17, 26, 34);
        Q.poly([[-13, -17], [7, -17], [13, -11], [13, 17], [-13, 17]], { w: 1.8, a: .9, r: .5 });
        Q.poly([[7, -17], [7, -11], [13, -11]], { w: 1.2, a: .7, r: .3, closed: false });
        for (let y = -9; y < 14; y += 4) Q.line(-9, y, 9 - (y > 8 ? 8 : 0), y, { w: .9, a: .45, r: .6 });
        x.restore();
        x.strokeStyle = INK(.5); x.lineWidth = 1.2; x.beginPath();
        for (const [a, b] of [[8, 10], [56, 12], [6, 52], [58, 50]]) { x.moveTo(a - 3, b); x.lineTo(a + 3, b); x.moveTo(a, b - 3); x.lineTo(a, b + 3); }
        x.stroke();
      }),
      stairs: mk((x, Q) => {
        x.fillStyle = '#e6e0cf'; x.fillRect(6, 8, 52, 56);
        for (let i = 0; i < 6; i++) {
          const y = 22 + i * 7, inset = 8 + i * 3;
          x.fillStyle = INK(.06 + i * .07); x.fillRect(inset, y, TS - inset * 2, 7);
          Q.line(inset, y, TS - inset, y, { w: 1.4, a: .8, r: .4 });
        }
        Q.poly([[6, 64], [6, 8], [58, 8], [58, 64]], { w: 2.4, a: .9, r: .5, closed: false });
        Q.line(8, 22, 26, 58, { w: 1.2, a: .6, r: .4 }); Q.line(56, 22, 38, 58, { w: 1.2, a: .6, r: .4 });
        Q.text('down', 32, 15, { size: 12 });
      }),
      plant: mk((x, Q) => {
        x.fillStyle = '#ece5d3'; x.beginPath(); x.moveTo(20, 46); x.lineTo(44, 46); x.lineTo(40, 63); x.lineTo(24, 63); x.fill();
        Q.poly([[20, 46], [44, 46], [40, 63], [24, 63]], { w: 1.8, r: .5 });
        Q.hatch(c => { c.moveTo(20, 46); c.lineTo(44, 46); c.lineTo(40, 63); c.lineTo(24, 63); }, [20, 46, 24, 17], { a: .3, gap: 3 });
        for (const [ex, ey] of [[14, 14], [32, 4], [50, 12], [10, 30], [54, 28], [24, 22], [42, 20]]) {
          Q.line(32, 46, ex, ey, { w: 1.4, a: .8, r: 1 });
          Q.line(ex, ey, (32 + ex) / 2 + (ey - 46) * .12, (46 + ey) / 2, { w: 1, a: .6, r: .6 });
        }
      }),
      lamp: mk((x, Q) => {
        x.fillStyle = '#fbf6e2'; x.beginPath(); x.moveTo(22, 4); x.lineTo(42, 4); x.lineTo(50, 22); x.lineTo(14, 22); x.fill();
        Q.poly([[22, 4], [42, 4], [50, 22], [14, 22]], { w: 1.8, r: .5 });
        Q.line(32, 22, 32, 60, { w: 2, r: .4 }); Q.line(22, 62, 42, 62, { w: 2.4, r: .4 });
        x.strokeStyle = INK(.25); x.lineWidth = 1; x.beginPath();
        for (const a of [-1.2, -.6, 0, .6, 1.2]) { x.moveTo(32 + Math.sin(a) * 22, 24 + Math.cos(a) * 6); x.lineTo(32 + Math.sin(a) * 30, 28 + Math.cos(a) * 9); }
        x.stroke();
      }),
      chair: mk((x, Q) => {
        Q.rect(18, 8, 28, 26, { w: 1.8, r: .5 }); Q.hatchRect(18, 8, 28, 26, { a: .18, gap: 4 });
        Q.line(14, 36, 50, 36, { w: 2.4, r: .5 }); Q.line(14, 40, 50, 40, { w: 1.4, r: .5 });
        Q.line(17, 40, 15, 63, { w: 1.8, r: .4 }); Q.line(47, 40, 49, 63, { w: 1.8, r: .4 });
        Q.line(24, 40, 25, 56, { w: 1.2, a: .5, r: .4 }); Q.line(40, 40, 39, 56, { w: 1.2, a: .5, r: .4 });
      }),
      books: mk((x, Q) => {
        let y = 62;
        for (const [w, h, o] of [[40, 8, 0], [34, 7, 4], [38, 9, -2], [28, 6, 5]]) {
          y -= h; x.fillStyle = '#efe7d2'; x.fillRect(32 - w / 2 + o, y, w, h);
          Q.rect(32 - w / 2 + o, y, w, h, { w: 1.4, r: .4 }); Q.line(32 - w / 2 + o + 4, y, 32 - w / 2 + o + 4, y + h, { w: 1, a: .5, r: .3 });
        }
      }),
      easel: mk((x, Q) => {
        Q.line(32, 4, 14, 63, { w: 1.8, r: .4 }); Q.line(32, 4, 50, 63, { w: 1.8, r: .4 }); Q.line(32, 10, 32, 60, { w: 1.4, a: .6, r: .4 });
        x.fillStyle = '#fffdf6'; x.fillRect(12, 12, 40, 30);
        Q.rect(12, 12, 40, 30, { w: 1.8, r: .4 }); Q.line(10, 43, 54, 43, { w: 2.2, r: .4 });
        Q.poly([[16, 36], [24, 24], [30, 32], [36, 20], [48, 36]], { w: 1.2, a: .7, r: .6, closed: false });
      }),
      ball: mk((x, Q) => {
        x.fillStyle = '#fbf8ef'; x.beginPath(); x.arc(32, 44, 18, 0, 7); x.fill();
        Q.circle(32, 44, 18, { w: 1.8, r: 2 });
        x.strokeStyle = INK(.45); x.lineWidth = 1; x.beginPath();
        for (let i = 0; i < 9; i++) { const a = Math.random() * 6.28, b = Math.random() * 6.28; x.moveTo(32 + Math.cos(a) * 15, 44 + Math.sin(a) * 15); x.lineTo(32 + Math.cos(b) * 8, 44 + Math.sin(b) * 8); }
        x.stroke();
      }),
    };
    const CRIT = [0, 1, 2].map(() => mk((x, Q) => {
      x.strokeStyle = INK(.85); x.lineWidth = 1.3; x.beginPath();
      let a = 0, px = 32, py = 30;
      x.moveTo(px, py);
      for (let i = 0; i < 150; i++) {
        a += (Math.random() - .5) * 1.6;
        px = clamp(px + Math.cos(a) * 4, 8, 56); py = clamp(py + Math.sin(a) * 4, 6, 50);
        if (Math.hypot(px - 32, py - 28) > 22) a += Math.PI * .8;
        x.lineTo(px, py);
      }
      x.stroke();
      for (const ex of [24, 40]) {
        x.fillStyle = '#fffdf6'; x.beginPath(); x.arc(ex, 24, 6, 0, 7); x.fill();
        Q.circle(ex, 24, 6, { w: 1.4, r: .4 });
        x.fillStyle = INK(.95); x.beginPath(); x.arc(ex + (Math.random() - .5) * 3, 25, 2.2, 0, 7); x.fill();
      }
      for (const lx of [22, 30, 36, 44]) Q.line(lx, 46, lx + (Math.random() - .5) * 10, 63, { w: 1.6, r: 1.2 });
    }));
    const KIND = {
      page: { img: SPR.page, scale: .42, lift: .18 },
      stairs: { img: SPR.stairs, scale: .95, lift: 0 },
      plant: { img: SPR.plant, scale: .7, lift: 0, block: .3 },
      lamp: { img: SPR.lamp, scale: .95, lift: 0, block: .22 },
      chair: { img: SPR.chair, scale: .6, lift: 0, block: .28 },
      easel: { img: SPR.easel, scale: .9, lift: 0, block: .3 },
      books: { img: SPR.books, scale: .38, lift: 0 },
      ball: { img: SPR.ball, scale: .25, lift: 0 },
    };

    // ---------- level generation ----------
    function build(floor) {
      const G = Math.min(25 + floor * 3, 43), N = G * G;
      const map = new Uint8Array(N).fill(1), room = new Int16Array(N).fill(-1);
      const rooms = [];
      for (let tries = 0; tries < 300 && rooms.length < Math.min(5 + floor, 12); tries++) {
        const w = 4 + rand(5), h = 4 + rand(5), x = 1 + rand(G - w - 2), y = 1 + rand(G - h - 2);
        if (rooms.some(r => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y)) continue;
        const r = { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), theme: 1 + rand(3) };
        rooms.push(r);
        for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { map[j * G + i] = 0; room[j * G + i] = rooms.length - 1; }
      }
      const dig = (a, b) => {
        const hFirst = Math.random() < .5;
        let x = a.cx, y = a.cy;
        const walk = (tx, ty) => { while (x !== tx || y !== ty) { x += Math.sign(tx - x); y += Math.sign(ty - y); map[y * G + x] = 0; } };
        if (hFirst) { walk(b.cx, y); walk(x, b.cy); } else { walk(x, b.cy); walk(b.cx, y); }
      };
      for (let i = 1; i < rooms.length; i++) {
        let best = 0, bd = 1e9;
        for (let j = 0; j < i; j++) { const d = Math.abs(rooms[i].cx - rooms[j].cx) + Math.abs(rooms[i].cy - rooms[j].cy); if (d < bd) { bd = d; best = j; } }
        dig(rooms[i], rooms[best]);
      }
      for (let k = 0; k < 1 + (floor > 2) + (floor > 5); k++) { const a = pick(rooms), b = pick(rooms); if (a !== b) dig(a, b); }

      const open = i => map[i] === 0;
      const doorDir = new Uint8Array(N), doorOpen = new Float32Array(N), doors = [];
      for (let y = 1; y < G - 1; y++) for (let x = 1; x < G - 1; x++) {
        const i = y * G + x;
        if (!open(i) || room[i] >= 0) continue;
        const L = i - 1, R = i + 1, U = i - G, D = i + G;
        let dir = -1;
        if (map[L] && map[L] !== DOOR && map[R] && map[R] !== DOOR && open(U) && open(D) && (room[U] >= 0 || room[D] >= 0)) dir = 1;
        else if (map[U] && map[U] !== DOOR && map[D] && map[D] !== DOOR && open(L) && open(R) && (room[L] >= 0 || room[R] >= 0)) dir = 0;
        if (dir < 0 || Math.random() > .7 || [L, R, U, D].some(n => map[n] === DOOR)) continue;
        map[i] = DOOR; doorDir[i] = dir; doors.push(i);
      }
      // Walls take the look of the room they face.
      for (let i = 0; i < N; i++) {
        if (map[i] !== 1) continue;
        const x = i % G, y = i / G | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= G || ny >= G) continue;
          const r = room[ny * G + nx];
          if (r < 0 || map[ny * G + nx]) continue;
          const t = rooms[r].theme;
          map[i] = t !== 2 && Math.random() < .14 ? 4 : t;
          break;
        }
      }

      const L = { G, map, room, rooms, doorDir, doorOpen, doors, seen: new Uint8Array(N), sprites: [], floor };
      const start = rooms[0], startI = start.cy * G + start.cx;
      const dist = bfs(L, startI);
      const taken = new Set([startI]);
      const cellsOf = r => { const a = []; for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) a.push(j * G + i); return a; };
      const add = (kind, i, ox = 0, oy = 0) => { taken.add(i); const s = { kind, x: i % G + .5 + ox, y: (i / G | 0) + .5 + oy, ...KIND[kind] }; L.sprites.push(s); return s; };

      let exitR = rooms[0], far = -1;
      for (const r of rooms) { const d = dist[r.cy * G + r.cx]; if (d > far) { far = d; exitR = r; } }
      L.exit = add('stairs', exitR.cy * G + exitR.cx);

      const need = Math.min(3 + floor, 9);
      const pool = shuffle(rooms.filter(r => r !== start));
      L.pages = [];
      for (let k = 0; L.pages.length < need && k < need * 6; k++) {
        const r = pool.length ? pool[k % pool.length] : start;
        const free = cellsOf(r).filter(i => !taken.has(i));
        if (!free.length) continue;
        L.pages.push(add('page', pick(free)));
      }
      L.need = L.pages.length;

      for (const r of rooms) {
        const corners = [[r.x, r.y, -.18, -.18], [r.x + r.w - 1, r.y, .18, -.18], [r.x, r.y + r.h - 1, -.18, .18], [r.x + r.w - 1, r.y + r.h - 1, .18, .18]];
        for (const [cx, cy, ox, oy] of shuffle(corners).slice(0, rand(3))) {
          const i = cy * G + cx;
          if (taken.has(i) || [i - 1, i + 1, i - G, i + G].some(n => (map[n] === 0 && room[n] < 0) || map[n] === DOOR)) continue;
          add(pick(['plant', 'lamp', 'chair', 'easel']), i, ox, oy);
        }
        for (let k = rand(3); k > 0; k--) {
          const free = cellsOf(r).filter(i => !taken.has(i));
          if (free.length) add(pick(['books', 'ball', 'ball']), pick(free), (Math.random() - .5) * .5, (Math.random() - .5) * .5);
        }
      }
      L.floorCells = [];
      for (let i = 0; i < N; i++) if (room[i] >= 0) L.floorCells.push(i);

      L.crits = [];
      const nc = floor < 4 ? 1 : floor < 7 ? 2 : 3;
      const spawn = L.floorCells.filter(i => dist[i] >= far * .55);
      for (let k = 0; k < nc; k++) {
        const i = spawn.length ? pick(spawn) : pick(L.floorCells);
        L.crits.push({ x: i % G + .5, y: (i / G | 0) + .5, tx: i % G + .5, ty: (i / G | 0) + .5, sleep: 3 + k * 3, field: null, chase: false });
      }
      L.start = { x: start.cx + .5, y: start.cy + .5 };
      return L;
    }

    function bfs(L, from) {
      const { G, map } = L, d = new Int16Array(G * G).fill(-1), q = new Int32Array(G * G);
      let h = 0, t = 0;
      d[from] = 0; q[t++] = from;
      while (h < t) {
        const i = q[h++];
        for (const n of [i - 1, i + 1, i - G, i + G]) if (n >= 0 && n < d.length && d[n] < 0 && (map[n] === 0 || map[n] === DOOR)) { d[n] = d[i] + 1; q[t++] = n; }
      }
      return d;
    }

    // ---------- game ----------
    function newFloor(g) {
      const L = g.L = build(g.floor);
      g.x = L.start.x; g.y = L.start.y;
      let best = 0, bv = -1;
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; let d = 0; while (L.map[((g.y + Math.sin(a) * d) | 0) * L.G + ((g.x + Math.cos(a) * d) | 0)] === 0 && d < 20) d += .5; if (d > bv) { bv = d; best = a; } }
      g.ang = best; g.got = 0; g.pcell = -1; g.fade = 1; g.mmT = 0;
      say(g, `floor ${g.floor}: find ${L.need} lost page${L.need === 1 ? '' : 's'}`, 3);
    }
    const say = (g, s, t = 1.6) => { g.msg = s; g.msgT = t; };
    const solid = (L, x, y) => {
      if (x < 0 || y < 0 || x >= L.G || y >= L.G) return true;
      const i = (y | 0) * L.G + (x | 0), c = L.map[i];
      return c === DOOR ? L.doorOpen[i] < .8 : c !== 0;
    };
    const free = (L, x, y, r) => !solid(L, x - r, y - r) && !solid(L, x + r, y - r) && !solid(L, x - r, y + r) && !solid(L, x + r, y + r);

    function update(g, dt) {
      const L = g.L, G = L.G;
      g.fade = Math.max(0, g.fade - dt * 1.2);
      if (g.msgT > 0) g.msgT -= dt;
      if (g.dead) return;
      if (g.pressed.has('KeyM') || g.pressed.has('map')) g.mini = !g.mini;

      // look
      const k = g.keys;
      g.ang += ((k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0)) * 2.6 * dt;
      if (g.ptr.down) { if (g.dragX != null) g.ang += (g.ptr.x - g.dragX) * .0075; g.dragX = g.ptr.x; } else g.dragX = null;
      // move
      const fw = (k.has('up') ? 1 : 0) - (k.has('down') ? 1 : 0), st = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);
      const moving = fw || st;
      const wantRun = moving && (k.has('ShiftLeft') || k.has('ShiftRight') || k.has('run'));
      g.running = wantRun && g.stam > .02;
      g.stam = clamp(g.stam + (g.running ? -.3 : .17) * dt, 0, 1);
      if (moving) {
        const sp = (g.running ? 3.9 : 2.3) * dt / (fw && st ? Math.SQRT2 : 1);
        const c = Math.cos(g.ang), s = Math.sin(g.ang);
        const mx = (c * fw - s * st) * sp, my = (s * fw + c * st) * sp, R = .22;
        if (free(L, g.x + mx, g.y, R)) g.x += mx;
        if (free(L, g.x, g.y + my, R)) g.y += my;
        g.walk += dt * (g.running ? 13 : 9);
      }
      for (const s of L.sprites) if (s.block) {
        const dx = g.x - s.x, dy = g.y - s.y, d = Math.hypot(dx, dy), m = s.block + .22;
        if (d < m && d > 1e-4) { const nx = s.x + dx / d * m, ny = s.y + dy / d * m; if (free(L, nx, ny, .22)) { g.x = nx; g.y = ny; } }
      }

      // doors
      for (const i of L.doors) {
        const cx = i % G + .5, cy = (i / G | 0) + .5;
        const near = Math.hypot(g.x - cx, g.y - cy) < 1.7 || L.crits.some(c => c.sleep <= 0 && Math.hypot(c.x - cx, c.y - cy) < 1.3);
        const was = L.doorOpen[i];
        L.doorOpen[i] = clamp(was + (near ? 2.4 : -1.4) * dt, 0, 1);
        if (was === 0 && L.doorOpen[i] > 0 && Math.hypot(g.x - cx, g.y - cy) < 2) Sfx.tap();
      }

      // pickups and stairs
      for (const p of L.pages) if (!p.got && Math.hypot(p.x - g.x, p.y - g.y) < .55) {
        p.got = true; g.got++; g.score++; Sfx.good();
        L.sprites = L.sprites.filter(s => s !== p);
        const left = L.need - g.got;
        say(g, left ? `page found! ${left} to go` : 'all pages! now find the stairs down', left ? 1.6 : 3);
      }
      if (Math.hypot(L.exit.x - g.x, L.exit.y - g.y) < .7) {
        if (g.got >= L.need) { g.floor++; Sfx.win(); newFloor(g); return; }
        if (g.msgT <= 0) say(g, `the stairs are sealed: ${L.need - g.got} page${L.need - g.got === 1 ? '' : 's'} missing`, 2);
      }

      // scribble creatures
      const pc = (g.y | 0) * G + (g.x | 0);
      if (pc !== g.pcell) { g.pcell = pc; g.pdist = bfs(L, pc); }
      const base = Math.min(2, 1.05 + (g.floor - 1) * .12), hear = g.running ? 13 : 8;
      let nearest = 99;
      for (const c of L.crits) {
        c.anim = (c.anim || 0) + dt;
        const dp = Math.hypot(g.x - c.x, g.y - c.y);
        nearest = Math.min(nearest, dp);
        if (c.sleep > 0) { c.sleep -= dt; continue; }
        const ci = (c.y | 0) * G + (c.x | 0), pd = g.pdist[ci];
        c.chase = pd >= 0 && pd <= hear;
        const speed = (c.chase ? base * 1.35 : base) * dt;
        if (c.chase && pd <= 1) { c.tx = g.x; c.ty = g.y; }
        else if (Math.hypot(c.tx - c.x, c.ty - c.y) < .06) {
          if (!c.chase && (!c.field || c.field[ci] <= 0)) c.field = bfs(L, pick(L.floorCells));
          const f = c.chase ? g.pdist : c.field;
          let best = ci;
          for (const n of [ci - 1, ci + 1, ci - G, ci + G]) if (f[n] >= 0 && f[n] < f[best]) best = n;
          c.tx = best % G + .5; c.ty = (best / G | 0) + .5;
        }
        const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy);
        if (d > 1e-4) { const m = Math.min(d, speed); c.x += dx / d * m; c.y += dy / d * m; }
        if (Math.hypot(g.x - c.x, g.y - c.y) < .45) {
          g.dead = true; Sfx.bad();
          g.end({ win: false, title: 'Scribbled out', msg: `The scribble caught you on floor ${g.floor}. You rescued ${g.score} page${g.score === 1 ? '' : 's'}.` });
          return;
        }
      }
      g.near = nearest;
      if (nearest < 6 && (g.scritch -= dt) <= 0) { g.scritch = .2 + nearest * .14; Sfx.tap(); }
      g.info = `floor ${g.floor} · pages ${g.got}/${L.need}`;
    }

    // ---------- rendering ----------
    const NC = 720 / STEP;
    const zbuf = new Float32Array(NC), tops = new Float32Array(NC), bots = new Float32Array(NC), keyz = new Int32Array(NC);
    const mm = document.createElement('canvas');

    function drawMini(L, g) {
      const G = L.G, s = 3;
      mm.width = G * s; mm.height = G * s;
      const x = mm.getContext('2d');
      x.fillStyle = PAPER; x.fillRect(0, 0, G * s, G * s);
      for (let i = 0; i < G * G; i++) {
        if (!L.seen[i]) continue;
        const c = L.map[i];
        x.fillStyle = c === 0 ? '#e7e1d2' : c === DOOR ? 'rgba(140,100,60,.75)' : INK(.7);
        x.fillRect(i % G * s, (i / G | 0) * s, s, s);
      }
      x.fillStyle = INK(.9);
      for (const p of L.pages) if (!p.got && L.seen[(p.y | 0) * G + (p.x | 0)]) x.fillRect(p.x * s - 1.5, p.y * s - 1.5, 3, 3);
      if (L.seen[(L.exit.y | 0) * G + (L.exit.x | 0)]) { x.strokeStyle = INK(.9); x.lineWidth = 1.2; x.strokeRect(L.exit.x * s - 3, L.exit.y * s - 3, 6, 6); }
    }

    function draw(g, P) {
      const ctx = P.ctx, W = g.W, H = g.H, L = g.L, G = L.G, map = L.map;
      const bob = g.dead ? 0 : Math.sin(g.walk) * 3, hz = H / 2 + bob;
      const dx = Math.cos(g.ang), dy = Math.sin(g.ang), plx = -dy * PLANE, ply = dx * PLANE;
      const px = g.x, py = g.y;

      // ceiling and floor
      let gr = ctx.createLinearGradient(0, 0, 0, hz);
      gr.addColorStop(0, '#dcd7ca'); gr.addColorStop(1, PAPER);
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, hz);
      gr = ctx.createLinearGradient(0, hz, 0, H);
      gr.addColorStop(0, PAPER); gr.addColorStop(1, '#e6e0d0');
      ctx.fillStyle = gr; ctx.fillRect(0, hz, W, H - hz);
      // ruled notebook lines on the floor, projected in world space
      ctx.strokeStyle = 'rgba(70,110,160,.22)'; ctx.lineWidth = 1; ctx.beginPath();
      const seg = (ax, ay, bx, by) => {
        let ra = ax - px, rb = ay - py, d1 = ra * dx + rb * dy, l1 = -ra * dy + rb * dx;
        ra = bx - px; rb = by - py; let d2 = ra * dx + rb * dy, l2 = -ra * dy + rb * dx;
        if (d1 < NEAR && d2 < NEAR) return;
        if (d1 < NEAR) { const t = (NEAR - d1) / (d2 - d1); l1 += (l2 - l1) * t; d1 = NEAR; }
        else if (d2 < NEAR) { const t = (NEAR - d2) / (d1 - d2); l2 += (l1 - l2) * t; d2 = NEAR; }
        ctx.moveTo((1 + l1 / (d1 * PLANE)) * W / 2, hz + H / 2 / d1);
        ctx.lineTo((1 + l2 / (d2 * PLANE)) * W / 2, hz + H / 2 / d2);
      };
      const R = 8, gx = Math.floor(px), gy = Math.floor(py);
      for (let i = -R; i <= R + 1; i++) { seg(gx + i, py - R, gx + i, py + R); seg(px - R, gy + i, px + R, gy + i); }
      ctx.stroke();
      gr = ctx.createLinearGradient(0, hz, 0, hz + H / 8);
      gr.addColorStop(0, PAPER); gr.addColorStop(1, 'rgba(245,242,233,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, hz - 1, W, H / 8 + 1);

      // walls
      for (let ci = 0; ci < NC; ci++) {
        const col = ci * STEP, cam = 2 * (col + STEP / 2) / W - 1;
        const rdx = dx + plx * cam, rdy = dy + ply * cam;
        const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx), ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
        let mx = px | 0, my = py | 0, sx, sy, sdx, sdy;
        if (rdx < 0) { sx = -1; sdx = (px - mx) * ddx; } else { sx = 1; sdx = (mx + 1 - px) * ddx; }
        if (rdy < 0) { sy = -1; sdy = (py - my) * ddy; } else { sy = 1; sdy = (my + 1 - py) * ddy; }
        let side = 0, perp = 0, tex = 0, u = 0, prevDoor = false, key = -1;
        for (let n = 0; n < 60; n++) {
          if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
          if (mx < 0 || my < 0 || mx >= G || my >= G) break;
          const i = my * G + mx, c = map[i];
          L.seen[i] = 1;
          if (c === 0) { prevDoor = false; continue; }
          if (c === DOOR) {
            const dir = L.doorDir[i];
            if (dir === side) {
              const d = side === 0 ? sdx - ddx / 2 : sdy - ddy / 2;
              if (d < (side === 0 ? sdy : sdx)) {
                const w = side === 0 ? py + d * rdy : px + d * rdx, f = w - Math.floor(w), o = L.doorOpen[i];
                if (f >= o) { perp = d; tex = 5; u = f - o; key = i * 2 + side; break; }
              }
            }
            prevDoor = true; continue;
          }
          perp = side === 0 ? sdx - ddx : sdy - ddy;
          const w = side === 0 ? py + perp * rdy : px + perp * rdx;
          u = w - Math.floor(w);
          if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) u = 1 - u;
          tex = prevDoor ? 6 : c; key = i * 2 + side;
          break;
        }
        keyz[ci] = key;
        if (key < 0 || perp > FOG1) { zbuf[ci] = FOG1 + 1; keyz[ci] = -1; continue; }
        perp = Math.max(perp, .05);
        zbuf[ci] = perp;
        const lh = H / perp, top = hz - lh / 2;
        tops[ci] = top; bots[ci] = top + lh;
        const tx = Math.min(TS - 1, u * TS | 0);
        ctx.drawImage(TEX[tex], tx, 0, 1, TS, col, top, STEP, lh);
        const y0 = Math.max(0, top), y1 = Math.min(H, top + lh);
        const ha = clamp((perp - 1.2) / 6, 0, 1) * .5 + (side ? .12 : 0);
        if (ha > .02) { ctx.globalAlpha = ha; ctx.drawImage(HATCH, tx, 0, 1, TS, col, top, STEP, lh); ctx.globalAlpha = 1; }
        const f = Math.round(fogOf(perp) * 20);
        if (f) { ctx.fillStyle = FOGS[f]; ctx.fillRect(col, y0, STEP, y1 - y0); }
      }
      // pencil outlines: wall tops, bottoms and corners, faded with distance
      const seed = (Math.floor(g.t * 8) % 4) * 13;
      const paths = [[], [], []];
      for (let ci = 0; ci < NC; ci++) {
        if (keyz[ci] < 0) continue;
        const b = Math.min(2, fogOf(zbuf[ci]) * 3 | 0), j = J[(ci * 7 + seed) & 63];
        if (ci && keyz[ci - 1] >= 0) {
          const x0 = (ci - 1) * STEP + 1, x1 = ci * STEP + 1;
          if (keyz[ci] === keyz[ci - 1]) paths[b].push(x0, tops[ci - 1] + j, x1, tops[ci] + j, x0, bots[ci - 1] - j, x1, bots[ci] - j);
        }
        if (!ci || keyz[ci] !== keyz[ci - 1]) {
          const k = ci && keyz[ci - 1] >= 0 && zbuf[ci - 1] < zbuf[ci] ? ci - 1 : ci;
          const bk = Math.min(2, fogOf(zbuf[k]) * 3 | 0);
          paths[bk].push(ci * STEP + j * .5, tops[k], ci * STEP - j * .5, bots[k]);
        }
      }
      ctx.lineCap = 'round';
      [[.75, 1.6], [.45, 1.3], [.2, 1]].forEach(([a, w], b) => {
        const p = paths[b]; if (!p.length) return;
        ctx.strokeStyle = INK(a); ctx.lineWidth = w; ctx.beginPath();
        for (let i = 0; i < p.length; i += 4) { ctx.moveTo(p[i], p[i + 1]); ctx.lineTo(p[i + 2], p[i + 3]); }
        ctx.stroke();
      });

      // billboards
      const vis = [];
      const all = L.crits.length ? L.sprites.concat(L.crits) : L.sprites;
      for (const s of all) {
        const rx = s.x - px, ry = s.y - py, d = rx * dx + ry * dy;
        if (d < NEAR || d > FOG1) continue;
        s.d = d; s.sx = (1 + (-rx * dy + ry * dx) / (d * PLANE)) * W / 2;
        vis.push(s);
      }
      vis.sort((a, b) => b.d - a.d);
      for (const s of vis) {
        const crit = !s.kind;
        const img = crit ? CRIT[Math.floor(s.anim * 9 || 0) % 3] : s.img;
        const scale = crit ? .85 : s.scale, d = s.d;
        const size = H / d * scale;
        let lift = crit ? Math.abs(Math.sin(s.anim * 6 || 0)) * .05 : s.lift;
        if (s.kind === 'page') lift += Math.sin(g.t * 3 + s.x * 5) * .04;
        const sw = s.kind === 'page' ? size * (.3 + .7 * Math.abs(Math.cos(g.t * 1.6 + s.y * 3))) : size;
        const bottom = hz + H / 2 / d - lift * H / d, top = bottom - size, left = s.sx - sw / 2;
        const c0 = Math.max(0, Math.floor(left / STEP)), c1 = Math.min(NC - 1, Math.floor((left + sw) / STEP));
        if (c1 < c0) continue;
        ctx.globalAlpha = 1 - fogOf(d) * .95;
        for (let c = c0; c <= c1;) {
          if (zbuf[c] <= d) { c++; continue; }
          let e = c;
          while (e + 1 <= c1 && zbuf[e + 1] > d) e++;
          const xa = Math.max(left, c * STEP), xb = Math.min(left + sw, (e + 1) * STEP);
          if (xb > xa) ctx.drawImage(img, (xa - left) / sw * TS, 0, (xb - xa) / sw * TS, TS, xa, top, xb - xa, size);
          c = e + 1;
        }
        ctx.globalAlpha = 1;
      }

      // dread: scribbles creep in from the edges when the creature is close
      const near = g.dead ? 0 : g.near;
      if (near < 6 || g.dead) {
        const a = g.dead ? .85 : (1 - near / 6) * .55;
        ctx.strokeStyle = INK(a); ctx.lineWidth = 1.3; ctx.beginPath();
        const n = g.dead ? 70 : 34, t = Math.floor(g.t * 10);
        for (let i = 0; i < n; i++) {
          const h1 = Math.sin(i * 91.7 + t * 13.1) * 43758.5453, r1 = h1 - Math.floor(h1);
          const h2 = Math.sin(i * 17.3 + t * 7.7) * 24634.6345, r2 = h2 - Math.floor(h2);
          const edge = i % 4, len = (g.dead ? 260 : 30 + (1 - near / 6) * 90) * (.4 + r2);
          let x = edge < 2 ? r1 * W : edge === 2 ? 0 : W, y = edge < 2 ? (edge ? H : 0) : r1 * H;
          ctx.moveTo(x, y);
          for (let k = 0; k < 5; k++) {
            const ang = Math.atan2(H / 2 - y, W / 2 - x) + Math.sin(i + k * 2.1 + t) * 1.2;
            x += Math.cos(ang) * len / 5; y += Math.sin(ang) * len / 5; ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }
      if (g.dead) ctx.drawImage(CRIT[Math.floor(g.t * 9) % 3], W / 2 - 170, H / 2 - 190, 340, 340);

      // held pencil, bobbing as you walk
      if (!g.dead) {
        const ox = W - 110 + Math.cos(g.walk / 2) * 6, oy = H - 34 + Math.abs(Math.sin(g.walk / 2)) * 6;
        ctx.save(); ctx.translate(ox, oy); ctx.rotate(-.75);
        ctx.fillStyle = '#efe6c8'; ctx.fillRect(-10, 0, 20, 140);
        ctx.fillStyle = PAPER; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(0, -28); ctx.lineTo(10, 0); ctx.fill();
        ctx.fillStyle = INK(.85); ctx.beginPath(); ctx.moveTo(-3.5, -18); ctx.lineTo(0, -28); ctx.lineTo(3.5, -18); ctx.fill();
        P.line(-10, 0, -10, 140, { w: 2 }); P.line(10, 0, 10, 140, { w: 2 }); P.line(-10, 0, 0, -28, { w: 1.8 }); P.line(10, 0, 0, -28, { w: 1.8 });
        P.line(-3, 4, -3, 140, { w: 1, a: .4 }); P.line(3, 4, 3, 140, { w: 1, a: .4 });
        ctx.restore();
      }

      // HUD: pages, stamina, minimap, messages
      ctx.lineWidth = 1.4;
      for (let i = 0; i < L.need; i++) {
        const x = 14 + i * 20, y = 12;
        ctx.fillStyle = i < g.got ? INK(.55) : 'rgba(255,253,246,.9)'; ctx.fillRect(x, y, 14, 18);
        ctx.strokeStyle = INK(.8); ctx.strokeRect(x, y, 14, 18);
      }
      if (g.stam < .99) {
        ctx.fillStyle = INK(.12); ctx.fillRect(14, 38, 90, 6);
        ctx.fillStyle = INK(g.stam < .2 ? .75 : .45); ctx.fillRect(14, 38, 90 * g.stam, 6);
        ctx.strokeStyle = INK(.6); ctx.lineWidth = 1; ctx.strokeRect(14, 38, 90, 6);
      }
      if (g.mini) {
        if ((g.mmT -= 1 / 60) <= 0) { g.mmT = .25; drawMini(L, g); }
        const S = 132, mx = W - S - 12, my = 12, k = S / G;
        ctx.fillStyle = PAPER; ctx.fillRect(mx - 4, my - 4, S + 8, S + 8);
        ctx.drawImage(mm, mx, my, S, S);
        P.rect(mx - 4, my - 4, S + 8, S + 8, { w: 1.6, r: .8 });
        const ux = mx + px * k, uy = my + py * k;
        ctx.fillStyle = INK(.95); ctx.beginPath(); ctx.arc(ux, uy, 3, 0, 7); ctx.fill();
        ctx.strokeStyle = INK(.95); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(ux + dx * 9, uy + dy * 9); ctx.stroke();
      }
      if (g.msgT > 0) P.text(g.msg, W / 2, H - 44, { size: 28, a: Math.min(.9, g.msgT * 1.5) });
      if (g.fade > 0) {
        ctx.fillStyle = `rgba(245,242,233,${g.fade.toFixed(3)})`; ctx.fillRect(0, 0, W, H);
        P.text(`floor ${g.floor}`, W / 2, H / 2, { size: 54, a: g.fade * .9 });
      }
    }

    Arcade.mount(root, signal, {
      id: 'explore', title: 'Sketchbook Halls',
      intro: 'Collect the lost pages on each floor, then take the stairs down. Something scribbly is wandering the halls.',
      keysHelp: 'W/↑ S/↓ walk · A/D ←/→ turn · Q/E sidestep · Shift run · drag to look · M map · P pause',
      scoreLabel: 'pages',
      pads: [['left', '⟲'], ['up', '▲'], ['down', '▼'], ['right', '⟳'], ['run', 'run'], ['map', 'map']],
      init(g) {
        g.floor = 1; g.walk = 0; g.stam = 1; g.mini = true; g.dead = false; g.near = 99; g.scritch = 0; g.msg = ''; g.msgT = 0; g.dragX = null;
        newFloor(g);
        g.info = `floor 1 · pages 0/${g.L.need}`;
      },
      update,
      draw,
    });
  },
});
