// Offline, read-only review of an explicitly supplied profile/resume snapshot.
// Input: {student, resumes:[{id, extractedData, analysis, isDefault}]}.
// Findings request review; a paraphrase is not automatically a proven falsehood.
const fs = require('node:fs');
const policy = require('../src/modules/resumes/tailoringPolicy');
const {loadService} = require('./resume-tailoring.fixture.cjs');
function auditSnapshot(snapshot) {
  const profile = loadService().extractProfileContext(snapshot.student, snapshot.resumes);
  return snapshot.resumes.filter(record => record.extractedData?.tailoredMeta || record.analysis?.tailoredMeta).map(record => ({
    id:record.id,
    summary:record.extractedData?.summary?.text || '',
    headline:record.extractedData?.personal?.headline || '',
    ...policy.auditClaims(record.extractedData || {}, profile),
  }));
}
if (require.main === module) {
  if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: node resume-claims-audit.cjs INPUT.json OUTPUT.json');
  const results = auditSnapshot(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
  fs.writeFileSync(process.argv[3], JSON.stringify(results,null,2));
  console.log(JSON.stringify(results.map(({id,checkedBullets,findings})=>({id,checkedBullets,reviewFindings:findings.length}))));
}
module.exports = {auditSnapshot};
