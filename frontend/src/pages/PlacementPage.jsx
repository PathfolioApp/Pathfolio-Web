import React, { useEffect, useState } from 'react';
import { ArrowLeft, Building2, MapPin, Clock, ExternalLink, Paperclip, Send } from 'lucide-react';
import { opportunitiesApi } from '../services/opportunitiesApi';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import './PlacementPage.css';

const formatISTDate = dateString => {
  if (!dateString) return '';
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(dateString));
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
    return <JobProfile job={selectedJob} onBack={() => setSelectedJob(null)} />;
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
            <p>Loading opportunities...</p>
          ) : jobs.length === 0 ? (
            <p>No active opportunities at the moment.</p>
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
                </div>
                <h2>{job.title}</h2>
                <div className="pf-job-card-footer" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <span><MapPin size={14} /> {job.location || 'Flexible'}</span>
                    <span><Clock size={14} /> {job.employmentType || 'Full-time'}</span>
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

function JobProfile({ job, onBack }) {
  const { student } = useAuth();
  const [answers, setAnswers] = useState({});
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [applied, setApplied] = useState(false);

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
              <strong>{job.companyName}</strong> · {job.location || 'Location flexible'} · {job.employmentType || 'Full-time'}
            </div>
            
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
                <h3>Application submitted</h3>
                <p>You have successfully applied for this role. Your profile snapshot was included.</p>
              </div>
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
                    <p style={{ fontSize: '0.75rem', color: '#718174', margin: 0 }}>
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
