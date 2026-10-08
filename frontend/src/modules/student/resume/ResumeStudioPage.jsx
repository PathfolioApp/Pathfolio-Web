import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, Check, Download, ExternalLink, FileText, Loader, Plus, RefreshCw, Save, Sparkles, Trash2,
  ChevronDown, ChevronUp, GripVertical, User, Code2, Briefcase, FolderGit2, GraduationCap, Award, Trophy, Users, Eye, ZoomIn, ZoomOut, RotateCcw, Layers,
  Maximize2, Minimize2, Copy, Edit2, X, AlertCircle,
  ChevronLeft, ChevronRight, EyeOff, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { resumeApi } from './resumeApi';
import { profileApi } from '../profile/services/profileApi';
import { profileToResumeData, categorizeSkill } from './profileToResumeData';
import { PdfIcon } from '../../../components/ui/PdfIcon';
import AiToast from '../../../components/ui/AiToast';
import './ResumeStudioPage.css';
import './ResumeStudioFields.css';

const SECTION_CONFIG = {
  personal: { label: 'Personal Info & Links', icon: User, desc: 'Contact details, target role headline, portfolio links, and location.' },
  summary: { label: 'Executive Summary', icon: FileText, desc: 'High-impact overview highlighting core strengths, internships, and tech focus.' },
  skills: { label: 'Skills & Tech Stack', icon: Code2, desc: 'Languages, frameworks, developer tools, and database proficiencies.' },
  experience: { label: 'Work Experience', icon: Briefcase, desc: 'Internships and engineering roles with quantifiable impact bullets.' },
  projects: { label: 'Key Projects', icon: FolderGit2, desc: 'Software and systems built with live URLs, GitHub repos, and architecture notes.' },
  education: { label: 'Education', icon: GraduationCap, desc: 'Degree, university, branch, CGPA, and key coursework.' },
  certifications: { label: 'Certifications', icon: Award, desc: 'Industry certifications, AWS/GCP credentials, and certificates.' },
  achievements: { label: 'Achievements & Awards', icon: Trophy, desc: 'Hackathons, coding contests, rankings, and academic accolades.' },
  leadership: { label: 'Leadership & Activities', icon: Users, desc: 'Club leadership, organizing events, student representation, and mentoring.' },
};

const TEMPLATES = [
  ['classic', 'Classic', 'Traditional single column · ATS standard'],
  ['modern', 'Modern', 'Clean hierarchy & accents'],
  ['compact', 'Compact', 'High density one-pager'],
  ['technical', 'Technical', 'Skills & engineering forward'],
  ['editorial', 'Editorial', 'Refined typography'],
];

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

const SECTIONS = [
  'personal',
  ...DEFAULT_SECTION_ORDER,
];

const RECORD_SECTIONS = ['education', 'experience', 'projects', 'certifications', 'achievements', 'leadership'];
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

function unbundleEducation(eduItems, profileData) {
  if (!Array.isArray(eduItems) || eduItems.length === 0) return eduItems || [];

  const academic = profileData?.academic || {};
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
        } else if (!institution && academic.twelfthSchool) {
          institution = academic.twelfthBoard ? `${academic.twelfthSchool} (${academic.twelfthBoard})` : academic.twelfthSchool;
        }

        let desc = details;
        if (desc) {
          desc = desc.replace(/\s*[-–—]\s*/g, ' · ');
          if (!/^percentage/i.test(desc) && !/^score/i.test(desc) && !/^gpa/i.test(desc)) {
            desc = `Percentage: ${desc}`;
          }
        } else if (academic.twelfthPercentage) {
          const pct = String(academic.twelfthPercentage).trim();
          desc = `Percentage: ${pct.endsWith('%') ? pct : `${pct}%`}${academic.twelfthStream ? ` · Stream: ${academic.twelfthStream}` : ''}`;
        }

        extracted.push({
          id: `edu_twelfth_${Date.now()}`,
          title: 'Class XII (Senior Secondary)',
          institution: institution || academic.twelfthSchool || 'Senior Secondary School',
          company: institution || academic.twelfthSchool || 'Senior Secondary School',
          dates: academic.twelfthYear ? String(academic.twelfthYear) : '',
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
        } else if (!institution && academic.tenthSchool) {
          institution = academic.tenthBoard ? `${academic.tenthSchool} (${academic.tenthBoard})` : academic.tenthSchool;
        }

        let desc = details;
        if (desc) {
          desc = desc.replace(/\s*[-–—]\s*/g, ' · ');
          if (!/^percentage/i.test(desc) && !/^score/i.test(desc) && !/^gpa/i.test(desc)) {
            desc = `Percentage: ${desc}`;
          }
        } else if (academic.tenthPercentage) {
          const pct = String(academic.tenthPercentage).trim();
          desc = `Percentage: ${pct.endsWith('%') ? pct : `${pct}%`}`;
        }

        extracted.push({
          id: `edu_tenth_${Date.now()}`,
          title: 'Class X (Secondary)',
          institution: institution || academic.tenthSchool || 'Secondary School',
          company: institution || academic.tenthSchool || 'Secondary School',
          dates: academic.tenthYear ? String(academic.tenthYear) : '',
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
  const records = key => Array.isArray(data[key]) ? data[key].map(item => {
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
    const s = String(l).trim().replace(/[.,;)]+$/, '');
    return /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, '')}`;
  };

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
   .filter(isCandidateProfileLink)
   .filter((l, i, arr) => arr.indexOf(l) === i);

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
    sectionOrder: getValidSectionOrder(data.sectionOrder),
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

  // Specifically hardcode KIIT for university education instead of generic University
  const isSchool = /XII|12|X|10|Secondary/i.test(cleanDegree) || /XII|12|X|10|Secondary/i.test(cleanTitle) || /school|cbse|icse/i.test(institution);
  if (!isSchool) {
    if (!institution || /^(?:university|college|kiit|kalinga.*)$/i.test(institution.trim()) || /kiit/i.test(institution)) {
      institution = 'Kalinga Institute of Industrial Technology (KIIT)';
    }
    if (!location) {
      location = 'Bhubaneswar, India';
    }
  }

  let topTitle = institution;
  let degreeLine = cleanDegree || '';

  if (!topTitle) {
    topTitle = cleanTitle || degreeLine || 'Kalinga Institute of Industrial Technology (KIIT)';
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

function renderRecordEntry(secKey, item, index, dataBlockId, isCompact = false, condenseDesc = false) {
  if (!item || typeof item !== 'object') return null;
  if (secKey === 'experience') {
    const exp = formatExperienceHeader(item);
    return (
      <div className="pf-studio-entry" key={item.id || index} data-block-id={dataBlockId}>
        <div className="pf-paper-entry-title-row">
          <div className="pf-paper-entry-left">
            <b>{exp.role}</b>
            {exp.metaText && <span className="pf-paper-role-meta">· {exp.metaText}</span>}
          </div>
          {exp.dates && <span className="pf-paper-entry-date">{exp.dates}</span>}
        </div>
        {recordDescription(item) && <p>{recordDescription(item)}</p>}
        {item.bullets?.length > 0 && (
          <ul>
            {item.bullets.map((bullet, bulletIndex) => (
              <li key={bulletIndex}>{bullet}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (secKey === 'projects') {
    const pl = getProjectLinks(item);
    const dates = formatIsoDateStr(recordDates(item));
    return (
      <div className="pf-studio-entry" key={item.id || index} data-block-id={dataBlockId}>
        <div className="pf-paper-entry-title-row">
          <div className="pf-paper-entry-left">
            <b>{value(item, ['title', 'name', 'projectName']) || 'Project'}</b>
            {pl.liveUrl && (
              <span className="pf-paper-project-link pf-paper-project-link--live">
                <a href={ensureUrl(pl.liveUrl)} target="_blank" rel="noopener noreferrer">
                  Live
                </a>
              </span>
            )}
            {pl.repoUrl && pl.repoUrl !== pl.liveUrl && (
              <span className="pf-paper-project-link pf-paper-project-link--repo">
                <a href={ensureUrl(pl.repoUrl)} target="_blank" rel="noopener noreferrer">
                  {getRepoLabel(pl.repoUrl)}
                </a>
              </span>
            )}
          </div>
          {dates && <span className="pf-paper-entry-date">{dates}</span>}
        </div>
        {item.technologies && (
          <p className="pf-paper-tech-stack"><b>Tech Stack:</b> {item.technologies}</p>
        )}
        {recordDescription(item) && <p>{recordDescription(item)}</p>}
        {item.bullets?.length > 0 && (
          <ul>
            {item.bullets.map((bullet, bulletIndex) => (
              <li key={bulletIndex}>{bullet}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (secKey === 'education') {
    const edu = formatEducationEntry(item);
    return (
      <div className="pf-studio-entry" key={item.id || index} data-block-id={dataBlockId}>
        <div className="pf-paper-entry-title-row">
          <div className="pf-paper-entry-left">
            <b>{edu.topTitle}</b>
            {edu.location && <span className="pf-paper-role-meta"> · {edu.location}</span>}
          </div>
          {edu.dates && <span className="pf-paper-entry-date">{edu.dates}</span>}
        </div>
        {edu.subLine && <span className="pf-paper-entry-sub">{edu.subLine}</span>}
        {item.bullets?.length > 0 && (
          <ul>
            {item.bullets.map((bullet, bulletIndex) => (
              <li key={bulletIndex}>{bullet}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Certifications: prefer concise entry (name + issuer + date) when space is constrained
  if (secKey === 'certifications') {
    const dates = recordDates(item);
    const sub = recordSubMeta(item);
    const showDesc = !condenseDesc && !isCompact && Boolean(recordDescription(item));
    return (
      <div className="pf-studio-entry" key={item.id || index} data-block-id={dataBlockId}>
        <div className="pf-paper-entry-title-row">
          <div className="pf-paper-entry-left">
            <b>{value(item, ['title', 'name'])}</b>
          </div>
          {dates && <span className="pf-paper-entry-date">{dates}</span>}
        </div>
        {sub && <span className="pf-paper-entry-sub">{sub}</span>}
        {showDesc && <p className="pf-entry-desc">{recordDescription(item)}</p>}
        {item.bullets?.length > 0 && !condenseDesc && (
          <ul>
            {item.bullets.map((bullet, bulletIndex) => (
              <li key={bulletIndex}>{bullet}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Achievements, Leadership, Activities & Positions of Responsibility
  const dates = recordDates(item);
  const sub = recordSubMeta(item);
  const showDesc = !condenseDesc && Boolean(recordDescription(item));
  return (
    <div className="pf-studio-entry" key={item.id || index} data-block-id={dataBlockId}>
      <div className="pf-paper-entry-title-row">
        <div className="pf-paper-entry-left">
          <b>{value(item, ['title', 'role', 'name', 'position'])}</b>
        </div>
        {dates && <span className="pf-paper-entry-date">{dates}</span>}
      </div>
      {sub && <span className="pf-paper-entry-sub">{sub}</span>}
      {showDesc && <p className="pf-entry-desc">{recordDescription(item)}</p>}
      {item.bullets?.length > 0 && !condenseDesc && (
        <ul>
          {item.bullets.map((bullet, bulletIndex) => (
            <li key={bulletIndex}>{bullet}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function buildResumeBlocks(data) {
  if (!data) return [];
  const blocks = [];
  blocks.push({ id: 'header', type: 'header' });

  const sectionOrder = getValidSectionOrder(data.sectionOrder);
  for (const secKey of sectionOrder) {
    if (secKey === 'summary') {
      if (data.summary?.text?.trim()) {
        blocks.push({ id: 'summary', type: 'summary' });
      }
    } else if (secKey === 'skills') {
      const skillsObj = data.skills || {};
      const hasCategories = Boolean(
        (skillsObj.languages?.length || 0) +
        (skillsObj.frameworks?.length || 0) +
        (skillsObj.cloudDevOps?.length || 0) +
        (skillsObj.databasesTools?.length || 0) +
        (skillsObj.coreConcepts?.length || 0)
      );
      if (hasCategories || skillsObj.raw?.length) {
        blocks.push({ id: 'skills', type: 'skills' });
      }
    } else if (Array.isArray(data[secKey]) && data[secKey].length > 0) {
      blocks.push({ id: `title-${secKey}`, type: 'section-title', section: secKey });
      data[secKey].forEach((item, idx) => {
        if (item) {
          blocks.push({ id: `entry-${secKey}-${idx}`, type: 'entry', section: secKey, item, index: idx });
        }
      });
    }
  }
  return blocks;
}

function renderResumeBlock(block, data, template, isCompact = false, condenseDesc = false) {
  if (block.type === 'header') {
    const personal = data.personal || {};
    return (
      <header key="header" data-block-id={block.id}>
        <h1>{personal.fullName || 'Candidate Name'}</h1>
        <p>
          {[personal.email, personal.phone, personal.location].filter(Boolean).join(' | ')}
        </p>
        {personal.links?.length > 0 && (
          <p className="pf-paper-links">
            {personal.links.map((link, idx) => {
              const url = typeof link === 'string' ? link : link?.url || '';
              if (!url) return null;
              const label = (typeof link === 'object' && (link?.label || link?.name || link?.platform))
                ? (link.label || link.name || link.platform)
                : formatPlatformLabel(url);
              return (
                <span key={idx}>
                  {idx > 0 && <span className="pf-paper-links-sep"> | </span>}
                  <a href={ensureUrl(url)} target="_blank" rel="noopener noreferrer">
                    {label}
                  </a>
                </span>
              );
            })}
          </p>
        )}
        {personal.headline && <strong>{personal.headline}</strong>}
      </header>
    );
  }

  if (block.type === 'summary') {
    return (
      <section key="summary" data-block-id={block.id}>
        <h2>Professional Summary</h2>
        <p>{data.summary?.text}</p>
      </section>
    );
  }

  if (block.type === 'skills') {
    const skillsObj = data.skills || {};
    const hasCategories = Boolean(
      (skillsObj.languages?.length || 0) +
      (skillsObj.frameworks?.length || 0) +
      (skillsObj.cloudDevOps?.length || 0) +
      (skillsObj.databasesTools?.length || 0) +
      (skillsObj.coreConcepts?.length || 0)
    );
    const rawSkills = Array.isArray(skillsObj.raw) ? skillsObj.raw : [];
    return (
      <section key="skills" data-block-id={block.id}>
        <h2>Technical Skills</h2>
        {hasCategories ? (
          <div className="pf-paper-skills-cat">
            {skillsObj.languages?.length > 0 && (
              <p><b>Languages:</b> {skillsObj.languages.join(', ')}</p>
            )}
            {skillsObj.frameworks?.length > 0 && (
              <p><b>Frameworks & Libraries:</b> {skillsObj.frameworks.join(', ')}</p>
            )}
            {skillsObj.cloudDevOps?.length > 0 && (
              <p><b>Cloud & DevOps:</b> {skillsObj.cloudDevOps.join(', ')}</p>
            )}
            {skillsObj.databasesTools?.length > 0 && (
              <p><b>Databases & Tools:</b> {skillsObj.databasesTools.join(', ')}</p>
            )}
            {skillsObj.coreConcepts?.length > 0 && (
              <p><b>Core Concepts:</b> {skillsObj.coreConcepts.join(', ')}</p>
            )}
            {skillsObj.tools?.length > 0 && (
              <p><b>Other Tools:</b> {skillsObj.tools.join(', ')}</p>
            )}
          </div>
        ) : (
          <p>{rawSkills.join(' | ')}</p>
        )}
      </section>
    );
  }

  if (block.type === 'section-title') {
    const conf = SECTION_CONFIG[block.section] || { label: block.section };
    return (
      <h2 key={block.id} data-block-id={block.id} className="pf-paper-sec-heading">
        {conf.label}
      </h2>
    );
  }

  if (block.type === 'entry') {
    return renderRecordEntry(block.section, block.item, block.index, block.id, isCompact, condenseDesc);
  }

  return null;
}

export function Preview({
  data,
  template,
  onPageCountChange,
  isCompact: externalIsCompact,
  onCompactChange,
  condenseDesc: externalCondenseDesc,
  onCondenseDescChange
}) {
  const measureRef = React.useRef(null);
  const blocks = React.useMemo(() => buildResumeBlocks(data), [data]);
  const [internalCompact, setInternalCompact] = useState(false);
  const [internalCondenseDesc, setInternalCondenseDesc] = useState(false);

  const isCompact = externalIsCompact !== undefined ? externalIsCompact : internalCompact;
  const condenseDesc = externalCondenseDesc !== undefined ? externalCondenseDesc : internalCondenseDesc;

  const [paginatedPages, setPaginatedPages] = useState([[...blocks]]);

  React.useLayoutEffect(() => {
    let isMounted = true;

    const measure = () => {
      const container = measureRef.current;
      if (!container || blocks.length === 0) {
        setPaginatedPages([[]]);
        if (onPageCountChange) onPageCountChange(1);
        return;
      }

      // In Chrome printable A4 at 96 DPI:
      // Page 1 print boundary breaks at ~940-950px.
      // Setting PAGE_CONTENT_MAX_PX to 945 aligns preview page bounds with PDF export.
      const PAGE_CONTENT_MAX_PX = 945;

      const elements = blocks.map(b => container.querySelector(`[data-block-id="${b.id}"]`));
      if (elements.some(el => !el)) return;

      const firstRect = elements[0].getBoundingClientRect();
      const lastRect = elements[elements.length - 1].getBoundingClientRect();
      const totalRenderedHeight = lastRect.bottom - firstRect.top;

      // 1. Dynamic compact density: if content exceeds 895px, apply compact density
      if (totalRenderedHeight > 895 && !isCompact) {
        setInternalCompact(true);
        if (onCompactChange) onCompactChange(true);
        return;
      }

      // 2. Dynamic description condensation:
      // If content exceeds 940px, condense lower-priority descriptions (certifications, achievements, leadership)
      // to retain the credentials themselves on the page without overflowing
      if (totalRenderedHeight > 940 && !condenseDesc) {
        setInternalCondenseDesc(true);
        if (onCondenseDescChange) onCondenseDescChange(true);
        return;
      }

      // If content fits comfortably well below the single-page boundary (< 840px) and descriptions were condensed,
      // allow descriptions to expand to fill available space
      if (totalRenderedHeight < 840 && condenseDesc && externalCondenseDesc === undefined) {
        setInternalCondenseDesc(false);
        if (onCondenseDescChange) onCondenseDescChange(false);
        return;
      }

      const pageStartTop = firstRect.top;
      const page1Blocks = [];

      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        const el = elements[i];
        const elRect = el.getBoundingClientRect();

        let requiredBottom = elRect.bottom;

        // Section title orphan avoidance (page-break-after: avoid):
        // Ensure title + first entry fit together on the same page.
        if (b.type === 'section-title' && i + 1 < blocks.length && elements[i + 1]) {
          const nextEl = elements[i + 1];
          requiredBottom = nextEl.getBoundingClientRect().bottom;
        }

        const requiredOnPage = requiredBottom - pageStartTop;

        if (requiredOnPage <= PAGE_CONTENT_MAX_PX) {
          page1Blocks.push(b);
        } else {
          // Reached A4 boundary
          break;
        }
      }

      // Strict single-page layout enforcement:
      // Content is NEVER truncated mid-word or mid-sentence.
      // Overflow items are dropped as complete low-priority blocks (achievements/certifications/leadership).
      // Remove any section-title whose section has no entries remaining on Page 1.
      const sectionsWithEntries = new Set(
        page1Blocks
          .filter(b => b.type === 'entry' && b.section)
          .map(b => b.section)
      );

      const finalPage1Blocks = page1Blocks.filter(b => {
        if (b.type === 'section-title') {
          return sectionsWithEntries.has(b.section);
        }
        return true;
      });

      if (isMounted) {
        setPaginatedPages([finalPage1Blocks]);
        if (onPageCountChange) {
          onPageCountChange(1);
        }
      }
    };

    measure();

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (isMounted) measure();
      });
    }

    const handleResize = () => {
      if (isMounted) measure();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
    };
  }, [blocks, template, isCompact, condenseDesc, onPageCountChange, onCompactChange, onCondenseDescChange]);

  return (
    <>
      {/* Hidden 1:1 unscaled measurement container in portal to avoid any ancestor CSS zoom */}
      {typeof document !== 'undefined' && createPortal(
        <div
          ref={measureRef}
          className={`pf-studio-paper pf-studio-paper--${template} ${isCompact ? 'is-compact' : ''} pf-measure-container`}
          aria-hidden="true"
        >
          {blocks.map(b => renderResumeBlock(b, data, template, isCompact, condenseDesc))}
        </div>,
        document.body
      )}

      {/* Visible paginated physical sheets - guaranteed single-page */}
      <div className="pf-studio-pages-stack">
        {paginatedPages.map((pageBlocks, pageIdx) => (
          <div className="pf-studio-paper-sheet-card" key={pageIdx}>
            {paginatedPages.length > 1 && (
              <div className="pf-paper-page-label">
                <span>Page {pageIdx + 1} of {paginatedPages.length}</span>
              </div>
            )}
            <article className={`pf-studio-paper pf-studio-paper--${template} ${isCompact ? 'is-compact' : ''}`}>
              {pageBlocks.map(b => (
                <React.Fragment key={b.id}>
                  {renderResumeBlock(b, data, template, isCompact, condenseDesc)}
                </React.Fragment>
              ))}
            </article>
          </div>
        ))}
      </div>
    </>
  );
}

function printable(data, template, isCompact = false, docTitle = '', condenseDesc = false) {
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
      ${hideDesc ? '' : (recordDescription(item) ? `<p>${escapeHtml(recordDescription(item))}</p>` : '')}
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
    @page { margin: 0; }
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
    /*
      MARGIN STRATEGY (dialog-proof):
      - Left/Right: body padding - layout-level, permanent
      - Top on page 1: padding-top on the .page-wrap div
      - Top on page 2+: <thead> spacer that repeats on every page break (browser spec)
      - Bottom: padding-bottom on .page-wrap
    */
    body { padding: 0 18mm; }
    table.page-table {
      width: 100%;
      border: 0;
      border-collapse: collapse;
      margin: 0;
      padding: 0;
    }
    table.page-table td { padding: 0; border: 0; }
    .page-margin-top { height: 14mm; display: block; }
    .page-margin-bottom { height: 14mm; display: block; }
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
  <table class="page-table">
    <thead>
      <tr><td><span class="page-margin-top"></span></td></tr>
    </thead>
    <tfoot>
      <tr><td><span class="page-margin-bottom"></span></td></tr>
    </tfoot>
    <tbody>
      <tr>
        <td>
          <main class="resume ${template} ${isCompact ? 'is-compact' : ''}">
            <header class="head">
              <h1>${escapeHtml(personal.fullName || 'Candidate')}</h1>
              <p>${contactLine}</p>
              ${linksLine ? `<p class="head-links">${linksLine}</p>` : ''}
              ${personal.headline ? `<strong>${escapeHtml(personal.headline)}</strong>` : ''}
            </header>
            ${renderedSectionsHtml}
          </main>
        </td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;
}

function AutoGrowingInput({
  value = '',
  onChange,
  onKeyDown,
  placeholder,
  className = '',
  singleLineOnly = true,
  rows = 1,
  ...props
}) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(38, el.scrollHeight)}px`;
  }, [value]);

  const handleKeyDown = (e) => {
    if (singleLineOnly && e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
    onKeyDown?.(e);
  };

  const handleChange = (e) => {
    if (singleLineOnly && e.target.value.includes('\n')) {
      e.target.value = e.target.value.replace(/[\r\n]+/g, ' ');
    }
    onChange?.(e);
  };

  return (
    <textarea
      ref={ref}
      rows={rows}
      value={value || ''}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={`pf-studio-auto-input ${className}`}
      {...props}
    />
  );
}

function RecordEditor({ section, records, onChange, onAdd, onRemove, onMove, onReorder }) {
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const label = section === 'education' ? 'Education' :
                section === 'certifications' ? 'Certification' :
                section === 'achievements' ? 'Achievement' :
                section === 'leadership' ? 'Role' :
                section.slice(0, -1);

  const handleDragStart = (e, index) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setDraggedIdx(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIdx !== null && draggedIdx !== targetIndex) {
      if (onReorder) {
        onReorder(draggedIdx, targetIndex);
      } else if (onMove) {
        onMove(draggedIdx, targetIndex - draggedIdx);
      }
    }
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="pf-studio-record-editor">
      {records.map((item, index) => (
        <article
          className={`pf-studio-record-edit ${draggedIdx === index ? 'is-record-dragging' : ''} ${dragOverIdx === index ? 'is-record-dragover' : ''}`}
          key={item.id || index}
          onDragOver={e => handleDragOver(e, index)}
          onDrop={e => handleDrop(e, index)}
          onDragLeave={() => { if (dragOverIdx === index) setDragOverIdx(null); }}
        >
          <div className="pf-studio-record-edit-head">
            <div className="pf-record-head-left">
              <span
                className="pf-record-drag-handle"
                title={`Drag to reorder ${label}`}
                draggable
                onDragStart={e => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
              >
                <GripVertical size={14} />
              </span>
              <span className="pf-record-badge-num">#{index + 1}</span>
              <b className="pf-record-title">
                {value(item, section === 'education' ? ['institution', 'title', 'company'] : ['title', 'role', 'projectName', 'company', 'institution']) || `New ${label} entry`}
              </b>
            </div>

            <div className="pf-record-head-actions">
              <button
                type="button"
                className="pf-record-action-btn"
                disabled={index === 0}
                onClick={() => onMove?.(index, -1)}
                title={`Move ${label} up`}
                aria-label={`Move ${label} up`}
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                className="pf-record-action-btn"
                disabled={index === records.length - 1}
                onClick={() => onMove?.(index, 1)}
                title={`Move ${label} down`}
                aria-label={`Move ${label} down`}
              >
                <ChevronDown size={14} />
              </button>
              <button
                type="button"
                className="pf-record-action-btn pf-record-action-btn--delete"
                onClick={() => onRemove(index)}
                title={`Remove ${label}`}
                aria-label={`Remove ${label}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Primary Field: Title / Institution / Job Role / Project Name (Full Width, Auto-Growing) */}
          <label className="pf-studio-full-field">
            {section === 'education' ? 'Institution / School' :
             section === 'experience' ? 'Job Title / Role' :
             section === 'projects' ? 'Project Name' :
             section === 'certifications' ? 'Certification Title' :
             section === 'achievements' ? 'Achievement Title' :
             section === 'leadership' ? 'Role / Position Title' : 'Title'}
            <AutoGrowingInput
              value={section === 'education' ? (item.institution || item.company || '') : (item.title || item.role || item.projectName || '')}
              onChange={event => onChange(index, section === 'education' ? {
                institution: event.target.value,
                company: event.target.value,
              } : {
                title: event.target.value,
                role: event.target.value,
                projectName: event.target.value
              })}
              placeholder={
                section === 'education' ? 'Silicon University' :
                section === 'experience' ? 'Software Engineering Intern' :
                section === 'projects' ? 'Pathfolio: AI Resume Platform' :
                section === 'certifications' ? 'AWS Certified Solutions Architect – Associate' :
                section === 'achievements' ? 'Secured Global Rank 197 in LeetCode Contest' :
                section === 'leadership' ? 'Technical Lead & Open Source Coordinator' : 'Title'
              }
            />
          </label>

          {/* Secondary Field: Subtitle / Organization / Degree / Issuer (Full Width, Auto-Growing) */}
          <label className="pf-studio-full-field">
            {section === 'education' ? 'Degree / Qualification & Field' :
             section === 'experience' ? 'Company / Organization' :
             section === 'projects' ? 'Project Type / Context' :
             section === 'certifications' ? 'Issuing Organization' :
             section === 'achievements' ? 'Issuer / Organization / Platform' :
             section === 'leadership' ? 'Organization / Club / Society' : 'Issuer / Category'}
            <AutoGrowingInput
              value={
                section === 'education'
                  ? (item.degreeProgram || item.degree || (item.title !== item.institution ? item.title : '') || '')
                  : (item.issuer || item.company || item.institution || item.category || item.role || '')
              }
              onChange={event => onChange(index, section === 'education' ? {
                degreeProgram: event.target.value,
                degree: event.target.value,
                title: event.target.value,
              } : {
                issuer: event.target.value,
                company: event.target.value,
                institution: event.target.value,
                category: event.target.value,
                role: section === 'projects' ? event.target.value : item.role
              })}
              placeholder={
                section === 'education' ? 'Bachelor of Technology in Computer Science and Engineering' :
                section === 'experience' ? 'Google / Amazon / Microsoft' :
                section === 'projects' ? 'Full-Stack Web App · Capstone Project' :
                section === 'certifications' ? 'Google (via Coursera)' :
                section === 'achievements' ? 'LeetCode / ACM Chapter / Hackathon' :
                section === 'leadership' ? 'KIIT ACM Student Chapter' : 'Academic / Personal'
              }
            />
          </label>

          {/* Metadata: Dates & Location (2 Columns) */}
          <div className="pf-studio-record-fields">
            <label>
              {section === 'certifications' ? 'Issue Date / Validity' : 'Dates / Period'}
              <input
                value={item.dates || item.year || ''}
                onChange={event => onChange(index, { dates: event.target.value, year: event.target.value })}
                placeholder={section === 'certifications' ? 'May 2025 · No Expiration' : 'Aug 2026 – Present'}
              />
            </label>

            <label>
              {section === 'certifications' ? 'Credential ID / URL' : 'Location / Mode'}
              <input
                value={item.location || ''}
                onChange={event => onChange(index, { location: event.target.value })}
                placeholder={section === 'certifications' ? 'AWS-SAA-1029384' : 'Bengaluru · On-site'}
              />
            </label>
          </div>

          {section === 'projects' && (
            <>
              <label className="pf-studio-full-field">
                Technologies / Tech Stack
                <AutoGrowingInput
                  value={item.technologies || ''}
                  onChange={event => onChange(index, { technologies: event.target.value })}
                  placeholder="React, FastAPI, PostgreSQL, Docker"
                />
              </label>

              <div className="pf-studio-record-fields">
                <label>
                  Demo / Live URL
                  <input
                    value={item.liveUrl || ''}
                    onChange={event => onChange(index, { liveUrl: event.target.value })}
                    placeholder="https://my-project.app..."
                  />
                </label>

                <label>
                  Repository URL
                  <input
                    value={item.repoUrl || ''}
                    onChange={event => onChange(index, { repoUrl: event.target.value })}
                    placeholder="https://github.com/..."
                  />
                </label>
              </div>
            </>
          )}

          <label>
            {section === 'education' ? 'Grade / CGPA / Details' : 'Description / Context'}
            <textarea
              value={item.description || ''}
              onChange={event => onChange(index, { description: event.target.value })}
              placeholder={section === 'education' ? 'CGPA: 8.12' : 'Summary of responsibilities or context'}
              rows={2}
            />
          </label>

          <label>
            Achievement bullets <span className="pf-studio-field-hint">one per line</span>
            <textarea
              value={(item.bullets || []).join('\n')}
              onChange={event => onChange(index, {
                bullets: event.target.value
                  .split('\n')
                  .map(line => line.replace(/^[-*•]\s*/, '').trim())
                  .filter(Boolean)
              })}
              placeholder="Developed backend REST APIs using Java and Spring Boot.\nDesigned and integrated MySQL database operations.\nImproved query performance by 40%."
              rows={4}
            />
          </label>
        </article>
      ))}

      <button type="button" className="pf-studio-add" onClick={onAdd}>
        <Plus size={15} /> Add {label}
      </button>
    </div>
  );
}

class ResumeStudioErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ResumeStudio render crashed:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '60px 24px', textAlign: 'center', maxWidth: '600px', margin: '40px auto', background: '#fff', borderRadius: '16px', border: '1px solid #e1e7e2', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>⚠️</div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1d2921', marginBottom: '8px' }}>Resume Studio encountered an issue</h2>
          <p style={{ fontSize: '14px', color: '#55665a', marginBottom: '20px' }}>
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              style={{ padding: '10px 18px', background: '#264e36', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
            >
              Reload Studio
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = '/resume'; }}
              style={{ padding: '10px 18px', background: '#f0f3f1', color: '#1d2921', border: '1px solid #d4ddd7', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
            >
              Back to Resumes
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ResumeStudioInner() {
  const { resumeId } = useParams();
  const navigate = useNavigate();
  const [resume, setResume] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [data, setData] = useState(null);
  const [resumesList, setResumesList] = useState([]);
  const [template, setTemplate] = useState('classic');
  const [section, setSection] = useState('summary');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(0.57);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1400) {
      return true;
    }
    return false;
  });
  const [showPreview, setShowPreview] = useState(true);
  const [draggedSecIndex, setDraggedSecIndex] = useState(null);
  const [dragOverSecIndex, setDragOverSecIndex] = useState(null);
  const [showSaveDropdown, setShowSaveDropdown] = useState(false);
  const [isSaveAsOpen, setIsSaveAsOpen] = useState(false);
  const [saveAsFilename, setSaveAsFilename] = useState('');
  const [saveAsCategory, setSaveAsCategory] = useState('General');
  const [savingAs, setSavingAs] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [renaming, setRenaming] = useState(false);
  const paperWrapRef = React.useRef(null);
  const saveDropdownRef = React.useRef(null);
  const [pageCount, setPageCount] = useState(1);
  const [isCompact, setIsCompact] = useState(false);
  const [condenseDesc, setCondenseDesc] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const [toast, setToast] = useState(null);
  const [toastLeaving, setToastLeaving] = useState(false);
  const toastTimeoutRef = React.useRef(null);

  const showToast = ({ type, title, message, actionLabel, actionLink, duration = 4500 }) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastLeaving(false);
    setToast({ type, title, message, actionLabel, actionLink, duration });

    if (duration > 0) {
      toastTimeoutRef.current = setTimeout(() => {
        setToastLeaving(true);
        setTimeout(() => setToast(null), 320);
      }, duration);
    }
  };

  const dismissToast = () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastLeaving(true);
    setTimeout(() => setToast(null), 320);
  };

  const handleReExtractWithAi = async () => {
    if (!resume?.id) return;
    try {
      setReparsing(true);
      showToast({
        type: 'loading',
        title: 'Re-extracting resume...',
        message: `Analyzing "${resume.filename || 'resume'}" structure and details.`,
        duration: 0,
      });
      const updated = await resumeApi.reparse(resume.id);
      if (updated?.extractedData) {
        setData(normalizeExtractedData(updated.extractedData, studentProfile));
      }
      showToast({
        type: 'success',
        title: 'Resume re-extracted',
        message: 'Studio canvas refreshed with updated details.',
        duration: 4500,
      });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Re-extraction failed',
        message: err.message || 'Failed to re-extract resume details.',
        duration: 6000,
      });
    } finally {
      setReparsing(false);
    }
  };

  useEffect(() => {
    if (!showSaveDropdown) return;
    const handleClickOutside = (e) => {
      if (saveDropdownRef.current && !saveDropdownRef.current.contains(e.target)) {
        setShowSaveDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSaveDropdown]);

  const fitToWidth = React.useCallback(() => {
    if (!paperWrapRef.current) return;
    const clientW = paperWrapRef.current.clientWidth;
    if (!clientW || clientW < 100) return;
    // Account for wrap padding (12px * 2 = 24px) plus 14px comfortable breathing room
    const availableWidth = clientW - 38;
    const paperWidthPx = 794;
    if (availableWidth > 60) {
      const targetZoom = Math.min(1.05, Math.max(0.26, Number((availableWidth / paperWidthPx).toFixed(2))));
      setZoom(targetZoom);
    }
  }, []);

  // Automatically fit zoom by default whenever resume data is loaded or mounts
  useEffect(() => {
    if (!data) return;
    const t1 = setTimeout(fitToWidth, 60);
    const t2 = setTimeout(fitToWidth, 240);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [data, fitToWidth]);

  // Recalculate zoom whenever sidebar collapses or preview visibility changes
  useEffect(() => {
    const t1 = setTimeout(fitToWidth, 50);
    const t2 = setTimeout(fitToWidth, 160);
    const t3 = setTimeout(fitToWidth, 250);
    const t4 = setTimeout(fitToWidth, 380);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [sidebarCollapsed, showPreview, fitToWidth]);

  // Observe preview container width changes to keep zoom fitted dynamically
  useEffect(() => {
    const el = paperWrapRef.current;
    if (!el) return;

    let lastWidth = 0;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (Math.abs(width - lastWidth) > 3) {
          lastWidth = width;
          fitToWidth();
        }
      }
    });

    observer.observe(el);
    fitToWidth();

    return () => observer.disconnect();
  }, [data, isFullscreen, sidebarCollapsed, showPreview, fitToWidth]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError('');

        const [profileRes, resumesRes] = await Promise.allSettled([
          profileApi.get(),
          resumeApi.list(),
        ]);

        const profileData = profileRes.status === 'fulfilled' ? profileRes.value?.student : null;
        const resumes = resumesRes.status === 'fulfilled' && Array.isArray(resumesRes.value) ? resumesRes.value : [];

        if (active) {
          setStudentProfile(profileData);
          setResumesList(resumes);

          const queryResumeId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('resumeId') : null;
          const targetResumeId = resumeId || queryResumeId;

          if (targetResumeId) {
            const found = resumes.find(item => String(item.id) === String(targetResumeId));
            if (found && (found.extractedData || found.analysis?.structured)) {
              setResume(found);
              setData(normalizeExtractedData(found.extractedData || found.analysis?.structured, profileData));
            } else if (found) {
              setResume(found);
              setData(normalizeExtractedData({}, profileData));
            } else {
              setError('Could not find the requested resume.');
              setData(null);
            }
          } else if (resumes.length > 0) {
            const defaultResume = resumes.find(item => item.isDefault) || resumes[0];
            setResume(defaultResume);
            setData(normalizeExtractedData(defaultResume.extractedData || defaultResume.analysis?.structured || {}, profileData));
          } else if (profileData) {
            setResume(null);
            setData(profileToResumeData(profileData));
          } else {
            setResume(null);
            setData(null);
          }
        }
      } catch (err) {
        if (active) setError(err.message || 'Unable to load Resume Studio.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [resumeId]);

  const update = (key, valueToSet) => setData(current => ({ ...current, [key]: valueToSet }));

  const handleDragStart = (e, index) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setDraggedSecIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSecIndex !== index) {
      setDragOverSecIndex(index);
    }
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedSecIndex === null || draggedSecIndex === targetIndex) {
      setDraggedSecIndex(null);
      setDragOverSecIndex(null);
      return;
    }

    const currentOrder = getValidSectionOrder(data?.sectionOrder);
    const newOrder = [...currentOrder];
    const [moved] = newOrder.splice(draggedSecIndex, 1);
    newOrder.splice(targetIndex, 0, moved);

    update('sectionOrder', newOrder);
    setDraggedSecIndex(null);
    setDragOverSecIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedSecIndex(null);
    setDragOverSecIndex(null);
  };

  const moveSection = (index, direction) => {
    const currentOrder = getValidSectionOrder(data?.sectionOrder);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= currentOrder.length) return;
    const newOrder = [...currentOrder];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);
    update('sectionOrder', newOrder);
  };

  const updateRecord = (key, index, patch) =>
    setData(current => ({
      ...current,
      [key]: (current[key] || []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    }));

  const addRecord = key =>
    setData(current => ({
      ...current,
      [key]: [
        ...(current[key] || []),
        { id: `${key}_${Date.now()}`, title: '', dates: '', location: '', description: '', bullets: [] },
      ],
    }));

  const removeRecord = (key, index) =>
    setData(current => ({
      ...current,
      [key]: (current[key] || []).filter((_, itemIndex) => itemIndex !== index),
    }));

  const moveRecord = (key, fromIndex, direction) => {
    const list = data?.[key] || [];
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= list.length) return;
    const nextList = [...list];
    const [moved] = nextList.splice(fromIndex, 1);
    nextList.splice(toIndex, 0, moved);
    setData(current => ({ ...current, [key]: nextList }));
  };

  const reorderRecord = (key, fromIndex, toIndex) => {
    const list = data?.[key] || [];
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) return;
    const nextList = [...list];
    const [moved] = nextList.splice(fromIndex, 1);
    nextList.splice(toIndex, 0, moved);
    setData(current => ({ ...current, [key]: nextList }));
  };

  // Auto-generate / Sync freshly from user table
  const handleSyncFromProfile = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await profileApi.get();
      const profile = res?.student || studentProfile;
      if (!profile) throw new Error('No profile data found to sync.');

      const generated = profileToResumeData(profile);
      setStudentProfile(profile);
      setData(generated);

      const countIntern = (profile.internships || []).length;
      const countProj = (profile.projects || []).length;
      const countSkills = (generated.skills?.raw || []).length;

      setSyncNotice(`✨ Synced from profile: ${countIntern} internships, ${countProj} projects, and ${countSkills} skills loaded!`);
      setTimeout(() => setSyncNotice(''), 4000);
    } catch (err) {
      setError(err.message || 'Unable to sync from profile.');
    } finally {
      setLoading(false);
    }
  };

  const startRenaming = () => {
    if (!resume) return;
    const currentName = resume.filename || '';
    setRenameVal(currentName.replace(/\.pdf$/i, ''));
    setIsRenaming(true);
    setTimeout(() => {
      if (renameInputRef.current) {
        renameInputRef.current.focus();
        renameInputRef.current.select();
      }
    }, 50);
  };

  const handleRenameCancel = () => {
    setIsRenaming(false);
    setRenameVal('');
  };

  const handleRenameSubmit = async (e) => {
    if (e) e.preventDefault();
    const raw = renameVal.trim();
    if (!raw) {
      handleRenameCancel();
      return;
    }
    const cleanBase = raw.replace(/\.pdf$/i, '').trim();
    const finalFilename = `${cleanBase}.pdf`;

    if (finalFilename === resume?.filename) {
      handleRenameCancel();
      return;
    }

    try {
      setRenaming(true);
      const updated = await resumeApi.rename(resume.id, finalFilename);
      const newName = updated?.filename || finalFilename;
      setResume(curr => ({ ...curr, filename: newName }));
      setResumesList(list => list.map(item => item.id === resume.id ? { ...item, filename: newName } : item));
      setIsRenaming(false);
      setSyncNotice(`Renamed to "${newName}"`);
      setTimeout(() => setSyncNotice(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to rename resume.');
    } finally {
      setRenaming(false);
    }
  };

  const openSaveAsModal = () => {
    if (!data) return;
    let base = '';
    if (resume?.filename) {
      base = resume.filename.replace(/\.pdf$/i, '').trim();
      if (!base.endsWith('_Copy')) {
        base = `${base}_Copy`;
      }
    } else {
      const namePart = (data.personal?.fullName || 'Student').trim().replace(/\s+/g, '_');
      base = `${namePart}_Resume_Copy`;
    }
    setSaveAsFilename(`${base}.pdf`);
    setSaveAsCategory(resume?.category || 'General');
    setIsSaveAsOpen(true);
  };

  const handleSaveAsSubmit = async (e) => {
    if (e) e.preventDefault();
    const raw = saveAsFilename.trim();
    if (!raw) {
      setError('Filename is required.');
      return;
    }
    const cleanBase = raw.replace(/\.pdf$/i, '').trim();
    if (!cleanBase) {
      setError('Filename cannot be empty.');
      return;
    }
    const finalFilename = `${cleanBase}.pdf`;

    try {
      setSavingAs(true);
      setError('');
      const created = await resumeApi.createStudioResume({
        filename: finalFilename,
        category: saveAsCategory || resume?.category || 'General',
        extractedData: data,
        tags: ['Studio', 'Copy'],
      });

      setResumesList(prev => [created, ...prev.filter(r => r.id !== created.id)]);
      setResume(created);
      setData(normalizeExtractedData(created.extractedData || data, studentProfile));
      setIsSaveAsOpen(false);

      setSyncNotice(`Saved as new copy: "${finalFilename}"`);
      setTimeout(() => setSyncNotice(''), 4000);

      navigate(`/resume/${created.id}/studio`, { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to save new copy.');
    } finally {
      setSavingAs(false);
    }
  };

  const save = async () => {
    if (!data) return;
    try {
      setSaving(true);
      setError('');

      if (resume?.id) {
        if (resume.filepath) {
          // Fork uploaded PDFs into a new separate Studio resume to preserve the original
          const baseName = resume.filename ? resume.filename.replace(/\.pdf$/i, '') : (data.personal?.fullName ? data.personal.fullName.replace(/\s+/g, '_') : 'Student_Resume');
          const created = await resumeApi.createStudioResume({
            filename: `${baseName}_Studio.pdf`,
            category: resume.category || 'General',
            extractedData: data,
            tags: ['Studio', 'Forked'],
          });
          setResumesList(prev => [created, ...prev.filter(r => r.id !== created.id)]);
          setResume(created);
          setData(normalizeExtractedData(created.extractedData || data, studentProfile));
          navigate(`/resume/${created.id}/studio`, { replace: true });
        } else {
          // Update existing Studio resume
          const updated = await resumeApi.updateExtracted(resume.id, data);
          setResume(current => ({ ...current, ...updated }));
          setData(normalizeExtractedData(updated.extractedData || data, studentProfile));
        }
      } else {
        // Create new studio resume from scratch
        const filename = `${data.personal?.fullName ? data.personal.fullName.replace(/\s+/g, '_') : 'Student'}_Resume.pdf`;
        const created = await resumeApi.createStudioResume({
          filename,
          category: 'General',
          extractedData: data,
          tags: ['Studio', 'Auto-Generated'],
        });
        setResumesList(prev => [created, ...prev.filter(r => r.id !== created.id)]);
        setResume(created);
        setData(normalizeExtractedData(created.extractedData || data, studentProfile));
        navigate(`/resume/${created.id}/studio`, { replace: true });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message || 'Unable to save Studio edits.');
    } finally {
      setSaving(false);
    }
  };

  const exportPdf = () => {
    if (!data) return;
    const docTitle = resume?.filename
      ? resume.filename.replace(/\.pdf$/i, '')
      : (data.personal?.fullName ? `${data.personal.fullName.replace(/\s+/g, '_')}_Resume` : 'Resume');
    const htmlContent = printable(data, template, isCompact, docTitle, condenseDesc);

    const popup = window.open('', '_blank');
    if (popup) {
      popup.document.open();
      popup.document.write(htmlContent);
      popup.document.close();
      
      // We removed the embedded window.print() script from HTML to fix the double dialog.
      // Now we just trigger it once from here.
      setTimeout(() => {
        try {
          popup.focus();
          popup.print();
        } catch (_) {}
      }, 350);
    } else {
      alert("Please allow popups to export the PDF.");
    }
  };

  if (loading) {
    return (
      <div className="pf-studio-loading">
        <Loader className="spin" size={24} /> Loading Resume Studio...
      </div>
    );
  }

  return (
    <div className="pf-resume-studio">
      <header className="pf-studio-topbar">
        <div className="pf-studio-topbar-left">
          <button
            type="button"
            className="pf-studio-back-btn"
            onClick={() => navigate(resume ? `/resume/${resume.id}` : '/resume')}
            title="Return to Resume Library"
          >
            <ArrowLeft size={15} />
            <span>Library</span>
          </button>

          <div className="pf-studio-topbar-divider" />

          <div className="pf-studio-brand">
            <div className="pf-studio-brand-icon">
              <Sparkles size={15} />
            </div>
            <div className="pf-studio-brand-text">
              <h2>Resume Studio</h2>
              <span className="pf-studio-brand-sub">ATS Document Architect</span>
            </div>
          </div>

          <div className="pf-studio-file-selector-wrap">
            {!isRenaming ? (
              <div className="pf-studio-file-selector">
                <FileText size={14} className="pf-studio-file-icon" />
                <select 
                  value={resume?.id || ''} 
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) navigate(`/resume/${val}/studio`);
                    else navigate('/resume/studio');
                  }}
                  className="pf-studio-resume-select"
                  aria-label="Select resume to edit"
                >
                  <option value="">-- Start New Canvas --</option>
                  {resumesList.map(r => (
                    <option key={r.id} value={r.id}>{r.filename || 'Untitled Resume'}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="pf-select-caret" />
              </div>
            ) : (
              <form onSubmit={handleRenameSubmit} className="pf-studio-rename-form">
                <FileText size={14} className="pf-studio-file-icon" />
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameVal}
                  onChange={e => setRenameVal(e.target.value)}
                  className="pf-studio-rename-input"
                  placeholder="Resume filename"
                  onKeyDown={e => {
                    if (e.key === 'Escape') handleRenameCancel();
                  }}
                  autoFocus
                />
                <button type="submit" className="pf-studio-rename-btn pf-studio-rename-btn--ok" title="Save name" disabled={renaming}>
                  <Check size={13} />
                </button>
                <button type="button" className="pf-studio-rename-btn pf-studio-rename-btn--cancel" onClick={handleRenameCancel} title="Cancel">
                  <X size={13} />
                </button>
              </form>
            )}

            {resume?.id && !isRenaming && (
              <button
                type="button"
                className="pf-studio-rename-trigger"
                onClick={startRenaming}
                title="Rename active resume"
                aria-label="Rename active resume"
              >
                <Edit2 size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="pf-studio-top-actions">
          {data && (
            <>
              {resume?.filepath && (
                <button
                  type="button"
                  className="pf-studio-reextract-btn"
                  onClick={handleReExtractWithAi}
                  disabled={reparsing}
                  title="Re-run Gemini Multimodal AI extraction directly on your uploaded PDF"
                >
                  <Sparkles size={14} className={reparsing ? 'pf-spin' : ''} />
                  <span>{reparsing ? 'Extracting...' : 'Re-extract with AI'}</span>
                </button>
              )}

              <button
                type="button"
                className="pf-studio-sync-btn"
                onClick={handleSyncFromProfile}
                title="Auto-generate or re-sync all sections from your verified student profile table"
              >
                <RefreshCw size={14} /> Sync from Profile
              </button>

              <button
                type="button"
                className={`pf-studio-view-toggle-btn ${showPreview ? 'is-active' : ''}`}
                onClick={() => setShowPreview(prev => !prev)}
                title={showPreview ? "Hide Preview (Focus Mode)" : "Show Real-Time Live Preview"}
              >
                {showPreview ? <Eye size={14} /> : <EyeOff size={14} />}
                <span>{showPreview ? 'Preview On' : 'Preview Off'}</span>
              </button>
            </>
          )}

          <div className="pf-studio-save-group" ref={saveDropdownRef}>
            <button
              type="button"
              className="pf-studio-btn-save"
              onClick={save}
              disabled={saving || !data}
              title="Save changes to active resume"
            >
              <Save size={14} /> {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Edits'}
            </button>
            <button
              type="button"
              className="pf-studio-btn-save-split"
              onClick={() => setShowSaveDropdown(prev => !prev)}
              disabled={saving || !data}
              title="More save options"
              aria-haspopup="true"
              aria-expanded={showSaveDropdown}
            >
              <ChevronDown size={13} className={`pf-save-split-caret ${showSaveDropdown ? 'is-open' : ''}`} />
            </button>

            {showSaveDropdown && (
              <div className="pf-studio-save-menu" role="menu">
                <button
                  type="button"
                  className="pf-save-menu-item"
                  onClick={() => {
                    setShowSaveDropdown(false);
                    save();
                  }}
                >
                  <Save size={14} className="pf-save-menu-icon" />
                  <div className="pf-save-menu-text">
                    <b>Save Edits</b>
                    <span>Overwrite changes in active resume</span>
                  </div>
                </button>
                <button
                  type="button"
                  className="pf-save-menu-item"
                  onClick={() => {
                    setShowSaveDropdown(false);
                    openSaveAsModal();
                  }}
                >
                  <Copy size={14} className="pf-save-menu-icon" />
                  <div className="pf-save-menu-text">
                    <b>Save as New Copy...</b>
                    <span>Create a separate version with custom name</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button type="button" className="pf-studio-btn-export" onClick={exportPdf} disabled={!data}>
            <Download size={14} /> Export PDF
          </button>
        </div>
      </header>

      {syncNotice && (
        <div className="pf-studio-notice" role="status">
          <Check size={15} /> {syncNotice}
        </div>
      )}

      {error && <div className="pf-studio-error">{error}</div>}

      {!data ? (
        <div className="pf-studio-empty-wrap">
          <div className="pf-studio-empty-card">
            <div className="pf-resume-pdf-box" style={{ width: '52px', height: '52px', margin: '0 auto 16px' }}>
              <PdfIcon size={30} className="pf-resume-pdf-icon" />
            </div>
            <h3>Build an ATS-Ready Resume</h3>
            <p>
              Instantly generate an editorial-grade resume tailored from your verified student profile, or start fresh with a clean slate.
            </p>
            <div className="pf-studio-empty-actions">
              <button type="button" className="pf-btn-auto-gen" onClick={handleSyncFromProfile}>
                <Sparkles size={16} /> Auto-Generate from Profile
              </button>
              <button 
                type="button" 
                className="pf-btn-blank"
                onClick={() => setData(normalizeExtractedData({}, studentProfile))}
              >
                Start Blank
              </button>
            </div>
          </div>
        </div>
      ) : (
        <main className={`pf-studio-grid ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''} ${!showPreview ? 'is-preview-hidden' : ''}`}>
        {/* Left Sidebar: Templates & Navigation */}
        <aside className={`pf-studio-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
          <div className="pf-studio-sidebar-header">
            {!sidebarCollapsed && (
              <div className="pf-studio-panel-label">
                <span>Navigator</span>
              </div>
            )}
            <button
              type="button"
              className="pf-studio-sidebar-toggle-btn"
              onClick={() => setSidebarCollapsed(prev => !prev)}
              title={sidebarCollapsed ? "Expand sidebar (Templates & full labels)" : "Collapse sidebar (Maximize canvas space)"}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>

          <div className="pf-studio-sidebar-block">
            {!sidebarCollapsed ? (
              <>
                <div className="pf-studio-panel-label">
                  <span>Template Style</span>
                  <span className="pf-template-count">{TEMPLATES.length} Styles</span>
                </div>
                <div className="pf-studio-templates">
                  {TEMPLATES.map(([id, name, note]) => (
                    <button
                      type="button"
                      key={id}
                      className={`pf-template-btn ${template === id ? 'is-selected' : ''}`}
                      onClick={() => setTemplate(id)}
                    >
                      <div className="pf-template-indicator" />
                      <div className="pf-template-info">
                        <b>{name}</b>
                        <small>{note.split('·')[0].trim()}</small>
                      </div>
                      {template === id && <Check size={14} className="pf-template-check" />}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="pf-template-mini-wrap">
                <button
                  type="button"
                  className="pf-template-mini-btn"
                  onClick={() => {
                    const currIdx = TEMPLATES.findIndex(t => t[0] === template);
                    const nextIdx = (currIdx + 1) % TEMPLATES.length;
                    setTemplate(TEMPLATES[nextIdx][0]);
                  }}
                  title={`Style: ${TEMPLATES.find(t => t[0] === template)?.[1]}. Click to switch style or expand.`}
                >
                  <Layers size={14} />
                  <span className="pf-template-mini-label">{TEMPLATES.find(t => t[0] === template)?.[1]?.slice(0, 3)}</span>
                </button>
              </div>
            )}
          </div>

          <div className="pf-sidebar-divider" />

          <div className="pf-studio-sidebar-block">
            {!sidebarCollapsed && (
              <div className="pf-studio-panel-label">
                <span>Content Sections</span>
              </div>
            )}
            <nav className="pf-studio-section-nav">
              {/* Pinned: Personal Info & Links */}
              {(() => {
                const conf = SECTION_CONFIG.personal;
                const IconComponent = conf.icon;
                return (
                  <button
                    type="button"
                    key="personal"
                    className={`pf-studio-nav-item ${section === 'personal' ? 'is-active' : ''}`}
                    onClick={() => setSection('personal')}
                    title={conf.label}
                    aria-label={conf.label}
                  >
                    <IconComponent size={15} className="pf-studio-nav-icon" />
                    {!sidebarCollapsed && <span className="pf-studio-nav-text">{conf.label}</span>}
                    {sidebarCollapsed && (
                      <span className="pf-nav-tooltip" role="tooltip">
                        <span>{conf.label}</span>
                      </span>
                    )}
                  </button>
                );
              })()}

              {/* Draggable Reorderable Sections */}
              {getValidSectionOrder(data?.sectionOrder).map((item, idx) => {
                const conf = SECTION_CONFIG[item] || { label: item, icon: FileText };
                const IconComponent = conf.icon;
                const count = Array.isArray(data[item]) ? data[item].length : null;
                const isDragging = draggedSecIndex === idx;
                const isDragOver = dragOverSecIndex === idx;

                return (
                  <button
                    type="button"
                    key={item}
                    className={`pf-studio-nav-item is-draggable ${section === item ? 'is-active' : ''} ${isDragging ? 'is-dragging' : ''} ${isDragOver ? 'is-drag-over' : ''}`}
                    onClick={() => setSection(item)}
                    draggable
                    onDragStart={e => handleDragStart(e, idx)}
                    onDragOver={e => handleDragOver(e, idx)}
                    onDrop={e => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    title={`${conf.label} (Drag to reorder)`}
                    aria-label={conf.label}
                  >
                    <IconComponent size={15} className="pf-studio-nav-icon" />
                    {!sidebarCollapsed && <span className="pf-studio-nav-text">{conf.label}</span>}
                    {count !== null && count > 0 && (
                      <span className="pf-studio-nav-count">{count}</span>
                    )}
                    <span className="pf-nav-tooltip" role="tooltip">
                      <span>{conf.label}</span>
                      {count !== null && count > 0 && (
                        <span className="pf-nav-tooltip-count">({count})</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Center: Section Editor */}
        <section className="pf-studio-editor">
          <div className="pf-studio-editor-head">
            <div className="pf-studio-editor-head-info">
              <span className="pf-studio-panel-label">Section Editor</span>
              <h1>
                {(() => {
                  const conf = SECTION_CONFIG[section] || { label: section, icon: FileText };
                  const HeadIcon = conf.icon;
                  return (
                    <span className="pf-editor-title-wrap">
                      <HeadIcon size={18} className="pf-editor-title-icon" />
                      {conf.label}
                    </span>
                  );
                })()}
              </h1>
              <p className="pf-editor-desc">
                {SECTION_CONFIG[section]?.desc || 'Edit this section for your resume.'}
              </p>
            </div>
            <div className="pf-studio-editor-head-actions">
              {!showPreview && (
                <button
                  type="button"
                  className="pf-open-preview-prompt-btn"
                  onClick={() => setShowPreview(true)}
                  title="Show Live Preview"
                >
                  <Eye size={13} />
                  <span>Show Live Preview</span>
                </button>
              )}
              <div className="pf-studio-source-badge">
                <span className="pf-source-badge-dot" />
                <span>{resume ? 'Live Auto-Sync' : 'Profile Verified'}</span>
              </div>
            </div>
          </div>

          {/* Section: Personal */}
          {section === 'personal' && (
            <div className="pf-studio-record-edit">
              <div className="pf-studio-record-fields">
                <label>
                  Full Name
                  <input
                    value={data.personal?.fullName || ''}
                    onChange={e => update('personal', { ...data.personal, fullName: e.target.value })}
                    placeholder="Full Name"
                  />
                </label>
                <label>
                  Email Address
                  <input
                    value={data.personal?.email || ''}
                    onChange={e => update('personal', { ...data.personal, email: e.target.value })}
                    placeholder="email@kiit.ac.in"
                  />
                </label>
              </div>

              <div className="pf-studio-record-fields">
                <label>
                  Phone Number
                  <input
                    value={data.personal?.phone || ''}
                    onChange={e => update('personal', { ...data.personal, phone: e.target.value })}
                    placeholder="+91 9876543210"
                  />
                </label>
                <label>
                  Location (City, Country)
                  <input
                    value={data.personal?.location || ''}
                    onChange={e => update('personal', { ...data.personal, location: e.target.value })}
                    placeholder="Bhubaneswar, India"
                  />
                </label>
              </div>

              <label className="pf-studio-full-field">
                Headline / Role Target
                <AutoGrowingInput
                  value={data.personal?.headline || ''}
                  onChange={e => update('personal', { ...data.personal, headline: e.target.value })}
                  placeholder="B.Tech in Computer Science | Full-Stack & Cloud"
                />
              </label>

              <label>
                Links <span className="pf-studio-field-hint">LinkedIn, GitHub, Portfolio, LeetCode (one per line)</span>
                <textarea
                  value={(data.personal?.links || []).join('\n')}
                  onChange={e => update('personal', {
                    ...data.personal,
                    links: e.target.value.split('\n').map(l => l.trim()).filter(Boolean)
                  })}
                  rows={4}
                  placeholder="https://linkedin.com/in/...\nhttps://github.com/...\nhttps://myportfolio.dev"
                />
              </label>
            </div>
          )}

          {/* Section: Summary */}
          {section === 'summary' && (
            <div className="pf-studio-field">
              <label>
                Professional Summary
                <textarea
                  value={data.summary?.text || ''}
                  onChange={event => update('summary', { ...(data.summary || {}), text: event.target.value })}
                  rows={8}
                  placeholder="Write a concise ATS-optimized summary highlighting your academic degree, target role, and technical strengths."
                />
              </label>
              <div className="pf-studio-field-hint-card">
                <Sparkles size={14} className="pf-hint-icon" />
                <span>
                  <strong>ATS Guidance:</strong> Highlight your degree, key technical proficiencies (e.g. backend systems, distributed architectures), and notable internship impacts in 3–4 concise sentences.
                </span>
              </div>
            </div>
          )}

          {/* Section: Skills */}
          {section === 'skills' && (
            <div className="pf-studio-field-group">
              <div className="pf-studio-field">
                <label>
                  All Skills
                  <span className="pf-studio-field-hint">Comma-separated list of all core competencies</span>
                  <textarea
                    value={(data.skills?.raw || []).join(', ')}
                    onChange={event => {
                      const rawList = event.target.value.split(',').map(item => item.trim()).filter(Boolean);
                      update('skills', {
                        ...(data.skills || {}),
                        raw: rawList,
                      });
                    }}
                    rows={4}
                    placeholder="Java, Spring Boot, Python, SQL, React, Node.js, AWS, Docker, PostgreSQL"
                  />
                </label>
              </div>

              {/* Categorized overrides */}
              <div className="pf-studio-categories-card">
                <div className="pf-studio-categories-head">
                  <div>
                    <div className="pf-studio-categories-title">
                      <Layers size={15} />
                      <span>Skill Categories (Optional Overrides)</span>
                    </div>
                    <p className="pf-studio-categories-sub">
                      Organize your skills for ATS templates that display categorized sections.
                    </p>
                  </div>
                  <span className="pf-studio-categories-badge">Categorized</span>
                </div>

                <div className="pf-studio-record-fields">
                  <label>
                    Languages
                    <AutoGrowingInput
                      value={(data.skills?.languages || []).join(', ')}
                      onChange={e => update('skills', {
                        ...(data.skills || {}),
                        languages: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      })}
                      placeholder="Java, Python, JavaScript, C++, SQL"
                    />
                  </label>
                  <label>
                    Frameworks & Libraries
                    <AutoGrowingInput
                      value={(data.skills?.frameworks || []).join(', ')}
                      onChange={e => update('skills', {
                        ...(data.skills || {}),
                        frameworks: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      })}
                      placeholder="Spring Boot, React, FastAPI, Node.js"
                    />
                  </label>
                </div>

                <div className="pf-studio-record-fields">
                  <label>
                    Cloud & DevOps
                    <AutoGrowingInput
                      value={(data.skills?.cloudDevOps || []).join(', ')}
                      onChange={e => update('skills', {
                        ...(data.skills || {}),
                        cloudDevOps: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      })}
                      placeholder="AWS, Docker, GitHub Actions, Vercel"
                    />
                  </label>
                  <label>
                    Databases & Tools
                    <AutoGrowingInput
                      value={(data.skills?.databasesTools || []).join(', ')}
                      onChange={e => update('skills', {
                        ...(data.skills || {}),
                        databasesTools: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      })}
                      placeholder="MySQL, PostgreSQL, Redis, Git, Postman"
                    />
                  </label>
                  <label>
                    Core Concepts
                    <AutoGrowingInput
                      value={(data.skills?.coreConcepts || []).join(', ')}
                      onChange={e => update('skills', {
                        ...(data.skills || {}),
                        coreConcepts: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      })}
                      placeholder="Data Structures & Algorithms, OOP, DBMS, Computer Networks, SDLC"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Record sections: Education, Experience, Projects, Certifications, Achievements, Leadership */}
          {RECORD_SECTIONS.includes(section) && (
            <RecordEditor
              section={section}
              records={data[section] || []}
              onChange={(index, patch) => updateRecord(section, index, patch)}
              onAdd={() => addRecord(section)}
              onRemove={index => removeRecord(section, index)}
              onMove={(index, direction) => moveRecord(section, index, direction)}
              onReorder={(fromIdx, toIdx) => reorderRecord(section, fromIdx, toIdx)}
            />
          )}
        </section>

        {/* Right: Live Preview */}
        {showPreview && isFullscreen && <div className="pf-preview-backdrop" onClick={() => setIsFullscreen(false)} />}
        {showPreview && (
          <section className={`pf-studio-preview ${isFullscreen ? 'is-fullscreen' : ''}`}>
            <div className="pf-studio-preview-head">
              <div className="pf-studio-preview-title">
                <span className="pf-pulse-dot" />
                <span className="pf-preview-head-name">Preview</span>
                <span className="pf-preview-format-tag">A4</span>
                <span 
                  className={`pf-preview-page-pill ${pageCount > 1 ? 'is-spill' : 'is-fit'}`} 
                  title={pageCount === 1 ? "Fits within 1 page (A4 standard)" : `Spills into ${pageCount} pages`}
                >
                  {pageCount === 1 ? <Check size={10} /> : <AlertCircle size={10} />}
                  <span>{pageCount === 1 ? '1 Page' : `${pageCount} Pages`}</span>
                </span>
              </div>
              <div className="pf-preview-controls">
                <button
                  type="button"
                  className={`pf-collapse-hint-btn ${sidebarCollapsed ? 'is-collapsed-state' : ''}`}
                  onClick={() => setSidebarCollapsed(prev => !prev)}
                  title={sidebarCollapsed ? "Expand left navigator" : "Collapse left navigator to give preview maximum room"}
                  aria-label={sidebarCollapsed ? "Expand left navigator" : "Collapse left navigator"}
                >
                  {sidebarCollapsed ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}
                  <span className="pf-btn-text-responsive">{sidebarCollapsed ? 'Navigator' : 'Maximize'}</span>
                </button>

                <div className="pf-zoom-group">
                  <button
                    type="button"
                    onClick={() => setZoom(z => Math.max(0.25, Number((z - 0.05).toFixed(2))))}
                    title="Zoom Out"
                    aria-label="Zoom Out"
                  >
                    <ZoomOut size={13} />
                  </button>
                  <span className="pf-zoom-val">{Math.round(zoom * 100)}%</span>
                  <button
                    type="button"
                    onClick={() => setZoom(z => Math.min(1.4, Number((z + 0.05).toFixed(2))))}
                    title="Zoom In"
                    aria-label="Zoom In"
                  >
                    <ZoomIn size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={fitToWidth}
                    title="Fit to Window"
                    aria-label="Fit to Window"
                    className="pf-btn-reset-zoom"
                  >
                    <RotateCcw size={11} />
                    <span>Fit</span>
                  </button>
                </div>

                <button
                  type="button"
                  className="pf-preview-fullscreen-btn"
                  onClick={() => setIsFullscreen(prev => !prev)}
                  title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen Focus Mode"}
                  aria-label={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen Focus Mode"}
                >
                  {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  <span className="pf-btn-text-responsive">{isFullscreen ? 'Exit' : 'Focus'}</span>
                </button>
              </div>
            </div>

            {pageCount > 1 && (
              <div className="pf-preview-spill-banner" role="status">
                <AlertCircle size={13} className="pf-spill-icon" />
                <span>
                  Spilling into <b>Page 2</b>. Trim a bullet or adjust content to fit on a single page.
                </span>
              </div>
            )}

            <div className="pf-studio-paper-wrap" ref={paperWrapRef}>
              <div className="pf-studio-paper-scaler" style={{ zoom }}>
                <Preview
                  data={data}
                  template={template}
                  onPageCountChange={setPageCount}
                  isCompact={isCompact}
                  onCompactChange={setIsCompact}
                  condenseDesc={condenseDesc}
                  onCondenseDescChange={setCondenseDesc}
                />
              </div>
            </div>
          </section>
        )}
      </main>
      )}

      {isSaveAsOpen && createPortal(
        <div className="pf-studio-modal-backdrop" onClick={() => !savingAs && setIsSaveAsOpen(false)}>
          <div className="pf-studio-modal-card" onClick={e => e.stopPropagation()}>
            <div className="pf-studio-modal-header">
              <div className="pf-studio-modal-title">
                <div className="pf-studio-modal-icon-badge">
                  <Copy size={16} />
                </div>
                <div>
                  <h3>Save as New Resume Copy</h3>
                  <p>Fork into a new version or role-specific copy</p>
                </div>
              </div>
              <button
                type="button"
                className="pf-studio-modal-close"
                onClick={() => !savingAs && setIsSaveAsOpen(false)}
                title="Close dialog"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveAsSubmit} className="pf-studio-modal-body">
              <label className="pf-studio-modal-label">
                <span>File Name</span>
                <div className="pf-studio-input-wrap">
                  <input
                    type="text"
                    value={saveAsFilename}
                    onChange={e => setSaveAsFilename(e.target.value)}
                    placeholder="e.g. Aman_Agarwal_Google_SWE.pdf"
                    className="pf-studio-modal-input"
                    required
                    autoFocus
                  />
                </div>
                <small className="pf-studio-input-hint">Will be created in your library without altering your original resume.</small>
              </label>

              <label className="pf-studio-modal-label">
                <span>Category</span>
                <select
                  value={saveAsCategory}
                  onChange={e => setSaveAsCategory(e.target.value)}
                  className="pf-studio-modal-select"
                >
                  <option value="General">General</option>
                  <option value="Frontend">Frontend</option>
                  <option value="Backend">Backend</option>
                  <option value="Full Stack">Full Stack</option>
                  <option value="AI / ML">AI / ML</option>
                  <option value="DevOps">DevOps</option>
                  <option value="Data Science">Data Science</option>
                </select>
              </label>

              <div className="pf-studio-modal-actions">
                <button
                  type="button"
                  className="pf-studio-modal-btn pf-studio-modal-btn--secondary"
                  onClick={() => setIsSaveAsOpen(false)}
                  disabled={savingAs}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pf-studio-modal-btn pf-studio-modal-btn--primary"
                  disabled={savingAs || !saveAsFilename.trim()}
                >
                  {savingAs ? (
                    <>
                      <Loader size={14} className="spin" /> Creating Copy...
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Save New Copy
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Sleek Floating AI Notification Toast */}
      <AiToast
        toast={toast}
        onClose={dismissToast}
        isLeaving={toastLeaving}
      />
    </div>
  );
}

export function ResumeStudioPage() {
  return (
    <ResumeStudioErrorBoundary>
      <ResumeStudioInner />
    </ResumeStudioErrorBoundary>
  );
}
