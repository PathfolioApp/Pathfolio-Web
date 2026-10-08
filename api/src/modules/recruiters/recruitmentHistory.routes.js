const router = require('express').Router();
const authenticate = require('../../shared/authenticate');
const requireRecruiter = require('../../shared/requireRecruiter');
const store = require('../admin/recruitmentStore');
const adminContentStore = require('../admin/adminContentStore');
const studentStore = require('../students/studentStore');
const recruitment = require('../admin/recruitment.service');
const jdAnalyzer = require('../admin/jdAnalyzer.service');

/**
 * Company history & readiness snapshot for the recruiter portal
 * (/recruiter/recruitment): "recruited 100+ students last year, 60+ the year
 * before - overall positive". First visit to campus? Falls back to meaningful
 * supply-side stats (placement-ready students, top skill pools, batch size).
 */
router.use(authenticate, requireRecruiter);

const clean = value => String(value || '').trim();

router.get('/history', async (req, res) => {
  try {
    const companies = await adminContentStore.listCompanies();
    const myToken = [req.student.personal?.fullName, req.student.personal?.email].filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9]/g, '');
    const company = companies.find(item => {
      const token = clean(item.name).toLowerCase().replace(/[^a-z0-9]/g, '');
      return token.length >= 4 && myToken.includes(token);
    });

    if (!company) {
      return res.json({ success: true, history: { available: false, reason: 'no_company' } });
    }

    const [engagements, shares, applications, jobs] = await Promise.all([
      store.listEngagements({ companyId: company.id }),
      store.listShares({ companyId: company.id }),
      adminContentStore.listApplications(),
      adminContentStore.listJobPosts()
    ]);
    const companyJobs = jobs.filter(job => job.companyId === company.id);
    const jobIds = new Set(companyJobs.map(job => job.id));
    const companyApplications = applications.filter(application => jobIds.has(application.jobPostId));

    // Hires across BOTH systems: legacy applications with status selected and
    // recruitment-drive shares with a positive company response.
    const legacyHired = companyApplications.filter(application => ['selected'].includes(application.status));
    const driveHired = shares.filter(share => ['shortlisted', 'interested'].includes(share.companyResponse) && share.status !== 'revoked');

    const yearOf = iso => (iso ? new Date(iso).getUTCFullYear() : null);
    const hiresByYear = new Map();
    for (const hire of [...legacyHired, ...driveHired]) {
      const year = yearOf(hire.respondedAt || hire.updatedAt || hire.createdAt);
      if (year) hiresByYear.set(year, (hiresByYear.get(year) || 0) + 1);
    }
    const years = [...hiresByYear.keys()].sort((a, b) => b - a);
    const thisYear = new Date().getUTCFullYear();
    const totalHires = [...hiresByYear.values()].reduce((sum, count) => sum + count, 0);

    const completedDrives = engagements.filter(item => ['completed', 'confirmed'].includes(item.status));
    const positiveDrives = engagements.filter(item => item.finalOutcome && !/cancel|withdraw|reject/i.test(item.finalOutcome)).length;
    const hasHistory = totalHires > 0 || completedDrives.length > 0 || engagements.length > 0 || companyJobs.length > 0;

    // Sentiment: positive when hiring volume is growing or stable-and-present.
    let sentiment = 'neutral';
    let sentimentLabel = 'Mixed history';
    if (hasHistory) {
      const lastYear = hiresByYear.get(thisYear - 1) || 0;
      const yearBefore = hiresByYear.get(thisYear - 2) || 0;
      const recent = hiresByYear.get(thisYear) || 0;
      if (totalHires >= 5 || completedDrives.length >= 2) {
        if (recent >= lastYear && lastYear >= yearBefore && (recent + lastYear) > 0) { sentiment = 'positive'; sentimentLabel = 'Growing partnership'; }
        else if (totalHires > 0) { sentiment = 'positive'; sentimentLabel = 'Positive track record'; }
        else { sentiment = 'neutral'; sentimentLabel = 'Established relationship'; }
      } else if (totalHires > 0 || completedDrives.length > 1) {
        sentiment = 'positive'; sentimentLabel = 'Positive track record';
      }
    }

    const history = {
      available: hasHistory,
      company: { id: company.id, name: company.name, logoUrl: company.logoUrl || '' },
      totalHires,
      hiresByYear: years.map(year => ({ year, hires: hiresByYear.get(year) })),
      drivesCompleted: completedDrives.length,
      totalEngagements: engagements.length,
      jobPosts: companyJobs.length,
      applicationsReceived: companyApplications.length,
      candidatesShared: shares.filter(share => share.status !== 'revoked').length,
      sentiment,
      sentimentLabel,
      recentDrives: engagements.slice(0, 5).map(item => ({
        id: item.id, title: item.title, status: item.status, statusLabel: recruitment.STATUS_LABELS[item.status] || item.status,
        year: yearOf(item.confirmedStart || item.proposedStart || item.createdAt),
        outcome: item.finalOutcome || null
      }))
    };

    if (!hasHistory) {
      // First time on campus: give the recruiter meaningful supply-side stats.
      const students = (await studentStore.listStudents()).filter(s => !s.isAdmin && !s.isRecruiter && s.status !== 'suspended' && s.onboarding?.completed !== false);
      const skillCount = new Map();
      for (const student of students) {
        const text = jdAnalyzer.studentSkillTextPublic(student);
        for (const skill of jdAnalyzer.detectSkillsPublic(text)) skillCount.set(skill, (skillCount.get(skill) || 0) + 1);
      }
      const topSkills = [...skillCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([skill, count]) => ({ skill, count }));
      const cgpaValues = students.map(s => Number(s.academic?.cgpa)).filter(Number.isFinite);
      history.firstVisit = {
        placementReady: students.length,
        avgCgpa: cgpaValues.length ? Number((cgpaValues.reduce((sum, value) => sum + value, 0) / cgpaValues.length).toFixed(2)) : null,
        topSkills,
        note: 'First recorded recruitment engagement with this campus - here is the current talent pool you can draw from.'
      };
    }

    res.json({ success: true, history });
  } catch (error) {
    res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
});

module.exports = router;
