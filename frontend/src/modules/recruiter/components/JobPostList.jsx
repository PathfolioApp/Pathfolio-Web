import React from 'react';
import { Plus, Building2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { JobPostCard } from './JobPostCard';

/** The recruiter's "My job posts" management section. */
export function JobPostList({ jobs, jobsLoading, companies, onOpenComposer, onEdit, onSubmit, onViewApplications }) {
  return (
    <section className="pf-recruiter-results">
      <div className="pf-recruiter-results-heading">
        <div><p className="pf-recruiter-eyebrow">Opportunities</p><h2>My job posts</h2></div>
        <Button icon={Plus} onClick={() => onOpenComposer()}>New job post</Button>
      </div>
      {jobsLoading && <p className="pf-recruiter-loading">Loading your job posts…</p>}
      {!jobsLoading && jobs.length === 0 && <div className="pf-recruiter-empty"><h3>No job posts yet.</h3><p>Create your first opportunity, it goes live for students once the placement team reviews and publishes it.</p></div>}
      <div className="pf-recruiter-jobs">
        {jobs.map(job => <JobPostCard key={job.id} job={job} onEdit={onEdit} onSubmit={onSubmit} onViewApplications={onViewApplications} />)}
      </div>
    </section>
  );
}
