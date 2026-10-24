# Resume claim audit — 24 October 2026

## Scope and evidence

Reviewed 10 saved tailored resumes, including browser-test records 58 and 59, against the supplied original profile attachment and a fresh read-only snapshot of the configured account's profile. The database inspection used SELECT queries only. No saved resumes, primary selection, profile entries, or environment values were changed.

The offline report examined 95 work/project bullets. Against the original attachment, 4 matched source statements and 91 required wording review under the new conservative rule. **These are review flags, not 91 proven fabrications.** Many older bullets combine or paraphrase valid source statements. Historical source versions are unavailable for the oldest records, so their differences cannot all be attributed to generation.

Detailed per-record comparisons are in the ignored local `tmp/resume-browser-review/claim-audit-original.json` and `claim-audit.json` files. They contain source wording and should not be committed or published.

## Confirmed weaknesses in the earlier checks

| Generated wording | Available source | Assessment |
|---|---|---|
| SnackIt: “secure checkout workflow” (58) | Product catalog, cart and checkout functionality | Security property not supported by that project entry |
| Analyst: “cross-functional team members” (59) | Collaborated with team members to investigate data issues and validate results | Cross-functional scope not established |
| MySQL schema optimization in older resumes | Designed and integrated MySQL database operations | Optimization goes beyond integration; needs explicit source evidence |
| SnackIt contains Java in earlier outputs | Original attachment and earlier browser profile included Java; latest database snapshot excludes it | Source drift, not evidence that the earlier engine invented Java |

The earlier technology/number checks could not establish whether a responsibility, outcome, ownership claim or scale claim was supported. Earlier test results should not be interpreted as a complete semantic audit.

## Implemented policy

- Work/project bullets are selected from the corresponding source entry. Model rewrites cannot supply fresh factual sentences. Whitespace and final-period differences are permitted; the original statement is emitted.
- Source titles, employers, dates, project stacks, locations and project links are retained. A contribution from a different role is not evidence for this role.
- Summary wording uses a deterministic source-skills/project template; it does not repeat free-form model claims such as “proven enterprise expertise.” Source headlines replace generated seniority or role claims.
- Matched-strength text is derived from source-backed skill matches rather than unchecked AI assertions. Learning recommendations remain suggestions, not evidence of completed work.
- Work/project field and statement audits run before and after content fitting. A failed audit prevents the result from being returned for saving. Metadata records the policy and final checked-bullet count.
- Existing PDF templates, margins, spacing, font settings, renderer and export implementation remain unchanged. Fitting reduces content only.

This deliberately limits prose rewriting. AI can still propose selections and recommendations, while factual work/project text remains traceable. This is source consistency, not independent verification that a student's own statements are true. Uploaded source extraction can also contain errors and needs review.

## Verification and limits

- **41 regression checks passed** with sequential Node test execution, covering controlled provider responses, failures/fallbacks, adversarial claims, source leakage, post-fit content auditing and PDF regressions.
- New adversarial cases include invented leadership, enterprise scale, optimization, awards, unfamiliar tools, altered negation and reusing a number for a different claim despite matching technologies.
- Revalidated the current account snapshot through controlled Gemini, controlled Groq and deterministic paths: each had 8 checked source-backed bullets, no Java in SnackIt, and one native A4 PDF page. Old record 59's wording was deliberately used as the simulated provider response to demonstrate that the guardrail replaces it. **These were controlled responses, not fresh live-provider calls or new saved account resumes.**
- An initial cross-template test failed: Classic-fitted content overflowed Modern. The corrected test measures and fits each template independently. Production creation still measures its existing Classic default; switching templates or editing later can change pagination.
- No existing resume was silently repaired. Regenerate a new version to use the new policy. The detailed audit is a review aid, not an automatic verdict on every historical paraphrase.
- This work does not establish campus-scale throughput or eliminate the need to review source facts and the final document.
