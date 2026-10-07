const config = require('../config');

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Schema and prompt for structured resume extraction
const RESUME_SCHEMA_PROMPT = `You are an expert resume parsing system. Parse the provided resume into a strict, fully-populated JSON object with this exact structure:
{
  "personal": {
    "fullName": "Candidate full name",
    "headline": "Target role or professional title (e.g. Computer Science and Engineering Student)",
    "email": "Email address",
    "phone": "Phone number",
    "location": "City, State/Country (e.g. Bhubaneswar, Odisha, India)",
    "linkedin": "Candidate's personal LinkedIn URL (https://linkedin.com/in/...)",
    "github": "Candidate's personal GitHub profile URL (https://github.com/username - strictly profile, not a repo)",
    "portfolio": "Candidate's personal website/portfolio URL",
    "links": ["Array of candidate's personal profile links ONLY: LinkedIn, personal GitHub profile, LeetCode profile, Codolio profile, Codeforces profile, HackerRank profile, Portfolio. STRICT RULE: DO NOT put project repositories, project live demo URLs, huggingface spaces, or certification verification URLs in personal.links!"]
  },
  "summary": {
    "text": "Professional summary or objective statement (empty string if not present)"
  },
  "education": [
    {
      "title": "Full Degree / Major or Level (e.g. Bachelor of Technology – Computer Science and Engineering, or Intermediate, or High School). Never omit this!",
      "institution": "Full Institution or School name (e.g. Kalinga Institute of Industrial Technology, Aditya Academy Secondary)",
      "location": "City, State (e.g. Bhubaneshwar, Odisha, or Kolkata, West Bengal)",
      "dates": "Duration or graduation years (e.g. 2023-2027, 2020-2022, 2018-2020)",
      "description": "Academic scores or honors (e.g. CGPA: 8.12, or 75%, or 88%)",
      "bullets": []
    }
  ],
  "experience": [
    {
      "title": "Role or Job title",
      "company": "Company or Organization name",
      "dates": "Dates (e.g. May 2024 - July 2024)",
      "location": "Location (City, State or Remote)",
      "description": "Brief team or role overview",
      "bullets": ["Specific achievement or responsibility bullet point"]
    }
  ],
  "projects": [
    {
      "title": "Full Project Name",
      "dates": "Dates (e.g. Feb 2026 – Mar 2026)",
      "technologies": "Comma-separated technologies (e.g. FastAPI, React, PostgreSQL, Cloudflare R2, Supabase)",
      "liveUrl": "Live demo deployment link (e.g. https://jobassistai.amanlabs.dev/ or https://snackit.amanlabs.dev/)",
      "repoUrl": "GitHub source code repository URL (e.g. https://github.com/agarwalaman598/job-application-assistant)",
      "description": "Overview of what the project does",
      "bullets": ["Detailed achievement or engineering bullet points"]
    }
  ],
  "skills": {
    "languages": ["Programming languages: e.g. Python, Java, C, JavaScript, HTML, CSS"],
    "frameworks": ["Frameworks & libraries: e.g. FastAPI, Flask, Node.js, React.js, Bootstrap, NumPy, Pandas"],
    "cloudDevOps": ["Cloud, DevOps & tools: e.g. Git, GitHub, CI/CD (GitHub Actions), Docker, AWS"],
    "databasesTools": ["Databases & tools: e.g. PostgreSQL, MySQL, SQLite, Visual Studio Code (VS Code), Jupyter Notebook"],
    "coreConcepts": ["Core CS concepts: e.g. Data Structures & Algorithms (DSA), Object-Oriented Programming (OOP), DBMS, Computer Networks, SDLC"],
    "raw": ["All technical and domain skills in one complete flat array"]
  },
  "certifications": [
    {
      "title": "Certification name (e.g. Introduction to Git and GitHub)",
      "issuer": "Issuing organization (e.g. Google (via Coursera))",
      "dates": "Date or duration (e.g. Nov 2025)",
      "url": "Certificate verification URL if available",
      "description": "",
      "bullets": ["Key concepts or topics mastered (e.g. Mastered version control fundamentals, including installing and configuring Git...)"]
    }
  ],
  "achievements": [
    {
      "title": "Full Award or Hackathon title without truncating or shortening (e.g. Secured 2nd Rank at Coding Ninjas CipherQuest 2025 Hackathon)",
      "dates": "Year or date (e.g. 2025)",
      "description": "Description of the achievement or solution details"
    }
  ],
  "leadership": [
    {
      "title": "Leadership role, club, community or volunteer position",
      "dates": "Year or date",
      "description": "Organization and impact",
      "bullets": []
    }
  ],
  "sectionOrder": ["Array of sections in the exact order they appear in the resume: e.g. ['education', 'skills', 'projects', 'achievements', 'certifications']"]
}

CRITICAL RULES:
1. Capture EVERY project bullet point, education detail, achievement, and certification bullet present in the resume. Do NOT truncate hackathon names or drop bullet points.
2. In personal.links, include ONLY candidate's profile URLs (LinkedIn, GitHub profile, LeetCode, Codolio, Portfolio). Project demos (e.g. SnackIt, HuggingFace, JobAssist) and Coursera links MUST go into their respective project/certification objects, NOT into personal.links.
3. In education, ALWAYS extract the degree/major into 'title' (e.g. 'Bachelor of Technology – Computer Science and Engineering'), institution into 'institution', and location into 'location'.
4. In skills, ALWAYS capture core CS subjects (DSA, OOP, DBMS, Computer Networks, SDLC) in 'coreConcepts'.
5. Return ONLY the valid JSON object.`;

/**
 * Clean potential markdown wrappers from LLM response
 */
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
 * Parses a resume PDF buffer directly using Gemini Multimodal input.
 * Falls back to gemini-1.5-flash if gemini-2.0-flash encounters an error.
 * 
 * @param {Buffer} pdfBuffer - Raw PDF buffer
 * @param {string} [extraTextContext] - Optional supplementary text (e.g. extracted hyperlink annotations)
 * @returns {Promise<object | null>} Structured resume JSON, or null on failure
 */
async function parseResumePdf(pdfBuffer, extraTextContext = '') {
  const apiKey = config.geminiApiKey;
  if (!apiKey) {
    console.warn('[Resume Parse] ⚠️ No GEMINI_API_KEY configured. Skipping Tier 1 Gemini Multimodal.');
    return null;
  }

  const base64Data = Buffer.isBuffer(pdfBuffer) ? pdfBuffer.toString('base64') : null;
  if (!base64Data) {
    console.warn('[Resume Parse] ⚠️ Invalid PDF buffer provided.');
    return null;
  }

  const candidateModels = [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-flash-latest',
    'gemini-3.8-flash'
  ];

  const userInstruction = extraTextContext
    ? `${RESUME_SCHEMA_PROMPT}\n\nAdditional extracted document links & notes:\n${extraTextContext}`
    : RESUME_SCHEMA_PROMPT;

  for (const model of candidateModels) {
    const startTime = Date.now();
    console.log(`[Resume Parse] 🚀 [Tier 1: Gemini Multimodal] Trying model "${model}"...`);
    try {
      const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: base64Data
                }
              },
              {
                text: userInstruction
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      };

      const controller = new AbortController();
      const timeoutMs = 50000; // 50s timeout for multimodal PDF
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.warn(`[Resume Parse] ⚠️ [Tier 1: Gemini Multimodal] Model "${model}" failed (HTTP ${response.status} in ${elapsed}s): ${errorText.slice(0, 250)}`);
        continue;
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const cleaned = cleanJsonText(rawText);
        const parsedJson = JSON.parse(cleaned);
        console.log(`[Resume Parse] ✅ [Tier 1: Gemini Multimodal] SUCCESS with model "${model}" in ${elapsed}s (${cleaned.length} chars JSON)`);
        return {
          ...parsedJson,
          extractedAt: new Date().toISOString(),
          extractionMethod: `gemini-multimodal-${model}`
        };
      } else {
        console.warn(`[Resume Parse] ⚠️ [Tier 1: Gemini Multimodal] Model "${model}" returned no candidate text in ${elapsed}s.`);
      }
    } catch (err) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const isAbort = err.name === 'AbortError' || err.message?.includes('aborted');
      console.warn(`[Resume Parse] ⚠️ [Tier 1: Gemini Multimodal] Model "${model}" error after ${elapsed}s: ${isAbort ? 'Request timed out (exceeded 50s limit)' : err.message}`);
    }
  }

  console.warn('[Resume Parse] ⚠️ [Tier 1: Gemini Multimodal] All candidate models failed or exhausted.');
  return null;
}

/**
 * Parses raw text using Gemini text-only input (used if only text is available).
 * 
 * @param {string} text - Resume text
 * @returns {Promise<object | null>} Structured resume JSON, or null on failure
 */
async function parseResumeText(text) {
  const apiKey = config.geminiApiKey;
  if (!apiKey || !text || text.length < 50) return null;

  const candidateModels = [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-flash-latest',
    'gemini-3.8-flash'
  ];

  for (const model of candidateModels) {
    const startTime = Date.now();
    console.log(`[Resume Parse] 🚀 [Tier 2: Gemini Text] Trying model "${model}" (${text.length} chars input)...`);
    try {
      const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${RESUME_SCHEMA_PROMPT}\n\nRESUME TEXT TO PARSE:\n${text.slice(0, 15000)}` }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      };

      const controller = new AbortController();
      const timeoutMs = 35000; // 35s timeout for text
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.warn(`[Resume Parse] ⚠️ [Tier 2: Gemini Text] Model "${model}" failed (HTTP ${response.status} in ${elapsed}s): ${errorText.slice(0, 250)}`);
        continue;
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const cleaned = cleanJsonText(rawText);
        const parsedJson = JSON.parse(cleaned);
        console.log(`[Resume Parse] ✅ [Tier 2: Gemini Text] SUCCESS with model "${model}" in ${elapsed}s (${cleaned.length} chars JSON)`);
        return {
          ...parsedJson,
          extractedAt: new Date().toISOString(),
          extractionMethod: `gemini-text-${model}`
        };
      } else {
        console.warn(`[Resume Parse] ⚠️ [Tier 2: Gemini Text] Model "${model}" returned no candidate text in ${elapsed}s.`);
      }
    } catch (err) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const isAbort = err.name === 'AbortError' || err.message?.includes('aborted');
      console.warn(`[Resume Parse] ⚠️ [Tier 2: Gemini Text] Model "${model}" error after ${elapsed}s: ${isAbort ? 'Request timed out (exceeded 35s limit)' : err.message}`);
    }
  }

  console.warn('[Resume Parse] ⚠️ [Tier 2: Gemini Text] All candidate models failed or exhausted.');
  return null;
}

module.exports = {
  parseResumePdf,
  parseResumeText,
  RESUME_SCHEMA_PROMPT
};
