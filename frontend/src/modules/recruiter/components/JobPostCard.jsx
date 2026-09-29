import React from 'react';
import { Building2, MapPin, Clock, Calendar, Wallet, GraduationCap, Pencil, Send, FileText, Eye } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { salaryLabel, deadlineLabel, deadlinePassed } from '../utils/jobFormatting';

const STATUS_LABELS = {
  draft: 'Draft',
  pending_approval: 'Pending approval',
  approved: 'Approved',
  rejected: 'Changes requested',
  published: 'Live',
  closed: 'Closed'
};

/** A single job-post card in the recruiter's "My job posts" list. */
export function JobPostCard({ job, onEdit, onSubmit, onViewApplications }) {
  return (
    <article className={`pf-recruiter-job ${job.status === 'published' ? 'is-live' : ''}`}>
      <div className="pf-recruiter-job-top">
        <div>
          <div className="pf-recruiter-job-badges">
            <span className={`pf-recruiter-job-status is-${job.status === 'published' ? 'published' : job.status === 'pending_approval' ? 'draft' : 'draft'}`}>{STATUS_LABELS[job.status] || job.status}</span>
            {deadlinePassed(job) && <span className="pf-recruiter-job-status is-expired">deadline passed</span>}
          </div>
          <h3>{job.title}</h3>
          <p className="pf-recruiter-job-company">
            <Building2 size={14} />{job.companyName}
            {job.location ? <> · <MapPin size={14} />{job.location} ({job.workMode || 'On-site'})</> : null}
          </p>
        </div>
      </div>
      <p className="pf-recruiter-job-desc">{job.description.length > 180 ? `${job.description.slice(0, 180)}…` : job.description}</p>
      {job.reviewNote && (
        <p className="pf-recruiter-job-review-note" style={{ margin: '8px 0', padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <b>Placement team:</b> {job.reviewNote}
        </p>
      )}
      <div className="pf-recruiter-job-facts">
        {job.employmentType && <span><Clock size={13} />{job.employmentType}</span>}
        {salaryLabel(job) && <span><Wallet size={13} />{salaryLabel(job)}</span>}
        {deadlineLabel(job) && <span><Calendar size={13} />Apply by {deadlineLabel(job)}</span>}
        {job.eligibility?.minCgpa && <span><GraduationCap size={13} />CGPA {job.eligibility.minCgpa}+</span>}
      </div>
      {(job.requiredSkills || []).length > 0 && (
        <div className="pf-recruiter-job-skills">{job.requiredSkills.slice(0, 8).map(skill => <b key={skill}>{skill}</b>)}</div>
      )}
      <div className="pf-recruiter-job-actions">
        <span className="pf-recruiter-job-meta">
          {job.status === 'published' ? 'Live for students' : job.status === 'pending_approval' ? 'Awaiting placement team review' : job.status === 'approved' ? 'Approved — the placement team will publish it' : 'Manage this opportunity'}
        </span>
        {['draft', 'rejected'].includes(job.status) && <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(job)}>Edit</Button>}
        {['draft', 'rejected'].includes(job.status) && <Button size="sm" icon={Send} onClick={() => onSubmit(job)}>Submit for approval</Button>}
        {['pending_approval', 'approved', 'published', 'closed'].includes(job.status) && onViewApplications && (
          <Button variant="ghost" size="sm" icon={Eye} onClick={() => onViewApplications(job)}>Applications</Button>
        )}
      </div>
    </article>
  );
}
