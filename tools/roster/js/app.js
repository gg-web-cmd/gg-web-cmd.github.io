/* 명단 합치기 — 화면 (웹판)
 *
 * 화면은 상태를 스스로 갖지 않는다. 명단을 넣거나 설정을 바꾸면 js/local-api.js 로 보내고,
 * 거기서 다시 합친 표를 받아 그린다. 그래서 화면에 보이는 표와 내보내는 파일이 같다.
 * (설치판에서는 그 자리에 로컬 서버가 있었다)
 */
'use strict';

const $ = (id) => document.getElementById(id);
const api = (p, body) => LocalApi.call(p, body);

let snap = null;
let filter = 'all';       // all | none | some | shaky

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

/* ── 넣은 명단 ────────────────────────────────────────── */

function renderLists() {
  const ls = snap.lists || [];
  $('listBadge').textContent = ls.length ? `명단 ${ls.length}개` : '명단 없음';
  $('listBadge').className = 'badge ' + (ls.length ? 'ok' : 'mute');

  $('lists').innerHTML = ls.length ? ls.map((l) => `
    <div class="list-row ${l.base ? 'base' : ''}" data-id="${esc(l.id)}">
      <div class="top">
        ${l.base ? '<span class="badge-base">기준</span>' : ''}
        <input class="lbl" type="text" value="${esc(l.label)}" data-label="${esc(l.id)}"
               title="이 이름이 표의 칸 제목이 됩니다">
        <span class="cnt">${l.count}명${l.skipped ? ` · 못 읽은 줄 ${l.skipped}` : ''}</span>
        <button class="x" data-remove="${esc(l.id)}" title="빼기">✕</button>
      </div>
      <div class="fn">${esc(l.name)}</div>
      ${l.base ? '' : `<div class="opts">
        <label>가져올 칸</label>
        <select data-pick="${esc(l.id)}">
          <option value="-1" ${l.pick === -1 ? 'selected' : ''}>있음 / 없음만 (O · -)</option>
          ${(l.header || []).map((h, i) => `<option value="${i}" ${l.pick === i ? 'selected' : ''}>${esc(h || (i + 1) + '번째 칸')}</option>`).join('')}
        </select>
        <button class="mkbase" data-base="${esc(l.id)}">기준으로</button>
      </div>`}
    </div>`).join('')
    : '<p class="empty" style="padding:14px 0">아직 없습니다. [＋ 기준 명단 넣기] 를 누르거나 엑셀 파일을 이 창에 끌어다 놓으세요.</p>';

  $('btnAdd').disabled = ls.length >= snap.maxLists;
  $('btnAdd').textContent = ls.length === 0 ? '＋ 기준 명단 넣기'
    : (ls.length >= snap.maxLists ? `명단은 ${snap.maxLists}개까지` : '＋ 비교할 명단 넣기');
}

/* ── 표 ───────────────────────────────────────────────── */

function renderTable() {
  const st = snap.stats;
  const rows = snap.rows || [];
  const cols = Math.max(0, (snap.header || []).length - 3);

  $('sum').innerHTML = !st ? '' : [
    `<span class="big">${st.base}<small>명 · 명단 ${st.lists + 1}개</small></span>`,
    st.lists ? `<span class="badge ok">다 있는 사람 ${st.inAll}</span>` : '',
    st.lists ? `<span class="badge warn">어디에도 없는 사람 ${st.inNone}</span>` : '',
    st.extras ? `<span class="badge err">기준에 없는 사람 ${st.extras}</span>` : '',
    st.shaky ? `<span class="badge warn">이름으로만 맞춘 줄 ${st.shaky}</span>` : '',
  ].filter(Boolean).join('');

  $('perList').innerHTML = !st || !st.lists ? '' : (snap.header || []).slice(3)
    .map((h, i) => `<span>${esc(h)} <b>${st.perList[i]}</b> / ${st.base}</span>`).join('');

  $('shakyNote').hidden = !st || !st.dupNames.length;
  if (st && st.dupNames.length) {
    $('shakyNote').textContent = `기준 명단에 같은 이름이 있습니다: ${st.dupNames.join(', ')} — `
      + '이름만으로는 못 가르니 그 줄은 ⚠ 로 표시했습니다. 명단에 학번이나 반·번호를 넣으면 정확해집니다.';
  }

  $('filters').innerHTML = !st || !st.lists ? '' : [
    `<button class="chip ${filter === 'all' ? 'on' : ''}" data-f="all">전체 ${st.base}</button>`,
    `<button class="chip warn ${filter === 'none' ? 'on' : ''}" data-f="none">어디에도 없음 ${st.inNone}</button>`,
    `<button class="chip ${filter === 'some' ? 'on' : ''}" data-f="some">일부에만 있음</button>`,
    st.shaky ? `<button class="chip warn ${filter === 'shaky' ? 'on' : ''}" data-f="shaky">이름으로만 맞춤 ${st.shaky}</button>` : '',
  ].filter(Boolean).join('');

  const shown = rows.filter((r) => {
    if (filter === 'none') return r.hit.every((h) => !h);
    if (filter === 'some') return r.hit.some(Boolean) && !r.hit.every(Boolean);
    if (filter === 'shaky') return r.shaky;
    return true;
  });

  const has = rows.length > 0 && cols > 0;
  $('tableWrap').hidden = !has;
  $('emptyMsg').hidden = has;
  if (!has) {
    $('emptyMsg').textContent = !snap.lists.length ? '명단을 두 개 이상 넣으면 여기에 표가 나옵니다.'
      : (snap.lists.length === 1 ? '비교할 명단을 하나 더 넣어 주세요.' : '기준 명단에서 학생을 찾지 못했습니다.');
    $('rows').innerHTML = '';
  } else {
    $('head').innerHTML = (snap.header || []).map((h, i) => `<th class="${i >= 3 ? 'n' : ''}">${esc(h)}</th>`).join('');
    $('rows').innerHTML = shown.map((r) => {
      const none = r.hit.every((h) => !h);
      return `<tr class="${none ? 'none' : ''} ${r.shaky ? 'shaky' : ''}">
        <td class="num">${esc(r.cells[0])}</td>
        <td class="num">${esc(r.cells[1])}</td>
        <td class="nm">${esc(r.cells[2])}</td>
        ${r.cells.slice(3).map((v, i) => {
    const yes = r.hit[i];
    const isVal = yes && v !== 'O';
    return `<td class="mk ${isVal ? 'val' : (yes ? 'yes' : 'no')}">${esc(v)}</td>`;
  }).join('')}
      </tr>`;
    }).join('');
  }

  $('moreInfo').textContent = snap.total > snap.shown
    ? `앞 ${snap.shown}줄만 보여 줍니다 (모두 ${snap.total}줄). 내보내면 전부 나갑니다.` : '';

  /* 기준에 없는 사람 */
  const ex = snap.extras || [];
  $('extras').innerHTML = !ex.length ? '' : `
    <h3>⚠ 기준 명단에 없는 사람 ${st.extras}명 — 다른 명단에만 있습니다</h3>
    ${ex.map((e) => `<div class="row"><b>${esc(e.list)}</b>
      <span>${esc(e.cls ? e.cls + '반 ' : '')}${esc(e.no != null ? e.no + '번 ' : '')}${esc(e.name)}${e.sid ? ' (' + esc(e.sid) + ')' : ''}</span></div>`).join('')}
    ${st.extras > ex.length ? `<p class="hint">앞 ${ex.length}명만 보여 줍니다. 내보내면 전부 나갑니다.</p>` : ''}`;

  const canExport = !!st && st.lists > 0;
  $('btnExcel').disabled = !canExport;
  $('btnCsv').disabled = !canExport;
}

function render() {
  if (!snap) return;
  $('selOnly').value = snap.only;
  renderLists();
  renderTable();
}

/* ── 단추 ─────────────────────────────────────────────── */

function wire() {
  /* 명단 넣기 — 고르기(여러 개 가능) · 끌어다 놓기. 넣은 순서대로, 맨 처음 것이 기준이 된다 */
  const addFiles = guard(async (files) => {
    const list = Array.from(files || []).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    for (const file of list) {
      // eslint-disable-next-line no-await-in-loop
      const r = await LocalApi.addFile(file);
      if (!r.ok) { toast(`${file.name} — ${r.message || '읽지 못했습니다'}`, 'err'); continue; }
      snap = r; render();
      toast(`“${r.added}” — ${r.count}명을 읽었습니다` + (r.skipped ? ` (${r.skipped}줄은 학생이 아니라 건너뜀)` : ''), 'ok');
    }
  });
  $('btnAdd').onclick = () => $('pickList').click();
  $('pickList').onchange = (e) => { addFiles(e.target.files); e.target.value = ''; };
  window.addEventListener('dragover', (e) => { e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    const fl = (e.dataTransfer && e.dataTransfer.files) || [];
    if (fl.length) addFiles(fl);
  });

  $('btnClear').onclick = guard(async () => {
    if (!snap.lists.length) return;
    if (!confirm('넣은 명단을 모두 비울까요?\n원본 파일은 그대로 있습니다.')) return;
    snap = await api('/api/clear', {});
    render();
  });

  $('lists').addEventListener('click', guard(async (e) => {
    const rm = e.target.closest('[data-remove]');
    if (rm) { snap = await api('/api/remove', { id: rm.dataset.remove }); render(); return; }
    const mb = e.target.closest('[data-base]');
    if (mb) {
      snap = await api('/api/make-base', { id: mb.dataset.base });
      render();
      toast('기준 명단을 바꿨습니다', 'ok');
    }
  }));

  $('lists').addEventListener('change', guard(async (e) => {
    const pk = e.target.closest('select[data-pick]');
    if (pk) { snap = await api('/api/pick', { id: pk.dataset.pick, pick: Number(pk.value) }); render(); return; }
    const lb = e.target.closest('input[data-label]');
    if (lb) { snap = await api('/api/label', { id: lb.dataset.label, label: lb.value }); render(); }
  }));

  $('filters').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    filter = c.dataset.f;
    renderTable();
  });

  $('selOnly').onchange = guard(async (e) => {
    snap = await api('/api/only', { only: e.target.value });
    render();
  });

  const doExport = (format) => guard(async () => {
    const r = await api('/api/export', { format });
    if (!r.ok) { toast(r.message || '저장하지 못했습니다', 'err'); return; }
    Zip.download(r.blob, r.file);
    $('exportInfo').textContent = `${r.rows}줄을 내려받았습니다 — ${r.file}`;
    toast(`${r.rows}줄을 내려받았습니다`, 'ok');
  })();

  $('btnExcel').onclick = () => doExport('xlsx');
  $('btnCsv').onclick = () => doExport('csv');
}

(async function main() {
  wire();
  try { snap = await api('/api/env'); render(); }
  catch (_) {
    document.body.innerHTML = '<div style="padding:60px;text-align:center">도구를 불러오지 못했습니다. 새로 고침해 주세요.</div>';
  }
})();
