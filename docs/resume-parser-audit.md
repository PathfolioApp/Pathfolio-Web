# Resume upload, reparse, and Studio import audit

## Fixes and verification — 25 October 2026

The original findings below are retained as the baseline. The parser/import fixes are now implemented:

- AI records are checked against the record's source block. Global skills cannot establish project technologies. Source bullets and their negations are retained, and model omissions use source-only fallback data.
- Contacts come from document evidence. Date ranges are not phone numbers, institution names do not establish locations, and source annotation URLs are reconciled independently of provider output. Ambiguous URLs remain in `documentLinks` rather than being assigned to an invented destination.
- Malformed provider collections fall back safely. Corrupt PDFs return an extraction error. Text beyond 400 lines is retained, and text over the AI input cap uses complete deterministic extraction rather than silent truncation.
- The bundled PDF.js v2 reader receives independent byte arrays. A cold-process test covers pooled Node Buffer offsets, which had caused a valid fixture to fail with a bad cross-reference error on first use.
- Gemini and Groq timeouts cover response bodies, clear in `finally`, and obey a shared 28-second AI budget after local PDF extraction. Individual Gemini attempts are capped at 9 seconds, Groq at 7 seconds. The PDF and text Gemini stages each attempt one model before moving on; Groq models are deduplicated. This budget excludes object-storage access, local parsing, and database work.
- Reparse rejects incomplete/degraded output with HTTP 409 and retains saved data. Successful reparse stores one previous extraction in `analysis.previousExtraction`. MySQL persistence locks the row and compares the starting file/data before updating; concurrent edits cause a rollback. Studio updates its saved-record metadata only after success.
- Studio education import no longer borrows schooling details from the logged-in profile. The shared presentation helper no longer substitutes KIIT or Bhubaneswar for missing education facts. CSS, physical margins, density rules, print, Puppeteer, and export/download code were not changed.

Verification commands:

```sh
pnpm --dir api test:resume-parser
node --test api/scripts/resume-pdf.test.js
node --test api/scripts/resume-tailoring.test.js
pnpm --dir frontend build
```

Results: all **30 parser audit cases** and **8 provider/persistence tests** pass. The frontend production build passes. All 9 existing PDF regressions passed with Chromium outside the execution sandbox. In the broader tailoring suite, a single printing timeout occurred; the affected provider matrix was rerun separately and all 23 tests passed. No export settings were changed to obtain these results.

Live verification: uploaded the synthetic fixture as resume **61**, imported it into Studio, and reparsed that new record. Both profile/project links, exact project stack, dates, CGPA, and negated bullets remained visible; no city was added, duplicate prose disappeared, and Studio reported one A4 page. The existing primary resume was not changed. One failed upload during a development-server restart created no extra record. Screenshot: `tmp/resume-parser-audit/studio-fixed.png`.

Limitations: scanned/image-only PDFs now return an actionable 422 asking for OCR/selectable text; this implementation does not claim verified OCR. Complex columns, unusual headings, and multilingual documents still need a broader fixture corpus. Source matching is deliberately conservative and can keep original text or reject a degraded reparse rather than guess. Previous bad extraction data is not silently rewritten or migrated.

## Original audit — 24 October 2026


Date: 24 October 2026. Scope: current upload and re-extraction pipeline, source fidelity, failure handling, and Studio import. This is an audit; production parsing, rendering, margins, print, download, and PDF export code were not changed.

## Verdict

The happy path works, but the pipeline is not ready to be described as reliably source-faithful. Live testing reproduced unsupported locations and lost annotation links after reparse. Fault-injection checks also exposed unsafe replacement of existing extracted data, malformed provider-output crashes, and ungrounded AI claims.

## Live browser test

Uploaded a new synthetic one-page selectable PDF through the logged-in browser, then opened its extracted information and Studio, and used **Re-extract with AI** on that new record only. The fixture contains no phone number or location, two PDF link annotations, explicit project technologies, and negated statements. Java is a global skill but is not a project technology.

The resulting record is `source.pdf`, resume ID 60. The library grew from 13 to 14 records; the existing primary resume was not changed. Existing user PDFs were not reparsed.

| Check | Initial upload / import | After reparse |
| --- | --- | --- |
| Identity, email, degree, dates, CGPA | Preserved | Preserved |
| Project stack | JavaScript, Node.js, Express.js, MySQL; no Java leakage | Same correct stack |
| Negated claims | “Did not lead a team” and “no payment processing was implemented” preserved | Preserved |
| PDF annotation links | LinkedIn and project demo appeared as links in Studio | Both absent from the Studio preview |
| Education location | Extracted location field empty, but preview displayed **Bhubaneswar, India** beside NIT Tiruchirappalli | Field populated with **Tiruchirappalli, India**, absent from source |
| Personal location | No source location | Preview header gained **Tiruchirappalli, India**, also absent from source |
| Layout indicator | One A4 page | One A4 page |

The first incorrect city is a deterministic presentation default in the shared education formatter. The reparse introduced unsupported location data into fields. A plausible inference still violates extraction fidelity. Link disappearance is observed in the UI after reparse; provider attribution and the precise loss point were not instrumented in this live run.

Evidence: `tmp/resume-parser-audit/source.pdf`, `source.txt`, `source.png`, and `studio-reparse.png`. The screenshot contains only synthetic resume content, although the surrounding application is authenticated.

## Reproducible diagnostics

Run from the repository root:

```sh
node api/scripts/resume-parser.fixture.cjs
node api/scripts/resume-parser-audit.cjs
```

The audit deliberately exits nonzero when defects are reproduced. It makes no provider requests, reads no environment secrets, and writes no database or object-storage records. It loads production parsing and normalization code with stubbed provider and storage dependencies. Results are written to `tmp/resume-parser-audit/diagnostics.json`.

**22 checks: 8 passed, 14 failed.** These are targeted diagnostic cases, not an estimate that 64% of real uploads fail.

Passed checks:

- Non-PDF signatures are rejected.
- Plaintext fallback retains fixture name and email.
- Well-formed AI extraction retains the explicit institution.
- Groq fallback is attempted when Gemini is unavailable.
- All-provider failure reaches deterministic text fallback.
- PDF annotation URLs are retained in parser source text.
- The fixture PDF's selectable text survives extraction.
- Ownership rejection happens before object-storage access or analysis update.

Failed checks:

- A corrupt/truncated file beginning `%PDF-` can produce a successful empty analysis.
- Plaintext fallback interprets `2023 - 2027` as a phone number. This was an isolated fallback reproduction; the initial live AI upload left the phone blank correctly.
- AI-invented project technologies survive normalization.
- AI-invented employer, role, leadership, and metrics survive normalization.
- AI-invented contact data survives normalization.
- A string in place of the project array crashes normalization.
- A null education item crashes normalization.
- Provider network errors leave abort timers uncleared.
- Provider timeout is cleared before response-body parsing finishes.
- A configured Groq model can be retried as a duplicate default entry.
- An empty/failed reparse still calls the persistence update, replacing previously good extraction.
- Studio/shared normalization crashes on a null education item.
- Schooling unbundling can fill uploaded education with facts from the logged-in account profile.
- Education presentation substitutes KIIT for a generic institution and defaults missing city to Bhubaneswar.

## Priority findings

### High: extraction is not grounded against the source

`api/src/modules/resumes/resumeAnalysis.js` normalizes model output without verifying factual support for contacts, technologies, employers, roles, or claims. Resume-tailoring guardrails do not automatically protect this independent upload parser. Shape validation alone would not prevent hallucinated facts.

Add a strict extraction schema and source-evidence policy, retain unknown values as empty, and reconcile PDF annotation links independently of model output. Remove realistic example identities/project links and instructions encouraging default CS skills from the extraction prompt in `api/src/shared/gemini.service.js`.

### High: reparse can replace good data with degraded output

The analysis controller persists a returned analysis without a minimum-quality gate. A parser result with empty fields can overwrite existing extracted data. Reparse needs validation before replacement, retention of the previous successful extraction, and an explicit failure/degradation response. The live link regression also demonstrates why successful HTTP status is insufficient.

### High: Studio can add unsupported profile and campus facts

`shared/resume/resumeDocument.mjs` fills schooling details from account academics and supplies campus defaults in education presentation. The live NIT/Bhubaneswar mismatch demonstrates the visible consequence. Imported documents need source-only facts; profile enrichment should be an explicit action with provenance.

This helper is shared with document presentation. Fixing its factual defaults must preserve existing layout and export contracts and receive separate regression checks; no such changes were made in this audit.

### Medium: malformed output and invalid PDFs lack safe handling

Validate arrays and entries before normalization. A malformed model response should trigger a controlled fallback, not crash. Reject structurally unusable PDFs or return an explicit extraction failure; do not treat an empty parser result as successful extraction.

### Medium: timeouts do not bound the complete operation

Source inspection found sequential Gemini PDF attempts (4 × 50 seconds), Gemini text attempts (4 × 35 seconds), and Groq attempts (up to 4 × 25 seconds). Their nominal attempt allowances can total 440 seconds, with no shared operation deadline. That is not a measured live latency or a strict upper bound: body reads are not fully covered by the current abort handling.

Use an overall deadline, provider-model deduplication, response-body coverage, and `finally` cleanup for timers. The browser requests also need clear progress and recoverable timeout behavior. Do not increase individual timeouts as the only remedy.

## Limits of this audit

- One synthetic selectable PDF was exercised through the real UI; provider order was verified by code and mocked cases, not by deliberately failing production provider credentials.
- No scanned, password-protected, multilingual, or large multi-page PDF matrix was run.
- No concurrency/load benchmark was run.
- Export, print, PDF-download appearance, and margins were outside scope and were not changed.
- No production fix is claimed. These tests intentionally preserve evidence of current failures.
