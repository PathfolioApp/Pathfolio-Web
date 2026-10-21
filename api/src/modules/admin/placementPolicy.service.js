const store = require('./adminContentStore');

const DEFAULT_POLICY = {
  enabled: true,
  upgradeMultiplier: 1.5,
  maxOffersAllowed: 2,
  brackets: [
    { id: 'tier_1', name: 'Standard (< 7 LPA)', minLpa: 0, maxLpa: 7.0 },
    { id: 'tier_2', name: 'Dream (7 - 14 LPA)', minLpa: 7.0001, maxLpa: 14.0 },
    { id: 'tier_3', name: 'Super Dream (14+ LPA)', minLpa: 14.0001, maxLpa: null }
  ]
};

class PlacementPolicyService {
  getDefaultPolicy() {
    return JSON.parse(JSON.stringify(DEFAULT_POLICY));
  }

  async getPolicy() {
    const p = await store.getPlacementPolicy();
    const mult = Number(p?.upgradeMultiplier || p?.minCtcMultiplier) || 1.5;
    return {
      ...p,
      upgradeMultiplier: mult,
      minCtcMultiplier: mult
    };
  }

  async updatePolicy(config, adminId) {
    const current = await this.getPolicy();
    const mult = Number(config.upgradeMultiplier || config.minCtcMultiplier) || current.upgradeMultiplier || 1.5;
    const updated = {
      ...current,
      enabled: config.enabled !== undefined ? Boolean(config.enabled) : current.enabled,
      upgradeMultiplier: mult,
      minCtcMultiplier: mult,
      maxOffersAllowed: Number(config.maxOffersAllowed) > 0 ? Math.floor(Number(config.maxOffersAllowed)) : current.maxOffersAllowed,
      brackets: Array.isArray(config.brackets) && config.brackets.length > 0 ? config.brackets : current.brackets
    };
    return store.savePlacementPolicy(updated, adminId);
  }

  /**
   * Determine the LPA (Lakhs Per Annum) for a given job post.
   */
  getJobLpa(job) {
    if (!job) return null;
    if (job.eligibility?.ctcLpa !== undefined && job.eligibility?.ctcLpa !== null) {
      return Number(job.eligibility.ctcLpa);
    }
    const max = Number(job.salaryMax);
    const min = Number(job.salaryMin);
    const val = Number.isFinite(max) && max > 0 ? max : (Number.isFinite(min) && min > 0 ? min : null);
    if (!val) return null;
    // If salary is stored as full INR (e.g. 800000), convert to LPA (8.0)
    return val > 1000 ? Number((val / 100000).toFixed(2)) : val;
  }

  /**
   * Determine which bracket a CTC falls into.
   */
  getBracketForLpa(lpa, brackets = DEFAULT_POLICY.brackets) {
    if (lpa === null || lpa === undefined || !Number.isFinite(lpa)) return null;
    for (const b of brackets) {
      const min = Number(b.minLpa || 0);
      const max = b.maxLpa !== null && b.maxLpa !== undefined ? Number(b.maxLpa) : Infinity;
      if (lpa >= min && lpa <= max) {
        return b;
      }
    }
    return brackets[brackets.length - 1] || null;
  }

  /**
   * Retrieve all confirmed placement offers for a student.
   * Applications with status 'selected' or 'placed'.
   */
  async getStudentOffers(studentId, { applications, jobs = [] } = {}) {
    const allApps = applications || await store.listStudentApplications(studentId);
    const studentApps = allApps.filter(
      app => app.studentId === studentId && ['selected', 'placed'].includes(String(app.status).toLowerCase())
    );

    const jobMap = new Map(jobs.map(job => [job.id, job]));
    const missingIds = [...new Set(studentApps.map(app => app.jobPostId).filter(id => !jobMap.has(id)))];
    for (const job of await store.getJobPostsByIds(missingIds)) jobMap.set(job.id, job);
    const offers = [];
    for (const app of studentApps) {
      const job = jobMap.get(app.jobPostId);
      const lpa = this.getJobLpa(job);
      offers.push({
        applicationId: app.id,
        jobPostId: app.jobPostId,
        companyName: job?.companyName || 'Unknown company',
        jobTitle: job?.title || 'Unknown role',
        status: app.status,
        ctcLpa: lpa,
        placedAt: app.updatedAt || app.createdAt
      });
    }

    return offers.sort((a, b) => (b.ctcLpa || 0) - (a.ctcLpa || 0));
  }

  /**
   * Evaluate whether a student is eligible to apply for a role under the Placement Upgrade Policy.
   */
  async createEligibilityContext(studentId, source = {}) {
    const policy = await this.getPolicy();
    const offers = policy.enabled ? await this.getStudentOffers(studentId, source) : [];
    return { policy, offers };
  }

  async evaluateUpgradeEligibility(studentId, job, context = null) {
    const { policy, offers } = context || await this.createEligibilityContext(studentId);
    if (!policy.enabled) {
      return { eligible: true, issues: [], offers: [], policy };
    }

    if (!offers || offers.length === 0) {
      return { eligible: true, issues: [], offers: [], policy };
    }

    const issues = [];
    const maxAllowed = policy.maxOffersAllowed || 2;
    if (offers.length >= maxAllowed) {
      issues.push(`You have reached the maximum allowed campus offers (${offers.length}/${maxAllowed})`);
      return { eligible: false, issues, offers, policy };
    }

    const highestOffer = offers[0];
    const currentHighestLpa = Number(highestOffer.ctcLpa);
    const currentBracket = this.getBracketForLpa(currentHighestLpa, policy.brackets);

    const targetJobLpa = this.getJobLpa(job);
    if (targetJobLpa === null || !Number.isFinite(targetJobLpa)) {
      // If the job does not declare CTC, placement cell typically requires verification
      return { eligible: true, issues: [], offers, policy };
    }

    const targetBracket = this.getBracketForLpa(targetJobLpa, policy.brackets);

    // Rule 1: Cannot apply to the same or lower bracket
    if (currentBracket && targetBracket) {
      const currentIdx = policy.brackets.findIndex(b => b.id === currentBracket.id);
      const targetIdx = policy.brackets.findIndex(b => b.id === targetBracket.id);

      if (targetIdx <= currentIdx) {
        issues.push(
          `You already hold an offer in ${currentBracket.name} (${currentHighestLpa} LPA). Placement policy prohibits applying within the same or lower bracket.`
        );
        return { eligible: false, issues, offers, policy };
      }
    }

    // Rule 2: Multiplier check (e.g. 1.5x of current CTC)
    const multiplier = Number(policy.upgradeMultiplier) || 1.5;
    const requiredLpa = Number((currentHighestLpa * multiplier).toFixed(2));
    if (targetJobLpa < requiredLpa) {
      issues.push(
        `Placement upgrade policy requires at least a ${multiplier}x CTC jump (minimum ${requiredLpa} LPA) based on your current ${currentHighestLpa} LPA offer. This role offers ${targetJobLpa} LPA.`
      );
      return { eligible: false, issues, offers, policy };
    }

    return { eligible: true, issues: [], offers, policy };
  }
}

module.exports = new PlacementPolicyService();
