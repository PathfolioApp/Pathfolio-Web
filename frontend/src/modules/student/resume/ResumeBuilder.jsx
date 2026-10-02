import React, { useMemo, useState } from 'react';
import { Download, FileText, Printer, Sparkles } from 'lucide-react';
import { useAuth } from '../../../app/providers/AuthProvider';
import './ResumeBuilder.css';

const TEMPLATES = [
  { id: 'classic', name: 'Classic', note: 'Balanced and recruiter familiar' },
  { id: 'modern', name: 'Modern', note: 'Clean hierarchy for tech roles' },
  { id: 'compact', name: 'Compact', note: 'More signal in one page' },
  { id: 'technical', name: 'Technical', note: 'Skills-forward engineering layout' },
  { id: 'editorial', name: 'Editorial', note: 'Polished for product and design' },
];

const safe = value => String(value || '').replace(/[&<>\"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[character]));
const list = value => Array.isArray(value) ? value : [];

function profileData(student) {
  const personal = student?.personal || {};
  const academic = student?.academic || {};
  const social = student?.social || {};
  return {
    name: personal.fullName || 'Your Name',
    email: personal.email || student?.email || 'you@example.com',
    phone: personal.phone || '',
    headline: academic.degreeProgram || academic.department || 'Student',
    summary: `Motivated ${academic.degreeProgram || 'student'} building practical experience through projects, internships, and continuous learning.`,
    skills: list(student?.skills).length ? student.skills : list(student?.interests?.hobbies).map(item => typeof item === 'string' ? item : item.name),
    projects: list(student?.projects).slice(0, 3),
    internships: list(student?.internships).slice(0, 2),
    links: list(social.links),
    education: academic.degreeProgram || academic.department ? `${academic.degreeProgram || academic.department}${academic.graduationYear ? ` | Class of ${academic.graduationYear}` : ''}` : 'Add your education in Profile',
  };
}

function ResumePreview({ data, template }) {
  return (
    <article className={`resume-builder-paper resume-builder-paper--${template}`}>
      <header className="resume-paper-header">
        <h3>{data.name}</h3>
        <p>{[data.email, data.phone, ...data.links.map(link => link.url)].filter(Boolean).join('  |  ')}</p>
        <strong>{data.headline}</strong>
      </header>
      <section><h4>Profile</h4><p>{data.summary}</p></section>
      {data.skills.length > 0 && <section><h4>Skills</h4><p>{data.skills.join('  |  ')}</p></section>}
      {data.internships.length > 0 && <section><h4>Experience</h4>{data.internships.map((item, index) => <div className="resume-paper-entry" key={item.id || index}><b>{item.role || item.title || 'Experience'}</b><span>{item.company || item.organization || ''}</span><p>{item.description || item.summary || 'Add a concise impact statement for this experience.'}</p></div>)}</section>}
      {data.projects.length > 0 && <section><h4>Projects</h4>{data.projects.map((item, index) => <div className="resume-paper-entry" key={item.id || index}><b>{item.title || item.name || 'Project'}</b><span>{item.techStack || item.technologies || ''}</span><p>{item.description || 'Add a concise description with the result or outcome.'}</p></div>)}</section>}
      <section><h4>Education</h4><p>{data.education}</p></section>
    </article>
  );
}

function buildPrintableHtml(data, template) {
  const text = value => safe(value).replace(/\n/g, '<br>');
  const entries = (items, title, getTitle, getMeta, getDescription) => items.length ? `<section><h2>${title}</h2>${items.map(item => `<div class="entry"><b>${text(getTitle(item))}</b><span>${text(getMeta(item))}</span><p>${text(getDescription(item))}</p></div>`).join('')}</section>` : '';
  return `<!doctype html><html><head><title>${safe(data.name)} Resume</title><style>@page{size:A4;margin:13mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#1d2921;font-size:10.5pt;line-height:1.35;margin:0}.resume{max-width:760px;margin:auto}.header{text-align:center;border-bottom:2px solid #264e36;padding-bottom:10px}.header h1{font-size:25px;margin:0 0 4px}.header p{margin:3px 0;color:#4e6052}.header strong{color:#264e36;font-size:11px}section{margin-top:12px}h2{font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#264e36;border-bottom:1px solid #cbd6c8;padding-bottom:3px;margin:0 0 5px}.entry{margin:0 0 6px}.entry b{display:block}.entry span{display:block;color:#5f6b65;font-size:9pt}.entry p,section>p{margin:2px 0}.modern .header{text-align:left;border-bottom:0;background:#edf4ee;padding:16px}.modern h2{color:#8b4f25;border-bottom-color:#e1c8b8}.compact{font-size:9.3pt}.compact section{margin-top:8px}.compact .header{padding-bottom:6px}.technical .header{text-align:left;border-left:5px solid #8b4f25;padding-left:12px}.technical h2{color:#8b4f25}.editorial{font-family:Georgia,serif}.editorial .header h1{font-weight:400}.editorial h2{font-family:Arial,sans-serif;font-size:10px}</style></head><body><main class="resume ${template}"><header class="header"><h1>${text(data.name)}</h1><p>${text([data.email, data.phone, ...data.links.map(link => link.url)].filter(Boolean).join('  |  '))}</p><strong>${text(data.headline)}</strong></header><section><h2>Profile</h2><p>${text(data.summary)}</p></section>${data.skills.length ? `<section><h2>Skills</h2><p>${text(data.skills.join('  |  '))}</p></section>` : ''}${entries(data.internships, 'Experience', item => item.role || item.title || 'Experience', item => item.company || item.organization || '', item => item.description || item.summary || 'Add a concise impact statement for this experience.')}${entries(data.projects, 'Projects', item => item.title || item.name || 'Project', item => item.techStack || item.technologies || '', item => item.description || 'Add a concise description with the result or outcome.')}<section><h2>Education</h2><p>${text(data.education)}</p></section></main><script>window.onload=()=>window.print()</script></body></html>`;
}

export function ResumeBuilder() {
  const { student } = useAuth();
  const [template, setTemplate] = useState('classic');
  const [summary, setSummary] = useState('');
  const data = useMemo(() => ({ ...profileData(student), ...(summary ? { summary } : {}) }), [student, summary]);
  const selected = TEMPLATES.find(item => item.id === template);

  const printResume = () => {
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    if (!popup) return;
    popup.document.write(buildPrintableHtml(data, template));
    popup.document.close();
  };

  return (
    <section className="resume-builder">
      <div className="resume-builder-heading">
        <div><span className="resume-builder-kicker"><Sparkles size={14} /> Resume studio</span><h2>Build an ATS-ready one-pager</h2><p>Choose a layout, tune your summary, then print it to PDF for applications.</p></div>
        <button className="resume-builder-primary" type="button" onClick={printResume}><Printer size={16} /> Use this resume</button>
      </div>
      <div className="resume-builder-layout">
        <aside className="resume-builder-controls">
          <label>Templates</label>
          <div className="resume-template-list">{TEMPLATES.map(item => <button type="button" key={item.id} className={template === item.id ? 'is-selected' : ''} onClick={() => setTemplate(item.id)}><span><FileText size={16} />{item.name}</span><small>{item.note}</small></button>)}</div>
          <label htmlFor="resume-summary">Professional summary</label>
          <textarea id="resume-summary" value={summary || data.summary} onChange={event => setSummary(event.target.value)} rows={6} maxLength={360} />
          <small className="resume-builder-hint">Your profile, projects, experience, skills, and education are pulled from the student profile.</small>
        </aside>
        <div className="resume-builder-preview-wrap"><div className="resume-builder-preview-label"><span>Preview</span><b>{selected.name}</b><button type="button" onClick={printResume} title="Download or print resume"><Download size={16} /></button></div><ResumePreview data={data} template={template} /></div>
      </div>
    </section>
  );
}
