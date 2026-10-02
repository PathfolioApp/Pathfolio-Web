const pdfParse = require('pdf-parse');

const SECTION_NAMES = {
  summary: /^(summary|professional summary|profile|professional profile|objective|career objective|about me)$/i,
  education: /^(education|academic background|academic history|qualifications?|degrees?)$/i,
  experience: /^(experience|work experience|professional experience|employment|internships?|internship experience|work history|career history)$/i,
  projects: /^(projects?|selected projects?|personal projects|academic projects)$/i,
  skills: /^(skills?|technical skills|core skills|key skills|technologies|technical proficiencies|competencies|tools)$/i,
  certifications: /^(certifications?|licenses?|courses?|training)$/i,
  achievements: /^(achievements?|awards?|honors?|accomplishments?)$/i,
  leadership: /^(leadership|extracurricular|volunteering|volunteer experience|activities|community involvement)$/i,
};

const SECTION_KEYS = Object.keys(SECTION_NAMES);

function cleanLines(text) {
  return String(text || '')
    .replace(/\u2022|\u25aa|\u25cf/g, '\n- ')
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 400);
}

function isHeading(line) {
  const normalized = line.replace(/[:|-]+$/, '').trim().replace(/\s+/g, ' ');
  return Object.entries(SECTION_NAMES).find(([, pattern]) => pattern.test(normalized))?.[0] || null;
}

function extractSections(lines) {
  const sections = Object.fromEntries(SECTION_KEYS.map(key => [key, []]));
  let active = null;
  for (const line of lines) {
    const heading = isHeading(line);
    if (heading) {
      active = heading;
      continue;
    }
    const inlineHeading = line.match(/^([A-Za-z][A-Za-z &/]{1,49})\s*:\s*(.+)$/);
    const inlineKey = inlineHeading ? isHeading(inlineHeading[1]) : null;
    if (inlineKey) {
      active = inlineKey;
      sections[active].push(inlineHeading[2].trim());
      continue;
    }
    if (active) sections[active].push(line);
  }
  return sections;
}

function extractContact(text) {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
  const phone = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.replace(/\s+/g, ' ').trim() || '';
  const links = [...new Set(text.match(/(?:(?:https?:\/\/|www\.)[^\s)]+|(?:linkedin|github)\.com\/[A-Za-z0-9_./-]+)/gi) || [])].slice(0, 8);
  const linkedin = links.find(link => /linkedin/i.test(link)) || '';
  const github = links.find(link => /github/i.test(link)) || '';
  const portfolio = links.find(link => link !== linkedin && link !== github) || '';
  return { email, phone, linkedin, github, portfolio, links };
}

function firstNameAndHeadline(lines, contact) {
  const firstContent = lines.find(line => !line.includes('@') && !/^[+\d(]/.test(line) && !isHeading(line)) || '';
  const index = firstContent ? lines.indexOf(firstContent) : -1;
  const headline = index >= 0 ? lines.slice(index + 1, index + 3).find(line => line.length < 100 && !isHeading(line) && !line.startsWith('-')) || '' : '';
  return { fullName: firstContent, headline, confidence: firstContent ? 'medium' : 'low', source: 'pdf-text' };
}

function splitEntries(lines, section) {
  const entries = [];
  let current = null;
  const dateLike = /\b(?:19|20)\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|present|current/i;
  const dateOnly = /^(?:(?:19|20)\d{2}|(?:19|20)\d{2}\s*[–-]\s*(?:19|20)\d{2}|(?:19|20)\d{2}\s*[–-]\s*(?:present|current))$/i;
  const continuationStart = /^(?:and|or|with|using|to|for|by|which|that|this|these|improved|increased|reduced|built|created|designed|developed|implemented|delivered|deployed|managed|led|launched|optimized)\b/i;
  for (const line of lines) {
    const bullet = /^[-*]\s+/.test(line);
    const cleanLine = line.replace(/^[-*]\s+/, '').trim();
    const likelyHeader = cleanLine.length <= 100 && /^[A-Z]/.test(cleanLine) && !/[.!?]$/.test(cleanLine) && !continuationStart.test(cleanLine);
    const startsEntry = !bullet && current && !dateOnly.test(cleanLine) && ((current.bullets.length > 0 && likelyHeader) || (current.bullets.length === 0 && dateLike.test(line) && dateLike.test(current.raw)));
    if (!current || startsEntry) {
      current = { raw: cleanLine, title: bullet ? '' : cleanLine, preamble: [], bullets: [], confidence: 'low', source: 'pdf-text' };
      entries.push(current);
    } else {
      if (bullet) current.bullets.push(line.replace(/^[-*]\s+/, ''));
      else if (current.bullets.length > 0) current.bullets[current.bullets.length - 1] += ` ${cleanLine}`;
      else {
        current.raw = `${current.raw} | ${cleanLine}`;
        if (!dateOnly.test(cleanLine)) current.preamble.push(cleanLine);
      }
    }
  }
  return entries.filter(entry => entry.raw || entry.bullets.length).map(entry => ({
    ...entry,
    section,
    confidence: entry.bullets.length || extractDateText(entry.raw) ? 'high' : entry.preamble.length ? 'medium' : entry.confidence,
    description: descriptionWithoutDuplicateBullets(entry.preamble.join(' '), entry.bullets),
  }));
}

function descriptionWithoutDuplicateBullets(preamble, bullets) {
  if (!preamble) return '';
  const normalize = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
  const paragraph = normalize(preamble);
  const bulletText = normalize(bullets.join(' '));
  return paragraph && bulletText && (paragraph.includes(bulletText) || bulletText.includes(paragraph)) ? '' : preamble;
}

function extractDateText(text) {
  return String(text || '').match(/(?:[A-Z][a-z]{2,9}\.?\s+)?(?:19|20)\d{2}(?:\s*(?:[\/-]|–|—|to)\s*(?:(?:[A-Z][a-z]{2,9}\.?\s+)?(?:19|20)\d{2}|present|current))?|(?:0?[1-9]|1[0-2])[\/-](?:19|20)\d{2}/i)?.[0]?.trim() || '';
}

function cleanRecordTitle(title, dates) {
  if (!title) return '';
  if (!dates) return title;
  const cleaned = title.replace(new RegExp(`\\s*${dates.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*$`, 'i'), '').trim();
  return cleaned || title;
}

function skillGroups(lines) {
  const skills = lines.flatMap(line => {
    const value = line.replace(/^[-*]\s+/, '').trim();
    const withoutLabel = value.replace(/^[^:]{1,32}:\s*/, '');
    return withoutLabel.split(/[,|;]\s*/);
  }).map(skill => skill.trim()).filter(Boolean);
  const uniqueSkills = [...new Map(skills.map(skill => [skill.toLowerCase(), skill])).values()];
  return {
    programming: uniqueSkills.filter(skill => /javascript|typescript|python|java|c\+\+|go|rust|php|ruby|kotlin|swift|\bc\b/i.test(skill)),
    frameworks: uniqueSkills.filter(skill => /react|node|express|django|spring|next|angular|fastapi|flask|vue/i.test(skill)),
    data: uniqueSkills.filter(skill => /sql|postgres|mysql|mongo|redis|database|pandas|numpy|spark/i.test(skill)),
    cloudDevops: uniqueSkills.filter(skill => /aws|azure|gcp|docker|kubernetes|terraform|jenkins|linux|git|ci\/cd|nginx|cloudflare|vpn|wireguard/i.test(skill)),
    aiMl: uniqueSkills.filter(skill => /machine learning|deep learning|tensorflow|pytorch|nlp|llm|scikit|groq/i.test(skill)),
    other: uniqueSkills.filter(skill => !/javascript|typescript|python|java|c\+\+|go|rust|php|ruby|kotlin|swift|\bc\b|react|node|express|django|spring|next|angular|fastapi|flask|vue|sql|postgres|mysql|mongo|redis|database|pandas|numpy|spark|aws|azure|gcp|docker|kubernetes|terraform|jenkins|linux|git|ci\/cd|nginx|cloudflare|vpn|wireguard|machine learning|deep learning|tensorflow|pytorch|nlp|llm|scikit|groq/i.test(skill)),
    raw: uniqueSkills,
  };
}

function countMatches(text, pattern) {
  return (String(text || '').match(pattern) || []).length;
}

function buildAtsMetrics(text, sections, structured, pageCount) {
  const bullets = [...structured.experience, ...structured.projects].flatMap(item => item.bullets || []);
  const quantifiedBullets = bullets.filter(bullet => /\b\d+(?:\.\d+)?\s*%?|\$\s*\d|\b\d+(?:\.\d+)?\s*(?:x|k|m|hours?|days?|users?|clients?|projects?)\b/i.test(bullet));
  const actionBullets = bullets.filter(bullet => /^(built|created|designed|developed|delivered|deployed|improved|increased|reduced|automated|led|managed|launched|optimized|implemented)/i.test(bullet.trim()));
  const sectionCount = SECTION_KEYS.filter(key => sections[key].length > 0).length;
  const skillCount = structured.skills.raw.length;
  const contactCount = ['email', 'phone', 'linkedin', 'github', 'portfolio'].filter(key => structured.personal[key]).length;
  const checks = [
    { key: 'textLayer', label: 'Selectable text layer', passed: text.length >= 40, weight: 20, evidence: `${text.length.toLocaleString()} extracted characters` },
    { key: 'contact', label: 'Contact details detected', passed: contactCount >= 2, weight: 15, evidence: `${contactCount}/5 contact fields detected` },
    { key: 'headings', label: 'Conventional section headings', passed: sectionCount >= 3, weight: 15, evidence: `${sectionCount}/${SECTION_KEYS.length} recognized sections` },
    { key: 'summary', label: 'Professional summary', passed: sections.summary.length > 0, weight: 10, evidence: sections.summary.length ? 'Summary text extracted' : 'No summary text extracted' },
    { key: 'skills', label: 'Skills inventory', passed: skillCount >= 3, weight: 15, evidence: `${skillCount} skills extracted` },
    { key: 'evidence', label: 'Experience or project evidence', passed: bullets.length >= 2, weight: 15, evidence: `${bullets.length} achievement bullets extracted` },
    { key: 'quantifiedImpact', label: 'Quantified achievement evidence', passed: quantifiedBullets.length > 0, weight: 5, evidence: `${quantifiedBullets.length} quantified bullets` },
    { key: 'actionLanguage', label: 'Action-led achievement language', passed: actionBullets.length > 0, weight: 5, evidence: `${actionBullets.length} action-led bullets` },
  ];
  const earned = checks.reduce((total, check) => total + (check.passed ? check.weight : 0), 0);
  return {
    score: earned,
    checks,
    counts: {
      pages: pageCount,
      characters: text.length,
      sections: sectionCount,
      skills: skillCount,
      education: structured.education.length,
      experience: structured.experience.length,
      projects: structured.projects.length,
      bullets: bullets.length,
      quantifiedBullets: quantifiedBullets.length,
      links: structured.personal.links.length,
      email: countMatches(structured.personal.email, /@/),
    },
    source: 'Pathfolio PDF text extraction',
    limitation: 'This is a local content and parsing assessment. No external ATS partner API was called.',
  };
}

function buildStructuredData(text, lines, sections) {
  const contact = extractContact(text);
  const identity = firstNameAndHeadline(lines, contact);
  const toRecord = (entry, type) => {
    const dates = extractDateText(entry.raw);
    const title = cleanRecordTitle(entry.title || '', dates);
    return {
    id: `${type}_${Buffer.from(entry.raw || entry.title).toString('base64').slice(0, 12)}`,
    title,
    company: type === 'experience' ? title : '',
    institution: type === 'education' ? title : '',
    dates,
    description: entry.description || '',
    bullets: entry.bullets || [],
    raw: entry.raw || '',
    confidence: entry.confidence,
    source: entry.source,
    };
  };
  return {
    personal: { ...identity, ...contact },
    summary: { text: sections.summary.join(' '), confidence: sections.summary.length ? 'medium' : 'low', source: 'pdf-text' },
    education: splitEntries(sections.education, 'education').map(entry => toRecord(entry, 'education')),
    experience: splitEntries(sections.experience, 'experience').map(entry => toRecord(entry, 'experience')),
    projects: splitEntries(sections.projects, 'project').map(entry => toRecord(entry, 'project')),
    skills: skillGroups(sections.skills),
    certifications: splitEntries(sections.certifications, 'certification').map(entry => toRecord(entry, 'certification')),
    achievements: splitEntries(sections.achievements, 'achievement').map(entry => toRecord(entry, 'achievement')),
    leadership: splitEntries(sections.leadership, 'leadership').map(entry => toRecord(entry, 'leadership')),
    extractedAt: new Date().toISOString(),
    extractionMethod: 'pdf-text',
  };
}

function analyseText(rawText, pageCount = 0) {
  const text = String(rawText || '').replace(/[\u0000\uFFFD]/g, ' ').trim();
  const lines = cleanLines(text);
  const sections = extractSections(lines);
  const contact = extractContact(text);
  const structured = buildStructuredData(text, lines, sections);
  const hasTextLayer = text.length >= 40;
  const hasContact = Boolean(contact.email || contact.phone);
  const hasSections = Object.values(sections).some(items => items.length > 0);
  const findings = [
    !contact.email && { key: 'email', title: 'Email not detected', detail: 'Add a plain-text email address near your name so application systems can identify it.', severity: 'high' },
    !contact.phone && { key: 'phone', title: 'Phone not detected', detail: 'Add a phone number in selectable text if recruiters should contact you by phone.', severity: 'medium' },
    !sections.summary.length && { key: 'summary', title: 'Summary section not detected', detail: 'Add a concise target-role summary under a conventional Summary or Profile heading.', severity: 'medium' },
    !sections.skills.length && { key: 'skills', title: 'Skills section not detected', detail: 'Add a clearly labelled Skills section with standard text rather than an image or graphic.', severity: 'medium' },
    !sections.experience.length && !sections.projects.length && { key: 'evidence', title: 'Experience or projects not detected', detail: 'Add evidence of work, internships, or projects with individual achievement bullets.', severity: 'high' },
  ].filter(Boolean);
  const ats = buildAtsMetrics(text, sections, structured, Number(pageCount || 0));
  const parserReady = hasTextLayer && hasContact && hasSections;
  return {
    score: ats.score,
    ats,
    checks: ats.checks,
    findings,
    parserReady,
    pages: Number(pageCount || 0),
    characters: text.length,
    portalReadiness: { local: { status: parserReady ? 'estimated' : 'review', label: parserReady ? 'Local extraction passed' : 'Review extraction' } },
    extracted: {
      contact,
      summary: sections.summary.join(' '),
      education: sections.education,
      experience: sections.experience,
      projects: sections.projects,
      skills: sections.skills,
    },
    structured,
    sourceText: text,
    checkedAt: new Date().toISOString(),
  };
}

async function analysePdf(buffer) {
  const parsed = await pdfParse(buffer);
  return analyseText(parsed.text, parsed.numpages);
}

module.exports = { analysePdf, analyseText };
