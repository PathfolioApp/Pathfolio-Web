import React from 'react';
import { BriefcaseBusiness, UserRound } from 'lucide-react';

/** A single candidate card in the recruiter's talent-search results. */
export function CandidateCard({ candidate }) {
  return (
    <article className="pf-candidate-card">
      <div className="pf-candidate-top">
        <div>
          <span className="pf-candidate-score">{candidate.score}% match</span>
          <h3>{candidate.name}</h3>
          <p>{candidate.academic?.department || 'Department not listed'} · Batch {candidate.academic?.batchYear || 'N/A'}</p>
        </div>
        <UserRound size={22} />
      </div>
      <div className="pf-candidate-section">
        <span>Matched signals</span>
        <div className="pf-candidate-tags">
          {candidate.matchedTerms.length ? candidate.matchedTerms.map(term => <b key={term}>{term}</b>) : <small>Browse result</small>}
        </div>
      </div>
      <div className="pf-candidate-section">
        <span>Interests</span>
        <p>{[...(candidate.interests?.passions || []), ...(candidate.interests?.hobbies || [])].join(', ') || 'Not listed'}</p>
      </div>
      {candidate.achievements?.length > 0 && (
        <div className="pf-candidate-section">
          <span>Latest achievement</span>
          <p>{candidate.achievements[0].title}</p>
        </div>
      )}
      {candidate.email && <a className="pf-candidate-contact" href={`mailto:${candidate.email}`}>Contact candidate</a>}
    </article>
  );
}
