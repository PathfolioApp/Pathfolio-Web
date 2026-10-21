const test = require('node:test');
const assert = require('node:assert/strict');

test('A4 preview fits narrow phones, tablets and desktops without rounding into overflow', async () => {
  const { fitPreviewZoom } = await import('../../frontend/src/modules/student/resume/studioViewport.mjs');
  for (const width of [100, 240, 280, 320, 375, 430, 600, 768, 1024, 1440]) {
    const zoom = fitPreviewZoom(width);
    assert.ok(zoom > 0 && zoom <= 1.05);
    assert.ok(794 * zoom <= width - 38, `Preview exceeds available width at ${width}px`);
  }
});

test('fit respects actual padding in normal and fullscreen views', async () => {
  const { fitPreviewZoom } = await import('../../frontend/src/modules/student/resume/studioViewport.mjs');
  assert.ok(fitPreviewZoom(375, 24, 24) < fitPreviewZoom(375, 12, 12));
  assert.equal(fitPreviewZoom(1500, 12, 12), 1.05);
  assert.equal(fitPreviewZoom(0), null);
  assert.equal(fitPreviewZoom(NaN), null);
  assert.equal(fitPreviewZoom(100, 60, 60), null);
});
