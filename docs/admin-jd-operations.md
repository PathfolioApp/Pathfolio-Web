# Admin JD matching: behavior and limits

## Matching and eligibility

`/admin/jd` extracts requirements and ranks recorded student evidence. It does not write JDs or make hiring decisions. Regex/taxonomy extraction is conservative and cannot understand every possible qualification, exception or negation; admins must review the full description.

- Fresher ranges such as `0–1 years` retain their range. Ordinary “be” is not a B.E. degree. Negated requirement clauses do not count as positive skills. Communication alone does not imply an engineering branch.
- Named skills no longer treat Vite as React, Zustand as Redux, generic caching as Redis, or ordinary “next” as Next.js.
- CGPA must be finite and on the supported ten-point scale. Missing/invalid records, unmet degree/branch requirements and unverified positive experience requirements produce review flags. Backlog checks apply when requested. Unparsed requirements may still need review.
- UI says **parsed checks passed** or **eligibility not specified**, rather than claiming complete eligibility. The filter only includes profiles passing the parsed checks.
- Entry-level relevance labels count projects/internships with detected JD skills in that entry. They do not imply measured depth or proficiency.
- Blocked, suspended and incomplete accounts are excluded. Operator accounts with synthetic/external roll identifiers are excluded; dual-role students with six-to-twelve-digit campus roll identifiers are retained. Institutions with another roll format must adapt this rule before rollout.
- All result skill counts say **detected**, since preferred/required skills are not comprehensively separated. The strong-match summary uses the same 75 threshold as candidate labels. Scores are alignment estimates, not hiring probabilities.

## AI is explicit and optional

Deterministic matching is the default, and sends no profile text to an embedding provider. Optional AI semantic scoring sends JD and professional profile evidence to Google Gemini. The UI explains this before enabling it. The admin API accepts `useSemantic: true` only as a Boolean; other callers remain deterministic by default.

The embedding input excludes candidate name/contact fields. Project/internship descriptions, skill tags, interests and academic subject text can still contain personal information supplied by users; follow the institution's data-sharing policy before enabling AI.

If every evaluated profile has a valid semantic result, scores use 80% deterministic evidence and 20% raw cosine similarity. The old arbitrary similarity expansion and 65% AI dominance were removed. If semantic enrichment is incomplete, **all** candidates use deterministic ranking so cached and uncached profiles are not compared using different score formulas. The UI identifies the scoring mode.

## Resource limits

| Limit | Value / behavior |
|---|---|
| JD/title | 20–30,000 characters / maximum 200 characters |
| Text upload | .txt or .md, maximum 100 KB; backend character limit still applies |
| Cohort analyses | Maximum two active per API process; excess requests get retryable 503 |
| Admin request rate | Ten analyses per minute per IP/admin key |
| Candidate embedding workers | Four per analysis |
| Actual provider calls | Four active across the API process; saturation falls back instead of queuing |
| Fresh embeddings | At most 24 per analysis, including the JD; cache hits do not consume this budget |
| Embedding deadline | Eight-second enrichment budget; individual provider call maximum four seconds |
| Student-data wait | Bounded by a twelve-second service deadline; returns retryable 503 on timeout |
| Browser request timeout | Thirty seconds, including authentication, network and response decoding |
| Embedding input | Maximum 12,000 characters per text |
| Embedding cache | Process-local LRU, maximum 5,000 entries; successful vectors 24 hours, unavailable vectors 15 seconds |

The service deadline begins after authentication. A timed-out student query is not forcibly cancelled in MySQL; database pool/retry settings still govern its completion. These limits prevent unbounded provider fan-out, not every source of deployment latency.

401/403/429 responses trigger a sixty-second provider cooldown, 5xx responses five seconds. Invalid, wrong-dimension, nonfinite and zero vectors are rejected. Concurrent requests for the same task/text share one in-flight computation. Cache identity includes embedding model, dimensions, version and query/document task.

Legacy `api/storage/embeddings.json` entries are no longer loaded or synchronously rewritten. Cache contents warm again after a restart; no legacy file is deleted. Limits/cache/cooldown are **per process**, not cluster-wide quotas. Multi-instance deployments require a shared limiter/cache if aggregate provider quotas must be enforced.

## Verification

```sh
npm --prefix api run test:jd
npm --prefix frontend run build
```

The command runs 17 audit checks plus 29 targeted Node regression tests; all passed after remediation. The frontend production build also passed. Tests use synthetic students and controlled provider responses; they never load .env or transmit actual profiles. Coverage includes outages, invalid vectors, stalled bodies, concurrency, budgets, cache separation/deduplication, cohort overload, eligibility review, role filtering, incomplete semantic fallback and no-AI default behavior.

Live browser retesting with AI off confirmed the corrected 0–1 years range, absent degree requirement, and exclusion of negated Java. Both the edge case and built-in sample evaluated 121 profiles. The sample retained minimum CGPA 7 and nine skills, and its responsibilities no longer included the role heading or degree requirement. Parsed-check filtering returned 55 profiles and restored 121 when cleared; nonexistent-name search and stale-result clearing worked. No candidates were shortlisted, shared, contacted or changed.

An earlier live attempt hit the old fifteen-second frontend timeout. A direct read-only timing check with AI disabled took about nine seconds against the configured database; the browser timeout is now thirty seconds and the service has an explicit student-data deadline. Both final browser runs completed successfully. This is not a latency SLA or a sustained load benchmark.

Testing optional AI with real cohort text requires authorization to send that data to Google. The final live checks used AI off, while AI success/failure/concurrency checks used controlled responses.

Database-backed browser latency and sustained multi-admin/multi-instance load still need staging measurement before a campus-wide launch. Existing resume generation, Puppeteer, PDF layout/export/download logic and environment values are outside this change.
