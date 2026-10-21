export const applicationLabels = { applied: 'Applied', shortlisted: 'Shortlisted', interview: 'Interview', selected: 'Selected', rejected: 'Not selected' };

export function compensationLabel(job) {
  const currency = job.salaryCurrency || 'INR';
  const format = value => {
    const number = Number(value);
    const amount = currency === 'INR' && number >= 100000
      ? (number / 100000).toLocaleString('en-IN', { maximumFractionDigits: 1 }) + 'L'
      : number.toLocaleString('en-IN');
    return (currency === 'INR' ? '₹' : currency + ' ') + amount;
  };
  const values = [job.salaryMin, job.salaryMax].filter(value => value != null && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) > 0);
  return values.map(format).join(' – ');
}

export const applicationMessages = {
  applied: { title: 'Your application is on its way.', description: 'Your submission is saved. You can check back here for updates from the placement team.' },
  shortlisted: { title: 'You’re on the shortlist.', description: 'Your application has been shortlisted. Watch your registered email and notifications for any next steps.' },
  interview: { title: 'You’re at the interview stage.', description: 'Your application has moved to interview. Check your email and notifications for any instructions or confirmed arrangements.' },
  selected: { title: 'A new chapter is taking shape.', description: 'You have been marked as selected for this role. Check with your placement team for offer details and next steps.' },
  rejected: { title: 'This application has concluded.', description: 'You were not selected for this role. Explore other opportunities when you’re ready for your next move.' }
};

export function applicationUpdates(application) {
  if (application.timeline?.length) return application.timeline;
  const submitted = application.appliedAt || application.createdAt;
  return [
    ...(submitted ? [{ label: 'Application submitted', at: submitted }] : []),
    ...(application.updatedAt && application.updatedAt !== submitted ? [{ label: `Latest status: ${applicationLabels[application.status] || application.status}`, at: application.updatedAt }] : [])
  ];
}

export function filterApplications(applications, { query = '', status = '', sort = 'applied' } = {}) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const timestamp = value => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
  return applications.filter(app => (!status || app.status === status) && words.every(word => [app.job?.title, app.job?.companyName].join(' ').toLowerCase().includes(word)))
    .sort((a, b) => sort === 'updated'
      ? timestamp(b.updatedAt || b.appliedAt) - timestamp(a.updatedAt || a.appliedAt)
      : timestamp(b.appliedAt) - timestamp(a.appliedAt));
}

export function isClosed(job, now = Date.now()) {
  return Boolean(job.deadlinePassed || job.status === 'closed' || (job.applicationDeadline && new Date(job.applicationDeadline).getTime() <= now));
}

export function academicComparisons(student = {}, criteria = {}) {
  const academic = student.academic || {};
  const number = value => value == null || String(value).trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value);
  const numeric = [
    ['cgpa', 'CGPA', 'minCgpa', false, ''],
    ['tenthPercentage', 'Class 10 score', 'minTenthPercentage', false, '%'],
    ['twelfthPercentage', 'Class 12 / diploma score', 'minTwelfthPercentage', false, '%'],
    ['activeBacklogs', 'Active backlogs', 'maxActiveBacklogs', true, ''],
    ['historicalBacklogs', 'Historical backlogs', 'maxHistoricalBacklogs', true, ''],
    ['gapYears', 'Gap years', 'maxGapYears', true, '']
  ].map(([field, label, limit, maximum, suffix]) => {
    const value = number(academic[field]);
    const required = criteria[limit] != null;
    return { id: field, label, requirement: required ? `${maximum ? 'Maximum' : 'Minimum'} ${criteria[limit]}${suffix}` : 'No restriction',
      actual: value === null ? 'Not recorded' : `${value}${suffix}`,
      state: !required ? 'unrestricted' : value === null ? 'missing' : (maximum ? value <= criteria[limit] : value >= criteria[limit]) ? 'met' : 'unmet' };
  });
  const department = String(academic.department || '').trim();
  const batch = String(academic.batchYear || '').trim();
  const departments = criteria.allowedDepartments || [];
  const batches = criteria.allowedBatches || [];
  return [...numeric,
    { id: 'department', label: 'Department', requirement: departments.length ? departments.join(', ') : 'All departments', actual: department || 'Not recorded',
      state: !departments.length ? 'unrestricted' : !department ? 'missing' : departments.some(value => department.toLowerCase().includes(value.toLowerCase()) || value.toLowerCase().includes(department.toLowerCase())) ? 'met' : 'unmet' },
    { id: 'batchYear', label: 'Graduating batch', requirement: batches.length ? batches.join(', ') : 'All batches', actual: batch || 'Not recorded',
      state: !batches.length ? 'unrestricted' : !batch ? 'missing' : batches.some(value => batch.includes(value)) ? 'met' : 'unmet' }
  ];
}

export function opportunityState(job, student = {}, now = Date.now()) {
  if (job.hasApplied || job.application) {
    const status = job.application?.status || 'applied';
    return { key: 'applied', label: applicationLabels[status] || status, tone: status };
  }
  if (isClosed(job, now)) return { key: 'closed', label: 'Closed', tone: 'warning' };
  const criteria = job.eligibility || {};
  const academic = student.academic || {};
  const absent = value => value === null || value === undefined || String(value).trim() === '';
  const missing = [['minCgpa', 'cgpa'], ['minTenthPercentage', 'tenthPercentage'], ['minTwelfthPercentage', 'twelfthPercentage'], ['maxActiveBacklogs', 'activeBacklogs'], ['maxHistoricalBacklogs', 'historicalBacklogs'], ['maxGapYears', 'gapYears']]
    .some(([limit, field]) => criteria[limit] != null && absent(academic[field]))
    || (criteria.allowedDepartments?.length && absent(academic.department))
    || (criteria.allowedBatches?.length && absent(academic.batchYear));
  if (missing) return { key: 'missing', label: 'Profile details missing', tone: 'warning' };
  if (criteria.meetsAll === false || criteria.issues?.length) return { key: 'ineligible', label: 'Doesn’t meet criteria', tone: 'warning' };
  return { key: 'eligible', label: 'Eligible', tone: 'eligible' };
}

export function filterOpportunities(jobs, { query = '', status = '', mode = '', role = '', sort = 'newest' } = {}, student, now = Date.now()) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return jobs.filter(job => {
    const text = [job.title, job.companyName, job.location, ...(job.requiredSkills || [])].join(' ').toLowerCase();
    return words.every(word => text.includes(word)) && (!status || opportunityState(job, student, now).key === status)
      && (!mode || job.workMode === mode) && (!role || job.employmentType === role);
  }).sort((a, b) => {
    const date = (value, fallback) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : fallback;
    return sort === 'deadline'
      ? date(a.applicationDeadline, Infinity) - date(b.applicationDeadline, Infinity)
      : date(b.createdAt, 0) - date(a.createdAt, 0);
  });
}
