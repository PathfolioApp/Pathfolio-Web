// Shared by the Studio preview/export and the API's saved-resume downloads.
import { categorizeSkill } from './skillCategories.mjs';

export const DENSITY_LIMITS = { compact: 895, condense: 940 };
export function getSavedLayout(data) {
  const layout = data?.studioLayout;
  if (!layout || layout.version !== 1) return null;
  return {
    version: 1,
    template: ['classic', 'modern', 'compact', 'technical', 'editorial'].includes(layout.template) ? layout.template : 'classic',
    isCompact: layout.isCompact === true,
    condenseDesc: layout.condenseDesc === true,
  };
}

export const DEFAULT_SECTION_ORDER = [
  'summary',
  'skills',
  'experience',
  'projects',
  'education',
  'certifications',
  'achievements',
  'leadership',
];

export function getValidSectionOrder(customOrder) {
  if (!Array.isArray(customOrder) || customOrder.length === 0) {
    return [...DEFAULT_SECTION_ORDER];
  }
  const filtered = customOrder.filter(k => k !== 'personal' && DEFAULT_SECTION_ORDER.includes(k));
  for (const s of DEFAULT_SECTION_ORDER) {
    if (!filtered.includes(s)) {
      filtered.push(s);
    }
  }
  return filtered;
}

const DATE_PATTERN = /(?:[A-Z][a-z]{2,9}\.?\s+)?(?:19|20)\d{2}(?:\s*(?:[\/-]|–|—|to)\s*(?:(?:[A-Z][a-z]{2,9}\.?\s+)?(?:19|20)\d{2}|present|current))?|(?:0?[1-9]|1[0-2])[\/-](?:19|20)\d{2}/i;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatIsoDateStr(str) {
  if (!str) return '';
  const s = String(str).trim();
  const rangeMatch = s.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?\s*(?:[-–—]|to)\s*(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/i);
  if (rangeMatch) {
    const y1 = rangeMatch[1], m1 = parseInt(rangeMatch[2], 10);
    const y2 = rangeMatch[3], m2 = parseInt(rangeMatch[4], 10);
    if (m1 >= 1 && m1 <= 12 && m2 >= 1 && m2 <= 12) {
      return `${MONTH_NAMES[m1 - 1]} ${y1} – ${MONTH_NAMES[m2 - 1]} ${y2}`;
    }
  }
  const toPresentMatch = s.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?\s*(?:[-–—]|to)\s*(present|current)$/i);
  if (toPresentMatch) {
    const y1 = toPresentMatch[1], m1 = parseInt(toPresentMatch[2], 10);
    if (m1 >= 1 && m1 <= 12) {
      return `${MONTH_NAMES[m1 - 1]} ${y1} – Present`;
    }
  }
  const singleMatch = s.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/);
  if (singleMatch) {
    const y = singleMatch[1], m = parseInt(singleMatch[2], 10);
    if (m >= 1 && m <= 12) return `${MONTH_NAMES[m - 1]} ${y}`;
  }
  return s;
}

function unbundleEducation(eduItems) {
  if (!Array.isArray(eduItems) || eduItems.length === 0) return eduItems || [];

  const result = [];
  const extracted = [];

  for (const item of eduItems) {
    if (!item) continue;
    const bullets = Array.isArray(item.bullets) ? [...item.bullets] : [];
    const remainingBullets = [];

    for (const bullet of bullets) {
      const b = String(bullet || '').trim();
      const isTwelfth = /^Class\s+(?:XII|12(?:th)?)\b/i.test(b);
      const isTenth = /^Class\s+(?:X|10(?:th)?)\b/i.test(b);

      if (isTwelfth) {
        let institution = '';
        let details = '';

        const dashColon = b.match(/^Class\s+(?:XII|12(?:th)?)[^:\-–—]*[-–—]\s*([^:]+)(?::\s*(.*))?$/i);
        if (dashColon) {
          institution = dashColon[1]?.trim() || '';
          details = dashColon[2]?.trim() || '';
        } else {
          const colonMatch = b.match(/^Class\s+(?:XII|12(?:th)?)[^:]*:\s*(.*)$/i);
          if (colonMatch) details = colonMatch[1]?.trim() || '';
        }

        const parenMatch = institution.match(/^(.*?)\s*\((.*?)\)$/);
        if (parenMatch && parenMatch[1] && parenMatch[2]) {
          institution = `${parenMatch[2].trim()} (${parenMatch[1].trim()})`;
        }

        let desc = details;
        if (desc) {
          desc = desc.replace(/\s*[-–—]\s*/g, ' · ');
          if (!/^percentage/i.test(desc) && !/^score/i.test(desc) && !/^gpa/i.test(desc)) {
            desc = `Percentage: ${desc}`;
          }
        }

        extracted.push({
          id: `edu_twelfth_${Date.now()}`,
          title: 'Class XII (Senior Secondary)',
          institution: institution,
          company: institution,
          dates: '',
          description: desc,
          bullets: [],
        });
      } else if (isTenth) {
        let institution = '';
        let details = '';

        const dashColon = b.match(/^Class\s+(?:X|10(?:th)?)[^:\-–—]*[-–—]\s*([^:]+)(?::\s*(.*))?$/i);
        if (dashColon) {
          institution = dashColon[1]?.trim() || '';
          details = dashColon[2]?.trim() || '';
        } else {
          const colonMatch = b.match(/^Class\s+(?:X|10(?:th)?)[^:]*:\s*(.*)$/i);
          if (colonMatch) details = colonMatch[1]?.trim() || '';
        }

        const parenMatch = institution.match(/^(.*?)\s*\((.*?)\)$/);
        if (parenMatch && parenMatch[1] && parenMatch[2]) {
          institution = `${parenMatch[2].trim()} (${parenMatch[1].trim()})`;
        }

        let desc = details;
        if (desc) {
          desc = desc.replace(/\s*[-–—]\s*/g, ' · ');
          if (!/^percentage/i.test(desc) && !/^score/i.test(desc) && !/^gpa/i.test(desc)) {
            desc = `Percentage: ${desc}`;
          }
        }

        extracted.push({
          id: `edu_tenth_${Date.now()}`,
          title: 'Class X (Secondary)',
          institution: institution,
          company: institution,
          dates: '',
          description: desc,
          bullets: [],
        });
      } else {
        remainingBullets.push(bullet);
      }
    }

    result.push({
      ...item,
      bullets: remainingBullets,
    });
  }

  for (const ext of extracted) {
    const isTwelfth = /XII|12/i.test(ext.title);
    const exists = result.some(r => isTwelfth ? /XII|12/i.test(r.title || '') : /Class\s+(?:X|10)\b/i.test(r.title || ''));
    if (!exists) {
      result.push(ext);
    }
  }

  return result;
}

export function isCandidateProfileLink(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase().trim();
  if (lower.includes('coursera.org') || lower.includes('verify')) return false;
  if (lower.includes('huggingface.co/spaces')) return false;
  if (lower.includes('github.com/')) {
    const cleanPath = lower.replace(/^https?:\/\//, '').replace(/^www\./, '').split('?')[0].split('#')[0];
    const segments = cleanPath.split('/').filter(Boolean);
    return segments.length <= 2; // candidate github.com/username only, not repo
  }
  return !lower.includes('live') && !lower.includes('demo') && !lower.includes('store');
}

export function normalizeExtractedData(source, profileData) {
  const data = source && typeof source === 'object' ? source : {};
  const records = key => Array.isArray(data[key]) ? data[key].filter(item => item && typeof item === 'object' && !Array.isArray(item)).map(item => {
    const originalTitle = item.title || item.role || item.company || item.institution || item.name || '';
    const sourceText = `${originalTitle} ${item.raw || ''}`;
    const rawDates = item.dates || sourceText.match(DATE_PATTERN)?.[0] || '';
    const dates = formatIsoDateStr(rawDates);
    return {
      ...item,
      title: dates ? originalTitle.replace(DATE_PATTERN, '').trim() || originalTitle : originalTitle,
      dates,
      description: item.description || item.summary || '',
      bullets: Array.isArray(item.bullets) ? item.bullets : [],
    };
  }) : [];

  const formatLink = l => {
    if (!l) return '';
    const s = String(typeof l === 'object' ? l.url || '' : l).trim().replace(/[.,;)]+$/, '');
    if (!s) return '';
    const url = /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, '')}`;
    return typeof l === 'object' ? { ...l, url } : url;
  };
  const linkUrl = l => typeof l === 'object' ? l.url : l;

  const rawLinks = [
    ...(Array.isArray(data.personal?.links) ? data.personal.links : []),
    data.personal?.linkedin,
    data.personal?.github,
    data.personal?.portfolio,
    data.personal?.leetcode,
    data.personal?.codeforces,
    data.personal?.hackerrank,
  ].filter(Boolean)
   .map(formatLink)
   .filter(l => isCandidateProfileLink(linkUrl(l)))
   .filter((l, i, arr) => arr.findIndex(item => linkUrl(item) === linkUrl(l)) === i);

  const s = data.skills && typeof data.skills === 'object' ? data.skills : {};
  let languages = Array.isArray(s.languages) && s.languages.length ? s.languages : (Array.isArray(s.programming) ? s.programming : []);
  let frameworks = Array.isArray(s.frameworks) ? s.frameworks : [];
  let cloudDevOps = Array.isArray(s.cloudDevOps) && s.cloudDevOps.length ? s.cloudDevOps : (Array.isArray(s.cloudDevops) ? s.cloudDevops : []);
  let databasesTools = Array.isArray(s.databasesTools) && s.databasesTools.length
    ? s.databasesTools
    : [...(Array.isArray(s.data) ? s.data : []), ...(Array.isArray(s.tools) ? s.tools : []), ...(Array.isArray(s.other) ? s.other : [])];
  let coreConcepts = Array.isArray(s.coreConcepts) && s.coreConcepts.length
    ? s.coreConcepts
    : (Array.isArray(s.concepts) ? s.concepts : []);

  let rawSkills = Array.isArray(s.raw) && s.raw.length
    ? s.raw
    : [...languages, ...frameworks, ...cloudDevOps, ...databasesTools, ...coreConcepts];

  if (!languages.length && !frameworks.length && !cloudDevOps.length && !databasesTools.length && !coreConcepts.length && rawSkills.length) {
    const langSet = new Set();
    const fwSet = new Set();
    const cdSet = new Set();
    const dtSet = new Set();
    const ccSet = new Set();
    for (const skill of rawSkills) {
      const cat = categorizeSkill(skill);
      if (cat === 'languages') langSet.add(skill);
      else if (cat === 'frameworks') fwSet.add(skill);
      else if (cat === 'cloudDevOps') cdSet.add(skill);
      else if (cat === 'coreConcepts') ccSet.add(skill);
      else dtSet.add(skill);
    }
    languages = Array.from(langSet);
    frameworks = Array.from(fwSet);
    cloudDevOps = Array.from(cdSet);
    databasesTools = Array.from(dtSet);
    coreConcepts = Array.from(ccSet);
  }

  const dedupe = list => Array.from(new Set((list || []).map(item => String(item).trim()).filter(Boolean)));
  languages = dedupe(languages);
  frameworks = dedupe(frameworks);
  cloudDevOps = dedupe(cloudDevOps);
  databasesTools = dedupe(databasesTools);
  coreConcepts = dedupe(coreConcepts);
  rawSkills = dedupe(rawSkills.length ? rawSkills : [...languages, ...frameworks, ...cloudDevOps, ...databasesTools, ...coreConcepts]);

  return {
    personal: {
      fullName: data.personal?.fullName || '',
      email: data.personal?.email || '',
      phone: data.personal?.phone || '',
      headline: data.personal?.headline || '',
      location: data.personal?.location || '',
      links: rawLinks,
      linkedin: data.personal?.linkedin || '',
      github: data.personal?.github || '',
      portfolio: data.personal?.portfolio || '',
      leetcode: data.personal?.leetcode || '',
      codeforces: data.personal?.codeforces || '',
      hackerrank: data.personal?.hackerrank || '',
    },
    summary: { text: data.summary?.text || '' },
    education: unbundleEducation(records('education'), profileData),
    experience: records('experience'),
    projects: records('projects'),
    certifications: records('certifications'),
    achievements: records('achievements'),
    leadership: records('leadership'),
    skills: {
      languages,
      frameworks,
      cloudDevOps,
      databasesTools,
      coreConcepts,
      programming: languages,
      cloudDevops: cloudDevOps,
      data: databasesTools,
      concepts: coreConcepts,
      raw: rawSkills,
    },
    documentLinks: Array.isArray(data.documentLinks) ? data.documentLinks.filter(l => typeof l === 'string' && /^https?:\/\//i.test(l)) : [],
    sectionOrder: getValidSectionOrder(data.sectionOrder),
    ...(getSavedLayout(data) ? { studioLayout: getSavedLayout(data) } : {}),
  };
}

function value(item, keys) {
  for (const key of keys) {
    if (item?.[key]) return item[key];
  }
  return '';
}

function recordDates(item) {
  return item?.dates || item?.date || item?.year || '';
}

function recordSubMeta(item) {
  const title = value(item, ['title', 'role', 'name', 'projectName', 'degreeProgram']);
  const organization = value(item, ['issuer', 'company', 'institution', 'organization']);
  const location = item?.location || '';

  const parts = [];
  if (organization && organization !== title) parts.push(organization);
  if (location) parts.push(location);

  return parts.filter(Boolean).join(' · ');
}

function recordMeta(item) {
  const sub = recordSubMeta(item);
  const dates = recordDates(item);
  return [sub, dates].filter(Boolean).join(' · ');
}

function recordDescription(item) {
  if (item?.description || item?.summary) return item.description || item.summary;
  return item?.bullets?.length ? '' : item?.raw || '';
}

function formatEducationEntry(item) {
  const dates = formatIsoDateStr(recordDates(item));
  let institution = item.institution || item.school || item.college || item.university || '';
  let degree = item.degreeProgram || item.degree || item.qualification || '';
  let title = item.title || item.name || '';
  let location = item.location || '';
  let rawDesc = String(recordDescription(item) || '');

  // Clean redundant wordings
  let cleanDesc = rawDesc
    .replace(/Cumulative GPA:\s*/gi, 'CGPA: ')
    .replace(/Percentage:\s*/gi, '')
    .replace(/Stream:\s*/gi, '')
    .replace(/Class XII \(Senior Secondary\)/gi, 'Class XII')
    .replace(/Class X \(Secondary\)/gi, 'Class X')
    .trim();

  let cleanTitle = String(title || '')
    .replace(/Class XII \(Senior Secondary\)/gi, 'Class XII')
    .replace(/Class X \(Secondary\)/gi, 'Class X')
    .trim();

  let cleanDegree = String(degree || '')
    .replace(/Class XII \(Senior Secondary\)/gi, 'Class XII')
    .replace(/Class X \(Secondary\)/gi, 'Class X')
    .trim();

  let topTitle = institution;
  let degreeLine = cleanDegree || '';

  if (!topTitle) {
    topTitle = cleanTitle || degreeLine || '';
  } else if (cleanTitle && cleanTitle.toLowerCase() !== topTitle.toLowerCase()) {
    if (!degreeLine) {
      degreeLine = cleanTitle;
    }
  }

  // Deduplicate degree line from cleanDesc if cleanDesc contains it or starts with it
  if (degreeLine && cleanDesc) {
    if (cleanDesc.toLowerCase().startsWith(degreeLine.toLowerCase())) {
      cleanDesc = cleanDesc.slice(degreeLine.length).replace(/^[\s·\-,|]+/, '').trim();
    } else if (cleanDesc.toLowerCase() === degreeLine.toLowerCase()) {
      cleanDesc = '';
    } else if (cleanDesc.toLowerCase().includes(degreeLine.toLowerCase())) {
      cleanDesc = cleanDesc.replace(new RegExp(degreeLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').replace(/^[\s·\-,|]+|[\s·\-,|]+$/g, '').trim();
    }
  }

  const subParts = [];
  if (degreeLine) {
    subParts.push(degreeLine);
  }
  if (cleanDesc && !degreeLine.toLowerCase().includes(cleanDesc.toLowerCase()) && !subParts.some(p => p.toLowerCase().includes(cleanDesc.toLowerCase()))) {
    subParts.push(cleanDesc);
  }

  return {
    topTitle,
    subLine: subParts.join(' · '),
    location,
    dates,
  };
}

function formatExperienceHeader(item) {
  const role = value(item, ['role', 'title', 'position']) || 'Experience';
  const company = value(item, ['company', 'organization', 'institution', 'companyName']);
  const location = item.location || '';
  const dates = formatIsoDateStr(recordDates(item));

  const metaParts = [];
  if (company && company.trim().toLowerCase() !== role.trim().toLowerCase()) {
    metaParts.push(company.trim());
  }
  if (location && location.trim()) {
    metaParts.push(location.trim());
  }

  return {
    role,
    metaText: metaParts.join(' · '),
    dates,
  };
}

function ensureUrl(url) {
  if (!url) return '';
  const str = String(url).trim();
  if (/^https?:\/\//i.test(str)) return str;
  return `https://${str}`;
}

export function formatPlatformLabel(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  const lower = trimmed.toLowerCase();

  // Social & professional platform recognition
  if (lower.includes('linkedin.com')) return 'LinkedIn';
  if (lower.includes('github.com')) return 'GitHub';
  if (lower.includes('leetcode.com')) return 'LeetCode';
  if (lower.includes('codolio.com')) return 'Codolio';
  if (lower.includes('codeforces.com')) return 'Codeforces';
  if (lower.includes('codechef.com')) return 'CodeChef';
  if (lower.includes('hackerrank.com')) return 'HackerRank';
  if (lower.includes('hackerearth.com')) return 'HackerEarth';
  if (lower.includes('kaggle.com')) return 'Kaggle';
  if (lower.includes('geeksforgeeks.org') || lower.includes('gfg')) return 'GeeksforGeeks';
  if (lower.includes('gitlab.com')) return 'GitLab';
  if (lower.includes('bitbucket.org')) return 'Bitbucket';
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'Twitter';
  if (lower.includes('medium.com')) return 'Medium';
  if (lower.includes('dev.to')) return 'Dev.to';
  if (lower.includes('behance.net')) return 'Behance';
  if (lower.includes('dribbble.com')) return 'Dribbble';
  if (lower.includes('stackoverflow.com')) return 'Stack Overflow';
  if (lower.includes('portfolio') || lower.includes('resume') || lower.includes('about')) return 'Portfolio';

  // Personal website / portfolio detection
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.replace(/^www\./, '');
    if (
      host.endsWith('.dev') ||
      host.endsWith('.me') ||
      host.endsWith('.tech') ||
      host.endsWith('.site') ||
      host.endsWith('.page') ||
      host.endsWith('.live') ||
      host.endsWith('.app') ||
      host.includes('vercel.app') ||
      host.includes('netlify.app') ||
      host.includes('github.io') ||
      host.includes('pages.dev')
    ) {
      return 'Portfolio';
    }
    return host;
  } catch {
    return 'Portfolio';
  }
}

function getRepoLabel(url) {
  if (!url) return 'GitHub';
  const lower = String(url).toLowerCase();
  if (lower.includes('gitlab')) return 'GitLab';
  if (lower.includes('bitbucket')) return 'Bitbucket';
  return 'GitHub';
}

function getProjectLinks(item) {
  let liveUrl = item.liveUrl || item.projectUrl || item.deployedUrl || item.demoUrl || item.website || '';
  let repoUrl = item.repoUrl || item.githubUrl || item.github || '';

  // If liveUrl actually points to a git repo, shift to repoUrl
  if (liveUrl && (liveUrl.includes('github.com') || liveUrl.includes('gitlab') || liveUrl.includes('bitbucket'))) {
    if (!repoUrl) {
      repoUrl = liveUrl;
      liveUrl = '';
    }
  }

  // If repoUrl does not point to a git repo and liveUrl is empty, shift to liveUrl
  if (repoUrl && !repoUrl.includes('github.com') && !repoUrl.includes('gitlab') && !repoUrl.includes('bitbucket')) {
    if (!liveUrl) {
      liveUrl = repoUrl;
      repoUrl = '';
    }
  }

  if (item.url) {
    const u = String(item.url).trim();
    const lower = u.toLowerCase();
    if (lower.includes('github.com') || lower.includes('gitlab') || lower.includes('bitbucket')) {
      if (!repoUrl) repoUrl = u;
    } else {
      if (!liveUrl) liveUrl = u;
    }
  }

  if ((!liveUrl || !repoUrl) && Array.isArray(item.links)) {
    for (const l of item.links) {
      const u = typeof l === 'string' ? l : l?.url || '';
      if (!u) continue;
      const lower = u.toLowerCase();
      if (lower.includes('github.com') || lower.includes('gitlab') || lower.includes('bitbucket')) {
        if (!repoUrl) repoUrl = u;
      } else {
        if (!liveUrl) liveUrl = u;
      }
    }
  }
  return { liveUrl, repoUrl };
}

function formatLinkDisplay(url) {
  return formatPlatformLabel(url);
}

function printable(data, template, isCompact = false, docTitle = '', condenseDesc = false, autoDensity = false) {
  const escapeHtml = input => String(input || '').replace(/[&<>\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char]));
  const personal = data.personal || {};
  const skillsObj = data.skills || {};

  const hasCategories = Boolean(
    (skillsObj.languages?.length || 0) +
    (skillsObj.frameworks?.length || 0) +
    (skillsObj.cloudDevOps?.length || 0) +
    (skillsObj.databasesTools?.length || 0) +
    (skillsObj.coreConcepts?.length || 0)
  );

  let skillsBlock = '';
  if (hasCategories) {
    const cats = [];
    if (skillsObj.languages?.length) cats.push(`<p><b>Languages:</b> ${escapeHtml(skillsObj.languages.join(', '))}</p>`);
    if (skillsObj.frameworks?.length) cats.push(`<p><b>Frameworks & Libraries:</b> ${escapeHtml(skillsObj.frameworks.join(', '))}</p>`);
    if (skillsObj.cloudDevOps?.length) cats.push(`<p><b>Cloud & DevOps:</b> ${escapeHtml(skillsObj.cloudDevOps.join(', '))}</p>`);
    if (skillsObj.databasesTools?.length) cats.push(`<p><b>Databases & Tools:</b> ${escapeHtml(skillsObj.databasesTools.join(', '))}</p>`);
    if (skillsObj.coreConcepts?.length) cats.push(`<p><b>Core Concepts:</b> ${escapeHtml(skillsObj.coreConcepts.join(', '))}</p>`);
    skillsBlock = `<section><h2>Technical Skills</h2>${cats.join('')}</section>`;
  } else if (skillsObj.raw?.length) {
    skillsBlock = `<section><h2>Technical Skills</h2><p>${escapeHtml(skillsObj.raw.join(' | '))}</p></section>`;
  }

  const block = (key, title) => data[key]?.length ? `<section><h2>${title}</h2>${data[key].map(item => {
    let projectLinks = '';
    if (key === 'projects') {
      const pl = getProjectLinks(item);
      if (pl.liveUrl) {
        projectLinks += `<span class="proj-link proj-link--live"><a href="${escapeHtml(ensureUrl(pl.liveUrl))}" target="_blank">Live</a></span>`;
      }
      if (pl.repoUrl && pl.repoUrl !== pl.liveUrl) {
        projectLinks += `<span class="proj-link proj-link--repo"><a href="${escapeHtml(ensureUrl(pl.repoUrl))}" target="_blank">${escapeHtml(getRepoLabel(pl.repoUrl))}</a></span>`;
      }
    }

    if (key === 'education') {
      const edu = formatEducationEntry(item);
      const locContent = edu.location ? ` <span class="role-meta">· ${escapeHtml(edu.location)}</span>` : '';
      const leftContent = `<div class="entry-left"><b>${escapeHtml(edu.topTitle)}</b>${locContent}</div>`;
      const dateContent = edu.dates ? `<span class="entry-date">${escapeHtml(edu.dates)}</span>` : '';
      const titleRow = `<div class="entry-title-row">${leftContent}${dateContent}</div>`;
      return `
      <div class="entry">
        ${titleRow}
        ${edu.subLine ? `<span class="entry-sub">${escapeHtml(edu.subLine)}</span>` : ''}
        ${item.bullets?.length ? `<ul>${item.bullets.map(bullet => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>` : ''}
      </div>`;
    }

    if (key === 'experience') {
      const exp = formatExperienceHeader(item);
      const leftContent = `<div class="entry-left"><b>${escapeHtml(exp.role)}</b>${exp.metaText ? ` <span class="role-meta">· ${escapeHtml(exp.metaText)}</span>` : ''}</div>`;
      const dateContent = exp.dates ? `<span class="entry-date">${escapeHtml(exp.dates)}</span>` : '';
      const titleRow = `<div class="entry-title-row">${leftContent}${dateContent}</div>`;
      const descHtml = recordDescription(item) ? `<p>${escapeHtml(recordDescription(item))}</p>` : '';
      const bulletsHtml = item.bullets?.length ? `<ul>${item.bullets.map(bullet => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>` : '';
      return `
      <div class="entry">
        ${titleRow}
        ${descHtml}
        ${bulletsHtml}
      </div>`;
    }

    if (key === 'projects') {
      const titleVal = escapeHtml(value(item, ['title', 'name', 'projectName']) || 'Project');
      const datesVal = escapeHtml(recordDates(item));
      const leftContent = `<div class="entry-left"><b>${titleVal}</b>${projectLinks}</div>`;
      const dateContent = datesVal ? `<span class="entry-date">${datesVal}</span>` : '';
      const titleRow = `<div class="entry-title-row">${leftContent}${dateContent}</div>`;
      const techHtml = item.technologies ? `<p class="tech"><b>Tech Stack:</b> ${escapeHtml(item.technologies)}</p>` : '';
      const descHtml = recordDescription(item) ? `<p>${escapeHtml(recordDescription(item))}</p>` : '';
      const bulletsHtml = item.bullets?.length ? `<ul>${item.bullets.map(bullet => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>` : '';
      return `
      <div class="entry">
        ${titleRow}
        ${techHtml}
        ${descHtml}
        ${bulletsHtml}
      </div>`;
    }

    const titleVal = escapeHtml(value(item, ['title', 'role', 'company', 'institution', 'name', 'degreeProgram', 'projectName']) || 'Entry');
    const datesVal = escapeHtml(recordDates(item));
    const subMetaVal = escapeHtml(recordSubMeta(item));
    const leftContent = `<div class="entry-left"><b>${titleVal}</b>${projectLinks}</div>`;
    const dateContent = datesVal ? `<span class="entry-date">${datesVal}</span>` : '';
    const titleRow = `<div class="entry-title-row">${leftContent}${dateContent}</div>`;
    const hideDesc = ((key === 'certifications' || key === 'achievements' || key === 'leadership') && condenseDesc) || (key === 'certifications' && isCompact);
    return `
    <div class="entry">
      ${titleRow}
      ${subMetaVal ? `<span class="entry-sub">${subMetaVal}</span>` : ''}
      ${item.technologies ? `<p class="tech"><b>Tech Stack:</b> ${escapeHtml(item.technologies)}</p>` : ''}
      ${hideDesc ? '' : (recordDescription(item) ? `<p${['certifications', 'achievements', 'leadership'].includes(key) ? ` class="condensable-description${key === 'certifications' ? ' certification-description' : ''}"` : ''}>${escapeHtml(recordDescription(item))}</p>` : '')}
      ${item.bullets?.length ? `<ul>${item.bullets.map(bullet => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>` : ''}
    </div>`;
  }).join('')}</section>` : '';

  const contactLine = [personal.email, personal.phone, personal.location].filter(Boolean).map(escapeHtml).join(' | ');
  const linksLine = (personal.links || [])
    .map(l => {
      const url = typeof l === 'string' ? l : l?.url || '';
      if (!url) return '';
      const label = (typeof l === 'object' && (l?.label || l?.name || l?.platform))
        ? (l.label || l.name || l.platform)
        : formatPlatformLabel(url);
      return `<a href="${escapeHtml(ensureUrl(url))}" target="_blank">${escapeHtml(label)}</a>`;
    })
    .filter(Boolean)
    .join('<span class="link-sep"> | </span>');

  const sectionOrder = getValidSectionOrder(data.sectionOrder);
  const renderedSectionsHtml = sectionOrder.map(secKey => {
    switch (secKey) {
      case 'summary':
        return data.summary?.text ? `<section><h2>Professional Summary</h2><p>${escapeHtml(data.summary.text)}</p></section>` : '';
      case 'skills':
        return skillsBlock;
      case 'experience':
        return block('experience', 'Experience');
      case 'projects':
        return block('projects', 'Projects');
      case 'education':
        return block('education', 'Education');
      case 'certifications':
        return block('certifications', 'Certifications');
      case 'achievements':
        return block('achievements', 'Achievements & Awards');
      case 'leadership':
        return block('leadership', 'Leadership & Activities');
      default:
        return '';
    }
  }).filter(Boolean).join('\n');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(docTitle || personal.fullName || 'Resume')}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm 18mm; }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #1d2921;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 8.8pt;
      line-height: 1.34;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    /* Native page margins repeat without creating printable spacer rows. */
    body { width: 174mm; }
    .is-condensed .condensable-description,
    .is-compact .certification-description { display: none; }
    .resume {
      width: 100%;
      margin: 0;
      padding: 0;
    }
    .head {
      text-align: center;
      border-bottom: 1.5pt solid #264e36;
      padding-bottom: 5pt;
      margin-bottom: 8pt;
    }
    .head h1 {
      font-size: 19pt;
      line-height: 1.15;
      margin: 0 0 2pt;
      color: #1d2921;
    }
    .head p {
      margin: 1.5pt 0;
      color: #4a594f;
      font-size: 8.4pt;
      line-height: 1.3;
      word-break: break-word;
    }
    .head a { color: #264e36; text-decoration: none; font-weight: 500; }
    .head strong {
      color: #264e36;
      font-size: 8.8pt;
      display: block;
      margin-top: 2pt;
    }
    .head-links {
      margin: 2pt 0;
      font-size: 8.4pt;
    }
    .link-sep {
      color: #829185;
      margin: 0 2.5pt;
      font-weight: 300;
    }
    section {
      margin-top: 7.5pt;
      page-break-inside: auto;
      break-inside: auto;
    }
    h2 {
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #264e36;
      border-bottom: 0.75pt solid #cbd6c8;
      padding-bottom: 1.5pt;
      margin: 0 0 3.5pt;
      page-break-after: avoid;
      break-after: avoid;
    }
    .entry {
      margin-bottom: 4.5pt;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .entry b { font-size: 8.8pt; color: #1d2921; line-height: 1.25; }
    .entry-title-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8pt;
      width: 100%;
      margin-bottom: 1pt;
    }
    .entry-left {
      display: flex;
      align-items: baseline;
      gap: 5pt;
      flex-wrap: wrap;
      flex: 1 1 auto;
      min-width: 0;
    }
    .entry-left b {
      display: inline;
      font-size: 8.8pt;
      color: #1d2921;
      line-height: 1.25;
    }
    .entry-date {
      font-size: 8.2pt;
      color: #4a594f;
      white-space: nowrap;
      flex-shrink: 0;
      text-align: right;
      margin-left: auto;
      font-weight: 400;
    }
    .entry-sub {
      font-size: 8pt;
      color: #55665a;
      display: block;
      margin-bottom: 1pt;
    }
    .proj-link {
      display: inline-flex;
      align-items: baseline;
    }
    .proj-link a {
      font-size: 7.4pt;
      font-weight: 600;
      color: #264e36;
      text-decoration: none;
      border: 0.75pt solid #cbd6c8;
      padding: 0.5pt 3.5pt;
      border-radius: 2pt;
      background: #f7faf7;
      vertical-align: middle;
      line-height: 1.2;
    }
    .entry p { margin: 1.5pt 0; font-size: 8.4pt; line-height: 1.3; }
    .role-meta {
      font-weight: 400;
      color: #4a594f;
      font-size: 8.4pt;
    }
    .tech { font-size: 8pt; color: #264e36; margin: 1pt 0; }
    ul { margin: 1.5pt 0 3pt 13pt; padding: 0; }
    li { font-size: 8.4pt; line-height: 1.32; margin-bottom: 1pt; }
    /* Template Specifics */
    .modern .head { text-align: left; background: #edf4ee !important; padding: 8pt 10pt; border-radius: 4px; border: 0; }
    .modern h2, .technical h2 { color: #8b4f25; border-color: #e1c8b8; }
    .modern .head a { color: #264e36; }
    .modern .entry-date { color: #6b5d54; }
    .modern .role-meta, .technical .role-meta { color: #6b5d54; }
    .modern .tech, .technical .tech { color: #8b4f25; }
    .modern .proj-link a {
      color: #8b4f25;
      border-color: #e1c8b8;
      background: #faf5f1;
      border-radius: 3pt;
    }
    .compact { font-size: 8pt; }
    .compact section { margin-top: 5pt; }
    .compact .entry { margin-bottom: 3pt; }
    .compact .head-links { font-size: 7.8pt; }
    .compact .entry-date { font-size: 7.5pt; }
    .compact .role-meta { font-size: 8pt; }
    .compact .proj-link a { font-size: 6.8pt; padding: 0.25pt 2.5pt; }
    .is-compact { font-size: 8.3pt !important; line-height: 1.28 !important; }
    .is-compact .head { padding-bottom: 3.5pt !important; margin-bottom: 5pt !important; }
    .is-compact .head h1 { font-size: 17.5pt !important; margin: 0 0 1.5pt !important; }
    .is-compact .head p { margin: 1pt 0 !important; font-size: 8.1pt !important; line-height: 1.25 !important; }
    .is-compact .head-links { font-size: 7.9pt !important; margin: 1.5pt 0 !important; }
    .is-compact section { margin-top: 5pt !important; }
    .is-compact h2 { font-size: 8.6pt !important; margin: 0 0 2pt !important; padding-bottom: 1pt !important; }
    .is-compact .entry { margin-bottom: 3pt !important; }
    .is-compact .entry b { font-size: 8.4pt !important; }
    .is-compact .entry-date { font-size: 7.8pt !important; }
    .is-compact .entry-sub { font-size: 7.8pt !important; margin-bottom: 0.5pt !important; }
    .is-compact .tech { font-size: 7.8pt !important; margin: 0.5pt 0 !important; }
    .is-compact ul { margin: 1pt 0 2pt 11pt !important; }
    .is-compact li { font-size: 8.1pt !important; line-height: 1.25 !important; margin-bottom: 0.5pt !important; }
    .is-compact .entry p { margin: 1pt 0 !important; font-size: 8.1pt !important; line-height: 1.25 !important; }
    .is-compact .proj-link a { font-size: 7pt !important; padding: 0.5pt 3pt !important; }
    .technical .head { text-align: left; border-left: 4pt solid #8b4f25; border-bottom: 0; padding-left: 8pt; }
    .technical .head a { color: #264e36; font-weight: 600; }
    .technical .entry-date { font-size: 8pt; color: #55665a; }
    .technical .proj-link a {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 7pt;
      letter-spacing: 0.2px;
      color: #8b4f25;
      border-color: #e1c8b8;
      background: #faf5f1;
    }
    .editorial { font-family: Georgia, serif; }
    .editorial h2 { font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; }
    .editorial .head-links { font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; font-size: 8pt; }
    .editorial .head a { color: #264e36; }
    .editorial .role-meta { color: #555555; }
    .editorial .entry-date { font-family: Georgia, serif; font-size: 8.2pt; color: #4a594f; }
    .editorial .proj-link a {
      font-family: Georgia, serif;
      font-style: italic;
      color: #264e36;
      border-color: #cbd6c8;
      background: #fafbf9;
    }
  </style>
</head>
<body>
          <main data-auto-density="${autoDensity}" class="resume ${template} ${isCompact ? 'is-compact' : ''}">
            <header class="head">
              <h1>${escapeHtml(personal.fullName || 'Candidate')}</h1>
              <p>${contactLine}</p>
              ${linksLine ? `<p class="head-links">${linksLine}</p>` : ''}
              ${personal.headline ? `<strong>${escapeHtml(personal.headline)}</strong>` : ''}
            </header>
            ${renderedSectionsHtml}
          </main>
</body>
</html>`;
}


export { printable, formatIsoDateStr, value, recordDates, recordSubMeta, recordMeta, recordDescription, formatEducationEntry, formatExperienceHeader, ensureUrl, getRepoLabel, getProjectLinks, formatLinkDisplay };
