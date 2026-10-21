import { profileChecklist, profileCompleteness } from '../../profile/utils/profileCompleteness.js';

const list = value => Array.isArray(value) ? value : [];
const validDate = value => typeof value === 'string' && value.trim() && Number.isFinite(Date.parse(value));
const statusLabel = { applied: 'Applied', shortlisted: 'Shortlisted', interview: 'Interview', selected: 'Selected', rejected: 'Not selected', withdrawn: 'Withdrawn' };
export const applicationStatusLabel = value => statusLabel[value] || 'Status updated';

export function dashboardModel(student, resumes = null, applications = null) {
  const checklist = profileChecklist(student);
  const percentage = profileCompleteness(student);
  const projects = list(student?.projects);
  const internships = list(student?.internships);
  const achievements = list(student?.achievements);
  const missing = checklist.filter(item => !item.complete);
  const counts = { projects: projects.length, internships: internships.length, achievements: achievements.length, resumes: resumes === null ? null : resumes.length };
  const interviews = list(applications).filter(item => item.status === 'interview').length;
  const shortlisted = list(applications).filter(item => item.status === 'shortlisted').length;
  const actions = [];
  if (interviews || shortlisted) actions.push({ title: 'Check your application updates', description: `${interviews ? `${interviews} in interview` : ''}${interviews && shortlisted ? ' · ' : ''}${shortlisted ? `${shortlisted} shortlisted` : ''}. Review the latest details from your placement team.`, label: 'View applications', path: '/placement', kind: 'placement' });
  if (missing.length) {
    const next = missing.find(item => !item.optional) || missing[0];
    actions.push({ title: next.id === 'roll' ? 'Review your institutional details' : next.id === 'backlogs' ? 'Confirm your backlog count' : `Add your ${next.label.toLowerCase()}`, description: next.optional ? 'Add this optional detail if you would like to include it in your profile.' : 'Keep your saved details accurate and up to date. Add only information you can confirm.', label: next.id === 'roll' ? 'View profile' : 'Update profile', path: next.path, kind: 'profile' });
  }
  if (!projects.length) actions.push({ title: 'Bring your first project into your story', description: 'A class assignment, personal build, or team project can show what you have learned.', label: 'Add a project', path: '/profile/edit#projects', kind: 'project' });
  if (resumes !== null && !resumes.length) actions.push({ title: 'Put your experience on a resume', description: 'Create or upload a resume so it is ready when an opportunity comes along.', label: 'Open resumes', path: '/resume', kind: 'resume' });
  actions.push({ title: 'Explore placement opportunities', description: 'Browse roles shared by your placement team and check the requirements for each opportunity.', label: 'Open placements', path: '/placement', kind: 'placement' });
  actions.push({ title: 'See your story take shape', description: 'Look back at the experiences and interests that make your record yours.', label: 'View your story', path: '/story', kind: 'story' });

  const updates = [];
  const add = (id, text, date, path) => {
    // Older entries may have no timestamp. Never invent a date for them.
    if (validDate(date)) updates.push({ id, text, date, path });
  };
  add('account', 'Account created', student?.createdAt, '/profile');
  add('onboarding', 'Onboarding completed', student?.onboarding?.completedAt, '/profile');
  for (const [type, items, field, path] of [
    ['Project', projects, 'projectName', '/profile/edit#projects'],
    ['Experience', internships, 'companyName', '/profile/edit#internships'],
    ['Milestone', achievements, 'title', '/profile/edit#achievements']
  ]) {
    items.forEach((item, index) => {
      const updated = validDate(item.updatedAt) && (!validDate(item.createdAt) || Date.parse(item.updatedAt) > Date.parse(item.createdAt));
      add(`${type}-${item.id || index}`, `${type} ${updated ? 'updated' : 'added'}${item[field] ? `: ${item[field]}` : ''}`, updated ? item.updatedAt : item.createdAt, path);
    });
  }
  list(resumes).forEach((resume, index) => {
    const updated = validDate(resume.updatedAt) && (!validDate(resume.uploadedAt) || Date.parse(resume.updatedAt) > Date.parse(resume.uploadedAt));
    add(`resume-${resume.id || index}`, `Resume ${updated ? 'updated' : 'added'}${resume.filename ? `: ${resume.filename}` : ''}`, updated ? resume.updatedAt : resume.uploadedAt, '/resume');
  });
  list(applications).forEach((application, index) => {
    const events = list(application.timeline);
    if (events.length) events.forEach((event, eventIndex) => {
      add(`application-${application.id || index}-${eventIndex}`, `${event.label || applicationStatusLabel(event.status)}${application.job?.title ? ` · ${application.job.title}` : ''}`, event.at, '/placement');
    });
    else add(`application-${application.id || index}`, 'Application submitted', application.appliedAt, '/placement');
  });
  updates.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return { checklist, percentage, missing, counts, interviews, shortlisted, recommendation: actions[0], actions: actions.filter((action, index) => index > 0 && action.path !== actions[0].path).slice(0, 3), updates: updates.slice(0, 6) };
}
