const pdfParse = require('pdf-parse');
const config = require('../../config');
const geminiService = require('../../shared/gemini.service');

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
  const urlPattern = /(?:https?:\/\/|www\.)[^\s,;"'<>]+|(?:(?:linkedin|github|leetcode|codeforces|hackerrank|gitlab|behance|medium)\.com\/[A-Za-z0-9_./#&?=-]+)|(?:[a-zA-Z0-9][-a-zA-Z0-9]*\.(?:dev|me|io|in|app|tech|page|site)(?:\/[^\s,;"'<>]*)?)/gi;
  const rawLinks = [...new Set(text.match(urlPattern) || [])].map(l => l.replace(/[.,;)]+$/, ''));
  const links = rawLinks.filter(l => !l.includes('@'));
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
  const programming = uniqueSkills.filter(skill => /javascript|typescript|python|java|c\+\+|go|rust|php|ruby|kotlin|swift|\bc\b/i.test(skill));
  const frameworks = uniqueSkills.filter(skill => /react|node|express|django|spring|next|angular|fastapi|flask|vue/i.test(skill));
  const data = uniqueSkills.filter(skill => /sql|postgres|mysql|mongo|redis|database|pandas|numpy|spark/i.test(skill));
  const cloudDevops = uniqueSkills.filter(skill => /aws|azure|gcp|docker|kubernetes|terraform|jenkins|linux|git|ci\/cd|nginx|cloudflare|vpn|wireguard/i.test(skill));
  const aiMl = uniqueSkills.filter(skill => /machine learning|deep learning|tensorflow|pytorch|nlp|llm|scikit|groq/i.test(skill));
  const other = uniqueSkills.filter(skill => !programming.includes(skill) && !frameworks.includes(skill) && !data.includes(skill) && !cloudDevops.includes(skill) && !aiMl.includes(skill));
  return {
    languages: programming,
    programming,
    frameworks,
    cloudDevOps: cloudDevops,
    cloudDevops,
    databasesTools: [...data, ...other],
    data,
    aiMl,
    other,
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

async function groqParseResume(text) {
  const apiKey = config.groqApiKey || process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn('[Resume Parse] ℹ️ No GROQ_API_KEY configured. Skipping Groq LLM.');
    return null;
  }
  
  const models = [
    config.groqModel,
    'openai/gpt-oss-120b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant'
  ].filter(Boolean);

  const payload = {
    response_format: { type: "json_object" },
    messages: [
      {
        role: 'system',
        content: `You are an expert resume parser. Parse the provided resume text into a strict JSON object with this exact schema:
{
  "personal": {
    "fullName": "Candidate full name",
    "headline": "Target role or headline",
    "email": "Email address",
    "phone": "Phone number",
    "location": "City, State/Country",
    "linkedin": "Full LinkedIn URL (https://linkedin.com/in/...)",
    "github": "Full GitHub URL (https://github.com/...)",
    "portfolio": "Portfolio / personal website URL",
    "links": ["Array of all links/URLs detected (LinkedIn, GitHub, Portfolio, LeetCode, Codeforces, HackerRank, personal website, etc.)"]
  },
  "summary": {"text": "Professional summary or objective"},
  "education": [{"title": "Degree and Major", "institution": "University / Institution name", "dates": "Graduation or dates", "description": "CGPA/Percentage or details", "bullets": []}],
  "experience": [{"title": "Role / Job title", "company": "Company name", "dates": "Dates", "location": "Location", "description": "", "bullets": ["Achievement bullets"]}],
  "projects": [{"title": "Project Name", "dates": "Dates", "technologies": "Technologies used", "liveUrl": "Live demo / deployment URL (not GitHub)", "repoUrl": "GitHub / source code repo URL", "description": "Project overview", "bullets": ["Project achievement bullets"]}],
  "skills": {
    "languages": ["Programming languages: e.g. Java, Python, C, C++, JavaScript, TypeScript, SQL, Go, HTML, CSS"],
    "frameworks": ["Frameworks & libraries: e.g. React, Node.js, Express, Spring Boot, FastAPI, Flask, Tailwind CSS, Pandas"],
    "cloudDevOps": ["Cloud, DevOps & tools: e.g. AWS, Docker, Kubernetes, Git, GitHub, GitHub Actions, Linux, CI/CD, Cloudflare"],
    "databasesTools": ["Databases & developer tools: e.g. MySQL, PostgreSQL, MongoDB, Redis, VS Code, Postman, Jira, Jupyter"],
    "raw": ["All technical skills combined in one flat list"]
  },
  "certifications": [{"title": "Certification name", "dates": "Year/Date", "issuer": "Issuing organization"}],
  "achievements": [{"title": "Achievement or award name", "dates": "Year/Date", "description": "Description/Context"}],
  "leadership": [{"title": "Leadership role or activity", "dates": "Year/Date", "description": "", "bullets": []}]
}
CRITICAL REQUIREMENTS:
- Extract EVERY link, profile URL, or personal website from the resume into personal.links, personal.linkedin, personal.github, and personal.portfolio.
- Organize skills accurately into languages, frameworks, cloudDevOps, and databasesTools, and also list every skill in skills.raw.
- Return ONLY valid JSON.`
      },
      { role: 'user', content: String(text).substring(0, 9000) }
    ],
    temperature: 0.1
  };

  for (const model of models) {
    const startTime = Date.now();
    console.log(`[Resume Parse] 🚀 [Tier 2: Groq LLM] Trying model "${model}" (${text.length} chars input)...`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...payload, model }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.warn(`[Resume Parse] ⚠️ [Tier 2: Groq LLM] Model "${model}" failed (HTTP ${response.status} in ${elapsed}s): ${errText.slice(0, 200)}`);
        continue;
      }
      
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        console.log(`[Resume Parse] ✅ [Tier 2: Groq LLM] SUCCESS with model "${model}" in ${elapsed}s`);
        return parsed;
      }
    } catch (err) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const isAbort = err.name === 'AbortError' || err.message?.includes('aborted');
      console.warn(`[Resume Parse] ⚠️ [Tier 2: Groq LLM] Model "${model}" error after ${elapsed}s: ${isAbort ? 'Request timed out (25s)' : err.message}`);
    }
  }

  console.warn('[Resume Parse] ⚠️ [Tier 2: Groq LLM] All candidate models failed or exhausted.');
  return null;
}

function normalizeLlmStructured(structured, text, lines, sections, contact, sourceMethod) {
  structured.extractedAt = new Date().toISOString();
  structured.extractionMethod = sourceMethod;
  
  const p = structured.personal || {};
  const regexIdentity = firstNameAndHeadline(lines, contact);
  
  // Normalize and merge links without loss
  const formatUrl = u => {
    if (!u) return '';
    const s = String(u).trim().replace(/[.,;)]+$/, '');
    if (/^https?:\/\//i.test(s)) return s;
    return `https://${s.replace(/^\/+/, '')}`;
  };

  const isCandidateProfileLink = u => {
    if (!u) return false;
    const lower = u.toLowerCase();
    if (lower.includes('linkedin.com/in/') || lower.includes('linkedin.com/pub/')) return true;
    if (lower.includes('leetcode.com/') || lower.includes('codolio.com/') || lower.includes('codeforces.com/') || lower.includes('hackerrank.com/')) return true;
    if (lower.includes('github.com/')) {
      const cleanPath = lower.replace(/^https?:\/\//, '').replace(/^www\./, '').split('?')[0].split('#')[0];
      const segments = cleanPath.split('/').filter(Boolean);
      return segments.length <= 2; // github.com/username only
    }
    // Exclude third-party project sites or verification links from personal header
    if (lower.includes('coursera.org') || lower.includes('huggingface.co') || lower.includes('github.com/')) return false;
    // Allow clean portfolio / personal domain
    return !lower.includes('live') && !lower.includes('demo') && !lower.includes('project') && !lower.includes('store');
  };

  const rawLinksList = [
    ...(Array.isArray(p.links) ? p.links : []),
    p.linkedin,
    p.github,
    p.portfolio,
    contact.linkedin,
    contact.github,
    contact.portfolio
  ].filter(Boolean).map(formatUrl).filter(isCandidateProfileLink);

  const uniqueLinks = [...new Set(rawLinksList)];
  const linkedinLink = uniqueLinks.find(l => /linkedin\.com/i.test(l)) || (isCandidateProfileLink(contact.linkedin) ? formatUrl(contact.linkedin) : '');
  const githubLink = uniqueLinks.find(l => /github\.com/i.test(l)) || (isCandidateProfileLink(contact.github) ? formatUrl(contact.github) : '');
  const portfolioLink = uniqueLinks.find(l => l !== linkedinLink && l !== githubLink && !/email/i.test(l)) || (isCandidateProfileLink(contact.portfolio) ? formatUrl(contact.portfolio) : '');

  structured.personal = {
    fullName: p.fullName || regexIdentity.fullName || '',
    headline: p.headline || regexIdentity.headline || '',
    email: p.email || contact.email || '',
    phone: p.phone || contact.phone || '',
    location: p.location || '',
    linkedin: linkedinLink,
    github: githubLink,
    portfolio: portfolioLink,
    links: uniqueLinks
  };

  structured.summary = { text: structured.summary?.text || sections.summary.join(' ') || '', confidence: 'high', source: sourceMethod };
  
  const collections = ['education', 'experience', 'projects', 'certifications', 'achievements', 'leadership'];
  collections.forEach(key => {
    structured[key] = (structured[key] || []).map((item, i) => ({
      id: `${key}_llm_${i}`,
      title: item.title || '',
      company: item.company || '',
      institution: item.institution || '',
      issuer: item.issuer || item.organization || '',
      dates: item.dates || '',
      location: item.location || '',
      technologies: item.technologies || '',
      liveUrl: item.liveUrl || (item.repoUrl ? '' : (item.url && !item.url.includes('github.com') ? item.url : '')),
      repoUrl: item.repoUrl || (item.liveUrl?.includes('github.com') ? item.liveUrl : (item.url?.includes('github.com') ? item.url : '')),
      degree: item.degree || item.title || '',
      degreeProgram: item.degreeProgram || item.title || '',
      description: item.description || '',
      bullets: Array.isArray(item.bullets) ? item.bullets : [],
      raw: '',
      confidence: 'high',
      source: sourceMethod
    }));
  });
  
  const s = structured.skills || {};
  const languages = s.languages?.length ? s.languages : (s.programming || []);
  const frameworks = s.frameworks || [];
  const cloudDevOps = s.cloudDevOps?.length ? s.cloudDevOps : (s.cloudDevops || []);
  const databasesTools = s.databasesTools?.length ? s.databasesTools : [...(s.data || []), ...(s.tools || []), ...(s.other || [])];
  const coreConcepts = Array.isArray(s.coreConcepts) ? s.coreConcepts : (s.concepts || []);
  const raw = Array.isArray(s.raw) && s.raw.length > 0 ? s.raw : [...languages, ...frameworks, ...cloudDevOps, ...databasesTools, ...coreConcepts];

  structured.skills = {
    languages,
    frameworks,
    cloudDevOps,
    databasesTools,
    coreConcepts,
    programming: languages,
    cloudDevops: cloudDevOps,
    data: databasesTools,
    raw: [...new Set(raw)]
  };

  if (Array.isArray(structured.sectionOrder) && structured.sectionOrder.length > 0) {
    structured.sectionOrder = structured.sectionOrder;
  }

  return structured;
}

function assembleAnalysisResult(text, lines, sections, contact, structured, pageCount) {
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

async function analyseText(rawText, pageCount = 0) {
  const text = String(rawText || '').replace(/[\u0000\uFFFD]/g, ' ').trim();
  const lines = cleanLines(text);
  const sections = extractSections(lines);
  const contact = extractContact(text);
  
  let structured = null;
  let sourceMethod = 'pdf-text';

  // Tier 1: Try Gemini text parse
  if (text.length > 50 && config.geminiApiKey) {
    structured = await geminiService.parseResumeText(text);
    if (structured) sourceMethod = structured.extractionMethod || 'gemini-text';
  }

  // Tier 2: Try Groq text parse
  if (!structured && text.length > 50) {
    structured = await groqParseResume(text);
    if (structured) sourceMethod = 'llm-groq';
  }
  
  if (!structured) {
    console.log('[Resume Parse] ℹ️ [Tier 3: Deterministic Regex] Fallback to rule-based regex parser.');
    structured = buildStructuredData(text, lines, sections);
  } else {
    structured = normalizeLlmStructured(structured, text, lines, sections, contact, sourceMethod);
  }

  console.log(`[Resume Parse] 🎯 Parsing Completed!`);
  console.log(`  • Extraction Method: [${structured.extractionMethod || sourceMethod}]`);
  console.log(`  • Candidate Name:    "${structured.personal?.fullName || 'Not detected'}"`);
  console.log(`  • Headline / Role:   "${structured.personal?.headline || 'Not detected'}"`);
  console.log(`  • Sections Summary:  ${structured.experience?.length || 0} exp, ${structured.education?.length || 0} edu, ${structured.projects?.length || 0} projects, ${structured.skills?.raw?.length || 0} skills`);

  return assembleAnalysisResult(text, lines, sections, contact, structured, pageCount);
}

async function extractPdfAnnotationLinks(buffer) {
  try {
    // Use PDF.js v2 bundled inside pdf-parse (v1 fails when required standalone)
    const path = require('path');
    const pdfJsPath = path.join(path.dirname(require.resolve('pdf-parse')), 'lib', 'pdf.js', 'v2.0.550', 'build', 'pdf.js');
    const PDFJS = require(pdfJsPath);
    PDFJS.disableWorker = true;
    const doc = await PDFJS.getDocument(buffer);
    const uris = new Set();
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const annotations = await page.getAnnotations();
      for (const ann of annotations) {
        // Subtype 'Link' with a URI action
        const url = ann.url || ann.unsafeUrl || ann.dest;
        if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
          uris.add(url.trim().replace(/[.,;)]+$/, ''));
        }
      }
    }
    return [...uris];
  } catch (err) {
    console.warn('[Resume Parse] ⚠️ PDF annotation extraction failed (non-critical):', err.message);
    return [];
  }
}

async function analysePdf(buffer) {
  const sizeKb = (buffer ? buffer.length / 1024 : 0).toFixed(1);
  console.log(`\n======================================================`);
  console.log(`[Resume Parse] 📄 Started PDF resume analysis (Size: ${sizeKb} KB)`);
  console.log(`======================================================`);

  // Extract text layer + annotation layer links in parallel
  const [parsed, annotationLinks] = await Promise.all([
    pdfParse(buffer).catch(err => {
      console.warn('[Resume Parse] ⚠️ pdfParse failed (non-critical):', err.message);
      return { text: '', numpages: 1 };
    }),
    extractPdfAnnotationLinks(buffer),
  ]);

  let text = parsed.text || '';
  const numPages = parsed.numpages || 1;

  if (annotationLinks.length > 0) {
    const linkBlock = '\n\n[LINKS FROM DOCUMENT ANNOTATIONS]\n' + annotationLinks.join('\n');
    text = text + linkBlock;
    console.log(`[Resume Parse] 🔗 Injected ${annotationLinks.length} annotation link(s):`, annotationLinks);
  }

  const lines = cleanLines(text);
  const sections = extractSections(lines);
  const contact = extractContact(text);

  // Tier 1: Try Gemini Multimodal directly with the PDF buffer
  let geminiStructured = null;
  if (config.geminiApiKey) {
    try {
      const extraContext = annotationLinks.length > 0 ? `Hyperlinks detected in document: ${annotationLinks.join(', ')}` : '';
      geminiStructured = await geminiService.parseResumePdf(buffer, extraContext);
    } catch (err) {
      console.warn('[Resume Parse] ⚠️ Gemini Multimodal parse failed:', err.message);
    }
  }

  if (geminiStructured) {
    const method = geminiStructured.extractionMethod || 'gemini-multimodal';
    const structured = normalizeLlmStructured(
      geminiStructured,
      text,
      lines,
      sections,
      contact,
      method
    );

    console.log(`[Resume Parse] 🎯 Parsing Completed!`);
    console.log(`  • Extraction Method: [${structured.extractionMethod || method}]`);
    console.log(`  • Candidate Name:    "${structured.personal?.fullName || 'Not detected'}"`);
    console.log(`  • Headline / Role:   "${structured.personal?.headline || 'Not detected'}"`);
    console.log(`  • Sections Summary:  ${structured.experience?.length || 0} exp, ${structured.education?.length || 0} edu, ${structured.projects?.length || 0} projects, ${structured.skills?.raw?.length || 0} skills`);

    return assembleAnalysisResult(text, lines, sections, contact, structured, numPages);
  }

  console.log('[Resume Parse] 🔄 Falling back from Multimodal to Text Analysis pipeline...');
  // Tier 2 & 3: Fall back to text analysis (Gemini text, Groq, or deterministic regex)
  return await analyseText(text, numPages);
}

module.exports = { analysePdf, analyseText };
