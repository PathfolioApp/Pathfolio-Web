# Story AI operation

Story summaries are generated only on an authenticated POST to `/api/story/me/summary`.
GET retrieves the saved summary and never contacts a model. A summary fingerprint
covers the selected, bounded profile facts and the prompt version. Relevant edits
mark a saved summary stale. Returning to Story reloads the saved summary.

The MySQL tables `story_summaries`, `story_ai_budget`, and `story_ai_health` are
created during API initialization. Startup requires CREATE TABLE permission, like
the existing stores. Student summary rows cascade on account deletion. In-memory
storage is permitted only in development without database configuration.

## Limits and failure behaviour

Both daily allowances reset at 12:00 midnight India Standard Time (IST, UTC+05:30),
not at UTC midnight. Storage timestamps remain absolute instants; the IST offset
is applied only when identifying a quota day and its next reset.

The configured default chain is pinned `gemini-3.5-flash-lite` then
`openai/gpt-oss-120b` on Groq, followed by the profile-based fallback. Both model
IDs were checked against the configured keys’ model listings. Gemini gets up to
12 seconds and Groq up to 8 seconds inside the shared 20-second AI deadline;
storage overhead reduces the time remaining. GPT-OSS uses low reasoning effort
and hidden reasoning output. If a second Gemini model is explicitly added,
it shares that same deadline and retains a window for subsequent attempts.

Defaults in `api/.env.example` are conservative starting values, not a measured
campus capacity or a guarantee that a provider account has sufficient quota:

- 5 generation jobs per student per IST day.
- 1,000 jobs across Story per IST day; this does not meter Resume or other features.
- 4 active generation leases across API instances, 60 seconds between jobs per student.
- 20-second total AI deadline, at most 3 provider attempts, 1,600 output tokens per attempt (including reasoning where applicable).
- An ownership lease expires after 25 seconds; a late owner cannot overwrite a replacement.

For example: a student generating a summary once and explicitly regenerating it
twice uses 3 of their 5 jobs and 3 of the campus’s 1,000 jobs for that IST day.
Opening the saved summary any number of times uses no new job. The campus cap is
shared: 200 students each using 5 jobs would exhaust 1,000 jobs. There is no cap on
how many students may browse Story.

Concurrency 4 means up to 4 writing jobs at the same time, not 4 students allowed
on the website. A fifth new job gets a busy response and may retry shortly; it
is not automatically queued. Duplicate requests for the same active job join it
and are not charged again. The 60-second cooldown is measured from job start,
not from the last time the student viewed Story.

The 20-second deadline covers all provider attempts together, not 18 seconds for
each model. 1,600 output tokens is an internal response-length budget per attempt,
not a student allowance or an exact number of words.

Failed jobs consume the allowance conservatively. Cached reads do not. Quotas and
leases use a short transaction locking the shared budget row; model calls happen
after commit. The cap counts generation jobs, not provider requests or dollars:
plan for up to 3 provider attempts per job. Provider usage is logged when returned.
Configure actual provider billing/spending caps separately.

With `AI_PROVIDER=auto`, existing AI_API_KEY takes precedence, followed by Gemini
and Groq as configured. `STORY_AI_GEMINI_MODELS` accepts up to 2 account-supported
model IDs; only one is configured by default. Explicit AI_PROVIDER settings are
respected. Invalid credentials and quota errors skip further attempts on that
provider; health cooldowns persist in MySQL for Story. Other gateway callers have
independent process-local scope cooldowns. No prompt, student ID, profile content,
API key, or provider response body is included in generation logs.

When providers fail, a neutral profile-based summary is saved and reused for
3 minutes unless the student explicitly retries, subject to allowances. A failed
regeneration preserves a current saved AI summary. Database admission failures
return 503 and do not trigger an unmetered AI request. A duplicate in-flight POST
returns 202; the client polls GET. Expired leases permit a new job after cooldown.

Only names, academics, interests, milestones, projects, and experience are sent.
Contact data, date of birth, documents, URLs, and family context are excluded.
Model instructions are separate from untrusted profile data. Strict type/length
validation is enforced; it cannot prove every generated statement is factual.
The page asks students to review wording before sharing. Provider retention and
data-use terms must be checked for the actual campus provider agreement.

## Verification

Run `npm run test:story --prefix api` for isolated synthetic-profile/provider tests.
The MySQL integration case is skipped unless all required scratch-database
credentials are supplied using STORY_TEST_DB_HOST, STORY_TEST_DB_PORT,
STORY_TEST_DB_USER, STORY_TEST_DB_PASSWORD and STORY_TEST_DB_NAME. The schema name
must begin `pathfolio_story_test_`; never point this test at application data.
It creates minimal test tables and clears Story fixture state in that scratch schema.

Before launch, run the MySQL case and a staging burst test across multiple API
instances using mocked providers first. Observe `story_generation` and
`ai_generation` events: cache-hit ratio, success/fallback counts, latency,
input/output tokens, and storage failures. Verify quota and concurrency behaviour
under bursts and cancellation; check cold-start duration against the configured
30-second function limit. Then perform a small live-provider check with campus
credentials and confirm model access, rate limits, privacy terms and spend caps.
The global admission-row lock is deliberately short, but its contention and the
database pool must be measured under the expected peak workload.

Provider request fields follow the official [Gemini API](https://ai.google.dev/api/generate-content)
and [Groq API](https://console.groq.com/docs/api-reference) references.

## Terminal logs

Use `LOG_LEVEL=info` to see the normal Story lifecycle. `warn` hides successful
jobs and cache reads. The shared terminal logger prints all timestamps with the
explicit IST offset `+05:30`; stored timestamps remain absolute instants.

Each message has a readable `[Story AI]` prefix followed by JSON fields suitable
for filtering. A random `requestId` connects a generation's service and provider
events. It is unrelated to student identity and is not the ownership lease token.
Saved-summary GET requests log a completed read; pending polls stay quiet.

| Event/outcome | Meaning |
| --- | --- |
| `started` / `attempt_started` | Writing admitted / a particular provider and model started. |
| `success` / `ai` | Valid provider output / finished and saved AI summary. |
| `cache_hit` / `story_read` | Existing output reused, without contacting AI. |
| `joined` | Another request already owns the active generation; no new job charged. |
| `limited` | `student_cooldown`, `student_daily_limit`, or `campus_daily_limit`, with retry seconds. |
| `busy` | `concurrency_limit`: all writing slots occupied. |
| `timeout` / `http_401` / `http_403` / `http_429` | Specific attempt failure, without provider body or credentials. |
| `invalid_response` / `cooldown_skipped` | Rejected output / attempt skipped due to provider cooldown. |
| `unconfigured` / `exhausted` | No provider configured / no usable AI result within the attempts/deadline. |
| `fallback` / `preserved` | Profile-based result saved / failed regeneration kept the previous good summary. |
| `stale_completion` | A late response lost lease ownership and was discarded. |
| `story_unavailable` / `storage_failure` | Request or provider-health storage unavailable. |

Timing is recorded in milliseconds; token counts are included on completed Story
jobs and preservation events when returned by the provider. Provider attempt
events include model and attempt number. No profile text, names, emails, API keys,
student IDs, or lease tokens are written by these Story generation logs.

## Free-tier model selection (reviewed 21 October 2026)

The [Gemini model card](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)
describes Flash-Lite as optimized for low latency and high throughput; its
[pricing table](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite)
lists free input/output on the Free tier. This is a suitable starting choice for
short grounded summaries; it is not a benchmark proving best quality for every profile.
The alias gemini-flash-latest can move to a different model, so Story is pinned.

[Groq supported models](https://console.groq.com/docs/models) lists Llama 3.3 70B
as Enterprise, while GPT-OSS 120B has a documented
[Free Plan allowance](https://console.groq.com/docs/rate-limits). Your model list
contained GPT-OSS 120B and did not contain Llama 3.3 70B. Its free-plan published
limits are 30 requests/minute, 1,000/day, 8,000 tokens/minute and 200,000/day,
subject to account-specific exceptions. Limits are shared across the organization,
including any Resume traffic; our application allowances do not increase them.

Selecting a free-tier-eligible model does not switch an account from paid to free.
No billing settings were changed. Keep the provider accounts on their free plans
if zero paid usage is required. The Google free-tier pricing page also states
that submitted content can be used to improve its products: use synthetic
profiles during development and review campus data terms before real rollout.
Only model metadata was requested during this configuration check; no student
profile or live generation request was sent.
