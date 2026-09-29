import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Download, FileSearch, ListChecks, Sparkles, Target, Upload, UserRound, Wand2, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { adminApi } from '../adminApi';
import { Input, PanelHeading, Empty, downloadCsvFile } from '../utils/adminHelpers';

const SAMPLE_JD = `Software Engineer (Frontend) — Full-time, Bengaluru\n\nWe are looking for a frontend engineer to build polished, accessible web experiences for our placement platform.\n\nWhat you will do:\n- Build responsive interfaces using React, JavaScript, and modern CSS.\n- Collaborate with designers to translate Figma flows into production UI.\n- Integrate REST APIs and manage component state with Redux.\n- Write unit tests and participate in code reviews.\n\nWhat we look for:\n- Strong knowledge of HTML, CSS, and TypeScript.\n- Experience with Git and CI/CD workflows.\n- Minimum CGPA of 7.0 with no active backlogs.\n- Bachelor of Technology or equivalent engineering degree.`;

export function JDWorkspace() {
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', minScore: 0, eligibleOnly: false });

  const analyze = async event => {
    event?.preventDefault();
    if (jobDescription.trim().length < 20) { setError('Paste a fuller job description before analysing.'); return; }
    setLoading(true); setError('');
    try {
      const data = await adminApi.analyzeJobDescription({ jobTitle, jobDescription });
      setResult(data);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const loadFile = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setJobDescription(String(reader.result || ''));
    reader.readAsText(file);
    event.target.value = '';
  };

  const reset = () => { setJobTitle(''); setJobDescription(''); setResult(null); setError(''); setFilters({ search: '', minScore: 0, eligibleOnly: false }); };

  const exportCsv = () => {
    if (!result?.candidates?.length) return;
    const escapeCsv = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['Name', 'Match score', 'Department', 'Batch', 'CGPA', 'Matched skills', 'Eligibility', 'Email'].map(escapeCsv);
    const rows = result.candidates.map(candidate => [candidate.name, candidate.score, candidate.academic?.department || '', candidate.academic?.batchYear || '', candidate.academic?.cgpa ?? '', candidate.matchedSkills.join('; '), candidate.eligibilityFlags.join('; '), candidate.email || 'Private'].map(escapeCsv).join(','));
    downloadCsvFile('pathfolio-jd-matches.csv', [header.join(','), ...rows].join('\n'));
  };

  const candidates = (result?.candidates || []).filter(candidate => {
    if (candidate.score < filters.minScore) return false;
    if (filters.eligibleOnly && candidate.eligibilityFlags.length) return false;
    if (!filters.search.trim()) return true;
    const needle = filters.search.toLowerCase();
    return `${candidate.name} ${candidate.academic?.department || ''} ${candidate.matchedSkills.join(' ')}`.toLowerCase().includes(needle);
  });

  return (
    <section className="pf-admin-workspace pf-admin-jd">
      <div className="pf-admin-panel">
        <PanelHeading eyebrow="Requirement intelligence" title="Analyse a job description" action={<button className="pf-admin-jd-sample" type="button" onClick={() => { setJobTitle('Software Engineer (Frontend)'); setJobDescription(SAMPLE_JD); }}><Wand2 size={14} />Use sample</button>} />
        <p className="pf-admin-import-copy">Paste a job description or upload a .txt / .md file. Pathfolio extracts the meaningful skills and eligibility criteria, then ranks students with an explainable match.</p>
        <form className="pf-admin-form pf-admin-jd-form" onSubmit={analyze}>
          <Input label="Role title (optional)"><input value={jobTitle} onChange={event => setJobTitle(event.target.value)} placeholder="e.g. Frontend Engineer" /></Input>
          <Input label="Job description" full>
            <textarea required rows="12" value={jobDescription} onChange={event => setJobDescription(event.target.value)} placeholder="Paste the full job description here — responsibilities, skills, and qualifications..." />
          </Input>
          <label className="pf-admin-jd-upload"><Upload size={14} />Upload .txt or .md<input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={loadFile} /></label>
          <div className="pf-admin-jd-actions">
            <Button type="submit" loading={loading} icon={Sparkles}>Analyse description</Button>
            <Button type="button" variant="ghost" onClick={reset} icon={X}>Clear</Button>
            {result && <Button type="button" variant="outline" onClick={exportCsv} icon={Download}>Export matches</Button>}
          </div>
        </form>
      </div>

      <div className="pf-admin-jd-results">
        {error && <div className="pf-admin-error" role="alert">{error}</div>}
        {!result && !loading && <div className="pf-admin-jd-empty"><Sparkles size={22} /><h3>No analysis yet</h3><p>Analyse a description to see extracted requirements and ranked candidates.</p></div>}
        {loading && <div className="pf-admin-jd-empty"><Clock size={22} /><h3>Analysing description…</h3><p>Extracting skills and scoring eligible student profiles.</p></div>}

        {result && (
          <>
            <article className="pf-admin-jd-analysis">
              <div className="pf-admin-jd-analysis-head"><div><p className="pf-admin-eyebrow">Extracted requirements</p><h2>{result.analysis.role}</h2></div><Target size={22} /></div>
              <p className="pf-admin-jd-summary">{result.analysis.summary}</p>
              <div className="pf-admin-jd-facts">
                <div><span>Domains</span><strong>{result.analysis.domains.join(', ') || 'Not detected'}</strong></div>
                <div><span>Minimum CGPA</span><strong>{result.analysis.minCgpa ?? 'Not specified'}</strong></div>
                <div><span>Experience</span><strong>{result.analysis.experienceYears ? `${result.analysis.experienceYears}+ years` : 'Not specified'}</strong></div>
                <div><span>Education</span><strong>{result.analysis.education.join(', ') || 'Not specified'}</strong></div>
              </div>
              {result.analysis.skills.length > 0 && <div className="pf-admin-jd-block"><span className="pf-admin-jd-block-label"><ListChecks size={14} />Detected skills ({result.analysis.skills.length})</span><div className="pf-admin-jd-chips">{result.analysis.skills.map(skill => <b key={skill}>{skill}</b>)}</div></div>}
              {result.analysis.keywords.length > 0 && <div className="pf-admin-jd-block"><span className="pf-admin-jd-block-label">Keywords</span><div className="pf-admin-jd-chips pf-admin-jd-chips--muted">{result.analysis.keywords.map(keyword => <span key={keyword}>{keyword}</span>)}</div></div>}
              {result.analysis.responsibilities.length > 0 && <div className="pf-admin-jd-block"><span className="pf-admin-jd-block-label"><FileSearch size={14} />Responsibilities</span><ul className="pf-admin-jd-responsibilities">{result.analysis.responsibilities.map((line, index) => <li key={index}>{line}</li>)}</ul></div>}
              <div className="pf-admin-jd-stats">
                <div><strong>{result.stats.evaluated}</strong><span>profiles evaluated</span></div>
                <div><strong>{result.stats.strongMatches}</strong><span>strong matches</span></div>
                <div><strong>{result.stats.returned}</strong><span>ranked below</span></div>
              </div>
            </article>

            <div className="pf-admin-list">
              <div className="pf-admin-panel-heading"><div><p className="pf-admin-eyebrow">Ranked candidates</p><h2>Matches <span>{candidates.length}</span></h2></div></div>
              <div className="pf-admin-jd-filters">
                <input type="search" className="pf-admin-filter" placeholder="Search candidates or skills..." value={filters.search} onChange={event => setFilters(prev => ({ ...prev, search: event.target.value }))} />
                <label className="pf-admin-jd-score"><span>Min score</span><input type="range" min="0" max="100" step="5" value={filters.minScore} onChange={event => setFilters(prev => ({ ...prev, minScore: Number(event.target.value) }))} /><b>{filters.minScore}%</b></label>
                <label className="pf-admin-jd-toggle"><input type="checkbox" checked={filters.eligibleOnly} onChange={event => setFilters(prev => ({ ...prev, eligibleOnly: event.target.checked }))} />Eligible only</label>
              </div>
              {candidates.length === 0 ? <Empty text="No candidates match the current filters." /> : candidates.map(candidate => (
                <article className="pf-admin-jd-candidate" key={candidate.id}>
                  <div className="pf-admin-jd-candidate-top">
                    <div className="pf-admin-jd-candidate-id">
                      <span className="pf-admin-jd-avatar"><UserRound size={18} /></span>
                      <div><h3>{candidate.name}</h3><p>{candidate.academic?.department || 'Department not listed'}{candidate.academic?.batchYear ? ` · Batch ${candidate.academic.batchYear}` : ''}{candidate.academic?.cgpa ? ` · CGPA ${candidate.academic.cgpa}` : ''}</p></div>
                    </div>
                    <div className="pf-admin-jd-score-badge" style={{ '--score': `${candidate.score}%` }}><strong>{candidate.score}%</strong><span>match</span></div>
                  </div>
                  <div className="pf-admin-jd-candidate-reasons">{candidate.reasons.map(reason => <span key={reason}><CheckCircle2 size={14} />{reason}</span>)}</div>
                  {candidate.matchedSkills.length > 0 && <div className="pf-admin-jd-block"><span className="pf-admin-jd-block-label">Matched skills</span><div className="pf-admin-jd-chips">{candidate.matchedSkills.map(skill => <b key={skill}>{skill}</b>)}</div></div>}
                  {candidate.missingSkills.length > 0 && <div className="pf-admin-jd-block"><span className="pf-admin-jd-block-label">Not evidenced</span><div className="pf-admin-jd-chips pf-admin-jd-chips--muted">{candidate.missingSkills.map(skill => <span key={skill}>{skill}</span>)}</div></div>}
                  <div className="pf-admin-jd-candidate-foot">
                    {candidate.eligibilityFlags.length > 0 ? <span className="pf-admin-jd-flag"><AlertTriangle size={14} />{candidate.eligibilityFlags.join(' · ')}</span> : <span className="pf-admin-jd-ok"><CheckCircle2 size={14} />Meets stated eligibility</span>}
                    {candidate.email ? <a className="pf-candidate-contact" href={`mailto:${candidate.email}`}>Contact candidate</a> : <span className="pf-admin-jd-private">Contact hidden by privacy settings</span>}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
