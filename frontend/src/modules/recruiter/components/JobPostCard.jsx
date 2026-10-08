import React from 'react';
import { Building2, MapPin, Clock, Calendar, Wallet, GraduationCap, Pencil, Send, Eye } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { StatusBadge } from '../../../components/ui/Badge';
import { EditedBadge } from '../../../components/ui/EditedBadge';
import { salaryLabel, deadlineLabel, deadlinePassed } from '../utils/jobFormatting';

const STATUS_LABELS = {
  draft: 'Draft',
  pending_approval: 'Pending',
  approved: 'Approved',
  rejected: 'Changes requested',
  published: 'Live',
  closed: 'Closed'
};

/** A single job-post row in the recruiter's "My job posts" list. */
export function JobPostCard({ job, onEdit, onSubmit, onViewApplications }) {
  // One badge only: status; if the deadline passed but the post is still
  // live, the status label carries that context instead of a second badge.
  const statusLabel = STATUS_LABELS[job.status] || job.status;
  const expiredLive = job.status === 'published' && deadlinePassed(job);
  return (
    <article className={`pf-recruiter-job ${job.status === 'published' ? 'is-live' : ''}`}>
      <div className="pf-recruiter-job-top">
        <div>
          <div className="pf-recruiter-job-badges">
            <StatusBadge status={job.status} label={expiredLive ? `${statusLabel} · deadline passed` : statusLabel} />
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
        <p className="pf-recruiter-job-review-note">
          <b>Placement team:</b> {job.reviewNote}
        </p>
      )}
      <div className="pf-recruiter-job-facts">
        {job.employmentType && <span><Clock size={13} />{job.employmentType}</span>}
        {salaryLabel(job) && <span><Wallet size={13} />{salaryLabel(job)}</span>}
        {deadlineLabel(job) && <span><Calendar size={13} />Apply by {deadlineLabel(job)}</span>}
        {job.eligibility?.minCgpa && <span><GraduationCap size={13} />CGPA {job.eligibility.minCgpa}+</span>}
        <EditedBadge createdAt={job.createdAt} updatedAt={job.updatedAt} />
      </div>
      {(job.requiredSkills || []).length > 0 && (
        <div className="pf-recruiter-job-skills">{job.requiredSkills.slice(0, 8).map(skill => <b key={skill}>{skill}</b>)}</div>
      )}
      <div className="pf-recruiter-job-actions">
        {job.status === 'published' ? 'Live for students' : job.status === 'pending_approval' ? 'Awaiting placement team review' : job.status === 'approved' ? 'Approved, the placement team will publish it' : ''}
        <div className="pf-recruiter-job-actions-cluster">
          {/* Editable in every status - a live post can be fixed without closing it. */}
          <Button variant="secondary" size="sm" icon={Pencil} onClick={() => onEdit(job)}>Edit</Button>
          {['draft', 'rejected'].includes(job.status) && <Button size="sm" icon={Send} onClick={() => onSubmit(job)}>Submit for approval</Button>}
          {['pending_approval', 'approved', 'published', 'closed'].includes(job.status) && onViewApplications && (
            <Button variant="ghost" size="sm" icon={Eye} onClick={() => onViewApplications(job)}>Applications</Button>
          )}
        </div>
      </div>
    </article>
  );
}
