// Load the same pure template and normalization used by Resume Studio.
async function renderSavedResumeHtml(data, title = '') {
  const { normalizeExtractedData, printable, getSavedLayout } = await import('../../../../shared/resume/resumeDocument.mjs');
  const layout = getSavedLayout(data);
  return printable(normalizeExtractedData(data), layout?.template || 'classic', layout?.isCompact || false,
    title, layout?.condenseDesc || false, !layout);
}

module.exports = { renderSavedResumeHtml };
