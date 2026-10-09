import React, { useState } from 'react';
import { Award, Compass, GraduationCap, Sparkles, Wand2, Copy, Check, X } from 'lucide-react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import './StoryPage.css';

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(new Date(value));
}

function buildStory(student) {
  const events = [];
  (student.achievements || []).forEach(achievement => events.push({ date: achievement.year ? `${achievement.year}-12-31` : null, year: achievement.year, label: achievement.category || 'Achievement', title: achievement.title, description: achievement.description || 'A milestone you chose to add to your record.', icon: Award }));
  (student.projects || []).forEach(project => events.push({ date: project.endDate || project.startDate, year: project.startDate ? String(project.startDate).slice(0, 4) : null, label: 'Project', title: project.projectName, description: project.description || '', icon: Compass }));
  (student.internships || []).forEach(internship => events.push({ date: internship.endDate || internship.startDate, year: internship.startDate ? String(internship.startDate).slice(0, 4) : null, label: 'Experience', title: `${internship.role} · ${internship.companyName}`, description: internship.description || '', icon: GraduationCap }));
  return events
    .filter(event => event.title)
    .sort((a, b) => (b.year || new Date(b.date || 0).getTime()) - (a.year || new Date(a.date || 0).getTime()));
}

import { apiUrl, apiHeaders } from '../../../app/services/apiClient.js';

async function request(path, options = {}) {
  const response = await fetch(apiUrl(`/api/story${path}`), { ...options, credentials: 'include', headers: apiHeaders({ 'Content-Type': 'application/json', ...(options.headers || {}) }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Unable to generate your summary right now.');
  return data;
}

/**
 * Student story page with AI life-summary: a narrative of what the student has
 * actually done (achievements, projects, experience) - deliberately free of
 * platform bookkeeping like "joined Pathfolio".
 */
export function StoryPage() {
  const { student } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const events = buildStory(student);
  const interests = [...(student.interests?.passions || []), ...(student.interests?.hobbies || [])];
  const name = student.personal?.fullName || 'Your story';

  const generate = async () => {
    setLoading(true); setError('');
    try {
      const data = await request('/me/summary', { method: 'POST' });
      setSummary(data.summary || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copySummary = async () => {
    if (!summary?.summary) return;
    const text = [summary.summary, '', ...(summary.highlights || []).map(h => `• ${h}`)].join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pf-story-page">
      <header className="pf-story-header">
        <div>
          <span className="editorial-eyebrow">Your journey</span>
          <h1>{name.split(' ')[0]}'s Story</h1>
          <p>A living narrative built from the moments, interests, and milestones you have chosen to record.</p>
        </div>
        <div className="pf-story-header__actions">
          <div className="pf-story-summary"><strong>{events.length}</strong><span>recorded moments</span></div>
          <Button variant="primary" size="sm" icon={Wand2} loading={loading} onClick={generate}>
            {summary ? 'Regenerate summary' : 'Generate summary'}
          </Button>
        </div>
      </header>

      {error && (
        <div className="pf-story-error" role="alert">
          <X size={14} /> {error}
        </div>
      )}

      {summary && (
        <section className="pf-story-ai-summary" aria-label="Your generated summary">
          <div className="pf-story-ai-summary__head">
            <span className="pf-story-ai-summary__badge"><Sparkles size={13} /> {summary.generatedBy === 'ai' ? 'AI summary' : 'Profile summary'}</span>
            <Button variant="ghost" size="sm" icon={copied ? Check : Copy} onClick={copySummary}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="pf-story-ai-summary__text">{summary.summary}</p>
          {summary.highlights?.length > 0 && (
            <ul className="pf-story-ai-summary__highlights">
              {summary.highlights.map((highlight, index) => <li key={index}>{highlight}</li>)}
            </ul>
          )}
          {summary.themes?.length > 0 && (
            <div className="pf-story-ai-summary__themes">
              {summary.themes.map((theme, index) => <span key={index}>{theme}</span>)}
            </div>
          )}
          {summary.note && <p className="pf-story-ai-summary__note">{summary.note}</p>}
        </section>
      )}

      <section className="pf-story-intro">
        <div className="pf-story-intro__icon"><Sparkles size={20} /></div>
        <div>
          <h2>What is shaping you now?</h2>
          <p>{interests.length ? interests.join(' · ') : 'Add interests and passions to give your story its first direction.'}</p>
        </div>
      </section>

      {events.length ? (
        <section className="pf-story-timeline" aria-label="Your chronological story">
          {events.map((event, index) => {
            const Icon = event.icon;
            return (
              <article className="pf-story-event" key={`${event.title}-${index}`}>
                <div className="pf-story-event__rail"><span><Icon size={17} /></span></div>
                <div className="pf-story-event__body">
                  <div className="pf-story-event__meta">
                    <span>{event.label}</span>
                    <time>{event.year || formatDate(event.date)}</time>
                  </div>
                  <h2>{event.title}</h2>
                  <p>{event.description}</p>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState
          icon={Compass}
          title="Your story is ready for its first chapter."
          text="Add an achievement, project, or internship to begin shaping a narrative that reflects where you have been and where you are going."
        />
      )}
    </div>
  );
}
