# JD-to-resume content policy

The tailoring engine targets bachelor students and entry-level applicants. Gemini remains the first provider, followed by Groq and a deterministic profile fallback. This change concerns generated content; the shared A4 templates, print CSS, margins, spacing, and PDF export implementation are unchanged.

## Source accuracy and relevance

- Project technologies retain category labels. Flat lists are classified; existing grouped strings and objects retain their groups. For example: `Languages: Java, JavaScript | Backend: Node.js, Express.js | Database: MySQL`.
- Technology groups are also separated into individual skills internally. Labels are not treated as skills.
- Project and experience selection uses source identifiers or matching names, never an array-position guess. JD overlap weights languages, backend frameworks, and databases more strongly than general tooling. This is deterministic relevance ranking, not an employer ATS simulation.
- Selected entries keep source names, dates, technologies, and URLs. Work/project bullets now use source statements rather than free model rewrites. A model may select an existing statement, but cannot add ownership, scale, outcomes, tools or responsibilities. Matching tolerates whitespace and a final period only; it does not treat keyword overlap as proof of meaning. Common CS foundations are not added merely because the candidate has a CS degree.
- Summaries use a deterministic skills/project template. Headlines come from source context, and matched strengths come from supported skills. This deliberately trades unrestricted prose rewriting for traceability. Suggested learning actions remain advice, not claims about completed work.
- A field-level work/project audit runs before and after page fitting and fails closed on a mismatch. `tailoredMeta.contentValidation` records the policy version and the final checked-bullet count. This verifies consistency with supplied data; it cannot establish that user-entered facts are true.
- Skill groups use a deduplicated, bounded source inventory, ordered by JD relevance. The fallback follows the same rules as AI output.
- Credentials, awards, and leadership records come from the source profile. Descriptions preserve complete sentences and decimal values such as `10.0 SGPA`.
- Match percentage reports recognized JD keyword coverage against the source inventory, including source-backed capabilities omitted for space. It has no artificial minimum score and is not a calibrated hiring prediction. Unknown requirements and semantic equivalence outside the alias dictionary are not comprehensively scored.
- Composite source skills (for example, `Authentication & Authorization`) support their individual JD terms. GitHub and GitHub Actions remain separate JD requirements, while generic Spring is not double-counted alongside Spring Boot.
- A previously tailored resume is not accepted as fresh source evidence. Supplementary data comes from non-tailored source resumes, preferring a genuine primary record when available, so successive generations do not reinforce earlier AI claims.

These checks preserve evidence instead of attempting to certify arbitrary paraphrases with another model. Missing or inaccurate source data still needs user correction. Existing saved resumes are not silently rewritten; generate a new version to apply the policy. See [the claim audit](resume-claim-audit.md) for findings and limits.

## One-page enforcement

Before a newly tailored resume is returned for saving, the engine renders it with the existing default Classic Studio layout on A4, with compact mode and description condensation off. It counts native PDF pages. If content spills, it progressively removes lower-priority content: extra optional entries and descriptions, secondary bullets, less relevant skills, and eventually lower-ranked projects/experience and school records. Identity and retained project stacks are preserved. The source profile is never edited.

The engine returns only a measured one-page result. If even the minimal retained content cannot fit, it returns a validation error rather than clipping text or altering margins. Fitting has a bounded number of passes and stops further reductions after its time budget; an individual render also retains the PDF renderer's deadline.

**Chromium is now required for successful JD tailoring**, using the same runtime installation as direct PDF export. Missing Chromium or exhausted export capacity produces an error, not an unverified one-page claim. See [PDF deployment](resume-pdf-deployment.md). Each fit can involve multiple local renders; account for this work in deployment timing and load tests. Existing provider fallback timeouts have not been redesigned by this content change.

The page guarantee applies to the generated default layout at creation time. Subsequent manual edits, font/layout choices, or added content can change pagination. Existing saved resumes are not rewritten.

## Verification

```sh
npm --prefix api run test:resume-tailoring
npm --prefix api run test:resume-pdf
```

Tests use synthetic profiles and mocked providers without loading application environment credentials or connecting to the database. Coverage includes grouped/flat technology inputs, Java versus JavaScript, C versus C++, source-bound projects and credentials, unsupported numbers and tools, Gemini-first generation, deterministic ranking, zero/one/two internships, dense content reduction, A4 page size, and an error for irreducible overflow. The dense fixture is checked against all five existing templates; the production fit uses Classic. The PDF regression suite verifies the unchanged export behavior.

Chrome must be installed for the rendering tests. If it is managed outside the API browser cache, set `PUPPETEER_EXECUTABLE_PATH` in the test shell to its actual executable path.

The isolated provider matrix covers Gemini success and retries, HTTP 401/403/404/429/500/503 failures, malformed JSON, invalid resume structures, empty candidates, network errors, aborts before headers, stalled response bodies, Groq-only operation and retries, both providers failing, and no configured providers. Every successful path is measured through the real A4 renderer and its final work/project claims are audited against the source. Provider timers are checked for cleanup, and duplicate Groq model IDs are not retried. Browser-heavy suites should run with `node --test --test-concurrency=1 api/scripts/resume-tailoring.test.js api/scripts/resume-pdf.test.js` to avoid competing local renderers.

For an explicitly supplied local JSON snapshot, run `node api/scripts/resume-claims-audit.cjs INPUT.json OUTPUT.json`. Input has `student` and `resumes` fields. The command performs no database writes or provider calls. Output contains source text; keep personal snapshots/reports out of git. A flagged old paraphrase needs review and is not automatically a proven fabrication. Compare historical source versions where available; edits to a profile can make old resumes differ legitimately.

### Optional live-provider smoke test

```sh
npm --prefix api run test:resume-tailoring:live
```

This explicitly consumes provider quota. It reads only the configured Gemini/Groq settings from `api/.env`, sends the shared **synthetic** profile, and tests Gemini-first and Groq-only modes. It does not use a browser login, load students, save resumes, or modify environment variables. Each mode has a 30-second provider test budget with at most 12 seconds per attempted request; this is a smoke-test bound, not a change to the production provider deadlines. Rendering follows the engine's existing page-fit checks.

The report in `tmp/resume-tailoring-live-report.json` records the actual selected engine, HTTP statuses, timings, and page-count result without credentials or provider response bodies. A completed deterministic result does not mean the live provider succeeded: inspect `engine` and `attempts`. These checks do not replace testing the signed-in UI and save/download routes.
