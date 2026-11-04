// 픽셀 그림 — 바깥 그림 파일 없이 코드로 16×16 칸을 그려 캐시해 둔다.
// 바닥이 있는 칸(문제 칸, 책, 상자, 실험대 등)은 테마(th)에 따라 바닥이 달라진다: 'lab' 실험실, 'geo' 바위 동굴, 'grass' 풀밭
(function () {
  'use strict';
  const cache = {};

  function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // 글자 그림(rows) + 팔레트 → 캔버스. outline 색을 주면 바깥 테두리를 자동으로 두른다.
  function fromRows(rows, pal, outline) {
    const h = rows.length, w = rows[0].length, c = cv(w, h), x = c.getContext('2d');
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const col = pal[rows[j][i]];
      if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); }
    }
    if (outline) addOutline(c, outline);
    return c;
  }

  function addOutline(c, color) {
    const x = c.getContext('2d'), w = c.width, h = c.height;
    const d = x.getImageData(0, 0, w, h).data;
    const on = (i, j) => i >= 0 && j >= 0 && i < w && j < h && d[(j * w + i) * 4 + 3] > 0;
    x.fillStyle = color;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (on(i, j)) continue;
      if (on(i + 1, j) || on(i - 1, j) || on(i, j + 1) || on(i, j - 1)) x.fillRect(i, j, 1, 1);
    }
  }

  function flipH(src) {
    const c = cv(src.width, src.height), x = c.getContext('2d');
    x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0);
    return c;
  }

  function rng(seed) {
    let s = (seed * 2654435761) >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  // 16×16 칸 하나를 그려 캐시
  function tile(key, fn, w = 16, h = 16) {
    if (cache[key]) return cache[key];
    const c = cv(w, h), x = c.getContext('2d');
    const p = (col, i, j, ww = 1, hh = 1) => { x.fillStyle = col; x.fillRect(i, j, ww, hh); };
    fn(p, x);
    return (cache[key] = c);
  }

  // ───────── 사람 캐릭터 ─────────
  const FRONT = [
    '................',
    '.....HHHHHH.....',
    '....HHHHHHHH....',
    '...HHHHHHHHHH...',
    '...HHSSSSSSHH...',
    '...HSSSSSSSSH...',
    '...HSSESSESSH...',
    '...HSRSSSSRSH...',
    '....SSSMMSSS....',
    '.....SSSSSS.....',
    '....TTTTTTTT....',
    '...STTTTTTTTS...',
    '...STTTTTTTTS...',
    '....PPPPPPPP....',
  ];
  const BACK = [
    '................',
    '.....HHHHHH.....',
    '....HHHHHHHH....',
    '...HHHHHHHHHH...',
    '...HHHHHHHHHH...',
    '...HHHHHHHHHH...',
    '...HHHHHHHHHH...',
    '...HHHHHHHHHH...',
    '....HHHHHHHH....',
    '.....SSSSSS.....',
    '....TTTTTTTT....',
    '...STTTTTTTTS...',
    '...STTTTTTTTS...',
    '....PPPPPPPP....',
  ];
  const SIDE = [
    '................',
    '.....HHHHHH.....',
    '....HHHHHHHH....',
    '...HHHHHHHHHH...',
    '...HHHHSSSSSH...',
    '...HHHSSSSSSS...',
    '...HHHSSSSESS...',
    '...HHHSSSSRSSS..',
    '....HHSSSSMSS...',
    '.....SSSSSS.....',
    '....TTTTTTTT....',
    '....TTTSTTTT....',
    '....TTTSTTTT....',
    '....PPPPPPPP....',
  ];
  const LEGS = {
    stand: ['....PPP..PPP....', '....BBB..BBB....'],
    walk:  ['...PPP....PPP...', '...BBB....BBB...'],
    sideStand: ['....PPP..PPP....', '....BBB..BBBB...'],
    sideWalk:  ['...PPP....PPP...', '..BBB.....BBBB..'],
  };
  // 긴 머리일 때 더 칠할 자리 [x, y]
  const LONG = {
    down:  [[3, 8], [12, 8], [3, 9], [12, 9], [3, 10], [12, 10], [4, 9], [11, 9]],
    up:    [[4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [11, 9], [4, 10], [5, 10], [10, 10], [11, 10], [3, 8], [12, 8]],
    right: [[3, 8], [3, 9], [4, 9], [3, 10], [4, 10]],
  };

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('');
  }

  function person(look) {
    const key = 'person:' + JSON.stringify(look);
    if (cache[key]) return cache[key];
    const pal = {
      H: look.hairColor, S: look.skin, E: '#1d1f2b', M: '#c2504a', R: shade(look.skin, 0.9),
      T: look.shirt, P: look.pants || '#2f3b56', B: '#1c2130',
    };
    const build = (top, legs, extra) => {
      const rows = top.concat(legs).map((r) => r.split(''));
      if (look.hair === 'long' && extra) for (const [x, y] of extra) if (rows[y][x] !== 'E') rows[y][x] = 'H';
      return fromRows(rows.map((r) => r.join('')), pal, '#161a26');
    };
    const out = {
      down:  [build(FRONT, LEGS.stand, LONG.down), build(FRONT, LEGS.walk, LONG.down)],
      up:    [build(BACK, LEGS.stand, LONG.up), build(BACK, LEGS.walk, LONG.up)],
      right: [build(SIDE, LEGS.sideStand, LONG.right), build(SIDE, LEGS.sideWalk, LONG.right)],
    };
    out.left = out.right.map(flipH);
    return (cache[key] = out);
  }

  // ───────── 길잡이 과학자 ─────────
  const GUIDES = {
    archimedes: {
      rows: [
        '................',
        '.....LLLLLL.....',
        '....LHHHHHHL....',
        '...HHHHHHHHHH...',
        '...HSSSSSSSSH...',
        '...HSSESSESSH...',
        '...HSSSSSSSSH...',
        '...HWWSSSSWWH...',
        '....WWWWWWWW....',
        '.....WWWWWW.....',
        '...TTTTTTTTTT...',
        '..STOTTTTTTTTS..',
        '...TTOTTTTTTT...',
        '...TTTOTTTTTT...',
        '....TTTTTTTT....',
        '....DD....DD....',
      ],
      pal: { L: '#4fae4f', H: '#d6d6d6', S: '#e8b98f', E: '#1d1f2b', W: '#f4f4f4', T: '#f6f0de', O: '#b23a2f', D: '#8b5a2b' },
    },
    // 베게너: 그린란드 탐험 털옷 차림
    wegener: {
      rows: [
        '................',
        '.....HHHHHH.....',
        '....HHHHHHHH....',
        '...HHHHHHHHHH...',
        '...HSSSSSSSSH...',
        '...HSSESSESSH...',
        '...HSSSSSSSSH...',
        '....SMMMMMMS....',
        '....SSSSSSSS....',
        '.....SSSSSS.....',
        '...FFFFFFFFFF...',
        '..SCCCCZCCCCCS..',
        '...CCCCZCCCCC...',
        '...CCCCZCCCCC...',
        '....PPP..PPP....',
        '....BBB..BBB....',
      ],
      pal: { H: '#4a3423', S: '#e8b98f', E: '#1d1f2b', M: '#3a2618', F: '#efe6d2', C: '#3f6b5a', Z: '#c9a24a', P: '#3a3f52', B: '#2a2018' },
    },
    // 뉴턴: 긴 곱슬 가발과 흰 목도리
    newton: {
      rows: [
        '................',
        '.....WWWWWW.....',
        '...WWWWWWWWWW...',
        '..WWWSSSSSSWWW..',
        '..WWSSSSSSSSWW..',
        '..WWSSESSESSWW..',
        '..WWSSSSSSSSWW..',
        '..WWWSSMMSSWWW..',
        '..WWWWSSSSWWWW..',
        '..WWW.KKKK.WWW..',
        '...CCCKKKKCCC...',
        '..SCCCCKKCCCCS..',
        '...CCCCCCCCCC...',
        '...CCCCCCCCCC...',
        '....PPP..PPP....',
        '....BBB..BBB....',
      ],
      pal: { W: '#e8e4dc', S: '#f0c8a0', E: '#1d1f2b', M: '#b0504a', K: '#ffffff', C: '#4a3a5e', P: '#2e2a3a', B: '#1c1a22' },
    },
    // 멘델레예프: 덥수룩한 머리와 긴 수염
    mendeleev: {
      rows: [
        '................',
        '....HHHHHHHH....',
        '...HHHHHHHHHH...',
        '..HHHSSSSSSHHH..',
        '..HHSSSSSSSSHH..',
        '..HHSSESSESSHH..',
        '..HHSSSSSSSSHH..',
        '..HHBBSSSSBBHH..',
        '..HHBBBBBBBBHH..',
        '...HBBBBBBBBH...',
        '...CBBBBBBBBC...',
        '..SCCBBBBBBCCS..',
        '...CCCBBBBCCC...',
        '...CCCCBBCCCC...',
        '....PPP..PPP....',
        '....DDD..DDD....',
      ],
      pal: { H: '#a9a294', B: '#cfc8ba', S: '#ecc19a', E: '#1d1f2b', C: '#2f3a4a', P: '#232833', D: '#1a1d24' },
    },
    // 잉엔하우스: 18세기 흰 가발과 초록 웃옷
    ingenhousz: {
      rows: [
        '................',
        '....WWWWWWWW....',
        '...WWWWWWWWWW...',
        '..WWWSSSSSSWWW..',
        '..WWSSSSSSSSWW..',
        '..WWSSESSESSWW..',
        '..WwSSSSSSSSwW..',
        '...wSSSMMSSSw...',
        '....SSSSSSSS....',
        '.....SSKKSS.....',
        '...CCCKKKKCCC...',
        '..SCCCCKKCCCCS..',
        '...CCCCVVCCCC...',
        '...CCCCCCCCCC...',
        '....PPP..PPP....',
        '....BBB..BBB....',
      ],
      pal: { W: '#f2f0ea', w: '#cfcabc', S: '#efc29a', E: '#1d1f2b', M: '#b0504a', K: '#ffffff', C: '#2f6b45', V: '#d4af37', P: '#2b2f2a', B: '#1c1e1a' },
    },
    // 하비: 17세기 검은 옷, 흰 깃, 콧수염과 뾰족 턱수염
    harvey: {
      rows: [
        '................',
        '....HHHHHHHH....',
        '...HHHHHHHHHH...',
        '..HHHSSSSSSHHH..',
        '..HHSSSSSSSSHH..',
        '..HHSSESSESSHH..',
        '..HHSSSSSSSSHH..',
        '..HHSMMSSMMSHH..',
        '..HH.SSBBSS.HH..',
        '..HH..KBBK..HH..',
        '...KKKKKKKKKK...',
        '..SCCKKKKKKCCS..',
        '...CCCCCCCCCC...',
        '...CCCCCCCCCC...',
        '....PPP..PPP....',
        '....DDD..DDD....',
      ],
      pal: { H: '#2e2420', S: '#e9bb93', E: '#1d1f2b', M: '#2e2420', B: '#2e2420', K: '#f4f4f4', C: '#1f1f26', P: '#26262e', D: '#141418' },
    },
    // 패러데이: 19세기 갈색 곱슬머리와 긴 구레나룻, 남색 웃옷에 검은 나비넥타이
    faraday: {
      rows: [
        '................',
        '....HHHHHHHH....',
        '...HHHHHHHHHH...',
        '..HHHSSSSSSHHH..',
        '..HHSSSSSSSSHH..',
        '..HHSSESSESSHH..',
        '..HHSSSSSSSSHH..',
        '..HHSSSSSSSSHH..',
        '...HSSSMMSSSH...',
        '....SSSSSSSS....',
        '.....SKKKKS.....',
        '...CCCKBBKCCC...',
        '..SCCCKKKKCCCS..',
        '...CCCCVVCCCC...',
        '....PPP..PPP....',
        '....DDD..DDD....',
      ],
      pal: { H: '#5a3a24', S: '#efc29a', E: '#1d1f2b', M: '#b0504a', K: '#f4f4f4', B: '#1a1a22', C: '#2b3550', V: '#c9a24a', P: '#26262e', D: '#141418' },
    },
    // 허블: 20세기 짧게 빗어 넘긴 검은 머리, 갈색 트위드 웃옷에 빨간 넥타이
    hubble: {
      rows: [
        '................',
        '....HHHHHHHH....',
        '...HHHHHHHHHH...',
        '...HHHHSSSSSH...',
        '...HSSSSSSSSH...',
        '...SSSESSESSS...',
        '...SSSSSSSSSS...',
        '....SSSSSSSS....',
        '....SSSMMSSS....',
        '.....SSSSSS.....',
        '...JJJKRRKJJJ...',
        '..SJJJKRRKJJJS..',
        '...JJJJRRJJJJ...',
        '...JJJJJJJJJJ...',
        '....PPP..PPP....',
        '....DDD..DDD....',
      ],
      pal: { H: '#2a2420', S: '#efc29a', E: '#1d1f2b', M: '#b0504a', K: '#f4f4f4', R: '#b03a3a', J: '#7a5a3a', P: '#3a3a44', D: '#141418' },
    },
  };
  function guide(name) {
    const g = GUIDES[name] || GUIDES.archimedes;
    const key = 'guide:' + name;
    return cache[key] || (cache[key] = fromRows(g.rows, g.pal, '#161a26'));
  }
  const archimedes = () => guide('archimedes');

  function shopkeeper() {
    return person({ hair: 'short', hairColor: '#6b3e26', shirt: '#2f9e64', skin: '#f1c27d', pants: '#4a3a2a' }).down[0];
  }

  // ───────── 비커봇(같이 다니는 도우미) ─────────
  const BOT = [
    '................',
    '......KKKK......',
    '......GWWG......',
    '......GWWG......',
    '.....GWWWWG.....',
    '....GWWWWWWG....',
    '...GWWWWWWWWG...',
    '..GWLLLLLLLLWG..',
    '..GLLELLLLELLG..',
    '..GLLLLLLLLLLG..',
    '..GLLLMMMMLLLG..',
    '...GLLLLLLLLG...',
    '....GGGGGGGG....',
    '.....R....R.....',
    '....RR....RR....',
    '................',
  ];
  function buddy() {
    if (cache.bot) return cache.bot;
    return (cache.bot = fromRows(BOT, {
      K: '#9a6334', G: '#6aa5d4', W: '#e9f6ff', L: '#3fd18f', E: '#10233a', M: '#10233a', R: '#56607a',
    }, '#161a26'));
  }

  // ───────── 보스 슬라임(32×32) — skin 으로 색을 바꾼다 ─────────
  const SKINS = {
    mix:  { body: '#8e6bd6', low: '#7656c0', shine: '#c9b5ff', line: '#33215c', eye: '#1b1033',
            spots: [[10, 23, 2.4, '#f6d743'], [21, 25, 2.2, '#4fc3f7'], [15, 27, 1.6, '#a1673f'], [24, 18, 1.7, '#66d17a'], [7, 19, 1.4, '#ff8fb1']] },
    rock: { body: '#8a7f73', low: '#6e655b', shine: '#b8afa3', line: '#3b332c', eye: '#241d17',
            spots: [[10, 23, 2.4, '#c9b18a'], [21, 25, 2.2, '#5a6b7a'], [15, 27, 1.8, '#b5523b'], [24, 18, 1.7, '#e8e2d0'], [7, 19, 1.4, '#a3c46c']] },
    // 지지직 슬라임: 화면 화소처럼 빨강·초록·파랑 점이 박혀 있다
    tv:   { body: '#5b6cff', low: '#4453d6', shine: '#a9b4ff', line: '#1c2266', eye: '#10153d',
            spots: [[9, 23, 2, '#ff4d4d'], [13, 25, 2, '#3ee07a'], [17, 23, 2, '#4dc3ff'], [22, 25, 2, '#ffe14d'], [25, 19, 1.6, '#ffffff'], [7, 19, 1.5, '#ff6fd1']] },
    // 찌릿찌릿 이온슬라임: 전기 노란색 몸에 (+)·(−) 이온 점
    ion:  { body: '#f7d046', low: '#d9b02a', shine: '#fff2a8', line: '#5a4a10', eye: '#2b2306',
            spots: [[9, 23, 2, '#ff4d4d'], [14, 26, 1.8, '#4d8bff'], [19, 23, 2, '#ff4d4d'], [24, 25, 1.8, '#4d8bff'], [7, 19, 1.4, '#4d8bff'], [25, 18, 1.5, '#ff4d4d']] },
    // 그늘그늘 덩굴슬라임: 빛을 가리는 덩굴 초록색
    leaf: { body: '#5aa14a', low: '#3f7f36', shine: '#a8e08f', line: '#1f3d1a', eye: '#13240f',
            spots: [[9, 23, 2, '#2e5a26'], [14, 26, 1.8, '#ff4d5e'], [20, 23, 2, '#2e5a26'], [24, 25, 1.6, '#8a5a35'], [7, 19, 1.4, '#ffe14d'], [25, 18, 1.5, '#2e5a26']] },
    // 꼬르륵 배고픔슬라임: 주황 몸에 밥알·사탕·적혈구 점
    hungry: { body: '#ff9f6b', low: '#e07d48', shine: '#ffd2b5', line: '#5a2a14', eye: '#2b1408',
            spots: [[9, 23, 2, '#ffffff'], [14, 26, 1.8, '#ffe14d'], [20, 23, 2, '#e0405a'], [24, 25, 1.6, '#ffffff'], [7, 19, 1.4, '#e0405a'], [25, 18, 1.5, '#ffe14d']] },
    // 콜록콜록 먼지슬라임: 뿌연 회색 몸에 미세 먼지 점
    dust: { body: '#a7a39a', low: '#8a857b', shine: '#d8d4cc', line: '#3e3a34', eye: '#1f1c18',
            spots: [[9, 23, 2, '#6b665d'], [14, 26, 1.6, '#8a6a4a'], [20, 23, 2, '#6b665d'], [24, 25, 1.6, '#e8e6e0'], [7, 19, 1.4, '#8a6a4a'], [25, 18, 1.5, '#6b665d']] },
    // 깜깜 암흑슬라임: 별빛을 가리는 짙은 보라 몸에 갇힌 별 점
    dark: { body: '#3a2f5c', low: '#2b2347', shine: '#6a5aa0', line: '#120e22', eye: '#0b0816',
            spots: [[9, 23, 1.2, '#ffe9a8'], [14, 26, 1, '#cfd8ff'], [20, 23, 1.2, '#ffffff'], [24, 25, 1.6, '#5a4a80'], [7, 19, 1, '#cfd8ff'], [25, 18, 1.2, '#ffe9a8']] },
  };
  function slime(frame, skin = 'mix') {
    const S = SKINS[skin] || SKINS.mix;
    return tile('slime' + frame + skin, (p) => {
      const sq = frame ? 1 : 0;
      const cx = 16, cy = 19 + sq, rx = 14 + sq, ry = 12 - sq;
      const inside = (i, j) => {
        if (j > 29) return false;
        const dx = (i + 0.5 - cx) / rx, dy = (j + 0.5 - cy) / ry;
        return dx * dx + dy * dy <= 1;
      };
      for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) {
        if (!inside(i, j)) continue;
        let col = j > cy + 4 ? S.low : S.body;
        for (const [sx, sy, r, c] of S.spots) if ((i - sx) ** 2 + (j - sy) ** 2 <= r * r) col = c;
        if ((i - 10) ** 2 + (j - (cy - 6)) ** 2 <= 4) col = S.shine;
        const edge = !inside(i + 1, j) || !inside(i - 1, j) || !inside(i, j + 1) || !inside(i, j - 1);
        p(edge ? S.line : col, i, j);
      }
      const ey = cy - 3;
      p('#ffffff', 10, ey, 4, 4); p('#ffffff', 18, ey, 4, 4);
      p(S.eye, 12, ey + 1, 2, 2); p(S.eye, 18, ey + 1, 2, 2);
      p(S.line, 9, ey - 2, 2, 1); p(S.line, 11, ey - 1, 3, 1);
      p(S.line, 21, ey - 2, 2, 1); p(S.line, 18, ey - 1, 3, 1);
      p(S.line, 13, ey + 6, 6, 1); p('#ffffff', 14, ey + 6, 1, 1); p('#ffffff', 17, ey + 6, 1, 1);
    }, 32, 32);
  }

  // ───────── 바닥·벽 ─────────
  function labFloor(v) {
    return tile('lab' + v, (p) => {
      p('#e5ebf2', 0, 0, 16, 16); p('#d0d9e5', 0, 15, 16, 1); p('#d0d9e5', 15, 0, 1, 16);
      const r = rng(v + 3);
      for (let k = 0; k < 3; k++) p('#d9e1ec', 1 + Math.floor(r() * 13), 1 + Math.floor(r() * 13));
    });
  }
  function geoFloor(v) {
    return tile('geo' + v, (p) => {
      p('#d8c6a2', 0, 0, 16, 16); p('#c5b08a', 0, 15, 16, 1); p('#c5b08a', 15, 0, 1, 16);
      const r = rng(v + 29);
      for (let k = 0; k < 4; k++) p(k % 2 ? '#cbb791' : '#e4d5b6', 1 + Math.floor(r() * 13), 1 + Math.floor(r() * 13), 2, 1);
    });
  }
  function grass(v) {
    return tile('grass' + v, (p) => {
      p('#7cc35c', 0, 0, 16, 16);
      const r = rng(v + 17);
      for (let k = 0; k < 7; k++) { const i = Math.floor(r() * 15), j = Math.floor(r() * 14); p('#62a947', i, j, 1, 2); }
      for (let k = 0; k < 3; k++) p('#9bd877', Math.floor(r() * 16), Math.floor(r() * 16));
    });
  }
  function opticFloor(v) {
    return tile('optic' + v, (p) => {
      p('#3a4166', 0, 0, 16, 16); p('#454d78', 0, 15, 16, 1); p('#454d78', 15, 0, 1, 16);
      const r = rng(v + 53);
      for (let k = 0; k < 2; k++) p('#59628f', 1 + Math.floor(r() * 13), 1 + Math.floor(r() * 13));
    });
  }
  // 주기율표 칸처럼 생긴 바닥 — 귀퉁이 색 띠가 칸마다 다르다
  function atomFloor(v) {
    return tile('atomf' + v, (p) => {
      p('#eef0e6', 0, 0, 16, 16); p('#c7cdb8', 0, 15, 16, 1); p('#c7cdb8', 15, 0, 1, 16);
      p(['#ffd166', '#06d6a0', '#7fb3e6', '#ef8aa0'][v], 1, 1, 4, 1);
      p('#d8dccb', 5, 6, 4, 1); p('#d8dccb', 5, 8, 3, 1);
    });
  }
  // 스마트팜 온실 바닥
  function farmFloor(v) {
    return tile('farmf' + v, (p) => {
      p('#dfe9cf', 0, 0, 16, 16); p('#c9d6b4', 0, 15, 16, 1); p('#c9d6b4', 15, 0, 1, 16);
      const r = rng(v + 71);
      for (let k = 0; k < 3; k++) p('#d2dfbe', 1 + Math.floor(r() * 13), 1 + Math.floor(r() * 13), 2, 1);
    });
  }
  // 인체 탐험관 바닥: 연분홍 타일
  function bodyFloor(v) {
    return tile('bodyf' + v, (p) => {
      p('#f7e3e3', 0, 0, 16, 16); p('#ecc9cb', 0, 15, 16, 1); p('#ecc9cb', 15, 0, 1, 16);
      const r = rng(v + 89);
      for (let k = 0; k < 3; k++) p('#f0d4d6', 1 + Math.floor(r() * 13), 1 + Math.floor(r() * 13), 2, 2);
    });
  }
  // 전기 연구소 바닥: 초록 회로 기판에 배선과 납땜 자리
  function elecFloor(v) {
    return tile('elecf' + v, (p) => {
      p('#2f6a4c', 0, 0, 16, 16); p('#29603f', 0, 15, 16, 1); p('#29603f', 15, 0, 1, 16);
      const r = rng(v + 97), y = 4 + Math.floor(r() * 8), x = 4 + Math.floor(r() * 8);
      p('#3d8060', 1, y, x, 1); p('#3d8060', x, y, 1, 14 - y);
      p('#d4af55', x - 1, y - 1, 3, 3); p('#2f6a4c', x, y, 1, 1);
    });
  }
  // 천문대 바닥: 짙은 남보라 판에 작은 별
  function spaceFloor(v) {
    return tile('spacef' + v, (p) => {
      p('#22264a', 0, 0, 16, 16); p('#1b1f3d', 0, 15, 16, 1); p('#1b1f3d', 15, 0, 1, 16);
      const r = rng(v + 113);
      for (let k = 0; k < 3; k++) p(k ? '#5a62a0' : '#cfd8ff', 1 + Math.floor(r() * 13), 1 + Math.floor(r() * 13));
    });
  }
  function floor(th, v) {
    return th === 'geo' ? geoFloor(v) : th === 'grass' ? grass(v) : th === 'optic' ? opticFloor(v)
      : th === 'atom' ? atomFloor(v) : th === 'farm' ? farmFloor(v) : th === 'body' ? bodyFloor(v)
      : th === 'elec' ? elecFloor(v) : th === 'space' ? spaceFloor(v) : labFloor(v);
  }

  function wall(th = 'lab') {
    if (th === 'space') {
      // 천문대 벽: 쇠판 벽에 별이 보이는 둥근 창
      return tile('wallspace', (p) => {
        p('#34385a', 0, 0, 16, 16); p('#474c78', 0, 0, 16, 3); p('#22253d', 0, 3, 16, 1);
        p('#8a8fa8', 5, 5, 6, 1); p('#8a8fa8', 4, 6, 1, 6); p('#8a8fa8', 11, 6, 1, 6); p('#8a8fa8', 5, 12, 6, 1);
        p('#0b0d1f', 5, 6, 6, 6);
        p('#ffffff', 6, 7, 1, 1); p('#ffe9a8', 9, 9, 1, 1); p('#cfd8ff', 7, 10, 1, 1);
        p('#22253d', 1, 14, 1, 1); p('#22253d', 14, 14, 1, 1);
      });
    }
    if (th === 'elec') {
      // 전기 연구소 벽: 짙은 남색 배전판에 노란 번개 무늬와 구리 배관
      return tile('wallelec', (p) => {
        p('#27324d', 0, 0, 16, 16); p('#3a4a70', 0, 0, 16, 3); p('#1a2236', 0, 3, 16, 1);
        p('#ffd23f', 2, 6, 3, 1); p('#ffd23f', 4, 7, 1, 2); p('#ffd23f', 4, 9, 4, 1); p('#ffd23f', 7, 10, 1, 2); p('#ffd23f', 7, 12, 3, 1);
        p('#c88a3a', 12, 4, 1, 12); p('#c88a3a', 14, 4, 1, 12);
      });
    }
    if (th === 'body') {
      // 인체 탐험관 벽: 짙은 자주색 벽에 동맥(빨강)·정맥(파랑) 무늬
      return tile('wallbody', (p) => {
        p('#7a2e3c', 0, 0, 16, 16); p('#9a4252', 0, 0, 16, 3); p('#5e2230', 0, 3, 16, 1);
        p('#c0485a', 0, 7, 6, 1); p('#c0485a', 5, 6, 1, 2); p('#c0485a', 6, 5, 5, 1); p('#c0485a', 10, 6, 1, 3); p('#c0485a', 11, 9, 5, 1);
        p('#5a6fb0', 0, 12, 4, 1); p('#5a6fb0', 3, 11, 1, 2); p('#5a6fb0', 4, 11, 6, 1); p('#5a6fb0', 9, 12, 1, 3);
      });
    }
    if (th === 'farm') {
      // 유리 온실 벽: 연한 유리판과 흰 창틀
      return tile('wallfarm', (p) => {
        p('#9fd3c7', 0, 0, 16, 16); p('#eef7f4', 0, 0, 16, 2); p('#6aa89a', 0, 14, 16, 2);
        p('#eef7f4', 0, 0, 1, 16); p('#eef7f4', 8, 0, 1, 14);
        p('#c9ece4', 2, 3, 2, 1); p('#c9ece4', 2, 4, 1, 3); p('#c9ece4', 10, 4, 2, 1); p('#c9ece4', 10, 5, 1, 3);
      });
    }
    if (th === 'atom') {
      return tile('wallatom', (p) => {
        p('#1f5560', 0, 0, 16, 16); p('#2b7380', 0, 0, 16, 3); p('#143a42', 0, 3, 16, 1);
        for (const y of [7, 11, 15]) p('#174048', 0, y, 16, 1);
        for (const x of [4, 12]) { p('#174048', x, 4, 1, 3); p('#174048', x, 12, 1, 3); }
        for (const x of [0, 8]) p('#174048', x, 8, 1, 3);
        p('#3a8c99', 1, 4, 2, 1); p('#3a8c99', 9, 8, 2, 1); p('#3a8c99', 5, 12, 2, 1);
      });
    }
    if (th === 'optic') {
      return tile('walloptic', (p) => {
        p('#1f2340', 0, 0, 16, 16); p('#2d3360', 0, 0, 16, 3); p('#15182e', 0, 3, 16, 1);
        const led = ['#ff5d5d', '#4ee07a', '#5aa8ff'];
        for (let i = 0; i < 16; i += 2) p(led[(i / 2) % 3], i, 6, 1, 1);
        p('#15182e', 0, 10, 16, 1); p('#15182e', 8, 11, 1, 5); p('#15182e', 3, 4, 1, 6); p('#15182e', 12, 4, 1, 6);
      });
    }
    if (th === 'geo') {
      return tile('wallgeo', (p) => {
        p('#6b5a4a', 0, 0, 16, 16); p('#86735f', 0, 0, 16, 3); p('#4e4135', 0, 3, 16, 1);
        p('#5c4d3f', 2, 6, 5, 3); p('#7a6855', 2, 6, 5, 1); p('#5c4d3f', 9, 9, 6, 4); p('#7a6855', 9, 9, 6, 1);
        p('#4e4135', 7, 5, 1, 5); p('#4e4135', 3, 12, 4, 1); p('#4e4135', 12, 4, 1, 4);
      });
    }
    return tile('wall', (p) => {
      p('#3f4b63', 0, 0, 16, 16); p('#5a6a87', 0, 0, 16, 3); p('#2c3546', 0, 3, 16, 1);
      for (const y of [7, 11, 15]) p('#2c3546', 0, y, 16, 1);
      for (const x of [4, 12]) { p('#2c3546', x, 4, 1, 3); p('#2c3546', x, 12, 1, 3); }
      for (const x of [0, 8]) p('#2c3546', x, 8, 1, 3);
      p('#4b5975', 1, 4, 2, 1); p('#4b5975', 9, 8, 2, 1); p('#4b5975', 5, 12, 2, 1);
    });
  }
  function path(v) {
    return tile('path' + v, (p) => {
      p('#e4c891', 0, 0, 16, 16);
      const r = rng(v + 41);
      for (let k = 0; k < 4; k++) p('#caa970', Math.floor(r() * 15), Math.floor(r() * 15), 2, 1);
      for (let k = 0; k < 3; k++) p('#f1dbb0', Math.floor(r() * 16), Math.floor(r() * 16));
    });
  }
  function flower(v) {
    return tile('flower' + v, (p, x) => {
      x.drawImage(grass(v), 0, 0);
      const fl = (i, j, petal) => { p(petal, i - 1, j); p(petal, i + 1, j); p(petal, i, j - 1); p(petal, i, j + 1); p('#ffe066', i, j); };
      fl(4, 5, v % 2 ? '#ff86b1' : '#ffffff'); fl(11, 10, v % 2 ? '#ffffff' : '#b18cff');
    });
  }
  function tree(v) {
    return tile('tree' + v, (p, x) => {
      x.drawImage(grass(v), 0, 0);
      p('#00000022', 3, 13, 10, 2);
      p('#7a4a2b', 7, 10, 2, 5);
      for (let j = 0; j < 12; j++) for (let i = 0; i < 16; i++) {
        const d = (i + 0.5 - 8) ** 2 + (j + 0.5 - 6) ** 2;
        if (d <= 42) p(d > 30 ? '#2b6e33' : (i < 8 && j < 6 ? '#5cbf4f' : '#3e9b47'), i, j);
      }
    });
  }
  function water(f) {
    return tile('water' + f, (p) => {
      p('#3d8fd6', 0, 0, 16, 16);
      for (let k = 0; k < 3; k++) p('#7cc4f5', (k * 6 + f * 3) % 14, 3 + k * 5, 3, 1);
    });
  }
  function lava(f) {
    return tile('lava' + f, (p) => {
      p('#e8501f', 0, 0, 16, 16); p('#7a2a12', 0, 0, 16, 1); p('#7a2a12', 0, 15, 16, 1);
      for (let k = 0; k < 3; k++) { const x = (k * 5 + f * 4) % 13, y = 3 + k * 4; p('#ffb03b', x, y, 3, 2); p('#ffe08a', x + 1, y, 1, 1); }
      p('#c23d14', (f * 7) % 12, 12, 4, 1);
    });
  }

  // ───────── 물건 칸(바닥은 테마를 따름) ─────────
  function bench(v, th = 'lab') {
    return tile('bench' + v + th, (p, x) => {
      x.drawImage(floor(th, v), 0, 0);
      p('#00000022', 1, 14, 14, 2);
      p('#a06a3e', 1, 7, 14, 3); p('#7d5030', 1, 10, 14, 1); p('#6a4328', 2, 11, 1, 4); p('#6a4328', 13, 11, 1, 4);
      p('#cfe9ff', 3, 3, 3, 4); p('#3fb6ff', 3, 5, 3, 2);
      p('#cfe9ff', 9, 1, 2, 3); p('#cfe9ff', 8, 4, 4, 3); p('#ff6b6b', 8, 5, 4, 2);
      p('#cfe9ff', 13, 2, 1, 5); p('#8bd450', 13, 4, 1, 3);
    });
  }
  function plant(v, th = 'lab') {
    return tile('plant' + v + th, (p, x) => {
      x.drawImage(floor(th, v), 0, 0);
      p('#2e7d32', 5, 3, 2, 6); p('#4caf50', 7, 1, 2, 9); p('#2e7d32', 9, 4, 2, 5); p('#4caf50', 4, 5, 2, 2); p('#4caf50', 10, 6, 2, 2);
      p('#d8804f', 3, 10, 10, 1); p('#c0643a', 4, 11, 8, 4);
    });
  }
  function boulder(v, th = 'geo') {
    return tile('boulder' + v + th, (p, x) => {
      x.drawImage(floor(th, v), 0, 0);
      p('#00000026', 2, 13, 12, 2);
      for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
        const d = ((i + 0.5 - 8) / 6.5) ** 2 + ((j + 0.5 - 9) / 5.5) ** 2;
        if (d <= 1) p(d > 0.75 ? '#5e564d' : (i < 8 && j < 8 ? '#aaa196' : '#8d8378'), i, j);
      }
      p('#5e564d', 7, 7, 1, 3); p('#5e564d', 8, 9, 2, 1);
    });
  }
  function crystal(v, th = 'geo') {
    return tile('crystal' + v + th, (p, x) => {
      x.drawImage(floor(th, v), 0, 0);
      p('#00000022', 3, 14, 10, 2);
      const c = v % 2 ? ['#b48cff', '#d9c5ff', '#7a52d1'] : ['#7fe0ff', '#c9f4ff', '#3a9fc4'];
      const shard = (sx, top, w) => { p(c[2], sx, top, w, 14 - top); p(c[0], sx, top + 1, w - 1, 13 - top - 1); p(c[1], sx, top + 1, 1, 13 - top - 2); };
      shard(3, 6, 3); shard(6, 2, 4); shard(10, 5, 3);
      p('#6b5a4a', 2, 14, 12, 1);
    });
  }
  // 빛·소리 실험실 장식
  function lamp(v, th = 'optic') {
    return tile('lamp' + v + th, (p, x) => {
      x.drawImage(floor(th, v), 0, 0);
      p('#00000030', 3, 14, 10, 2);
      p('#fff3b055', 2, 0, 12, 9);
      p('#8a8fa8', 7, 7, 2, 7); p('#5c6178', 4, 13, 8, 2);
      p('#c9a24a', 4, 5, 8, 2); p('#ffe066', 5, 1, 6, 4); p('#fffbe0', 6, 2, 2, 2);
    });
  }
  function prism(v, th = 'optic') {
    return tile('prism' + v + th, (p, x) => {
      x.drawImage(floor(th, v), 0, 0);
      p('#00000030', 2, 14, 11, 2);
      for (let j = 0; j < 10; j++) { const w = j + 1; p(j === 9 ? '#6aa5d4' : '#cfe9ff', 7 - Math.floor(w / 2), 4 + j, w, 1); }
      p('#6aa5d4', 7, 3, 1, 1); p('#ffffff', 6, 7, 1, 3);
      ['#ff4d4d', '#ff9f43', '#ffe14d', '#3ee07a', '#4dc3ff', '#7d5cff'].forEach((c, i) => p(c, 12, 7 + i, 4, 1));
    });
  }
  function mirror(v, th = 'optic') {
    return tile('mirror' + v + th, (p, x) => {
      x.drawImage(floor(th, v), 0, 0);
      p('#00000030', 3, 14, 10, 2);
      p('#8a6b4a', 3, 1, 10, 12); p('#bfe3ff', 4, 2, 8, 10); p('#e8f6ff', 5, 3, 2, 1); p('#ffffff', 5, 4, 1, 3); p('#ffffff', 9, 8, 1, 2);
      p('#6a4f36', 4, 13, 1, 2); p('#6a4f36', 11, 13, 1, 2);
    });
  }
  function speaker(v, th = 'optic') {
    return tile('speaker' + v + th, (p, x) => {
      x.drawImage(floor(th, v), 0, 0);
      p('#00000030', 3, 14, 10, 2);
      p('#24242c', 3, 1, 10, 14); p('#3a3a46', 4, 2, 8, 12);
      p('#6b6b78', 6, 3, 4, 3); p('#1c1c22', 7, 4, 2, 1);
      p('#6b6b78', 5, 7, 6, 6); p('#1c1c22', 7, 9, 2, 2);
      p('#7dd3ff', 14, 5, 1, 2); p('#7dd3ff', 15, 4, 1, 4);
    });
  }

  // 원소 연구소 장식: 원자 모형, 주기율표 판
  function atomModel(v, th = 'atom') {
    return tile('atommodel' + v + th, (p, x) => {
      x.drawImage(floor(th, v), 0, 0);
      p('#00000026', 4, 14, 8, 2);
      p('#7a6a58', 7, 11, 2, 3); p('#5c4f42', 5, 13, 6, 2);
      x.strokeStyle = '#4d8bff'; x.lineWidth = 1;
      x.beginPath(); x.ellipse(8, 6, 6.5, 2.5, 0, 0, Math.PI * 2); x.stroke();
      x.beginPath(); x.ellipse(8, 6, 2.5, 5.5, 0, 0, Math.PI * 2); x.stroke();
      p('#ff4d4d', 7, 5, 1, 1); p('#ff4d4d', 8, 6, 1, 1); p('#9aa3b5', 8, 5, 1, 1); p('#9aa3b5', 7, 6, 1, 1);
      p('#ffd23f', 1, 6, 2, 1); p('#ffd23f', 8, 0, 1, 2); p('#ffd23f', 13, 5, 2, 1);
    });
  }
  function periodicBoard(v, th = 'atom') {
    return tile('ptable' + v + th, (p, x) => {
      x.drawImage(floor(th, v), 0, 0);
      p('#00000026', 1, 14, 14, 2);
      p('#3d3a33', 0, 2, 16, 10);
      const cols = ['#ff8f8f', '#ffcf6b', '#9be38f', '#8fc9ff', '#c9a6ff'];
      for (let j = 0; j < 4; j++) for (let i = 0; i < 7; i++) {
        if (j === 0 && i > 0 && i < 6) continue;
        p(cols[(i + j + v) % 5], 1 + i * 2, 3 + j * 2, 1, 1);
      }
      p('#5c4f42', 2, 12, 1, 3); p('#5c4f42', 13, 12, 1, 3);
    });
  }

  // 스마트팜 장식: 딸기 화단, LED 재배등
  function berryBed(v, th = 'farm') {
    return tile('berry' + v + th, (p, x) => {
      x.drawImage(floor(th, v), 0, 0);
      p('#5a3a24', 0, 7, 16, 9); p('#7a5236', 1, 8, 14, 7);
      for (let i = 0; i < 4; i++) { const cx = 1 + i * 4; p('#2e8b3e', cx, 3, 3, 3); p('#3fa34d', cx + 1, 2, 1, 1); p('#3fa34d', cx, 6, 3, 2); }
      [[2, 9], [7, 10], [11, 8], [13, 11]].forEach(([i, j], k) => { if ((k + v) % 4 === 3) return; p('#ff4d5e', i, j, 2, 2); p('#ffe14d', i, j + 1, 1, 1); p('#3fa34d', i, j - 1, 2, 1); });
    });
  }
  function growLight(v, th = 'farm') {
    return tile('grow' + v + th, (p, x) => {
      x.drawImage(floor(th, v), 0, 0);
      p('#00000026', 4, 14, 8, 2);
      p('#ff7ad955', 1, 4, 14, 8);
      p('#8a8fa8', 7, 4, 2, 10); p('#5c6178', 4, 13, 8, 2);
      p('#3d4152', 2, 1, 12, 3); p('#ff7ad9', 3, 3, 3, 1); p('#9b6bff', 6, 3, 4, 1); p('#ff7ad9', 10, 3, 3, 1);
    });
  }

  // 인체 탐험관 장식: 심장 모형, 폐 모형
  function heartModel(v, th = 'body') {
    return tile('heartm' + v + th, (p, x) => {
      x.drawImage(floor(th, v), 0, 0);
      p('#00000026', 4, 14, 8, 2);
      p('#7a6a58', 7, 11, 2, 3); p('#5c4f42', 5, 13, 6, 2);
      p('#5a6fb0', 5, 1, 2, 3); p('#e0405a', 8, 0, 3, 3);
      p('#a82a40', 3, 3, 10, 6); p('#e0405a', 4, 3, 8, 5); p('#a82a40', 5, 9, 6, 1); p('#a82a40', 6, 10, 4, 1);
      p('#ff8fa3', 5, 4, 2, 1); p('#a82a40', 8, 4, 1, 4);
    });
  }
  function lungModel(v, th = 'body') {
    return tile('lungm' + v + th, (p, x) => {
      x.drawImage(floor(th, v), 0, 0);
      p('#00000026', 3, 14, 10, 2);
      p('#d9d9e0', 7, 0, 2, 5); p('#d9d9e0', 5, 4, 6, 1);
      p('#c96a82', 2, 4, 5, 9); p('#f29bb0', 3, 5, 3, 7);
      p('#c96a82', 9, 4, 5, 9); p('#f29bb0', 10, 5, 3, 7);
      p('#ffd0db', 3, 6, 1, 2); p('#ffd0db', 10, 6, 1, 2);
    });
  }

  // 전기 연구소 장식: 코일(전자석), 전지, 공기 청정기
  function coil(v, th = 'elec') {
    return tile('coil' + v + th, (p, x) => {
      x.drawImage(floor(th, v), 0, 0);
      p('#00000030', 2, 13, 12, 3);
      p('#5c6178', 2, 11, 12, 3);
      p('#8a8fa8', 1, 6, 14, 3);
      for (let i = 3; i < 13; i++) p(i % 2 ? '#c87a3a' : '#e8a050', i, 4, 1, 7);
      p('#e84d4d', 3, 2, 1, 2); p('#e84d4d', 3, 1, 3, 1);
      p('#4d7dff', 12, 2, 1, 2); p('#4d7dff', 10, 1, 3, 1);
    });
  }
  function battery(v, th = 'elec') {
    return tile('battery' + v + th, (p, x) => {
      x.drawImage(floor(th, v), 0, 0);
      p('#00000030', 3, 14, 10, 2);
      p('#c9c9d0', 6, 1, 4, 2);
      p('#2a2a30', 4, 3, 8, 12); p('#3a3a44', 5, 4, 1, 10);
      p('#ffb347', 4, 5, 8, 5); p('#2a2a30', 7, 6, 2, 3); p('#2a2a30', 6, 7, 4, 1);
      p('#c9c9d0', 6, 12, 4, 1);
    });
  }
  function airPurifier(v, th = 'elec') {
    return tile('purifier' + v + th, (p, x) => {
      x.drawImage(floor(th, v), 0, 0);
      p('#00000030', 3, 14, 10, 2);
      p('#b8c0cc', 3, 1, 10, 14); p('#eef1f5', 4, 2, 8, 12);
      p('#b8c0cc', 5, 3, 6, 1); p('#b8c0cc', 5, 5, 6, 1);
      p('#9aa3b5', 5, 7, 6, 6); p('#eef1f5', 6, 8, 4, 4); p('#9aa3b5', 7, 9, 2, 2);
      p('#4dc3ff', 10, 2, 1, 1);
    });
  }

  // 천문대 장식: 천체 망원경, 로켓
  function telescope(v, th = 'space') {
    return tile('telescope' + v + th, (p, x) => {
      x.drawImage(floor(th, v), 0, 0);
      p('#00000030', 3, 14, 10, 2);
      p('#8a8fa8', 7, 9, 2, 2);
      p('#5c6178', 4, 11, 1, 4); p('#5c6178', 5, 10, 1, 1); p('#5c6178', 7, 11, 2, 4); p('#5c6178', 11, 11, 1, 4); p('#5c6178', 10, 10, 1, 1);
      for (let i = 0; i < 9; i++) p(i < 7 ? '#dfe4ee' : '#4d7dff', 3 + i, 9 - Math.round(i * 0.8), 2, 2);
      p('#b8c0cc', 4, 9, 1, 1);
    });
  }
  function rocket(v, th = 'space') {
    return tile('rocket' + v + th, (p, x) => {
      x.drawImage(floor(th, v), 0, 0);
      p('#00000030', 4, 14, 8, 2);
      p('#e84d4d', 7, 0, 2, 1); p('#e84d4d', 6, 1, 4, 2);
      p('#eef1f5', 6, 3, 4, 9); p('#c9ced8', 9, 3, 1, 9);
      p('#4dc3ff', 7, 5, 2, 2); p('#1b4a6a', 7, 6, 1, 1);
      p('#e84d4d', 4, 9, 2, 4); p('#e84d4d', 10, 9, 2, 4); p('#c0393a', 6, 11, 4, 1);
      p('#ffb347', 7, 12, 2, 2); p('#ffe066', 7, 14, 2, 1);
    });
  }

  const QGLYPH = ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'];
  function quiz(f, th = 'lab') {
    return tile('quiz' + f + th, (p, x) => {
      x.drawImage(floor(th, 1), 0, 0);
      const b = f ? 1 : 0;
      p('#00000026', 3, 14, 10, 2);
      p('#c98a00', 2, 1 + b, 12, 12); p('#ffcd3c', 3, 2 + b, 10, 10); p('#ffe68a', 3, 2 + b, 10, 1); p('#ffe68a', 3, 2 + b, 1, 9);
      QGLYPH.forEach((r, j) => [...r].forEach((c, i) => { if (c === '#') p('#7a4a00', 6 + i, 4 + b + j); }));
    });
  }
  function solved(th = 'lab') {
    return tile('solved' + th, (p, x) => {
      x.drawImage(floor(th, 1), 0, 0);
      const c = th === 'geo' ? '#9fc79a' : '#bfe6c6';
      p(c, 4, 8, 2, 2); p(c, 6, 10, 2, 2); p(c, 8, 8, 2, 2); p(c, 10, 6, 2, 2);
    });
  }
  function book(f, th = 'lab') {
    return tile('book' + f + th, (p, x) => {
      x.drawImage(floor(th, 2), 0, 0);
      const b = f ? 1 : 0;
      p('#00000022', 4, 14, 8, 2);
      p('#2a56a8', 3, 4 + b, 2, 8); p('#3f7be0', 5, 4 + b, 7, 8); p('#ffffff', 12, 5 + b, 1, 7); p('#ffd84d', 7, 6 + b, 3, 1); p('#ffd84d', 7, 8 + b, 3, 1);
      p('#fff7a8', f ? 13 : 2, f ? 2 : 3, 1, 1); p('#fff7a8', f ? 2 : 13, f ? 12 : 11, 1, 1);
    });
  }
  function chest(open, th = 'lab') {
    return tile('chest' + open + th, (p, x) => {
      x.drawImage(floor(th, 3), 0, 0);
      p('#00000022', 2, 14, 12, 2);
      p('#5a3518', 1, 5, 14, 10);
      if (open) { p('#3a2414', 2, 6, 12, 3); p('#c27a3e', 2, 2, 12, 3); p('#5a3518', 1, 1, 14, 1); p('#fff3a0', 6, 4, 1, 1); p('#fff3a0', 10, 3, 1, 1); }
      else { p('#c27a3e', 2, 6, 12, 3); }
      p('#a0602e', 2, 9, 12, 5); p('#f2c14e', 2, 9, 12, 1); p('#f2c14e', 7, 10, 2, 2);
    });
  }
  function station(f, done, th = 'lab') {
    return tile('station' + f + done + th, (p, x) => {
      x.drawImage(floor(th, 4), 0, 0);
      p('#00000022', 2, 14, 12, 2);
      p('#5d6b80', 2, 4, 12, 11); p('#9aa8bd', 2, 4, 12, 2); p('#14303a', 4, 7, 8, 5);
      if (done) { p('#1f6f3f', 4, 7, 8, 5); p('#7dff9b', 5, 9, 1, 1); p('#7dff9b', 6, 10, 1, 1); p('#7dff9b', 7, 9, 1, 1); p('#7dff9b', 8, 8, 1, 1); p('#7dff9b', 9, 7, 1, 1); }
      else { p('#2ee6c8', 5, 8, f ? 4 : 2, 1); p('#2ee6c8', 5, 10, f ? 2 : 5, 1); p(f ? '#ffd93d' : '#ff6b6b', 12, 2, 2, 2); }
      p('#ff6b6b', 4, 13, 2, 1); p('#ffd93d', 7, 13, 2, 1); p('#4fc3f7', 10, 13, 2, 1);
    });
  }
  function door(open, th = 'lab') {
    return tile('door' + open + th, (p, x) => {
      x.drawImage(wall(th), 0, 0);
      if (open) { p('#151b2b', 3, 3, 10, 13); p('#7dff9b', 7, 0, 2, 2); p('#7dff9b', 6, 8, 2, 1); p('#7dff9b', 8, 9, 1, 1); p('#7dff9b', 6, 10, 2, 1); }
      else { p('#7b4a2c', 3, 3, 10, 13); p('#663b22', 4, 4, 3, 5); p('#663b22', 9, 4, 3, 5); p('#663b22', 4, 10, 8, 5); p('#ffd36b', 10, 9, 1, 1); p('#ff4d4d', 7, 0, 2, 2); }
    });
  }
  function portal(f, state) {
    // state: 'open' | 'locked' | 'soon'
    return tile('portal' + f + state, (p, x) => {
      x.drawImage(grass(2), 0, 0);
      p('#00000026', 1, 14, 14, 2);
      p('#6f7489', 1, 2, 14, 14); p('#9aa0b5', 2, 1, 12, 2); p('#9aa0b5', 1, 3, 2, 13); p('#9aa0b5', 13, 3, 2, 13);
      if (state === 'open') {
        const c = f ? ['#5236d1', '#7d5cff', '#b9a7ff'] : ['#7d5cff', '#b9a7ff', '#5236d1'];
        p(c[0], 3, 3, 10, 13); p(c[1], 4, 5, 8, 10); p(c[2], 6, 7, 4, 7); p('#ffffff', 7, 9, 2, 2);
      } else {
        p('#3d4152', 3, 3, 10, 13);
        if (state === 'locked') { p('#ffd36b', 6, 9, 4, 4); p('#ffd36b', 6, 6, 1, 3); p('#ffd36b', 9, 6, 1, 3); p('#ffd36b', 7, 5, 2, 1); p('#7a5a10', 7, 10, 2, 2); }
        else { p('#ffb347', 3, 9, 10, 2); p('#3d4152', 4, 9, 2, 2); p('#3d4152', 8, 9, 2, 2); }
      }
    });
  }
  function shop() {
    return tile('shop', (p, x) => {
      x.drawImage(grass(3), 0, 0);
      p('#00000026', 1, 14, 14, 2);
      p('#8b5a2b', 2, 5, 1, 7); p('#8b5a2b', 13, 5, 1, 7);
      for (let i = 0; i < 7; i++) p(i % 2 ? '#ffffff' : '#ff5d5d', 1 + i * 2, 2, 2, 4);
      p('#c4413f', 1, 6, 14, 1);
      p('#c78b4f', 1, 10, 14, 5); p('#a06a3e', 1, 10, 14, 1);
      p('#ff4d6d', 3, 8, 2, 2); p('#4dd0ff', 7, 8, 2, 2); p('#ffd93d', 11, 8, 2, 2);
    });
  }
  function sign() {
    return tile('sign', (p, x) => {
      x.drawImage(grass(0), 0, 0);
      p('#00000026', 4, 14, 8, 2);
      p('#7a4a2b', 7, 9, 2, 6); p('#7a4a2b', 2, 2, 12, 8); p('#c99a5b', 3, 3, 10, 6); p('#7a4a2b', 4, 5, 8, 1); p('#7a4a2b', 4, 7, 6, 1);
    });
  }

  window.Sprites = {
    person, guide, archimedes, shopkeeper, buddy, slime,
    floor, labFloor, geoFloor, opticFloor, wall, grass, path, flower, tree, water, lava, bench, plant, boulder, crystal,
    lamp, prism, mirror, speaker, atomFloor, atomModel, periodicBoard, farmFloor, berryBed, growLight, bodyFloor, heartModel, lungModel,
    elecFloor, coil, battery, airPurifier, spaceFloor, telescope, rocket,
    quiz, solved, book, chest, station, door, portal, shop, sign,
    // 대화창 얼굴 그림
    portrait(who, look, guideName, bossSkin) {
      if (who === 'buddy') return buddy();
      if (who === 'guide') return guide(guideName);
      if (who === 'shop') return shopkeeper();
      if (who === 'boss') return slime(0, bossSkin);
      if (who === 'sign') return sign();
      return person(look).down[0];
    },
  };
})();
