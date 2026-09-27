export const recruiterApi = {
  searchStudents: async ({ keywords = '', jobDescription = '' } = {}) => {
    const params = new URLSearchParams();
    if (keywords.trim()) params.set('keywords', keywords.trim());
    if (jobDescription.trim()) params.set('jobDescription', jobDescription.trim());
    const response = await fetch(`/api/recruiter/students?${params.toString()}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.message || 'Unable to search student profiles.');
    return data.students;
  }
};