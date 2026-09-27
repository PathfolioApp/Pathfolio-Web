import React, { useEffect, useState } from 'react';
import { ArrowLeft, Building2, MapPin, Clock, ExternalLink, Paperclip, Send, Calendar, Wallet, GraduationCap, CheckCircle2, AlertTriangle, BriefcaseBusiness } from 'lucide-react';
import { opportunitiesApi } from '../services/opportunitiesApi';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import './PlacementPage.css';

const formatISTDate = dateString => {
  if (!dateString) return '';
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(dateString));
};
const salaryLabel = job => {
  if (!job.salaryMin && !job.salaryMax) return '';
  const currency = job.salaryCurrency || 'INR';
  const format = value => value >= 100000 ? `${(value / 100000).toFixed(value % 100000 ? 1 : 0)}L` : value;
  if (job.salaryMin && job.salaryMax) return `${currency} ${format(job.salaryMin)} – ${format(job.salaryMax)}`;
  return `${currency} ${format(job.salaryMin || job.salaryMax)}`;
};

export function PlacementPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    loadOpportunities();
  }, []);

  const loadOpportunities = async () => {
    setLoading(true);
    try {
      const data = await opportunitiesApi.getOpportunities();
      setJobs(data.jobPosts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (selectedJob) {
    return <JobProfile job={selectedJob} onBack={() => setSelectedJob(null)} onApplied={loadOpportunities} />;
  }

  return (
    <main className="pf-placement-page">
      <header className="pf-placement-header">
        <p className="pf-placement-eyebrow">Placement Portal</p>
        <h1>Opportunities</h1>
        <p className="pf-placement-intro">Explore active job postings from hiring partners and track your application eligibility.</p>
      </header>
      
      {error && <div className="pf-admin-error">{error}</div>}
      
      <section className="pf-placement-container">
        <div className="pf-placement-list">
          {loading ? (
            <p className="pf-placement-loading">Loading opportunities…</p>
          ) : jobs.length === 0 ? (
            <div className="pf-placement-empty"><BriefcaseBusiness size={22} /><h3>No active opportunities right now.</h3><p>Check back soon — new roles from hiring partners appear here the moment they are published.</p></div>
          ) : (
            jobs.map(job => (
              <button key={job.id} className="pf-job-card" onClick={() => setSelectedJob(job)}>
                <div className="pf-job-card-header">
                  <div className="pf-job-card-company">
                    {job.companyLogoUrl ? (
                      <img className="pf-job-company-logo" src={job.companyLogoUrl} alt={`${job.companyName} logo`} />
                    ) : (
                      <div className="pf-job-company-logo" style={{ display: 'grid', placeItems: 'center', background: '#f0f3ee', color: '#9aa79a' }}>
                        <Building2 size={20} />
                      </div>
                    )}
                    <div className="pf-job-card-meta">
                      <strong>{job.companyName}</strong>
                      <span>Posted {formatISTDate(job.publishedAt || job.updatedAt)}</span>
                    </div>
                  </div>
                  {job.hasApplied ? <span className="pf-job-applied-badge"><CheckCircle2 size={14} />Applied</span> : !job.eligibility?.meetsAll ? <span className="pf-job-eligibility-badge"><AlertTriangle size={13} />Check eligibility</span> : null}
                </div>
                <h2>{job.title}</h2>
                <div className="pf-job-card-facts">
                  <span><MapPin size={14} /> {job.location || 'Flexible'}{job.workMode ? ` · ${job.workMode}` : ''}</span>
                  <span><Clock size={14} /> {job.employmentType || 'Full-time'}</span>
                  {salaryLabel(job) && <span><Wallet size={14} /> {salaryLabel(job)}</span>}
                  {job.applicationDeadline && <span><Calendar size={14} /> Apply by {formatISTDate(job.applicationDeadline)}</span>}
                  {job.eligibility?.minCgpa && <span><GraduationCap size={14} /> CGPA {job.eligibility.minCgpa}+</span>}
                </div>
                <div className="pf-job-card-footer" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    {(job.requiredSkills || []).slice(0, 4).map(skill => <span key={skill} className="pf-job-skill-chip">{skill}</span>)}
                  </div>
                  <span style={{ color: '#557550', fontWeight: 700 }}>View details &rarr;</span>
                </div>
              </button>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function JobProfile({ job, onBack, onApplied }) {
  const { student } = useAuth();
  const [answers, setAnswers] = useState({});
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [applied, setApplied] = useState(Boolean(job.hasApplied));
  const eligibilityIssues = job.eligibility?.issues || [];
  const deadlinePassed = Boolean(job.deadlinePassed);

  useEffect(() => {
    if (job?.applicationForm?.fields) {
      const initialAnswers = {};
      job.applicationForm.fields.forEach(field => {
        let val = '';
        if (field.id === 'rollNumber') val = student?.academic?.rollNumber || '';
        if (field.id === 'department') val = student?.academic?.department || '';
        if (field.id === 'batchYear') val = student?.academic?.batchYear || '';
        if (field.id === 'cgpa') val = student?.academic?.cgpa || '';
        initialAnswers[field.id] = val;
      });
      setAnswers(initialAnswers);
    }
  }, [job, student]);

  const handleApply = async (e) => {
    e.preventDefault();
    setApplying(true);
    setApplyError('');
    try {
      await opportunitiesApi.apply(job.id, answers);
      setApplied(true);
      onApplied?.();
    } catch (err) {
      setApplyError(err.message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <main className="pf-placement-page">
      <div className="pf-placement-header">
        <button className="pf-placement-back" onClick={onBack}><ArrowLeft size={16} /> Back to opportunities</button>
      </div>
      
      <div className="pf-placement-container">
        <article className="pf-job-detail">
          <div className="pf-job-main">
            <h1 className="pf-job-title">{job.title}</h1>
            <div className="pf-job-subtitle">
              <strong>{job.companyName}</strong> · {job.location || 'Location flexible'}{job.workMode ? ` · ${job.workMode}` : ''} · {job.employmentType || 'Full-time'}
            </div>

            {(salaryLabel(job) || job.applicationDeadline || job.eligibility?.minCgpa) && <div className="pf-job-facts">
              {salaryLabel(job) && <span><Wallet size={14} /> {salaryLabel(job)}</span>}
              {job.applicationDeadline && <span><Calendar size={14} /> Apply by {formatISTDate(job.applicationDeadline)}</span>}
              {job.eligibility?.minCgpa && <span><GraduationCap size={14} /> CGPA {job.eligibility.minCgpa}+</span>}
              {job.eligibility?.maxActiveBacklogs !== null && job.eligibility?.maxActiveBacklogs !== undefined && <span><AlertTriangle size={14} /> Max {job.eligibility.maxActiveBacklogs} backlog(s)</span>}
            </div>}

            {(job.requiredSkills || []).length > 0 && <div className="pf-job-skills">
              {job.requiredSkills.map(skill => <span key={skill} className="pf-job-skill-chip">{skill}</span>)}
            </div>}

            {eligibilityIssues.length > 0 && <div className="pf-job-eligibility"><AlertTriangle size={15} /><div><b>Eligibility criteria you don't currently meet:</b><ul>{eligibilityIssues.map(issue => <li key={issue}>{issue}</li>)}</ul></div></div>}

            <div className="pf-job-desc">{job.description}</div>
            
            {job.attachments && job.attachments.length > 0 && (
              <div className="pf-job-attachments">
                <h3>Attachments</h3>
                <div className="pf-job-attach-list">
                  {job.attachments.map((att, i) => (
                    <a key={i} href={att.url} target="_blank" rel="noreferrer" className="pf-job-attach-link">
                      {att.type === 'link' ? <ExternalLink size={16} /> : <Paperclip size={16} />}
                      {att.name || 'Attachment'}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="pf-job-sidebar">
            {applied ? (
              <div className="pf-apply-success">
                <CheckCircle2 size={22} />
                <h3>Application submitted</h3>
                <p>You have successfully applied for this role. Your profile snapshot was included.</p>
                <Button variant="outline" size="sm" onClick={onBack}>Browse more roles</Button>
              </div>
            ) : deadlinePassed ? (
              <div className="pf-apply-closed"><AlertTriangle size={20} /><h3>Applications closed</h3><p>The deadline for this role passed on {formatISTDate(job.applicationDeadline)}.</p><Button variant="outline" size="sm" onClick={onBack}>Back to opportunities</Button></div>
            ) : (
              <form className="pf-apply-form" onSubmit={handleApply}>
                {(job.applicationForm?.fields?.length > 0 || (job.applicationUrl && job.applicationUrl.trim() !== '')) && (
                  <h3>Apply for this role</h3>
                )}
                {applyError && <div style={{ color: '#98483d', fontSize: '0.85rem' }}>{applyError}</div>}
                
                {job.applicationForm?.fields?.map(field => (
                  <label key={field.id}>
                    {field.label} {field.required && '*'}
                    <input 
                      type={field.type === 'url' ? 'url' : 'text'} 
                      required={field.required} 
                      value={answers[field.id] || ''}
                      onChange={e => setAnswers({ ...answers, [field.id]: e.target.value })}
                    />
                  </label>
                ))}
                
                {job.applicationUrl && job.applicationUrl.trim() !== '' && (
                  <Button type="button" onClick={() => window.open(job.applicationUrl, '_blank')} icon={ExternalLink}>
                    External application
                  </Button>
                )}
                
                {job.applicationForm?.fields?.length > 0 && (
                  <>
                    <Button type="submit" loading={applying} icon={Send} variant="primary">
                      Submit application
                    </Button>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                      Your current profile information will be securely attached to this application.
                    </p>
                  </>
                )}
              </form>
            )}
          </div>
        </article>
      </div>
    </main>
  );
}
