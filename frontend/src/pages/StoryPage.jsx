import React from 'react';
import { Award, Compass, GraduationCap, Sparkles, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './StoryPage.css';

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(new Date(value));
}

function buildStory(student) {
  const events = [];
  if (student.createdAt) events.push({ date: student.createdAt, label: 'Record started', title: 'Your Pathfolio began', description: 'You created a place to keep your academic journey together.', icon: UserRound });
  if (student.onboarding?.completedAt) events.push({ date: student.onboarding.completedAt, label: 'Foundation', title: 'Onboarding completed', description: 'Your academic identity and first interests are now part of your record.', icon: GraduationCap });
  (student.achievements || []).forEach(achievement => events.push({ date: achievement.year ? `${achievement.year}-12-31` : null, year: achievement.year, label: achievement.category || 'Achievement', title: achievement.title, description: achievement.description || 'A milestone you chose to add to your record.', icon: Award }));
  return events.sort((a, b) => (b.year || new Date(b.date || 0).getTime()) - (a.year || new Date(a.date || 0).getTime()));
}

export function StoryPage() {
  const { student } = useAuth();
  const events = buildStory(student);
  const interests = [...(student.interests?.passions || []), ...(student.interests?.hobbies || [])];
  const name = student.personal?.fullName || 'Your story';

  return <div className="pf-story-page"><header className="pf-story-header"><div><span className="editorial-eyebrow">Your journey</span><h1>{name.split(' ')[0]}'s Story</h1><p>A living narrative built from the moments, interests, and milestones you have chosen to record.</p></div><div className="pf-story-summary"><strong>{events.length}</strong><span>recorded moments</span></div></header><section className="pf-story-intro"><div className="pf-story-intro__icon"><Sparkles size={20} /></div><div><h2>What is shaping you now?</h2><p>{interests.length ? interests.join(' · ') : 'Add interests and passions to give your story its first direction.'}</p></div></section>{events.length ? <section className="pf-story-timeline" aria-label="Your chronological story">{events.map((event, index) => { const Icon = event.icon; return <article className="pf-story-event" key={`${event.title}-${index}`}><div className="pf-story-event__rail"><span><Icon size={17} /></span></div><div className="pf-story-event__body"><div className="pf-story-event__meta"><span>{event.label}</span><time>{event.year || formatDate(event.date)}</time></div><h2>{event.title}</h2><p>{event.description}</p></div></article>; })}</section> : <section className="pf-story-empty"><Compass size={26} /><h2>Your story is ready for its first chapter.</h2><p>Add an achievement or an interest to begin shaping a narrative that reflects where you have been and where you are going.</p></section>}</div>;
}
