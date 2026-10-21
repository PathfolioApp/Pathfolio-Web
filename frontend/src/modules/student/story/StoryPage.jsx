import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowRight, Award, BriefcaseBusiness, FolderGit2, Sparkles, Wand2, ChevronDown, Check, Copy } from 'lucide-react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { storySummary } from './storyApi';
import { AchievementIcon, getAchievementCategoryConfig } from '../../../components/ui/AchievementIcon';
import './StoryPage.css';

const kinds = {
  project: { label: 'Project', plural: 'Projects', Icon: FolderGit2 },
  experience: { label: 'Experience', plural: 'Experience', Icon: BriefcaseBusiness },
  milestone: { label: 'Milestone', plural: 'Milestones', Icon: Award },
};
const names = items => (items || []).map(item => typeof item === 'string' ? item : item?.name).filter(Boolean);
const validDate = value => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
const yearOf = value => /^\d{4}$/.test(String(value || '')) ? Number(value) : null;

function momentsFor(student) {
  const projects = (student.projects || []).map(p => ({
    id: `project-${p.id || p.projectName}`, kind: 'project', title: p.projectName,
    description: p.description, tags: p.technologies || [], image: p.thumbnail,
    date: validDate(p.endDate || p.startDate), active: p.currentlyWorking, featured: p.featured,
    detail: p.projectType,
  }));
  const experience = (student.internships || []).map(i => ({
    id: `experience-${i.id || `${i.companyName}-${i.role}`}`, kind: 'experience', title: i.role,
    description: i.description, tags: i.skills || [], logo: i.companyLogo,
    date: validDate(i.endDate || i.startDate), active: i.currentlyWorking, detail: i.companyName,
  }));
  const milestones = (student.achievements || []).map((a, index) => ({
    id: `milestone-${a.id || index}`, kind: 'milestone', title: a.title,
    description: a.description, tags: [], year: yearOf(a.year), detail: a.category,
  }));
  return [...projects, ...experience, ...milestones].filter(item => item.title).map(item => ({
    ...item, year: item.year || (item.date ? new Date(item.date).getFullYear() : null),
  })).sort((a, b) => (b.year || 0) - (a.year || 0) || (b.date || 0) - (a.date || 0));
}

function MomentCard({ moment }) {
  const descriptionId = useId();
  const [expanded, setExpanded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const { Icon, label } = kinds[moment.kind];
  const category = moment.kind === 'milestone' ? getAchievementCategoryConfig(moment.detail) : null;
  const description = String(moment.description || '').replace(/\*\*(.*?)\*\*/g, '$1');
  return <article className={`sd-card sd-card--${moment.kind}`} style={category ? { '--sd-milestone-accent': category.color, '--sd-milestone-bg': category.bg } : undefined}>
    {moment.kind === 'project' && <div className="sd-card__visual">
      {moment.image && !imageFailed
        ? <img src={moment.image} alt="" loading="lazy" onError={() => setImageFailed(true)} />
        : <div className="sd-project-art" aria-hidden="true"><div className="sd-project-art__window"><span /><span /><span /><div /><div /><div /><FolderGit2 size={30} /></div><span className="sd-project-art__label">{moment.title}</span></div>}
      {moment.featured && <span className="sd-featured"><Sparkles size={12} /> Featured in your profile</span>}
    </div>}
    <div className="sd-card__content">
      <div className="sd-card__eyebrow">{category ? <div className="sd-card__category"><AchievementIcon category={moment.detail} size={22} badgeSize={44} aria-hidden="true" /><span>{moment.detail || label}</span></div> : <span><Icon size={14} /> {moment.detail || label}</span>}{moment.active && <span className="sd-active">Ongoing</span>}</div>
      {moment.kind === 'experience' && moment.logo && !imageFailed && <img className="sd-company-logo" src={moment.logo} alt="" onError={() => setImageFailed(true)} />}
      <h3>{moment.title}</h3>
      {description && <p id={descriptionId} className="sd-description">{!expanded && description.length > 160 ? `${description.slice(0, 160).trimEnd()}…` : description}</p>}
      {!!moment.tags.length && <div className="sd-tags">{moment.tags.slice(0, expanded ? moment.tags.length : 4).map((tag, index) => <span key={`${tag}-${index}`}>{tag}</span>)}{!expanded && moment.tags.length > 4 && <span>+{moment.tags.length - 4}</span>}</div>}
      <div className="sd-card__footer">
        <span>{moment.date ? new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(moment.date) : moment.year || 'Date not added'}</span>
        {(description.length > 160 || moment.tags.length > 4) && <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls={description ? descriptionId : undefined}>{expanded ? 'Show less' : 'Read more'}<ChevronDown size={14} className={expanded ? 'sd-rotate' : ''} /></button>}
      </div>
    </div>
  </article>;
}

export function StoryPage() {
  const { student } = useAuth();
  const [filter, setFilter] = useState('all');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState('');
  const activeRequest = useRef(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const moments = momentsFor(student);
  const interests = [...new Set([...names(student.interests?.passions), ...names(student.interests?.hobbies)])];
  const firstName = student.personal?.fullName?.trim().split(/\s+/)[0] || 'Your';
  const filtered = moments.filter(item => filter === 'all' || item.kind === filter);
  const years = [...new Set(filtered.map(item => item.year))];

  const load = useCallback(async (generate = false, regenerate = false) => {
    activeRequest.current?.abort();
    const controller = new window.AbortController();
    activeRequest.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 26000);
    setLoading(true); setGenerating(generate); setError(''); setNotice(''); setCopied(false);
    try {
      const data = await storySummary({ generate, regenerate, signal: controller.signal });
      if (!controller.signal.aborted) { setSummary(data.summary); setNotice(data.notice || ''); }
    } catch (err) {
      if (activeRequest.current === controller && (!controller.signal.aborted || timedOut)) setError(timedOut ? 'Story writing is taking longer than expected. Your saved summary is safe; please try again shortly.' : err.message);
    } finally {
      clearTimeout(timer);
      if (activeRequest.current === controller) { setLoading(false); setGenerating(false); }
    }
  }, []);
  useEffect(() => {
    // Loading a saved summary never calls the AI provider.
    setSummary(null);
    load();
    return () => { activeRequest.current?.abort(); activeRequest.current = null; };
  }, [load, student.id, student.updatedAt]);
  const generate = () => load(true, Boolean(summary?.available));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText([summary.summary, ...(summary.highlights || []).map(h => `• ${h}`)].join('\n'));
      setCopied(true);
    } catch { setError('Copy was unavailable. You can select and copy the summary text.'); }
  };

  return <div className="sd-page">
    <header className="sd-hero">
      <div className="sd-hero__copy"><p className="sd-eyebrow">{firstName === 'Your' ? 'Your story' : `${firstName}'s story`}</p><h1>Small steps.<br /><em>A story taking shape.</em></h1><p className="sd-hero__intro">The things you have built, the experiences you have gathered, and the moments that make this journey yours.</p><Link to="/profile/edit" className="sd-text-link">Add your next chapter <ArrowUpRight size={16} /></Link></div>
      <div className="sd-journey-note"><span className="sd-note-symbol" aria-hidden="true"><Sparkles size={24} /></span><p className="sd-eyebrow">Your journey, so far</p><div className="sd-record-count"><strong>{moments.length}</strong><span>recorded {moments.length === 1 ? 'moment' : 'moments'}</span></div><div className="sd-note-counts">{Object.entries(kinds).map(([kind, { plural }]) => <span key={kind}><strong>{moments.filter(m => m.kind === kind).length}</strong> {plural}</span>)}</div><p className="sd-note-foot">Every experience adds a little more to your story.</p></div>
    </header>

    <section className="sd-narrative" aria-labelledby="sd-narrative-title" aria-busy={loading}>
      <div className="sd-narrative__heading"><span className="sd-narrative__icon"><Wand2 size={19} /></span><div><p className="sd-eyebrow">Connect the dots</p><h2 id="sd-narrative-title">{summary?.available ? 'Your journey, in words.' : 'There is a story in your experiences.'}</h2></div></div>
      {summary?.available ? <><p className="sd-narrative__text">{summary.summary}</p>{!!summary.highlights?.length && <ul>{summary.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>}<div className="sd-narrative__source"><span>{summary.generatedBy === 'ai' ? 'AI summary, based on your saved profile' : 'Composed directly from your saved profile'}</span><button onClick={copy} type="button">{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy summary'}</button></div></> : <p className="sd-narrative__hint">{summary?.note || 'Turn your saved projects, milestones, and interests into a short introduction in your own portfolio.'}</p>}
      <button className="sd-generate" type="button" disabled={loading || (!moments.length && !interests.length)} onClick={generate}><Sparkles size={15} />{loading ? (generating ? 'Connecting your story…' : 'Loading saved summary…') : summary?.available ? 'Regenerate summary' : 'Generate my summary'}{!loading && <ArrowRight size={15} />}</button>
      {summary?.stale && <p className="sd-narrative__hint" role="status">Your profile has changed since this summary was saved. Regenerate it to include your latest details.</p>}
      {notice && <p className="sd-narrative__hint" role="status">{notice}</p>}
      <p className="sd-ai-disclosure">Generating sends selected academic, project, experience, milestone, and interest details to an external AI service. Contact details and personal / family context are excluded. Review the wording before sharing. <Link to="/privacy">Privacy details</Link></p>
      {error && <p className="sd-error" role="alert">{error}</p>}
    </section>

    <div className="sd-content-heading"><div><p className="sd-eyebrow">The chapters</p><h2>What you have been up to.</h2></div><span>{filtered.length} {filtered.length === 1 ? 'moment' : 'moments'}</span></div>
    <div className="sd-filters" role="group" aria-label="Filter your story">{[['all', 'All moments'], ...Object.entries(kinds).map(([key, value]) => [key, value.plural])].map(([key, label]) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<span>{key === 'all' ? moments.length : moments.filter(m => m.kind === key).length}</span></button>)}</div>
    <div className="sd-chapters" aria-live="polite">
      {years.map(year => <section className="sd-chapter" key={year || 'undated'} aria-label={year ? `Moments from ${year}` : 'Undated moments'}><div className="sd-chapter__year"><h3>{year || 'Undated'}</h3><span>{filtered.filter(m => m.year === year).length} moments</span><div /></div><div className="sd-chapter__cards">{filtered.filter(m => m.year === year).map(moment => <MomentCard moment={moment} key={moment.id} />)}</div></section>)}
      {!filtered.length && <div className="sd-empty"><FolderGit2 size={30} /><h3>{moments.length ? 'This chapter is still unwritten.' : 'Your first chapter starts with one moment.'}</h3><p>Add a {filter === 'experience' ? 'work experience' : filter === 'milestone' ? 'milestone' : 'project, experience, or milestone'} to your profile and it will appear here.</p><Link to="/profile/edit">Update profile <ArrowRight size={16} /></Link></div>}
    </div>
    {!!interests.length && <aside className="sd-interests"><span className="sd-eyebrow">The threads running through it all</span><h2>What keeps you curious.</h2><div>{interests.slice(0, 12).map(interest => <span key={interest}>{interest}</span>)}</div></aside>}
    <footer className="sd-end"><span /><Sparkles size={17} /><p>Still becoming. Still building.</p><Link to="/profile">View your full profile <ArrowUpRight size={14} /></Link></footer>
  </div>;
}
