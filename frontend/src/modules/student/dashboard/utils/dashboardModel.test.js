import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardModel } from './dashboardModel.js';
import { profileCompleteness } from '../../profile/utils/profileCompleteness.js';

const completeStudent = () => ({
  id: 'test-student',
  personal: { fullName: 'Test Student', dateOfBirth: '2004-01-01', phone: '9000000000' },
  academic: { rollNumber: 'TEST01', department: 'Computer Science', batchYear: '2023 - 2027', tenthPercentage: 90, twelfthPercentage: 88, activeBacklogs: 0 },
  interests: { hobbies: ['Chess'], passions: [{ name: 'Research' }] },
  social: { linkedin: 'https://www.linkedin.com/in/test' },
  projects: [], internships: [], achievements: []
});

test('a complete profile still recommends meaningful work outside the percentage', () => {
  const model = dashboardModel(completeStudent(), [], []);
  assert.equal(model.percentage, 100);
  assert.equal(model.missing.length, 0);
  assert.equal(model.recommendation.path, '/profile/edit#projects');
  assert.equal(profileCompleteness(completeStudent()), model.percentage);
});

test('zero backlogs and zero scores are saved values, while blank scores are missing', () => {
  const student = completeStudent();
  student.academic.tenthPercentage = 0;
  assert.equal(dashboardModel(student).percentage, 100);
  student.academic.tenthPercentage = '';
  const model = dashboardModel(student);
  assert.equal(model.percentage, 92);
  assert.equal(model.recommendation.path, '/profile/edit#schooling');
});

test('optional fields remain labelled optional and are suggested after missing core details', () => {
  const student = completeStudent();
  student.personal.phone = '';
  student.academic.department = '';
  const model = dashboardModel(student);
  assert.equal(model.recommendation.path, '/profile/edit#eligibility');
  assert.equal(model.checklist.find(item => item.id === 'phone').optional, true);
  student.academic.department = 'Computer Science';
  assert.match(dashboardModel(student).recommendation.description, /optional/);
});

test('unavailable resume data stays unknown; an empty successful result can prompt creation', () => {
  const student = completeStudent();
  student.projects = [{ id: 'project' }];
  const unknown = dashboardModel(student, null, null);
  assert.equal(unknown.counts.resumes, null);
  assert.notEqual(unknown.recommendation.kind, 'resume');
  assert.equal(dashboardModel(student, [], []).recommendation.kind, 'resume');
  assert.equal(dashboardModel(student, [{ id: 'resume' }], []).recommendation.kind, 'placement');
});

test('application updates take priority without claiming eligibility', () => {
  const model = dashboardModel({}, [], [{ id: 'app', status: 'interview' }, { id: 'app2', status: 'shortlisted' }]);
  assert.equal(model.recommendation.path, '/placement');
  assert.equal(model.interviews, 1);
  assert.equal(model.shortlisted, 1);
});

test('undated and invalid historical entries count towards the record but never receive invented dates', () => {
  const model = dashboardModel({ createdAt: 'invalid', achievements: [{ title: 'Old milestone' }], projects: [{ projectName: 'Old project', createdAt: 'bad-date' }] });
  assert.equal(model.counts.achievements, 1);
  assert.equal(model.counts.projects, 1);
  assert.deepEqual(model.updates, []);
});

test('saved record, resume and application updates are sorted by real timestamps', () => {
  const student = {
    createdAt: '2026-01-01T00:00:00Z',
    onboarding: { completedAt: '2026-01-01T01:00:00Z' },
    projects: [{ id: 'p', projectName: 'Campus app', createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z' }],
    achievements: [{ id: 'a', title: 'Hackathon', createdAt: '2026-04-01T00:00:00Z' }]
  };
  const model = dashboardModel(student, [{ id: 'r', filename: 'Resume.pdf', uploadedAt: '2026-05-01T00:00:00Z' }], [{ id: 'app', job: { title: 'Intern' }, timeline: [{ label: 'Application submitted', at: '2026-06-01T00:00:00Z' }] }]);
  assert.match(model.updates[0].text, /Application submitted/);
  assert.match(model.updates[1].text, /Resume added/);
  assert.match(model.updates[2].text, /Milestone added/);
  assert.match(model.updates[3].text, /Project updated/);
  assert.equal(model.updates.length, 6);
  assert.equal(student.projects[0].createdAt, '2026-02-01T00:00:00Z');
});

test('sparse legacy profiles render a usable model without fake activity', () => {
  const model = dashboardModel(null);
  assert.equal(model.percentage, 0);
  assert.equal(model.recommendation.path, '/profile/edit#personal');
  assert.equal(model.counts.resumes, null);
  assert.deepEqual(model.updates, []);
  assert.ok(model.actions.every(action => action.path.startsWith('/')));
});
