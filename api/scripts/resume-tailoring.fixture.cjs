// Shared synthetic profile and isolated service loader. Never loads application .env or stores.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const jd = 'Java backend developer: Java, Spring Boot, RESTful APIs, MySQL, PostgreSQL, SQL, Git, GitHub, AWS, Docker, Maven, Postman, OOP, DSA, DBMS, Operating Systems, Computer Networks, JWT, testing and debugging.';
const student = {
  personal: { fullName: 'Resume Engine Test', email: 'resume@example.test', phone: '9000000000', city: 'Bengaluru', headline: 'Computer Science Undergraduate' },
  academic: { department: 'Computer Science & Engineering', degreeProgram: 'B.Tech', batchYear: '2023 - 2027', cgpa: 8.28, tenthSchool: 'Example School', tenthBoard: 'CBSE', tenthYear: 2020, tenthPercentage: 87, twelfthSchool: 'Example School', twelfthBoard: 'CBSE', twelfthYear: 2022, twelfthPercentage: 75 },
  social: { linkedin: 'https://linkedin.com/in/example', portfolio: 'https://example.test' },
  projects: [
    { projectName: 'Design Portfolio', technologies: ['React', 'JavaScript'], contributions: ['Created portfolio pages and project showcases.'] },
    { projectName: 'SnackIt', technologies: ['Java', 'JavaScript', 'Node.js', 'Express.js', 'MySQL'], projectUrl: 'https://snackit.example.test', repoUrl: 'https://github.com/example/snackit', contributions: ['Built a full-stack shopping platform with product catalog, cart, and checkout functionality.', 'Developed APIs for orders and inventory management.'], startDate: '2025-08-01', endDate: '2025-09-30' },
    { projectName: 'JobAssist AI', technologies: ['React', 'FastAPI', 'PostgreSQL', 'JWT', 'Cloudflare R2', 'Neon', 'Resend', 'Vercel', 'Render'], contributions: ['Implemented resume matching, authentication, rate limiting, and modular backend services.', 'Configured GitHub Actions for CI/CD and cloud deployment.'] },
    { projectName: 'Market Charts', technologies: ['Python', 'Flask', 'Chart.js'], contributions: ['Built interactive charts and historical market analysis.'] },
  ],
  internships: [
    { role: 'SWE Intern', companyName: 'Example Engineering', skills: ['Java', 'Spring Boot', 'REST API', 'MySQL', 'Git', 'GitHub', 'Docker', 'AWS'], responsibilities: ['Developed and maintained REST APIs using Java and Spring Boot.', 'Designed and integrated MySQL database operations.', 'Implemented authentication and authorization features.'], startDate: '2026-08-01', currentlyWorking: true, location: 'Bengaluru' },
    { role: 'Data Analyst Intern', companyName: 'Example Analytics', skills: ['Python', 'SQL', 'Microsoft Excel', 'Power BI', 'Tableau', 'Pandas'], responsibilities: ['Analyzed business datasets using SQL and Python.', 'Prepared data quality checks and reports.'], startDate: '2026-05-01', endDate: '2026-07-31', location: 'Pune' },
  ],
  interests: { skills: ['Java', 'JavaScript', 'SQL'] },
  achievements: [
    { title: 'AWS Certified Cloud Practitioner', category: 'certification', year: 2026 },
    { title: 'Campus Hackathon Finalist', year: 2025, description: 'Built an attendance and seat allocation application for campus examinations.' },
    { title: 'Academic Excellence Award', year: 2024, description: 'Recognized for a 10.0 SGPA in the first semester.' },
    { title: 'Technical Society Coordinator', category: 'leadership', year: 2024, description: 'Coordinated workshops and peer mentoring for 120 students.' },
  ],
};
function loadService({ config = {}, fetch, profile = student, timers = { setTimeout, clearTimeout } } = {}) {
  const filename = path.resolve(__dirname, '../src/modules/resumes/tailorResume.service.js');
  const instance = new Module(filename, module); instance.filename = filename; instance.paths = Module._nodeModulePaths(path.dirname(filename));
  const realRequire = Module.createRequire(filename);
  instance.require = name => {
    if (name === '../../config') return config;
    if (name === '../students/studentStore') return { getStudentById: async () => structuredClone(profile) };
    if (name === './resumeStore') return { list: async () => [] };
    if (name === '__fixture_fetch') return fetch || (() => { throw new Error('Unexpected model request'); });
    if (name === '__fixture_timers') return timers;
    return realRequire(name);
  };
  instance._compile('const fetch = require("__fixture_fetch"); const {setTimeout,clearTimeout} = require("__fixture_timers"); const process = {env:{}}; const console = {log(){},warn(){}};\n' + fs.readFileSync(filename, 'utf8'), filename);
  return instance.exports;
}


module.exports = { student, jd, loadService };
