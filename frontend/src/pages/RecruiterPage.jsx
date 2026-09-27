import React, { useEffect, useState } from 'react';
import { BriefcaseBusiness, FileText, LogOut, Search, SlidersHorizontal, Upload, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { recruiterApi } from '../services/recruiterApi';
import './RecruiterPage.css';

export function RecruiterPage() {
  const { student, logout } = useAuth();
  const [keywords, setKeywords] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const search = async (event) => {
    event?.preventDefault();
    setLoading(true);
    setError('');
    try { setStudents(await recruiterApi.searchStudents({ keywords, jobDescription })); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { search(); }, []);

  const clear = () => { setKeywords(''); setJobDescription(''); setTimeout(() => search(), 0); };
  const loadJobDescription = event => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setJobDescription(String(reader.result || '')); reader.readAsText(file); event.target.value = ''; };

  return <main className="pf-recruiter-page">
    <header className="pf-recruiter-header">
      <div><p className="pf-recruiter-eyebrow">Pathfolio talent desk</p><h1>Find the people behind the potential.</h1><p className="pf-recruiter-intro">Search student profiles by skill, interest, department, or paste a job description to surface relevant candidates.</p></div>
      <div className="pf-recruiter-header-actions"><span className="pf-recruiter-user"><UserRound size={16} />{student?.personal?.fullName || 'Recruiter'}</span><button type="button" onClick={logout}><LogOut size={16} />Sign out</button></div>
    </header>
    <form className="pf-recruiter-search" onSubmit={search}>
      <div className="pf-recruiter-search-heading"><div><p className="pf-recruiter-eyebrow">Candidate discovery</p><h2>Describe who you need</h2></div><button className="pf-recruiter-clear" type="button" onClick={clear}>Clear search</button></div>
      <label className="pf-recruiter-keywords"><Search size={18} /><input value={keywords} onChange={event => setKeywords(event.target.value)} placeholder="Keywords: React, Python, analytics, CSE..." /></label>
      <label className="pf-recruiter-jd"><FileText size={18} /><textarea value={jobDescription} onChange={event => setJobDescription(event.target.value)} rows="5" placeholder="Paste a job description here. We will match its meaningful terms against student profiles." /><span className="pf-recruiter-upload"><Upload size={14} />Upload .txt or .md<input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={loadJobDescription} /></span></label>
      <div className="pf-recruiter-search-footer"><span><SlidersHorizontal size={15} />Matches are ranked by profile overlap</span><button className="pf-recruiter-submit" type="submit" disabled={loading}><Search size={16} />{loading ? 'Searching...' : 'Find candidates'}</button></div>
    </form>
    {error && <div className="pf-recruiter-error" role="alert">{error}</div>}
    <section className="pf-recruiter-results"><div className="pf-recruiter-results-heading"><div><p className="pf-recruiter-eyebrow">Search results</p><h2>{loading ? 'Finding candidates...' : `${students.length} candidate${students.length === 1 ? '' : 's'} surfaced`}</h2></div><BriefcaseBusiness size={22} /></div>
      {!loading && students.length === 0 && <div className="pf-recruiter-empty"><h3>No matching profiles yet.</h3><p>Try a broader skill, department, or job description.</p></div>}
      <div className="pf-recruiter-grid">{students.map(candidate => <article className="pf-candidate-card" key={candidate.id}><div className="pf-candidate-top"><div><span className="pf-candidate-score">{candidate.score}% match</span><h3>{candidate.name}</h3><p>{candidate.academic?.department || 'Department not listed'} · Batch {candidate.academic?.batchYear || 'N/A'}</p></div><UserRound size={22} /></div><div className="pf-candidate-section"><span>Matched signals</span><div className="pf-candidate-tags">{candidate.matchedTerms.length ? candidate.matchedTerms.map(term => <b key={term}>{term}</b>) : <small>Browse result</small>}</div></div><div className="pf-candidate-section"><span>Interests</span><p>{[...(candidate.interests?.passions || []), ...(candidate.interests?.hobbies || [])].join(', ') || 'Not listed'}</p></div>{candidate.achievements?.length > 0 && <div className="pf-candidate-section"><span>Latest achievement</span><p>{candidate.achievements[0].title}</p></div>}{candidate.email && <a className="pf-candidate-contact" href={`mailto:${candidate.email}`}>Contact candidate</a>}</article>)}</div>
    </section>
  </main>;
}