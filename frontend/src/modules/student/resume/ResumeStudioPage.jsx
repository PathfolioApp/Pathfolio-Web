import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, Check, Download, ExternalLink, FileText, Loader, Plus, RefreshCw, Save, Sparkles, Trash2,
  ChevronDown, User, Code2, Briefcase, FolderGit2, GraduationCap, Award, Trophy, Users, Eye, ZoomIn, ZoomOut, RotateCcw, Layers,
  Maximize2, Minimize2
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { resumeApi } from './resumeApi';
import { profileApi } from '../profile/services/profileApi';
import { profileToResumeData, categorizeSkill } from './profileToResumeData';
import { PdfIcon } from '../../../components/ui/PdfIcon';
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

const SECTIONS = [
  'personal',
  'summary',
  'skills',
  'experience',
  'projects',
  'education',
  'certifications',
  'achievements',
  'leadership',
];

const RECORD_SECTIONS = ['education', 'experience', 'projects', 'certifications', 'achievements', 'leadership'];
const DATE_PATTERN = /(?:[A-Z][a-z]{2,9}\.?\s+)?(?:19|20)\d{2}(?:\s*(?:[\/-]|–|—|to)\s*(?:(?:[A-Z][a-z]{2,9}\.?\s+)?(?:19|20)\d{2}|present|current))?|(?:0?[1-9]|1[0-2])[\/-](?:19|20)\d{2}/i;

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

export function normalizeExtractedData(source, profileData) {
  const data = source && typeof source === 'object' ? source : {};
  const records = key => Array.isArray(data[key]) ? data[key].map(item => {
    const originalTitle = item.title || item.role || item.company || item.institution || item.name || '';
    const sourceText = `${originalTitle} ${item.raw || ''}`;
    const dates = item.dates || sourceText.match(DATE_PATTERN)?.[0] || '';
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
  ].filter(Boolean)
   .map(formatLink)
   .filter((l, i, arr) => arr.indexOf(l) === i);

  const s = data.skills && typeof data.skills === 'object' ? data.skills : {};
  let languages = Array.isArray(s.languages) && s.languages.length ? s.languages : (Array.isArray(s.programming) ? s.programming : []);
  let frameworks = Array.isArray(s.frameworks) ? s.frameworks : [];
  let cloudDevOps = Array.isArray(s.cloudDevOps) && s.cloudDevOps.length ? s.cloudDevOps : (Array.isArray(s.cloudDevops) ? s.cloudDevops : []);
  let databasesTools = Array.isArray(s.databasesTools) && s.databasesTools.length
    ? s.databasesTools
    : [...(Array.isArray(s.data) ? s.data : []), ...(Array.isArray(s.tools) ? s.tools : []), ...(Array.isArray(s.other) ? s.other : [])];

  let rawSkills = Array.isArray(s.raw) && s.raw.length
    ? s.raw
    : [...languages, ...frameworks, ...cloudDevOps, ...databasesTools];

  if (!languages.length && !frameworks.length && !cloudDevOps.length && !databasesTools.length && rawSkills.length) {
    const langSet = new Set();
    const fwSet = new Set();
    const cdSet = new Set();
    const dtSet = new Set();
    for (const skill of rawSkills) {
      const cat = categorizeSkill(skill);
      if (cat === 'languages') langSet.add(skill);
      else if (cat === 'frameworks') fwSet.add(skill);
      else if (cat === 'cloudDevOps') cdSet.add(skill);
      else dtSet.add(skill);
    }
    languages = Array.from(langSet);
    frameworks = Array.from(fwSet);
    cloudDevOps = Array.from(cdSet);
    databasesTools = Array.from(dtSet);
  }

  const dedupe = list => Array.from(new Set((list || []).map(item => String(item).trim()).filter(Boolean)));
  languages = dedupe(languages);
  frameworks = dedupe(frameworks);
  cloudDevOps = dedupe(cloudDevOps);
  databasesTools = dedupe(databasesTools);
  rawSkills = dedupe(rawSkills.length ? rawSkills : [...languages, ...frameworks, ...cloudDevOps, ...databasesTools]);

  return {
    personal: {
      fullName: data.personal?.fullName || '',
      email: data.personal?.email || '',
      phone: data.personal?.phone || '',
      headline: data.personal?.headline || '',
      location: data.personal?.location || '',
      links: rawLinks,
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
      programming: languages,
      cloudDevops: cloudDevOps,
      data: databasesTools,
      raw: rawSkills,
    },
  };
}

function value(item, keys) {
  for (const key of keys) {
    if (item?.[key]) return item[key];
  }
  return '';
}

function recordMeta(item) {
  const title = value(item, ['title', 'role', 'name']);
  const organization = value(item, ['company', 'institution']);
  const location = item?.location || '';
  const dates = item?.dates || item?.date || item?.year || '';

  const parts = [];
  if (organization && organization !== title) parts.push(organization);
  if (location) parts.push(location);
  if (dates) parts.push(dates);

  return parts.filter(Boolean).join(' · ');
}

function recordDescription(item) {
  if (item?.description || item?.summary) return item.description || item.summary;
  return item?.bullets?.length ? '' : item?.raw || '';
}

function formatLinkDisplay(url) {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '') + (parsed.pathname !== '/' ? parsed.pathname : '');
  } catch {
    return url;
  }
}

export function Preview({ data, template }) {
  const personal = data.personal || {};
  const skillsObj = data.skills || {};

  // Check if we have categorized skills
  const hasCategories = Boolean(
    (skillsObj.languages?.length || 0) +
    (skillsObj.frameworks?.length || 0) +
    (skillsObj.cloudDevOps?.length || 0) +
    (skillsObj.databasesTools?.length || 0)
  );

  const rawSkills = Array.isArray(skillsObj.raw) ? skillsObj.raw : [];

  return (
    <article className={`pf-studio-paper pf-studio-paper--${template}`}>
      <header>
        <h1>{personal.fullName || 'Candidate Name'}</h1>
        <p>
          {[personal.email, personal.phone, personal.location].filter(Boolean).join(' | ')}
        </p>
        {personal.links?.length > 0 && (
          <p className="pf-paper-links">
            {personal.links.map((link, idx) => (
              <span key={idx}>
                {idx > 0 && ' | '}
                <a href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noopener noreferrer">
                  {formatLinkDisplay(link)}
                </a>
              </span>
            ))}
          </p>
        )}
        {personal.headline && <strong>{personal.headline}</strong>}
      </header>

      {data.summary?.text && (
        <section>
          <h2>Professional Summary</h2>
          <p>{data.summary.text}</p>
        </section>
      )}

      {/* Skills Section */}
      {(hasCategories || rawSkills.length > 0) && (
        <section>
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
              {skillsObj.tools?.length > 0 && (
                <p><b>Other Tools:</b> {skillsObj.tools.join(', ')}</p>
              )}
            </div>
          ) : (
            <p>{rawSkills.join(' | ')}</p>
          )}
        </section>
      )}

      {/* Experience */}
      {data.experience?.length > 0 && (
        <section>
          <h2>Experience</h2>
          {data.experience.map((item, index) => (
            <div className="pf-studio-entry" key={item.id || index}>
              <b>{value(item, ['title', 'role']) || 'Experience'}</b>
              <span>{recordMeta(item)}</span>
              {recordDescription(item) && <p>{recordDescription(item)}</p>}
              {item.bullets?.length > 0 && (
                <ul>
                  {item.bullets.map((bullet, bulletIndex) => (
                    <li key={bulletIndex}>{bullet}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Projects */}
      {data.projects?.length > 0 && (
        <section>
          <h2>Projects</h2>
          {data.projects.map((item, index) => (
            <div className="pf-studio-entry" key={item.id || index}>
              <div className="pf-paper-entry-title-row">
                <b>{value(item, ['title', 'name', 'projectName']) || 'Project'}</b>
                {item.liveUrl && (
                  <span className="pf-paper-project-link">
                    <a href={item.liveUrl.startsWith('http') ? item.liveUrl : `https://${item.liveUrl}`} target="_blank" rel="noopener noreferrer">
                      {formatLinkDisplay(item.liveUrl)}
                    </a>
                  </span>
                )}
                {item.repoUrl && item.repoUrl !== item.liveUrl && (
                  <span className="pf-paper-project-link">
                    <a href={item.repoUrl.startsWith('http') ? item.repoUrl : `https://${item.repoUrl}`} target="_blank" rel="noopener noreferrer">
                      {formatLinkDisplay(item.repoUrl)}
                    </a>
                  </span>
                )}
              </div>
              <span>{recordMeta(item)}</span>
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
          ))}
        </section>
      )}

      {/* Education */}
      {data.education?.length > 0 && (
        <section>
          <h2>Education</h2>
          {data.education.map((item, index) => (
            <div className="pf-studio-entry" key={item.id || index}>
              <b>{value(item, ['title', 'degreeProgram', 'name']) || item.institution || 'Degree'}</b>
              <span>{recordMeta(item)}</span>
              {recordDescription(item) && <p>{recordDescription(item)}</p>}
              {item.bullets?.length > 0 && (
                <ul>
                  {item.bullets.map((bullet, bulletIndex) => (
                    <li key={bulletIndex}>{bullet}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Certifications */}
      {data.certifications?.length > 0 && (
        <section>
          <h2>Certifications</h2>
          {data.certifications.map((item, index) => (
            <div className="pf-studio-entry" key={item.id || index}>
              <b>{value(item, ['title', 'name'])}</b>
              <span>{recordMeta(item)}</span>
              {recordDescription(item) && <p>{recordDescription(item)}</p>}
            </div>
          ))}
        </section>
      )}

      {/* Achievements / Awards */}
      {data.achievements?.length > 0 && (
        <section>
          <h2>Achievements & Awards</h2>
          {data.achievements.map((item, index) => (
            <div className="pf-studio-entry" key={item.id || index}>
              <b>{value(item, ['title', 'name'])}</b>
              <span>{recordMeta(item)}</span>
              {recordDescription(item) && <p>{recordDescription(item)}</p>}
            </div>
          ))}
        </section>
      )}

      {/* Leadership */}
      {data.leadership?.length > 0 && (
        <section>
          <h2>Leadership & Activities</h2>
          {data.leadership.map((item, index) => (
            <div className="pf-studio-entry" key={item.id || index}>
              <b>{value(item, ['title', 'name'])}</b>
              <span>{recordMeta(item)}</span>
              {recordDescription(item) && <p>{recordDescription(item)}</p>}
            </div>
          ))}
        </section>
      )}
    </article>
  );
}

function printable(data, template) {
  const escapeHtml = input => String(input || '').replace(/[&<>\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char]));
  const personal = data.personal || {};
  const skillsObj = data.skills || {};

  const hasCategories = Boolean(
    (skillsObj.languages?.length || 0) +
    (skillsObj.frameworks?.length || 0) +
    (skillsObj.cloudDevOps?.length || 0) +
    (skillsObj.databasesTools?.length || 0)
  );

  let skillsBlock = '';
  if (hasCategories) {
    const cats = [];
    if (skillsObj.languages?.length) cats.push(`<p><b>Languages:</b> ${escapeHtml(skillsObj.languages.join(', '))}</p>`);
    if (skillsObj.frameworks?.length) cats.push(`<p><b>Frameworks & Libraries:</b> ${escapeHtml(skillsObj.frameworks.join(', '))}</p>`);
    if (skillsObj.cloudDevOps?.length) cats.push(`<p><b>Cloud & DevOps:</b> ${escapeHtml(skillsObj.cloudDevOps.join(', '))}</p>`);
    if (skillsObj.databasesTools?.length) cats.push(`<p><b>Databases & Tools:</b> ${escapeHtml(skillsObj.databasesTools.join(', '))}</p>`);
    skillsBlock = `<section><h2>Technical Skills</h2>${cats.join('')}</section>`;
  } else if (skillsObj.raw?.length) {
    skillsBlock = `<section><h2>Technical Skills</h2><p>${escapeHtml(skillsObj.raw.join(' | '))}</p></section>`;
  }

  const block = (key, title) => data[key]?.length ? `<section><h2>${title}</h2>${data[key].map(item => {
    let projectLinks = '';
    if (key === 'projects') {
      if (item.liveUrl) projectLinks += `<span style="margin-left:8px;font-size:0.85em;"><a href="${escapeHtml(item.liveUrl.startsWith('http') ? item.liveUrl : 'https://'+item.liveUrl)}" target="_blank">${escapeHtml(formatLinkDisplay(item.liveUrl))}</a></span>`;
      if (item.repoUrl && item.repoUrl !== item.liveUrl) projectLinks += `<span style="margin-left:8px;font-size:0.85em;"><a href="${escapeHtml(item.repoUrl.startsWith('http') ? item.repoUrl : 'https://'+item.repoUrl)}" target="_blank">${escapeHtml(formatLinkDisplay(item.repoUrl))}</a></span>`;
    }
    return `
    <div class="entry">
      <b>${escapeHtml(value(item, ['title', 'role', 'company', 'institution', 'name']))}</b>${projectLinks}
      <span>${escapeHtml(recordMeta(item))}</span>
      ${item.technologies ? `<p class="tech"><b>Tech Stack:</b> ${escapeHtml(item.technologies)}</p>` : ''}
      ${recordDescription(item) ? `<p>${escapeHtml(recordDescription(item))}</p>` : ''}
      ${item.bullets?.length ? `<ul>${item.bullets.map(bullet => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>` : ''}
    </div>`;
  }).join('')}</section>` : '';

  const contactLine = [personal.email, personal.phone, personal.location].filter(Boolean).map(escapeHtml).join(' | ');
  const linksLine = (personal.links || []).map(l => `<a href="${escapeHtml(l)}">${escapeHtml(formatLinkDisplay(l))}</a>`).join(' | ');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(personal.fullName || 'Resume')}</title>
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
      - Left/Right: body padding — layout-level, permanent
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
    .head a { color: #264e36; text-decoration: none; }
    .head strong {
      color: #264e36;
      font-size: 8.8pt;
      display: block;
      margin-top: 2pt;
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
    .entry b { display: block; font-size: 8.8pt; color: #1d2921; line-height: 1.25; }
    .entry span { font-size: 8pt; color: #55665a; display: block; margin-bottom: 1pt; }
    .entry p { margin: 1.5pt 0; font-size: 8.4pt; line-height: 1.3; }
    .tech { font-size: 8pt; color: #264e36; margin: 1pt 0; }
    ul { margin: 1.5pt 0 3pt 13pt; padding: 0; }
    li { font-size: 8.4pt; line-height: 1.32; margin-bottom: 1pt; }
    .modern .head { text-align: left; background: #edf4ee !important; padding: 8pt 10pt; border-radius: 4px; border: 0; }
    .modern h2, .technical h2 { color: #8b4f25; border-color: #e1c8b8; }
    .compact { font-size: 8pt; }
    .compact section { margin-top: 5pt; }
    .compact .entry { margin-bottom: 3pt; }
    .technical .head { text-align: left; border-left: 4pt solid #8b4f25; border-bottom: 0; padding-left: 8pt; }
    .editorial { font-family: Georgia, serif; }
    .editorial h2 { font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; }
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
          <main class="resume ${template}">
            <header class="head">
              <h1>${escapeHtml(personal.fullName || 'Candidate')}</h1>
              <p>${contactLine}</p>
              ${linksLine ? `<p>${linksLine}</p>` : ''}
              ${personal.headline ? `<strong>${escapeHtml(personal.headline)}</strong>` : ''}
            </header>
            ${data.summary?.text ? `<section><h2>Professional Summary</h2><p>${escapeHtml(data.summary.text)}</p></section>` : ''}
            ${skillsBlock}
            ${block('experience', 'Experience')}
            ${block('projects', 'Projects')}
            ${block('education', 'Education')}
            ${block('certifications', 'Certifications')}
            ${block('achievements', 'Achievements & Awards')}
            ${block('leadership', 'Leadership & Activities')}
          </main>
        </td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;
}

function RecordEditor({ section, records, onChange, onAdd, onRemove }) {
  const label = section === 'education' ? 'Education' :
                section === 'certifications' ? 'Certification' :
                section === 'achievements' ? 'Achievement' :
                section === 'leadership' ? 'Role' :
                section.slice(0, -1);

  return (
    <div className="pf-studio-record-editor">
      {records.map((item, index) => (
        <article className="pf-studio-record-edit" key={item.id || index}>
          <div className="pf-studio-record-edit-head">
            <b>{value(item, ['title', 'role', 'projectName', 'company', 'institution']) || `New ${label} entry`}</b>
            <button type="button" onClick={() => onRemove(index)} title={`Remove ${label}`}>
              <Trash2 size={14} />
            </button>
          </div>

          <div className="pf-studio-record-fields">
            <label>
              {section === 'education' ? 'Degree & Major' : section === 'experience' ? 'Job Title / Role' : section === 'projects' ? 'Project Name' : 'Title'}
              <input
                value={item.title || item.role || item.projectName || ''}
                onChange={event => onChange(index, {
                  title: event.target.value,
                  role: event.target.value,
                  projectName: event.target.value
                })}
                placeholder={section === 'education' ? 'B.Tech in Computer Science' : section === 'experience' ? 'Software Engineering Intern' : 'Project Title'}
              />
            </label>

            <label>
              {section === 'education' ? 'Institution' : section === 'experience' ? 'Company Name' : section === 'projects' ? 'Project Type' : 'Issuer / Category'}
              <input
                value={item.company || item.institution || item.role || ''}
                onChange={event => onChange(index, {
                  company: event.target.value,
                  institution: event.target.value,
                  role: section === 'projects' ? event.target.value : item.role
                })}
                placeholder={section === 'education' ? 'KIIT University' : section === 'experience' ? 'Google' : 'Academic / Personal'}
              />
            </label>
          </div>

          <div className="pf-studio-record-fields">
            <label>
              Dates / Period
              <input
                value={item.dates || item.year || ''}
                onChange={event => onChange(index, { dates: event.target.value, year: event.target.value })}
                placeholder="Aug 2026 – Present"
              />
            </label>

            <label>
              Location / Mode
              <input
                value={item.location || ''}
                onChange={event => onChange(index, { location: event.target.value })}
                placeholder="Bengaluru · On-site"
              />
            </label>
          </div>

          {section === 'projects' && (
            <>
              <label>
                Technologies / Tech Stack
                <input
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
            Description / Context
            <textarea
              value={item.description || ''}
              onChange={event => onChange(index, { description: event.target.value })}
              placeholder="Summary of responsibilities or context"
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

export function ResumeStudioPage() {
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
  const [zoom, setZoom] = useState(0.70);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const paperWrapRef = React.useRef(null);

  const fitToWidth = React.useCallback(() => {
    if (!paperWrapRef.current) return;
    const availableWidth = paperWrapRef.current.clientWidth - 48;
    const paperWidthPx = 794;
    if (availableWidth > 120) {
      const targetZoom = Math.min(1.05, Math.max(0.4, Number((availableWidth / paperWidthPx).toFixed(2))));
      setZoom(targetZoom);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(fitToWidth, 80);
    window.addEventListener('resize', fitToWidth);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', fitToWidth);
    };
  }, [fitToWidth]);

  useEffect(() => {
    const timer = setTimeout(fitToWidth, 100);
    return () => clearTimeout(timer);
  }, [isFullscreen, fitToWidth]);

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

          if (resumeId) {
            const found = resumes.find(item => String(item.id) === String(resumeId));
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
    const htmlContent = printable(data, template);

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
        </div>

        <div className="pf-studio-top-actions">
          {data && (
            <button
              type="button"
              className="pf-studio-sync-btn"
              onClick={handleSyncFromProfile}
              title="Auto-generate or re-sync all sections from your verified student profile table"
            >
              <RefreshCw size={14} /> Sync from Profile
            </button>
          )}

          <button type="button" className="pf-studio-btn-save" onClick={save} disabled={saving || !data}>
            <Save size={14} /> {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Edits'}
          </button>

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
        <main className="pf-studio-grid">
        {/* Left Sidebar: Templates & Navigation */}
        <aside className="pf-studio-sidebar">
          <div className="pf-studio-sidebar-block">
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
          </div>

          <div className="pf-sidebar-divider" />

          <div className="pf-studio-sidebar-block">
            <div className="pf-studio-panel-label">
              <span>Content Sections</span>
            </div>
            <nav className="pf-studio-section-nav">
              {SECTIONS.map(item => {
                const conf = SECTION_CONFIG[item] || { label: item, icon: FileText };
                const IconComponent = conf.icon;
                const count = Array.isArray(data[item]) ? data[item].length : null;

                return (
                  <button
                    type="button"
                    key={item}
                    className={`pf-studio-nav-item ${section === item ? 'is-active' : ''}`}
                    onClick={() => setSection(item)}
                    title={conf.label}
                    aria-label={conf.label}
                  >
                    <IconComponent size={15} className="pf-studio-nav-icon" />
                    <span className="pf-studio-nav-text">{conf.label}</span>
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
            <div className="pf-studio-source-badge">
              <span className="pf-source-badge-dot" />
              <span>{resume ? 'Live Auto-Sync' : 'Profile Verified'}</span>
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
                  Headline / Role Target
                  <input
                    value={data.personal?.headline || ''}
                    onChange={e => update('personal', { ...data.personal, headline: e.target.value })}
                    placeholder="B.Tech in Computer Science | Full-Stack & Cloud"
                  />
                </label>
              </div>

              <div className="pf-studio-record-fields">
                <label>
                  Email Address
                  <input
                    value={data.personal?.email || ''}
                    onChange={e => update('personal', { ...data.personal, email: e.target.value })}
                    placeholder="email@kiit.ac.in"
                  />
                </label>
                <label>
                  Phone Number
                  <input
                    value={data.personal?.phone || ''}
                    onChange={e => update('personal', { ...data.personal, phone: e.target.value })}
                    placeholder="+91 9876543210"
                  />
                </label>
              </div>

              <label>
                Location (City, Country)
                <input
                  value={data.personal?.location || ''}
                  onChange={e => update('personal', { ...data.personal, location: e.target.value })}
                  placeholder="Bhubaneswar, India"
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
                    <input
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
                    <input
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
                    <input
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
                    <input
                      value={(data.skills?.databasesTools || []).join(', ')}
                      onChange={e => update('skills', {
                        ...(data.skills || {}),
                        databasesTools: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      })}
                      placeholder="MySQL, PostgreSQL, Redis, Git, Postman"
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
            />
          )}
        </section>

        {/* Right: Live Preview */}
        {isFullscreen && <div className="pf-preview-backdrop" onClick={() => setIsFullscreen(false)} />}
        <section className={`pf-studio-preview ${isFullscreen ? 'is-fullscreen' : ''}`}>
          <div className="pf-studio-preview-head">
            <div className="pf-studio-preview-title">
              <span className="pf-pulse-dot" />
              <span>Real-Time Preview</span>
              <span className="pf-preview-format-tag">A4</span>
            </div>
            <div className="pf-preview-controls">
              <span className="pf-preview-template-pill">
                {TEMPLATES.find(t => t[0] === template)?.[1] || 'Classic'}
              </span>
              <div className="pf-zoom-group">
                <button
                  type="button"
                  onClick={() => setZoom(z => Math.max(0.4, Number((z - 0.05).toFixed(2))))}
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
                <span>{isFullscreen ? 'Exit' : 'Expand'}</span>
              </button>
            </div>
          </div>
          <div className="pf-studio-paper-wrap" ref={paperWrapRef}>
            <div className="pf-studio-paper-scaler" style={{ zoom }}>
              <Preview data={data} template={template} />
            </div>
          </div>
        </section>
      </main>
      )}
    </div>
  );
}
