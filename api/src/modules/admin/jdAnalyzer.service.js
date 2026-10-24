const studentStore = require('../students/studentStore');
const { GENERIC_TERMS, createMatcher } = require('../../shared/textMatch');
const embeddingStore = require('./embeddingStore');
const { cosineSimilarity } = require('./embedding.service');
let activeAnalyses = 0;

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
  { name: 'HTML & CSS', domain: 'Frontend', aliases: ['html', 'css', 'sass', 'scss'] },
  { name: 'Tailwind CSS', domain: 'Frontend', aliases: ['tailwind', 'tailwindcss', 'tailwind css'] },
  { name: 'Redux', domain: 'Frontend', aliases: ['redux'] },
  { name: 'UI/UX Design', domain: 'Design', aliases: ['ui/ux', 'ui ux', 'ux design', 'ui design', 'user experience', 'user interface'] },
  { name: 'Figma', domain: 'Design', aliases: ['figma'] },
  { name: 'Product Design', domain: 'Design', aliases: ['product design', 'interaction design', 'design thinking'] },

  // Backend & languages
  { name: 'Node.js', domain: 'Backend', aliases: ['node', 'node.js', 'nodejs', 'express', 'express.js', 'expressjs'] },
  { name: 'Python', domain: 'Backend', aliases: ['python', 'py'] },
  { name: 'FastAPI', domain: 'Backend', aliases: ['fastapi', 'fast api'] },
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
  { name: 'Prisma & ORM', domain: 'Backend', aliases: ['prisma', 'typeorm', 'hibernate', 'sqlalchemy'] },
  { name: 'Redis', domain: 'Backend', aliases: ['redis'] },
  { name: 'Kafka / Messaging', domain: 'Backend', aliases: ['kafka', 'apache kafka', 'rabbitmq', 'message queue'] },
  { name: 'Kotlin', domain: 'Mobile', aliases: ['kotlin'] },
  { name: 'Swift', domain: 'Mobile', aliases: ['swift', 'ios'] },
  { name: 'Flutter', domain: 'Mobile', aliases: ['flutter', 'dart'] },
  { name: 'Android', domain: 'Mobile', aliases: ['android', 'jetpack compose'] },

  // Data & AI
  { name: 'SQL', domain: 'Data', aliases: ['sql', 'mysql', 'postgres', 'postgresql', 'sqlite', 'oracle db', 'pl/sql'] },
  { name: 'NoSQL', domain: 'Data', aliases: ['mongodb', 'mongo', 'nosql', 'dynamodb', 'cassandra', 'supabase'] },
  { name: 'Data Analysis', domain: 'Data', aliases: ['data analysis', 'data analytics', 'analytics', 'data analyst'] },
  { name: 'Data Science', domain: 'Data', aliases: ['data science', 'data scientist'] },
  { name: 'Machine Learning', domain: 'AI/ML', aliases: ['machine learning', 'ml', 'supervised learning', 'scikit', 'sklearn'] },
  { name: 'Deep Learning', domain: 'AI/ML', aliases: ['deep learning', 'neural network', 'neural networks'] },
  { name: 'TensorFlow', domain: 'AI/ML', aliases: ['tensorflow'] },
  { name: 'PyTorch', domain: 'AI/ML', aliases: ['pytorch', 'torch'] },
  { name: 'NLP & LLMs', domain: 'AI/ML', aliases: ['nlp', 'natural language processing', 'llm', 'large language model', 'langchain', 'rag', 'vector search', 'vector db'] },
  { name: 'Computer Vision', domain: 'AI/ML', aliases: ['computer vision', 'opencv', 'image processing'] },
  { name: 'Pandas & NumPy', domain: 'Data', aliases: ['pandas', 'numpy', 'matplotlib', 'seaborn'] },
  { name: 'Power BI / Tableau', domain: 'Data', aliases: ['power bi', 'powerbi', 'tableau', 'looker', 'data visualization'] },
  { name: 'Excel', domain: 'Data', aliases: ['excel', 'spreadsheet', 'google sheets'] },
  { name: 'Statistics', domain: 'Data', aliases: ['statistics', 'statistical', 'probability'] },

  // Cloud / DevOps / Security
  { name: 'AWS', domain: 'Cloud', aliases: ['aws', 'amazon web services', 'ec2', 's3', 'lambda'] },
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
  { match: /electronic|\bece\b|vlsi|embedded systems|communication engineering/i, label: 'Electronics & Communication Engineering' },
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
  ['Bachelor of Engineering (B.E.)', /\bB\.?E\.?(?=\W|$)|[Bb]achelor of [Ee]ngineering/],
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
  const clauses = positiveClauses(text);
  for (const skill of SKILL_INDEX) {
    if (clauses.some(clause => skill.patterns.some(pattern => pattern.regex.test(clause)))) found.push(skill.name);
  }
  return found;
}

// Conservative clause exclusion: negated or explicitly unnecessary requirements
// are not positive evidence. Split sentences without breaking Node.js or 7.0.
function positiveClauses(text) {
  return String(text).split(/\r?\n|;|\.(?:\s|$)/).filter(clause =>
    !/\b(?:not required|not necessary|no experience|no knowledge|without experience|do not require|does not require|not used|never used)\b/i.test(clause)
    && !/\bno\b.+\brequired\b/i.test(clause));
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
  // Branch constraints come from education/eligibility clauses, never generic
  // responsibilities such as communication, design, research or finance work.
  const eligibilityText = String(text).split(/\r?\n|;|\.(?:\s|$)/).filter(line => /degree|bachelor|master|b\.?tech|b\.e\.|\bBE\b|branch|department|eligible|engineering|graduate/i.test(line)).join(' ');
  for (const entry of DEPARTMENT_ALIASES) {
    if (entry.match.test(eligibilityText)) found.push(entry.label);
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
  const match = text.match(/\b(\d{1,2})\s*(?:(?:-|–|—|to)\s*\d{1,2}\s*)?\+?\s*years?\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function experienceLabel(text, minimum) {
  const range = text.match(/\b(\d{1,2})\s*(?:-|–|—|to)\s*(\d{1,2})\s*years?\b/i);
  if (range) return `${range[1]}–${range[2]} years`;
  return minimum === null ? (/\bfresher|entry.level\b/i.test(text) ? 'Fresher / entry-level' : 'Not specified') : `${minimum}+ years`;
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

function stripMarkdown(text) {
  if (!text) return '';
  return String(text)
    // Remove markdown headers: # Heading, ## Heading, etc.
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold and italics: ***text***, **text**, *text*, __text__, _text_
    .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, '$2')
    // Remove inline code: `code`
    .replace(/`([^`]+)`/g, '$1')
    // Remove markdown links: [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove blockquotes: > quote
    .replace(/^>\s+/gm, '')
    // Remove list bullets / checkboxes: - [ ] item, * item, - item, + item, 1. item
    .replace(/^[\s•●◦\-*+–—\d.)]+(\[[ xX]\]\s*)?/, '')
    .trim();
}

function extractResponsibilities(text) {
  return text
    .split(/\r?\n/)
    // Filter out empty lines, markdown headers, and section title lines
    .filter(rawLine => {
      const trimmed = rawLine.trim();
      if (!trimmed) return false;
      // Skip markdown headers (e.g. # Job Title, ## Responsibilities)
      if (/^#{1,6}\s+/.test(trimmed)) return false;
      // Skip dividers (---, ***, ===)
      if (/^[-*_=\s]{3,}$/.test(trimmed)) return false;
      // Skip generic section headings (e.g. "What we look for:", "Responsibilities:")
      if (/^(responsibilit|requirement|qualification|about (the|us)|what (we|you)|role overview|job description|overview)[^:]*:\s*$/i.test(trimmed)) return false;
      return true;
    })
    .map(line => stripMarkdown(line))
    // Filter out introductory company / recruitment statements
    .filter(line => !/^(we are (looking for|seeking|hiring)|about (the|us)|join (our|us)|welcome to)/i.test(line))
    .filter(line => line.length >= 20 && line.length <= 220)
    .filter(line => !/^(?:bachelor|master|minimum|qualifications?|requirements?)\b/i.test(line))
    .filter(line => /(you will|responsib|build|design|develop|manage|lead|own|collaborat|analyz|analys|implement|maintain|support|conduct|test|deploy|architect)/i.test(line))
    .slice(0, 6);
}

function buildSummary(analysis) {
  const parts = [];
  if (analysis.role) parts.push(`Role: ${analysis.role}.`);
  if (analysis.domains.length) parts.push(`Focus areas: ${analysis.domains.join(', ')}.`);
  if (analysis.skills.length) parts.push(`Core skills: ${analysis.skills.slice(0, 8).join(', ')}.`);
  if (analysis.minCgpa) parts.push(`Minimum CGPA: ${analysis.minCgpa}.`);
  if (analysis.experienceYears !== null) parts.push(`Experience requested: ${analysis.experienceLabel}.`);
  if (analysis.education.length) parts.push(`Education: ${analysis.education.join(', ')}.`);
  return parts.length ? parts.join(' ') : 'We could not detect structured requirements in this description. Try adding a fuller job description with skills and qualifications.';
}

function analyzeDescription({ jobDescription = '', jobTitle = '' } = {}) {
  if (typeof jobDescription !== 'string' || typeof jobTitle !== 'string') throw new Error('Job description and title must be text.');
  const text = clean(jobDescription);
  if (text.length < 20) throw new Error('Please paste a fuller job description (at least a few sentences).');
  if (text.length > 30000 || jobTitle.length > 200) throw new Error('Use a description under 30,000 characters and a title under 200 characters.');

  const lower = text.toLowerCase();
  const skills = detectSkills(text);
  const domains = detectDomains(lower);
  const departments = detectDepartments(text);
  const education = detectEducation(text);
  const minCgpa = extractMinCgpa(text);
  const experienceYears = extractExperienceYears(text);

  // Derive a role title from an explicit field or the first meaningful line (cleaning markdown).
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const firstMeaningfulLine = lines.find(line => {
    const stripped = stripMarkdown(line).replace(/^(role|job title|position)\s*:\s*/i, '').trim();
    return stripped.length > 2 && stripped.length < 90;
  }) || '';

  const cleanedRole = stripMarkdown(firstMeaningfulLine)
    .replace(/^(role|job title|position)\s*:\s*/i, '')
    .replace(/[.:]$/, '')
    .trim();

  const role = clean(jobTitle) || cleanedRole || 'Untitled role';

  const excluded = skills.flatMap(skill => skill.toLowerCase().split(/[\s/&]+/)).filter(Boolean);
  const keywords = extractKeywords(text, excluded);
  const responsibilities = extractResponsibilities(text);

  return { role, skills, keywords, domains, departments, education, minCgpa, experienceYears, experienceLabel: experienceLabel(text, experienceYears), noBacklogs: /\bno (?:active )?backlogs|zero (?:active )?backlogs|backlog.free/i.test(text), responsibilities, rawText: text, summary: '' };
}

function mapTagToCanonicalSkill(tag) {
  const cleaned = clean(tag).toLowerCase();
  if (!cleaned) return null;
  for (const skill of SKILL_INDEX) {
    if (skill.name.toLowerCase() === cleaned) return skill.name;
    if (skill.aliases.some(alias => alias.toLowerCase() === cleaned)) return skill.name;
  }
  return null;
}

function detectStudentSkills(student, text) {
  const detected = new Set(detectSkills(text));

  // Directly map explicit tags from projects and internships
  const explicitTags = [
    ...(student.projects || []).flatMap(p => Array.isArray(p.technologies) ? p.technologies : []),
    ...(student.internships || []).flatMap(i => Array.isArray(i.skills) ? i.skills : [])
  ];

  for (const tag of explicitTags) {
    const canonical = mapTagToCanonicalSkill(tag);
    if (canonical) {
      detected.add(canonical);
    }
  }

  return [...detected];
}

function studentSkillText(student) {
  const tags = [
    // Projects: names, tech tags, descriptions, contributions
    ...(student.projects || []).flatMap(project => [
      project.projectName,
      ...(Array.isArray(project.technologies) ? project.technologies : []),
      project.description,
      ...(Array.isArray(project.contributions) ? project.contributions : [])
    ]),
    // Internships: roles, companies, skills tags, descriptions, responsibilities
    ...(student.internships || []).flatMap(internship => [
      internship.role,
      internship.companyName,
      ...(Array.isArray(internship.skills) ? internship.skills : []),
      internship.description,
      ...(Array.isArray(internship.responsibilities) ? internship.responsibilities : [])
    ]),
    // Passions & Hobbies
    ...(student.interests?.passions || []),
    ...(student.interests?.hobbies || []),
    // Achievements
    ...(student.achievements || []).flatMap(achievement => [achievement.title, achievement.category, achievement.description]),
    // Academic & Personal
    student.academic?.department,
    student.academic?.degreeProgram,
    ...(Array.isArray(student.interests?.skills) ? student.interests.skills : [])
  ];
  return tags.filter(Boolean).join(' \n ');
}

async function scoreStudent(student, analysis, jdEmbedding, embeddingOptions = {}) {
  const text = studentSkillText(student);
  const lower = text.toLowerCase();

  const studentSkills = detectStudentSkills(student, text);
  const matchedSkills = analysis.skills.filter(skill => studentSkills.includes(skill));
  const missingSkills = analysis.skills.filter(skill => !matchedSkills.includes(skill));
  const skillScore = analysis.skills.length ? Math.round((matchedSkills.length / analysis.skills.length) * 100) : 0;

  const studentDomains = detectDomains(lower);
  const matchedDomains = analysis.domains.filter(domain => studentDomains.includes(domain));
  const domainScore = analysis.domains.length ? Math.round((matchedDomains.length / analysis.domains.length) * 100) : 0;

  const interestTerms = [
    ...(student.interests?.passions || []),
    ...(student.interests?.hobbies || []),
    ...(student.projects || []).map(p => p.projectName),
    ...(student.internships || []).map(i => i.role)
  ].filter(Boolean).join(' ');
  const interestMatches = createMatcher(interestTerms);
  const matchedKeywords = analysis.keywords.filter(keyword => interestMatches(keyword));
  const interestScore = analysis.keywords.length ? Math.round((matchedKeywords.length / analysis.keywords.length) * 100) : 0;

  const projectCount = (student.projects || []).length;
  const internshipCount = (student.internships || []).length;
  const practicalCount = projectCount + internshipCount;
  const practicalScore = clamp(Math.round((practicalCount / 3) * 100), 0, 100);

  const achievementCount = (student.achievements || []).length;
  const achievementScore = clamp(Math.round((achievementCount / 3) * 100), 0, 100);

  // Weighted composite with practical projects and internships factored in.
  const hasSkills = analysis.skills.length > 0;
  const weights = hasSkills
    ? { skills: 0.50, domain: 0.15, practical: 0.15, interests: 0.10, achievements: 0.10 }
    : { skills: 0, domain: 0.20, practical: 0.35, interests: 0.30, achievements: 0.15 };
  let total = skillScore * weights.skills +
              domainScore * weights.domain +
              practicalScore * weights.practical +
              interestScore * weights.interests +
              achievementScore * weights.achievements;

  const eligibilityFlags = [];
  const cgpa = student.academic?.cgpa;
  if (analysis.minCgpa) {
    if (cgpa === undefined || cgpa === null || cgpa === '' || !Number.isFinite(Number(cgpa)) || Number(cgpa) < 0 || Number(cgpa) > 10) {
      eligibilityFlags.push('CGPA missing or invalid');
    } else if (Number(cgpa) < analysis.minCgpa) {
      eligibilityFlags.push(`CGPA below ${analysis.minCgpa}`);
      total -= 12;
    } else {
      total += 5;
    }
  }
  if (analysis.noBacklogs && (student.academic?.activeBacklogs === undefined || student.academic?.activeBacklogs === null || student.academic?.activeBacklogs === '' || !Number.isInteger(Number(student.academic.activeBacklogs)) || Number(student.academic.activeBacklogs) < 0)) {
    eligibilityFlags.push('Backlog record needs review');
  } else if (analysis.noBacklogs && Number(student.academic?.activeBacklogs) > 0) {
    eligibilityFlags.push('Active backlogs');
    total -= 8;
  }

  const studentDepartments = detectDepartments(student.academic?.department || '');
  const departmentAligned = analysis.departments.some(dept => studentDepartments.includes(dept));
  if (analysis.departments.length && departmentAligned) total += 6;
  if (analysis.departments.length && !departmentAligned) eligibilityFlags.push('Department requirement needs review');
  const studentEducation = detectEducation(student.academic?.degreeProgram || '');
  if (analysis.education.length && !analysis.education.some(degree => studentEducation.includes(degree))) eligibilityFlags.push('Degree requirement needs review');
  if (analysis.experienceYears > 0) eligibilityFlags.push('Experience duration requires review');
  const hasEligibilityRequirements = Boolean(analysis.minCgpa || analysis.noBacklogs || analysis.education.length || analysis.departments.length || analysis.experienceYears > 0);

  const deterministicScore = clamp(Math.round(total), 0, 100);

  let finalScore = deterministicScore;
  let semanticScore = 0;
  let semanticUsed = false;

  if (jdEmbedding) {
    try {
      const studentEmbedding = await withinDeadline(embeddingStore.getStudentEmbedding(text, embeddingOptions), embeddingOptions.budget?.deadlineAt || Date.now() + 4000);
      if (studentEmbedding) {
        const sim = cosineSimilarity(jdEmbedding, studentEmbedding);
        if (!Number.isFinite(sim) || jdEmbedding.length !== studentEmbedding.length) throw new Error('Invalid semantic vector');
        
        // Similarity is contextual evidence, not a calibrated hiring probability.
        // Keep explicit source evidence dominant; avoid the previous arbitrary
        // 0.55–0.66 expansion that turned modest similarity into a near-perfect score.
        semanticScore = clamp(Math.round(sim * 100), 0, 100);
        finalScore = clamp(Math.round(0.80 * deterministicScore + 0.20 * semanticScore), 0, 100);
        semanticUsed = true;
      }
    } catch (err) {
      require('../../shared/logger').api.error('[JDAnalyzer] Error in semantic scoring:', err.message);
    }
  }

  const score = finalScore;

  const reasons = [];
  if (matchedSkills.length) reasons.push(`Matches ${matchedSkills.length}/${analysis.skills.length} detected skills`);
  if (semanticScore > 80) reasons.push(`Strong conceptual alignment (${semanticScore}% similarity)`);
  if (matchedDomains.length) reasons.push(`Aligned to ${matchedDomains.join(', ')}`);
  if (projectCount || internshipCount) {
    const parts = [];
    if (projectCount) parts.push(`${projectCount} project${projectCount === 1 ? '' : 's'}`);
    if (internshipCount) parts.push(`${internshipCount} internship${internshipCount === 1 ? '' : 's'}`);
    reasons.push(parts.join(' & '));
  }
  if (achievementCount) reasons.push(`${achievementCount} recorded achievement${achievementCount === 1 ? '' : 's'}`);
  if (matchedKeywords.length) reasons.push(`Interests echo ${matchedKeywords.slice(0, 4).join(', ')}`);
  if (!reasons.length) reasons.push('Weak overlap with this description');

  return {
    score,
    matchedSkills,
    missingSkills: missingSkills.slice(0, 8),
    matchedKeywords: matchedKeywords.slice(0, 6),
    matchedDomains,
    reasons,
    eligibilityFlags,
    eligibilityStatus: eligibilityFlags.length ? 'review' : hasEligibilityRequirements ? 'parsed_checks_passed' : 'not_specified',
    evidence: {
      projects: (student.projects || []).filter(entry => detectSkills(studentSkillText({projects:[entry]})).some(skill => analysis.skills.includes(skill))).length,
      internships: (student.internships || []).filter(entry => detectSkills(studentSkillText({internships:[entry]})).some(skill => analysis.skills.includes(skill))).length,
    },
    semanticScore,
    semanticUsed,
    deterministicScore
  };
}

class JDAnalyzerService {
  async analyze(input = {}) {
    if (activeAnalyses >= 2) { const error = new Error('JD analysis is busy. Please retry shortly.'); error.statusCode = 503; throw error; }
    activeAnalyses++;
    try { return await this._analyze(input); }
    finally { activeAnalyses--; }
  }

  async _analyze({ jobDescription = '', jobTitle = '', limit = 1000, useSemantic = false } = {}) {
    if (typeof useSemantic !== 'boolean') throw new Error('Semantic scoring must be explicitly enabled or disabled.');
    const responseDeadline = Date.now() + 12000;
    const analysis = analyzeDescription({ jobDescription, jobTitle });
    analysis.summary = buildSummary(analysis);

    const deadlineAt = Date.now() + 8000;
    const budget = { remaining: 24, deadlineAt };
    let jdEmbedding = null;
    try {
      if (useSemantic) jdEmbedding = await withinDeadline(embeddingStore.getJdEmbedding(analysis.rawText, {budget}), deadlineAt);
    } catch (err) {
      require('../../shared/logger').api.warn('[JDAnalyzer] Failed to get JD embedding. Falling back to deterministic scoring.', err.message);
    }

    const records = await withinDeadline(studentStore.listStudents(), responseDeadline);
    if (!Array.isArray(records)) { const error = new Error('Student data is taking too long to load. Please retry shortly.'); error.statusCode = 503; throw error; }
    const students = records
      .filter(student => student && !student.blocked && student.status !== 'suspended' && student.onboarding?.completed === true
        && (!(student.isAdmin || student.isRecruiter) || /^\d{6,12}$/.test(String(student.rollNumber || student.academic?.rollNumber || ''))))
      .map(normalizeStudent);

    const scoredStudents = await mapBounded(students, 4, async student => {
      const result = await scoreStudent(student, analysis, Date.now() < deadlineAt ? jdEmbedding : null, {budget});
      return {
        id: student.id,
        rollNumber: student.rollNumber || student.academic?.rollNumber || '',
        name: student.personal?.fullName || 'Unnamed student',
        email: student.profileSettings?.visibility === 'public' ? student.personal?.email || null : null,
        academic: student.academic || {},
        interests: student.interests || {},
        achievements: student.achievements || [],
        projects: student.projects || [],
        internships: student.internships || [],
        social: student.social || { linkedin: '', links: [] },
        profileVisibility: student.profileSettings?.visibility || 'private',
        ...result
      };
    });

    // Never compare hybrid scores for a few cached profiles with deterministic
    // scores for everybody else. Incomplete enrichment uses one common baseline.
    const fullySemantic = scoredStudents.length > 0 && scoredStudents.every(candidate => candidate.semanticUsed);
    if (!fullySemantic) for (const candidate of scoredStudents) {
      candidate.score = candidate.deterministicScore;
      candidate.reasons = candidate.reasons.filter(reason => !reason.startsWith('Strong conceptual alignment'));
    }

    const candidates = scoredStudents.sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

    const top = candidates.slice(0, clamp(Number(limit) || 1000, 1, 1000));

    return {
      analysis,
      candidates: top,
      stats: {
        evaluated: candidates.length,
        returned: top.length,
        strongMatches: candidates.filter(candidate => candidate.score >= 75).length
      },
      scoring: { mode: fullySemantic ? 'hybrid' : 'deterministic', semanticProfiles: scoredStudents.filter(candidate => candidate.semanticUsed).length, totalProfiles: scoredStudents.length, explanation: fullySemantic ? 'All evaluated profiles received semantic enrichment. Scores estimate alignment, not hiring probability.' : useSemantic ? 'Using consistent deterministic scores for all profiles. Semantic enrichment was unavailable or incomplete within the request budget.' : 'AI semantic scoring is off. Scores use source-profile skill overlap and recorded evidence.' }
    };
  }

  /** Analyse without student data, used by the recruiter portal preview. */
  analyzeOnly({ jobDescription = '', jobTitle = '' } = {}) {
    const analysis = analyzeDescription({ jobDescription, jobTitle });
    analysis.summary = buildSummary(analysis);
    return analysis;
  }
}

async function withinDeadline(promise, deadlineAt) {
  let timer;
  try { return await Promise.race([promise, new Promise(resolve => { timer = setTimeout(() => resolve(null), Math.max(0, deadlineAt - Date.now())); })]); }
  finally { clearTimeout(timer); }
}

function normalizeStudent(student) {
  const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const entries = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object' && !Array.isArray(item)) : [];
  const strings = value => (Array.isArray(value) ? value : typeof value === 'string' ? [value] : []).filter(item=>typeof item === 'string');
  const interests = record(student.interests);
  return {...student,personal:record(student.personal),academic:record(student.academic),interests:{...interests,skills:strings(interests.skills),hobbies:strings(interests.hobbies),passions:strings(interests.passions)},
    projects:entries(student.projects).map(entry=>({...entry,technologies:strings(entry.technologies),contributions:strings(entry.contributions)})),
    internships:entries(student.internships).map(entry=>({...entry,skills:strings(entry.skills),responsibilities:strings(entry.responsibilities)})),
    achievements:entries(student.achievements)};
}

async function mapBounded(items, concurrency, action) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{
    while (next < items.length) { const index=next++; results[index]=await action(items[index]); }
  }));
  return results;
}

module.exports = new JDAnalyzerService();
// Public helpers reused by the recruitment priority engine so both features
// share one skill taxonomy and student-text projection (no duplicate logic).
module.exports.detectSkillsPublic = detectSkills;
module.exports.detectDomainsPublic = detectDomains;
module.exports.studentSkillTextPublic = studentSkillText;
