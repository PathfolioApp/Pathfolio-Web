/**
 * profileToResumeData.js
 * 
 * Transforms a student profile from MySQL (students table) into an ATS-ready
 * structured resume document for Resume Studio.
 * Zero external AI API calls - deterministic, instant, and factual.
 */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatMonthYear(dateString) {
  if (!dateString) return '';
  const str = String(dateString).trim();
  // Match YYYY-MM or YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = parseInt(ymdMatch[2], 10);
    if (month >= 1 && month <= 12) {
      return `${MONTH_NAMES[month - 1]} ${year}`;
    }
  }
  // If only a 4 digit year
  if (/^\d{4}$/.test(str)) return str;
  return str;
}

function formatDateRange(startDate, endDate, currentlyWorking) {
  const start = formatMonthYear(startDate);
  if (currentlyWorking) {
    return start ? `${start} – Present` : 'Present';
  }
  const end = formatMonthYear(endDate);
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  if (end) return end;
  return '';
}

// Categorization taxonomy for skills
const TAXONOMY = {
  languages: [
    'javascript', 'typescript', 'python', 'java', 'c++', 'c', 'c#', 'golang', 'go',
    'rust', 'ruby', 'php', 'swift', 'kotlin', 'sql', 'html', 'css', 'r', 'matlab', 'bash', 'shell', 'dart'
  ],
  frameworks: [
    'react', 'react.js', 'reactjs', 'next.js', 'nextjs', 'vue', 'vue.js', 'angular', 'svelte',
    'node.js', 'nodejs', 'express', 'express.js', 'spring', 'spring boot', 'django', 'flask',
    'fastapi', 'laravel', 'asp.net', '.net', 'pandas', 'numpy', 'scipy', 'pytorch', 'tensorflow',
    'chart.js', 'tailwind', 'tailwindcss', 'bootstrap', 'jquery'
  ],
  cloudDevOps: [
    'aws', 'amazon web services', 'gcp', 'google cloud', 'azure', 'docker', 'kubernetes',
    'cloudflare', 'cloudflare r2', 'r2', 'ci/cd', 'github actions', 'jenkins', 'terraform',
    'vercel', 'render', 'neon', 'resend', 'linux', 'nginx', 'jwt'
  ],
  databasesTools: [
    'mysql', 'postgresql', 'postgres', 'mongodb', 'sqlite', 'redis', 'elasticsearch',
    'dynamodb', 'cassandra', 'firebase', 'supabase', 'prisma', 'git', 'github', 'gitlab',
    'postman', 'power bi', 'tableau', 'excel', 'microsoft excel', 'figma', 'jira', 'rest api', 'graphql'
  ],
  coreConcepts: [
    'data structures & algorithms', 'data structures and algorithms', 'dsa',
    'object-oriented programming', 'object oriented programming', 'oop', 'oops',
    'database management system', 'database management systems', 'dbms',
    'computer networks', 'cn', 'operating system', 'operating systems', 'os',
    'software development life cycle', 'sdlc', 'system design'
  ]
};

export function categorizeSkill(skillName) {
  const lower = skillName.toLowerCase().trim();
  if (TAXONOMY.languages.some(lang => lower === lang || lower.startsWith(`${lang} `))) return 'languages';
  if (TAXONOMY.frameworks.some(fw => lower === fw || lower.startsWith(`${fw} `))) return 'frameworks';
  if (TAXONOMY.cloudDevOps.some(cd => lower === cd || lower.startsWith(`${cd} `))) return 'cloudDevOps';
  if (TAXONOMY.databasesTools.some(dt => lower === dt || lower.startsWith(`${dt} `))) return 'databasesTools';
  if (TAXONOMY.coreConcepts.some(cc => lower === cc || lower.startsWith(`${cc} `))) return 'coreConcepts';
  return 'tools';
}

function deduplicateStrings(list) {
  const map = new Map();
  for (const item of list) {
    const trimmed = String(item || '').trim();
    if (trimmed && !map.has(trimmed.toLowerCase())) {
      map.set(trimmed.toLowerCase(), trimmed);
    }
  }
  return Array.from(map.values());
}

export function profileToResumeData(student) {
  if (!student || typeof student !== 'object') {
    return {
      personal: { fullName: '', email: '', phone: '', headline: '', location: '', links: [] },
      summary: { text: '' },
      education: [],
      experience: [],
      projects: [],
      skills: { raw: [], languages: [], frameworks: [], cloudDevOps: [], databasesTools: [] },
      certifications: [],
      achievements: [],
      leadership: [],
    };
  }

  const personal = student.personal || {};
  const academic = student.academic || {};
  const internships = Array.isArray(student.internships) ? student.internships : [];
  const projects = Array.isArray(student.projects) ? student.projects : [];
  const achievements = Array.isArray(student.achievements) ? student.achievements : [];
  const social = student.social || {};

  // 1. Personal & Contact details
  const fullName = personal.fullName || 'Student';
  const email = personal.email || student.email || '';
  const phone = personal.phone || '';
  const location = [personal.city, personal.state].filter(Boolean).join(', ') || 'Bhubaneswar, India';

  // Extract Links
  const links = [];
  if (social.linkedin) links.push(social.linkedin);
  if (Array.isArray(social.links)) {
    social.links.forEach(l => {
      const url = typeof l === 'string' ? l : l?.url;
      if (url && !links.includes(url)) links.push(url);
    });
  }

  // Headline
  const degree = academic.degreeProgram || 'B.Tech';
  const dept = academic.department || 'Computer Science & Engineering';
  const headline = `${degree} in ${dept} | Software & Cloud Systems`;

  // 2. Education (Institution first, Degree/academic details second)
  const education = [];
  const mainDegreeTitle = `${degree} in ${dept}`;
  const collegeInst = academic.institution || academic.university || academic.college || 'Kalinga Institute of Industrial Technology (KIIT)';
  const kiitDates = academic.batchYear ? academic.batchYear : academic.graduationYear ? `Class of ${academic.graduationYear}` : '2023 – 2027';
  const cgpaText = academic.cgpa ? `CGPA: ${academic.cgpa} / 10.0` : '';
  const collegeSubline = [mainDegreeTitle, cgpaText].filter(Boolean).join(' · ');

  education.push({
    id: 'edu_college',
    title: collegeInst,
    institution: collegeInst,
    company: collegeInst,
    degreeProgram: mainDegreeTitle,
    degree: mainDegreeTitle,
    dates: kiitDates,
    description: collegeSubline,
    bullets: [],
  });

  if (academic.twelfthPercentage || academic.twelfthSchool || academic.twelfthBoard) {
    const school = academic.twelfthSchool ? String(academic.twelfthSchool).trim() : '';
    const board = academic.twelfthBoard ? String(academic.twelfthBoard).trim() : '';
    const inst = school && board ? `${school} (${board})` : (school || board || 'Senior Secondary School');

    const details = ['Class XII'];
    if (academic.twelfthPercentage) {
      const pct = String(academic.twelfthPercentage).trim();
      details.push(pct.endsWith('%') ? pct : `${pct}%`);
    }
    if (academic.twelfthStream) {
      const stream = String(academic.twelfthStream).trim();
      details.push(stream.replace(/^Stream:\s*/i, ''));
    }

    education.push({
      id: 'edu_twelfth',
      title: inst,
      institution: inst,
      company: inst,
      degreeProgram: 'Class XII',
      degree: 'Class XII',
      dates: academic.twelfthYear ? String(academic.twelfthYear).trim() : '',
      description: details.join(' · '),
      bullets: [],
    });
  }

  if (academic.tenthPercentage || academic.tenthSchool || academic.tenthBoard) {
    const school = academic.tenthSchool ? String(academic.tenthSchool).trim() : '';
    const board = academic.tenthBoard ? String(academic.tenthBoard).trim() : '';
    const inst = school && board ? `${school} (${board})` : (school || board || 'Secondary School');

    const details = ['Class X'];
    if (academic.tenthPercentage) {
      const pct = String(academic.tenthPercentage).trim();
      details.push(pct.endsWith('%') ? pct : `${pct}%`);
    }

    education.push({
      id: 'edu_tenth',
      title: inst,
      institution: inst,
      company: inst,
      degreeProgram: 'Class X',
      degree: 'Class X',
      dates: academic.tenthYear ? String(academic.tenthYear).trim() : '',
      description: details.join(' · '),
      bullets: [],
    });
  }

  // 3. Work Experience / Internships
  const experience = internships.map((intern, idx) => {
    const role = intern.role || 'Software Engineering Intern';
    const company = intern.companyName || 'Company';
    const dates = formatDateRange(intern.startDate, intern.endDate, intern.currentlyWorking);
    const loc = [intern.location, intern.workMode].filter(Boolean).join(' · ');

    let bullets = [];
    if (Array.isArray(intern.responsibilities)) {
      bullets = intern.responsibilities.map(r => String(r || '').trim()).filter(Boolean);
    } else if (typeof intern.responsibilities === 'string') {
      bullets = intern.responsibilities.split('\n').map(r => r.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
    }

    // Auto-generate trims to top 4 high-impact bullets for clean 1-page density
    const curatedBullets = bullets.slice(0, 4);

    return {
      id: intern.id || `intern_${idx}`,
      title: role,
      role,
      company,
      institution: company,
      dates,
      location: loc,
      // First look from profile auto-generate trims redundant intro description when bullets exist to fit 1 page,
      // while preserving it if no bullets are available so candidate profile data is never lost.
      description: curatedBullets.length > 0 ? '' : (intern.description || ''),
      bullets: curatedBullets.length > 0 ? curatedBullets : (intern.description ? [intern.description] : []),
      skills: Array.isArray(intern.skills) ? intern.skills : [],
      website: intern.companyWebsite || '',
    };
  });

  // 4. Projects
  const projectRecords = projects.map((proj, idx) => {
    const title = proj.projectName || 'Project';
    const role = proj.projectType || 'Technical Project';
    const dates = formatDateRange(proj.startDate, proj.endDate, proj.currentlyWorking);

    let bullets = [];
    if (Array.isArray(proj.contributions)) {
      bullets = proj.contributions.map(c => String(c || '').trim()).filter(Boolean);
    } else if (typeof proj.contributions === 'string') {
      bullets = proj.contributions.split('\n').map(c => c.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
    }

    // Auto-generate trims to top 3 high-impact bullets for clean 1-page density
    const curatedBullets = bullets.slice(0, 3);

    const techList = Array.isArray(proj.technologies) ? proj.technologies : [];
    const techStack = techList.join(', ');

    return {
      id: proj.id || `proj_${idx}`,
      title,
      name: title,
      role,
      dates,
      // First look from profile auto-generate trims redundant intro description when bullets exist to fit 1 page,
      // while preserving it if no bullets are available so project information is never lost.
      description: curatedBullets.length > 0 ? '' : (proj.description || ''),
      bullets: curatedBullets.length > 0 ? curatedBullets : (proj.description ? [proj.description] : []),
      technologies: techStack,
      techList,
      liveUrl: proj.projectUrl || '',
      repoUrl: proj.repoUrl || '',
      links: [proj.projectUrl, proj.repoUrl].filter(Boolean),
    };
  });

  // 5. Skills Collection & Categorization
  const rawSkillsSet = new Set();

  internships.forEach(i => {
    if (Array.isArray(i.skills)) i.skills.forEach(s => rawSkillsSet.add(s.trim()));
  });

  projects.forEach(p => {
    if (Array.isArray(p.technologies)) p.technologies.forEach(t => rawSkillsSet.add(t.trim()));
  });

  if (Array.isArray(student.interests?.passions)) {
    student.interests.passions.forEach(item => {
      const name = typeof item === 'string' ? item : item?.name;
      if (name) rawSkillsSet.add(name.trim());
    });
  }

  const allSkills = deduplicateStrings(Array.from(rawSkillsSet));

  const categorized = {
    languages: [],
    frameworks: [],
    cloudDevOps: [],
    databasesTools: [],
    coreConcepts: [],
    tools: [],
  };

  allSkills.forEach(skill => {
    const category = categorizeSkill(skill);
    if (categorized[category]) {
      categorized[category].push(skill);
    } else {
      categorized.tools.push(skill);
    }
  });

  // 6. Achievements, Certifications & Leadership
  const certRecords = [];
  const achRecords = [];
  const leadRecords = [];

  achievements.forEach((ach, idx) => {
    const title = ach.title || 'Achievement';
    const category = (ach.category || '').toLowerCase();
    const dates = ach.year ? String(ach.year) : '';
    const desc = ach.description || '';

    const entry = {
      id: ach.id || `ach_${idx}`,
      title,
      dates,
      year: dates,
      category: ach.category || 'General',
      description: desc,
      bullets: [],
    };

    if (category.includes('certif') || category.includes('license') || category.includes('course')) {
      certRecords.push(entry);
    } else if (category.includes('leader') || category.includes('club') || category.includes('volunteer') || category.includes('society')) {
      leadRecords.push(entry);
    } else {
      achRecords.push(entry);
    }
  });

  // 7. Dynamic Professional Summary Synthesis
  const topCompanies = internships.map(i => i.companyName).filter(Boolean);
  const topProjects = projects.slice(0, 2).map(p => p.projectName).filter(Boolean);
  const featuredTech = allSkills.slice(0, 6).join(', ');

  let summarySentence1 = `Results-oriented ${degree} in ${dept} student at KIIT${academic.cgpa ? ` (${academic.cgpa} CGPA)` : ''} with a proven track record in software engineering and cloud systems.`;
  if (topCompanies.length > 0) {
    summarySentence1 = `Results-driven ${degree} in ${dept} student at KIIT${academic.cgpa ? ` (${academic.cgpa} CGPA)` : ''} with practical engineering experience at ${topCompanies.join(' and ')}.`;
  }

  let summarySentence2 = '';
  if (featuredTech) {
    summarySentence2 = ` Proficient in ${featuredTech}, with strong foundations in distributed architecture, clean API design, and scalable database systems.`;
  }

  let summarySentence3 = '';
  if (topProjects.length > 0) {
    summarySentence3 = ` Creator of ${topProjects.join(' and ')}, delivering production-grade cloud-hosted platforms.`;
  }

  const generatedSummary = `${summarySentence1}${summarySentence2}${summarySentence3}`.trim();

  return {
    personal: {
      fullName,
      email,
      phone,
      headline,
      location,
      links,
    },
    summary: {
      text: generatedSummary,
    },
    education,
    experience,
    projects: projectRecords,
    skills: {
      raw: allSkills,
      languages: categorized.languages,
      frameworks: categorized.frameworks,
      cloudDevOps: categorized.cloudDevOps,
      databasesTools: categorized.databasesTools,
      coreConcepts: categorized.coreConcepts,
    },
    certifications: certRecords,
    achievements: achRecords,
    leadership: leadRecords,
    sectionOrder: [
      'summary',
      'skills',
      'experience',
      'projects',
      'education',
      'certifications',
      'achievements',
      'leadership',
    ],
  };
}
