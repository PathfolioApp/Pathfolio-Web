export function profileCompleteness(student) {
  if (!student) return 0;
  const score = [
    student.personal?.fullName,
    student.personal?.dateOfBirth,
    student.personal?.phone,
    student.academic?.rollNumber,
    student.academic?.department,
    student.academic?.batchYear,
    student.academic?.degreeProgram,
    student.academic?.graduationYear,
    student.academic?.currentSemester,
    student.academic?.cgpa !== undefined && student.academic?.cgpa !== '',
    student.academic?.tenthPercentage !== undefined && student.academic?.tenthPercentage !== '',
    student.academic?.twelfthPercentage !== undefined && student.academic?.twelfthPercentage !== '',
    student.academic?.activeBacklogs !== undefined && student.academic?.activeBacklogs !== '',
    student.academic?.historicalBacklogs !== undefined && student.academic?.historicalBacklogs !== '',
    student.academic?.gapYears !== undefined && student.academic?.gapYears !== '',
    student.interests?.hobbies?.length,
    student.interests?.passions?.length,
    student.achievements?.length,
    student.internships?.length,
    Boolean(student.social?.linkedin && String(student.social.linkedin).trim()),
  ].filter(Boolean).length;
  return Math.round((score / 20) * 100);
}
