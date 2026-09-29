import React, { useState } from 'react';
import { FileText, Search, SlidersHorizontal, Upload, BriefcaseBusiness } from 'lucide-react';
import { CandidateCard } from './CandidateCard';

/** Keyword + job-description search over student profiles. */
export function TalentSearch({ keywords, setKeywords, jobDescription, setJobDescription, onSearch, onClear, loading, students, error }) {
  const loadJobDescription = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setJobDescription(String(reader.result || ''));
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <>
      <form className="pf-recruiter-search" onSubmit={onSearch}>
        <div className="pf-recruiter-search-heading">
          <div><p className="pf-recruiter-eyebrow">Candidate discovery</p><h2>Describe who you need</h2></div>
          <button className="pf-recruiter-clear" type="button" onClick={onClear}>Clear search</button>
        </div>
        <label className="pf-recruiter-keywords">
          <Search size={18} />
          <input value={keywords} onChange={event => setKeywords(event.target.value)} placeholder="Keywords: React, Python, analytics, CSE..." />
        </label>
        <label className="pf-recruiter-jd">
          <FileText size={18} />
          <textarea value={jobDescription} onChange={event => setJobDescription(event.target.value)} rows="5" placeholder="Paste a job description here. We will match its meaningful terms against student profiles." />
          <span className="pf-recruiter-upload"><Upload size={14} />Upload .txt or .md<input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={loadJobDescription} /></span>
        </label>
        <div className="pf-recruiter-search-footer">
          <span><SlidersHorizontal size={15} />Matches are ranked by profile overlap</span>
          <button className="pf-recruiter-submit" type="submit" disabled={loading}><Search size={16} />{loading ? 'Searching...' : 'Find candidates'}</button>
        </div>
      </form>
      <section className="pf-recruiter-results">
        <div className="pf-recruiter-results-heading">
          <div><p className="pf-recruiter-eyebrow">Search results</p><h2>{loading ? 'Finding candidates...' : `${students.length} candidate${students.length === 1 ? '' : 's'} surfaced`}</h2></div>
          <BriefcaseBusiness size={22} />
        </div>
        {error && <div className="pf-recruiter-error" role="alert">{error}</div>}
        {!loading && students.length === 0 && <div className="pf-recruiter-empty"><h3>No matching profiles yet.</h3><p>Try a broader skill, department, or job description.</p></div>}
        <div className="pf-recruiter-grid">
          {students.map(candidate => <CandidateCard key={candidate.id} candidate={candidate} />)}
        </div>
      </section>
    </>
  );
}
