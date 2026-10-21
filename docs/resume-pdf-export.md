# Resume Studio PDF export

**Export PDF** sends the current editor's printable HTML to the authenticated
`POST /api/resumes/export-pdf` endpoint and downloads a native Chromium PDF.
Unsaved edits, template, section order, compact mode, and condensed descriptions
are included. The existing HTML generator and its print margins are shared with
**Print**, so there is no separate PDF template to keep synchronized.

The resume library and detail page download saved records through
`GET /api/resumes/:resumeId/file?mode=download`. Uploaded PDFs retain their
original file bytes. Records with structured data but no uploaded file are
rendered using the shared Studio formatter in `shared/resume/resumeDocument.mjs`,
including labeled hyperlinks, skill categories, section order, and print CSS.
Studio saves the template, compact density, and description condensation alongside
the structured data in `studioLayout`. Download uses those saved settings; Save
or Save As Copy captures the current settings together with the current content.
Older records without settings use Classic and the same density thresholds as
Studio, measured after fonts load. They are not forced onto one page if their
content genuinely needs more pages.
Native CSS page margins (14mm vertically, 18mm horizontally) replace repeating
table spacer rows, so margins cannot create a blank trailing page.
`mode=view` also uses the shared formatter for its HTML preview.
Both download buttons validate the response type and PDF signature before
saving, so an HTML preview or JSON error cannot be saved as a broken `.pdf`.

Native PDF text and link annotations avoid the Microsoft Print to PDF driver
that converted text to outlines and discarded hyperlinks. **Print** remains
available as a fallback; select the browser's **Save as PDF** destination there.
A website cannot force that destination in the browser's print dialog.

## Local setup and deployment

For the dashboard settings, build commands, environment variables, and deployed
verification steps, see [Deploy on Render and Vercel](resume-pdf-deployment.md).

Use Node.js 22.12 or newer (required by the installed Puppeteer version).
Install API dependencies normally, then restart the API. Puppeteer downloads
Chrome for Testing during installation. If lifecycle scripts were disabled by
the package manager, run from the project root:

```sh
pnpm --dir api run pdf:install-browser
```

The API process must be able to read and execute that browser. In deployments,
install it under the same OS user, keep its browser cache available at runtime,
or set `PUPPETEER_EXECUTABLE_PATH` to a compatible server-installed Chrome.
Linux servers also need Chrome's system libraries and a functioning sandbox;
do not disable the sandbox to work around a hosting configuration problem.
Puppeteer's [installation guide](https://pptr.dev/guides/installation) and
[troubleshooting guide](https://pptr.dev/troubleshooting) describe the platform requirements.

**Vercel:** the current project uses a 30-second serverless function. Installing
Puppeteer during a build does not ensure its browser cache is included in that
function. Before enabling this in production there, supply and verify a
serverless-compatible Chromium runtime (including native libraries, sandbox,
bundle size and cold-start limits), or run the API on a host/container with
Chrome installed. The default implementation is verified on the local Windows
API; it is not a verified Vercel Chromium deployment. A missing browser returns
a useful error directing the user to Print instead of silently producing a
different PDF.

## Limits and privacy

- Authentication required; 10 requests per IP/student pair per minute using
  the existing process-local rate limiter.
- At most two simultaneous exports per API process; excess requests receive
  HTTP 503 with a short retry hint rather than entering an unbounded queue.
- HTML limited to 512 KiB; total rendering deadline 25 seconds, client wait
  35 seconds. The existing request-body limit still applies.
- One reusable browser, a new isolated browser context for every export,
  and browser shutdown after 30 idle seconds or API shutdown.
- JavaScript disabled, all document requests blocked, restrictive CSP. This
  renderer supports the existing self-contained templates, not remote images
  or custom web fonts.
- No resume content is saved by this endpoint or logged. Responses use
  `Cache-Control: no-store`; logs contain timing and byte counts only.

Concurrency and rate limits are per process, not campus-wide distributed
quotas. For multiple API instances, use shared admission control before
raising capacity. Export requires a network connection; Print remains local.

## Verification

```sh
pnpm --dir api run test:resume-pdf
```

Tests use synthetic data without database access and exercise the actual
Studio HTML generator across all five templates. They check A4 size, extracted
text, link annotations, multi-page content, condensed descriptions, invalid
inputs, authentication, download headers, rate limits, and blocked script/network
activity. Saved-record checks assert the same HTML as Studio, categorized raw
skills, labeled links, and unchanged uploaded file bytes. A dense fixture checks
one-page output and identical PDF text positions for Studio and library exports,
including the automatic density path used for older records.
