const config = require('../../config');
const studentStore = require('../students/studentStore');
const resumeStore = require('./resumeStore');
const policy = require('./tailoringPolicy');

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function validTailoringResult(result) {
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  if (!object(result) || !object(result.resume)) return false;
  const resume = result.resume;
  if (['personal', 'summary', 'skills'].some(field => resume[field] != null && !object(resume[field]))) return false;
  if (resume.summary?.text != null && typeof resume.summary.text !== 'string') return false;
  return ['projects', 'experience', 'education', 'certifications', 'achievements', 'leadership'].every(field =>
    resume[field] == null || (Array.isArray(resume[field]) && resume[field].every(entry => object(entry)
      && (entry.bullets == null || (Array.isArray(entry.bullets) && entry.bullets.every(bullet => typeof bullet === 'string'))))));
}

function cleanJsonText(raw) {
  if (!raw) return '';
  let str = String(raw).trim();
  if (str.startsWith('```json')) {
    str = str.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (str.startsWith('```')) {
    str = str.replace(/^```\s*/i, '').replace(/\s*```$/, '');
  }
  return str.trim();
}

/**
 * Format raw date strings into standard resume month-year strings (e.g., "May 2026")
 */
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
  // Match DD-MM-YYYY or MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const month = parseInt(dmyMatch[1], 10);
    const year = dmyMatch[2];
    if (month >= 1 && month <= 12) {
      return `${MONTH_NAMES[month - 1]} ${year}`;
    }
  }
  // If only a 4 digit year
  if (/^\d{4}$/.test(str)) return str;
  return str;
}

/**
 * Clean and format date ranges (e.g., "2026-05-01 – 2026-07-31" -> "May 2026 – Jul 2026")
 */
function formatDateRange(startDate, endDate, currentlyWorking) {
  const start = formatMonthYear(startDate);
  if (currentlyWorking || /present|current/i.test(String(endDate || ''))) {
    return start ? `${start} – Present` : 'Present';
  }
  const end = formatMonthYear(endDate);
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  if (end) return end;
  return '';
}

/**
 * Normalizes any date string (ISO ranges, slashes, or dashes) into clean resume standard
 */
function normalizeDateStr(dateStr) {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  // Match range like "2026-05-01 – 2026-07-31" or "2026-05-01 to 2026-07-31" or "2026-05-01 - 2026-07-31"
  const rangeMatch = str.match(/^(\d{4}[-/]\d{1,2}(?:[-/]\d{1,2})?)\s*(?:[-–—]|to)\s*(.*)$/i);
  if (rangeMatch) {
    const start = formatMonthYear(rangeMatch[1]);
    const isPresent = /present|current/i.test(rangeMatch[2]);
    const end = isPresent ? 'Present' : formatMonthYear(rangeMatch[2]);
    return start && end ? `${start} – ${end}` : (start || end || str);
  }
  return formatMonthYear(str);
}

/**
 * Softens unearned or inflated buzzwords to grounded, interview-defensible engineering terms.
 */
function softenBuzzwords(text) {
  if (!text) return '';
  return String(text)
    .replace(/\b(?:hyper-scalable|ultra-scalable)\b/gi, 'modular')
    .replace(/\bscalable\b/gi, 'well-structured')
    .replace(/\b(?:high-performance|high performance)\b/gi, 'efficient')
    .replace(/\bproduction-grade\b/gi, 'robust')
    .replace(/\bcutting-edge\b/gi, 'modern')
    .replace(/\bstate-of-the-art\b/gi, 'contemporary')
    .replace(/\bworld-class\b/gi, 'comprehensive')
    .replace(/\bmission-critical\b/gi, 'core')
    .replace(/\bultra-low latency\b/gi, 'low latency')
    .replace(/\bblazing-fast\b/gi, 'responsive')
    .replace(/\bseamlessly\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Strips invented numeric metrics unless supported by verified candidate data.
 */
function sanitizeBulletMetrics(bullet, origHasMetrics) {
  if (!bullet) return '';
  if (origHasMetrics) return bullet;
  return String(bullet)
    .replace(/\bby\s+\d{1,3}%\s+(?:increase|reduction|improvement|speedup|boost)\b/gi, '')
    .replace(/\b(?:with|achieving)\s+sub-\d+ms\s+(?:latency|response\s+times?)\b/gi, 'with low latency')
    .replace(/\bhandling\s+\d+[\d,]*\+?\s+(?:concurrent\s+users|daily\s+active\s+users|requests\s+per\s+second)\b/gi, 'handling concurrent requests')
    .replace(/\b(?:improved|reduced|increased)\s+(?:efficiency|speed|performance)\s+by\s+\d{1,3}%\b/gi, 'improved execution efficiency')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Ensures bullet text is complete, professional, and never truncated mid-word or mid-sentence.
 */
function keepCompleteSentence(bullet) {
  if (!bullet) return '';
  const str = String(bullet).trim();
  // If the text contains multiple sentences and is exceptionally long, keep complete full sentences
  const sentenceMatches = str.match(/[^.!?]+[.!?]+(?:\s|$)/g);
  if (sentenceMatches && sentenceMatches.length > 1 && str.length > 200) {
    let accumulated = '';
    for (const s of sentenceMatches) {
      if ((accumulated + s).length <= 220) {
        accumulated += s;
      } else {
        break;
      }
    }
    if (accumulated.trim()) {
      return accumulated.trim();
    }
    return sentenceMatches[0].trim();
  }
  // Never slice arbitrarily! Preserve the complete bullet text.
  return str.endsWith('.') ? str : `${str}.`;
}

function trimBulletLength(bullet) {
  return keepCompleteSentence(bullet);
}

/**
 * Extracts and organizes all verified profile data into a structured context for LLM.
 * Sourced directly from student profile (and existing primary resume if available) as Single Source of Truth.
 */
function extractProfileContext(student, existingResumes = []) {
  const p = student.personal || {};
  const a = student.academic || {};
  const s = student.social || {};

  // Candidate Full Name: Strictly prioritize real name, never use 'Candidate'
  // Generated tailoring is an output, never fresh evidence for another tailoring run.
  const sourceResumes = (existingResumes || []).filter(resume => !resume.extractedData?.tailoredMeta && !resume.analysis?.tailoredMeta);
  const sourceResume = sourceResumes.find(resume => resume.isDefault) || sourceResumes[0];
  const primaryResumeData = sourceResume?.extractedData || {};
  const fullName = p.fullName
    || [p.firstName, p.lastName].filter(Boolean).join(' ')
    || p.name
    || student.name
    || primaryResumeData.personal?.fullName
    || 'Student';

  const email = p.email || student.email || primaryResumeData.personal?.email || '';
  const phone = p.phone || primaryResumeData.personal?.phone || '';
  const location = [p.city, p.state, p.country].filter(Boolean).join(', ')
    || p.location
    || primaryResumeData.personal?.location
    || 'Bhubaneswar, India';

  const headline = p.headline
    || primaryResumeData.personal?.headline
    || (a.degreeProgram ? `${a.degreeProgram} Student` : 'Software Engineering Student');

  // Candidate profile links
  const links = [];
  if (s.linkedin) links.push(s.linkedin);
  if (s.github) links.push(s.github);
  if (s.portfolio) links.push(s.portfolio);
  if (s.leetcode) links.push(s.leetcode);
  if (s.codeforces) links.push(s.codeforces);
  if (s.hackerrank) links.push(s.hackerrank);
  if (Array.isArray(s.links)) {
    s.links.forEach(l => {
      const url = typeof l === 'string' ? l : l?.url;
      if (url && !links.includes(url)) links.push(url);
    });
  }
  if (Array.isArray(primaryResumeData.personal?.links)) {
    primaryResumeData.personal.links.forEach(l => {
      if (l && !links.includes(l)) links.push(l);
    });
  }

  // Academic / Education: Full factual verification (College + Class XII + Class X)
  const education = [];

  // 1. College / University - Specifically hardcoded for KIIT students as requested
  const degree = a.degreeProgram || 'B.Tech';
  const dept = a.department || 'Computer Science & Engineering';
  const mainDegreeTitle = a.degreeProgram && a.department
    ? `${a.degreeProgram} in ${a.department}`
    : (a.degreeProgram || a.department || 'B.Tech in Computer Science & Engineering');

  const collegeInst = 'Kalinga Institute of Industrial Technology (KIIT)';

  const collegeDates = a.batchYear
    ? a.batchYear
    : a.graduationYear
      ? (a.startYear ? `${a.startYear} – ${a.graduationYear}` : `Class of ${a.graduationYear}`)
      : (primaryResumeData.education?.[0]?.dates || '2023 – 2027');

  const cgpaText = a.cgpa
    ? `CGPA: ${a.cgpa} / 10.0`
    : a.percentage
      ? `${a.percentage}%`
      : (primaryResumeData.education?.[0]?.description || '');

  education.push({
    id: 'edu_college',
    title: collegeInst,
    institution: collegeInst,
    company: collegeInst,
    degreeProgram: mainDegreeTitle,
    degree: mainDegreeTitle,
    dates: normalizeDateStr(collegeDates),
    description: cgpaText,
    location: 'Bhubaneswar, India',
    bullets: []
  });

  // 2. Class XII / Senior Secondary
  if (a.twelfthPercentage || a.twelfthSchool || a.twelfthBoard) {
    const school = a.twelfthSchool ? String(a.twelfthSchool).trim() : '';
    const board = a.twelfthBoard ? String(a.twelfthBoard).trim() : '';
    const inst = school && board ? `${school} (${board})` : (school || board || 'Senior Secondary School');

    const details = [];
    if (a.twelfthPercentage) {
      const pct = String(a.twelfthPercentage).trim();
      details.push(pct.endsWith('%') ? pct : `${pct}%`);
    }
    if (a.twelfthStream) {
      const stream = String(a.twelfthStream).trim();
      details.push(stream.replace(/^Stream:\s*/i, ''));
    }

    education.push({
      id: 'edu_twelfth',
      title: inst,
      institution: inst,
      company: inst,
      degreeProgram: 'Class XII (Senior Secondary)',
      degree: 'Class XII (Senior Secondary)',
      dates: a.twelfthYear ? String(a.twelfthYear).trim() : '',
      description: details.join(' · '),
      location: '',
      bullets: []
    });
  }

  // 3. Class X / Secondary
  if (a.tenthPercentage || a.tenthSchool || a.tenthBoard) {
    const school = a.tenthSchool ? String(a.tenthSchool).trim() : '';
    const board = a.tenthBoard ? String(a.tenthBoard).trim() : '';
    const inst = school && board ? `${school} (${board})` : (school || board || 'Secondary School');

    const details = [];
    if (a.tenthPercentage) {
      const pct = String(a.tenthPercentage).trim();
      details.push(pct.endsWith('%') ? pct : `${pct}%`);
    }

    education.push({
      id: 'edu_tenth',
      title: inst,
      institution: inst,
      company: inst,
      degreeProgram: 'Class X (Secondary)',
      degree: 'Class X (Secondary)',
      dates: a.tenthYear ? String(a.tenthYear).trim() : '',
      description: details.join(' · '),
      location: '',
      bullets: []
    });
  }

  // 4. Any academic history or existing resume education
  if (Array.isArray(a.history) && a.history.length > 0) {
    a.history.forEach(h => {
      const inst = h.institution || h.school || h.college || '';
      if (inst && !education.some(e => e.institution.toLowerCase() === inst.toLowerCase())) {
        education.push({
          id: `edu_hist_${education.length}`,
          title: inst,
          institution: inst,
          company: inst,
          degreeProgram: h.degree || h.title || 'Education',
          degree: h.degree || h.title || 'Education',
          dates: normalizeDateStr(h.year || h.dates || ''),
          description: h.score || h.grade || '',
          location: h.location || '',
          bullets: []
        });
      }
    });
  } else if (education.length === 1 && Array.isArray(primaryResumeData.education)) {
    primaryResumeData.education.forEach((pe, idx) => {
      if (idx > 0 && pe.institution && !education.some(e => e.institution.toLowerCase() === pe.institution.toLowerCase())) {
        education.push({
          id: `edu_prev_${idx}`,
          title: pe.institution,
          institution: pe.institution,
          company: pe.institution,
          degreeProgram: pe.title || pe.degree || 'Education',
          degree: pe.title || pe.degree || 'Education',
          dates: normalizeDateStr(pe.dates || ''),
          description: pe.description || '',
          location: pe.location || '',
          bullets: pe.bullets || []
        });
      }
    });
  }

  // Internships / Work Experience
  const internshipsSource = (Array.isArray(student.internships) && student.internships.length > 0)
    ? student.internships
    : (Array.isArray(primaryResumeData.experience) ? primaryResumeData.experience : []);

  const experience = internshipsSource.map((exp, i) => {
    const dates = exp.dates
      ? normalizeDateStr(exp.dates)
      : formatDateRange(exp.startDate, exp.endDate, exp.currentlyWorking);

    const bullets = Array.isArray(exp.responsibilities) && exp.responsibilities.length > 0
      ? exp.responsibilities
      : (Array.isArray(exp.bullets) && exp.bullets.length > 0 ? exp.bullets : (exp.description ? [exp.description] : []));

    return {
      id: `exp_profile_${i}`,
      title: exp.role || exp.title || 'Software Engineering Intern',
      company: exp.companyName || exp.company || 'Company',
      dates: dates || '',
      location: exp.location || '',
      description: '',
      bullets: bullets.filter(Boolean),
      skills: Array.isArray(exp.skills) ? exp.skills : []
    };
  });

  // Projects - Ensure every project extracts verified Live Demo and GitHub Repo links
  const projectsSource = (Array.isArray(student.projects) && student.projects.length > 0)
    ? student.projects
    : (Array.isArray(primaryResumeData.projects) ? primaryResumeData.projects : []);

  const projects = projectsSource.map((prj, i) => {
    const dates = prj.dates
      ? normalizeDateStr(prj.dates)
      : formatDateRange(prj.startDate, prj.endDate, false);

    const bullets = Array.isArray(prj.contributions) && prj.contributions.length > 0
      ? prj.contributions
      : (Array.isArray(prj.bullets) && prj.bullets.length > 0 ? prj.bullets : (prj.description ? [prj.description] : []));

    const techStack = policy.technologyStack(prj.technologies);
    const techList = techStack.list;

    // Comprehensive extraction of live demo and repository links from candidate source data
    let liveUrl = prj.projectUrl || prj.liveUrl || prj.deployedUrl || prj.demoUrl || prj.website || prj.url || '';
    let repoUrl = prj.repoUrl || prj.githubUrl || prj.github || '';

    // If liveUrl points to a git host, shift to repoUrl
    if (liveUrl && /github\.com|gitlab\.com|bitbucket\.org/i.test(liveUrl)) {
      if (!repoUrl) repoUrl = liveUrl;
      liveUrl = '';
    }
    // If repoUrl does not point to a git host and liveUrl is empty, shift to liveUrl
    if (repoUrl && !/github\.com|gitlab\.com|bitbucket\.org/i.test(repoUrl)) {
      if (!liveUrl) liveUrl = repoUrl;
      repoUrl = '';
    }
    // Check links array if either is missing
    if ((!liveUrl || !repoUrl) && Array.isArray(prj.links)) {
      for (const l of prj.links) {
        const u = typeof l === 'string' ? l : l?.url || '';
        if (!u) continue;
        if (/github\.com|gitlab\.com|bitbucket\.org/i.test(u)) {
          if (!repoUrl) repoUrl = u;
        } else {
          if (!liveUrl) liveUrl = u;
        }
      }
    }

    return {
      id: `prj_profile_${i}`,
      title: prj.projectName || prj.title || `Project ${i + 1}`,
      dates: dates || '',
      technologies: techStack.text,
      technologiesList: techList,
      liveUrl,
      projectUrl: liveUrl,
      repoUrl,
      githubUrl: repoUrl,
      description: '',
      bullets: bullets.filter(Boolean)
    };
  });

  // Skills: Compile verified inventory
  const directSkills = Array.isArray(student.interests?.skills) ? student.interests.skills : [];
  const projectSkills = projects.flatMap(p => Array.isArray(p.technologiesList) ? p.technologiesList : []);
  const internshipSkills = experience.flatMap(exp => Array.isArray(exp.skills) ? exp.skills : []);
  const primaryResumeSkills = Object.values(primaryResumeData.skills || {}).flatMap(list => Array.isArray(list) ? list : []);
  const rawSkills = policy.technologyStack([...directSkills, ...projectSkills, ...internshipSkills, ...primaryResumeSkills]).list;

  // Achievements, Certifications & Leadership - Cleanly separate and extract verified records
  const rawAchievements = (Array.isArray(student.achievements) && student.achievements.length > 0)
    ? student.achievements
    : (Array.isArray(primaryResumeData.achievements) ? primaryResumeData.achievements : []);

  const achievements = [];
  const certifications = (Array.isArray(primaryResumeData.certifications) ? [...primaryResumeData.certifications] : []);
  const leadership = (Array.isArray(primaryResumeData.leadership) ? [...primaryResumeData.leadership] : []);

  rawAchievements.forEach((ach, idx) => {
    const title = ach.title || ach.name || 'Achievement';
    const dates = normalizeDateStr(ach.date || ach.year || '');
    const desc = ach.description || ach.details || '';
    const category = String(ach.category || '').toLowerCase();

    if (category.includes('certif') || category.includes('license') || category.includes('course') || /certified|certificate/i.test(title)) {
      if (!certifications.some(c => (c.title || c.name || '').toLowerCase() === title.toLowerCase())) {
        certifications.push({
          id: `cert_${idx}`,
          title,
          issuer: ach.issuer || ach.organization || '',
          dates,
          description: desc
        });
      }
    } else if (
      category.includes('leader') || category.includes('club') || category.includes('volunteer') ||
      category.includes('society') || category.includes('head') || category.includes('coordinator') ||
      category.includes('position') || category.includes('responsib') || category.includes('extracurricular') ||
      category.includes('activity') || /lead|coordinator|head|president|vice|secretary|treasurer|volunteer/i.test(title)
    ) {
      if (!leadership.some(l => (l.title || l.role || l.name || '').toLowerCase() === title.toLowerCase())) {
        leadership.push({
          id: `lead_${idx}`,
          title,
          role: title,
          company: ach.organization || ach.club || '',
          institution: ach.organization || ach.club || '',
          dates,
          description: desc
        });
      }
    } else {
      achievements.push({
        id: `ach_${idx}`,
        title,
        dates,
        description: desc
      });
    }
  });

  // Extract explicit positions of responsibility or extracurriculars if present on student model
  const extraPositions = [
    ...(Array.isArray(student.positionsOfResponsibility) ? student.positionsOfResponsibility : []),
    ...(Array.isArray(student.extracurriculars) ? student.extracurriculars : []),
    ...(Array.isArray(student.activities) ? student.activities : [])
  ];
  extraPositions.forEach((pos, idx) => {
    const title = pos.title || pos.role || pos.name || 'Position of Responsibility';
    if (!leadership.some(l => (l.title || l.role || l.name || '').toLowerCase() === title.toLowerCase())) {
      leadership.push({
        id: `lead_pos_${idx}`,
        title,
        role: pos.role || title,
        company: pos.organization || pos.club || pos.institution || '',
        institution: pos.organization || pos.club || '',
        dates: normalizeDateStr(pos.dates || pos.year || ''),
        description: pos.description || ''
      });
    }
  });

  return {
    fullName,
    email,
    phone,
    location,
    headline,
    links,
    linkedin: s.linkedin || links.find(l => /linkedin\.com/i.test(l)) || '',
    github: s.github || links.find(l => /github\.com/i.test(l)) || '',
    portfolio: s.portfolio || links.find(l => !/linkedin\.com|github\.com|leetcode\.com|codeforces\.com|hackerrank\.com/i.test(l)) || '',
    leetcode: s.leetcode || links.find(l => /leetcode\.com/i.test(l)) || '',
    codeforces: s.codeforces || links.find(l => /codeforces\.com/i.test(l)) || '',
    hackerrank: s.hackerrank || links.find(l => /hackerrank\.com/i.test(l)) || '',
    education,
    experience,
    projects,
    rawSkills,
    achievements,
    certifications,
    leadership
  };
}

/**
 * Builds the strict LLM system prompt for role tailoring.
 * Adheres to uncompromising factual grounding, zero technology-swapping, and zero metric fabrication.
 */
function buildTailoringPrompt(profile, jobTitle, company, jobDescription) {
  const numExp = profile.experience?.length || 0;
  // Fresher Page Budgeting:
  // If candidate has 2+ internships, pick top 2 projects. If 1 internship, pick 2 projects. If 0 internships, pick top 3 projects.
  const targetProjectCount = numExp >= 2 ? 2 : (numExp === 1 ? 2 : 3);
  const targetExpCount = Math.min(numExp, 2);

  return `You are an elite ATS resume tailoring, career intelligence, and technical resume optimization engine.
Your mission is to tailor a candidate's resume for a specific target Job Description (JD) to maximize ATS relevance and recruiter impact, while adhering to absolute FACTUAL GROUNDING and an uncompromising 1-PAGE FRESHER CONSTRAINT.

TARGET ROLE: ${jobTitle || 'Specified Role'}
TARGET COMPANY: ${company || 'Target Employer'}

TARGET JOB DESCRIPTION:
${jobDescription.slice(0, 10000)}

CANDIDATE'S VERIFIED SOURCE DATA (THE SOLE FACTUAL FOUNDATION):
${JSON.stringify(profile, null, 2)}

================================================================================
CRITICAL MANDATES & CONSTRAINTS
================================================================================

1. STRICT SINGLE-PAGE CONSTRAINT & "BEST-OF" CURATION (FRESHER / EARLY-CAREER RULE):
   - In modern tech recruiting, resumes for freshers/early-career engineers MUST FIT ON EXACTLY 1 PAGE. A multi-page resume for a fresher is viewed unfavorably by recruiters.
   - DO NOT dump every project or weak profile entry into the resume!
   - You MUST act as an expert selective curator: evaluate all candidate data and include ONLY the HIGHEST-IMPACT, MOST JD-ALIGNED items:
     * PROJECTS CURATION: The candidate's profile contains ${profile.projects?.length || 0} projects. Evaluate each project's tech stack and domain against the JD. Select ONLY the TOP ${targetProjectCount} most relevant projects. Discard or omit less relevant projects.
     * EXPERIENCE CURATION: Select ONLY the TOP ${targetExpCount} most relevant internships/work experiences.
     * BULLET BUDGET: At most 2 concise, high-impact bullet points per project or experience entry.
     * BULLET EVIDENCE: Copy selected bullet statements exactly from that source entry. Prefer concise statements; omit lower-priority content instead of rewriting, combining or expanding facts. Source fidelity takes priority over word-count preferences.
     * SUMMARY: The server constructs the final source-backed summary. You may return an empty summary text; do not invent expertise or outcomes.
     * ACHIEVEMENTS BUDGET: Select at most 2 verified achievements and 1 leadership entry. Keep descriptions to one short complete sentence. Omit weak or filler items.
     * CERTIFICATIONS BUDGET: Include only 1 to 2 verified credentials if present. Do NOT repeat certifications as achievements or skills.

2. ZERO FABRICATION OF TECHNOLOGIES OR TOOLS:
   - ONLY include technologies, tools, libraries, and frameworks that are explicitly supported by the candidate's verified source profile.
   - NEVER swap candidate technologies simply to match JD keywords.
   - Preserve the categorized project technologies exactly (e.g. "Languages: Java, JavaScript | Backend: Node.js, Express.js | Database: MySQL"). Do not flatten groups, infer which language implements an API, or add Spring Boot to a Node.js project.
   - Return the source id on every selected experience, project, certification, achievement, and leadership record. Do not invent entries, institutions, dates, URLs, credentials, or skills, including common CS fundamentals.
     * Example Violation: If the candidate's project lists "FastAPI, Python, MongoDB", and the JD requires "Java, Spring Boot, MySQL", you MUST KEEP "FastAPI, Python, MongoDB". You MUST NEVER replace them with "Java" or "Spring Boot".
     * If the candidate lacks a technology required by the JD, that technology MUST BE RECORDED in "tailoredMeta.missingOrWeakSkills", NOT falsely added to the resume.

3. RELEVANT KEYWORD ALIGNMENT WITHOUT KEYWORD STUFFING:
   - Use JD keywords to SELECT relevant source statements, not to add new statements or architectural claims. A framework name alone is not evidence of authentication, caching, optimization or security work.
   - Do NOT stuff bullets with comma-separated keyword lists or change the source statement's ownership, scope or negation.

4. ANTI-INFLATION & INTERVIEW DEFENSIBILITY:
   - Freshers must be interview-defensible. NEVER use unearned buzzwords such as "scalable", "high-performance", "production-grade", "cutting-edge", "state-of-the-art", "world-class", "mission-critical" unless explicitly supported by quantifiable metrics in the candidate's source profile.
   - Describe realistic, credible engineering work:
     * Preserve the source statement's original action verb. Do not upgrade "Assisted" to "Led" or "Integrated" to "Optimized".
     * Select architectural details only when the source statement itself mentions them.

5. ZERO INVENTED METRICS:
   - NEVER invent unsupported numeric metrics (e.g., "boosted speed by 35%", "handled 50k DAU", "reduced latency by 40ms").
   - If the candidate profile has verified metrics, keep and polish them. If not, describe technical scope, complexity, and qualitative outcomes truthfully.

6. DEDUPLICATION ACROSS ALL SECTIONS:
   - NO duplicate degree names: Education description must NOT repeat the degree program name (e.g., avoid "B.Tech in CSE · B.Tech in CSE").
   - NO duplicate certifications: If an item is in certifications, do NOT repeat it in achievements or skills.
   - NO duplicate skills: Each skill belongs to its single most appropriate category.

7. CONSISTENT DATES & IMMUTABLE IDENTITY:
   - "fullName": Must be exactly "${profile.fullName}". NEVER use "Candidate", "Student", or placeholders.
   - "dates": All dates must be in clean standard resume format: "MMM YYYY – MMM YYYY" (e.g. "Jun 2024 – Aug 2024"), "MMM YYYY – Present", or "YYYY – YYYY". NEVER output ISO dates like "2026-05-01".
   - "education": Preserve verified institutions, boards, and degrees. Do NOT generalize to "University".

8. FIT ANALYSIS & ROADMAP TO 100%:
   - "matchScore": Realistic integer (65 to 92) measuring genuine alignment.
   - "matchedSkills": Skills from the JD that the candidate ACTUALLY has in their verified profile.
   - "missingOrWeakSkills": Skills demanded by the JD that the candidate DOES NOT possess.
   - "matchedStrengths": 2-3 bullet points highlighting real candidate strengths.
   - "roadmapTo100": 3-5 concrete, actionable engineering steps for the candidate to bridge the gaps.

OUTPUT FORMAT: Return ONLY a valid JSON object with this EXACT structure:
{
  "resume": {
    "personal": {
      "fullName": "${profile.fullName}",
      "headline": "Target role headline aligned with candidate's actual background",
      "email": "${profile.email}",
      "phone": "${profile.phone}",
      "location": "${profile.location}",
      "linkedin": "${profile.linkedin}",
      "github": "${profile.github}",
      "portfolio": "${profile.portfolio}",
      "links": ${JSON.stringify(profile.links)}
    },
    "summary": {
      "text": "2 tight, punchy sentences (30-45 words) highlighting verified strengths for this role"
    },
    "education": ${JSON.stringify(profile.education.slice(0, 3))},
    "experience": [
      {
        "id": "exp_0",
        "title": "Actual Job Title from profile",
        "company": "Actual Company from profile",
        "dates": "MMM YYYY – MMM YYYY",
        "location": "Location",
        "description": "",
        "bullets": [
          "Concise action-verb bullet (15-25 words) detailing verified contributions relevant to the JD",
          "Second bullet detailing real technical architecture without buzzword inflation or invented metrics"
        ]
      }
    ],
    "projects": [
      {
        "id": "prj_0",
        "title": "Actual Project Name from profile",
        "dates": "MMM YYYY – MMM YYYY",
        "technologies": "Actual technologies used on this project from profile",
        "liveUrl": "URL",
        "repoUrl": "URL",
        "description": "",
        "bullets": [
          "Action-verb bullet (15-25 words) highlighting real project implementation relevant to the role",
          "Second bullet detailing technical architecture and data flow without fabricated metrics"
        ]
      }
    ],
    "skills": {
      "languages": ["Verified languages with JD matching ones ordered first"],
      "frameworks": ["Verified frameworks with JD matching ones ordered first"],
      "cloudDevOps": ["Verified cloud/devops tools with JD matching ones ordered first"],
      "databasesTools": ["Verified databases/tools with JD matching ones ordered first"],
      "coreConcepts": ["Core CS concepts (DSA, DBMS, System Design, etc.)"],
      "raw": ["All verified skills"]
    },
    "certifications": ${JSON.stringify(profile.certifications.slice(0, 4))},
    "achievements": ${JSON.stringify(profile.achievements.slice(0, 4))},
    "leadership": ${JSON.stringify(profile.leadership.slice(0, 4))},
    "sectionOrder": ["summary", "skills", "experience", "projects", "education", "certifications", "achievements", "leadership"]
  },
  "tailoredMeta": {
    "jobTitle": "${jobTitle || 'Role'}",
    "company": "${company || 'Company'}",
    "matchScore": 84,
    "summary": "Truthful ATS fit summary based strictly on verified profile",
    "matchedSkills": ["Skill 1", "Skill 2"],
    "missingOrWeakSkills": ["Missing Skill A", "Missing Skill B"],
    "matchedStrengths": ["Strength 1", "Strength 2"],
    "roadmapTo100": [
      {
        "step": 1,
        "category": "Project Enhancement",
        "action": "Actionable step..."
      }
    ]
  }
}`;
}

/**
 * Strict Defense-in-Depth Guardrail Pipeline:
 * Enforces single-page fresher budget, factual tech grounding, buzzword softening,
 * metric sanitization, date normalization, cross-category deduplication, and immutable personal data.
 */
function sanitizeAndGuardrailTailoredResume(result, profile, { jobTitle, company, jobDescription }) {
  const resume = result?.resume || {};
  const meta = result?.tailoredMeta || {};

  // 1. Candidate Full Name & Personal Data Protection
  resume.personal = resume.personal || {};
  resume.personal.fullName = profile.fullName; // NEVER 'Candidate' or altered name
  resume.personal.headline = profile.headline || '';
  resume.personal.email = profile.email || '';
  resume.personal.phone = profile.phone || '';
  resume.personal.location = profile.location || '';
  resume.personal.linkedin = profile.linkedin || '';
  resume.personal.github = profile.github || '';
  resume.personal.portfolio = profile.portfolio || '';
  resume.personal.leetcode = profile.leetcode || '';
  resume.personal.codeforces = profile.codeforces || '';
  resume.personal.hackerrank = profile.hackerrank || '';

  const allPersonalLinks = [
    ...(Array.isArray(profile.links) ? profile.links : []),
    profile.linkedin,
    profile.github,
    profile.portfolio,
    profile.leetcode,
    profile.codeforces,
    profile.hackerrank
  ].filter(Boolean);
  resume.personal.links = Array.from(new Set(allPersonalLinks));

  // A short, supported summary; complete sentences, no assumed CS skills or metrics.
  resume.summary = { text: policy.groundedSummary(softenBuzzwords(resume.summary?.text), profile, jobDescription || '') };

  // 3. Education Protection & Deduplication (Cap to 3 entries, hardcode KIIT Bhubaneswar)
  const baseEducation = (Array.isArray(profile.education) && profile.education.length > 0)
    ? profile.education
    : [];

  resume.education = baseEducation.slice(0, 3).map((pe, idx) => {
    let inst = pe.institution || pe.title || pe.company || '';
    if (idx === 0 || /^(?:university|kiit|kalinga|college)$/i.test(inst.trim()) || /kiit/i.test(inst)) {
      if (!/school|cbse|icse|secondary/i.test(inst)) {
        inst = 'Kalinga Institute of Industrial Technology (KIIT)';
      }
    }
    let deg = String(pe.degreeProgram || pe.degree || '').trim();
    let desc = String(pe.description || '').trim();
    // Prevent duplicate degree title in description
    if (deg && desc) {
      if (desc.toLowerCase().startsWith(deg.toLowerCase())) {
        desc = desc.slice(deg.length).replace(/^[\s·\-,|]+/, '').trim();
      } else if (desc.toLowerCase() === deg.toLowerCase()) {
        desc = '';
      }
    }
    return {
      ...pe,
      institution: inst,
      title: inst,
      company: inst,
      degreeProgram: deg,
      degree: deg,
      description: desc,
      dates: normalizeDateStr(pe.dates)
    };
  });

  // Bind model text to verified entries before ranking. Never match by array position.
  const jd = String(jobDescription || '');
  resume.experience = policy.selectEntries(Array.isArray(resume.experience) ? resume.experience : [], profile.experience, 2, jd, item => item.company)
    .map(exp => ({ ...exp, description: '', bullets: exp.bullets }));
  const targetProjectCount = resume.experience.length ? 2 : 3;
  resume.projects = policy.selectEntries(Array.isArray(resume.projects) ? resume.projects : [], profile.projects, targetProjectCount, jd, item => item.title)
    .map(project => ({ ...project, description: '', technologies: policy.technologyStack(project.technologies).text, bullets: project.bullets }));

  const inventory = policy.sourceSkills(profile);
  resume.skills = policy.skillsForRole(inventory, jd);

  // 7. Verified Certifications, Achievements & Leadership Curation
  // Keep source-backed credentials only; model output cannot introduce awards or positions.
  const certTitles = new Set();
  const rawCerts = policy.rank(profile.certifications || [], jd);

  resume.certifications = rawCerts.slice(0, 2).map((c, idx) => {
    const title = c.title || c.name || 'Certification';
    certTitles.add(title.toLowerCase().trim());
    return {
      id: c.id || `cert_${idx}`,
      title,
      issuer: c.issuer || c.organization || '',
      dates: normalizeDateStr(c.dates || c.year || ''),
      description: softenBuzzwords(c.description || '')
    };
  });

  const rawAchs = policy.rank(profile.achievements || [], jd);

  resume.achievements = rawAchs
    .filter(a => !certTitles.has(String(a.title || a.name || '').toLowerCase().trim()))
    .slice(0, 2)
    .map((ach, idx) => {
      const desc = softenBuzzwords(ach.description || ach.details || '');
      const firstSentence = desc.split(/(?<=[.!?])\s+(?=[A-Z])/)[0] || desc;
      return {
        id: ach.id || `ach_${idx}`,
        title: ach.title || ach.name || 'Achievement',
        dates: normalizeDateStr(ach.dates || ach.date || ach.year || ''),
        description: firstSentence.trim()
      };
    });

  const rawLead = policy.rank(profile.leadership || [], jd);

  resume.leadership = rawLead.slice(0, 1).map((lead, idx) => {
    const desc = softenBuzzwords(lead.description || lead.details || '');
    const firstSentence = desc.split(/(?<=[.!?])\s+(?=[A-Z])/)[0] || desc;
    return {
      id: lead.id || `lead_${idx}`,
      title: lead.title || lead.role || lead.name || 'Leadership',
      role: lead.role || lead.title || 'Leadership',
      company: lead.company || lead.organization || lead.institution || '',
      dates: normalizeDateStr(lead.dates || lead.date || lead.year || ''),
      description: firstSentence.trim(),
      bullets: Array.isArray(lead.bullets) ? lead.bullets.slice(0, 1).map(b => keepCompleteSentence(softenBuzzwords(b))) : []
    };
  });

  // Section order: Build prioritized section sequence covering all populated sections
  const candidateSections = ['summary', 'skills', 'experience', 'projects', 'education', 'certifications', 'achievements', 'leadership'];
  resume.sectionOrder = candidateSections.filter(sec => {
    if (sec === 'summary') return Boolean(resume.summary?.text?.trim());
    if (sec === 'skills') return (resume.skills?.raw?.length || 0) > 0;
    return Array.isArray(resume[sec]) && resume[sec].length > 0;
  });

  // Explain source-backed keyword coverage; never invent a minimum score or generic gaps.
  const evidence = policy.roleEvidence(inventory, jd);
  const matched = evidence.matched;
  const missing = evidence.missing;
  const matchScore = evidence.score;
  const contentValidation = policy.auditClaims(resume, profile);
  if (!contentValidation.passed) {
    const error = new Error('Resume source verification failed. Please review the profile entries and try again.');
    error.statusCode = 422;
    throw error;
  }

  const sanitizedMeta = {
    jobTitle: jobTitle || meta.jobTitle || 'Target Role',
    company: company || meta.company || 'Target Employer',
    matchScore,
    summary: 'Source-backed JD keyword coverage; this is an estimate, not an employer ATS score.',
    matchedSkills: matched,
    missingOrWeakSkills: missing,
    matchedStrengths: matched.slice(0, 4).map(skill => `Source profile includes ${skill}.`),
    contentValidation,
    roadmapTo100: Array.isArray(meta.roadmapTo100) && meta.roadmapTo100.length > 0
      ? meta.roadmapTo100
      : [
          {
            step: 1,
            category: 'Project Enhancement',
            action: `Incorporate key requirements from ${jobTitle || 'the target role'} into your primary portfolio project.`
          },
          {
            step: 2,
            category: 'Skill Acquisition',
            action: 'Build a focused sandbox project showcasing any missing architectural or tooling specifications.'
          }
        ],
    tailoredAt: new Date().toISOString(),
    modelUsed: result.modelUsed || 'ai-tailor'
  };

  return {
    resume,
    tailoredMeta: sanitizedMeta
  };
}

/**
 * Execute Gemini model call with timeout and error handling
 */
async function callGeminiTailor(prompt) {
  const apiKey = config.geminiApiKey;
  if (!apiKey) return null;

  const candidateModels = [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-flash-latest',
    'gemini-3.8-flash'
  ];

  for (const model of candidateModels) {
    const startTime = Date.now();
    console.log(`[Resume Tailor] 🚀 Trying Gemini model "${model}"...`);
    let timeoutId;
    try {
      const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.15
        }
      };

      const controller = new AbortController();
      const timeoutMs = 50000;
      timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.warn(`[Resume Tailor] ⚠️ Model "${model}" failed (HTTP ${response.status} in ${elapsed}s): ${errText.slice(0, 200)}`);
        continue;
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const cleaned = cleanJsonText(rawText);
        const parsed = JSON.parse(cleaned);
        if (!validTailoringResult(parsed)) throw new Error('Invalid tailored resume structure');
        console.log(`[Resume Tailor] ✅ Gemini SUCCESS with "${model}" in ${elapsed}s (Match Score: ${parsed.tailoredMeta?.matchScore || 'N/A'}%)`);
        return {
          ...parsed,
          modelUsed: `gemini-${model}`
        };
      }
    } catch (err) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const isAbort = err.name === 'AbortError' || err.message?.includes('aborted');
      console.warn(`[Resume Tailor] ⚠️ Model "${model}" error after ${elapsed}s: ${isAbort ? 'Timeout after 50s' : err.message}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return null;
}

/**
 * Execute Groq model call as Tier 2 fallback
 */
async function callGroqTailor(prompt) {
  const apiKey = config.groqApiKey || process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const models = [...new Set([
    config.groqModel,
    'openai/gpt-oss-120b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant'
  ].filter(Boolean))];

  for (const model of models) {
    const startTime = Date.now();
    console.log(`[Resume Tailor] 🚀 Trying Groq fallback model "${model}"...`);
    let timeoutId;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 35000);

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: 0.15
        }),
        signal: controller.signal
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.warn(`[Resume Tailor] ⚠️ Groq model "${model}" failed (${response.status} in ${elapsed}s): ${errText.slice(0, 200)}`);
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        if (!validTailoringResult(parsed)) throw new Error('Invalid tailored resume structure');
        console.log(`[Resume Tailor] ✅ Groq SUCCESS with "${model}" in ${elapsed}s (Match Score: ${parsed.tailoredMeta?.matchScore || 'N/A'}%)`);
        return {
          ...parsed,
          modelUsed: `groq-${model}`
        };
      }
    } catch (err) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[Resume Tailor] ⚠️ Groq model "${model}" error after ${elapsed}s: ${err.message}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return null;
}

/**
 * Deterministic fallback if AI is completely unavailable
 */
function deterministicTailorFallback(profile, jobTitle, company, jobDescription) {
  console.log('[Resume Tailor] ℹ️ Using deterministic profile synthesis fallback.');
  const numExp = profile.experience?.length || 0;
  const targetProjectCount = numExp >= 2 ? 2 : (numExp === 1 ? 2 : 3);

  const curatedProjects = policy.rank(profile.projects || [], jobDescription || '').slice(0, targetProjectCount).map((p, i) => ({
    id: p.id || `prj_${i}`,
    title: p.title,
    dates: normalizeDateStr(p.dates),
    technologies: p.technologies,
    liveUrl: p.liveUrl || '',
    repoUrl: p.repoUrl || '',
    description: '',
    bullets: (p.bullets || []).slice(0, 3).map(b => trimBulletLength(softenBuzzwords(b), 220))
  }));

  const curatedExperience = policy.rank(profile.experience || [], jobDescription || '').slice(0, 2).map((exp, i) => ({
    id: exp.id || `exp_${i}`,
    title: exp.title,
    company: exp.company,
    dates: normalizeDateStr(exp.dates),
    location: exp.location || '',
    description: '',
    bullets: (exp.bullets || []).slice(0, 3).map(b => trimBulletLength(softenBuzzwords(b), 220))
  }));

  return {
    resume: {
      personal: {
        fullName: profile.fullName,
        headline: jobTitle ? `${jobTitle} Candidate` : profile.headline,
        email: profile.email,
        phone: profile.phone,
        location: profile.location,
        linkedin: profile.linkedin,
        github: profile.github,
        portfolio: profile.portfolio,
        links: profile.links
      },
      summary: {
        text: `${profile.education[0]?.degreeProgram || 'Graduate'} with practical work in ${policy.rank(profile.projects || [], jobDescription || '').slice(0, 2).map(p => p.title).join(' and ') || 'software projects'}. Seeking an entry-level ${jobTitle || 'software development'} role.`
      },
      education: (profile.education || []).slice(0, 3),
      experience: curatedExperience,
      projects: curatedProjects,
      skills: policy.skillsForRole(policy.sourceSkills(profile), jobDescription || ''),
      certifications: (profile.certifications || []).slice(0, 2),
      achievements: (profile.achievements || []).slice(0, 3),
      sectionOrder: ['summary', 'skills', 'experience', 'projects', 'education', 'achievements']
    },
    tailoredMeta: {
      jobTitle: jobTitle || 'Target Role',
      company: company || 'Target Employer',
      matchScore: 80,
      summary: 'Verified profile directly synthesized and curated for single-page ATS readability.',
      matchedSkills: profile.rawSkills.slice(0, 6),
      missingOrWeakSkills: ['Specific cloud credentials', 'Enterprise CI/CD benchmarks'],
      matchedStrengths: [
        'Verified projects showcase end-to-end implementation skills.',
        'Strong technical foundations directly mapped from student profile.'
      ],
      roadmapTo100: [
        {
          step: 1,
          category: 'Project Metrics',
          action: 'Quantify data scale and architectural workflows in your project descriptions.'
        },
        {
          step: 2,
          category: 'Skill Certification',
          action: 'Consider obtaining verified credentials in specialized cloud or testing tooling.'
        }
      ]
    },
    modelUsed: 'deterministic-fallback'
  };
}

/**
 * Main service entrypoint: Tailor resume for JD from verified student profile
 */
async function tailorForJd(studentId, { jobTitle, company, jobDescription }) {
  if (!studentId) throw new Error('Student ID is required');
  if (!jobDescription || jobDescription.trim().length < 40) {
    throw new Error('A detailed Job Description is required (minimum 40 characters)');
  }

  const student = await studentStore.getStudentById(studentId);
  if (!student) throw new Error('Student profile not found');

  // Load existing resumes to supplement context if available
  let existingResumes = [];
  try {
    existingResumes = await resumeStore.list(studentId);
  } catch (err) {
    console.warn(`[Resume Tailor] Note: Unable to load existing resumes for student: ${err.message}`);
  }

  const profile = extractProfileContext(student, existingResumes);

  console.log(`\n======================================================`);
  console.log(`[Resume Tailor] 🎯 Started Factual JD Tailoring for: "${profile.fullName}"`);
  console.log(`[Resume Tailor] 🏢 Target Role: "${jobTitle || 'Custom Role'}" @ "${company || 'Target Company'}"`);
  console.log(`[Resume Tailor] 📋 JD Length: ${jobDescription.length} characters`);
  console.log(`[Resume Tailor] 🎓 Education Records: ${profile.education.length} (College: "${profile.education[0]?.institution || 'N/A'}")`);
  console.log(`[Resume Tailor] 💼 Projects: ${profile.projects.length}, Internships: ${profile.experience.length}, Skills: ${profile.rawSkills.length}`);
  console.log(`======================================================`);

  const prompt = buildTailoringPrompt(profile, jobTitle, company, jobDescription);

  // Try Tier 1: Gemini
  let rawResult = await callGeminiTailor(prompt);

  // Try Tier 2: Groq
  if (!rawResult || !rawResult.resume) {
    rawResult = await callGroqTailor(prompt);
  }

  // Fallback: Deterministic
  if (!rawResult || !rawResult.resume) {
    rawResult = deterministicTailorFallback(profile, jobTitle, company, jobDescription);
  }

  // Run through Defense-in-Depth Factual Guardrails
  const { resume: curatedResume, tailoredMeta } = sanitizeAndGuardrailTailoredResume(
    rawResult,
    profile,
    { jobTitle, company, jobDescription }
  );

  // Fit content using the existing default Studio A4 layout, with no CSS overrides.
  const { printable, normalizeExtractedData } = await import('../../../../shared/resume/resumeDocument.mjs');
  const { renderResumePdf } = require('./resumePdf.service');
  const { PDFDocument } = require('pdf-lib');
  const resumeData = await policy.fitOnePage(curatedResume, async data => {
    const html = printable(normalizeExtractedData(data), 'classic', false, '', false, false);
    return (await PDFDocument.load(await renderResumePdf(html))).getPageCount();
  });
  tailoredMeta.pageCount = 1;
  tailoredMeta.contentCurated = true;
  tailoredMeta.contentValidation = policy.auditClaims(resumeData, profile);
  if (!tailoredMeta.contentValidation.passed) {
    const error = new Error('Resume source verification failed after page fitting.');
    error.statusCode = 422;
    throw error;
  }

  // Embed tailoredMeta into extractedData for instant client access
  resumeData.tailoredMeta = tailoredMeta;
  resumeData.extractedAt = new Date().toISOString();
  resumeData.extractionMethod = tailoredMeta.modelUsed;

  console.log(`[Resume Tailor] 🎯 Tailoring Completed Successfully!`);
  console.log(`  • Candidate:   ${resumeData.personal?.fullName}`);
  console.log(`  • Engine:      ${tailoredMeta.modelUsed}`);
  console.log(`  • Match Score: ${tailoredMeta.matchScore}%`);
  console.log(`  • Matched:     ${tailoredMeta.matchedSkills.length} verified skills`);
  console.log(`  • Missing:     ${tailoredMeta.missingOrWeakSkills.length} JD gap skills`);
  console.log(`  • Roadmap:     ${tailoredMeta.roadmapTo100.length} actionable steps\n`);

  return {
    resumeData,
    tailoredMeta
  };
}

module.exports = {
  tailorForJd,
  extractProfileContext,
  sanitizeAndGuardrailTailoredResume,
  normalizeDateStr,
  formatDateRange,
  softenBuzzwords,
  sanitizeBulletMetrics,
  trimBulletLength,
  buildTailoringPrompt,
  deterministicTailorFallback
};
