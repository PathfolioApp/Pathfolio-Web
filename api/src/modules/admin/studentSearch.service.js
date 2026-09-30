const studentStore = require('../students/studentStore');

const clean = value => String(value || '').trim();/**
 * Admin-only student discovery over structured profile data. Results are a
 * compact projection suited to selection UIs rather than full record dumps.
 */
class StudentSearchService {
  parseList(value) {
    return clean(value) ? clean(value).split(',').map(item => item.trim()).filter(Boolean) : [];
  }

  textOfInterest(item) {
    if (typeof item === 'string') return item.toLowerCase();
    return [item?.name, item?.proficiency, item?.reason].filter(Boolean).join(' ').toLowerCase();
  }

  matchesStudent(student, filters) {
    if (student.isAdmin) return false;

    if (filters.search) {
      const haystack = [
        student.personal?.fullName,
        student.personal?.email,
        student.academic?.rollNumber,
        student.academic?.department,
        student.academic?.batchYear
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(filters.search)) return false;
    }
    if (filters.department && !(student.academic?.department || '').toLowerCase().includes(filters.department.toLowerCase())) return false;
    if (filters.batch && !String(student.academic?.batchYear || '').toLowerCase().includes(filters.batch.toLowerCase())) return false;
    if (filters.rollNumber && !(student.academic?.rollNumber || '').toLowerCase().includes(filters.rollNumber.toLowerCase())) return false;

    if (filters.status) {
      const status = student.status || 'active';
      if (status !== filters.status) return false;
    }
    if (filters.blocked === 'true' && !student.blocked) return false;
    if (filters.blocked === 'false' && student.blocked) return false;

    if (filters.minCgpa !== null) {
      const cgpa = Number(student.academic?.cgpa);
      if (!Number.isFinite(cgpa) || cgpa < filters.minCgpa) return false;
    }
    if (filters.maxBacklogs !== null) {
      const backlogs = Number(student.academic?.activeBacklogs || 0);
      if (!Number.isFinite(backlogs) || backlogs > filters.maxBacklogs) return false;
    }

    if (filters.skills.length) {
      const interestText = [...(student.interests?.hobbies || []), ...(student.interests?.passions || [])]
        .map(item => this.textOfInterest(item)).join(' ');
      const achievementText = (student.achievements || []).map(a => `${a.title} ${a.category} ${a.description}`.toLowerCase()).join(' ');
      const internshipText = (student.internships || []).map(i => `${i.companyName} ${i.role} ${(i.skills || []).join(' ')}`.toLowerCase()).join(' ');
      const projectText = (student.projects || []).map(p => `${p.projectName} ${p.projectType} ${p.description} ${(p.technologies || []).join(' ')}`.toLowerCase()).join(' ');
      const haystack = `${interestText} ${achievementText} ${internshipText} ${projectText}`;
      const hasAll = filters.skillMode === 'any'
        ? filters.skills.some(skill => haystack.includes(skill.toLowerCase()))
        : filters.skills.every(skill => haystack.includes(skill.toLowerCase()));
      if (!hasAll) return false;
    }

    if (filters.interests.length) {
      const interestText = [...(student.interests?.hobbies || []), ...(student.interests?.passions || [])]
        .map(item => this.textOfInterest(item)).join(' ');
      const hasAny = filters.interests.some(term => interestText.includes(term.toLowerCase()));
      if (!hasAny) return false;
    }

    return true;
  }

  async search(query = {}) {
    const filters = {
      search: clean(query.search || query.q).toLowerCase(),
      department: clean(query.department),
      batch: clean(query.batch),
      rollNumber: clean(query.rollNumber),
      status: clean(query.status),
      blocked: clean(query.blocked),
      minCgpa: query.minCgpa !== undefined && query.minCgpa !== '' && !Number.isNaN(Number(query.minCgpa)) ? Number(query.minCgpa) : null,
      maxBacklogs: query.maxBacklogs !== undefined && query.maxBacklogs !== '' && !Number.isNaN(Number(query.maxBacklogs)) ? Number(query.maxBacklogs) : null,
      skills: this.parseList(query.skills),
      interests: this.parseList(query.interests),
      skillMode: clean(query.skillMode) === 'any' ? 'any' : 'all'
    };

    const students = await studentStore.listStudents();
    const matched = students.filter(student => this.matchesStudent(student, filters));
    const total = matched.length;

    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const page = matched
      .sort((a, b) => String(a.personal?.fullName || '').localeCompare(String(b.personal?.fullName || '')))
      .slice(offset, offset + limit)
      .map(student => this.project(student));

    return {
      total,
      limit,
      offset,
      students: page
    };
  }

  /** Compact, selection-friendly projection (no auth data, no family context). */
  project(student) {
    return {
      id: student.id,
      fullName: student.personal?.fullName || '',
      email: student.personal?.email || '',
      avatarUrl: student.personal?.avatarUrl || '',
      rollNumber: student.academic?.rollNumber || '',
      department: student.academic?.department || '',
      batchYear: student.academic?.batchYear || '',
      cgpa: student.academic?.cgpa ?? null,
      activeBacklogs: student.academic?.activeBacklogs ?? null,
      skills: [
        ...(student.interests?.passions || []).map(item => (typeof item === 'string' ? item : item?.name)).filter(Boolean),
        ...(student.interests?.hobbies || []).map(item => (typeof item === 'string' ? item : item?.name)).filter(Boolean)
      ].slice(0, 10),
      achievementsCount: (student.achievements || []).length,
      internshipsCount: (student.internships || []).length,
      applicationsCount: student.applicationsCount || 0,
      blocked: Boolean(student.blocked),
      status: student.status || 'active',
      onboardingCompleted: student.onboarding?.completed !== false,
      createdAt: student.createdAt
    };
  }

  async getStudentDetail(id) {
    const student = await studentStore.getStudentById(id);
    if (!student) {
      const error = new Error('Student not found.'); error.statusCode = 404; throw error;
    }
    const applications = await require('./adminContentStore').listApplications();
    return {
      ...this.project(student),
      email: student.personal?.email || '',
      phone: student.personal?.phone || '',
      dateOfBirth: student.personal?.dateOfBirth || '',
      interests: student.interests || { hobbies: [], passions: [] },
      achievements: (student.achievements || []).map(item => ({ title: item.title, category: item.category, description: item.description, year: item.year })),
      internships: (student.internships || []).map(item => ({ companyName: item.companyName, role: item.role, startDate: item.startDate, endDate: item.endDate, currentlyWorking: item.currentlyWorking, location: item.location, skills: item.skills || [] })),
      applications: applications
        .filter(application => application.studentId === id)
        .map(application => ({ id: application.id, jobPostId: application.jobPostId, status: application.status, createdAt: application.createdAt }))
    };
  }
}

module.exports = new StudentSearchService();
