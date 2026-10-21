import React from 'react';
import { Check, FileText, ListChecks, Calendar, Flag, Clock } from 'lucide-react';
import { applicationLabels, applicationMessages, applicationUpdates } from './placementModel.mjs';

export const placementDate = value => Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }) : 'Not recorded';

const stages = [['applied', 'Applied', FileText], ['shortlisted', 'Shortlisted', ListChecks], ['interview', 'Interview', Calendar], ['selected', 'Selected', Flag]];

export function ApplicationJourney({ application, compact = false, headingRef }) {
  const status = application.status || 'applied';
  const message = applicationMessages[status];
  return <div className={`pf-application-journey ${compact ? 'is-compact' : ''}`}>
    {!compact && <div className="pf-journey-message"><span className="pf-placement-eyebrow">Your application</span><h2 ref={headingRef} tabIndex={headingRef ? -1 : undefined}>{message?.title || applicationLabels[status] || status}</h2><p>{message?.description || 'Check with your placement team for the next steps.'}</p></div>}
    <ol className="pf-journey-stages" aria-label="Recruitment stages">
      {stages.map(([key, label, Icon]) => <li key={key} className={status === key ? 'is-current' : key === 'applied' ? 'is-submitted' : ''} aria-current={status === key ? 'step' : undefined}>
        <span className="pf-journey-node">{key === 'applied' ? <Check size={16} /> : <Icon size={16} />}</span><div><strong>{label}</strong>{status === key ? <span className="pf-journey-current-badge">Current</span> : <small>{key === 'applied' ? 'Submitted' : 'Recruitment stage'}</small>}</div>
      </li>)}
    </ol>
    {status === 'rejected' && <p className="pf-journey-outcome"><Flag size={15} />Latest outcome: not selected</p>}
    <p className="pf-placement-notice pf-journey-caption">{status === 'rejected' ? 'Your application’s recorded outcome is shown above.' : 'Stages may vary by role. Your latest recorded status is highlighted.'}</p>
    <div className="pf-journey-updates"><h3><Clock size={15} />Recorded updates</h3>
      {applicationUpdates(application).length ? <ol className="pf-placement-history">{applicationUpdates(application).map((event, index) => <li key={index}><span>{event.label}</span><time dateTime={event.at}>{placementDate(event.at)}</time></li>)}</ol> : <p className="pf-placement-notice">No dated updates have been recorded yet.</p>}
    </div>
  </div>;
}
