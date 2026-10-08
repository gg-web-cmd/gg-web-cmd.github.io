/* 개인정보 지우개 — 화면 (웹판)
 *
 * 찾은 개인정보는 **가린 채로** js/local-api.js 에서 온다. 이 화면에는 원문이 한 번도 오지 않는다.
 * 웹판은 원본을 고치지 않고, 가린 사본을 ZIP 으로 내려받는다(그래서 되돌리기·격리가 없다).
 */
'use strict';

const $ = (id) => document.getElementById(id);
const api = (p, body) => LocalApi.call(p, body);

let snap = null;
let filter = 'all';           // all | high | fixable | nofix
let picked = null;            // 고른 파일 경로 집합 (null = 고칠 수 있는 것 전부)
const opened = new Set();     // 펼쳐 둔 파일

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toast(text, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = text;
  $('toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 4200);
  setTimeout(() => el.remove(), 4600);
}

const guard = (fn) => async (...a) => {
  try { await fn(...a); } catch (e) { toast((e && e.message) || '실패했습니다', 'err'); }
};

function clockText(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function sizeText(n) {
  if (n < 1024) return n + 'B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + 'KB';
  return (n / 1024 / 1024).toFixed(1) + 'MB';
}

/* ── 규칙 목록 ────────────────────────────────────────── */

const LEVEL_TEXT = { high: '개인 특정', mid: '연락처', low: '참고' };

function renderRules() {
  const on = new Set(snap.settings.rules);
  $('ruleBadge').textContent = `${on.size}개`;
  $('ruleList').innerHTML = (snap.rules || []).map((r) => `
    <label class="rule-item ${on.has(r.id) ? 'on' : ''}">
      <input type="checkbox" data-rule="${esc(r.id)}" ${on.has(r.id) ? 'checked' : ''}>
      <span style="min-width:0">
        <span class="nm">${esc(r.name)}</span>
        <span class="lv ${r.level}">${esc(LEVEL_TEXT[r.level] || '')}</span>
        ${r.hint ? `<small>${esc(r.hint)}</small>` : ''}
      </span>
    </label>`).join('');
}

/* ── 요약과 목록 ──────────────────────────────────────── */

function renderFinds() {
  const s = snap.summary;
  if (!s) {
    $('sum').innerHTML = '';
    $('kinds').innerHTML = '';
    $('filters').innerHTML = '';
    $('finds').innerHTML = '';
    $('emptyMsg').hidden = false;
    $('btnMask').disabled = true;
    return;
  }

  $('sum').innerHTML = [
    `<span class="big">${s.dirty}<small> / ${s.files} 파일</small></span>`,
    s.sure ? `<span class="badge err">확실 ${s.sure}군데</span>` : '<span class="badge ok">확실한 것 없음</span>',
    s.maybe ? `<span class="badge warn">의심 ${s.maybe}군데</span>` : '',
    s.fixable ? `<span class="badge">고칠 수 있음 ${s.fixable}</span>` : '',
    s.unfixable ? `<span class="badge warn">고칠 수 없음 ${s.unfixable}</span>` : '',
    s.unreadable ? `<span class="badge mute">글자 못 꺼냄 ${s.unreadable}</span>` : '',
  ].filter(Boolean).join('');

  const kinds = Object.entries(s.byLabel).sort((a, b) => (b[1].sure + b[1].maybe) - (a[1].sure + a[1].maybe));
  $('kinds').innerHTML = kinds.map(([label, c]) => {
    const cls = ['주민등록번호', '외국인등록번호', '카드번호', '계좌번호', '집 주소', '여권번호'].includes(label) ? 'high'
      : ['휴대전화', '일반 전화', '이메일'].includes(label) ? 'mid' : '';
    return `<span class="kind ${cls}">${esc(label)} <b>${c.sure}</b>${c.maybe ? ` <span style="opacity:.7">+의심 ${c.maybe}</span>` : ''}</span>`;
  }).join('');

  $('filters').innerHTML = [
    `<button class="chip ${filter === 'all' ? 'on' : ''}" data-f="all">전체 ${s.dirty}</button>`,
    `<button class="chip err ${filter === 'high' ? 'on' : ''}" data-f="high">개인 특정만</button>`,
    `<button class="chip ${filter === 'fixable' ? 'on' : ''}" data-f="fixable">고칠 수 있는 것 ${s.fixable}</button>`,
    s.unfixable ? `<button class="chip warn ${filter === 'nofix' ? 'on' : ''}" data-f="nofix">고칠 수 없는 것 ${s.unfixable}</button>` : '',
  ].filter(Boolean).join('');

  const shown = (snap.results || []).filter((r) => {
    if (filter === 'high') return r.hits.some((h) => h.level === 'high');
    if (filter === 'fixable') return r.canMask;
    if (filter === 'nofix') return !r.canMask;
    return true;
  });

  $('emptyMsg').hidden = shown.length > 0;
  if (!shown.length) {
    $('finds').innerHTML = '';
    $('emptyMsg').textContent = s.files
      ? (s.dirty ? '이 걸러내기에 맞는 것이 없습니다.' : `${s.files}개를 봤고 개인정보를 찾지 못했습니다. 👍`)
      : '폴더나 파일을 넣으면 여기에 나옵니다.';
  } else {
    $('finds').innerHTML = shown.map((r) => fileCard(r)).join('');
  }

  $('moreInfo').textContent = snap.totalDirty > snap.shown
    ? `앞 ${snap.shown}개만 보여 줍니다 (모두 ${snap.totalDirty}개). 가리기는 고른 것 전부에 적용됩니다.`
    : '';

  const fixSel = countSel(true);
  const noFixSel = countSel(false);
  $('btnMask').disabled = !fixSel || snap.busy;
  $('btnMask').textContent = snap.busy ? '하는 중…' : (fixSel ? `${fixSel}개 파일 가린 사본 받기` : '고를 수 있는 파일이 없습니다');

}

function isPicked(r) {
  return picked ? picked.has(r.path) : r.canMask;
}

function countSel(wantFixable) {
  return (snap.results || []).filter((r) => r.canMask === wantFixable && isPicked(r)).length;
}

function fileCard(r) {
  const open = opened.has(r.path);
  const on = isPicked(r);
  return `<div class="file-card ${r.canMask ? '' : 'nofix'}">
    <div class="file-head" data-open="${esc(r.path)}">
      <input type="checkbox" data-pick="${esc(r.path)}" ${on ? 'checked' : ''}>
      <span class="fn">${esc(r.name)}</span>
      <span class="fk">${esc(r.kind)} · ${sizeText(r.size)}</span>
      <span class="cnt">
        ${r.sure ? `<span class="pill">확실 ${r.sure}</span>` : ''}
        ${r.maybe ? `<span class="pill maybe">의심 ${r.maybe}</span>` : ''}
        ${r.canMask ? '' : '<span class="pill mute">못 고침</span>'}
      </span>
    </div>
    ${r.rel && r.rel !== r.name ? `<div class="file-rel">${esc(r.rel)}</div>` : ''}
    ${r.canMask ? '' : `<div class="file-why">${esc(r.why)}</div>`}
    ${open ? `<div class="hit-list">${r.hits.map(hitRow).join('')}</div>`
    : `<div class="hit-list">${r.hits.slice(0, 2).map(hitRow).join('')}${r.hits.length > 2
      ? `<div class="hit" style="justify-content:center;color:var(--muted)">눌러서 ${r.hits.length - 2}군데 더 보기</div>` : ''}</div>`}
  </div>`;
}

function hitRow(h) {
  return `<div class="hit ${h.grade}">
    <span class="lb">${esc(h.label)}</span>
    <span class="ctx">${esc(h.before)}<b>${esc(h.masked)}</b>${esc(h.after)}</span>
    <span class="gr">${h.grade === 'sure' ? '확실' : '의심'}</span>
  </div>`;
}

/* ── 나머지 ───────────────────────────────────────────── */

function render() {
  if (!snap) return;

  $('inDir').value = snap.dir || '';
  $('dirBadge').textContent = snap.dir || '파일을 넣으세요';
  $('dirBadge').className = 'badge ' + (snap.dir ? 'ok' : 'mute');

  $('ckRecursive').checked = snap.settings.recursive;
  $('ckMaybe').checked = snap.settings.showMaybe;
  $('inSkipBig').value = snap.settings.skipBig;

  const si = snap.scanInfo;
  $('scanInfo').textContent = si
    ? `문서 ${si.files}개를 봤습니다 (문서 아닌 것·너무 큰 것 ${si.skipped}개 건너뜀)`
      + (si.capped ? ` · 한 번에 ${snap.maxFiles}개까지만 봅니다` : '')
    : '';

  renderRules();
  renderFinds();
}

/* ── 단추 ─────────────────────────────────────────────── */

const pushSettings = guard(async (patch) => {
  Object.assign(snap.settings, patch);
  snap = await api('/api/settings', { settings: patch });
  render();
});

function wire() {
  /* 문서 넣기 — 폴더째 고르기 · 파일 고르기 · 끌어다 놓기. 넣으면 곧바로 훑는다 */
  const take = guard(async (list, label) => {
    if (snap.busy) return;
    const r = await LocalApi.take(list, label);
    if (r.ok === false) { toast(r.message, 'err'); return; }
    snap = r; picked = null; opened.clear(); render();
    if (!snap.scanInfo || !snap.scanInfo.files) toast('볼 수 있는 문서가 없습니다 (hwpx · docx · xlsx · csv · txt · pdf …)', 'warn');
  });
  $('btnPick').onclick = () => $('pickDir').click();
  $('btnPickFiles').onclick = () => $('pickFiles').click();
  $('pickDir').onchange = (e) => {
    const fl = Array.from(e.target.files || []);
    const label = fl.length ? (fl[0].webkitRelativePath || '').split('/')[0] : '';
    take(fl.map((f) => ({ file: f, rel: f.webkitRelativePath || f.name })), label || '고른 폴더');
    e.target.value = '';
  };
  $('pickFiles').onchange = (e) => {
    take(Array.from(e.target.files || []).map((f) => ({ file: f, rel: f.name })), '고른 파일');
    e.target.value = '';
  };
  window.addEventListener('dragover', (e) => { e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    const fl = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
    if (fl.length) take(fl.map((f) => ({ file: f, rel: f.name })), '끌어다 놓은 파일');
  });

  $('btnRescan').onclick = guard(async () => {
    if (!snap.dir) { toast('파일을 먼저 넣으세요', 'warn'); return; }
    const r = await api('/api/scan', {});
    if (r.ok === false) { toast(r.message, 'err'); return; }
    snap = r; picked = null; render();
  });

  $('ckRecursive').onchange = (e) => pushSettings({ recursive: e.target.checked });
  $('ckMaybe').onchange = (e) => pushSettings({ showMaybe: e.target.checked });
  $('inSkipBig').onchange = (e) => pushSettings({ skipBig: Number(e.target.value) });

  $('ruleList').addEventListener('change', guard(async (e) => {
    const cb = e.target.closest('input[data-rule]');
    if (!cb) return;
    const on = new Set(snap.settings.rules);
    if (cb.checked) on.add(cb.dataset.rule); else on.delete(cb.dataset.rule);
    if (!on.size) { toast('규칙을 하나는 켜 두세요', 'warn'); cb.checked = true; return; }
    toast('규칙을 바꿨습니다 — 다시 훑는 중…');
    snap = await api('/api/settings', { settings: { rules: [...on] } });
    picked = null;
    render();
  }));

  $('filters').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    filter = c.dataset.f;
    renderFinds();
  });

  $('finds').addEventListener('click', (e) => {
    const cb = e.target.closest('input[data-pick]');
    if (cb) {
      if (!picked) picked = new Set((snap.results || []).filter((r) => r.canMask).map((r) => r.path));
      if (cb.checked) picked.add(cb.dataset.pick); else picked.delete(cb.dataset.pick);
      renderFinds();
      return;
    }
    const head = e.target.closest('[data-open]');
    if (!head) return;
    const p = head.dataset.open;
    if (opened.has(p)) opened.delete(p); else opened.add(p);
    renderFinds();
  });

  $('btnMask').onclick = guard(async () => {
    const paths = (snap.results || []).filter((r) => r.canMask && isPicked(r)).map((r) => r.path);
    if (!paths.length) return;
    if (!confirm(`${paths.length}개 파일의 개인정보를 가린 사본을 만들어 ZIP 으로 내려받습니다.\n\n· 원본 파일은 건드리지 않습니다\n· 만든 사본을 다시 열어 확인하고, 깨진 것은 넣지 않습니다\n\n계속할까요?`)) return;
    snap.busy = true; renderFinds();
    const r = await api('/api/mask', { paths });
    snap = { ...snap, ...r, busy: false };
    picked = null;
    $('workBar').hidden = true;
    render();
    if (r.ok) {
      const bad = (r.work || []).filter((x) => !x.ok);
      toast(`${r.done}개를 가린 사본을 ZIP 으로 받았습니다` + (bad.length ? ` (${bad.length}개는 못 했습니다)` : ''), bad.length ? 'warn' : 'ok');
      for (const b of bad.slice(0, 4)) toast(`${b.path.split(/[\\/]/).pop()} — ${b.message}`, b.rolledBack ? 'err' : 'warn');
      const left = (r.work || []).filter((x) => x.ok && x.left);
      for (const l of left.slice(0, 3)) toast(`${l.path.split(/[\\/]/).pop()} — ${l.message}`, 'warn');
    } else toast(r.message || '고치지 못했습니다', 'err');
  });

  $('btnExport').onclick = guard(async () => {
    const r = await api('/api/export', {});
    if (r.cancelled) return;
    if (r.ok) toast(`${r.rows}줄을 내려받았습니다 (개인정보는 가린 채로)`, 'ok');
    else toast(r.message || '실패', 'err');
  });

}

/* ── 진행 알림 ────────────────────────────────────────── */

function connect() {
  const es = new EventSource('/api/events');
  es.onmessage = (ev) => {
    let m;
    try { m = JSON.parse(ev.data); } catch (_) { return; }
    if (m.type === 'scan-start') { $('scanBar').hidden = false; $('scanBarIn').style.width = '0%'; $('scanNote').textContent = '문서를 여는 중…'; }
    else if (m.type === 'scan-progress') {
      const pct = m.total ? Math.round((m.done / m.total) * 100) : 0;
      $('scanBarIn').style.width = pct + '%';
      $('scanNote').textContent = `${m.done} / ${m.total} — ${m.name || ''}`;
    } else if (m.type === 'scan-end') {
      setTimeout(() => { $('scanBar').hidden = true; $('scanNote').textContent = ''; }, 500);
    } else if (m.type === 'work-start') { $('workBar').hidden = false; $('workBarIn').style.width = '0%'; }
    else if (m.type === 'work-progress') { $('workBarIn').style.width = Math.round((m.done / Math.max(1, m.total)) * 100) + '%'; }
    else if (m.type === 'work-end') { $('workBarIn').style.width = '100%'; }
  };
  es.onerror = () => {};
}

(async function main() {
  wire();
  try { snap = await api('/api/env'); render(); }
  catch (_) {
    document.body.innerHTML = '<div style="padding:60px;text-align:center">도구를 불러오지 못했습니다. 새로 고침해 주세요.</div>';
    return;
  }
  connect();
})();
