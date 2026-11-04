// 사이언스 퀘스트 — 본체: 저장, 지도, 움직임, 마을, 연구소(스테이지) 흐름
(function () {
  'use strict';
  const { $, esc, wait, toast, say, modal, closeModal, SFX, ITEM_INFO } = UI;

  // 화면은 24×15칸(1152×720). 구역 지도(20×12)는 가운데에 놓여 둘레에 머리 위 표시판 자리가 남는다.
  const TS = 16, SC = 3, VW = 24, VH = 15, MOVE_MS = 150, MAX_HEARTS = 5;
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const TEACHER = /[?&]teacher\b/.test(location.search);
  const cvs = $('#view'), ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const SHOP = [
    { k: 'hint',   price: 20, desc: '문제의 힌트를 보여 줘요.' },
    { k: 'flask',  price: 30, desc: '"골라 보세요" 문제에서 오답 2개를 지워 줘요.' },
    { k: 'potion', price: 25, desc: '하트를 1칸 채워 줘요.' },
    { k: 'shield', price: 40, desc: '틀렸을 때 하트 대신 한 번 막아 줘요. (자동으로 써요)' },
  ];
  const LOOKS = {
    hair: [['short', '짧은 머리'], ['long', '긴 머리']],
    hairColor: ['#2b1d14', '#5a3a22', '#8a5a2b', '#d9a441', '#c94f3d', '#3a3f6b'],
    shirt: ['#4d7cff', '#ff5d5d', '#2fae66', '#ffb000', '#9b5de5', '#20c1c9', '#ff7ab6', '#3b3f4a'],
    skin: ['#f6d2b3', '#f1c27d', '#d9a066', '#a86b3c'],
  };
  const STORY = [
    ['buddy', '안녕, {name}! 나는 실험 도우미 비커봇이야.'],
    ['buddy', '여기는 과학 섬. 중학교 2학년 과학 연구소 여덟 곳이 모여 있는 곳이야.'],
    ['buddy', '그런데 "뒤죽박죽 슬라임"들이 연구소마다 숨어들어서 지식을 몽땅 뒤섞어 버렸어!'],
    ['buddy', '연구소를 되찾을 때마다 단원 열쇠를 얻을 수 있어. 열쇠가 있어야 다음 연구소 문이 열려.'],
    ['buddy', '방향키나 W·A·S·D로 움직이고, 가고 싶은 곳을 눌러도 돼. Space를 누르면 말을 걸 수 있어.'],
    ['buddy', '먼저 1번 연구소로 가 보자! 노란 화살표를 따라가.'],
  ];

  // ───────── 저장 ─────────
  const SAVE_KEY = 'sciquest-m2.save.v2'; // v2: 1단원을 교과서 순서로 다시 짜면서 진행 기록 모양이 바뀜
  const blank = () => ({
    nick: '', look: { hair: 'short', hairColor: LOOKS.hairColor[0], shirt: LOOKS.shirt[0], skin: LOOKS.skin[0] },
    stars: 0, items: { hint: 2, flask: 1, potion: 1, shield: 0 },
    cleared: {}, terms: {}, stage: {}, review: {}, seenStory: false, sound: true, autoRead: false,
  });
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && s.nick) { const b = blank(); return { ...b, ...s, items: { ...b.items, ...s.items }, look: { ...b.look, ...s.look } }; }
    } catch (e) { /* 저장소를 못 쓰는 브라우저 */ }
    return blank();
  }
  let save = loadSave();
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 저장 못 해도 게임은 계속 */ } }
  function prog(n = G.stageNo) {
    return (save.stage[n] = save.stage[n] || { room: 0, solved: {}, stations: {}, chests: {}, roomIntro: {}, intro: false, stats: { answered: 0, first: 0, stars: 0 } });
  }

  // ───────── 게임 상태 ─────────
  const G = { scene: 'title', kind: 'hub', grid: [], meta: {}, w: 0, h: 0, stageNo: 0, roomIdx: 0, room: null, data: null,
              doorOpen: false, doorAt: null, bossAt: null, start: { x: 1, y: 1 }, hearts: MAX_HEARTS, lock: 0, cam: { x: 0, y: 0 } };
  const P = { x: 0, y: 0, fx: 0, fy: 0, sx: 0, sy: 0, dir: 'down', moving: false, t: 0, path: [], goal: null };
  const BOT = { x: 0, y: 0, fx: 0, fy: 0, sx: 0, sy: 0 };
  const held = [];
  let bumpArmed = true, tapDir = null; // tapDir: 아주 짧게 눌렀다 뗀 방향도 한 칸은 움직이게

  const busy = () => G.lock > 0 || UI.isOpen();
  async function act(fn) {
    G.lock++;
    try { await fn(); } catch (e) { console.error(e); toast('앗, 문제가 생겼어요: ' + e.message); }
    finally { G.lock--; hud(); }
  }

  // ui.js 가 쓰는 창구
  window.SQ = {
    get save() { return save; },
    maxHearts: MAX_HEARTS,
    hearts: () => G.hearts,
    persist,
    nameOf(who) {
      if (who === 'buddy') return '비커봇';
      if (who === 'guide') return G.data ? G.data.guide.name : '과학자';
      if (who === 'boss') return G.room && G.room.boss ? G.room.boss.name : '슬라임';
      if (who === 'shop') return '상점 주인';
      if (who === 'sign') return '안내판';
      return save.nick || '나';
    },
    guideName: () => (G.data ? G.data.guide.sprite : 'archimedes'),
    bossSkin: () => (G.room && G.room.boss && G.room.boss.skin) || 'mix',
    hurt() {
      if (save.items.shield > 0) { save.items.shield--; persist(); toast('🛡️ 보호막이 하트를 지켜 줬어요!'); hud(); return false; }
      G.hearts = Math.max(0, G.hearts - 1); hud();
      return G.hearts <= 0;
    },
    useItem(k) {
      if ((save.items[k] || 0) <= 0) { toast(`${ITEM_INFO[k].emoji} ${ITEM_INFO[k].name}${UI.jo(ITEM_INFO[k].name, '이', '가')} 없어요. 마을 상점에서 살 수 있어요.`); return false; }
      save.items[k]--; persist(); hud(); return true;
    },
    usePotion() {
      if (G.hearts >= MAX_HEARTS) { toast('하트가 이미 가득 찼어요.'); return false; }
      if (!SQ.useItem('potion')) return false;
      G.hearts++; SFX.play('item'); toast('❤️ 하트를 1칸 채웠어요!'); hud(); return true;
    },
    addStars(n) {
      save.stars += n;
      if (G.stageNo) prog().stats.stars += n;
      persist(); hud();
    },
    recordAnswer(q, wrongs, fainted) {
      if (!fainted && G.stageNo) { const s = prog().stats; s.answered++; if (!wrongs) s.first++; }
      if (wrongs) {
        const key = `${q.stage}:${q.id}`;
        const r = save.review[key] || (save.review[key] = { wrong: 0 });
        r.wrong += wrongs; r.at = Date.now();
      }
      persist();
    },
  };

  // ───────── 지도 ─────────
  const SOLID = new Set(['#', 'k', 'p', 'r', 'm', 'v', 'l', 'g', 'e', 'u', 'a', 'y', 'q', 'j', 'h', 'n', 'o', 'b', 'd', 'i', 'z', 't', 'w', 'N', 'Z', 'I', 'C', 'c', 'S', 's', 'X']);
  // 한 구역의 실험대 목록. 예전 모양(station 하나)도 받는다.
  const stationsOf = (room) => (room && (room.stations || (room.station ? [room.station] : []))) || [];
  const isDigit = (ch) => ch >= '1' && ch <= '8';
  function tileAt(x, y) { return x < 0 || y < 0 || x >= G.w || y >= G.h ? '#' : G.grid[y][x]; }
  function isSolid(x, y) {
    const ch = tileAt(x, y);
    if (ch === 'D') return !G.doorOpen;
    return SOLID.has(ch) || isDigit(ch);
  }
  function isInteractive(x, y) {
    const ch = tileAt(x, y);
    return 'NZICcSsX'.includes(ch) || isDigit(ch) || (ch === 'D' && !G.doorOpen);
  }

  function loadMap(rows, kind, lists = {}) {
    G.kind = kind; G.h = rows.length; G.w = rows[0].length;
    G.grid = rows.map((r) => r.split('')); G.meta = {}; G.bossAt = null; G.doorAt = null; G.doorOpen = false;
    let qi = 0, bi = 0, ci = 0, si = 0;
    for (let y = 0; y < G.h; y++) for (let x = 0; x < G.w; x++) {
      const ch = G.grid[y][x], k = x + ',' + y;
      if (ch === 'P') { G.start = { x, y }; G.grid[y][x] = '.'; }
      else if (ch === '?') G.meta[k] = { type: 'quiz', id: lists.quiz[qi++] };
      else if (ch === 'B') G.meta[k] = { type: 'book', id: lists.books[bi++] };
      else if (ch === 'C') G.meta[k] = { type: 'chest', idx: ci, loot: lists.chests[ci++] };
      else if (ch === 'S') G.meta[k] = { type: 'station', idx: si++ };
      else if (ch === 'X' && !G.bossAt) G.bossAt = { x, y };
      else if (ch === 'D') G.doorAt = { x, y };
    }
  }

  function roomLeft() {
    const pr = prog();
    const quiz = Object.values(G.meta).filter((m) => m.type === 'quiz' && !pr.solved[m.id]).length;
    const station = stationsOf(G.room).filter((_, i) => !pr.stations[`${G.roomIdx}:${i}`]).length;
    return { quiz, station };
  }

  function loadRoom(idx) {
    const pr = prog();
    G.roomIdx = idx; G.room = G.data.rooms[idx];
    loadMap(G.room.map, 'room', G.room);
    for (const [k, m] of Object.entries(G.meta)) {
      const [x, y] = k.split(',').map(Number);
      if (m.type === 'quiz' && pr.solved[m.id]) G.grid[y][x] = '!';
      if (m.type === 'book' && save.terms[`${G.stageNo}:${m.id}`]) G.grid[y][x] = '.';
      if (m.type === 'chest' && pr.chests[`${idx}:${m.idx}`]) G.grid[y][x] = 'c';
      if (m.type === 'station' && pr.stations[`${idx}:${m.idx}`]) G.grid[y][x] = 's';
    }
    const left = roomLeft();
    G.doorOpen = !left.quiz && !left.station;
    pr.room = idx; persist();
    placePlayer(G.start);
    hud();
  }

  function placePlayer(pos, dir = 'down') {
    P.x = P.fx = P.sx = pos.x; P.y = P.fy = P.sy = pos.y; P.dir = dir; P.moving = false; P.path = []; P.goal = null;
    const spots = [[0, 1], [1, 0], [-1, 0], [0, -1]].map(([dx, dy]) => [pos.x + dx, pos.y + dy]).filter(([x, y]) => !isSolid(x, y) && tileAt(x, y) !== '?' && tileAt(x, y) !== 'B');
    const [bx, by] = spots[0] || [pos.x, pos.y];
    BOT.x = BOT.fx = BOT.sx = bx; BOT.y = BOT.fy = BOT.sy = by;
  }

  // ───────── 움직임 ─────────
  function tryMove(dir, auto) {
    P.dir = dir;
    const [dx, dy] = DIRS[dir], nx = P.x + dx, ny = P.y + dy;
    if (!isSolid(nx, ny)) {
      P.moving = true; P.t = 0; P.sx = P.x; P.sy = P.y; P.x = nx; P.y = ny;
      BOT.sx = BOT.fx; BOT.sy = BOT.fy; BOT.x = P.sx; BOT.y = P.sy;
      return;
    }
    P.path = [];
    if (isInteractive(nx, ny) && (bumpArmed || auto)) { bumpArmed = false; act(() => bump(nx, ny)); }
  }

  function update(dt) {
    if (P.moving) {
      P.t += dt;
      const k = Math.min(1, P.t / MOVE_MS);
      P.fx = P.sx + (P.x - P.sx) * k; P.fy = P.sy + (P.y - P.sy) * k;
      BOT.fx = BOT.sx + (BOT.x - BOT.sx) * k; BOT.fy = BOT.sy + (BOT.y - BOT.sy) * k;
      if (k >= 1) { P.moving = false; arrive(); }
      return;
    }
    if (busy()) { tapDir = null; return; }
    const dir = held[held.length - 1] || tapDir;
    tapDir = null;
    if (dir) { P.path = []; P.goal = null; tryMove(dir, false); return; }
    if (P.path.length) { tryMove(P.path.shift(), true); return; }
    if (P.goal) {
      const g = P.goal; P.goal = null;
      const d = Object.keys(DIRS).find((k) => P.x + DIRS[k][0] === g.x && P.y + DIRS[k][1] === g.y);
      if (d) { P.dir = d; act(() => bump(g.x, g.y)); }
    }
  }

  function arrive() {
    const ch = tileAt(P.x, P.y), m = G.meta[P.x + ',' + P.y];
    if (ch === '?' && m) { P.path = []; P.goal = null; act(() => doQuiz(P.x, P.y, m)); }
    else if (ch === 'B' && m) act(() => getBook(P.x, P.y, m));
    else if (ch === 'D' && G.doorOpen) { P.path = []; act(nextRoom); }
  }

  function interactFacing() {
    if (busy() || P.moving) return;
    const ch = tileAt(P.x, P.y), m = G.meta[P.x + ',' + P.y];
    if (ch === '?' && m) { act(() => doQuiz(P.x, P.y, m)); return; }
    const [dx, dy] = DIRS[P.dir];
    if (isInteractive(P.x + dx, P.y + dy)) act(() => bump(P.x + dx, P.y + dy));
  }

  // 눌러서 이동: 너비 우선 탐색으로 길 찾기
  function planPath(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= G.w || ty >= G.h) return;
    const interactive = isSolid(tx, ty) && isInteractive(tx, ty);
    if (isSolid(tx, ty) && !interactive) return;
    const goals = new Set();
    if (interactive) {
      for (const [dx, dy] of Object.values(DIRS)) if (!isSolid(tx + dx, ty + dy)) goals.add((tx + dx) + ',' + (ty + dy));
    } else goals.add(tx + ',' + ty);
    const find = (avoidQuiz) => {
      const from = P.x + ',' + P.y, prev = { [from]: null }, q = [[P.x, P.y]];
      while (q.length) {
        const [x, y] = q.shift(), k = x + ',' + y;
        if (goals.has(k)) {
          const dirs = []; let cur = k;
          while (prev[cur]) { dirs.unshift(prev[cur][1]); cur = prev[cur][0]; }
          return dirs;
        }
        for (const [d, [dx, dy]] of Object.entries(DIRS)) {
          const nx = x + dx, ny = y + dy, nk = nx + ',' + ny;
          if (nk in prev || isSolid(nx, ny)) continue;
          const c = tileAt(nx, ny);
          if (avoidQuiz && (c === '?' || (c === 'D' && G.doorOpen)) && !goals.has(nk)) continue;
          prev[nk] = [k, d]; q.push([nx, ny]);
        }
      }
      return null;
    };
    const dirs = find(true) || find(false);
    if (!dirs) return;
    P.path = dirs; P.goal = interactive ? { x: tx, y: ty } : null; bumpArmed = true;
  }

  // ───────── 칸과 부딪히거나 밟았을 때 ─────────
  async function bump(x, y) {
    const ch = tileAt(x, y);
    if (ch === 'N') return say(G.room.tips);
    if (ch === 'Z') return openShop();
    if (ch === 'I') return say(SQ_HUB.sign.map((t) => ['sign', t]));
    if (ch === 'C') return openChest(x, y);
    if (ch === 'c') { toast('빈 상자예요.'); return; }
    if (ch === 'S') return runStation(x, y);
    if (ch === 's') { toast('이미 해결한 실험대예요.'); return; }
    if (ch === 'X') return fightBoss();
    if (ch === 'D') {
      const l = roomLeft(), parts = [];
      if (l.quiz) parts.push(`? 칸 ${l.quiz}개`);
      if (l.station) parts.push(`실험대 ${l.station}개`);
      return say([['buddy', `문이 잠겨 있어. ${parts.join(', ')}${UI.jo(parts[parts.length - 1], '이', '가')} 남았어!`]]);
    }
    if (isDigit(ch)) return enterPortal(Number(ch));
  }

  async function doQuiz(x, y, m) {
    const q = G.data.questions[m.id];
    const r = await UI.quiz(q, G.room.name + (G.room.pages ? ` · 교과서 ${G.room.pages}쪽` : ''));
    if (r.correct) { G.grid[y][x] = '!'; prog().solved[m.id] = true; persist(); checkRoom(); }
    else if (r.fainted) await faint();
  }

  async function getBook(x, y, m) {
    const term = G.data.terms[m.id];
    G.grid[y][x] = '.';
    save.terms[`${G.stageNo}:${m.id}`] = true;
    SFX.play('item');
    SQ.addStars(2);
    await UI.termCard(term, G.room.name);
    hud();
  }

  async function openChest(x, y) {
    const m = G.meta[x + ',' + y], loot = m.loot || {};
    G.grid[y][x] = 'c'; prog().chests[`${G.roomIdx}:${m.idx}`] = true;
    const got = [];
    for (const [k, n] of Object.entries(loot.items || {})) { save.items[k] = (save.items[k] || 0) + n; got.push(`${ITEM_INFO[k].emoji} ${ITEM_INFO[k].name} ×${n}`); }
    if (loot.stars) { SQ.addStars(loot.stars); got.push(`⭐ ${loot.stars}`); }
    persist(); SFX.play('item');
    await say([['buddy', `보물 상자다! 얻은 것: ${got.join(', ')}`]]);
  }

  async function runStation(x, y) {
    const m = G.meta[x + ',' + y], st = stationsOf(G.room)[m.idx];
    await say([['guide', `${st.title}일세. ${st.desc}`]]);
    if (st.type === 'sort') await UI.playSort(st); else await UI.playOrder(st);
    G.grid[y][x] = 's'; prog().stations[`${G.roomIdx}:${m.idx}`] = true; persist();
    checkRoom();
  }

  function checkRoom() {
    const l = roomLeft();
    if (!l.quiz && !l.station && !G.doorOpen && G.doorAt) {
      G.doorOpen = true; SFX.play('door'); toast('🚪 다음 구역으로 가는 문이 열렸어요!');
    }
    hud();
  }

  async function nextRoom() {
    await fade(() => loadRoom(G.roomIdx + 1));
    await roomIntro();
  }

  async function roomIntro() {
    const pr = prog();
    if (!pr.roomIntro[G.roomIdx]) { pr.roomIntro[G.roomIdx] = true; persist(); await say(G.room.intro); }
  }

  async function faint() {
    SFX.play('hurt');
    await say([['buddy', '으앗, 하트가 모두 떨어졌어! 이 구역 입구에서 다시 시작하자.'], ['buddy', '걱정 마. 이미 푼 문제는 그대로 남아 있어.']]);
    G.hearts = MAX_HEARTS;
    await fade(() => placePlayer(G.start));
  }

  async function fightBoss() {
    const bc = G.room.boss, Q = G.data.questions;
    await say(bc.talk);
    const r = await UI.playBoss({ name: bc.name, hp: bc.hp, skin: bc.skin, pool: bc.pool.map((id) => Q[id]), final: Q[bc.final] });
    if (r.win) await stageClear(); else await faint();
  }

  async function stageClear() {
    G.grid.forEach((r) => r.forEach((c, i) => { if (c === 'X') r[i] = '.'; }));
    G.bossAt = null;
    SFX.play('win');
    await say(G.data.clear);
    const n = G.stageNo, pr = prog();
    save.cleared[n] = true; pr.done = true; persist();
    await resultCard(n);
    await fade(() => goHubSync(n));
    toast(`🔑 ${n}단원 열쇠를 얻었어요!`);
    const u = SQ_UNITS[n];
    if (u) await say([['buddy', SQ_DATA[n + 1] ? `${n + 1}번 연구소 '${u.unit}' 문이 열렸어! 가 보자.` : `${n + 1}번 연구소 '${u.unit}'는 아직 공사 중이야. 선생님이 문제를 넣어 주시면 열릴 거야!`]]);
    else if (SQ_UNITS.every((x) => save.cleared[x.no])) {
      SFX.play('win');
      toast(`🏆 열쇠 ${SQ_UNITS.length}개를 모두 모았어요!`);
      await say([
        ['buddy', `${save.nick || '친구'}, 연구소 ${SQ_UNITS.length}곳의 열쇠를 모두 모았어! 중학교 2학년 과학을 끝까지 해냈어!`],
        ['buddy', '틀렸던 문제는 메뉴의 복습 노트에 모여 있어. 연구소에 다시 들어가 도전해도 좋아!'],
      ]);
    }
  }

  function resultCard(n) {
    return new Promise((resolve) => {
      const pr = prog(n), s = pr.stats, data = SQ_DATA[n];
      const rate = s.answered ? Math.round((s.first / s.answered) * 100) : 0;
      const termIds = Object.keys(data.terms), got = termIds.filter((id) => save.terms[`${n}:${id}`]).length;
      const wrong = Object.keys(save.review).filter((k) => k.startsWith(n + ':')).map((k) => data.questions[k.split(':')[1]]).filter(Boolean);
      const d = new Date();
      const p = modal(`<div class="result-head"><div class="trophy">🏆</div><h2>${n}단원 클리어! · ${esc(data.unit)}</h2>
          <div>${esc(save.nick)} · ${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}</div></div>
        <div class="stats">
          <div class="stat"><b>${rate}%</b>한 번에 맞힌 비율<br><small>${s.first} / ${s.answered}문제</small></div>
          <div class="stat"><b>+${s.stars} ⭐</b>이번에 모은 별</div>
          <div class="stat"><b>${got} / ${termIds.length}</b>용어 카드</div>
          <div class="stat"><b>🔑</b>${n}단원 열쇠</div>
        </div>
        ${wrong.length ? `<h3>📒 한 번이라도 틀린 문제 (${wrong.length})</h3>${wrong.map(reviewHTML).join('')}` : '<p style="text-align:center">🎯 틀린 문제가 하나도 없어요. 완벽해요!</p>'}
        <div class="foot"><button class="btn primary r-ok">마을로 돌아가기 ▶</button></div>`, { cls: 'wide', closable: false });
      p.querySelector('.r-ok').onclick = () => { closeModal(); resolve(); };
    });
  }

  function answerText(q) {
    if (q.type === 'ox') return q.a ? 'O (그렇다)' : 'X (아니다)';
    if (q.type === 'mc') return q.choices[q.a];  // 보기는 섞여 나오므로 번호는 적지 않는다
    return `${q.a} ${q.unit || ''}`;
  }
  function reviewHTML(q) {
    return `<div class="review-item"><div class="src">${q.stage}단원 · ${esc(SQ_DATA[q.stage].unit)}</div><div><b>${esc(q.q)}</b></div>
      <div>정답: <span class="ans">${esc(answerText(q))}</span></div><div class="exp">💡 ${esc(q.exp)}</div>${q.pg ? `<div class="pg">📖 교과서 ${esc(q.pg)}쪽을 다시 읽어 봐요</div>` : ''}</div>`;
  }

  // ───────── 마을 ─────────
  function goHubSync(near) {
    G.scene = 'hub'; G.stageNo = 0; G.data = null; G.room = null;
    loadMap(SQ_HUB.map, 'hub');
    let pos = G.start, dir = 'down';
    if (near) {
      G.grid.forEach((r, y) => r.forEach((c, x) => { if (c === String(near)) { pos = y < G.h / 2 ? { x, y: y + 1 } : { x, y: y - 1 }; dir = y < G.h / 2 ? 'up' : 'down'; } }));
    }
    placePlayer(pos, dir);
    showGame();
  }

  function portalState(n) {
    if (!(TEACHER || n === 1 || save.cleared[n - 1])) return 'locked';
    return SQ_DATA[n] ? 'open' : 'soon';
  }

  async function enterPortal(n) {
    const u = SQ_UNITS[n - 1], st = portalState(n);
    if (st === 'locked') return say([['buddy', `${n - 1}단원 열쇠가 있어야 ${n}번 연구소 '${u.unit}'에 들어갈 수 있어.`]]);
    if (st === 'soon') return say([['sign', `${n}번 연구소 '${u.unit}' — 🚧 아직 공사 중이에요.`], ['buddy', '선생님이 이 단원의 문제를 넣어 주시면 문이 열릴 거야!']]);
    const choice = await portalCard(n);
    if (!choice) return;
    if (choice === 'reset') { delete save.stage[n]; persist(); }
    await enterStage(n);
  }

  function portalCard(n) {
    return new Promise((resolve) => {
      const data = SQ_DATA[n], pr = save.stage[n], cleared = !!save.cleared[n];
      const termIds = Object.keys(data.terms), got = termIds.filter((id) => save.terms[`${n}:${id}`]).length;
      const where = pr ? data.rooms[pr.room || 0].name : '처음부터';
      const p = modal(`<h2>${n}번 연구소 · ${esc(data.unit)}</h2>
        <p class="guide-text">🏛️ ${esc(data.title)}<br>🧑‍🔬 길잡이: ${esc(data.guide.name)}<br>${data.pages ? `📘 교과서 ${esc(data.pages)}쪽<br>` : ''}${data.problem ? `❓ 단원의 문제: ${esc(data.problem)}<br>` : ''}
        📍 ${cleared ? '🔑 클리어한 연구소예요' : esc(where)} · 📘 용어 카드 ${got}/${termIds.length}</p>
        <div class="foot">
          ${cleared ? '<button class="btn primary" data-a="reset">처음부터 다시 도전 ▶</button>' : `<button class="btn primary" data-a="go">${pr ? '이어서 들어가기 ▶' : '들어가기 ▶'}</button>`}
          ${!cleared && pr ? '<button class="btn" data-a="reset">처음부터 다시</button>' : ''}
        </div>
        ${cleared ? '<p style="font-size:13px;color:#6b5a3a">다시 도전하면 연구소가 처음 상태로 돌아가요. 열쇠·용어 카드·별은 그대로예요.</p>' : ''}`,
        { cls: 'narrow', onClose: () => resolve(null) });
      p.querySelectorAll('[data-a]').forEach((b) => { b.onclick = () => { UI.M.onClose = null; closeModal(); resolve(b.dataset.a); }; });
      const first = p.querySelector('[data-a]'); first.focus({ preventScroll: true });
      UI.M.onKey = (e) => { if (e.code === 'Enter' || e.code === 'Space') { if (!e.repeat) first.click(); return true; } return false; };
    });
  }

  async function enterStage(n) {
    const data = SQ_DATA[n];
    for (const [id, q] of Object.entries(data.questions)) { q.id = id; q.stage = n; }
    G.hearts = MAX_HEARTS;
    await fade(() => { G.scene = 'stage'; G.stageNo = n; G.data = data; loadRoom(prog(n).room || 0); });
    const pr = prog();
    if (!pr.intro) { pr.intro = true; persist(); await say(data.intro); }
    await roomIntro();
  }

  function openShop() {
    const draw = (p) => {
      p.querySelector('.stars-now').textContent = `가진 별: ⭐ ${save.stars}`;
      p.querySelector('.list').innerHTML = SHOP.map((s) => {
        const I = ITEM_INFO[s.k];
        return `<div class="item"><span class="emo">${I.emoji}</span><div class="tx"><b>${I.name}</b> <small>(가진 수 ${save.items[s.k] || 0})</small><br><small>${esc(s.desc)}</small></div>
          <button class="btn ${save.stars >= s.price ? 'primary' : ''}" data-k="${s.k}" ${save.stars >= s.price ? '' : 'disabled'}>⭐ ${s.price}</button></div>`;
      }).join('');
      p.querySelectorAll('[data-k]').forEach((b) => {
        b.onclick = () => {
          const s = SHOP.find((x) => x.k === b.dataset.k);
          if (save.stars < s.price) return;
          save.stars -= s.price; save.items[s.k] = (save.items[s.k] || 0) + 1; persist(); hud(); SFX.play('buy');
          toast(`${ITEM_INFO[s.k].emoji} ${ITEM_INFO[s.k].name}${UI.jo(ITEM_INFO[s.k].name, '을', '를')} 샀어요!`);
          draw(p);
        };
      });
    };
    return new Promise((resolve) => {
      const p = modal(`<h2>🛒 실험 도구 상점</h2><p class="stars-now"></p><div class="list"></div>
        <p style="font-size:13px;color:#6b5a3a">별은 문제를 맞히거나, 용어 카드를 모으거나, 실험대를 해결하면 모여요.</p>`, { onClose: resolve });
      draw(p);
    });
  }

  // ───────── 메뉴 창 ─────────
  function openBag() {
    const p = modal(`<h2>🎒 가방</h2><div class="list">${Object.entries(ITEM_INFO).map(([k, I]) => `<div class="item"><span class="emo">${I.emoji}</span>
      <div class="tx"><b>${I.name}</b> ×${save.items[k] || 0}<br><small>${esc(SHOP.find((s) => s.k === k).desc)}</small></div>
      ${k === 'potion' && G.scene === 'stage' ? '<button class="btn primary" data-use="potion">쓰기</button>' : ''}</div>`).join('')}</div>
      <h3>🔑 단원 열쇠</h3><p>${SQ_UNITS.map((u) => `${save.cleared[u.no] ? '🔑' : '▫️'} ${u.no}. ${esc(u.unit)}`).join('<br>')}</p>`);
    const b = p.querySelector('[data-use]');
    if (b) b.onclick = () => { if (SQ.usePotion()) { closeModal(); } };
  }

  function openDex() {
    const parts = SQ_UNITS.map((u) => {
      const d = SQ_DATA[u.no];
      if (!d) return `<h3>${u.no}. ${esc(u.unit)}</h3><div class="card locked">🚧 아직 준비 중인 단원이에요.</div>`;
      const ids = Object.keys(d.terms), got = ids.filter((id) => save.terms[`${u.no}:${id}`]).length;
      return `<h3>${u.no}. ${esc(u.unit)} (${got}/${ids.length})</h3><div class="cards">${ids.map((id) => {
        const t = d.terms[id];
        return save.terms[`${u.no}:${id}`]
          ? `<div class="card"><div class="w">${esc(t.word)}</div><div class="d">${esc(t.desc)}</div>${t.ex ? `<div class="e">예) ${esc(t.ex)}</div>` : ''}</div>`
          : '<div class="card locked"><div class="w">???</div><div class="d">연구소에 떠 있는 책을 밟으면 얻을 수 있어요.</div></div>';
      }).join('')}</div>`;
    });
    modal(`<h2>📖 용어 도감</h2>${parts.join('')}`, { cls: 'wide' });
  }

  function openReview() {
    const qs = Object.entries(save.review).sort((a, b) => (b[1].at || 0) - (a[1].at || 0)).map(([k, r]) => {
      const [n, id] = k.split(':'), d = SQ_DATA[n];
      const q = d && d.questions[id];
      if (!q) return null;
      q.id = id; q.stage = Number(n);
      return reviewHTML(q).replace('</div><div><b>', ` · 틀린 횟수 ${r.wrong}</div><div><b>`);
    }).filter(Boolean);
    const p = modal(`<h2>📒 복습 노트</h2><p>한 번이라도 틀렸던 문제를 모아 두었어요. 정답과 해설을 다시 읽어 봐요.</p>
      ${qs.length ? qs.join('') : '<p class="card">아직 틀린 문제가 없어요. 👍</p>'}
      ${qs.length ? '<div class="foot"><button class="btn" data-clear>다 봤어요 (목록 비우기)</button></div>' : ''}`, { cls: 'wide' });
    const c = p.querySelector('[data-clear]');
    if (c) c.onclick = async () => { if (await UI.confirmBox('복습 노트 비우기', '틀린 문제 목록을 모두 지울까요?', '지우기', '그대로 두기')) { save.review = {}; persist(); toast('복습 노트를 비웠어요.'); } };
  }

  function openSettings() {
    const p = modal(`<h2>⚙️ 설정</h2>
      <label class="toggle"><span>🔊 효과음</span><input type="checkbox" data-k="sound" ${save.sound ? 'checked' : ''}></label>
      <label class="toggle"><span>🗣️ 대사 자동으로 읽어주기</span><input type="checkbox" data-k="autoRead" ${save.autoRead ? 'checked' : ''}></label>
      <label class="toggle"><span>🎮 화면 조작판(터치) 보이기</span><input type="checkbox" data-k="touch" ${!$('#touch').hidden ? 'checked' : ''}></label>
      <div class="foot">
        <button class="btn" data-a="look">🎨 캐릭터 꾸미기</button>
        <button class="btn" data-a="title">🏠 첫 화면으로</button>
        <button class="btn" data-a="wipe" style="color:var(--bad)">🗑️ 기록 모두 지우기</button>
      </div>`, { cls: 'narrow' });
    p.querySelectorAll('input[data-k]').forEach((i) => {
      i.onchange = () => {
        if (i.dataset.k === 'touch') { setTouch(i.checked); return; }
        save[i.dataset.k] = i.checked; persist();
      };
    });
    p.querySelector('[data-a=look]').onclick = () => { closeModal(); openMake(true); };
    p.querySelector('[data-a=title]').onclick = () => { closeModal(); showTitle(); };
    p.querySelector('[data-a=wipe]').onclick = async () => {
      if (await UI.confirmBox('기록 모두 지우기', '별명, 별, 열쇠, 용어 카드, 진행 상황이 모두 지워져요. 정말 지울까요?', '모두 지우기', '취소')) {
        save = blank(); try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* */ }
        showTitle(); toast('기록을 모두 지웠어요.');
      }
    };
  }

  function openTeacher() {
    modal(`<h2>👩‍🏫 선생님 안내</h2><div class="guide-text">
      <p><b>게임 구조</b> — 마을(과학 섬)에 단원별 연구소 8곳이 있어요. 연구소마다 구역 3곳(중단원)과 보스 방이 있고,
      구역의 <b>?</b> 칸 문제와 실험대 미니게임을 모두 해결해야 다음 문이 열려요. 보스를 이기면 단원 열쇠를 얻고 다음 연구소가 열려요.</p>
      <p><b>교과서</b> — 비상교육 중학교 과학 2 (2022 개정)의 단원 순서·중단원(블록)·용어·예시를 따랐어요.
      구역 하나가 교과서의 블록 하나이고, 문제를 맞히면 해설과 함께 "📖 교과서 ○쪽"이 나와요. 각 단원의 보스전 마지막 문제는 교과서 "단원의 문제"예요.</p>
      <p><b>준비된 단원</b> — Ⅰ. 물질의 특성(문제 25, 용어 15, 실험대 4) · Ⅱ. 지권의 변화(문제 29, 용어 14, 실험대 5) · Ⅲ. 빛과 파동(문제 31, 용어 14, 실험대 6) · Ⅳ. 물질의 구성(문제 33, 용어 15, 실험대 6) · Ⅴ. 식물과 에너지(문제 31, 용어 14, 실험대 6) · Ⅵ. 동물과 에너지(문제 33, 용어 15, 실험대 7) · Ⅶ. 전기와 자기(문제 35, 용어 15, 실험대 8) · Ⅷ. 별과 우주(문제 36, 용어 15, 실험대 6). 여덟 단원이 모두 준비되어 있어요.</p>
      <p><b>문제 고치기</b> — 단원마다 <code>js/stages/stage1.js</code> ~ <code>stage8.js</code> 한 파일에 문제·용어·지도가 모두 들어 있어요.
      문제 문장이나 보기를 바꾸고 저장한 뒤 새로 고침하면 바로 반영돼요. "골라 보세요" 보기는 화면에서 섞여 나와요.</p>
      <p><b>시범 보이기</b> — 주소 끝에 <code>?teacher</code> 를 붙이면 열쇠 없이 준비된 모든 연구소에 들어갈 수 있어요.</p>
      <p><b>기록</b> — 별명과 진행 상황은 이 기기의 브라우저에만 저장돼요. 서버로 보내는 정보는 없어요.
      단원을 마치면 결과 카드(정답률·틀린 문제)가 나오니 화면을 캡처해 제출하게 할 수 있어요.</p></div>`, { cls: 'wide' });
  }

  // ───────── 화면 바꾸기 ─────────
  function setTouch(on) { $('#touch').hidden = !on; document.body.classList.toggle('touching', on); }
  function showGame() { $('#screen-title').hidden = true; $('#screen-make').hidden = true; $('#hud').hidden = false; $('#hud-menu').hidden = false; hud(); }
  function showTitle() {
    G.scene = 'title'; closeModal();
    $('#screen-make').hidden = true; $('#screen-title').hidden = false; $('#hud').hidden = true; $('#hud-menu').hidden = true; $('#prompt').hidden = true;
    const c = $('#btn-continue');
    c.hidden = !save.nick; c.textContent = `▶ 이어하기 (${save.nick})`;
  }
  async function fade(fn) {
    G.lock++;
    try {
      $('#fade').classList.add('on'); await wait(230);
      fn();
      await wait(40); $('#fade').classList.remove('on'); await wait(200);
    } finally { G.lock--; }
  }

  // ───────── 캐릭터 만들기 ─────────
  let draft = null, editing = false;
  function openMake(edit) {
    editing = !!edit;
    draft = { nick: save.nick, look: { ...save.look } };
    $('#screen-title').hidden = true; $('#screen-make').hidden = false;
    $('#in-nick').value = draft.nick; $('#make-msg').textContent = '';
    $('#btn-make-go').textContent = editing ? '저장 ▶' : '출발! ▶';
    $('#btn-make-back').textContent = editing ? '◀ 돌아가기' : '◀ 처음으로';
    drawMakeOpts();
    setTimeout(() => $('#in-nick').focus(), 50);
  }
  function drawMakeOpts() {
    $('#opt-hair').innerHTML = LOOKS.hair.map(([v, t]) => `<button data-v="${v}" class="${draft.look.hair === v ? 'on' : ''}">${t}</button>`).join('');
    for (const k of ['hairColor', 'shirt', 'skin']) {
      $('#opt-' + k).innerHTML = LOOKS[k].map((c) => `<button data-v="${c}" style="background:${c}" class="${draft.look[k] === c ? 'on' : ''}" aria-label="${c}"></button>`).join('');
    }
    document.querySelectorAll('#opt-hair button').forEach((b) => { b.onclick = () => { draft.look.hair = b.dataset.v; drawMakeOpts(); }; });
    for (const k of ['hairColor', 'shirt', 'skin']) document.querySelectorAll('#opt-' + k + ' button').forEach((b) => { b.onclick = () => { draft.look[k] = b.dataset.v; drawMakeOpts(); }; });
    $('#make-name').textContent = $('#in-nick').value.trim() || '별명';
  }
  $('#in-nick').addEventListener('input', () => { $('#make-name').textContent = $('#in-nick').value.trim() || '별명'; });
  $('#in-nick').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-make-go').click(); });
  $('#btn-make-back').onclick = () => { if (editing) showGame(); else showTitle(); };
  $('#btn-make-go').onclick = async () => {
    const nick = $('#in-nick').value.trim();
    if (!nick) { $('#make-msg').textContent = '별명을 적어 주세요.'; $('#in-nick').focus(); return; }
    save.nick = nick; save.look = draft.look; persist();
    if (editing) { showGame(); toast('캐릭터를 바꿨어요.'); return; }
    goHubSync();
    if (!save.seenStory) { save.seenStory = true; persist(); await act(() => say(STORY)); }
  };

  $('#btn-new').onclick = async () => {
    if (save.nick && !(await UI.confirmBox('새로 시작하기', `'${save.nick}'의 기록(별, 열쇠, 용어 카드)이 지워지고 처음부터 시작해요. 괜찮을까요?`, '새로 시작', '취소'))) return;
    const keep = { sound: save.sound, autoRead: save.autoRead };
    save = { ...blank(), ...keep };
    persist();
    openMake(false);
  };
  $('#btn-continue').onclick = () => { goHubSync(); toast(`다시 왔구나, ${save.nick}!`); };
  $('#btn-teacher').onclick = openTeacher;
  $('#btn-bag').onclick = () => { if (!busy()) openBag(); };
  $('#btn-dex').onclick = () => { if (!busy()) openDex(); };
  $('#btn-review').onclick = () => { if (!busy()) openReview(); };
  $('#btn-set').onclick = () => { if (!busy()) openSettings(); };
  $('#btn-home').onclick = () => {
    if (busy()) return;
    act(async () => {
      if (await UI.confirmBox('마을로 돌아가기', '마을로 돌아갈까요? 지금까지 푼 문제는 저장돼요.', '마을로', '계속하기')) await fade(() => goHubSync(G.stageNo));
    });
  };

  // ───────── 머리 위 표시 ─────────
  function hud() {
    if (G.scene === 'title') return;
    const stage = G.scene === 'stage';
    $('#hud-place').textContent = stage ? `${G.stageNo}단원 · ${G.room.name}` : `🏝️ ${SQ_HUB.name}`;
    let pg = '';
    if (stage) {
      if (G.room.boss) pg = G.bossAt ? '👾 슬라임에게 다가가 대결하세요!' : '🏆 클리어!';
      else {
        const qs = Object.values(G.meta).filter((m) => m.type === 'quiz'), solved = qs.filter((m) => prog().solved[m.id]).length;
        const bs = Object.values(G.meta).filter((m) => m.type === 'book'), books = bs.filter((m) => save.terms[`${G.stageNo}:${m.id}`]).length;
        const sts = stationsOf(G.room), sd = sts.filter((_, i) => prog().stations[`${G.roomIdx}:${i}`]).length;
        pg = `❓ ${solved}/${qs.length}` + (sts.length ? ` · 🧪 ${sd}/${sts.length}` : '') + ` · 📘 ${books}/${bs.length}` + (G.doorOpen ? ' · 🚪 열림' : '');
      }
    } else {
      const done = SQ_UNITS.filter((u) => save.cleared[u.no]).length;
      pg = `🔑 열쇠 ${done} / ${SQ_UNITS.length}`;
    }
    $('#hud-prog').textContent = pg;
    $('#hud-keys').innerHTML = SQ_UNITS.map((u) => `<span class="${save.cleared[u.no] ? 'on' : ''}" title="${u.no}. ${esc(u.unit)}">${save.cleared[u.no] ? '🔑' : u.no}</span>`).join('');
    const sh = save.items.shield > 0 ? ` 🛡️${save.items.shield}` : '';
    $('#hud-hearts').textContent = stage ? '❤️'.repeat(G.hearts) + '🤍'.repeat(MAX_HEARTS - G.hearts) + sh : '';
    $('#hud-stars').textContent = `⭐ ${save.stars}`;
    $('#btn-home').hidden = !stage;
  }

  let lastPrompt = null;
  function updatePrompt() {
    let t = '';
    if (!busy() && !P.moving) {
      const [dx, dy] = DIRS[P.dir], x = P.x + dx, y = P.y + dy, ch = tileAt(x, y), here = tileAt(P.x, P.y);
      if (here === '?') t = '문제 풀기';
      else if (ch === 'N') t = `${SQ.nameOf('guide')}에게 말 걸기`;
      else if (ch === 'Z') t = '상점 들어가기';
      else if (ch === 'I') t = '안내판 읽기';
      else if (ch === 'C') t = '상자 열기';
      else if (ch === 'S') t = `${stationsOf(G.room)[G.meta[x + ',' + y].idx].title} 시작`;
      else if (ch === 'X') t = '슬라임과 대결!';
      else if (ch === 'D' && !G.doorOpen) t = '잠긴 문 살펴보기';
      else if (isDigit(ch)) {
        const n = Number(ch), u = SQ_UNITS[n - 1], st = portalState(n);
        t = `${n}. ${u.unit} — ${st === 'open' ? '들어가기' : st === 'locked' ? '🔒 잠김' : '🚧 공사 중'}`;
      }
    }
    if (t === lastPrompt) return;
    lastPrompt = t;
    const el = $('#prompt');
    el.hidden = !t;
    if (t) el.innerHTML = `<kbd>${$('#touch').hidden ? 'Space' : 'A'}</kbd>${esc(t)}`;
  }

  // ───────── 그리기 ─────────
  function theme() { return G.kind === 'hub' ? 'grass' : (G.data && G.data.theme) || 'lab'; }

  function tileImg(ch, x, y, t) {
    const v = (x * 7 + y * 13) & 3, f = Math.floor(t / 420) % 2, th = theme();
    switch (ch) {
      case '#': return Sprites.wall(th);
      case ',': return Sprites.path(v);
      case 'f': return Sprites.flower(v);
      case 't': return Sprites.tree(v);
      case 'w': return Sprites.water(Math.floor(t / 500) % 3);
      case 'v': return Sprites.lava(Math.floor(t / 380) % 3);
      case 'k': return Sprites.bench(v, th);
      case 'p': return Sprites.plant(v, th);
      case 'r': return Sprites.boulder(v, th);
      case 'm': return Sprites.crystal(v, th);
      case 'l': return Sprites.lamp(v, th);
      case 'g': return Sprites.prism(v, th);
      case 'e': return Sprites.mirror(v, th);
      case 'u': return Sprites.speaker(v, th);
      case 'a': return Sprites.atomModel(v, th);
      case 'y': return Sprites.periodicBoard(v, th);
      case 'q': return Sprites.berryBed(v, th);
      case 'j': return Sprites.growLight(v, th);
      case 'h': return Sprites.heartModel(v, th);
      case 'n': return Sprites.lungModel(v, th);
      case 'o': return Sprites.coil(v, th);
      case 'b': return Sprites.battery(v, th);
      case 'd': return Sprites.airPurifier(v, th);
      case 'i': return Sprites.telescope(v, th);
      case 'z': return Sprites.rocket(v, th);
      case '?': return Sprites.quiz(f, th);
      case '!': return Sprites.solved(th);
      case 'B': return Sprites.book(f, th);
      case 'C': return Sprites.chest(0, th);
      case 'c': return Sprites.chest(1, th);
      case 'S': return Sprites.station(f, 0, th);
      case 's': return Sprites.station(0, 1, th);
      case 'D': return Sprites.door(G.doorOpen ? 1 : 0, th);
      case 'Z': return Sprites.shop();
      case 'I': return Sprites.sign();
      default:
        if (isDigit(ch)) return Sprites.portal(f, portalState(Number(ch)));
        return Sprites.floor(th, v);
    }
  }

  function camera() {
    const vw = VW * TS, vh = VH * TS, mw = G.w * TS, mh = G.h * TS;
    let cx = P.fx * TS + TS / 2 - vw / 2, cy = P.fy * TS + TS / 2 - vh / 2;
    cx = mw <= vw ? (mw - vw) / 2 : Math.max(0, Math.min(mw - vw, cx));
    cy = mh <= vh ? (mh - vh) / 2 : Math.max(0, Math.min(mh - vh, cy));
    G.cam = { x: Math.round(cx * SC) / SC, y: Math.round(cy * SC) / SC };
    return G.cam;
  }

  function render(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = { grass: '#2b6e33', geo: '#2a2219', optic: '#11142a', atom: '#10303a', farm: '#20402a', body: '#2a1418', elec: '#141b2c', space: '#0e1024' }[theme()] || '#1c2333';
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    const cam = camera();
    const X = (wx) => Math.round((wx - cam.x) * SC), Y = (wy) => Math.round((wy - cam.y) * SC);
    const x0 = Math.max(0, Math.floor(cam.x / TS)), y0 = Math.max(0, Math.floor(cam.y / TS));
    const x1 = Math.min(G.w - 1, x0 + VW + 1), y1 = Math.min(G.h - 1, y0 + VH + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      ctx.drawImage(tileImg(G.grid[y][x], x, y, t), X(x * TS), Y(y * TS), TS * SC, TS * SC);
    }

    // 사람·물건을 아래쪽 것이 앞에 오도록
    const ents = [];
    const shadow = (wx, wy, w = 5) => { ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(X(wx + 8), Y(wy + 15), w * SC, 1.6 * SC, 0, 0, Math.PI * 2); ctx.fill(); };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (G.grid[y][x] === 'N') ents.push({ y, draw: () => { shadow(x * TS, y * TS); ctx.drawImage(Sprites.guide(SQ.guideName()), X(x * TS), Y(y * TS - 3 + (Math.floor(t / 600) % 2)), TS * SC, TS * SC); } });
    }
    if (G.bossAt) {
      const b = G.bossAt;
      ents.push({ y: b.y + 1, draw: () => { ctx.drawImage(Sprites.slime(Math.floor(t / 420) % 2, SQ.bossSkin()), X(b.x * TS), Y(b.y * TS), 32 * SC, 32 * SC); } });
    }
    ents.push({ y: BOT.fy, draw: () => { shadow(BOT.fx * TS, BOT.fy * TS, 4); ctx.drawImage(Sprites.buddy(), X(BOT.fx * TS), Y(BOT.fy * TS - 4 + Math.sin(t / 260) * 1.5), TS * SC, TS * SC); } });
    ents.push({ y: P.fy + 0.01, draw: () => {
      const fr = P.moving ? Math.floor(t / 120) % 2 : 0;
      shadow(P.fx * TS, P.fy * TS);
      ctx.drawImage(Sprites.person(save.look)[P.dir][fr], X(P.fx * TS), Y(P.fy * TS - 3), TS * SC, TS * SC);
    } });
    ents.sort((a, b) => a.y - b.y).forEach((e) => e.draw());

    // 안내 화살표와 연구소 이름표
    const arrow = (wx, wy) => {
      const bob = Math.sin(t / 180) * 3, ax = X(wx + 8), ay = Y(wy) - 10 + bob;
      ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#1b2030'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(ax - 12, ay - 14); ctx.lineTo(ax + 12, ay - 14); ctx.lineTo(ax, ay); ctx.closePath(); ctx.fill(); ctx.stroke();
    };
    if (G.kind === 'hub') {
      const next = SQ_UNITS.find((u) => !save.cleared[u.no]);
      ctx.font = '700 17px Galmuri11, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let y = 0; y < G.h; y++) for (let x = 0; x < G.w; x++) {
        const ch = G.grid[y][x];
        if (!isDigit(ch)) continue;
        const n = Number(ch), u = SQ_UNITS[n - 1], st = portalState(n), top = y < G.h / 2;
        const label = `${save.cleared[n] ? '🔑 ' : ''}${n}. ${u.unit}`;
        const lx = X(x * TS + 8), ly = top ? Y(y * TS) - 18 : Y((y + 1) * TS) + 18;
        const w = ctx.measureText(label).width + 18;
        ctx.fillStyle = st === 'open' ? 'rgba(20,24,38,.85)' : 'rgba(20,24,38,.6)';
        ctx.fillRect(lx - w / 2, ly - 14, w, 28);
        ctx.fillStyle = save.cleared[n] ? '#ffd36b' : st === 'open' ? '#ffffff' : '#aab2cc';
        ctx.fillText(label, lx, ly + 1);
        if (next && next.no === n && st === 'open' && SQ_DATA[n]) arrow(x * TS, top ? y * TS - 10 : y * TS);
      }
    } else if (G.doorOpen && G.doorAt) arrow(G.doorAt.x * TS, G.doorAt.y * TS);
  }

  // ───────── 첫 화면 그림 ─────────
  const tcv = $('#title-scene'), tctx = tcv.getContext('2d');
  function renderTitle(t) {
    tctx.imageSmoothingEnabled = false;
    const f = Math.floor(t / 420) % 2;
    for (let y = 0; y < 6; y++) for (let x = 0; x < 20; x++) tctx.drawImage(y === 4 ? Sprites.path(x & 3) : (x * 3 + y) % 7 === 0 ? Sprites.flower(x & 3) : Sprites.grass((x + y) & 3), x * 16, y * 16);
    tctx.drawImage(Sprites.tree(1), 0, 16); tctx.drawImage(Sprites.tree(2), 304, 32); tctx.drawImage(Sprites.tree(3), 272, 0);
    tctx.drawImage(Sprites.portal(f, 'open'), 64, 32);
    tctx.drawImage(Sprites.portal(f, 'locked'), 208, 32);
    tctx.drawImage(Sprites.archimedes(), 96, 48 + f);
    tctx.drawImage(Sprites.person(save.look).right[Math.floor(t / 160) % 2], 128, 48);
    tctx.drawImage(Sprites.buddy(), 112, 46 + Math.round(Math.sin(t / 260) * 1.5));
    tctx.drawImage(Sprites.slime(f), 168, 34);
    tctx.drawImage(Sprites.quiz(f, 'grass'), 240, 64);
  }

  // ───────── 입력 ─────────
  const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  addEventListener('keydown', (e) => {
    if (UI.handleKey(e)) return;
    if (G.scene !== 'hub' && G.scene !== 'stage') return;
    if (e.target.closest && e.target.closest('input, textarea')) return;
    const d = KEYMAP[e.code];
    if (d) {
      e.preventDefault();
      if (!held.includes(d)) held.push(d);
      if (!e.repeat) { bumpArmed = true; tapDir = d; }
      return;
    }
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) interactFacing(); }
  });
  addEventListener('keyup', (e) => { const d = KEYMAP[e.code]; if (d) { const i = held.indexOf(d); if (i >= 0) held.splice(i, 1); } });
  addEventListener('blur', () => { held.length = 0; });

  cvs.addEventListener('pointerdown', (e) => {
    if ((G.scene !== 'hub' && G.scene !== 'stage') || busy()) return;
    const r = cvs.getBoundingClientRect();
    const sx = (e.clientX - r.left) / r.width * cvs.width, sy = (e.clientY - r.top) / r.height * cvs.height;
    const tx = Math.floor((sx / SC + G.cam.x) / TS), ty = Math.floor((sy / SC + G.cam.y) / TS);
    if (tx === P.x && ty === P.y) { interactFacing(); return; }
    planPath(tx, ty);
  });

  document.querySelectorAll('#touch [data-dir]').forEach((b) => {
    const d = b.dataset.dir;
    const on = (e) => { e.preventDefault(); if (!held.includes(d)) held.push(d); bumpArmed = true; tapDir = d; b.setPointerCapture && b.setPointerCapture(e.pointerId); };
    const off = () => { const i = held.indexOf(d); if (i >= 0) held.splice(i, 1); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
  });
  $('#btn-a').addEventListener('pointerdown', (e) => { e.preventDefault(); if (UI.isOpen()) { UI.handleKey({ code: 'Enter', preventDefault() {}, repeat: false, target: document.body }); return; } interactFacing(); });

  // ───────── 돌리기 ─────────
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(50, now - last); last = now;
    if (G.scene === 'hub' || G.scene === 'stage') { update(dt); render(now); updatePrompt(); }
    else if (!$('#screen-title').hidden) renderTitle(now);
    if (!$('#screen-make').hidden && draft) {
      const mc = $('#make-canvas'), mx = mc.getContext('2d');
      mx.clearRect(0, 0, 16, 16); mx.drawImage(Sprites.person(draft.look).down[Math.floor(now / 400) % 2], 0, 0);
    }
    requestAnimationFrame(frame);
  }

  setTouch(matchMedia('(pointer: coarse)').matches);
  showTitle();
  requestAnimationFrame(frame);
  if (document.fonts && document.fonts.load) document.fonts.load('700 17px Galmuri11').catch(() => {});
})();
