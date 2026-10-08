/**
 * Recruiter-experience seeder: populates everything the COMPANY account sees
 * on /recruiter/recruitment (and the recruiter portal generally):
 *
 *  - 12 extra companies + ~36 published job posts across every domain,
 *    employment type, work mode, salary tier and eligibility variation
 *  - Recruiter-owned job posts in mixed statuses (draft / pending / live)
 *  - The recruitment engagement driven forward: company accepts, admin
 *    confirms, two-way message thread
 *  - Candidate shares at different access levels with company feedback
 *  - Multi-year hire history (backdated shares so the "your history with
 *    this campus" banner shows hires-per-year bars and a positive sentiment)
 *
 * Usage: node scripts/seed-recruiter-demo.js
 * Env:   SEED_API_BASE (default http://localhost:5000),
 *        SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (default e2eadmin demo creds)
 * Backdating writes directly to MySQL using api/.env credentials; when the
 * database is not reachable the history step is skipped with a notice.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE = process.env.SEED_API_BASE || 'http://localhost:5000';
let cookie = '';

async function call(method, apiPath, body) {
  const response = await fetch(`${BASE}${apiPath}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${apiPath} -> ${response.status}: ${data.message || 'unknown'}`);
  return data;
}

const CSE = 'Computer Science & Engineering';
const ECE = 'Electronics & Communication Engineering';
const EE = 'Electrical Engineering';
const ME = 'Mechanical Engineering';
const ANY = [];

const NEW_COMPANIES = [
  { name: 'Google', website: 'https://google.com', description: 'Search, ads, Android and cloud giant.' },
  { name: 'Flipkart', website: 'https://flipkart.com', description: 'Indian e-commerce marketplace.' },
  { name: 'TCS', website: 'https://tcs.com', description: 'Tata Consultancy Services, IT services leader.' },
  { name: 'Goldman Sachs', website: 'https://goldmansachs.com', description: 'Global investment banking and securities.' },
  { name: 'Adobe', website: 'https://adobe.com', description: 'Creative and document software.' },
  { name: 'Swiggy', website: 'https://swiggy.com', description: 'Indian on-demand food delivery.' },
  { name: 'Paytm', website: 'https://paytm.com', description: 'Indian fintech and payments platform.' },
  { name: 'Oracle', website: 'https://oracle.com', description: 'Database and enterprise cloud.' },
  { name: 'Nvidia', website: 'https://nvidia.com', description: 'GPU and accelerated computing.' },
  { name: 'Salesforce', website: 'https://salesforce.com', description: 'CRM and enterprise SaaS.' },
  { name: 'Intel', website: 'https://intel.com', description: 'Semiconductor and processor design.' },
  { name: 'Razorpay', website: 'https://razorpay.com', description: 'Indian payments infrastructure.' }
];

// ~36 roles covering domains, employment types, work modes, salary tiers
// (Standard <7 LPA / Dream 7-14 / Super Dream 14+) and eligibility variants.
const CATALOG = [
  // Frontend
  { c: 'Zomato', t: 'Senior Frontend Engineer (React)', loc: 'Gurugram', type: 'Full-time', mode: 'Hybrid', skills: ['React', 'TypeScript', 'Next.js', 'REST APIs'], min: 1800000, max: 2800000, cgpa: 7, desc: 'Own customer-facing React surfaces end to end. Next.js SSR, performance budgets and design-system discipline. Minimum CGPA 7.0.' },
  { c: 'Flipkart', t: 'Frontend Developer', loc: 'Bengaluru', type: 'Full-time', mode: 'On-site', skills: ['React', 'JavaScript', 'HTML & CSS', 'Redux'], min: 1200000, max: 1800000, cgpa: 7, desc: 'Build shopping flows used by millions daily. Strong JavaScript fundamentals and React state management required.' },
  { c: 'Adobe', t: 'UI Engineer, Design Systems', loc: 'Noida', type: 'Full-time', mode: 'Hybrid', skills: ['React', 'TypeScript', 'UI/UX Design', 'Figma'], min: 1600000, max: 2400000, cgpa: 7.5, desc: 'Translate Figma systems into accessible component libraries used across Adobe products.' },
  { c: 'Paytm', t: 'Frontend Intern (3 months)', loc: 'Noida', type: 'Internship', mode: 'On-site', skills: ['JavaScript', 'React', 'HTML & CSS'], min: 40000, max: 60000, cgpa: 6.5, desc: 'Ship production UI under mentorship. Portfolio or GitHub profile required in lieu of experience.' },

  // Backend
  { c: 'Google', t: 'Software Engineer, Backend (Early Career)', loc: 'Hyderabad', type: 'Full-time', mode: 'Hybrid', skills: ['Java', 'Distributed Systems', 'SQL', 'REST APIs'], min: 2200000, max: 3600000, cgpa: 8, desc: 'Design and build planet-scale services. Strong data structures, algorithms and system design. Minimum CGPA 8.0, no active backlogs.' },
  { c: 'Amazon', t: 'SDE I, Payments', loc: 'Hyderabad', type: 'Full-time', mode: 'On-site', skills: ['Java', 'AWS', 'SQL', 'Microservices'], min: 1800000, max: 2800000, cgpa: 7.5, desc: 'Build payment infrastructure on AWS. Java depth, SQL and hunger for operational excellence.' },
  { c: 'Razorpay', t: 'Backend Engineer (Python)', loc: 'Bengaluru', type: 'Full-time', mode: 'Hybrid', skills: ['Python', 'Django', 'PostgreSQL', 'Redis', 'REST APIs'], min: 1400000, max: 2200000, cgpa: 7, desc: 'Move money safely. Python services, strong SQL, idempotency and correctness mindset.' },
  { c: 'Oracle', t: 'Backend Engineer, Cloud Database', loc: 'Bengaluru', type: 'Full-time', mode: 'On-site', skills: ['Java', 'SQL', 'Distributed Systems', 'Linux'], min: 1000000, max: 1600000, cgpa: 7, desc: 'Work on the internals of cloud database services. C++ or Java plus deep SQL knowledge.' },
  { c: 'Swiggy', t: 'Backend Engineering Intern', loc: 'Bengaluru', type: 'Internship', mode: 'Hybrid', skills: ['Java', 'Spring Boot', 'SQL', 'Kafka / Messaging'], min: 60000, max: 90000, cgpa: 7, desc: 'Six-month internship on order-management microservices. Spring Boot and message queues.' },
  { c: 'TCS', t: 'Backend Developer (Java)', loc: 'Chennai', type: 'Full-time', mode: 'On-site', skills: ['Java', 'Spring Boot', 'SQL'], min: 400000, max: 700000, cgpa: 6, desc: 'Enterprise backend development track. Any engineering branch, minimum CGPA 6.0, up to 1 active backlog tolerated.' },

  // Full-stack
  { c: 'Flipkart', t: 'Full-Stack Developer (MERN)', loc: 'Bengaluru', type: 'Full-time', mode: 'Hybrid', skills: ['React', 'Node.js', 'MongoDB', 'REST APIs'], min: 1100000, max: 1700000, cgpa: 7, desc: 'Own features across the MERN stack from schema to UI. Node.js services and React frontends.' },
  { c: 'Zomato', t: 'Full-Stack Engineer, Restaurant Tools', loc: 'Gurugram', type: 'Full-time', mode: 'Hybrid', skills: ['Python', 'React', 'PostgreSQL', 'Docker'], min: 1300000, max: 2000000, cgpa: 7, desc: 'Build the tools restaurant partners run their business on. Python backend, React frontend.' },
  { c: 'Salesforce', t: 'Associate Technical Consultant (Full-stack)', loc: 'Hyderabad', type: 'Full-time', mode: 'Hybrid', skills: ['JavaScript', 'Java', 'SQL', 'REST APIs'], min: 900000, max: 1400000, cgpa: 7, desc: 'Customer-facing engineering: configure, extend and integrate the Salesforce platform.' },
  { c: 'Paytm', t: 'Full-Stack Trainee', loc: 'Noida', type: 'Internship', mode: 'On-site', skills: ['JavaScript', 'Node.js', 'React', 'SQL'], min: 350000, max: 500000, cgpa: 6.5, desc: 'Six-month traineeship converting to full-time on product teams. JavaScript fundamentals essential.' },

  // Mobile
  { c: 'Swiggy', t: 'Android Engineer (Kotlin)', loc: 'Bengaluru', type: 'Full-time', mode: 'Hybrid', skills: ['Kotlin', 'Android', 'REST APIs'], min: 1400000, max: 2200000, cgpa: 7, desc: 'Craft the rider and customer Android apps. Kotlin, coroutines, offline-first patterns.' },
  { c: 'Zomato', t: 'iOS Engineer (Swift)', loc: 'Gurugram', type: 'Full-time', mode: 'On-site', skills: ['Swift', 'REST APIs', 'CI/CD'], min: 1300000, max: 2000000, cgpa: 7, desc: 'Own order-tracking experiences on iOS. Swift, modular architecture, test discipline.' },
  { c: 'Flipkart', t: 'Flutter Developer', loc: 'Bengaluru', type: 'Contract', mode: 'Remote', skills: ['Flutter', 'Dart', 'REST APIs'], min: 800000, max: 1400000, cgpa: 6.5, desc: 'Twelve-month contract building a seller-facing cross-platform app in Flutter.' },

  // DevOps / SRE / Cloud
  { c: 'Amazon', t: 'Cloud Support Associate (AWS)', loc: 'Hyderabad', type: 'Full-time', mode: 'On-site', skills: ['AWS', 'Linux', 'Networking', 'SQL'], min: 600000, max: 1000000, cgpa: 6.5, desc: 'Troubleshoot customer AWS environments. Linux internals and networking fundamentals. 24x7 rotation.' },
  { c: 'Razorpay', t: 'DevOps Engineer', loc: 'Bengaluru', type: 'Full-time', mode: 'Hybrid', skills: ['Docker', 'Kubernetes', 'CI/CD', 'AWS', 'Linux'], min: 1500000, max: 2400000, cgpa: 7, desc: 'Keep payment infrastructure shipping. Kubernetes, GitOps and observability ownership.' },
  { c: 'Oracle', t: 'Site Reliability Engineer', loc: 'Hyderabad', type: 'Full-time', mode: 'Hybrid', skills: ['Linux', 'Python', 'Docker', 'Kubernetes'], min: 1200000, max: 1900000, cgpa: 7, desc: 'Reliability engineering for cloud control planes. Automation-first incident response.' },

  // Data / Analytics / ML
  { c: 'Flipkart', t: 'Data Analyst', loc: 'Bengaluru', type: 'Full-time', mode: 'On-site', skills: ['SQL', 'Python', 'Excel', 'Power BI / Tableau', 'Statistics'], min: 800000, max: 1400000, cgpa: 7, desc: 'Turn marketplace behaviour into decisions. Heavy SQL, experiment reading and dashboarding.' },
  { c: 'Swiggy', t: 'Data Scientist, Pricing', loc: 'Bengaluru', type: 'Full-time', mode: 'Hybrid', skills: ['Python', 'Machine Learning', 'Statistics', 'SQL'], min: 1800000, max: 3000000, cgpa: 7.5, desc: 'Own pricing and discount models. Causal inference and production ML experience a plus.' },
  { c: 'Google', t: 'Machine Learning Engineer, Search', loc: 'Bengaluru', type: 'Full-time', mode: 'Hybrid', skills: ['Python', 'Machine Learning', 'TensorFlow', 'NLP & LLMs'], min: 2800000, max: 4500000, cgpa: 8, desc: 'Improve ranking quality for a billion users. Deep learning fundamentals and large-scale training.' },
  { c: 'Nvidia', t: 'Deep Learning Software Engineer', loc: 'Pune', type: 'Full-time', mode: 'On-site', skills: ['Python', 'Deep Learning', 'PyTorch', 'C++'], min: 2200000, max: 3800000, cgpa: 8, desc: 'Accelerate model training on GPU architectures. CUDA awareness strongly preferred.' },
  { c: 'Paytm', t: 'Data Engineering Intern', loc: 'Noida', type: 'Internship', mode: 'Hybrid', skills: ['SQL', 'Python', 'Data Analysis'], min: 40000, max: 70000, cgpa: 7, desc: 'Build and maintain pipelines feeding fraud models. SQL fluency non-negotiable.' },
  { c: 'TCS', t: 'Business Intelligence Analyst', loc: 'Mumbai', type: 'Full-time', mode: 'Hybrid', skills: ['SQL', 'Power BI / Tableau', 'Excel', 'Business Analysis'], min: 450000, max: 750000, cgpa: 6, desc: 'Reporting and dashboards for banking clients. Any branch with strong SQL.' },

  // Security / QA
  { c: 'Goldman Sachs', t: 'Cybersecurity Analyst, Threat Intelligence', loc: 'Bengaluru', type: 'Full-time', mode: 'Hybrid', skills: ['Cybersecurity', 'Networking', 'Linux', 'Python'], min: 1200000, max: 2000000, cgpa: 7.5, desc: 'Detect and investigate threats against global banking infrastructure. Security fundamentals and scripting.' },
  { c: 'Razorpay', t: 'Application Security Engineer', loc: 'Bengaluru', type: 'Full-time', mode: 'Hybrid', skills: ['Cybersecurity', 'REST APIs', 'Python', 'Linux'], min: 1600000, max: 2600000, cgpa: 7, desc: 'Secure payment rails: threat modelling, secure code review and dev security coaching.' },
  { c: 'Salesforce', t: 'QA Automation Engineer', loc: 'Hyderabad', type: 'Full-time', mode: 'Hybrid', skills: ['Testing / QA', 'Java', 'Selenium', 'CI/CD'], min: 800000, max: 1300000, cgpa: 6.5, desc: 'Own automated regression for enterprise releases. Java plus Selenium or Playwright.' },
  { c: 'TCS', t: 'Manual Testing Trainee', loc: 'Pune', type: 'Internship', mode: 'On-site', skills: ['Testing / QA', 'Excel', 'Business Analysis'], min: 250000, max: 350000, cgpa: 6, desc: 'Six-month QA traineeship on insurance projects. Attention to detail over tooling knowledge.' },

  // Product / Design / Business
  { c: 'Zomato', t: 'Associate Product Manager', loc: 'Gurugram', type: 'Full-time', mode: 'On-site', skills: ['Product Management', 'SQL', 'Business Analysis', 'Communication'], min: 1600000, max: 2400000, cgpa: 7.5, desc: 'Own a delivery-experience metric end to end. Structured thinking and SQL for self-serve analytics.' },
  { c: 'Swiggy', t: 'Product Designer (UI/UX)', loc: 'Bengaluru', type: 'Full-time', mode: 'Hybrid', skills: ['UI/UX Design', 'Figma', 'Product Design'], min: 1200000, max: 1900000, cgpa: 7, desc: 'Design rider and partner apps. Portfolio of shipped mobile work required.' },
  { c: 'Goldman Sachs', t: 'Summer Analyst, Engineering', loc: 'Bengaluru', type: 'Internship', mode: 'On-site', skills: ['Python', 'SQL', 'Statistics'], min: 100000, max: 150000, cgpa: 8, desc: 'Ten-week summer programme on risk and pricing platforms. Numerical discipline and Python. Minimum CGPA 8.0.', batches: ['2027'] },

  // Hardware / Embedded / Research
  { c: 'Nvidia', t: 'GPU Verification Engineer', loc: 'Pune', type: 'Full-time', mode: 'On-site', skills: ['C++', 'Computer Vision', 'Linux'], min: 1600000, max: 2600000, cgpa: 7.5, desc: 'Verify next-generation GPU IP. C++, SystemVerilog exposure and methodical debug skills.', depts: [ECE, EE, CSE] },
  { c: 'Intel', t: 'Embedded Software Engineer', loc: 'Bengaluru', type: 'Full-time', mode: 'On-site', skills: ['C++', 'Linux', 'Networking', 'Machine Learning'], min: 1100000, max: 1800000, cgpa: 7, desc: 'Firmware for next-gen silicon. C/C++, device drivers and platform bring-up.', depts: [ECE, EE] },
  { c: 'Adobe', t: 'Research Intern, Computer Vision', loc: 'Noida', type: 'Internship', mode: 'Hybrid', skills: ['Python', 'Computer Vision', 'Deep Learning', 'PyTorch'], min: 80000, max: 120000, cgpa: 8, desc: 'Research generative imaging with a published research team. Strong publication-grade coursework expected.', depts: [CSE, ECE] },
  { c: 'Intel', t: 'Hardware Design Intern', loc: 'Bengaluru', type: 'Internship', mode: 'On-site', skills: ['C++', 'Networking', 'Electronics'], min: 50000, max: 80000, cgpa: 7, desc: 'Six-month internship on SoC validation. Digital design coursework required.', depts: [ECE, EE, ME] },
  { c: 'Salesforce', t: 'Technical Support Engineer', loc: 'Hyderabad', type: 'Full-time', mode: 'Remote', skills: ['REST APIs', 'SQL', 'JavaScript', 'Communication'], min: 500000, max: 800000, cgpa: 6, desc: 'Resolve customer integration issues across time zones. API fluency and clear written English.' },

  // Second Microsoft role (recruiter-relevant) + a deliberately closed post
  { c: 'Microsoft', t: 'Software Engineer: Full-stack (Azure)', loc: 'Bengaluru', type: 'Full-time', mode: 'Hybrid', skills: ['C#', 'Azure', 'React', 'REST APIs', 'SQL'], min: 1800000, max: 3000000, cgpa: 7.5, desc: 'Build Azure portal experiences. C#/TypeScript and cloud-native patterns. Minimum CGPA 7.5.' },
  { c: 'Infosys', t: 'Systems Engineer (Legacy: closing soon)', loc: 'Pune', type: 'Full-time', mode: 'On-site', skills: ['Java', 'SQL'], min: 400000, max: 600000, cgpa: 6.5, desc: 'Final intake for the 2026 batch enterprise track. Any engineering branch.' }
];

// Recruiter-owned posts (My job posts tab): mixed statuses.
const RECRUITER_POSTS = [
  { title: 'Microsoft: SDE Intern 2027 (Backend)', desc: 'Eight-week backend internship on Azure services. Python or C#, strong data structures. Minimum CGPA 7.5, no active backlogs.', skills: ['Python', 'C#', 'SQL', 'REST APIs'], min: 100000, max: 150000, submit: true },
  { title: 'Microsoft: Applied Scientist, NLP', desc: 'Work on production language models for Office intelligence. Deep learning fundamentals and PyTorch required. Minimum CGPA 8.0.', skills: ['Python', 'NLP & LLMs', 'PyTorch', 'Machine Learning'], min: 2500000, max: 4000000, submit: true },
  { title: 'Microsoft: Program Manager, Developer Tools', desc: 'Own developer experience metrics for Visual Studio. Structured thinking and communication.', skills: ['Product Management', 'Communication', 'SQL'], min: 1800000, max: 2600000, submit: false },
  { title: 'Microsoft: Support Engineer (Azure) - draft', desc: 'Customer-facing Azure support rotation. API and networking fluency.', skills: ['Azure', 'REST APIs', 'Linux'], min: 600000, max: 900000, submit: false }
];

async function main() {
  console.log(`Seeding recruiter demo against ${BASE}...`);
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'e2eadmin@kiit.ac.in';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Recruit#2026';
  await call('POST', '/api/auth/login', { email: adminEmail, password: adminPassword });
  console.log('Signed in as admin.');

  // ---------------------------------------------------------------- companies
  const allCompanies = (await call('GET', '/api/admin/companies')).companies;
  const companies = new Map(allCompanies.map(company => [company.name.toLowerCase(), company]));
  for (const company of NEW_COMPANIES) {
    const key = company.name.toLowerCase();
    if (!companies.has(key)) {
      const created = (await call('POST', '/api/admin/companies', company)).company;
      companies.set(key, created);
    }
  }
  console.log(`Companies available: ${companies.size}`);

  // ---------------------------------------------------------------- job catalog
  const existingTitles = new Set(((await call('GET', '/api/admin/job-posts')).jobPosts || []).map(job => `${job.companyName}|${job.title}`));
  let published = 0, drafts = 0, closed = 0, skipped = 0;
  for (const job of CATALOG) {
    const company = companies.get(job.c.toLowerCase());
    if (!company) { skipped++; continue; }
    if (existingTitles.has(`${job.c}|${job.t}`)) { skipped++; continue; }
    const created = (await call('POST', '/api/admin/job-posts', {
      companyId: company.id, title: job.t, description: job.desc, location: job.loc,
      employmentType: job.type, workMode: job.mode, requiredSkills: job.skills,
      salaryMin: job.min, salaryMax: job.max, salaryCurrency: 'INR',
      eligibility: {
        minCgpa: job.cgpa ?? null, allowedDepartments: job.depts || ANY,
        allowedBatches: job.batches || [], maxActiveBacklogs: job.backlogs ?? 0
      }
    })).jobPost;
    if (job.t.includes('closing soon')) {
      await call('POST', `/api/admin/job-posts/${created.id}/publish`);
      await call('POST', `/api/admin/job-posts/${created.id}/unpublish`);
      closed++;
    } else if (job.t.includes('Legacy')) {
      drafts++; // stays draft: shows the pre-publish state in admin lists
    } else {
      await call('POST', `/api/admin/job-posts/${created.id}/publish`);
      published++;
    }
  }
  console.log(`Catalog: ${published} published, ${drafts} draft, ${closed} closed, ${skipped} skipped (already present)`);

  // ---------------------------------------------------------------- recruiter + engagement
  const users = (await call('GET', '/api/admin/users')).users;
  const recruiter = users.find(user => user.role === 'recruiter' && (user.email.includes('microsoft') || (user.fullName || '').toLowerCase().includes('microsoft')));
  if (!recruiter) throw new Error('Microsoft recruiter account not found. Run seed-demo.js first.');
  const microsoft = companies.get('microsoft');
  const engagements = (await call('GET', '/api/admin/recruitment/engagements')).engagements.filter(item => item.companyId === microsoft.id);
  const engagement = engagements[0];
  if (!engagement) throw new Error('No Microsoft engagement found. Run seed-demo.js first.');
  console.log(`Recruiter: ${recruiter.email} | engagement: ${engagement.title} (${engagement.status})`);

  // Advance the engagement: university note -> recruiter accepts -> admin confirms.
  const adminCookie = cookie;
  if (['proposed', 'under_discussion', 'reschedule_requested'].includes(engagement.status)) {
    cookie = '';
    await call('POST', '/api/auth/login', { email: recruiter.email, password: 'Recruiter#2026' });
    await call('POST', `/api/recruiter/recruitment/engagements/${engagement.id}/messages`, { body: 'Thank you for the detailed statistics. The backend pool looks strong; we would like to proceed with the proposed window.' });
    await call('POST', `/api/recruiter/recruitment/engagements/${engagement.id}/respond`, { response: 'accepted', message: 'Proposal accepted. Locking in the proposed window for on-campus rounds.' });
    cookie = adminCookie;
    await call('POST', `/api/admin/recruitment/engagements/${engagement.id}/status`, { status: 'confirmed', message: 'Recruitment window confirmed by the placement team. Interview slots will be shared shortly.' });
    console.log('Engagement advanced to CONFIRMED with two-way messages.');
  }

  // ---------------------------------------------------------------- candidate shares + feedback
  const studentPool = users.filter(user => user.role === 'student' && user.email.endsWith('@kiit.ac.in')).slice(0, 3);
  const ACCESS_LEVELS = ['profile', 'resume', 'full'];
  const FEEDBACK = [
    { response: 'shortlisted', note: 'Strong backend fundamentals. Moving to technical round.' },
    { response: 'interview_requested', note: 'Please schedule a system-design interview next week.' },
    { response: 'interested', note: 'Good profile; awaiting internal headcount confirmation.' }
  ];
  const createdShares = [];
  for (let index = 0; index < studentPool.length; index += 1) {
    const student = studentPool[index];
    const existing = (await call('GET', `/api/admin/recruitment/shares?engagementId=${engagement.id}`)).shares
      .find(share => share.studentId === student.id && share.status !== 'revoked');
    if (existing) { createdShares.push(existing); continue; }
    const share = (await call('POST', '/api/admin/recruitment/shares', {
      engagementId: engagement.id, studentId: student.id, accessLevel: ACCESS_LEVELS[index % ACCESS_LEVELS.length]
    })).share;
    createdShares.push(share);
    console.log(`Shared ${student.fullName} (access: ${share.accessLevel})`);
  }
  // Company opens each share (logged access) and records feedback.
  cookie = '';
  await call('POST', '/api/auth/login', { email: recruiter.email, password: 'Recruiter#2026' });
  for (let index = 0; index < createdShares.length; index += 1) {
    const share = createdShares[index];
    await call('GET', `/api/recruiter/recruitment/shared-candidates/${share.id}`).catch(() => {});
    const feedback = FEEDBACK[index % FEEDBACK.length];
    await call('POST', `/api/recruiter/recruitment/shared-candidates/${share.id}/feedback`, {
      response: feedback.response, note: feedback.note
    }).catch(error => console.log(`feedback skipped: ${error.message}`));
  }
  cookie = adminCookie;
  console.log(`Candidate shares: ${createdShares.length} shared, viewed and given company feedback.`);

  // ---------------------------------------------------------------- recruiter job posts
  cookie = '';
  await call('POST', '/api/auth/login', { email: recruiter.email, password: 'Recruiter#2026' });
  for (const post of RECRUITER_POSTS) {
    try {
      const created = (await call('POST', '/api/recruiter/jobs', {
        companyId: microsoft.id, title: post.title, description: post.desc,
        employmentType: post.title.includes('Intern') ? 'Internship' : 'Full-time',
        location: 'Hyderabad', workMode: 'Hybrid', requiredSkills: post.skills,
        salaryMin: post.min, salaryMax: post.max, salaryCurrency: 'INR',
        eligibility: { minCgpa: 7.5, allowedDepartments: [], allowedBatches: [], maxActiveBacklogs: 0 },
        submit: post.submit
      })).jobPost;
      console.log(`Recruiter post: ${post.title} -> ${created.status}`);
    } catch (error) {
      console.log(`Recruiter post skipped (${post.title}): ${error.message}`);
    }
  }
  // Admin approves + publishes the submitted ones so the recruiter sees "live" posts too.
  cookie = adminCookie;
  const pending = (await call('GET', '/api/admin/job-posts?status=pending_approval')).jobPosts || [];
  for (const job of pending) {
    if (job.companyName !== 'Microsoft') continue;
    await call('POST', `/api/admin/job-posts/${job.id}/review`, { decision: 'approve', note: 'Approved after recruiter demo submission.' });
    await call('POST', `/api/admin/job-posts/${job.id}/publish`);
    console.log(`Approved + published recruiter post: ${job.title}`);
  }

  // ---------------------------------------------------------------- multi-year hire history
  await backdateHistory(microsoft.id, recruiter.id, studentPool, engagement);

  await call('POST', '/api/admin/recruitment/recommendations/refresh');
  console.log('\nRecruiter demo seed complete. Sign in as the Microsoft recruiter to view:');
  console.log('  /recruiter/recruitment - history banner (hires per year), confirmed engagement,');
  console.log('    two-way messages, shared candidates with feedback');
  console.log('  /recruiter/jobs - own posts in draft / pending / published statuses');
  process.exit(0);
}

/**
 * Backdate hire history so the recruiter's "your history with this campus"
 * banner shows real per-year bars. Uses direct MySQL writes (api/.env creds);
 * skips gracefully when the DB is not reachable.
 */
async function backdateHistory(companyId, recruiterId, students, engagement) {
  const mysql = require('mysql2/promise');
  if (!process.env.DB_HOST || !students.length) {
    console.log('History backdating skipped (no DB config or no students).');
    return;
  }
  const pool = mysql.createPool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, connectionLimit: 2 });
  try {
    // The share rows created just now get real feedback; spread their dates
    // across the current year so this year's bar reflects the live engagement.
    const [fresh] = await pool.execute(
      'SELECT id FROM recruitment_shares WHERE company_id=? AND responded_at IS NOT NULL ORDER BY created_at DESC LIMIT 3',
      [companyId]
    );
    const monthAgo = dateShift(-30), twoMonthsAgo = dateShift(-60), quarterAgo = dateShift(-90);
    const freshDates = [monthAgo, twoMonthsAgo, quarterAgo];
    for (let index = 0; index < fresh.length; index += 1) {
      await pool.execute('UPDATE recruitment_shares SET created_at=?, updated_at=?, responded_at=? WHERE id=?',
        [new Date(freshDates[index]), new Date(freshDates[index]), new Date(freshDates[index]), fresh[index].id]);
    }

    // Bulk insert historical hires: 24 last year, 14 the year before.
    const [allStudents] = await pool.execute("SELECT id FROM students WHERE is_recruiter=FALSE AND is_admin=FALSE LIMIT 200");
    const ids = allStudents.map(row => row.id);
    if (!ids.length) return;
    const pick = i => ids[i % ids.length];
    const now = new Date();
    const rows = [];
    for (let i = 0; i < 24; i += 1) rows.push(hireRow(companyId, recruiterId, pick(i), now.getFullYear() - 1, i));
    for (let i = 0; i < 14; i += 1) rows.push(hireRow(companyId, recruiterId, pick(i + 40), now.getFullYear() - 2, i));
    for (const row of rows) {
      await pool.execute(
        `INSERT INTO recruitment_shares (id,engagement_id,company_id,recruiter_id,student_id,access_level,shared_by,policy_mode,status,company_response,company_response_note,responded_at,created_at,updated_at,access_count)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [row.id, null, companyId, recruiterId, row.studentId, 'summary', row.sharedBy, 'university_controlled', 'feedback', 'shortlisted', 'Historical campus hire (demo data)', row.date, row.date, row.date, 1]
      );
    }
    // A completed past engagement adds "drives completed" to the history.
    const pastDate = new Date(now.getFullYear() - 1, 5, 10);
    const pastEnd = new Date(pastDate.getTime() + 5 * 86400000);
    await pool.execute(
      `INSERT INTO recruitment_engagements (id,company_id,title,status,roles,job_description,proposed_start,proposed_end,confirmed_start,confirmed_end,provisional,proposal_note,created_by,pipeline_stage,final_outcome,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [`re_hist_${Date.now()}`, companyId, 'Microsoft campus drive (previous year)', 'completed', JSON.stringify(['Software Development Engineer']), 'Historical drive record seeded for demo history.', pastDate, pastEnd, pastDate, pastEnd, 0, 'Historical drive.', 'system', 'outcome', 'completed: 24 offers extended', pastDate, pastDate]
    );
    console.log(`History backdated: 3 recent shares spread across this year, ${rows.length} historical hires, 1 completed past drive.`);
  } catch (error) {
    console.log(`History backdating skipped: ${error.message}`);
  } finally {
    await pool.end().catch(() => {});
  }
}

function hireRow(companyId, recruiterId, studentId, year, index) {
  const date = new Date(year, 7 + (index % 4), 5 + (index % 20));
  return { id: `rcs_hist_${year}_${index}_${Date.now()}`, studentId, sharedBy: 'system', date };
}

function dateShift(days) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

main().catch(error => { console.error('SEED FAILED:', error.message); process.exit(1); });
