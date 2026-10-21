// Shared checklist: dashboard recommendations and profile percentage use the same fields.
const isFilled = value => value !== undefined && value !== null && String(value).trim() !== '';
const isNumeric = value => isFilled(value) && Number.isFinite(Number(value));

export function profileChecklist(student) {
  const personal = student?.personal || {};
  const academic = student?.academic || {};
  const interests = student?.interests || {};
  return [
    { id: 'name', label: 'Full name', complete: isFilled(personal.fullName), path: '/profile/edit#personal' },
    { id: 'dob', label: 'Date of birth', complete: isFilled(personal.dateOfBirth), path: '/profile/edit#personal' },
    { id: 'phone', label: 'Phone number', complete: isFilled(personal.phone), path: '/profile/edit#personal', optional: true },
    { id: 'roll', label: 'Institutional roll number', complete: isFilled(academic.rollNumber), path: '/profile' },
    { id: 'department', label: 'Department', complete: isFilled(academic.department), path: '/profile/edit#eligibility' },
    { id: 'batch', label: 'Batch', complete: isFilled(academic.batchYear), path: '/profile/edit#eligibility' },
    { id: 'tenth', label: 'Class 10 score', complete: isNumeric(academic.tenthPercentage), path: '/profile/edit#schooling' },
    { id: 'twelfth', label: 'Class 12 score', complete: isNumeric(academic.twelfthPercentage), path: '/profile/edit#schooling' },
    { id: 'backlogs', label: 'Active backlogs', complete: isNumeric(academic.activeBacklogs), path: '/profile/edit#eligibility' },
    { id: 'hobbies', label: 'Hobbies', complete: interests.hobbies?.length > 0, path: '/profile/edit#interests' },
    { id: 'passions', label: 'Interests & passions', complete: interests.passions?.length > 0, path: '/profile/edit#interests' },
    { id: 'linkedin', label: 'LinkedIn profile', complete: isFilled(student?.social?.linkedin), path: '/profile/edit#social', optional: true }
  ];
}

export function profileCompleteness(student) {
  if (!student) return 0;
  const checks = profileChecklist(student);
  return Math.round(checks.filter(item => item.complete).length / checks.length * 100);
}
