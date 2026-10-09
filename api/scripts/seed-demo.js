/**
 * Sample data seeder: populates a realistic demo dataset for the main admin
 * account - companies, a matched recruiter, students with full profiles,
 * published job posts, applications (including hires), a complete recruitment
 * engagement with communication, and candidate shares with feedback.
 *
 * Usage:  node scripts/seed-demo.js [--keep]   (add --keep to keep the server running)
 * Requires the API running in volatile mode (USE_DATABASE=false) or a live DB.
 */
const path = require('path');
// Load api/.env so requests carry the API key the target server requires.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const BASE = process.env.SEED_API_BASE || 'http://localhost:5199';
let cookie = '';

async function call(method, apiPath, body) {
  const response = await fetch(`${BASE}${apiPath}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(process.env.API_KEY ? { 'X-API-Key': process.env.API_KEY } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${apiPath} -> ${response.status}: ${data.message || 'unknown'}`);
  return data;
}

const daysAgo = n => new Date(Date.now() - n * 86400000).toISOString();
const daysAhead = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const COMPANIES = [
  { name: 'Microsoft', website: 'https://microsoft.com', description: 'Global software, cloud and productivity company.' },
  { name: 'Amazon', website: 'https://amazon.com', description: 'E-commerce and AWS cloud infrastructure leader.' },
  { name: 'Zomato', website: 'https://zomato.com', description: 'Indian food delivery and restaurant discovery platform.' },
  { name: 'Infosys', website: 'https://infosys.com', description: 'Indian multinational IT services and consulting.' }
];

const STUDENTS = [
  {
    fullName: 'Aarav Sharma', roll: '2105001', phone: '+91 90000 10001', dob: '2004-08-15', department: 'Computer Science & Engineering', batch: '2027', cgpa: 8.9,
    tenth: 92, twelfth: 89, backlogs: 0,
    passions: [{ name: 'Backend Systems', proficiency: 'advanced', reason: 'Built multiple backend services with Django and FastAPI' }, { name: 'Database Design', proficiency: 'advanced', reason: 'Designed schemas for three production projects' }, { name: 'Cloud Infrastructure', proficiency: 'intermediate', reason: 'Deployed projects on EC2 and S3' }],
    hobbies: [{ name: 'Home Labbing', proficiency: 'intermediate', reason: 'Runs a self-hosted server cluster' }, { name: 'Technical Writing', proficiency: 'advanced', reason: 'Publishes API design notes on a personal blog' }],
    projects: [
      { name: 'CampusFlow', type: 'Academic', tech: ['Python', 'Django', 'PostgreSQL', 'Docker'], desc: 'Attendance and grade management platform used by two departments.', contributions: ['Designed the REST API with role-based access', 'Cut report generation time by 70% with cached queries'], url: 'https://github.com/aarav/campusflow' },
      { name: 'QueueLess', type: 'Hackathon', tech: ['FastAPI', 'Redis', 'React'], desc: 'Tokenless queue management app, won 2nd place at HackKIIT 2025.', contributions: ['Built the real-time queue engine with Redis streams'] }
    ],
    internships: [
      { role: 'Backend Engineering Intern', company: 'Zeta Systems', skills: ['Python', 'REST APIs', 'PostgreSQL', 'AWS'], desc: 'Built internal payment reconciliation service handling 50k transactions daily.', location: 'Bengaluru', mode: 'Hybrid', from: '2026-05-01', to: '2026-07-15' }
    ],
    achievements: [
      { title: '2nd Place, HackKIIT 2025', category: 'Hackathon', year: '2025', desc: 'Led a team of four; built QueueLess in 36 hours.' },
      { title: 'AWS Cloud Practitioner', category: 'Certification', year: '2025', desc: 'Verified Amazon Web Services foundational certification.' }
    ],
    semesters: [{ s: 1, sgpa: 8.6 }, { s: 2, sgpa: 8.8 }, { s: 3, sgpa: 9.0 }, { s: 4, sgpa: 9.1 }],
    linkedin: 'https://linkedin.com/in/aarav-sharma-demo'
  },
  {
    fullName: 'Diya Patel', roll: '2105002', phone: '+91 90000 10002', dob: '2004-03-22', department: 'Computer Science & Engineering', batch: '2027', cgpa: 9.2,
    tenth: 95, twelfth: 93, backlogs: 0,
    passions: [{ name: 'Frontend Engineering', proficiency: 'expert', reason: 'Shipped four production frontends' }, { name: 'Design Systems', proficiency: 'advanced', reason: 'Led the campus design club for two semesters' }, { name: 'UI/UX Design', proficiency: 'intermediate', reason: 'Ran usability sessions for student apps' }],
    hobbies: [{ name: 'Photography', proficiency: 'advanced', reason: 'Campus event photographer' }, { name: 'Sketching', proficiency: 'advanced', reason: 'Daily design tool for concept boards' }],
    projects: [
      { name: 'MediTrack', type: 'Client / Freelance', tech: ['React', 'TypeScript', 'Supabase'], desc: 'Medication reminder PWA for a local clinic with 200+ patients.', contributions: ['Designed the full UI system', 'Implemented offline-first sync'] },
      { name: 'Palette Engine', type: 'Personal', tech: ['React', 'Vite'], desc: 'Color palette generator with accessibility contrast checking.', url: 'https://palette.demo.dev' }
    ],
    internships: [
      { role: 'Frontend Intern', company: 'PixelForge Studio', skills: ['React', 'TypeScript', 'Tailwind CSS'], desc: 'Rebuilt the studio marketing site and component library.', location: 'Remote', mode: 'Remote', from: '2026-06-01', to: '2026-08-01' }
    ],
    achievements: [
      { title: 'Winner, Designathon 2026', category: 'Competition', year: '2026', desc: 'Top of 120 entries for accessible design.' },
      { title: 'Google UX Design Certificate', category: 'Certification', year: '2025', desc: '' }
    ],
    semesters: [{ s: 1, sgpa: 9.0 }, { s: 2, sgpa: 9.1 }, { s: 3, sgpa: 9.3 }, { s: 4, sgpa: 9.4 }],
    linkedin: 'https://linkedin.com/in/diya-patel-demo'
  },
  {
    fullName: 'Rohan Verma', roll: '2105003', phone: '+91 90000 10003', dob: '2004-11-02', department: 'Electronics & Communication Engineering', batch: '2027', cgpa: 7.8,
    tenth: 85, twelfth: 82, backlogs: 1,
    passions: [{ name: 'Machine Learning', proficiency: 'intermediate', reason: 'Two coursework projects in computer vision' }, { name: 'Embedded Systems', proficiency: 'advanced', reason: 'Family of self-built IoT devices' }],
    hobbies: [{ name: 'Robotics', proficiency: 'intermediate', reason: 'Campus robotics club build team' }, { name: 'Home Automation', proficiency: 'beginner', reason: 'Tinkers with Raspberry Pi hubs' }],
    projects: [
      { name: 'SignReader', type: 'Research', tech: ['Python', 'OpenCV', 'TensorFlow'], desc: 'Real-time sign language recognition reaching 87% accuracy on a 40-gesture set.', contributions: ['Collected and labelled the training dataset', 'Optimized inference to 24 FPS on CPU'] }
    ],
    internships: [],
    achievements: [{ title: 'Best Final Year Project (nominee)', category: 'Academic', year: '2026', desc: '' }],
    semesters: [{ s: 1, sgpa: 7.4 }, { s: 2, sgpa: 7.7 }, { s: 3, sgpa: 7.9 }, { s: 4, sgpa: 8.0 }],
    linkedin: ''
  },
  {
    fullName: 'Sneha Iyer', roll: '2105004', phone: '+91 90000 10004', dob: '2004-06-30', department: 'Computer Science & Engineering', batch: '2027', cgpa: 8.4,
    tenth: 90, twelfth: 88, backlogs: 0,
    passions: [{ name: 'Software Architecture', proficiency: 'advanced', reason: 'Leads design reviews for team projects' }, { name: 'Distributed Systems', proficiency: 'intermediate', reason: 'Built a course-projects load balancer' }],
    hobbies: [{ name: 'Competitive Programming', proficiency: 'advanced', reason: '400+ problems solved across judges' }, { name: 'Open Source', proficiency: 'advanced', reason: 'Maintains three community repos' }],
    projects: [
      { name: 'Library API', type: 'Academic', tech: ['Java', 'Spring Boot', 'MySQL'], desc: 'Microservice library management backend with full test coverage.', url: 'https://github.com/sneha/library-api' }
    ],
    internships: [
      { role: 'Software Engineer Intern', company: 'TCS Digital', skills: ['Java', 'SQL', 'Spring Boot'], desc: 'Worked on insurance claims batch processing.', location: 'Chennai', mode: 'On-site', from: '2026-01-01', to: '2026-06-30' }
    ],
    achievements: [{ title: 'Codeforces Specialist', category: 'Competitive Programming', year: '2025', desc: 'Peak rating 1580.' }],
    semesters: [{ s: 1, sgpa: 8.2 }, { s: 2, sgpa: 8.3 }, { s: 3, sgpa: 8.5 }, { s: 4, sgpa: 8.6 }],
    linkedin: 'https://linkedin.com/in/sneha-iyer-demo'
  }
];

const JOBS = [
  { company: 'Microsoft', title: 'Software Engineer: Backend', location: 'Hyderabad', type: 'Full-time', skills: ['Python', 'SQL', 'REST APIs', 'Docker', 'AWS'], salaryMin: 1800000, salaryMax: 2500000, desc: 'Build cloud-scale backend services. Strong Python, SQL and distributed systems fundamentals required. Minimum CGPA 7.0 with no active backlogs.' },
  { company: 'Amazon', title: 'SDE Intern (6 months)', location: 'Bengaluru', type: 'Internship', skills: ['Java', 'SQL', 'REST APIs'], salaryMin: 90000, salaryMax: 120000, desc: 'Ship customer-facing features on AWS teams. Java or Python, data structures, and hunger to learn. Minimum CGPA 7.5.' },
  { company: 'Zomato', title: 'Frontend Engineer', location: 'Gurugram', type: 'Full-time', skills: ['React', 'TypeScript', 'REST APIs'], salaryMin: 1200000, salaryMax: 1800000, desc: 'Craft food-ordering experiences used by millions. React and TypeScript depth required.' },
  { company: 'Infosys', title: 'Systems Engineer', location: 'Pune', type: 'Full-time', skills: ['Java', 'SQL'], salaryMin: 400000, salaryMax: 600000, desc: 'Enterprise application development track. Any engineering branch, minimum CGPA 6.5.' }
];

const ENGAGEMENT_MESSAGES = [
  { role: 'university', body: 'Recruitment proposal sent: Microsoft campus drive 2026. We have 142 eligible students with 37 strong backend matches for your SDE profile.' },
  { role: 'company', body: 'Interested in SDE candidates with Python and cloud experience. Can you share stronger backend profiles?' },
  { role: 'university', body: 'Sharing student statistics now: average CGPA 8.1 in the matched pool, 60% with prior internship experience.' },
  { role: 'company', body: 'Requested backend candidate resumes for the top 3 matches.' }
];

async function main() {
  console.log(`Seeding demo data against ${BASE}...`);
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'e2eadmin@kiit.ac.in';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Recruit#2026';

  await call('POST', '/api/auth/login', { email: adminEmail, password: adminPassword });
  console.log('Signed in as admin.');

  // Companies
  const companies = {};
  for (const company of COMPANIES) {
    const existing = (await call('GET', '/api/admin/companies')).companies.find(item => item.name.toLowerCase() === company.name.toLowerCase());
    companies[company.name] = existing || (await call('POST', '/api/admin/companies', company)).company;
  }
  console.log(`Companies ready: ${Object.keys(companies).join(', ')}`);

  // Recruiter account linked to Microsoft by name (matching logic uses tokens)
  const stamp = Date.now();
  let recruiter;
  try {
    recruiter = (await call('POST', '/api/admin/users', {
      fullName: 'Microsoft Talent Team', email: `recruiter.microsoft.${stamp}@outlook.com`, password: 'Recruiter#2026', role: 'recruiter', department: 'Microsoft Talent Acquisition', batchYear: 'Operations'
    })).user;
  } catch (error) {
    console.log('Recruiter create skipped:', error.message);
  }

  // Students with full profiles
  const students = {};
  const adminCookieHolder = { current: null };
  for (const student of STUDENTS) {
    const email = `${student.roll.toLowerCase()}@kiit.ac.in`;
    let created;
    try {
      created = (await call('POST', '/api/admin/users', {
        fullName: student.fullName, email, password: 'Student#2026', role: 'student',
        department: student.department, batchYear: student.batch, rollNumber: student.roll,
        phone: student.phone || '', dateOfBirth: student.dob || ''
      })).user;
    } catch (error) {
      console.log(`Student ${student.fullName} skipped: ${error.message}`);
      continue;
    }
    // Profile data must be written under the STUDENT's own session: sign in
    // as them, enrich through the real endpoints the student UI uses, then
    // restore the admin session.
    adminCookieHolder.current = cookie;
    cookie = '';
    try {
      await call('POST', '/api/auth/login', { email, password: 'Student#2026' });
      // A resume is required before students can apply; create a studio resume
      // from their profile data through the real endpoint.
      const resumeData = {
        personal: { fullName: student.fullName, headline: `${student.department} student`, email },
        summary: { text: `${student.passions[0]?.name || 'Engineering'} focused student with hands-on project experience.` },
        skills: { raw: [...student.passions.map(p => p.name), ...student.hobbies.map(h => h.name)] },
        projects: student.projects.map(project => ({ title: project.name, technologies: project.tech.join(', '), description: project.desc, bullets: project.contributions || [] })),
        experience: student.internships.map(internship => ({ title: internship.role, company: internship.company, dates: `${internship.from} - ${internship.to}`, description: internship.desc, bullets: [] })),
        education: [{ title: `B.Tech - ${student.department}`, institution: 'Kalinga Institute of Industrial Technology', dates: `2023-2027`, description: `CGPA: ${student.cgpa}`, bullets: [] }],
        certifications: [], achievements: [], leadership: [], sectionOrder: ['education', 'skills', 'projects', 'experience']
      };
      const resume = await call('POST', '/api/resumes/studio', { filename: `${student.fullName.replace(/\s+/g, '_')}_General.pdf`, category: 'General', extractedData: resumeData, tags: ['Profile'] });
      await call('PATCH', '/api/profile/academic', {
        cgpa: student.cgpa, tenthPercentage: student.tenth, twelfthPercentage: student.twelfth, activeBacklogs: student.backlogs
      });
      await call('PATCH', '/api/profile/interests', { passions: student.passions, hobbies: student.hobbies });
      if (student.linkedin) await call('PATCH', '/api/profile/social', { linkedin: student.linkedin });
      for (const achievement of student.achievements) {
        await call('POST', '/api/profile/achievements', achievement);
      }
      for (const project of student.projects) {
        await call('POST', '/api/profile/projects', {
          projectName: project.name, projectType: project.type, description: project.desc,
          technologies: project.tech, contributions: project.contributions || [],
          projectUrl: project.url || '', repoUrl: project.repo || '', startDate: '2026-01-01', currentlyWorking: false
        });
      }
      for (const internship of student.internships) {
        await call('POST', '/api/profile/internships', {
          role: internship.role, companyName: internship.company, description: internship.desc,
          skills: internship.skills, location: internship.location, workMode: internship.mode,
          startDate: internship.from, endDate: internship.to, currentlyWorking: false
        });
      }
      for (const semester of student.semesters) {
        await call('POST', '/api/profile/academic/semesters', { semester: semester.s, sgpa: semester.sgpa, academicYear: `2025-${2025 + Math.ceil(semester.s / 2)}` });
      }
      console.log(`Student seeded: ${student.fullName} (${student.roll})`);
    } catch (error) {
      console.log(`Enrichment failed for ${student.fullName}: ${error.message}`);
    } finally {
      cookie = adminCookieHolder.current; // restore admin session
    }
    students[student.fullName] = created;
  }

  // Job posts (published)
  const jobs = {};
  for (const job of JOBS) {
    const companyId = companies[job.company]?.id;
    if (!companyId) continue;
    const created = (await call('POST', '/api/admin/job-posts', {
      companyId, title: job.title, description: job.desc, location: job.location, employmentType: job.type,
      requiredSkills: job.skills, salaryMin: job.salaryMin, salaryMax: job.salaryMax, salaryCurrency: 'INR',
      eligibility: { minCgpa: job.company === 'Infosys' ? 6.5 : 7.0, allowedDepartments: [], allowedBatches: [], maxActiveBacklogs: 0 }
    })).jobPost;
    const published = (await call('POST', `/api/admin/job-posts/${created.id}/publish`)).jobPost;
    jobs[job.title] = published;
    console.log(`Job published: ${job.company} - ${job.title}`);
  }

  // Applications: sign in as each student and apply through the real endpoint,
  // then set outcomes as admin. This exercises the true student path.
  const studentCredentials = STUDENTS.map(student => ({ fullName: student.fullName, email: `${student.roll.toLowerCase()}@kiit.ac.in` }));
  const applyAsStudent = async (studentName, jobTitle) => {
    const job = jobs[jobTitle];
    const info = studentCredentials.find(entry => entry.fullName === studentName);
    if (!job || !info || !students[studentName]) return null;
    const adminCookie = cookie;
    cookie = '';
    try {
      await call('POST', '/api/auth/login', { email: info.email, password: 'Student#2026' });
      const created = await call('POST', `/api/opportunities/${job.id}/applications`, { answers: {} });
      console.log(`Application created: ${studentName} -> ${jobTitle}`);
      return created.application;
    } catch (error) {
      console.log(`Application skipped (${studentName} -> ${jobTitle}): ${error.message}`);
      return null;
    } finally {
      cookie = adminCookie; // restore admin session
    }
  };
  const setOutcome = async (application, status) => {
    if (!application || !status) return;
    await call('PATCH', `/api/admin/applications/${application.id}`, { status }).catch(() => {});
  };
  const aaravMicrosoft = await applyAsStudent('Aarav Sharma', 'Software Engineer: Backend');
  await setOutcome(aaravMicrosoft, 'interview');
  const snehaMicrosoft = await applyAsStudent('Sneha Iyer', 'Software Engineer: Backend');
  await setOutcome(snehaMicrosoft, 'selected');
  const snehaAmazon = await applyAsStudent('Sneha Iyer', 'SDE Intern (6 months)');
  await setOutcome(snehaAmazon, 'shortlisted');
  await applyAsStudent('Diya Patel', 'Frontend Engineer');
  const rohanInfosys = await applyAsStudent('Rohan Verma', 'Systems Engineer');
  await setOutcome(rohanInfosys, 'rejected');

  // Recruitment engagement with full communication flow
  const microsoftId = companies['Microsoft']?.id;
  if (microsoftId) {
    const engagement = (await call('POST', '/api/admin/recruitment/engagements', {
      companyId: microsoftId, roles: ['Software Development Engineer', 'Backend Engineer'],
      jobDescription: 'Build cloud-scale backend services with Python, SQL, Docker and AWS. REST API design, distributed systems fundamentals, minimum CGPA 7.0, no active backlogs.',
      proposalNote: 'Dear Microsoft Talent Team, we would like to propose our campus recruitment drive for the 2027 batch.'
    })).engagement;
    await call('POST', `/api/admin/recruitment/engagements/${engagement.id}/send`);
    for (const message of ENGAGEMENT_MESSAGES) {
      if (message.role === 'university') {
        await call('POST', `/api/admin/recruitment/engagements/${engagement.id}/messages`, { body: message.body });
      }
    }
    await call('POST', `/api/admin/recruitment/engagements/${engagement.id}/analyze-role`);
    console.log('Engagement created with communication timeline and role analysis.');
  }

  // Refresh recommendations so the priority board reflects the new data
  await call('POST', '/api/admin/recruitment/recommendations/refresh');
  console.log('Recommendations refreshed.');

  console.log('\nSeed complete. Admin demo data is live:');
  console.log('  - 4 companies, 4 published job posts, 5 applications with mixed outcomes');
  console.log('  - 4 rich student profiles (projects, internships, achievements, semesters, interests)');
  console.log('  - 1 Microsoft recruiter account + full recruitment engagement with messages');
  console.log('  - Priority recommendations recomputed from the seeded data');
  if (!process.argv.includes('--keep')) process.exit(0);
}

main().catch(error => { console.error('SEED FAILED:', error.message); process.exit(1); });
