const studentStore = require('../models/studentStore');

const stopWords = new Set(['and', 'the', 'for', 'with', 'from', 'that', 'this', 'are', 'you', 'your', 'our', 'job', 'role', 'work', 'will', 'have', 'has', 'into', 'about', 'years', 'using']);
const terms = value => [...new Set(String(value || '').toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g)?.filter(term => !stopWords.has(term)) || [])].slice(0, 40);
const textFrom = student => JSON.stringify({ personal: { fullName: student.personal.fullName }, academic: student.academic, interests: student.interests, achievements: student.achievements }).toLowerCase();

class RecruiterService {
  async search({ keywords = '', jobDescription = '', limit = 50 } = {}) {
    const requestedTerms = terms(`${keywords} ${jobDescription}`);
    const students = await studentStore.listStudents();
    return students
      .filter(student => !student.isAdmin && student.status !== 'suspended' && student.onboarding?.completed !== false)
      .map(student => {
        const searchable = textFrom(student);
        const matchedTerms = requestedTerms.filter(term => searchable.includes(term));
        const score = requestedTerms.length ? Math.round((matchedTerms.length / requestedTerms.length) * 100) : 0;
        return { score, matchedTerms, student };
      })
      .filter(result => !requestedTerms.length || result.matchedTerms.length)
      .sort((left, right) => right.score - left.score || left.student.personal.fullName.localeCompare(right.student.personal.fullName))
      .slice(0, Math.min(Math.max(Number(limit) || 50, 1), 100))
      .map(({ score, matchedTerms, student }) => ({
        score,
        matchedTerms,
        id: student.id,
        name: student.personal.fullName,
        email: student.profileSettings?.visibility === 'public' ? student.personal.email : null,
        academic: student.academic,
        interests: student.interests,
        achievements: student.achievements,
        profileVisibility: student.profileSettings?.visibility || 'private'
      }));
  }
}

module.exports = new RecruiterService();