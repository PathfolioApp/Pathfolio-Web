const crypto = require('crypto');
const router = require('express').Router();
const auth = require('../../shared/authenticate');
const studentStore = require('./studentStore');
const resumeStore = require('../resumes/resumeStore');
const auditLog = require('../../shared/auditLog.service');

/**
 * Public profile sharing (LinkedIn-style).
 *
 * A student generates a share token for their own profile; anyone with the
 * link can view a curated public projection. No authentication required to
 * VIEW (that is the point of a public link), but:
 *  - the token is a 128-bit random secret, stored hashed,
 *  - only whitelisted profile sections are ever exposed,
 *  - the student can revoke at any time,
 *  - view counts are tracked so the student sees traffic on their link.
 *
 * Tokens live in the student row itself (profileSettings.publicShare) so no
 * new table is needed and revocation is atomic with settings updates.
 */

const clean = value => String(value || '').trim();

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function newToken() {
  return crypto.randomBytes(16).toString('hex'); // 128-bit link secret
}

/** Whitelisted public projection - mirror of the shareable story, nothing else. */
function publicProjection(student) {
  const interests = list => (list || []).map(item => typeof item === 'string' ? item : item?.name).filter(Boolean);
  return {
    fullName: student.personal?.fullName || '',
    headline: student.personal?.headline || student.academic?.department || '',
    avatarUrl: student.personal?.avatarUrl || '',
    department: student.academic?.department || '',
    batchYear: student.academic?.batchYear || '',
    cgpa: student.academic?.cgpa ?? null,
    bio: student.profileSettings?.publicShare?.bio || '',
    passions: interests(student.interests?.passions),
    hobbies: interests(student.interests?.hobbies),
    achievements: (student.achievements || []).map(item => ({ title: item.title, category: item.category, description: item.description, year: item.year })),
    projects: (student.projects || []).map(item => ({
      projectName: item.projectName, projectType: item.projectType, description: item.description,
      technologies: item.technologies || [], projectUrl: item.projectUrl, repoUrl: item.repoUrl,
      startDate: item.startDate, endDate: item.endDate
    })),
    internships: (student.internships || []).map(item => ({
      role: item.role, companyName: item.companyName, description: item.description,
      skills: item.skills || [], location: item.location, workMode: item.workMode,
      startDate: item.startDate, endDate: item.endDate
    })),
    social: {
      linkedin: student.social?.linkedin || '',
      github: [student.social?.links].flat().filter(Boolean).find(link => /github\.com/i.test(link)) || '',
      portfolio: student.social?.portfolio || ''
    },
    generatedAt: new Date().toISOString()
  };
}

// ------------------------------------------------------------------ student side (auth required, the PUBLIC view route below is not)

router.get('/me', auth, async (req, res) => {
  const student = await studentStore.getStudentById(req.student.id);
  const share = student?.profileSettings?.publicShare;
  if (!share?.tokenHash || share.revoked) {
    return res.json({ success: true, share: null });
  }
  res.json({
    success: true,
    share: {
      enabled: true,
      createdAt: share.createdAt,
      viewCount: Number(share.viewCount || 0),
      lastViewedAt: share.lastViewedAt || null,
      includeResume: Boolean(share.includeResume)
    },
    // The full link is returned once at creation; afterwards we only confirm
    // it exists so the UI can say "link active" without re-leaking it.
    linkConfirmed: true
  });
});

router.post('/me', auth, async (req, res) => {
  const student = await studentStore.getStudentById(req.student.id);
  if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
  const token = newToken();
  const share = {
    tokenHash: hashToken(token),
    createdAt: new Date().toISOString(),
    viewCount: 0,
    lastViewedAt: null,
    includeResume: Boolean(req.body?.includeResume),
    bio: clean(req.body?.bio).slice(0, 500),
    revoked: false
  };
  student.profileSettings = { ...(student.profileSettings || {}), publicShare: share };
  await studentStore.saveStudent(student);
  await auditLog.record({
    actorId: student.id,
    actorName: student.personal?.fullName || 'Student',
    action: 'profile.share.created',
    entityType: 'public_profile',
    entityId: student.id,
    entityLabel: student.personal?.fullName || 'Student',
    detail: 'Public profile link generated.'
  });
  res.status(201).json({
    success: true,
    share: { enabled: true, createdAt: share.createdAt, viewCount: 0, includeResume: share.includeResume },
    url: `/p/${token}`
  });
});

router.patch('/me', auth, async (req, res) => {
  const student = await studentStore.getStudentById(req.student.id);
  const share = student?.profileSettings?.publicShare;
  if (!share?.tokenHash || share.revoked) return res.status(404).json({ success: false, message: 'No active public link.' });
  if (req.body?.includeResume !== undefined) share.includeResume = Boolean(req.body.includeResume);
  if (req.body?.bio !== undefined) share.bio = clean(req.body.bio).slice(0, 500);
  student.profileSettings.publicShare = share;
  await studentStore.saveStudent(student);
  res.json({ success: true, share: { enabled: true, createdAt: share.createdAt, viewCount: Number(share.viewCount || 0), includeResume: Boolean(share.includeResume) } });
});

router.delete('/me', auth, async (req, res) => {
  const student = await studentStore.getStudentById(req.student.id);
  const share = student?.profileSettings?.publicShare;
  if (!share?.tokenHash) return res.status(404).json({ success: false, message: 'No active public link.' });
  share.revoked = true;
  share.revokedAt = new Date().toISOString();
  share.tokenHash = null; // hard-invalidates the old link immediately
  student.profileSettings.publicShare = share;
  await studentStore.saveStudent(student);
  await auditLog.record({
    actorId: student.id,
    actorName: student.personal?.fullName || 'Student',
    action: 'profile.share.revoked',
    entityType: 'public_profile',
    entityId: student.id,
    entityLabel: student.personal?.fullName || 'Student',
    detail: 'Public profile link revoked.'
  });
  res.json({ success: true, share: null });
});

// ------------------------------------------------------------------ public side (no auth)

router.get('/p/:token', async (req, res) => {
  const tokenHash = hashToken(req.params.token);
  const students = await studentStore.listStudents();
  const student = students.find(item => item.profileSettings?.publicShare?.tokenHash === tokenHash && !item.profileSettings.publicShare.revoked);
  if (!student) return res.status(404).json({ success: false, message: 'This profile link is invalid or has been revoked.' });
  if (student.blocked || student.status === 'suspended') {
    return res.status(404).json({ success: false, message: 'This profile is not available.' });
  }
  const share = student.profileSettings.publicShare;
  // Track the view (best-effort; never blocks rendering).
  try {
    share.viewCount = Number(share.viewCount || 0) + 1;
    share.lastViewedAt = new Date().toISOString();
    student.profileSettings.publicShare = share;
    await studentStore.saveStudent(student);
  } catch { /* view counting is non-critical */ }
  const payload = { success: true, profile: publicProjection(student) };
  if (share.includeResume) {
    const resumes = await resumeStore.list(student.id);
    const featured = resumes.find(item => item.isDefault) || resumes[0] || null;
    if (featured) payload.resume = { filename: featured.filename, category: featured.category, updatedAt: featured.updatedAt };
  }
  res.json(payload);
});

module.exports = router;
