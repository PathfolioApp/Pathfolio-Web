import React, { useEffect, useState } from 'react';
import { Award, BriefcaseBusiness, Compass, ExternalLink, FolderGit2, GraduationCap, Linkedin, Github, Globe, Sparkles, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import './PublicProfilePage.css';

async function fetchProfile(token) {
  const response = await fetch(`/api/public-profile/p/${token}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'This profile is not available.');
  return data;
}

const initials = name => String(name || 'S').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();

/**
 * Public (LinkedIn-style) student profile - rendered for ANY visitor with the
 * share link, no sign-in required. Shows only the whitelisted public
 * projection served by /api/public-profile/p/:token.
 */
export function PublicProfilePage() {
  const token = window.location.pathname.split('/p/')[1] || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile(token)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <main className="pf-public-profile"><p className="pf-public-profile__loading">Loading profile…</p></main>;
  }

  if (error) {
    return (
      <main className="pf-public-profile">
        <div className="pf-public-profile__empty">
          <X size={28} />
          <h1>Profile unavailable</h1>
          <p>{error}</p>
          <Link to="/">Go to Pathfolio</Link>
        </div>
      </main>
    );
  }

  const profile = data.profile || {};
  const sections = [
    profile.bio ? { title: 'About', body: <p>{profile.bio}</p> } : null,
    profile.internships?.length ? {
      title: 'Experience', icon: BriefcaseBusiness, body: profile.internships.map((item, index) => (
        <article className="pf-public-profile__entry" key={index}>
          <h3>{item.role || 'Intern'}</h3>
          <p className="pf-public-profile__entry-meta">{item.companyName}{item.location ? ` · ${item.location}` : ''}{item.workMode ? ` · ${item.workMode}` : ''}</p>
          {item.description && <p>{item.description}</p>}
          {item.skills?.length > 0 && <div className="pf-public-profile__chips">{item.skills.map((skill, i) => <span key={i}>{skill}</span>)}</div>}
        </article>
      ))
    } : null,
    profile.projects?.length ? {
      title: 'Projects', icon: FolderGit2, body: profile.projects.map((item, index) => (
        <article className="pf-public-profile__entry" key={index}>
          <h3>
            {item.projectName || 'Project'}
            {item.projectUrl && <a href={item.projectUrl} target="_blank" rel="noreferrer"><ExternalLink size={13} /></a>}
            {item.repoUrl && <a href={item.repoUrl} target="_blank" rel="noreferrer"><Github size={13} /></a>}
          </h3>
          {item.projectType && <p className="pf-public-profile__entry-meta">{item.projectType}</p>}
          {item.description && <p>{item.description}</p>}
          {item.technologies?.length > 0 && <div className="pf-public-profile__chips">{item.technologies.map((tech, i) => <span key={i}>{tech}</span>)}</div>}
        </article>
      ))
    } : null,
    profile.achievements?.length ? {
      title: 'Achievements', icon: Award, body: profile.achievements.map((item, index) => (
        <article className="pf-public-profile__entry" key={index}>
          <h3>{item.title}</h3>
          <p className="pf-public-profile__entry-meta">{item.category || 'Achievement'}{item.year ? ` · ${item.year}` : ''}</p>
          {item.description && <p>{item.description}</p>}
        </article>
      ))
    } : null
  ].filter(Boolean);

  return (
    <main className="pf-public-profile">
      <header className="pf-public-profile__hero">
        <div className="pf-public-profile__identity">
          {profile.avatarUrl
            ? <img src={profile.avatarUrl} alt="" className="pf-public-profile__avatar" />
            : <span className="pf-public-profile__avatar pf-public-profile__avatar--fallback">{initials(profile.fullName)}</span>}
          <div>
            <h1>{profile.fullName || 'Student'}</h1>
            <p className="pf-public-profile__headline">{profile.headline || 'Student'}</p>
            <p className="pf-public-profile__meta">
              {[profile.department, profile.batchYear ? `Class of ${profile.batchYear}` : '', profile.cgpa ? `CGPA ${profile.cgpa}` : ''].filter(Boolean).join(' · ')}
            </p>
            <div className="pf-public-profile__links">
              {profile.social?.linkedin && <a href={profile.social.linkedin} target="_blank" rel="noreferrer"><Linkedin size={15} /> LinkedIn</a>}
              {profile.social?.github && <a href={profile.social.github} target="_blank" rel="noreferrer"><Github size={15} /> GitHub</a>}
              {profile.social?.portfolio && <a href={profile.social.portfolio} target="_blank" rel="noreferrer"><Globe size={15} /> Portfolio</a>}
            </div>
          </div>
        </div>
        {(profile.passions?.length > 0 || profile.hobbies?.length > 0) && (
          <div className="pf-public-profile__skills">
            <p><Sparkles size={13} /> Interests</p>
            <div className="pf-public-profile__chips">
              {[...(profile.passions || []), ...(profile.hobbies || [])].slice(0, 12).map((skill, index) => <span key={index}>{skill}</span>)}
            </div>
          </div>
        )}
      </header>

      {data.resume && (
        <div className="pf-public-profile__resume">
          <GraduationCap size={15} />
          <span>Featured resume: <b>{data.resume.filename}</b> ({data.resume.category})</span>
        </div>
      )}

      {sections.length ? sections.map(section => (
        <section className="pf-public-profile__section" key={section.title}>
          <h2>{section.icon && <section.icon size={15} />}{section.title}</h2>
          {section.body}
        </section>
      )) : (
        <div className="pf-public-profile__empty">
          <Compass size={26} />
          <h2>Nothing shared yet</h2>
          <p>This profile is live, but no experience, projects, or achievements have been made public.</p>
        </div>
      )}

      <footer className="pf-public-profile__footer">
        Powered by <Link to="/">Pathfolio</Link> - the student career portfolio platform.
      </footer>
    </main>
  );
}
