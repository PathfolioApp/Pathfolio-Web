import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Download, Edit3, ExternalLink, FileText, Loader, Save, Star, UploadCloud, WandSparkles } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { replaceResume, resumeApi } from './resumeApi';
import { apiUrl, apiHeaders } from '../../../app/services/apiClient.js';
import { Button } from '../../../components/ui/Button';
import { PdfIcon } from '../../../components/ui/PdfIcon';
import { Preview, normalizeExtractedData } from './ResumeStudioPage';
import './ResumeDetailsPage.css';
import './ResumeDetailsEnhancements.css';
import './ResumeDetailsFields.css';
import './ResumeDetailsUX.css';
import './ResumeStudioPage.css';
import './ResumeResponsive.css';

const READINESS_LABELS = { local: 'Document extraction' };
const TABS = ['overview', 'analysis', 'extracted'];

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
  return <section className="pf-detail-section">
    <div className="pf-detail-section-title"><h3>{title}</h3><span>{items.length}</span></div>
    <div className="pf-detail-records">
      {items.map((item, index) => <article className="pf-detail-record" key={item.id || index}>
        <div className="pf-detail-record-head"><strong>{item.title || item.institution || item.company || item.raw || 'Resume entry'}</strong></div>
        {editable ? <>
          <div className="pf-detail-record-fields">
            <label>Title or organisation<input value={item.title || item.institution || item.company || ''} onChange={event => onChange(index, { ...item, title: event.target.value, institution: event.target.value, company: event.target.value })} placeholder="Title or organisation" /></label>
            <label>Dates<input value={item.dates || ''} onChange={event => onChange(index, { ...item, dates: event.target.value })} placeholder="2024 - 2026" /></label>
          </div>
          <label>Description<textarea value={item.description || ''} onChange={event => onChange(index, { ...item, description: event.target.value })} placeholder="Description" rows={3} /></label>
          <label>Achievement bullets <span className="pf-detail-field-hint">one per line</span><textarea value={(item.bullets || []).join('\n')} onChange={event => onChange(index, { ...item, bullets: event.target.value.split('\n').map(line => line.replace(/^[-*]\s*/, '').trim()).filter(Boolean) })} placeholder="Achievement bullets" rows={3} /></label>
        </> : <>
          {item.dates && <span className="pf-detail-record-dates">{item.dates}</span>}
          {item.description && <p>{item.description}</p>}
          {item.bullets?.length > 0 && <ul>{item.bullets.map((bullet, bulletIndex) => <li key={bulletIndex}>{bullet}</li>)}</ul>}
          {item.raw && !item.description && <p>{item.raw}</p>}
        </>}
      </article>)}
    </div>
  </section>;
}

function readinessResult(result) {
  if (result?.status === 'estimated') return { label: 'Ready', tone: 'is-passed' };
  if (result?.status === 'review') return { label: 'Review', tone: 'is-review' };
  if (typeof result === 'boolean') return result ? { label: 'Ready', tone: 'is-passed' } : { label: 'Review', tone: 'is-review' };
  return { label: result?.label || 'Review', tone: 'is-review' };
}

function AnalysisMetrics({ analysis }) {
  const metrics = analysis?.ats;
  if (!metrics) return null;
  return <div className="pf-analysis-breakdown">
    <h3>Resume snapshot</h3>
    <p className="pf-analysis-note">Key content and structure signals found in your resume.</p>
    <div className="pf-analysis-metric-grid">{Object.entries(metrics.counts || {}).filter(([key]) => key !== 'email').map(([key, count]) => <div key={key}><strong>{count}</strong><span>{key.replace(/[A-Z]/g, letter => ` ${letter}`).replace(/^./, letter => letter.toUpperCase())}</span></div>)}</div>
  </div>;
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
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState('');
  // Blob URL for the authorized document preview (iframe requests cannot
  // carry the X-API-Key header, so the file is fetched here instead).
  const [fileObjectUrl, setFileObjectUrl] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [categories, setCategories] = useState([
    'General',
    'Software Engineering',
    'Backend Engineering',
    'Cloud / DevOps',
    'Data / AI',
    'Core Engineering',
    'Design / Product',
  ]);
  const tab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'overview';

  const load = async () => {
    try {
      setLoading(true);
      const [resumes, catList] = await Promise.all([
        resumeApi.list(),
        resumeApi.categories().catch(() => []),
      ]);
      const found = resumes.find(item => String(item.id) === String(resumeId));
      if (!found) throw new Error('Resume not found.');
      setResume(found);
      setDraft(getStructured(found));
      setTags(found.tags || []);
      if (Array.isArray(catList) && catList.length) {
        setCategories(catList);
      }
    } catch (err) { setError(err.message || 'Unable to load resume.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [resumeId]);

  // Fetch the document with the API key attached and serve it to the iframe
  // from a blob URL (iframes cannot set custom request headers).
  useEffect(() => {
    let revoked = '';
    setFileObjectUrl('');
    if (!resume || !resume.filepath || !resume.fileUrl) return undefined;
    (async () => {
      try {
        const res = await fetch(apiUrl(resume.fileUrl), { credentials: 'include', headers: apiHeaders() });
        if (!res.ok) throw new Error('Document unavailable');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        revoked = url;
        setFileObjectUrl(url);
      } catch { setError('Unable to load the document preview.'); }
    })();
    return () => { if (revoked) URL.revokeObjectURL(revoked); };
  }, [resume?.id, resume?.filepath, resume?.fileUrl]);

  const updateDraft = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  const updateRecord = (key, index, value) => setDraft(current => ({ ...current, [key]: (current[key] || []).map((item, itemIndex) => itemIndex === index ? value : item) }));
  const analysis = resume?.analysis;
  const data = draft || {};
  const allSkills = useMemo(() => {
    const s = data.skills || {};
    const CANONICAL = ['languages', 'frameworks', 'cloudDevOps', 'databasesTools'];
    const hasCanonical = CANONICAL.some(k => Array.isArray(s[k]) && s[k].length > 0);
    return Object.entries(s)
      .filter(([key, value]) => {
        if (key === 'raw') return false;
        if (!Array.isArray(value) || !value.length) return false;
        if (hasCanonical && !CANONICAL.includes(key)) return false;
        return true;
      })
      .map(([key, value]) => {
        const labels = {
          languages: 'Languages',
          frameworks: 'Frameworks & Libraries',
          cloudDevOps: 'Cloud & DevOps',
          databasesTools: 'Databases & Tools',
          programming: 'Programming Languages',
          cloudDevops: 'Cloud & DevOps',
          data: 'Databases',
        };
        return { key: labels[key] || key, value };
      });
  }, [data.skills]);

  const runAnalysis = async () => {
    try { setAnalyzing(true); setError(''); await resumeApi.analyze(resume.id); await load(); setSearchParams({ tab: 'analysis' }); }
    catch (err) { setError(err.message || 'Unable to analyse resume.'); }
    finally { setAnalyzing(false); }
  };
  const saveExtracted = async () => {
    try { setSaving(true); setError(''); const updated = await resumeApi.updateExtracted(resume.id, draft); setResume(current => ({ ...current, ...updated })); setDraft(getStructured(updated)); }
    catch (err) { setError(err.message || 'Unable to save resume changes.'); }
    finally { setSaving(false); }
  };
  const setPrimary = async () => {
    if (resume.isDefault || !window.confirm('Set this as your primary resume?')) return;
    try { const updated = await resumeApi.setDefault(resume.id); setResume(current => ({ ...current, ...updated })); }
    catch (err) { setError(err.message || 'Unable to set primary resume.'); }
  };
  const handleCategoryChange = async event => {
    const newCategory = event.target.value;
    try {
      setError('');
      await resumeApi.updateCategory(resume.id, newCategory);
      setResume(current => ({ ...current, category: newCategory }));
    } catch (err) {
      setError(err.message || 'Unable to update category.');
    }
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
    const nextTags = [...tags, clean].slice(0, 20);
    saveTags(nextTags);
    setTagInput('');
  };
  const saveTags = async nextTags => {
    try { await resumeApi.updateTags(resume.id, nextTags); setTags(nextTags); }
    catch (err) { setError(err.message || 'Unable to save role tags.'); }
  };

  if (loading) return <div className="pf-resume-detail-loading"><Loader className="spin" size={22} /> Loading resume details...</div>;
  if (!resume) return <div className="pf-resume-detail-loading">{error || 'Resume not found.'}</div>;

  return <div className="pf-resume-details-page">
    <Link to="/resume" className="pf-detail-back"><ArrowLeft size={15} /> Back to My Resumes</Link>
    <header className="pf-detail-header">
      <div className="pf-detail-header-left">
        <div className="pf-detail-file-title">
          <div className="pf-resume-pdf-box">
            <PdfIcon size={25} className="pf-resume-pdf-icon" />
          </div>
          <div>
            <div className="pf-detail-title-line">
              <h1>{resume.filename}</h1>
              {resume.isDefault && <span className="pf-detail-primary"><Star size={12} fill="currentColor" /> Primary resume</span>}
            </div>
            <p>{resume.category || 'General'} · Uploaded {new Date(resume.uploadedAt).toLocaleDateString()} · Updated {new Date(resume.updatedAt || resume.uploadedAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
      <div className="pf-detail-actions">
        <button type="button" className="pf-btn-edit-studio" onClick={() => navigate(`/resume/${resume.id}/studio`)}>
          <WandSparkles size={15} /> Edit in Studio
        </button>
        <label className="pf-detail-download-btn">
          <UploadCloud size={15} /> {replacing ? 'Replacing...' : 'Replace'}
          <input type="file" accept="application/pdf" onChange={replace} disabled={replacing} hidden />
        </label>
        <a className="pf-detail-download-btn" href="#" onClick={event => {
          event.preventDefault();
          if (!resume.downloadUrl) return;
          (async () => {
            try {
              const blob = await resumeApi.downloadPdf(resume.downloadUrl);
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = resume.filename || 'resume.pdf';
              document.body.appendChild(a); a.click(); a.remove();
              setTimeout(() => URL.revokeObjectURL(url), 60_000);
            } catch (error) { setError(error.message || 'Unable to download the document.'); }
          })();
        }}>
          <Download size={15} /> Download PDF
        </a>
        <button type="button" className="pf-detail-more-btn" onClick={rename} title="Rename resume" aria-label="Rename resume">
          <Edit3 size={15} />
        </button>
      </div>
    </header>
    {error && <div className="pf-detail-alert" role="alert"><AlertCircle size={15} />{error}</div>}
    <nav className="pf-detail-tabs" aria-label="Resume details"><button type="button" className={tab === 'overview' ? 'is-active' : ''} onClick={() => setSearchParams({ tab: 'overview' })}>Overview</button><button type="button" className={tab === 'analysis' ? 'is-active' : ''} onClick={() => setSearchParams({ tab: 'analysis' })}>Analysis</button><button type="button" className={tab === 'extracted' ? 'is-active' : ''} onClick={() => setSearchParams({ tab: 'extracted' })}>Extracted information</button></nav>

    {tab === 'overview' && <div className="pf-detail-overview"><section className="pf-detail-document"><div className="pf-detail-document-head"><h2>Original document</h2>{resume.fileUrl && <a href="#" onClick={event => { event.preventDefault(); if (fileObjectUrl) window.open(fileObjectUrl, '_blank', 'noopener'); }}><ExternalLink size={14} /> Open document</a>}</div>
      {/* 
        CRITICAL: DO NOT MODIFY OR REMOVE THIS IFRAME / PREVIEW RENDER LOGIC.
        - Studio-generated resumes MUST be rendered using the live `<Preview>` component for CSS margin consistency.
        - Uploaded PDF files MUST use the `<iframe src={resume.fileUrl}>` fallback.
        This logic ensures the preview perfectly matches the exported PDF from Studio.
      */}
      {!resume.filepath && resume.extractedData ? (
        <div className="pf-studio-paper-wrap" style={{ background: '#f0f2f0', padding: '24px', borderRadius: '8px', overflow: 'auto', maxHeight: '80vh' }}>
          <Preview data={normalizeExtractedData(resume.extractedData, null)} template="classic" />
        </div>
      ) : fileObjectUrl ? (
        /* The API requires the X-API-Key header, which an iframe cannot attach;
           the document is fetched with credentials + key and served from a blob. */
        <iframe src={`${fileObjectUrl}#toolbar=1&view=FitH`} title={resume.filename} />
      ) : (
        <div className="pf-detail-empty"><p>Loading document…</p></div>
      )}
    </section><aside className="pf-detail-side"><div className="pf-detail-side-card"><span className="pf-detail-side-label">Resume status</span><strong>{resume.isDefault ? 'Primary resume' : 'Secondary resume'}</strong><p>{resume.isDefault ? 'Used automatically when you apply to a role.' : 'Available for role-specific applications.'}</p>{!resume.isDefault && <button type="button" onClick={setPrimary}><Star size={14} /> Set as primary</button>}</div><div className="pf-detail-side-card"><span className="pf-detail-side-label">Resume category</span><select value={resume.category || 'General'} onChange={handleCategoryChange} className="pf-detail-category-select" aria-label="Change resume category">{categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select><p>Target specialization or domain for this resume.</p></div><div className="pf-detail-side-card"><span className="pf-detail-side-label">Role tags</span><div className="pf-detail-tag-list">{tags.map(tag => <span key={tag}>{tag}<button type="button" onClick={() => saveTags(tags.filter(item => item !== tag))} aria-label={`Remove ${tag}`}>×</button></span>)}</div><form className="pf-detail-tag-form" onSubmit={addTag}><input value={tagInput} onChange={event => setTagInput(event.target.value)} placeholder="Add a role tag" maxLength={30} aria-label="New role tag" /><button type="submit">Add tag</button></form></div><div className="pf-detail-side-card"><span className="pf-detail-side-label">Resume analysis</span><strong>{analysis ? `${analysis.score}% ATS readiness` : 'Not analysed yet'}</strong><p>{analysis ? `Updated ${new Date(analysis.checkedAt).toLocaleString()}` : 'Check structure and content coverage.'}</p><button type="button" onClick={analysis ? () => setSearchParams({ tab: 'analysis' }) : runAnalysis} disabled={analyzing}>{analyzing ? 'Checking...' : analysis ? 'View analysis' : 'Check resume'}</button></div></aside></div>}

    {tab === 'analysis' && <section className="pf-detail-analysis">{!resume.filepath ? <div className="pf-analysis-hero"><div><span className="pf-detail-side-label">ATS readiness</span><h2>Needs an uploaded file</h2><p>ATS analysis reviews the actual PDF. This resume was built in Studio - export or upload a PDF version, or use the Studio preview to check its content.</p></div><button type="button" onClick={() => navigate(`/resume/${resume.id}/studio`)}><WandSparkles size={15} /> Open Resume Studio</button></div> : <><div className="pf-analysis-hero"><div><span className="pf-detail-side-label">ATS readiness</span><h2>{analysis ? `${analysis.score}%` : 'Not checked'}</h2><p>Review how your resume performs against common screening conventions.</p></div><button type="button" onClick={runAnalysis} disabled={analyzing}>{analyzing ? <Loader className="spin" size={15} /> : <WandSparkles size={15} />}{analyzing ? 'Checking...' : analysis ? 'Check again' : 'Check resume'}</button></div>{analysis ? <><AnalysisMetrics analysis={analysis} /><div className="pf-analysis-breakdown"><h3>Readiness checks</h3>{Object.entries(analysis.portalReadiness || {}).map(([key, result]) => { const status = readinessResult(result); return <div key={key}><span>{READINESS_LABELS[key] || key}</span><b className={status.tone}>{status.label}</b></div>; })}{(analysis.checks || []).map(check => <div className="pf-analysis-finding" key={check.key}><span>{check.passed ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}{check.label}</span><p>{check.passed ? 'Looks good' : check.evidence || 'Review this section'}</p></div>)}{(analysis.findings || []).map(finding => <div className="pf-analysis-finding" key={finding.key}><span><AlertCircle size={15} />{finding.title}</span><p>{finding.detail}</p></div>)}</div><button type="button" className="pf-open-studio" onClick={() => navigate(`/resume/${resume.id}/studio`)}><WandSparkles size={15} /> Open Resume Studio</button></> : <div className="pf-detail-empty"><h3>Ready to check your resume</h3><p>Get a quick review of its structure, contact details, and content coverage.</p><button type="button" onClick={runAnalysis} disabled={analyzing}>{analyzing ? 'Checking...' : 'Check resume'}</button></div>}</>}</section>}

    {tab === 'extracted' && <section className="pf-detail-extracted"><div className="pf-extracted-toolbar"><div><h2>Extracted information</h2><p>Review and edit the information detected from your resume.</p></div><Button onClick={saveExtracted} disabled={saving}>{saving ? 'Saving...' : <><Save size={15} /> Save changes</>}</Button></div><section className="pf-detail-section"><div className="pf-detail-section-title"><h3>Personal information</h3><span>Edit fields</span></div><div className="pf-extracted-grid"><label>Full name<input value={data.personal?.fullName || ''} onChange={event => updateDraft('personal', { ...data.personal, fullName: event.target.value })} /></label><label>Headline<input value={data.personal?.headline || ''} onChange={event => updateDraft('personal', { ...data.personal, headline: event.target.value })} /></label><label>Email<input value={data.personal?.email || ''} onChange={event => updateDraft('personal', { ...data.personal, email: event.target.value })} /></label><label>Phone<input value={data.personal?.phone || ''} onChange={event => updateDraft('personal', { ...data.personal, phone: event.target.value })} /></label></div></section><section className="pf-detail-section"><div className="pf-detail-section-title"><h3>Professional summary</h3><span>Edit field</span></div><textarea className="pf-summary-editor" value={data.summary?.text || ''} onChange={event => updateDraft('summary', { ...(data.summary || {}), text: event.target.value })} placeholder="Add a professional summary" rows={4} /></section><RecordList title="Education" items={data.education} editable onChange={(index, item) => updateRecord('education', index, item)} /><RecordList title="Experience" items={data.experience} editable onChange={(index, item) => updateRecord('experience', index, item)} /><RecordList title="Projects" items={data.projects} editable onChange={(index, item) => updateRecord('projects', index, item)} />{allSkills.length > 0 && <section className="pf-detail-section"><div className="pf-detail-section-title"><h3>Skills</h3><span>{allSkills.reduce((total, group) => total + group.value.length, 0)}</span></div><div className="pf-detail-skill-groups">{allSkills.map(group => <div key={group.key}><strong>{group.key}</strong><p>{group.value.join(' · ')}</p></div>)}</div></section>}</section>}
  </div>;
}
