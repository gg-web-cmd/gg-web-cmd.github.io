// 화면 위에 뜨는 것들 — 대화창, 큰 창, 문제, 미니게임, 보스 대결, 소리, 읽어주기
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // 받침 있으면 a, 없으면 b (은/는, 이/가). 끝의 괄호·따옴표는 건너뛰고 본다: "판의 경계 근처 (… 잦음)" → '음'
  const jo = (w, a, b) => { const c = String(w).replace(/[\s)\]'"」』]+$/, '').slice(-1).charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? a : b; };
  const ITEM_INFO = {
    hint:   { emoji: '🔍', name: '돋보기' },
    flask:  { emoji: '🧪', name: '분리 플라스크' },
    potion: { emoji: '❤️', name: '하트 물약' },
    shield: { emoji: '🛡️', name: '보호막' },
  };

  // ───────── 소리 ─────────
  const SFX = (() => {
    let ac = null;
    const tone = (f, d, type = 'square', v = 0.05, at = 0) => {
      const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + 0.03);
    };
    const SONGS = {
      ok:    [[660, 0.08], [880, 0.16, 'square', 0.05, 0.08]],
      bad:   [[220, 0.16, 'sawtooth', 0.04], [165, 0.22, 'sawtooth', 0.04, 0.12]],
      item:  [[523, 0.07, 'square', 0.04], [659, 0.07, 'square', 0.04, 0.06], [784, 0.07, 'square', 0.04, 0.12], [1047, 0.14, 'square', 0.04, 0.18]],
      door:  [[392, 0.1, 'triangle', 0.08], [523, 0.1, 'triangle', 0.08, 0.1], [659, 0.22, 'triangle', 0.08, 0.2]],
      hit:   [[900, 0.05, 'square', 0.05], [450, 0.12, 'square', 0.05, 0.05]],
      hurt:  [[150, 0.3, 'sawtooth', 0.05]],
      win:   [[523, 0.12], [659, 0.12, 'square', 0.05, 0.12], [784, 0.12, 'square', 0.05, 0.24], [1047, 0.45, 'square', 0.05, 0.36]],
      click: [[700, 0.03, 'triangle', 0.04]],
      buy:   [[880, 0.06], [1175, 0.12, 'square', 0.05, 0.06]],
    };
    return {
      play(name) {
        if (!window.SQ || !SQ.save.sound) return;
        try {
          ac = ac || new (window.AudioContext || window.webkitAudioContext)();
          if (ac.state === 'suspended') ac.resume();
          for (const s of SONGS[name] || []) tone(...s);
        } catch (e) { /* 소리가 안 나도 게임은 계속 */ }
      },
    };
  })();

  // ───────── 읽어주기 ─────────
  function speak(text) {
    try {
      if (!('speechSynthesis' in window)) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text).replace(/[⭐❤️🤍🔑🛡️🔍🧪👾⚔️✅❌⭕]/gu, '').replace(/cm³/g, '세제곱센티미터').replace(/℃/g, '도'));
      u.lang = 'ko-KR';
      const v = speechSynthesis.getVoices().find((x) => /^ko/i.test(x.lang));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) { /* 읽어주기를 못 해도 괜찮다 */ }
  }
  function hush() { try { speechSynthesis.cancel(); } catch (e) { /* */ } }

  // ───────── 알림 ─────────
  function toast(text, ms = 2400) {
    const box = $('#toast'), d = document.createElement('div');
    d.textContent = text; box.appendChild(d);
    setTimeout(() => d.remove(), ms);
  }

  // ───────── 대화창 ─────────
  let dlg = null;
  function say(lines) {
    if (!lines || !lines.length) return Promise.resolve();
    return new Promise((resolve) => {
      const box = $('#dialog'), face = box.querySelector('canvas'), nameEl = box.querySelector('.dlg-name'), textEl = box.querySelector('.dlg-text');
      let i = -1, full = '', shown = 0, timer = null;
      const stopType = () => { clearInterval(timer); timer = null; textEl.textContent = full; };
      const show = ([who, raw]) => {
        full = String(raw).replace(/\{name\}/g, SQ.save.nick || '탐험가');
        nameEl.textContent = SQ.nameOf(who);
        const img = Sprites.portrait(who, SQ.save.look, SQ.guideName(), SQ.bossSkin());
        face.width = img.width; face.height = img.height;
        const fx = face.getContext('2d'); fx.imageSmoothingEnabled = false; fx.clearRect(0, 0, face.width, face.height); fx.drawImage(img, 0, 0);
        shown = 0; textEl.textContent = '';
        clearInterval(timer);
        timer = setInterval(() => { shown += 1; textEl.textContent = full.slice(0, shown); if (shown >= full.length) { clearInterval(timer); timer = null; } }, 24);
        if (SQ.save.autoRead) speak(full);
      };
      const next = () => {
        if (timer) { stopType(); return; }
        i++;
        if (i >= lines.length) { close(); return; }
        show(lines[i]);
      };
      const close = () => {
        clearInterval(timer); hush();
        box.hidden = true; dlg = null;
        box.onclick = null; box.querySelector('.dlg-speak').onclick = null; box.querySelector('.dlg-skip').onclick = null;
        resolve();
      };
      box.onclick = (e) => { if (e.target.closest('button')) return; next(); };
      box.querySelector('.dlg-speak').onclick = (e) => { e.stopPropagation(); speak(full); };
      box.querySelector('.dlg-skip').onclick = (e) => { e.stopPropagation(); close(); };
      dlg = { next, close };
      box.hidden = false;
      next();
    });
  }

  // ───────── 큰 창 ─────────
  const M = { onKey: null, closable: true, onClose: null };
  function modal(html, opts = {}) {
    const wrap = $('#modal');
    wrap.innerHTML = `<div class="panel ${opts.cls || ''}" role="dialog" aria-modal="true">${html}</div>`;
    wrap.hidden = false;
    M.onKey = opts.onKey || null;
    M.closable = opts.closable !== false;
    M.onClose = opts.onClose || null;
    const panel = wrap.firstElementChild;
    if (M.closable) {
      const x = document.createElement('button');
      x.className = 'mini x-close'; x.textContent = '✕ 닫기'; x.onclick = closeModal;
      panel.appendChild(x);
    }
    wrap.onclick = (e) => { if (e.target === wrap && M.closable) closeModal(); };
    return panel;
  }
  function closeModal() {
    const wrap = $('#modal');
    if (wrap.hidden) return;
    wrap.hidden = true; wrap.innerHTML = ''; hush();
    const f = M.onClose; M.onKey = null; M.onClose = null;
    if (f) f();
  }
  function isOpen() { return !!dlg || !$('#modal').hidden; }

  // 키보드: 열린 창이 먼저 받는다. 받았으면 true.
  function handleKey(e) {
    if (dlg) {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); if (!e.repeat) dlg.next(); }
      else if (e.code === 'Escape') dlg.close();
      return true;
    }
    if (!$('#modal').hidden) {
      if (M.onKey && M.onKey(e)) e.preventDefault();
      else if (e.code === 'Escape' && M.closable) closeModal();
      return true;
    }
    return false;
  }

  function confirmBox(title, text, yes = '예', no = '아니요') {
    return new Promise((resolve) => {
      const p = modal(`<h2>${esc(title)}</h2><p class="guide-text">${esc(text)}</p>
        <div class="foot"><button class="btn" data-a="0">${esc(no)}</button><button class="btn primary" data-a="1">${esc(yes)}</button></div>`,
        { cls: 'narrow', onClose: () => resolve(false) });
      p.querySelectorAll('[data-a]').forEach((b) => { b.onclick = () => { const v = b.dataset.a === '1'; M.onClose = null; closeModal(); resolve(v); }; });
    });
  }

  // ───────── 문제 하나 풀기 ─────────
  // box 안에 문제를 그리고, 맞힐 때까지(또는 하트가 다 떨어지거나 "나중에") 기다린다.
  function runQuestion(box, q, opts = {}) {
    const starsFirst = opts.starsFirst ?? 10, starsRetry = opts.starsRetry ?? 5;
    return new Promise((resolve) => {
      let wrongs = 0, done = false, hintShown = false, flaskUsed = false;
      const typeLabel = { ox: 'OX 퀴즈', mc: '골라 보세요', num: '계산해 보세요' }[q.type];
      // 보기는 문제를 열 때마다 섞는다(자료에는 정답이 앞쪽에 몰려 있다). data-v 는 원래 번호라 채점은 그대로다.
      const order = q.type === 'mc' ? shuffle(q.choices.map((_, i) => i)) : [];
      let body;
      if (q.type === 'ox') body = `<div class="q-choices ox"><button class="ch" data-v="1"><b>O</b><small>그렇다</small></button><button class="ch" data-v="0"><b>X</b><small>아니다</small></button></div>`;
      else if (q.type === 'mc') body = `<div class="q-choices mc">${order.map((ci, k) => `<button class="ch" data-v="${ci}"><span class="no">${k + 1}</span><span>${esc(q.choices[ci])}</span></button>`).join('')}</div>`;
      else body = `<form class="q-num"><input type="text" inputmode="decimal" autocomplete="off" placeholder="숫자로 입력" aria-label="답"><span class="unit">${esc(q.unit || '')}</span><button type="submit" class="btn primary">확인</button></form>`;
      box.innerHTML = `
        <div class="q-head"><span class="tag tag-${q.type}">${typeLabel}</span><span class="q-src">${esc(opts.label || '')}</span><button type="button" class="mini q-speak">🔊 읽어주기</button></div>
        <div class="q-text">${esc(q.q)}</div>
        ${q.fig ? `<div class="q-fig">${q.fig}</div>` : ''}
        ${body}
        <div class="q-hint" hidden></div>
        <div class="q-msg"></div>
        <div class="q-result" hidden></div>
        <div class="q-bar"><div class="q-items"></div><div>${opts.allowLater ? '<button type="button" class="btn ghost q-later">나중에 풀기</button>' : ''}</div></div>`;
      const panel = box.closest('.panel') || box;
      const msg = box.querySelector('.q-msg'), res = box.querySelector('.q-result'), hintEl = box.querySelector('.q-hint');
      const input = box.querySelector('.q-num input');

      const drawItems = () => {
        const it = SQ.save.items, h = SQ.hearts(), mx = SQ.maxHearts;
        const bits = [`<span class="hearts" title="하트">${'❤️'.repeat(h)}${'🤍'.repeat(Math.max(0, mx - h))}</span>`];
        if (it.shield > 0) bits.push(`<span title="보호막">🛡️×${it.shield}</span>`);
        if (!done) {
          bits.push(`<button type="button" data-item="hint" ${hintShown || !it.hint ? 'disabled' : ''}>🔍 돋보기 ×${it.hint || 0}</button>`);
          if (q.type === 'mc') bits.push(`<button type="button" data-item="flask" ${flaskUsed || !it.flask ? 'disabled' : ''}>🧪 플라스크 ×${it.flask || 0}</button>`);
          bits.push(`<button type="button" data-item="potion" ${!it.potion || h >= mx ? 'disabled' : ''}>❤️ 물약 ×${it.potion || 0}</button>`);
        }
        box.querySelector('.q-items').innerHTML = bits.join('');
        box.querySelectorAll('[data-item]').forEach((b) => { b.onclick = () => useItem(b.dataset.item); });
      };
      const useItem = (k) => {
        if (done) return;
        if (k === 'hint') {
          if (!SQ.useItem('hint')) return;
          hintShown = true; hintEl.hidden = false; hintEl.textContent = '🔍 ' + (q.hint || '문제를 다시 천천히 읽어 보세요.'); SFX.play('click');
        } else if (k === 'flask') {
          if (!SQ.useItem('flask')) return;
          flaskUsed = true; SFX.play('click');
          const wrong = [...box.querySelectorAll('.ch')].filter((b) => Number(b.dataset.v) !== q.a && !b.disabled);
          shuffle(wrong).slice(0, 2).forEach((b) => { b.disabled = true; b.classList.add('gone'); });
        } else if (k === 'potion') {
          SQ.usePotion();
        }
        drawItems();
      };

      const finish = (r) => { done = true; drawItems(); resolve(r); };
      const check = (v, btn) => {
        if (done) return;
        const hideLater = () => { const lb = box.querySelector('.q-later'); if (lb) lb.hidden = true; };
        let ok;
        if (q.type === 'ox') ok = (v === '1') === q.a;
        else if (q.type === 'mc') ok = Number(v) === q.a;
        else {
          const m = String(v).replace(/,/g, '.').match(/-?\d+(\.\d+)?/);
          if (!m) { msg.textContent = '숫자를 입력해 주세요.'; input.focus(); return; }
          ok = Math.abs(parseFloat(m[0]) - q.a) <= (q.tol || 0) + 1e-9;
        }
        if (ok) {
          done = true; hideLater();
          SFX.play('ok');
          if (btn) btn.classList.add('right');
          box.querySelectorAll('.ch').forEach((b) => { b.disabled = true; });
          if (input) { input.disabled = true; box.querySelector('.q-num button').disabled = true; }
          msg.textContent = '';
          const st = wrongs ? starsRetry : starsFirst;
          SQ.addStars(st);
          SQ.recordAnswer(q, wrongs);
          res.className = 'q-result ok'; res.hidden = false;
          res.innerHTML = `<b>⭕ 정답!</b><span class="gain">+${st} ⭐</span><p>${esc(q.exp)}</p>${q.pg ? `<p class="pg">📖 교과서 ${esc(q.pg)}쪽</p>` : ''}<button type="button" class="btn primary q-next">${esc(opts.nextLabel || '계속 ▶')}</button>`;
          drawItems();
          const nb = res.querySelector('.q-next'); nb.focus({ preventScroll: true });
          nb.onclick = () => finish({ correct: true, wrongs });
          res.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
          wrongs++;
          SFX.play('bad');
          if (btn) { btn.classList.add('wrong'); btn.disabled = true; }
          panel.classList.remove('shake'); void panel.offsetWidth; panel.classList.add('shake');
          if (opts.onWrong) opts.onWrong();
          const fainted = SQ.hurt();
          drawItems();
          if (fainted) {
            done = true; hideLater();
            SQ.recordAnswer(q, wrongs, true);
            box.querySelectorAll('.ch').forEach((b) => { b.disabled = true; });
            res.className = 'q-result bad'; res.hidden = false;
            res.innerHTML = `<b>💫 하트가 모두 떨어졌어요…</b><p>잠깐 쉬었다가 다시 도전해요. 이미 푼 문제는 그대로 남아 있어요.</p><button type="button" class="btn q-next">확인</button>`;
            const nb = res.querySelector('.q-next'); nb.focus({ preventScroll: true });
            nb.onclick = () => finish({ correct: false, wrongs, fainted: true });
          } else {
            msg.textContent = q.type === 'num' ? '❌ 다시 계산해 보세요!' : '❌ 아쉬워요! 다시 생각해 보세요.';
            if (!hintShown && SQ.save.items.hint > 0) msg.textContent += ' (🔍 돋보기를 쓰면 힌트가 나와요)';
            if (input) { input.select(); }
          }
        }
      };

      box.querySelectorAll('.ch').forEach((b) => { b.onclick = () => check(b.dataset.v, b); });
      const form = box.querySelector('.q-num');
      if (form) form.onsubmit = (e) => { e.preventDefault(); check(input.value); };
      const later = box.querySelector('.q-later');
      if (later) later.onclick = () => { if (!done) { done = true; resolve({ correct: false, wrongs, later: true }); } };
      box.querySelector('.q-speak').onclick = () => {
        let t = q.q;
        if (q.type === 'mc') t += ' ' + order.map((ci, k) => `${k + 1}번, ${q.choices[ci]}.`).join(' ');
        if (q.type === 'ox') t += ' 그렇다면 O, 아니라면 X.';
        speak(t);
      };
      drawItems();
      if (input) setTimeout(() => input.focus(), 50);

      M.onKey = (e) => {
        if (done) {
          if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') { const nb = res.querySelector('.q-next'); if (nb && !e.repeat) nb.click(); return true; }
          return false;
        }
        if (e.target === input) return false;
        if (q.type === 'ox') {
          if (e.code === 'KeyO' || e.code === 'Digit1') { box.querySelector('.ch[data-v="1"]').click(); return true; }
          if (e.code === 'KeyX' || e.code === 'Digit2') { box.querySelector('.ch[data-v="0"]').click(); return true; }
        }
        if (q.type === 'mc') {
          const n = /^(Digit|Numpad)([1-9])$/.exec(e.code);
          if (n) { const b = box.querySelectorAll('.ch')[Number(n[2]) - 1]; if (b && !b.disabled) b.click(); return true; }
        }
        return false;
      };
    });
  }

  // 문제 창(지도 위 ? 칸)
  async function quiz(q, label) {
    const panel = modal('<div class="qbox"></div>', { closable: false });
    const r = await runQuestion(panel.querySelector('.qbox'), q, { label, allowLater: true });
    closeModal();
    return r;
  }

  // ───────── 미니게임: 분류 ─────────
  function playSort(st) {
    return new Promise((resolve) => {
      const panel = modal(`<div class="mg sort">
        <h2>🧪 ${esc(st.title)}</h2><p class="mg-desc">${esc(st.desc)}</p>
        <div class="sort-top"><span class="sort-count"></span><span class="sort-msg"></span></div>
        <div class="sort-card"><div class="emo"></div><div class="nm"></div></div>
        <div class="sort-bins">${st.bins.map((b, i) => `<button class="bin" data-id="${b.id}"><span class="key">${i + 1}</span><span class="emo">${b.emoji}</span><span class="lb">${esc(b.label)}</span><span class="cnt"></span></button>`).join('')}</div>
        <div class="sort-log"></div></div>`, { cls: 'wide', closable: false });
      const deck = shuffle(st.cards.slice()), total = deck.length, counts = {};
      let mistakes = 0, first = true, stars = 0, lock = false;
      const card = panel.querySelector('.sort-card'), msg = panel.querySelector('.sort-msg'), log = panel.querySelector('.sort-log');
      const label = (id) => st.bins.find((b) => b.id === id).label;
      const show = () => {
        const c = deck[0];
        card.classList.remove('fly');
        card.querySelector('.emo').textContent = c.emoji;
        card.querySelector('.nm').textContent = c.name;
        panel.querySelector('.sort-count').textContent = `${total - deck.length + 1} / ${total}`;
      };
      const choose = (id) => {
        if (lock || !deck.length) return;
        const c = deck[0];
        if (c.bin === id) {
          lock = true; SFX.play('ok');
          if (first) stars += 3;
          counts[id] = (counts[id] || 0) + 1;
          panel.querySelector(`.bin[data-id="${id}"] .cnt`).textContent = `${counts[id]}개`;
          msg.className = 'sort-msg ok'; msg.textContent = `✅ ${c.name} → ${label(id)}`;
          const line = document.createElement('div'); line.textContent = `✅ ${c.name} → ${label(id)} : ${c.why}`; log.prepend(line);
          card.classList.add('fly');
          deck.shift(); first = true;
          setTimeout(() => { lock = false; if (deck.length) show(); else done(); }, 600);
        } else {
          mistakes++; first = false; SFX.play('bad');
          card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
          msg.className = 'sort-msg bad'; msg.textContent = `❌ ${label(id)}${jo(label(id), '이', '가')} 아니에요. 다시 생각해 보세요!`;
        }
      };
      const done = () => {
        SQ.addStars(stars);
        M.onKey = (e) => { if (e.code === 'Enter' || e.code === 'Space') { panel.querySelector('.mg-finish').click(); return true; } return false; };
        card.outerHTML = `<div class="mg-done"><div class="big">🎉 분류 완료!</div><div>실수 ${mistakes}번 · <span class="gain">+${stars} ⭐</span></div></div>`;
        panel.querySelector('.sort-bins').remove();
        panel.querySelector('.sort-top').remove();
        const f = document.createElement('div'); f.className = 'foot'; f.innerHTML = '<button class="btn primary mg-finish">완료 ▶</button>';
        panel.querySelector('.mg').appendChild(f);
        f.querySelector('button').onclick = () => { closeModal(); resolve({ mistakes, stars }); };
        SFX.play('item');
      };
      panel.querySelectorAll('.bin').forEach((b) => { b.onclick = () => choose(b.dataset.id); });
      M.onKey = (e) => {
        const n = /^(Digit|Numpad)([1-9])$/.exec(e.code);
        if (n) { const b = panel.querySelectorAll('.bin')[Number(n[2]) - 1]; if (b) choose(b.dataset.id); return true; }
        return false;
      };
      show();
    });
  }

  // ───────── 미니게임: 순서대로 쌓기(밀도 탑, 지권의 층, 퇴적암 만들기 …) ─────────
  // st.items 는 정답 순서(맨 아래 → 맨 위)로 적는다. 항목: { name, emoji, info, label, note, color }
  //   info  : 단추에 보이는 단서        label : 쌓인 층에 붙는 이름표
  //   note  : 맞혔을 때 보여 줄 풀이    st.wrong : 틀렸을 때 덧붙일 말, st.reveal 이면 틀린 항목의 label 도 알려 준다
  function playOrder(st) {
    return new Promise((resolve) => {
      const answer = st.items;
      const panel = modal(`<div class="mg order">
        <h2>🧪 ${esc(st.title)}</h2><p class="mg-desc">${esc(st.desc)}</p>
        <div class="order-wrap">
          <div class="tower"><div class="glass"></div></div>
          <div class="order-items">${shuffle(st.items.slice()).map((it) => `<button class="oi" data-n="${esc(it.name)}"><span class="emo">${it.emoji}</span><span class="nm">${esc(it.name)}</span><span class="mv">${esc(it.info || '')}</span></button>`).join('')}</div>
        </div>
        <div class="order-msg">💡 ${esc(st.tip || '맨 아래에 올 것부터 차례로 골라요.')}</div></div>`, { cls: 'wide', closable: false });
      let step = 0, mistakes = 0;
      const glass = panel.querySelector('.glass'), msg = panel.querySelector('.order-msg');
      panel.querySelectorAll('.oi').forEach((b) => {
        b.onclick = () => {
          const it = st.items.find((x) => x.name === b.dataset.n);
          if (it === answer[step]) {
            SFX.play('ok'); step++; b.disabled = true;
            const L = document.createElement('div'); L.className = 'layer';
            L.style.background = it.color; L.style.height = (100 / st.items.length) + '%';
            L.innerHTML = `${esc(it.name)}${it.label ? `<br>${esc(it.label)}` : ''}`; glass.appendChild(L);
            msg.textContent = `✅ ${it.name}${it.note ? ': ' + it.note : ''}`;
            if (step === answer.length) {
              const stars = Math.max(5, 20 - mistakes * 5);
              SQ.addStars(stars); SFX.play('item');
              msg.innerHTML = `🎉 ${esc(st.title)} 완성! 실수 ${mistakes}번 · <span class="gain">+${stars} ⭐</span><br>${esc(st.exp)}`;
              const f = document.createElement('div'); f.className = 'foot'; f.innerHTML = '<button class="btn primary">완료 ▶</button>';
              panel.querySelector('.mg').appendChild(f);
              const fb = f.querySelector('button'); fb.focus({ preventScroll: true });
              fb.onclick = () => { closeModal(); resolve({ mistakes, stars }); };
              M.onKey = (e) => { if (e.code === 'Enter' || e.code === 'Space') { fb.click(); return true; } return false; };
            }
          } else {
            mistakes++; SFX.play('bad');
            b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
            msg.textContent = `❌ ${it.name}${st.reveal && it.label ? ` (${it.label})` : ''} — ${st.wrong || '아직 차례가 아니에요. 다시 생각해 보세요!'}`;
          }
        };
      });
    });
  }

  // ───────── 보스 대결 ─────────
  function playBoss(cfg) {
    return new Promise((resolve) => {
      const panel = modal(`<div class="battle">
        <div class="b-arena"><canvas class="b-boss" width="32" height="32"></canvas>
          <div class="b-info"><div class="b-name">👾 ${esc(cfg.name)}</div><div class="hp"><i></i></div><div class="b-hptext"></div></div></div>
        <div class="b-q"></div></div>`, { cls: 'wide', closable: false });
      const cvs = panel.querySelector('.b-boss'), bx = cvs.getContext('2d');
      let f = 0;
      const drawBoss = () => { bx.clearRect(0, 0, 32, 32); bx.drawImage(Sprites.slime(f, cfg.skin), 0, 0); f ^= 1; };
      drawBoss();
      const anim = setInterval(drawBoss, 420);
      let hp = cfg.hp;
      const bar = panel.querySelector('.hp i'), hpt = panel.querySelector('.b-hptext');
      const drawHp = () => { bar.style.width = (hp / cfg.hp * 100) + '%'; hpt.textContent = `HP ${hp} / ${cfg.hp}`; };
      drawHp();
      const queue = shuffle(cfg.pool.slice());
      const end = (r) => { clearInterval(anim); closeModal(); resolve(r); };
      (async () => {
        while (hp > 0) {
          const last = hp === 1;
          const q = last ? cfg.final : (queue.shift() || cfg.pool[Math.floor(Math.random() * cfg.pool.length)]);
          const r = await runQuestion(panel.querySelector('.b-q'), q, {
            label: last ? '⚔️ 마지막 일격!' : `⚔️ 맞히면 공격! (남은 HP ${hp})`,
            nextLabel: last ? '최후의 일격! ⚔️' : '공격! ⚔️',
            onWrong: () => { SFX.play('hurt'); panel.classList.remove('flash-red'); void panel.offsetWidth; panel.classList.add('flash-red'); },
          });
          if (r.fainted) { end({ win: false }); return; }
          hp--; SFX.play('hit');
          cvs.classList.remove('hit'); void cvs.offsetWidth; cvs.classList.add('hit');
          drawHp();
          await wait(450);
        }
        end({ win: true });
      })();
    });
  }

  // 용어 카드 획득 창
  function termCard(term, label) {
    return new Promise((resolve) => {
      const p = modal(`<div class="term-big"><span class="badge">📘 용어 카드 획득! · ${esc(label || '')}</span>
        <div class="w">${esc(term.word)}</div><div class="d">${esc(term.desc)}</div>${term.ex ? `<div class="e">예) ${esc(term.ex)}</div>` : ''}
        <div class="foot" style="justify-content:center"><button type="button" class="mini t-speak">🔊 읽어주기</button><button class="btn primary t-ok">도감에 넣기 ▶</button></div></div>`,
        { cls: 'narrow', onClose: () => resolve() });
      p.querySelector('.t-speak').onclick = () => speak(`${term.word}. ${term.desc}`);
      const ok = p.querySelector('.t-ok'); ok.focus({ preventScroll: true });
      ok.onclick = closeModal;
      M.onKey = (e) => { if (e.code === 'Enter' || e.code === 'Space') { if (!e.repeat) closeModal(); return true; } return false; };
    });
  }

  window.UI = { $, esc, wait, shuffle, jo, ITEM_INFO, SFX, speak, toast, say, modal, closeModal, isOpen, handleKey, confirmBox, runQuestion, quiz, playSort, playOrder, playBoss, termCard, M };
})();
