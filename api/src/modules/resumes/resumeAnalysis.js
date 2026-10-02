const pdfParse = require('pdf-parse');

const SECTION_NAMES = {
  summary: /^(summary|profile|objective|about me)$/i,
  education: /^(education|academic background|qualifications?)$/i,
  experience: /^(experience|work experience|employment|internships?)$/i,
  projects: /^(projects?|selected projects?)$/i,
  skills: /^(skills?|technical skills|technologies)$/i,
};

function cleanLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 300);
}

function extractSections(lines) {
  const sections = { summary: [], education: [], experience: [], projects: [], skills: [] };
  let active = null;
  for (const line of lines) {
    const heading = Object.entries(SECTION_NAMES).find(([, pattern]) => pattern.test(line.replace(/[:|-]+$/, '').trim()));
    if (heading) {
      active = heading[0];
      continue;
    }
    if (active) sections[active].push(line);
  }
  return sections;
}

function extractContact(text) {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
  const phone = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.replace(/\s+/g, ' ').trim() || '';
  const links = [...new Set(text.match(/(?:https?:\/\/|www\.)[^\s)]+/gi) || [])].slice(0, 8);
  return { email, phone, links };
}

async function analysePdf(buffer) {
  const parsed = await pdfParse(buffer);
  const text = String(parsed.text || '').replace(/[\u0000\uFFFD]/g, ' ').trim();
  const lines = cleanLines(text);
  const sections = extractSections(lines);
  const contact = extractContact(text);
  const hasTextLayer = text.length >= 40;
  const hasContact = Boolean(contact.email || contact.phone);
  const hasSections = Object.values(sections).some(items => items.length > 0);
  const singlePage = Number(parsed.numpages || 0) === 1;
  const checks = [
    { key: 'textLayer', label: 'Selectable text layer', passed: hasTextLayer },
    { key: 'contact', label: 'Contact details detected', passed: hasContact },
    { key: 'sections', label: 'Resume sections detected', passed: hasSections },
    { key: 'singlePage', label: 'Single-page format', passed: singlePage },
  ];
  const score = Math.round((checks.filter(check => check.passed).length / checks.length) * 100);
  const parserReady = hasTextLayer && hasContact && hasSections;
  return {
    score,
    checks,
    parserReady,
    pages: Number(parsed.numpages || 0),
    characters: text.length,
    portalReadiness: {
      naukri: parserReady,
      greenhouse: parserReady,
      lever: parserReady,
      workday: parserReady,
    },
    extracted: {
      contact,
      summary: sections.summary.join(' '),
      education: sections.education,
      experience: sections.experience,
      projects: sections.projects,
      skills: sections.skills,
    },
    checkedAt: new Date().toISOString(),
  };
}

module.exports = { analysePdf };
