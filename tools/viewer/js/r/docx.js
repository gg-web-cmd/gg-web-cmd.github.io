/* 워드 .docx — docx-preview(Apache-2.0). 쪽 모양·머리말·각주·표·그림을 살린다. */
import { FlowView } from '../flow.js';
import { libs, hardenLinks } from '../util.js';

export async function render(doc, container, ctx) {
  ctx.progress('워드 문서를 그리는 중…');
  const docx = await libs.docx();
  const view = new FlowView(container, ctx.flowOpts({ className: 'docx-flow', pageSelector: 'section.docx', zoom: 'auto' }));
  await docx.renderAsync(doc.bytes.slice().buffer, view.content, view.content, {
    className: 'docx',
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: false,
    breakPages: true,
    ignoreLastRenderedPageBreak: true,
    experimental: true,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
    renderEndnotes: true,
    renderComments: false,
    useBase64URL: true,
  });
  hardenLinks(view.content);
  view.content.querySelectorAll('script, iframe, object, embed').forEach((x) => x.remove());
  view.ready();
  const pages = view.pageCount;
  return {
    flow: view,
    info: [['쪽 수', pages ? `약 ${pages}쪽 (화면 기준)` : '—']],
    printCss: '@page { margin: 0; }',
  };
}
