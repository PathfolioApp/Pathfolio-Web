import React from 'react';
import { ArrowUpRight, Calendar, CheckCircle2, ExternalLink, FileText, GraduationCap, Paperclip, Send } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { academicComparisons } from './placementModel.mjs';

const deadlineLabel = value => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
}).format(new Date(value)) + ' IST' : 'Not specified';

export function PlacementOverview({ job, student, applied, deadlinePassed, state, onJourney, onEligibility, onApply }) {
  const issues = job.eligibility?.issues || [];
  const external = Boolean(job.applicationUrl?.trim());
  const requirements = academicComparisons(student, job.eligibility).filter(item => item.state !== 'unrestricted').length;
  const action = applied
    ? { title: 'Your application is on record.', description: 'Follow its latest status and review the details you submitted in your application journey.', label: 'View application journey', icon: ArrowUpRight, run: onJourney }
    : deadlinePassed
      ? { title: 'Applications are closed.', description: 'This role is no longer accepting applications. You can still review its description and requirements.', label: 'Applications closed', disabled: true }
      : issues.length
        ? { title: state.label, description: 'Review the requirements and any missing profile details before making your next move.', label: 'Review eligibility', icon: GraduationCap, run: onEligibility }
        : external
          ? { title: 'Your next move is with the company.', description: 'Apply on the company website. Opening it does not submit or track a campus application.', label: 'Apply on company site', icon: ExternalLink, run: () => window.open(job.applicationUrl, '_blank', 'noopener,noreferrer') }
          : { title: 'Ready for your next move?', description: 'Choose a resume, answer any employer questions, and review what you share before submitting.', label: 'Apply for this role', icon: Send, run: onApply };
  return <section className="pf-opp-tab-panel pf-jd-grid pf-overview-workspace" aria-label="Role overview">
    <div className="pf-overview-main-column">
      <section className="pf-jd-main-card pf-overview-description"><p className="pf-placement-eyebrow">The opportunity</p><h2>Get to know the role.</h2>
        <div className="pf-jd-body">{job.description?.trim() || 'The hiring team hasn’t provided a description for this role. Check any shared documents or contact your placement team for more details.'}</div>
      </section>
      {job.attachments?.length > 0 && <section className="pf-jd-main-card pf-overview-documents"><div className="pf-overview-section-heading"><span className="pf-overview-section-icon"><Paperclip size={18} /></span><div><h3>From the hiring team</h3><p>Documents and links shared with this opportunity.</p></div></div><ul>{job.attachments.map((attachment, index) => <li key={index}><a href={attachment.url} target="_blank" rel="noopener noreferrer" aria-label={`${attachment.name || 'Attachment'} (opens in a new tab)`}><span className="pf-overview-file-icon">{attachment.type === 'link' ? <ExternalLink size={19} /> : <FileText size={19} />}</span><span>{attachment.name || 'Attachment'}<small>{attachment.type === 'link' ? 'External link' : 'Shared document'} · Opens in a new tab</small></span><ArrowUpRight size={17} /></a></li>)}</ul></section>}
    </div>
    <aside className="pf-jd-side-column pf-overview-sidebar" aria-label="Application information">
      <section className="pf-overview-next-step"><span className="pf-placement-eyebrow">Your next step</span><h3>{action.title}</h3><p>{action.description}</p><Button icon={action.icon} disabled={action.disabled} variant={issues.length && !applied ? 'outline' : 'primary'} onClick={action.run}>{action.label}</Button></section>
      <section className="pf-jd-side-card pf-overview-application-details"><h3>Before you apply</h3><dl><div><dt><Calendar size={14} />{deadlinePassed ? 'Deadline passed' : 'Application deadline'}</dt><dd>{deadlineLabel(job.applicationDeadline)}</dd></div><div><dt><Send size={14} />Application route</dt><dd>{external ? 'Company website' : 'Campus application'}</dd></div><div><dt><GraduationCap size={14} />Academic requirements</dt><dd>{requirements ? `${requirements} ${requirements === 1 ? 'requirement' : 'requirements'} listed` : 'No academic restrictions listed'}</dd></div></dl><button type="button" className="pf-overview-text-link" onClick={onEligibility}>Review all eligibility criteria <ArrowUpRight size={14} /></button>{!applied && !issues.length && !deadlinePassed && <p className="pf-overview-eligibility-note"><CheckCircle2 size={14} />Your current profile meets the listed criteria.</p>}</section>
      {job.requiredSkills?.length > 0 && <section className="pf-jd-side-card pf-overview-skills"><h3>Skills they’re looking for</h3><div className="pf-placement-skills">{job.requiredSkills.map(skill => <span key={skill} className="pf-job-skill-chip">{skill}</span>)}</div></section>}
    </aside>
  </section>;
}
