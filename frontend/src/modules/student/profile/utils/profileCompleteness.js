// Profile completeness over the fields the product actually collects in
// onboarding and profile edit. Previously this counted seven academic fields
// no form ever writes (degreeProgram, graduationYear, currentSemester,
// historicalBacklogs, gapYears, ...), so even a fully filled profile capped
// out around 59-65% and the number read as broken.
// Numeric fields (backlogs, percentages) count as complete when present,
// including explicit 0.
const isFilled = value => value !== undefined && value !== null && String(value).trim() !== '';
const isNumeric = value => isFilled(value) && Number.isFinite(Number(value));

export function profileCompleteness(student) {
  if (!student) return 0;
  const checks = [
    isFilled(student.personal?.fullName),
    isFilled(student.personal?.dateOfBirth),
    isFilled(student.personal?.phone),
    isFilled(student.academic?.rollNumber),
    isFilled(student.academic?.department),
    isFilled(student.academic?.batchYear),
    isNumeric(student.academic?.tenthPercentage),
    isNumeric(student.academic?.twelfthPercentage),
    isNumeric(student.academic?.activeBacklogs),
    student.interests?.hobbies?.length > 0,
    student.interests?.passions?.length > 0,
    Boolean(student.social?.linkedin && String(student.social.linkedin).trim())
  ];
  const score = checks.filter(Boolean).length;
  return Math.round((score / checks.length) * 100);
}
