const studentStore = require('../students/studentStore');
const { GENERIC_TERMS, createMatcher } = require('../../shared/textMatch');

/**
 * Skill taxonomy. Each entry maps a canonical skill to the aliases that may
 * appear in a job description or a student record.
 */
const SKILLS = [
  // Frontend
  { name: 'JavaScript', domain: 'Frontend', aliases: ['javascript', 'js', 'ecmascript', 'es6'] },
  { name: 'TypeScript', domain: 'Frontend', aliases: ['typescript', 'ts'] },
  { name: 'React', domain: 'Frontend', aliases: ['react', 'reactjs', 'react.js', 'react native'] },
  { name: 'Next.js', domain: 'Frontend', aliases: ['next.js', 'nextjs'] },
  { name: 'Vue', domain: 'Frontend', aliases: ['vue', 'vuejs', 'vue.js', 'nuxt'] },
  { name: 'Angular', domain: 'Frontend', aliases: ['angular', 'angularjs'] },
  { name: 'HTML & CSS', domain: 'Frontend', aliases: ['html', 'css', 'sass', 'scss', 'less'] },
  { name: 'Tailwind CSS', domain: 'Frontend', aliases: ['tailwind', 'tailwindcss'] },
  { name: 'Redux', domain: 'Frontend', aliases: ['redux'] },
  { name: 'UI/UX Design', domain: 'Design', aliases: ['ui/ux', 'ui ux', 'ux design', 'ui design', 'user experience', 'user interface'] },
  { name: 'Figma', domain: 'Design', aliases: ['figma', 'sketch', 'adobe xd'] },
  { name: 'Product Design', domain: 'Design', aliases: ['product design', 'interaction design', 'design thinking'] },

  // Backend & languages
  { name: 'Node.js', domain: 'Backend', aliases: ['node', 'node.js', 'nodejs', 'express'] },
  { name: 'Python', domain: 'Backend', aliases: ['python', 'py'] },
  { name: 'Django', domain: 'Backend', aliases: ['django'] },
  { name: 'Flask', domain: 'Backend', aliases: ['flask'] },
  { name: 'Java', domain: 'Backend', aliases: ['java', 'core java', 'j2ee'] },
  { name: 'Spring Boot', domain: 'Backend', aliases: ['spring', 'spring boot', 'springboot'] },
  { name: 'C++', domain: 'Backend', aliases: ['c++', 'cpp'] },
  { name: 'C#', domain: 'Backend', aliases: ['c#', 'csharp', '.net', 'dotnet'] },
  { name: 'Go', domain: 'Backend', aliases: ['golang', 'go lang'] },
  { name: 'Rust', domain: 'Backend', aliases: ['rust'] },
  { name: 'PHP', domain: 'Backend', aliases: ['php', 'laravel'] },
  { name: 'Ruby', domain: 'Backend', aliases: ['ruby', 'ruby on rails', 'rails'] },
  { name: 'REST APIs', domain: 'Backend', aliases: ['rest api', 'restful', 'rest', 'api design', 'apis'] },
  { name: 'GraphQL', domain: 'Backend', aliases: ['graphql'] },
  { name: 'Microservices', domain: 'Backend', aliases: ['microservice', 'microservices'] },
  { name: 'Kotlin', domain: 'Mobile', aliases: ['kotlin'] },
  { name: 'Swift', domain: 'Mobile', aliases: ['swift', 'ios'] },
  { name: 'Flutter', domain: 'Mobile', aliases: ['flutter', 'dart'] },
  { name: 'Android', domain: 'Mobile', aliases: ['android', 'jetpack compose'] },

  // Data & AI
  { name: 'SQL', domain: 'Data', aliases: ['sql', 'mysql', 'postgres', 'postgresql', 'sqlite', 'oracle db', 'pl/sql'] },
  { name: 'NoSQL', domain: 'Data', aliases: ['mongodb', 'mongo', 'nosql', 'dynamodb', 'cassandra', 'redis'] },
  { name: 'Data Analysis', domain: 'Data', aliases: ['data analysis', 'data analytics', 'analytics', 'data analyst'] },
  { name: 'Data Science', domain: 'Data', aliases: ['data science', 'data scientist'] },
  { name: 'Machine Learning', domain: 'AI/ML', aliases: ['machine learning', 'ml', 'supervised learning', 'scikit', 'sklearn'] },
  { name: 'Deep Learning', domain: 'AI/ML', aliases: ['deep learning', 'neural network', 'neural networks'] },
  { name: 'TensorFlow', domain: 'AI/ML', aliases: ['tensorflow'] },
  { name: 'PyTorch', domain: 'AI/ML', aliases: ['pytorch', 'torch'] },
  { name: 'NLP', domain: 'AI/ML', aliases: ['nlp', 'natural language processing', 'llm', 'large language model'] },
  { name: 'Computer Vision', domain: 'AI/ML', aliases: ['computer vision', 'opencv', 'image processing'] },
  { name: 'Pandas & NumPy', domain: 'Data', aliases: ['pandas', 'numpy', 'matplotlib', 'seaborn'] },
  { name: 'Power BI / Tableau', domain: 'Data', aliases: ['power bi', 'powerbi', 'tableau', 'looker'] },
  { name: 'Excel', domain: 'Data', aliases: ['excel', 'spreadsheet', 'google sheets'] },
  { name: 'Statistics', domain: 'Data', aliases: ['statistics', 'statistical', 'probability'] },

  // Cloud / DevOps / Security
  { name: 'AWS', domain: 'Cloud', aliases: ['aws', 'amazon web services', 'ec2', 's3'] },
  { name: 'Azure', domain: 'Cloud', aliases: ['azure', 'microsoft cloud'] },
  { name: 'Google Cloud', domain: 'Cloud', aliases: ['gcp', 'google cloud'] },
  { name: 'Docker', domain: 'DevOps', aliases: ['docker', 'containerization', 'containers'] },
  { name: 'Kubernetes', domain: 'DevOps', aliases: ['kubernetes', 'k8s'] },
  { name: 'CI/CD', domain: 'DevOps', aliases: ['ci/cd', 'ci cd', 'jenkins', 'github actions', 'gitlab ci'] },
  { name: 'Linux', domain: 'DevOps', aliases: ['linux', 'unix', 'bash', 'shell scripting'] },
  { name: 'Git', domain: 'DevOps', aliases: ['git', 'github', 'gitlab', 'version control'] },
  { name: 'Cybersecurity', domain: 'Security', aliases: ['cybersecurity', 'information security', 'infosec', 'penetration testing', 'appsec'] },
  { name: 'Networking', domain: 'Security', aliases: ['networking', 'tcp/ip', 'ccna'] },
  { name: 'Testing / QA', domain: 'Quality', aliases: ['unit testing', 'jest', 'cypress', 'selenium', 'qa', 'quality assurance', 'test automation'] },

  // Domain / business
  { name: 'Product Management', domain: 'Product', aliases: ['product management', 'product manager', 'product owner', 'roadmap'] },
  { name: 'Project Management', domain: 'Product', aliases: ['project management', 'agile', 'scrum', 'kanban', 'jira'] },
  { name: 'Business Analysis', domain: 'Business', aliases: ['business analysis', 'business analyst', 'requirements gathering'] },
  { name: 'Marketing', domain: 'Business', aliases: ['marketing', 'seo', 'digital marketing', 'social media'] },
  { name: 'Finance', domain: 'Business', aliases: ['finance', 'financial', 'accounting', 'investment', 'quantitative finance'] },
  { name: 'Human Resources', domain: 'Business', aliases: ['human resources', 'recruitment', 'talent acquisition', 'hr'] },
  { name: 'Communication', domain: 'Soft Skills', aliases: ['communication', 'presentation', 'stakeholder'] },
  { name: 'Leadership', domain: 'Soft Skills', aliases: ['leadership', 'team lead', 'mentoring', 'collaboration', 'teamwork'] },
  { name: 'Problem Solving', domain: 'Soft Skills', aliases: ['problem solving', 'problem-solving', 'critical thinking', 'analytical skills'] },
  { name: 'Research', domain: 'Soft Skills', aliases: ['research', 'literature review', 'publication'] }
];

const DOMAIN_KEYWORDS = [
  ['Frontend', ['frontend', 'front-end', 'front end', 'web developer', 'web development', 'ui developer']],
  ['Backend', ['backend', 'back-end', 'back end', 'server side', 'server-side', 'api developer']],
  ['Full Stack', ['full stack', 'full-stack', 'fullstack', 'mern', 'mean stack']],
  ['Mobile', ['mobile', 'android', 'ios', 'app developer']],
  ['Data', ['data engineer', 'data analyst', 'data science', 'business intelligence', 'analytics']],
  ['AI/ML', ['machine learning', 'artificial intelligence', 'ai engineer', 'ml engineer', 'deep learning', 'data scientist']],
  ['Cloud', ['cloud', 'devops', 'sre', 'site reliability', 'infrastructure']],
  ['Security', ['security', 'cyber', 'soc analyst', 'pentester']],
  ['Design', ['designer', 'design', 'ux', 'ui/ux', 'creative']],
  ['Product', ['product manager', 'product owner', 'project manager', 'program manager']],
  ['Business', ['marketing', 'sales', 'finance', 'consulting', 'business', 'operations', 'hr']]
];

const DEPARTMENT_ALIASES = [
  { match: /comput|software|information technology|\bit\b|cse|programming/i, label: 'Computer Science & Engineering' },
  { match: /data science|artificial intelligence|\bai\b|\bds\b|machine learning/i, label: 'Data Science & Artificial Intelligence' },
  { match: /electronic|communication|\bece\b|ece|vlsi|embedded/i, label: 'Electronics & Communication Engineering' },
  { match: /electrical|\bee\b|power systems/i, label: 'Electrical Engineering' },
  { match: /mechanical|mechatronics|automobile|robotics/i, label: 'Mechanical Engineering' },
  { match: /civil|structural|construction/i, label: 'Civil Engineering' },
  { match: /design|human-computer|hci|interaction/i, label: 'Design & Human-Computer Interaction' },
  { match: /business|management|\bmba\b|administration/i, label: 'Business Administration & Management' },
  { match: /biotech|bio-engineering|biological|life science/i, label: 'Biotechnology & Bio-Engineering' },
  { match: /economic|financial|finance|commerce/i, label: 'Economics & Financial Analytics' },
  { match: /humanities|social science|psychology|literature/i, label: 'Humanities & Social Sciences' }
];

const EDUCATION_KEYWORDS = [
  ['Bachelor of Technology (B.Tech)', /b\.?tech|bachelor of technology|undergraduate engineering/i],
  ['Bachelor of Engineering (B.E.)', /b\.?e\.?\b|bachelor of engineering/i],
  ['Master of Technology (M.Tech)', /m\.?tech|master of technology/i],
  ['Master of Computer Applications (MCA)', /\bmca\b|master of computer applications/i],
  ['Master of Business Administration (MBA)', /\bmba\b|master of business administration/i],
  ['Bachelor of Science (B.Sc)', /b\.?sc|bachelor of science/i],
  ['Master of Science (M.Sc)', /m\.?sc|master of science/i],
  ['Bachelor of Computer Applications (BCA)', /\bbca\b|bachelor of computer applications/i],
  ['PhD / Research', /\bph\.?d\b|doctorate|doctoral/i],
  ['Diploma', /diploma|polytechnic/i]
];

const clean = value => String(value || '').trim();
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Pre-compile one word-boundary regex per alias so matching stays consistent.
const SKILL_INDEX = SKILLS.map(skill => ({
  ...skill,
  patterns: skill.aliases.map(alias => ({
    alias,
    regex: new RegExp(`(^|[^a-z0-9+#.])${escapeRegExp(alias)}(?![a-z0-9+#])`, 'i')
  }))
}));

function detectSkills(text) {
  const found = [];
  for (const skill of SKILL_INDEX) {
    if (skill.patterns.some(pattern => pattern.regex.test(text))) found.push(skill.name);
  }
  return found;
}

function detectDomains(text) {
  const found = [];
  for (const [domain, keywords] of DOMAIN_KEYWORDS) {
    if (keywords.some(keyword => text.includes(keyword))) found.push(domain);
  }
  return found;
}

function detectDepartments(text) {
  const found = [];
  for (const entry of DEPARTMENT_ALIASES) {
    if (entry.match.test(text)) found.push(entry.label);
  }
  return [...new Set(found)];
}

function detectEducation(text) {
  return EDUCATION_KEYWORDS.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

function extractMinCgpa(text) {
  const patterns = [
    /(?:minimum|min|at least)\s*(?:of\s*)?(\d{1,2}(?:\.\d{1,2})?)\s*(?:cgpa|gpa)/i,
    /(?:cgpa|gpa)\s*(?:of|:|-|>=|above|over|minimum)?\s*(\d{1,2}(?:\.\d{1,2})?)/i,
    /(\d{1,2}(?:\.\d{1,2})?)\s*(?:\+|or above|and above)\s*(?:cgpa|gpa)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > 0 && value <= 10) return value;
    }
  }
  return null;
}

function extractExperienceYears(text) {
  const match = text.match(/(\d{1,2})\s*\+?\s*(?:to\s*\d{1,2}\s*)?years?/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function extractKeywords(text, excluded = []) {
  const excludedSet = new Set(excluded.map(value => value.toLowerCase()));
  const words = (text.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) || []).map(word => word.replace(/[.-]+$/, ''));
  const counts = new Map();
  for (const word of words) {
    if (GENERIC_TERMS.has(word) || excludedSet.has(word) || word.length < 5) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 14)
    .map(([word]) => word);
}

function extractResponsibilities(text) {
  return text
    .split(/\r?\n/)
    .map(line => line.replace(/^[\s•●◦\-*–—\d.)]+/, '').trim())
    .filter(line => line.length >= 28 && line.length <= 220)
    .filter(line => /(you will|responsib|build|design|develop|manage|lead|own|collaborat|analyz|analys|implement|maintain|support|conduct|test|deploy)/i.test(line))
    .slice(0, 6);
}

function buildSummary(analysis) {
  const parts = [];
  if (analysis.role) parts.push(`Role: ${analysis.role}.`);
  if (analysis.domains.length) parts.push(`Focus areas: ${analysis.domains.join(', ')}.`);
  if (analysis.skills.length) parts.push(`Core skills: ${analysis.skills.slice(0, 8).join(', ')}.`);
  if (analysis.minCgpa) parts.push(`Minimum CGPA: ${analysis.minCgpa}.`);
  if (analysis.experienceYears) parts.push(`Experience requested: ${analysis.experienceYears}+ years.`);
  if (analysis.education.length) parts.push(`Education: ${analysis.education.join(', ')}.`);
  return parts.length ? parts.join(' ') : 'We could not detect structured requirements in this description. Try adding a fuller job description with skills and qualifications.';
}

function analyzeDescription({ jobDescription = '', jobTitle = '' } = {}) {
  const text = clean(jobDescription);
  if (text.length < 20) throw new Error('Please paste a fuller job description (at least a few sentences).');

  const lower = text.toLowerCase();
  const skills = detectSkills(text);
  const domains = detectDomains(lower);
  const departments = detectDepartments(text);
  const education = detectEducation(text);
  const minCgpa = extractMinCgpa(text);
  const experienceYears = extractExperienceYears(text);

  // Derive a role title from an explicit field or the first meaningful line.
  const firstLine = text.split(/\r?\n/).map(line => line.trim()).find(line => line.length > 2 && line.length < 90) || '';
  const role = clean(jobTitle) || firstLine.replace(/[.:]$/, '') || 'Untitled role';

  const excluded = skills.flatMap(skill => skill.toLowerCase().split(/[\s/&]+/)).filter(Boolean);
  const keywords = extractKeywords(text, excluded);
  const responsibilities = extractResponsibilities(text);

  return { role, skills, keywords, domains, departments, education, minCgpa, experienceYears, responsibilities, summary: '' };
}

function studentSkillText(student) {
  const tags = [
    ...(student.interests?.passions || []),
    ...(student.interests?.hobbies || []),
    ...(student.achievements || []).flatMap(achievement => [achievement.title, achievement.category, achievement.description]),
    student.academic?.department,
    student.academic?.degreeProgram,
    student.personal?.fullName
  ];
  return tags.filter(Boolean).join(' \n ');
}

function scoreStudent(student, analysis) {
  const text = studentSkillText(student);
  const lower = text.toLowerCase();

  const studentSkills = detectSkills(text);
  const matchedSkills = analysis.skills.filter(skill => studentSkills.includes(skill));
  const missingSkills = analysis.skills.filter(skill => !matchedSkills.includes(skill));
  const skillScore = analysis.skills.length ? Math.round((matchedSkills.length / analysis.skills.length) * 100) : 0;

  const studentDomains = detectDomains(lower);
  const matchedDomains = analysis.domains.filter(domain => studentDomains.includes(domain));
  const domainScore = analysis.domains.length ? Math.round((matchedDomains.length / analysis.domains.length) * 100) : 0;

  const interestTerms = [...(student.interests?.passions || []), ...(student.interests?.hobbies || [])].join(' ');
  const interestMatches = createMatcher(interestTerms);
  const matchedKeywords = analysis.keywords.filter(keyword => interestMatches(keyword));
  const interestScore = analysis.keywords.length ? Math.round((matchedKeywords.length / analysis.keywords.length) * 100) : 0;

  const achievementCount = (student.achievements || []).length;
  const achievementScore = clamp(Math.round((achievementCount / 3) * 100), 0, 100);

  // Weighted composite. When a JD is purely descriptive (no skills detected),
  // fall back to interest + achievement signals so results stay meaningful.
  const hasSkills = analysis.skills.length > 0;
  const weights = hasSkills
    ? { skills: 0.55, domain: 0.15, interests: 0.2, achievements: 0.1 }
    : { skills: 0, domain: 0.2, interests: 0.55, achievements: 0.25 };
  let total = skillScore * weights.skills + domainScore * weights.domain + interestScore * weights.interests + achievementScore * weights.achievements;

  const eligibilityFlags = [];
  const cgpa = student.academic?.cgpa;
  if (analysis.minCgpa) {
    if (cgpa === undefined || cgpa === null || cgpa === '') {
      eligibilityFlags.push('CGPA not on record');
    } else if (Number(cgpa) < analysis.minCgpa) {
      eligibilityFlags.push(`CGPA below ${analysis.minCgpa}`);
      total -= 12;
    } else {
      total += 5;
    }
  }
  if (Number(student.academic?.activeBacklogs) > 0) {
    eligibilityFlags.push('Active backlogs');
    total -= 8;
  }

  const departmentAligned = analysis.departments.some(dept => (student.academic?.department || '').toLowerCase().includes(dept.split(' ')[0].toLowerCase()));
  if (analysis.departments.length && departmentAligned) total += 6;

  const score = clamp(Math.round(total), 0, 100);

  const reasons = [];
  if (matchedSkills.length) reasons.push(`Matches ${matchedSkills.length}/${analysis.skills.length} required skills`);
  if (matchedDomains.length) reasons.push(`Aligned to ${matchedDomains.join(', ')}`);
  if (matchedKeywords.length) reasons.push(`Interests echo ${matchedKeywords.slice(0, 4).join(', ')}`);
  if (achievementCount) reasons.push(`${achievementCount} recorded achievement${achievementCount === 1 ? '' : 's'}`);
  if (!reasons.length) reasons.push('Weak overlap with this description');

  return {
    score,
    matchedSkills,
    missingSkills: missingSkills.slice(0, 8),
    matchedKeywords: matchedKeywords.slice(0, 6),
    matchedDomains,
    reasons,
    eligibilityFlags
  };
}

class JDAnalyzerService {
  async analyze({ jobDescription = '', jobTitle = '', limit = 30 } = {}) {
    const analysis = analyzeDescription({ jobDescription, jobTitle });
    analysis.summary = buildSummary(analysis);

    const students = (await studentStore.listStudents())
      .filter(student => !student.isAdmin && student.status !== 'suspended' && student.onboarding?.completed !== false);

    const candidates = students
      .map(student => {
        const result = scoreStudent(student, analysis);
        return {
          id: student.id,
          name: student.personal?.fullName || 'Unnamed student',
          email: student.profileSettings?.visibility === 'public' ? student.personal?.email || null : null,
          academic: student.academic || {},
          interests: student.interests || {},
          achievements: student.achievements || [],
          profileVisibility: student.profileSettings?.visibility || 'private',
          ...result
        };
      })
      .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

    const top = candidates.slice(0, clamp(Number(limit) || 30, 1, 100));

    return {
      analysis,
      candidates: top,
      stats: {
        evaluated: candidates.length,
        returned: top.length,
        strongMatches: candidates.filter(candidate => candidate.score >= 60).length
      }
    };
  }

  /** Analyse without student data, used by the recruiter portal preview. */
  analyzeOnly({ jobDescription = '', jobTitle = '' } = {}) {
    const analysis = analyzeDescription({ jobDescription, jobTitle });
    analysis.summary = buildSummary(analysis);
    return analysis;
  }
}

module.exports = new JDAnalyzerService();
