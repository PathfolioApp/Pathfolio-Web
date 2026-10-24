# Admin JD analyser audit — 24 October 2026

## Assessment

This document records the **initial audit before remediation**. The initial analyser was not ready to be described as robust for campus-scale candidate matching. Remediation and current limits are documented in [JD operations](admin-jd-operations.md); the reproducible audit now passes all 17 checks.

## Live browser evidence

- Short descriptions are rejected with visible feedback.
- The built-in frontend sample completed, extracted nine skills and minimum CGPA 7, and returned 131 evaluated profiles. The earlier suspicion that “CGPA of 7.0” would fail was disproved by testing.
- Searching for a deliberately nonexistent candidate produced zero matches; removing the search restored results.
- A second JD reproduced these failures:

| Input | Observed extraction | Expected |
|---|---|---|
| Fresher: 0-1 years | 1+ years | Preserve the fresher range |
| Candidates should be comfortable collaborating | Bachelor of Engineering | No degree requirement |
| Java is not required. Use JavaScript and React | Java included among detected/core skills | Do not count negated Java as required |

The exact second description was:

```text
Frontend Engineer
Fresher: 0-1 years of experience.
Java is not required. Use JavaScript and React to build interfaces.
Candidates should be comfortable collaborating. Strong communication skills required.
```

An administration profile also appeared among ranked results. Candidate-pool policy needs an explicit distinction between actual students with additional privileges and accounts that exist solely for administration/recruitment. Do not simply exclude every student who also has an admin role.

No candidates were shortlisted, contacted, exported, shared or modified. No job posts were created. Analysis can populate the application's embedding cache; the live run changed `api/storage/embeddings.json` through normal application behavior.

## Isolated diagnostic checks

Run from repository root:

```sh
node api/scripts/jd-analyzer-audit.cjs
```

The script uses synthetic profiles and stubbed embeddings. It loads no environment keys, performs no provider requests or database writes, and writes `tmp/admin-jd-audit.json`. It exits nonzero when expectations fail. **Initial result: 17 checks, 9 passed, 8 failed. After remediation: 17 passed.** The original failure descriptions below are retained as historical evidence.

Passing checks: short-input rejection; JavaScript/Java word boundaries; both tested CGPA wordings; deterministic scoring without embeddings; fallback when the JD embedding fails; exclusion of suspended/incomplete profiles; null legacy sections in the tested cases; missing CGPA review with a null academic section.

Failing checks:

1. Fresher 0–1 experience becomes 1+.
2. Ordinary “be” becomes a B.E. degree.
3. Negated Java becomes a requirement.
4. Soft communication skills imply an Electronics & Communication department.
5. A nonnumeric CGPA is not flagged as unknown when a minimum exists.
6. A required master's degree mismatch gets no eligibility review flag.
7. The service itself does not exclude the synthetic recruiter-only account from the candidate pool. A complete fix requires an agreed student-role policy.
8. An 80-profile synthetic cohort launches 80 candidate embedding requests at once, even with a result limit of five. The limit only slices final results.

These are targeted diagnostics, not an exhaustive test of all JD formats or all deployment conditions. The concurrency check uses simulated embedding calls; it does not constitute a live provider stress test.

## Additional code-review findings

- Requirements extraction is deterministic regex/taxonomy logic. Gemini embeddings affect ranking; there is no generative Gemini-to-Groq JD-writing chain on this page. Missing/failed embeddings retain deterministic scoring. The live UI does not reveal whether semantic scoring was actually used, so a successful UI response alone does not prove Gemini success.
- Required and preferred skills share one list. UI wording “required skills” can overstate optional requirements.
- Eligibility currently checks CGPA and active backlogs; education, experience and branch requirements are not comprehensively enforced. “No flags” is presented as meeting eligibility, which is stronger than the checks justify.
- Project/experience relevance badges are based mainly on counts and overall skill overlap, rather than evidence tied to each entry.
- Semantic scoring has substantial weight and a hard-coded similarity calibration. Those scores are not validated hiring probabilities.
- Embedding requests have individual four-second abort timers, but the overall cohort operation has no explicit end-to-end budget or bounded worker pool. Cache keys use text only, not task type/model/dimensions; cache persistence is a synchronous local JSON file. These need review before multi-instance deployment.
- The route has authentication and admin middleware in source; a full deployed authorization/security test was outside this audit.

## Priorities

First correct extraction/eligibility meanings and make unknown eligibility explicit. Then bound embedding work, deduplicate in-flight calls and add request budgets, with a visible deterministic fallback indicator. Replace relevance labels with entry-specific evidence and define the student candidate pool. Re-run the failing diagnostics and live edge-case JD before describing the fixes as complete.
