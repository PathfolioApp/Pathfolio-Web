const crypto = require('crypto');
const VERSION = 'story-v2';
const text = (value, max = 120) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const list = value => Array.isArray(value) ? value : [];
const labels = (value, max = 10) => [...new Set(list(value).map(v => text(typeof v === 'string' ? v : v?.name, 60)).filter(Boolean))].sort().slice(0, max);

function factsFor(student) {
  const allProjects = list(student.projects).filter(p => text(p?.projectName));
  const allAchievements = list(student.achievements).filter(a => text(a?.title));
  const allInternships = list(student.internships).filter(i => text(i?.role) || text(i?.companyName));
  const byDate = (a, b) => String(b.updatedAt || b.createdAt || b.endDate || b.startDate || b.year || '').localeCompare(String(a.updatedAt || a.createdAt || a.endDate || a.startDate || a.year || '')) || JSON.stringify(a).localeCompare(JSON.stringify(b));
  return {
    name: text(student.personal?.fullName) || 'This student',
    department: text(student.academic?.department), batchYear: text(student.academic?.batchYear, 30),
    cgpa: student.academic?.cgpa !== '' && student.academic?.cgpa != null && Number.isFinite(Number(student.academic.cgpa)) && Number(student.academic.cgpa) >= 0 && Number(student.academic.cgpa) <= 10 ? Number(student.academic.cgpa) : null,
    passions: labels(student.interests?.passions), hobbies: labels(student.interests?.hobbies),
    counts: { projects: allProjects.length, achievements: allAchievements.length, internships: allInternships.length },
    projects: allProjects.sort(byDate).slice(0, 10).map(p => ({ name: text(p.projectName), type: text(p.projectType, 60), technologies: labels(p.technologies, 8), description: text(p.description, 200), ongoing: Boolean(p.currentlyWorking), start: text(p.startDate, 10), end: text(p.endDate, 10) })),
    achievements: allAchievements.sort(byDate).slice(0, 12).map(a => ({ title: text(a.title), category: text(a.category, 60), description: text(a.description, 200), year: /^\d{4}$/.test(String(a.year)) ? String(a.year) : '' })),
    internships: allInternships.sort(byDate).slice(0, 8).map(i => ({ role: text(i.role), company: text(i.companyName), skills: labels(i.skills, 6), description: text(i.description, 160), ongoing: Boolean(i.currentlyWorking), start: text(i.startDate, 10), end: text(i.endDate, 10) }))
  };
}
const fingerprint = facts => crypto.createHash('sha256').update(VERSION + JSON.stringify(facts)).digest('hex');
const hasContent = facts => Object.values(facts.counts).some(Boolean) || facts.passions.length > 0 || facts.hobbies.length > 0;
function validateSummary(value) {
  const validString = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  return Boolean(value && !Array.isArray(value) && validString(value.summary, 900) && value.summary.trim().length >= 20 &&
    Array.isArray(value.highlights) && value.highlights.length >= 1 && value.highlights.length <= 5 && value.highlights.every(v => validString(v, 160)) &&
    Array.isArray(value.themes) && value.themes.length <= 4 && value.themes.every(v => validString(v, 40)));
}
function fallback(facts) {
  if (!hasContent(facts)) return { available: false, generatedBy: 'none', note: 'Add a project, milestone, experience, or interest to begin your summary.' };
  const sentences = [facts.department ? `${facts.name} studies ${facts.department}${facts.batchYear ? ` (batch ${facts.batchYear})` : ''}.` : `${facts.name} is building a record of their learning and experiences.`];
  const interests = [...new Set([...facts.passions, ...facts.hobbies])];
  if (interests.length) sentences.push(`Their recorded interests include ${interests.slice(0, 4).join(', ')}.`);
  if (facts.counts.projects) sentences.push(`Their profile includes ${facts.counts.projects} project${facts.counts.projects === 1 ? '' : 's'}, including ${facts.projects[0].name}.`);
  if (facts.counts.internships) { const i = facts.internships[0]; sentences.push(`Their experience includes ${[i.role, i.company && `at ${i.company}`].filter(Boolean).join(' ')}.`); }
  if (facts.counts.achievements) sentences.push(`They have recorded ${facts.counts.achievements} milestone${facts.counts.achievements === 1 ? '' : 's'}, including ${facts.achievements[0].title}.`);
  if (facts.cgpa !== null) sentences.push(`Their recorded CGPA is ${facts.cgpa}.`);
  const fitted = [];
  for (const sentence of sentences) if ([...fitted, sentence].join(' ').length <= 900) fitted.push(sentence);
  return { available: true, generatedBy: 'fallback', summary: fitted.join(' '), highlights: [...facts.achievements.map(a => `${a.year ? `${a.year}: ` : ''}${a.title}`), ...facts.projects.map(p => p.name), ...facts.internships.map(i => [i.role, i.company].filter(Boolean).join(' at '))].slice(0, 5), themes: interests.slice(0, 4), note: 'Composed directly from your saved profile. AI writing is currently unavailable.' };
}
module.exports = { VERSION, factsFor, fingerprint, hasContent, validateSummary, fallback };
