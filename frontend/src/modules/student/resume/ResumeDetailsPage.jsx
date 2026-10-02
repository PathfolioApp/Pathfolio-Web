import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Download, Edit3, ExternalLink, FileText, Loader, Save, Star, UploadCloud, WandSparkles } from 'lucide-react';
import { replaceResume, resumeApi } from './resumeApi';
import { Button } from '../../../components/ui/Button';
import './ResumeDetailsPage.css';
import './ResumeDetailsEnhancements.css';
import './ResumeDetailsFields.css';

const PORTALS = { naukri: 'Naukri Resume Parser', greenhouse: 'Greenhouse', lever: 'Lever', workday: 'Workday' };

function getStructured(resume) {
  return resume?.extractedData || resume?.analysis?.structured || {
    personal: resume?.analysis?.extracted?.contact || {},
    summary: { text: resume?.analysis?.extracted?.summary || '' },
    education: (resume?.analysis?.extracted?.education || []).map(raw => ({ raw })),
    experience: (resume?.analysis?.extracted?.experience || []).map(raw => ({ raw })),
    projects: (resume?.analysis?.extracted?.projects || []).map(raw => ({ raw })),
    skills: { raw: resume?.analysis?.extracted?.skills || [] },
  };
}

function RecordList({ title, items = [], onChange, editable }) {
  if (!items.length) return null;
  return <section className="pf-detail-section"><div className="pf-detail-section-title"><h3>{title}</h3><span>{items.length}</span></div><div className="pf-detail-records">{items.map((item, index) => <article className="pf-detail-record" key={item.id || index}><div className="pf-detail-record-head"><strong>{item.title || item.institution || item.company || item.raw || 'Detected entry'}</strong><span>{item.confidence ? `${item.confidence} confidence` : ''}</span></div>{editable ? <><div className="pf-detail-record-fields"><input value={item.title || item.institution || item.company || ''} onChange={event => onChange(index, { ...item, title: event.target.value, institution: event.target.value, company: event.target.value })} placeholder="Title, company, or institution" /><input value={item.dates || ''} onChange={event => onChange(index, { ...item, dates: event.target.value })} placeholder="Dates, e.g. 2024 - 2026" aria-label={`${title} dates`} /></div><textarea value={item.description || ''} onChange={event => onChange(index, { ...item, description: event.target.value })} placeholder="Description" rows={3} /><textarea value={(item.bullets || []).join('\n')} onChange={event => onChange(index, { ...item, bullets: event.target.value.split('\n').map(line => line.trim()).filter(Boolean) })} placeholder="Achievement bullets, one per line" rows={3} /></> : <>{item.dates && <span className="pf-detail-record-dates">{item.dates}</span>}{item.description && <p>{item.description}</p>}{item.bullets?.length > 0 && <ul>{item.bullets.map((bullet, bulletIndex) => <li key={bulletIndex}>{bullet}</li>)}</ul>}{item.raw && !item.description && <p>{item.raw}</p>}</>}</article>)}</div></section>;
}

function AtsMetrics({ analysis }) {
  const metrics = analysis?.ats;
  if (!metrics) return null;
  return <div className="pf-analysis-breakdown"><h3>Evidence from this PDF</h3><p className="pf-analysis-note">{metrics.source}. {metrics.limitation}</p><div className="pf-analysis-metric-grid">{Object.entries(metrics.counts || {}).filter(([key]) => key !== 'email').map(([key, count]) => <div key={key}><strong>{count}</strong><span>{key.replace(/[A-Z]/g, letter => ` ${letter}`).replace(/^./, letter => letter.toUpperCase())}</span></div>)}</div></div>;
}

export function ResumeDetailsPage() {
  const { resumeId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [resume, setResume] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const tab = ['overview', 'analysis', 'extracted'].includes(searchParams.get('tab')) ? searchParams.get('tab') : 'overview';

  const load = async () => {
    try {
      setLoading(true);
      const resumes = await resumeApi.list();
      const found = resumes.find(item => String(item.id) === String(resumeId));
      if (!found) throw new Error('Resume not found.');
      setResume(found);
      setDraft(getStructured(found));
      setTags(found.tags || []);
    } catch (err) { setError(err.message || 'Unable to load resume.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [resumeId]);

  const updateDraft = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  const updateRecord = (key, index, value) => setDraft(current => ({ ...current, [key]: current[key].map((item, itemIndex) => itemIndex === index ? value : item) }));

  const saveExtracted = async () => {
    try { setSaving(true); const updated = await resumeApi.updateExtracted(resume.id, draft); setResume(current => ({ ...current, ...updated })); setDraft(getStructured(updated)); }
    catch (err) { setError(err.message || 'Unable to save extracted information.'); }
    finally { setSaving(false); }
  };

  const runAnalysis = async () => {
    try { setAnalyzing(true); await resumeApi.analyze(resume.id); await load(); setSearchParams({ tab: 'analysis' }); }
    catch (err) { setError(err.message || 'Unable to analyse resume.'); }
    finally { setAnalyzing(false); }
  };

  const setPrimary = async () => {
    if (resume.isDefault || !window.confirm('Make this your Primary Resume?')) return;
    try { const updated = await resumeApi.setDefault(resume.id); setResume(current => ({ ...current, ...updated })); }
    catch (err) { setError(err.message || 'Unable to set primary resume.'); }
  };

  const rename = async () => {
    const filename = window.prompt('Rename resume', resume.filename);
    if (!filename || filename === resume.filename) return;
    try { const updated = await resumeApi.rename(resume.id, filename); setResume(current => ({ ...current, ...updated })); }
    catch (err) { setError(err.message || 'Unable to rename resume.'); }
  };

  const replace = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024) { setError('Replacement must be a PDF under 10 MB.'); return; }
    try { setReplacing(true); const updated = await replaceResume(resume.id, file); setResume(current => ({ ...current, ...updated })); setDraft(getStructured(updated)); }
    catch (err) { setError(err.message || 'Unable to replace resume.'); }
    finally { setReplacing(false); event.target.value = ''; }
  };

  const addTag = event => {
    event.preventDefault();
    const clean = tagInput.trim();
    if (!clean || tags.some(tag => tag.toLowerCase() === clean.toLowerCase())) return;
    setTags(current => [...current, clean].slice(0, 20));
    setTagInput('');
  };

  const saveTags = async nextTags => {
    try { await resumeApi.updateTags(resume.id, nextTags); setTags(nextTags); }
    catch (err) { setError(err.message || 'Unable to save role tags.'); }
  };

  const analysis = resume?.analysis;
  const data = draft || {};
  const allSkills = useMemo(() => Object.entries(data.skills || {}).filter(([key, value]) => key !== 'raw' && Array.isArray(value) && value.length).map(([key, value]) => ({ key, value })), [data.skills]);

  if (loading) return <div className="pf-resume-detail-loading"><Loader className="spin" size={22} /> Loading resume details...</div>;
  if (!resume) return <div className="pf-resume-detail-loading">{error || 'Resume not found.'}</div>;

  return <div className="pf-resume-details">
    <Link to="/resume" className="pf-detail-back"><ArrowLeft size={15} /> Back to My Resumes</Link>
    <header className="pf-detail-header"><div><div className="pf-detail-file-title"><FileText size={21} /><h1>{resume.filename}</h1>{resume.isDefault && <span className="pf-detail-primary"><Star size={12} fill="currentColor" /> Primary Resume</span>}</div><p>{resume.category || 'General'} · Uploaded {new Date(resume.uploadedAt).toLocaleDateString()} · Updated {new Date(resume.updatedAt || resume.uploadedAt).toLocaleDateString()}</p></div><div className="pf-detail-actions"><Button variant="secondary" onClick={() => navigate(`/resume/${resume.id}/studio`)}><WandSparkles size={15} /> Edit in Studio</Button><label className="pf-detail-download"><UploadCloud size={15} /> {replacing ? 'Replacing...' : 'Replace'}<input type="file" accept="application/pdf" onChange={replace} disabled={replacing} hidden /></label><a className="pf-detail-download" href={resume.downloadUrl} download={resume.filename}><Download size={15} /> Download</a><button type="button" className="pf-detail-more" onClick={rename} title="Rename resume"><Edit3 size={16} /></button></div></header>
    {error && <div className="pf-detail-alert"><AlertCircle size={15} />{error}</div>}
    <nav className="pf-detail-tabs" aria-label="Resume details"><button type="button" className={tab === 'overview' ? 'is-active' : ''} onClick={() => setSearchParams({ tab: 'overview' })}>Resume overview</button><button type="button" className={tab === 'analysis' ? 'is-active' : ''} onClick={() => setSearchParams({ tab: 'analysis' })}>ATS analysis</button><button type="button" className={tab === 'extracted' ? 'is-active' : ''} onClick={() => setSearchParams({ tab: 'extracted' })}>Extracted information</button></nav>{tab === 'analysis' && analysis && <AtsMetrics analysis={analysis} />}

    {tab === 'overview' && <div className="pf-detail-overview"><section className="pf-detail-document"><div className="pf-detail-document-head"><h2>Original document</h2><a href={`${resume.fileUrl}`} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open full screen</a></div><iframe src={`${resume.fileUrl}#toolbar=1&view=FitH`} title={resume.filename} /></section><aside className="pf-detail-side"><div className="pf-detail-side-card"><span className="pf-detail-side-label">Resume status</span><strong>{resume.isDefault ? 'Primary Resume' : 'Secondary Resume'}</strong><p>{resume.isDefault ? 'Used as the default resume when you apply to a role.' : 'Available for role-specific applications.'}</p>{!resume.isDefault && <button type="button" onClick={setPrimary}><Star size={14} /> Set as primary</button>}</div><div className="pf-detail-side-card"><span className="pf-detail-side-label">Role tags</span><div className="pf-detail-tag-list">{tags.map(tag => <span key={tag}>{tag}<button type="button" onClick={() => saveTags(tags.filter(item => item !== tag))} aria-label={`Remove ${tag}`}>×</button></span>)}</div><form className="pf-detail-tag-form" onSubmit={addTag}><input value={tagInput} onChange={event => setTagInput(event.target.value)} placeholder="Add role tag" maxLength={30} /><button type="submit">Add</button></form></div><div className="pf-detail-side-card"><span className="pf-detail-side-label">Analysis status</span><strong>{analysis ? `${analysis.score}% compatibility score` : 'Not analysed yet'}</strong><p>{analysis ? `Last checked ${new Date(analysis.checkedAt).toLocaleString()}` : 'Run local extraction checks to inspect this resume.'}</p><button type="button" onClick={analysis ? () => setSearchParams({ tab: 'analysis' }) : runAnalysis} disabled={analyzing}>{analyzing ? 'Analysing...' : analysis ? 'View analysis' : 'Analyse resume'}</button></div></aside></div>}

    {tab === 'analysis' && <section className="pf-detail-analysis"><div className="pf-analysis-hero"><div><span className="pf-detail-side-label">Local ATS compatibility</span><h2>{analysis ? `${analysis.score}%` : 'Not analysed'}</h2><p>This score measures text extraction, contact detection, section detection, and single-page structure. It is not a live test against external ATS products.</p></div><button type="button" onClick={runAnalysis} disabled={analyzing}>{analyzing ? <Loader className="spin" size={15} /> : <ZapIcon />} {analysis ? 'Reanalyse' : 'Run analysis'}</button></div>{analysis ? <><div className="pf-analysis-breakdown"><h3>Parsing compatibility</h3><p className="pf-analysis-note">These are estimated compatibility checks based on the local extraction result. No external parser API was called.</p>{Object.entries(analysis.portalReadiness || {}).map(([key, result]) => { const status = typeof result === 'boolean' ? (result ? 'Passed' : 'Review recommended') : result.label || result.status; return <div key={key}><span>{PORTALS[key] || key}</span><b className={status === 'Estimated compatibility' ? 'is-estimated' : status === 'Passed' ? 'is-passed' : 'is-review'}>{status}</b></div>; })}</div><div className="pf-analysis-breakdown"><h3>Analysis breakdown</h3>{(analysis.checks || []).map(check => <div className="pf-analysis-finding" key={check.key}><span>{check.passed ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}{check.label}</span><p>{check.passed ? 'Detected in the uploaded document.' : 'Not detected. Add a conventional, selectable-text section and reanalyse.'}</p></div>)}{(analysis.findings || []).map(finding => <div className="pf-analysis-finding" key={finding.key}><span><AlertCircle size={15} />{finding.title}</span><p>{finding.detail}</p></div>)}</div><button type="button" className="pf-open-studio" onClick={() => navigate(`/resume/${resume.id}/studio`)}><WandSparkles size={15} /> Open in Resume Studio</button></> : <div className="pf-detail-empty-analysis">Run analysis to see extraction quality, structure checks, and estimated parser compatibility.</div>}</section>}

    {tab === 'extracted' && <section className="pf-detail-extracted"><div className="pf-extracted-toolbar"><div><h2>Structured extracted information</h2><p>Review and correct uncertain fields. Your original PDF remains unchanged.</p></div><Button onClick={saveExtracted} disabled={saving}>{saving ? 'Saving...' : <><Save size={15} /> Save corrections</>}</Button></div><section className="pf-detail-section"><div className="pf-detail-section-title"><h3>Personal information</h3><span>Detected from PDF</span></div><div className="pf-extracted-grid"><label>Full name<input value={data.personal?.fullName || ''} onChange={event => updateDraft('personal', { ...data.personal, fullName: event.target.value })} /></label><label>Headline<input value={data.personal?.headline || ''} onChange={event => updateDraft('personal', { ...data.personal, headline: event.target.value })} /></label><label>Email<input value={data.personal?.email || ''} onChange={event => updateDraft('personal', { ...data.personal, email: event.target.value })} /></label><label>Phone<input value={data.personal?.phone || ''} onChange={event => updateDraft('personal', { ...data.personal, phone: event.target.value })} /></label></div></section><section className="pf-detail-section"><div className="pf-detail-section-title"><h3>Professional summary</h3><span>{data.summary?.confidence || 'review'}</span></div><textarea className="pf-summary-editor" value={data.summary?.text || ''} onChange={event => updateDraft('summary', { ...(data.summary || {}), text: event.target.value })} placeholder="No summary detected" rows={4} /></section><RecordList title="Education" items={data.education} editable onChange={(index, item) => updateRecord('education', index, item)} /><RecordList title="Experience" items={data.experience} editable onChange={(index, item) => updateRecord('experience', index, item)} /><RecordList title="Projects" items={data.projects} editable onChange={(index, item) => updateRecord('projects', index, item)} /><section className="pf-detail-section"><div className="pf-detail-section-title"><h3>Skills</h3><span>Grouped extraction</span></div><div className="pf-skill-groups">{allSkills.length ? allSkills.map(group => <div key={group.key}><b>{group.key.replace(/([A-Z])/g, ' $1')}</b><p>{group.value.join(' · ')}</p></div>) : <p>No skills detected.</p>}</div></section></section>}
  </div>;
}

function ZapIcon() { return <WandSparkles size={15} />; }
