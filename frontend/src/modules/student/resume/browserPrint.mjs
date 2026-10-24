import { printable } from '../../../../../shared/resume/resumeDocument.mjs';

// Browser Print alone uses physical spacer/padding margins. Export PDF keeps
// the shared renderer's native page margins and must not use this wrapper.
export function browserPrintDocument(...args) {
  return printable(...args)
    .replace('@page { size: A4 portrait; margin: 14mm 18mm; }', '@page { size: A4 portrait; margin: 0; }')
    .replace('body { width: 174mm; }', `
      body { width: 210mm; padding: 0 18mm; }
      .browser-print-table { width: 100%; border-collapse: collapse; border: 0; }
      .browser-print-table td { padding: 0; border: 0; }
      .browser-print-table thead { display: table-header-group; }
      .browser-print-table tfoot { display: table-footer-group; }
      .browser-print-space { display: block; height: 14mm; }
    `)
    .replace('<body>', `<body><table class="browser-print-table" role="presentation">
      <thead><tr><td><span class="browser-print-space"></span></td></tr></thead>
      <tfoot><tr><td><span class="browser-print-space"></span></td></tr></tfoot>
      <tbody><tr><td>`)
    .replace('</body>', '</td></tr></tbody></table></body>');
}
