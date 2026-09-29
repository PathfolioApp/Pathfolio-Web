import React from 'react';
import { Building2, MapPin, Clock, Calendar, Wallet, GraduationCap, Pencil, Undo2, Send } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { salaryLabel, deadlineLabel, deadlinePassed } from '../utils/jobFormatting';

/** A single job-post card in the recruiter's "My job posts" list. */
export function JobPostCard({ job, onEdit, onPublishToggle }) {
  return (
    <article className={`pf-recruiter-job ${job.status === 'published' ? 'is-live' : ''}`}>
      <div className="pf-recruiter-job-top">
        <div>
          <div className="pf-recruiter-job-badges">
            <span className={`pf-recruiter-job-status is-${job.status}`}>{job.status}</span>
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
        <span className="pf-recruiter-job-meta">Manage this opportunity</span>
        <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(job)} disabled={job.status === 'published'}>Edit</Button>
        {job.status === 'published'
          ? <Button variant="outline" size="sm" icon={Undo2} onClick={() => onPublishToggle(job, false)}>Unpublish</Button>
          : <Button size="sm" icon={Send} onClick={() => onPublishToggle(job, true)}>Publish</Button>}
      </div>
    </article>
  );
}
