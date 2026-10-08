import React from 'react';
import { BriefcaseBusiness } from 'lucide-react';
import { JobPostCard } from './JobPostCard';
import { EmptyState } from '../../../components/ui/EmptyState';

/** The recruiter's "My job posts" management section. */
export function JobPostList({ jobs, jobsLoading, onEdit, onSubmit, onViewApplications }) {
  return (
    <section className="pf-recruiter-results">
      {jobsLoading && <p className="pf-recruiter-loading">Loading your job posts…</p>}
      {!jobsLoading && jobs.length === 0 && (
        <EmptyState
          icon={BriefcaseBusiness}
          title="No job posts yet"
          text="Create your first opportunity - it goes live for students once the placement team reviews and publishes it."
        />
      )}
      <div className="pf-recruiter-jobs pf-recruiter-jobs--rows">
        {jobs.map(job => <JobPostCard key={job.id} job={job} onEdit={onEdit} onSubmit={onSubmit} onViewApplications={onViewApplications} />)}
      </div>
    </section>
  );
}
