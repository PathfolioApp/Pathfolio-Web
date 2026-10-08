const router = require('express').Router();
const auth = require('../../shared/authenticate');
const studentStore = require('../students/studentStore');
const aiGateway = require('../../shared/aiGateway.service');

/**
 * Student "story summary" - a narrative of the student's journey built ONLY
 * from their verified profile (achievements, projects, internships,
 * interests, academics). Explicitly excludes platform bookkeeping like
 * "joined Pathfolio" or "completed onboarding" (requirement).
 */
router.use(auth);

router.post('/me/summary', async (req, res) => {
  try {
    const student = await studentStore.getStudentById(req.student.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

    const name = list => (list || []).map(item => typeof item === 'string' ? item : item?.name).filter(Boolean);
    // Facts only - no platform events (no joined/completed-onboarding noise).
    const facts = {
      name: student.personal?.fullName || 'the student',
      department: student.academic?.department || '',
      batchYear: student.academic?.batchYear || '',
      cgpa: student.academic?.cgpa ?? null,
      passions: name(student.interests?.passions).slice(0, 10),
      hobbies: name(student.interests?.hobbies).slice(0, 10),
      achievements: (student.achievements || []).slice(0, 12).map(a => ({ title: a.title, category: a.category, description: String(a.description || '').slice(0, 200), year: a.year })),
      projects: (student.projects || []).slice(0, 10).map(p => ({ name: p.projectName, type: p.projectType, technologies: (p.technologies || []).slice(0, 8), description: String(p.description || '').slice(0, 200) })),
      internships: (student.internships || []).slice(0, 8).map(i => ({ role: i.role, company: i.companyName, skills: (i.skills || []).slice(0, 6), description: String(i.description || '').slice(0, 160) }))
    };

    const hasContent = facts.achievements.length || facts.projects.length || facts.internships.length || facts.passions.length || facts.hobbies.length;
    if (!hasContent) {
      return res.json({
        success: true,
        summary: { available: false, generatedBy: 'none', note: 'Add achievements, projects, internships or interests to your profile first - your story is built from those.' }
      });
    }

    const ai = await aiGateway.generateJson({
      systemPrompt: 'You write concise, warm third-person professional-life summaries of a university student for their portfolio page. Use ONLY the provided facts. Never mention the platform, joining dates, onboarding, or account activity - the summary is about the STUDENT\'S life and work. Never invent employers, awards, numbers or skills. 2-4 sentences, then 3-5 short highlight bullets.',
      schemaHint: '{"summary":"2-4 sentences about the student\'s journey","highlights":["short highlight"],"themes":["2-4 word theme"]}',
      userPrompt: `VERIFIED PROFILE FACTS:\n${JSON.stringify(facts)}`,
      temperature: 0.3
    });

    if (ai && typeof ai.summary === 'string') {
      return res.json({
        success: true,
        summary: {
          available: true,
          generatedBy: 'ai',
          summary: String(ai.summary).slice(0, 900),
          highlights: (Array.isArray(ai.highlights) ? ai.highlights : []).slice(0, 6).map(item => String(item).slice(0, 160)).filter(Boolean),
          themes: (Array.isArray(ai.themes) ? ai.themes : []).slice(0, 4).map(item => String(item).slice(0, 40)).filter(Boolean)
        }
      });
    }

    // Deterministic fallback: composed purely from stored profile fields.
    const bits = [];
    if (facts.department) bits.push(`${facts.department} student${facts.batchYear ? ` (class of ${facts.batchYear})` : ''}`);
    const skills = [...facts.passions, ...facts.hobbies].slice(0, 6);
    if (skills.length) bits.push(`drawn to ${skills.slice(0, 3).join(', ')}${skills.length > 3 ? ` and ${skills[3]}` : ''}`);
    if (facts.internships.length) bits.push(`with hands-on experience as ${facts.internships.map(i => `${i.role} at ${i.company}`).slice(0, 2).join(' and ')}`);
    if (facts.projects.length) bits.push(`having built ${facts.projects.length} recorded project${facts.projects.length === 1 ? '' : 's'}${facts.projects[0]?.name ? `, including ${facts.projects[0].name}` : ''}`);
    const highlights = [];
    facts.achievements.slice(0, 4).forEach(a => highlights.push(`${a.year ? `${a.year} - ` : ''}${a.title}`));
    facts.projects.slice(0, 3).forEach(p => highlights.push(`${p.name}${p.technologies?.length ? ` (${p.technologies.slice(0, 3).join(', ')})` : ''}`));
    return res.json({
      success: true,
      summary: {
        available: true,
        generatedBy: 'fallback',
        summary: `${facts.name} is ${bits.join(', ')}.`.replace(/\.\./g, '.') + (facts.cgpa ? ` Academically strong with a CGPA of ${facts.cgpa}.` : ''),
        highlights: highlights.slice(0, 5),
        themes: skills.slice(0, 3),
        note: 'AI summary unavailable - composed directly from your profile.'
      }
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
});

module.exports = router;
