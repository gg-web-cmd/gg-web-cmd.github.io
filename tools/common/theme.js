/* 도구함 공통 — 밝게/어둡게, 그리고 메뉴 안에 들어 있는지 알아보기.
 *
 * 밝기는 localStorage 'tools.theme' 하나로 모든 도구가 같이 쓴다.
 * 메뉴(tools/index.html)에서 바꾸면 storage 이벤트가 같은 출처의 다른 문서(= 안에 든 도구들)에
 * 날아가므로, 따로 말을 전하지 않아도 모두 함께 바뀐다.
 *
 * 메뉴 안(iframe)에 들어 있으면 <html class="embedded"> 를 달아 도구 자신의 머리줄을 숨긴다.
 * 이 파일은 <head> 에서 읽는다 — 화면이 한 번 하얗게 번쩍이지 않게.
 */
(function () {
  'use strict';
  var KEY = 'tools.theme';
  var html = document.documentElement;

  var embedded = false;
  try { embedded = window.self !== window.top; } catch (_) { embedded = true; }
  if (embedded) html.classList.add('embedded');

  function current() {
    var t = null;
    try { t = localStorage.getItem(KEY); } catch (_) {}
    if (t !== 'dark' && t !== 'light') {
      t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return t;
  }

  function apply() {
    var t = current();
    html.dataset.theme = t;
    if (document.body) {
      document.body.classList.toggle('dark', t === 'dark');
      document.body.classList.toggle('light', t !== 'dark');
    }
    var b = document.getElementById('btnTheme');
    if (b) b.textContent = t === 'dark' ? '☀️' : '🌙';
  }

  function toggle() {
    var next = current() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, next); } catch (_) {}
    apply();
  }

  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(); });
  document.addEventListener('DOMContentLoaded', function () {
    apply();
    var b = document.getElementById('btnTheme');
    if (b) b.addEventListener('click', toggle);
  });

  window.ToolsTheme = { apply: apply, toggle: toggle, current: current, embedded: embedded };
}());
