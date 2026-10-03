import React, { useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, Download, FileSearch, ListChecks,
  Sparkles, Target, Upload, UserRound, Wand2, X, ChevronDown, ChevronUp,
  Briefcase, FolderGit2, Award, ExternalLink, Linkedin, Github, CheckSquare,
  Square, Mail, Copy, Check
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { adminApi } from '../adminApi';
import { Input, PanelHeading, Empty, downloadCsvFile } from '../utils/adminHelpers';

const SAMPLE_JD = `Software Engineer (Frontend), Full-time, Bengaluru

We are looking for a frontend engineer to build polished, accessible web experiences for our placement platform.

What you will do:
- Build responsive interfaces using React, JavaScript, and modern CSS.
- Collaborate with designers to translate Figma flows into production UI.
- Integrate REST APIs and manage component state with Redux.
- Write unit tests and participate in code reviews.

What we look for:
- Strong knowledge of HTML, CSS, and TypeScript.
- Experience with Git and CI/CD workflows.
- Minimum CGPA of 7.0 with no active backlogs.
- Bachelor of Technology or equivalent engineering degree.`;

function getMatchSummary(candidate, totalRequired) {
  const matched = candidate.matchedSkills?.length || 0;
  const total = totalRequired || matched || 1;
  const projectCount = (candidate.projects || []).length;
  const internshipCount = (candidate.internships || []).length;
  const score = candidate.score || 0;

  // 1. Required skills bullet
  const skillsBullet = `${matched}/${total} required skills`;

  // 2. Technical alignment bullet
  let alignmentBullet = 'Limited technical alignment';
  if (score >= 75) {
    alignmentBullet = 'Strong technical alignment';
  } else if (score >= 45) {
    alignmentBullet = 'Moderate technical alignment';
  }

  // 3. Relevant experience bullet
  let experienceBullet = 'No recorded project or internship evidence';
  if (projectCount >= 2 && internshipCount >= 1) {
    experienceBullet = 'Relevant experience and projects';
  } else if (projectCount > 0 && internshipCount > 0) {
    experienceBullet = 'Relevant experience and projects';
  } else if (projectCount > 0 || internshipCount > 0) {
    experienceBullet = 'Some relevant experience';
  }

  return [skillsBullet, alignmentBullet, experienceBullet];
}

function getMatchBreakdown(candidate, totalRequired) {
  const matched = candidate.matchedSkills?.length || 0;
  const total = totalRequired || matched || 1;
  const projectCount = (candidate.projects || []).length;
  const internshipCount = (candidate.internships || []).length;
  const totalEvidence = projectCount + internshipCount;
  const flagsCount = (candidate.eligibilityFlags || []).length;

  // Technical evidence: Strong (>=4), Moderate (2-3), Limited (1), None (0)
  let technicalEvidence = 'None';
  let technicalEvidenceTone = 'muted';
  if (totalEvidence >= 4) {
    technicalEvidence = 'Strong';
    technicalEvidenceTone = 'strong';
  } else if (totalEvidence >= 2) {
    technicalEvidence = 'Moderate';
    technicalEvidenceTone = 'moderate';
  } else if (totalEvidence >= 1) {
    technicalEvidence = 'Limited';
    technicalEvidenceTone = 'limited';
  }

  // Project relevance: Strong (>=2 projects & matched skills), Partial (>=1 project), None
  let projectRelevance = 'None';
  let projectRelevanceTone = 'muted';
  if (projectCount >= 2 && matched >= 3) {
    projectRelevance = 'Strong';
    projectRelevanceTone = 'strong';
  } else if (projectCount > 0 && matched > 0) {
    projectRelevance = 'Partial';
    projectRelevanceTone = 'moderate';
  } else if (projectCount > 0) {
    projectRelevance = 'Limited';
    projectRelevanceTone = 'limited';
  }

  // Experience relevance: Strong (internships with matched skills), Moderate (internship), Limited (projects only), None
  let experienceRelevance = 'None';
  let experienceRelevanceTone = 'muted';
  if (internshipCount >= 1 && matched >= 3) {
    experienceRelevance = 'Strong';
    experienceRelevanceTone = 'strong';
  } else if (internshipCount >= 1) {
    experienceRelevance = 'Moderate';
    experienceRelevanceTone = 'moderate';
  } else if (projectCount >= 2) {
    experienceRelevance = 'Limited';
    experienceRelevanceTone = 'limited';
  }

  // Eligibility: Met vs Review flags
  const eligibility = flagsCount === 0 ? 'Met' : 'Review flags';
  const eligibilityTone = flagsCount === 0 ? 'strong' : 'warning';

  return [
    { label: 'Required skills', value: `${matched} / ${total}`, tone: matched >= (total * 0.7) ? 'strong' : matched >= (total * 0.3) ? 'moderate' : 'limited' },
    { label: 'Technical evidence', value: technicalEvidence, tone: technicalEvidenceTone },
    { label: 'Project relevance', value: projectRelevance, tone: projectRelevanceTone },
    { label: 'Experience relevance', value: experienceRelevance, tone: experienceRelevanceTone },
    { label: 'Eligibility', value: eligibility, tone: eligibilityTone }
  ];
}

export function JDWorkspace() {
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', minScore: 0, eligibleOnly: false });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [copied, setCopied] = useState(false);

  const analyze = async event => {
    event?.preventDefault();
    if (jobDescription.trim().length < 20) { setError('Paste a fuller job description before analysing.'); return; }
    setLoading(true); setError('');
    try {
      const data = await adminApi.analyzeJobDescription({ jobTitle, jobDescription });
      setResult(data);
      setSelectedIds(new Set());
      setExpandedIds(new Set());
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

  const reset = () => {
    setJobTitle('');
    setJobDescription('');
    setResult(null);
    setError('');
    setFilters({ search: '', minScore: 0, eligibleOnly: false });
    setSelectedIds(new Set());
    setExpandedIds(new Set());
  };

  const getScoreTheme = (score) => {
    if (score >= 75) return { color: '#10b981', label: 'Strong match' };
    if (score >= 50) return { color: '#2563eb', label: 'Good match' };
    if (score >= 30) return { color: '#f59e0b', label: 'Partial match' };
    return { color: '#64748b', label: 'Low match' };
  };

  const toggleSelectCandidate = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectTopN = (n) => {
    const ids = candidates.slice(0, n).map(c => c.id);
    setSelectedIds(new Set(ids));
  };

  const toggleSelectAll = () => {
    if (selectedIds.size >= candidates.length && candidates.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map(c => c.id)));
    }
  };

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copySelectedEmails = () => {
    const emails = (result?.candidates || [])
      .filter(c => selectedIds.has(c.id) && c.email)
      .map(c => c.email);
    if (!emails.length) return;
    navigator.clipboard.writeText(emails.join(', '));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportCsv = (onlySelected = false) => {
    const list = onlySelected && selectedIds.size > 0
      ? (result?.candidates || []).filter(c => selectedIds.has(c.id))
      : candidates;
    if (!list.length) return;
    const escapeCsv = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['Roll Number', 'Name', 'Match score', 'Department', 'Batch', 'CGPA', 'Matched skills', 'Projects', 'Internships', 'Eligibility', 'Email'].map(escapeCsv);
    const rows = list.map(c => [
      c.rollNumber || c.academic?.rollNumber || '',
      c.name,
      `${c.score}%`,
      c.academic?.department || '',
      c.academic?.batchYear || '',
      c.academic?.cgpa ?? '',
      c.matchedSkills.join('; '),
      (c.projects || []).map(p => p.projectName).join('; '),
      (c.internships || []).map(i => `${i.role} at ${i.companyName}`).join('; '),
      c.eligibilityFlags.join('; ') || 'Meets eligibility',
      c.email || 'Private'
    ].map(escapeCsv).join(','));
    downloadCsvFile('pathfolio-jd-shortlist.csv', [header.join(','), ...rows].join('\n'));
  };

  const candidates = (result?.candidates || []).filter(candidate => {
    if (candidate.score < filters.minScore) return false;
    if (filters.eligibleOnly && candidate.eligibilityFlags.length) return false;
    if (!filters.search.trim()) return true;
    const needle = filters.search.toLowerCase();
    const roll = String(candidate.rollNumber || candidate.academic?.rollNumber || '');
    const projectHaystack = (candidate.projects || []).map(p => `${p.projectName} ${(p.technologies || []).join(' ')}`).join(' ');
    const internshipHaystack = (candidate.internships || []).map(i => `${i.companyName} ${i.role} ${(i.skills || []).join(' ')}`).join(' ');
    const fullHaystack = `${candidate.name} ${roll} ${candidate.academic?.department || ''} ${candidate.matchedSkills.join(' ')} ${projectHaystack} ${internshipHaystack}`.toLowerCase();
    return fullHaystack.includes(needle);
  });

  return (
    <section className="pf-admin-workspace pf-admin-jd">
      <div className="pf-admin-panel">
        <PanelHeading eyebrow="Requirement intelligence" title="Analyse a job description" action={<button className="pf-admin-jd-sample" type="button" onClick={() => { setJobTitle('Software Engineer (Frontend)'); setJobDescription(SAMPLE_JD); }}><Wand2 size={14} />Use sample</button>} />
        <p className="pf-admin-import-copy">Paste a job description or upload a .txt / .md file. Pathfolio extracts the meaningful skills and eligibility criteria, then ranks students with an explainable match.</p>
        <form className="pf-admin-form pf-admin-jd-form" onSubmit={analyze}>
          <Input label="Role title (optional)"><input value={jobTitle} onChange={event => setJobTitle(event.target.value)} placeholder="e.g. Frontend Engineer" /></Input>
          <Input label="Job description" full>
            <textarea required rows="12" value={jobDescription} onChange={event => setJobDescription(event.target.value)} placeholder="Paste the full job description here, responsibilities, skills, and qualifications..." />
          </Input>
          <label className="pf-admin-jd-upload"><Upload size={14} />Upload .txt or .md<input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={loadFile} /></label>
          <div className="pf-admin-jd-actions">
            <Button type="submit" loading={loading} icon={Sparkles}>Analyse description</Button>
            <Button type="button" variant="ghost" onClick={reset} icon={X}>Clear</Button>
            {result && <Button type="button" variant="outline" onClick={() => exportCsv(false)} icon={Download}>Export all matches</Button>}
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
              <div className="pf-admin-panel-heading">
                <div>
                  <p className="pf-admin-eyebrow">Ranked candidates</p>
                  <h2>Matches <span>{candidates.length}</span></h2>
                </div>
              </div>

              {/* Filter controls */}
              <div className="pf-admin-jd-filters">
                <input
                  type="search"
                  className="pf-admin-filter"
                  placeholder="Search candidates, skills, projects, companies..."
                  value={filters.search}
                  onChange={event => setFilters(prev => ({ ...prev, search: event.target.value }))}
                />
                <label className="pf-admin-jd-score">
                  <span>Min score</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={filters.minScore}
                    onChange={event => setFilters(prev => ({ ...prev, minScore: Number(event.target.value) }))}
                  />
                  <b>{filters.minScore}%</b>
                </label>
                <label className="pf-admin-jd-toggle">
                  <input
                    type="checkbox"
                    checked={filters.eligibleOnly}
                    onChange={event => setFilters(prev => ({ ...prev, eligibleOnly: event.target.checked }))}
                  />
                  Eligible only
                </label>
              </div>

              {/* Quick Select & Shortlist Toolbar */}
              <div className="pf-admin-jd-bulk-bar">
                <div className="pf-admin-jd-bulk-left">
                  <button className="pf-admin-jd-bulk-btn" type="button" onClick={toggleSelectAll}>
                    {selectedIds.size >= candidates.length && candidates.length > 0 ? 'Deselect All' : `Select All (${candidates.length})`}
                  </button>
                  <button className="pf-admin-jd-bulk-btn" type="button" onClick={() => selectTopN(5)}>Top 5</button>
                  <button className="pf-admin-jd-bulk-btn" type="button" onClick={() => selectTopN(10)}>Top 10</button>
                  <button className="pf-admin-jd-bulk-btn" type="button" onClick={() => selectTopN(25)}>Top 25</button>
                  {selectedIds.size > 0 && (
                    <span className="pf-admin-jd-selected-badge">
                      <CheckSquare size={13} /> {selectedIds.size} selected
                    </span>
                  )}
                </div>
                {selectedIds.size > 0 && (
                  <div className="pf-admin-jd-bulk-actions">
                    <Button type="button" variant="outline" size="sm" onClick={() => exportCsv(true)} icon={Download}>
                      Export Shortlist ({selectedIds.size})
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={copySelectedEmails} icon={copied ? Check : Copy}>
                      {copied ? 'Copied Emails!' : 'Copy Emails'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Candidate Cards */}
              {candidates.length === 0 ? (
                <Empty text="No candidates match the current filters." />
              ) : (
                candidates.map(candidate => {
                  const isSelected = selectedIds.has(candidate.id);
                  const isExpanded = expandedIds.has(candidate.id);
                  const theme = getScoreTheme(candidate.score);
                  const hasBacklogs = Number(candidate.academic?.activeBacklogs) > 0;
                  const projectCount = (candidate.projects || []).length;
                  const internshipCount = (candidate.internships || []).length;
                  const achievementCount = (candidate.achievements || []).length;
                  const githubLink = candidate.social?.links?.find(l => l.platform === 'github' || l.name?.toLowerCase().includes('github'))?.url;
                  const linkedinLink = candidate.social?.linkedin;

                  const totalRequired = result?.analysis?.skills?.length || 0;
                  const summaryBullets = getMatchSummary(candidate, totalRequired);
                  const breakdownItems = getMatchBreakdown(candidate, totalRequired);

                  return (
                    <article
                      className={`pf-admin-jd-candidate ${isSelected ? 'pf-admin-jd-candidate--selected' : ''}`}
                      key={candidate.id}
                    >
                      <div className="pf-admin-jd-candidate-top">
                        <div className="pf-admin-jd-candidate-id">
                          <label className="pf-admin-jd-select-wrap" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="pf-admin-jd-checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectCandidate(candidate.id)}
                            />
                          </label>
                          <span className="pf-admin-jd-avatar"><UserRound size={18} /></span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <h3 style={{ margin: 0 }}>{candidate.name}</h3>
                              {(candidate.rollNumber || candidate.academic?.rollNumber) && (
                                <span className="pf-admin-jd-pill pf-admin-jd-pill--roll">
                                  {candidate.rollNumber || candidate.academic?.rollNumber}
                                </span>
                              )}
                            </div>
                            <p style={{ margin: '2px 0 0' }}>{candidate.academic?.department || 'Department not listed'}{candidate.academic?.batchYear ? ` · Batch ${candidate.academic.batchYear}` : ''}</p>
                            
                            {/* Academic quick badges */}
                            <div className="pf-admin-jd-academic-badges">
                              {candidate.academic?.cgpa !== undefined && candidate.academic?.cgpa !== null && (
                                <span className="pf-admin-jd-pill pf-admin-jd-pill--cgpa">
                                  CGPA {candidate.academic.cgpa}
                                </span>
                              )}
                              <span className={`pf-admin-jd-pill ${hasBacklogs ? 'pf-admin-jd-pill--warning' : 'pf-admin-jd-pill--clear'}`}>
                                {hasBacklogs ? `${candidate.academic.activeBacklogs} Backlogs` : '0 Backlogs'}
                              </span>
                              {candidate.academic?.degreeProgram && (
                                <span className="pf-admin-jd-pill">
                                  {candidate.academic.degreeProgram}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Color-coded score badge */}
                        <div
                          className="pf-admin-jd-score-badge"
                          style={{
                            '--score': `${candidate.score}%`,
                            '--score-color': theme.color
                          }}
                        >
                          <strong style={{ color: theme.color }}>{candidate.score}%</strong>
                          <span>match</span>
                        </div>
                      </div>

                      {/* Clean Top Summary */}
                      <div className="pf-admin-jd-summary-bullets">
                        {summaryBullets.map((bullet, idx) => (
                          <span key={idx} className="pf-admin-jd-summary-bullet">
                            <CheckCircle2 size={13} /> {bullet}
                          </span>
                        ))}
                      </div>

                      {/* Match Breakdown Section */}
                      <div className="pf-admin-jd-breakdown">
                        <div className="pf-admin-jd-breakdown-title">Match breakdown</div>
                        <div className="pf-admin-jd-breakdown-grid">
                          {breakdownItems.map(item => (
                            <div key={item.label} className="pf-admin-jd-breakdown-row">
                              <span className="pf-admin-jd-breakdown-label">{item.label}</span>
                              <span className={`pf-admin-jd-breakdown-value pf-admin-jd-breakdown-value--${item.tone}`}>
                                {item.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Matched skills */}
                      {candidate.matchedSkills.length > 0 && (
                        <div className="pf-admin-jd-block">
                          <span className="pf-admin-jd-block-label">Matched skills ({candidate.matchedSkills.length})</span>
                          <div className="pf-admin-jd-chips">
                            {candidate.matchedSkills.map(skill => (
                              <b key={skill} className="pf-chip-success">✓ {skill}</b>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Missing skills */}
                      {candidate.missingSkills.length > 0 && (
                        <div className="pf-admin-jd-block">
                          <span className="pf-admin-jd-block-label">Not evidenced in profile</span>
                          <div className="pf-admin-jd-chips pf-admin-jd-chips--muted">
                            {candidate.missingSkills.map(skill => (
                              <span key={skill}>{skill}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Expandable Technical Evidence Button */}
                      {(projectCount > 0 || internshipCount > 0 || achievementCount > 0) && (
                        <button
                          type="button"
                          className="pf-admin-jd-details-btn"
                          onClick={() => toggleExpand(candidate.id)}
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          {isExpanded
                            ? 'Hide technical evidence'
                            : `View technical evidence (${projectCount} projects, ${internshipCount} internships)`}
                        </button>
                      )}

                      {/* Expandable Experience Drawer */}
                      {isExpanded && (
                        <div className="pf-admin-jd-drawer">
                          {/* Internships Section */}
                          {internshipCount > 0 && (
                            <div className="pf-admin-jd-drawer-section">
                              <h4><Briefcase size={14} /> Internships & Work Experience</h4>
                              <div className="pf-admin-jd-evidence-list">
                                {candidate.internships.map((intern, i) => (
                                  <div className="pf-admin-jd-mini-card" key={intern.id || i}>
                                    <div className="pf-admin-jd-mini-card-head">
                                      <h5>{intern.role} <span style={{ color: 'var(--color-primary)' }}>@ {intern.companyName}</span></h5>
                                      <span>{intern.workMode || 'On-site'}</span>
                                    </div>
                                    {intern.description && (
                                      <p className="pf-admin-jd-mini-card-desc">{intern.description}</p>
                                    )}
                                    {Array.isArray(intern.skills) && intern.skills.length > 0 && (
                                      <div className="pf-admin-jd-mini-card-tech">
                                        {intern.skills.map(s => <span key={s}>{s}</span>)}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Projects Section */}
                          {projectCount > 0 && (
                            <div className="pf-admin-jd-drawer-section">
                              <h4><FolderGit2 size={14} /> Projects & Technical Implementations</h4>
                              <div className="pf-admin-jd-evidence-list">
                                {candidate.projects.map((proj, p) => (
                                  <div className="pf-admin-jd-mini-card" key={proj.id || p}>
                                    <div className="pf-admin-jd-mini-card-head">
                                      <h5>{proj.projectName}</h5>
                                      <span>{proj.projectType || 'Project'}</span>
                                    </div>
                                    {proj.description && (
                                      <p className="pf-admin-jd-mini-card-desc">{proj.description}</p>
                                    )}
                                    {Array.isArray(proj.technologies) && proj.technologies.length > 0 && (
                                      <div className="pf-admin-jd-mini-card-tech">
                                        {proj.technologies.map(t => <span key={t}>{t}</span>)}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Key Achievements */}
                          {achievementCount > 0 && (
                            <div className="pf-admin-jd-drawer-section">
                              <h4><Award size={14} /> Certifications & Achievements</h4>
                              <div className="pf-admin-jd-evidence-list">
                                {candidate.achievements.slice(0, 3).map((ach, a) => (
                                  <div className="pf-admin-jd-mini-card" key={ach.id || a}>
                                    <div className="pf-admin-jd-mini-card-head">
                                      <h5>{ach.title}</h5>
                                      <span>{ach.category || 'Achievement'}</span>
                                    </div>
                                    {ach.description && (
                                      <p className="pf-admin-jd-mini-card-desc">{ach.description}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Card Footer */}
                      <div className="pf-admin-jd-candidate-foot">
                        <div>
                          {candidate.eligibilityFlags.length > 0 ? (
                            <span className="pf-admin-jd-flag">
                              <AlertTriangle size={14} /> {candidate.eligibilityFlags.join(' · ')}
                            </span>
                          ) : (
                            <span className="pf-admin-jd-ok">
                              <CheckCircle2 size={14} /> Meets stated eligibility
                            </span>
                          )}
                        </div>

                        <div className="pf-admin-jd-socials">
                          {githubLink && (
                            <a
                              className="pf-admin-jd-social-btn"
                              href={githubLink}
                              target="_blank"
                              rel="noreferrer"
                              title="GitHub Profile"
                            >
                              <Github size={13} /> GitHub
                            </a>
                          )}
                          {linkedinLink && (
                            <a
                              className="pf-admin-jd-social-btn"
                              href={linkedinLink}
                              target="_blank"
                              rel="noreferrer"
                              title="LinkedIn Profile"
                            >
                              <Linkedin size={13} /> LinkedIn
                            </a>
                          )}
                          {candidate.email ? (
                            <a className="pf-candidate-contact" href={`mailto:${candidate.email}`}>
                              <Mail size={13} style={{ marginRight: 4, verticalAlign: -1 }} /> Contact candidate
                            </a>
                          ) : (
                            <span className="pf-admin-jd-private">Contact hidden by privacy</span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
