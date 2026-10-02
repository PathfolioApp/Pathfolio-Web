import React, { useEffect, useState } from 'react';
import { ArrowLeft, Download, FileText, Loader, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { resumeApi } from './resumeApi';
import './ResumeStudioPage.css';
import './ResumeStudioFields.css';

const TEMPLATES = [
  ['classic', 'Classic', 'Traditional single column'],
  ['modern', 'Modern', 'Clear hierarchy'],
  ['compact', 'Compact', 'Space-efficient'],
  ['technical', 'Technical', 'Engineering focused'],
  ['editorial', 'Editorial', 'Refined typography'],
];
const SECTIONS = ['summary', 'education', 'experience', 'projects', 'skills', 'certifications', 'achievements', 'leadership'];
const RECORD_SECTIONS = ['education', 'experience', 'projects', 'certifications', 'achievements', 'leadership'];
const DATE_PATTERN = /(?:[A-Z][a-z]{2,9}\.?\s+)?(?:19|20)\d{2}(?:\s*(?:[\/-]|–|—|to)\s*(?:(?:[A-Z][a-z]{2,9}\.?\s+)?(?:19|20)\d{2}|present|current))?|(?:0?[1-9]|1[0-2])[\/-](?:19|20)\d{2}/i;

function normalizeExtractedData(source) {
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
  const skills = data.skills && typeof data.skills === 'object'
    ? Object.fromEntries(Object.entries(data.skills).map(([key, items]) => [key, Array.isArray(items) ? items.filter(Boolean) : []]))
    : { raw: [] };
  if (!Array.isArray(skills.raw)) skills.raw = Object.values(skills).flat();
  return {
    personal: { ...(data.personal || {}), links: Array.isArray(data.personal?.links) ? data.personal.links : [] },
    summary: { ...(data.summary || {}), text: data.summary?.text || '' },
    education: records('education'), experience: records('experience'), projects: records('projects'),
    certifications: records('certifications'), achievements: records('achievements'), leadership: records('leadership'), skills,
  };
}

function value(item, keys) {
  for (const key of keys) if (item?.[key]) return item[key];
  return '';
}

function recordMeta(item) {
  const title = value(item, ['title', 'role', 'name']);
  const organization = value(item, ['company', 'institution']);
  return [organization && organization !== title ? organization : '', item?.dates || item?.date || ''].filter(Boolean).join(' · ');
}

function recordDescription(item) {
  if (item?.description || item?.summary) return item.description || item.summary;
  return item?.bullets?.length ? '' : item?.raw || '';
}

function Preview({ data, template }) {
  const groupedSkills = Object.entries(data.skills || {})
    .filter(([key, items]) => key !== 'raw' && Array.isArray(items) && items.length)
    .flatMap(([, items]) => items);
  const skills = groupedSkills.length ? groupedSkills : data.skills?.raw || [];
  const sections = [['experience', 'Experience'], ['projects', 'Projects'], ['education', 'Education'], ['certifications', 'Certifications'], ['achievements', 'Achievements'], ['leadership', 'Leadership']];

  return <article className={`pf-studio-paper pf-studio-paper--${template}`}>
    <header><h1>{data.personal?.fullName || ' '}</h1><p>{[data.personal?.email, data.personal?.phone, ...(data.personal?.links || [])].filter(Boolean).join(' | ')}</p><strong>{data.personal?.headline || ' '}</strong></header>
    {data.summary?.text && <section><h2>Summary</h2><p>{data.summary.text}</p></section>}
    {skills.length > 0 && <section><h2>Skills</h2><p>{skills.join(' | ')}</p></section>}
    {sections.map(([key, title]) => data[key]?.length > 0 && <section key={key}><h2>{title}</h2>{data[key].map((item, index) => <div className="pf-studio-entry" key={item.id || index}><b>{value(item, ['title', 'role', 'company', 'institution', 'name']) || ' '}</b><span>{recordMeta(item)}</span>{recordDescription(item) && <p>{recordDescription(item)}</p>}{item.bullets?.length > 0 && <ul>{item.bullets.map((bullet, bulletIndex) => <li key={bulletIndex}>{bullet}</li>)}</ul>}</div>)}</section>)}
  </article>;
}

function printable(data, template) {
  const escapeHtml = input => String(input || '').replace(/[&<>\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char]));
  const groupedSkills = Object.entries(data.skills || {}).filter(([key, items]) => key !== 'raw' && Array.isArray(items) && items.length).flatMap(([, items]) => items);
  const skills = groupedSkills.length ? groupedSkills : data.skills?.raw || [];
  const block = (key, title) => data[key]?.length ? `<section><h2>${title}</h2>${data[key].map(item => `<div class="entry"><b>${escapeHtml(value(item, ['title', 'role', 'company', 'institution', 'name']))}</b><span>${escapeHtml(recordMeta(item))}</span>${recordDescription(item) ? `<p>${escapeHtml(recordDescription(item))}</p>` : ''}${item.bullets?.length ? `<ul>${item.bullets.map(bullet => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>` : ''}</div>`).join('')}</section>` : '';
  return `<!doctype html><html><head><title>${escapeHtml(data.personal?.fullName)} resume</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#1d2921;font-size:10pt;line-height:1.35;margin:0}.resume{max-width:780px;margin:auto}.head{text-align:center;border-bottom:2px solid #264e36;padding-bottom:9px}.head h1{font-size:24px;margin:0 0 3px}.head p{margin:2px 0;color:#526257}.head strong{color:#264e36}section{margin-top:11px}h2{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#264e36;border-bottom:1px solid #cbd6c8;padding-bottom:3px;margin:0 0 4px}.entry{margin-bottom:6px}.entry b,.entry span{display:block}.entry span{font-size:9px;color:#627166}.entry p{margin:2px 0}.modern .head{text-align:left;background:#edf4ee;padding:13px;border:0}.modern h2,.technical h2{color:#8b4f25;border-color:#e1c8b8}.compact{font-size:9px}.compact section{margin-top:7px}.technical .head{text-align:left;border-left:5px solid #8b4f25;padding-left:10px}.editorial{font-family:Georgia,serif}.editorial h2{font-family:Arial,sans-serif}</style></head><body><main class="resume ${template}"><header class="head"><h1>${escapeHtml(data.personal?.fullName)}</h1><p>${escapeHtml([data.personal?.email, data.personal?.phone, ...(data.personal?.links || [])].filter(Boolean).join(' | '))}</p><strong>${escapeHtml(data.personal?.headline)}</strong></header>${data.summary?.text ? `<section><h2>Summary</h2><p>${escapeHtml(data.summary.text)}</p></section>` : ''}${skills.length ? `<section><h2>Skills</h2><p>${escapeHtml(skills.join(' | '))}</p></section>` : ''}${block('experience', 'Experience')}${block('projects', 'Projects')}${block('education', 'Education')}${block('certifications', 'Certifications')}${block('achievements', 'Achievements')}${block('leadership', 'Leadership')}</main><script>window.onload=()=>window.print()</script></body></html>`;
}

function RecordEditor({ section, records, onChange, onAdd, onRemove }) {
  const label = section.slice(0, -1);
  return <div className="pf-studio-record-editor">
    {records.map((item, index) => <article className="pf-studio-record-edit" key={item.id || index}>
      <div className="pf-studio-record-edit-head"><b>{value(item, ['title', 'role', 'company', 'institution']) || `New ${label} entry`}</b><button type="button" onClick={() => onRemove(index)} title={`Remove ${label}`}><Trash2 size={14} /></button></div>
      <div className="pf-studio-record-fields"><label>Title or organisation<input value={value(item, ['title', 'role', 'company', 'institution'])} onChange={event => onChange(index, { title: event.target.value, role: event.target.value, company: section === 'experience' ? event.target.value : item.company, institution: section === 'education' ? event.target.value : item.institution })} placeholder={section === 'education' ? 'Institution or degree' : section === 'experience' ? 'Job title or company' : 'Project name'} /></label><label>Dates<input value={item.dates || ''} onChange={event => onChange(index, { dates: event.target.value })} placeholder="2024 - 2026" /></label></div>
      <label>Description<textarea value={item.description || ''} onChange={event => onChange(index, { description: event.target.value })} placeholder="Context, responsibilities, or outcome" rows={3} /></label>
      <label>Achievement bullets <span className="pf-studio-field-hint">one per line</span><textarea value={(item.bullets || []).join('\n')} onChange={event => onChange(index, { bullets: event.target.value.split('\n').map(line => line.replace(/^[-*•]\s*/, '').trim()).filter(Boolean) })} placeholder="Built...\nImproved...\nReduced..." rows={4} /></label>
    </article>)}
    <button type="button" className="pf-studio-add" onClick={onAdd}><Plus size={15} /> Add {label}</button>
  </div>;
}

export function ResumeStudioPage() {
  const { resumeId } = useParams();
  const navigate = useNavigate();
  const [resume, setResume] = useState(null);
  const [data, setData] = useState(null);
  const [template, setTemplate] = useState('classic');
  const [section, setSection] = useState('summary');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const resumes = await resumeApi.list();
        const found = resumeId ? resumes.find(item => String(item.id) === String(resumeId)) : resumes.find(item => item.isDefault) || resumes[0];
        if (active) { setResume(found || null); setData(found ? normalizeExtractedData(found.extractedData || found.analysis?.structured) : null); if (!found) setError('This resume could not be found.'); }
      } catch (err) { if (active) setError(err.message || 'Unable to load Studio.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [resumeId]);

  const update = (key, valueToSet) => setData(current => ({ ...current, [key]: valueToSet }));
  const updateRecord = (key, index, patch) => setData(current => ({ ...current, [key]: (current[key] || []).map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  const addRecord = key => setData(current => ({ ...current, [key]: [...(current[key] || []), { id: `${key}_${Date.now()}`, title: '', dates: '', description: '', bullets: [] }] }));
  const removeRecord = (key, index) => setData(current => ({ ...current, [key]: (current[key] || []).filter((_, itemIndex) => itemIndex !== index) }));
  const save = async () => { if (!resume) return; try { setSaving(true); const updated = await resumeApi.updateExtracted(resume.id, data); setResume(current => ({ ...current, ...updated })); setData(normalizeExtractedData(updated.extractedData || data)); setSaved(true); setTimeout(() => setSaved(false), 1800); } catch (err) { setError(err.message || 'Unable to save Studio edits.'); } finally { setSaving(false); } };
  const exportPdf = () => { const popup = window.open('', '_blank', 'noopener,noreferrer'); if (!popup) return; popup.document.write(printable(data, template)); popup.document.close(); };

  if (loading) return <div className="pf-studio-loading"><Loader className="spin" size={22} /> Loading Resume Studio...</div>;
  if (!data) return <div className="pf-studio-loading">{error || 'Upload a resume before opening Studio.'}</div>;
  return <div className="pf-resume-studio"><header className="pf-studio-topbar"><button type="button" className="pf-studio-back" onClick={() => navigate(resume ? `/resume/${resume.id}` : '/resume')}><ArrowLeft size={16} /> {resume ? resume.filename : 'Resume library'}</button><div className="pf-studio-title"><Sparkles size={15} /> Resume Studio</div><div className="pf-studio-top-actions"><button type="button" onClick={save} disabled={saving}><Save size={15} /> {saved ? 'Saved' : saving ? 'Saving...' : 'Save edits'}</button><button type="button" className="is-primary" onClick={exportPdf}><Download size={15} /> Export PDF</button></div></header>{error && <div className="pf-studio-error">{error}</div>}<main className="pf-studio-grid"><aside className="pf-studio-sidebar"><div className="pf-studio-panel-label">Templates</div><div className="pf-studio-templates">{TEMPLATES.map(([id, name, note]) => <button type="button" key={id} className={template === id ? 'is-selected' : ''} onClick={() => setTemplate(id)}><FileText size={16} /><span><b>{name}</b><small>{note}</small></span></button>)}</div><div className="pf-studio-panel-label">Content</div><nav className="pf-studio-section-nav">{SECTIONS.map(item => <button type="button" key={item} className={section === item ? 'is-active' : ''} onClick={() => setSection(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</nav></aside><section className="pf-studio-editor"><div className="pf-studio-editor-head"><div><span className="pf-studio-panel-label">Edit section</span><h1>{section[0].toUpperCase() + section.slice(1)}</h1></div><span className="pf-studio-source">{resume ? `Source: ${resume.filename}` : 'Profile starting point'}</span></div>{section === 'summary' && <div className="pf-studio-field"><label>Professional summary<textarea value={data.summary?.text || ''} onChange={event => update('summary', { ...(data.summary || {}), text: event.target.value })} rows={12} placeholder="Write a concise summary for the role you are targeting." /></label></div>}{section === 'skills' && <div className="pf-studio-field"><label>Skills, separated by commas<textarea value={(data.skills?.raw || []).join(', ')} onChange={event => update('skills', { ...(data.skills || {}), raw: event.target.value.split(',').map(item => item.trim()).filter(Boolean) })} rows={8} placeholder="JavaScript, Node.js, PostgreSQL, Docker" /></label></div>}{RECORD_SECTIONS.includes(section) && <RecordEditor section={section} records={data[section] || []} onChange={(index, patch) => updateRecord(section, index, patch)} onAdd={() => addRecord(section)} onRemove={index => removeRecord(section, index)} />}</section><section className="pf-studio-preview"><div className="pf-studio-preview-head"><span>Live preview</span><small>A4 · selectable text</small></div><div className="pf-studio-paper-wrap"><Preview data={data} template={template} /></div></section></main></div>;
}
