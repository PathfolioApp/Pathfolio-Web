# Deploy resume PDF export on Render and Vercel

This guide assumes **Vercel hosts the frontend and Render hosts the Express API**.
The API generates PDFs using Puppeteer (puppeteer-core) and Chromium. The frontend does not need a
browser binary. Pushing the code alone is sufficient only after this backend
setup has been verified with a successful deployed PDF export.

For export behavior, limits, and local tests, see [Resume PDF export](resume-pdf-export.md).

## 1. Configure the Render API service

Open the API service in the Render dashboard, then **Settings → Build & Deploy**.
These commands assume a **Node native runtime**, not a Docker service.

| Setting | Value |
| --- | --- |
| Root Directory | Leave empty (repository root) |
| Build Command | `npm ci --prefix api && npm --prefix api run pdf:install-browser` |
| Start Command | `npm --prefix api start` |

The repository root is required because the API imports the shared formatter
from `shared/resume/`. Setting Root Directory to `api` excludes that sibling
directory from the service. See [Render's monorepo documentation](https://render.com/docs/monorepo-support).

If you use build filters, include both `api/**` and `shared/**` so formatter
changes also trigger an API deployment. Preserve any existing paths your
deployment needs.

## 2. Configure the Render environment

Under **Environment**, add:

```env
NODE_VERSION=22.21.0
PUPPETEER_CACHE_DIR=/opt/render/project/src/api/.cache/puppeteer
```

Node 22.21.0 matches the locally tested version; the installed Puppeteer requires
Node 22.12 or newer. The cache path above assumes Render's standard repository
checkout at `/opt/render/project/src`. If your checkout location differs, use an
absolute cache path inside that deployed checkout instead.

The same `PUPPETEER_CACHE_DIR` must be available during the build and at runtime.
The explicit browser-install command handles package managers that skip
Puppeteer's dependency installation script. See
[Puppeteer's browser installation and cache guidance](https://pptr.dev/troubleshooting).

Leave `PUPPETEER_EXECUTABLE_PATH` unset unless you intentionally manage a
compatible Chromium installation yourself. Do not copy a Windows Chromium path
from the local machine into Render. Remove `PUPPETEER_SKIP_DOWNLOAD=true` from
the API service if it prevents the required browser installation.

Keep the service's existing database, authentication, storage, origins, and
other application environment variables. This setup does not replace them.
Use Render's **Save, rebuild, and deploy** option after making the changes.
See [Render environment settings](https://render.com/docs/configure-environment-variables).

## 3. Point the Vercel frontend at Render

In the Vercel project's environment variables, set:

```env
VITE_API_BASE_URL=https://YOUR-API-SERVICE.onrender.com
```

Replace the placeholder with the actual API origin or its custom domain. Do
**not** append `/api`; the frontend API client adds that prefix. Set the value
for each Vercel environment you use and redeploy the frontend because Vite embeds
it at build time. Keep the API's allowed frontend origins and existing cookie
configuration consistent with your deployed domains.

If this value is empty, frontend API requests use the Vercel site's own
`/api/...` routes. This repository also has a Vercel API function, so deploying
Render does not automatically mean the frontend is calling it. Confirm in the
browser's Network panel that PDF requests go to the intended Render API.

## 4. Verify the deployed feature

After both deployments finish:

1. Sign in and open a resume in Studio.
2. Save the resume to capture its current content, template, and density settings.
3. Select **Export PDF** and open the downloaded document.
4. Return to the resume library and select **three dots → Download PDF** for
   the same saved Studio resume. Also check Download PDF on its detail page.
5. Verify page count, spacing, selectable text, and clickable profile/project links.
6. Check Render logs for `[Resume PDF] Export completed.` and confirm that there
   are no browser-launch errors.

An uploaded original PDF is downloaded unchanged. To compare it with an edited
Studio version, use the saved Studio copy rather than the original uploaded record.

The browser should download a PDF without opening the print dialog. The separate
**Print** action remains available; choose the browser's **Save as PDF** destination
when using that fallback.

## Troubleshooting

| Symptom or log | What to check |
| --- | --- |
| `Could not find Chromium` | Confirm the browser-install step succeeded and the same absolute cache directory is available to the API runtime. Rebuild after changing the cache setting. |
| A shared formatter module cannot be found | Leave Render Root Directory empty and include `shared/` in the deployment. |
| Chromium reports a missing `.so` library | The runtime lacks a Linux dependency. Use a properly configured host/container with the required libraries; downloading Chrome alone does not install those system packages. |
| `No usable sandbox` or a sandbox launch error | The host must support Chromium's sandbox or provide a suitable isolated browser runtime. Do not disable the sandbox as a blanket fix for rendering user-supplied documents. |
| Requests still go to the Vercel API | Correct `VITE_API_BASE_URL` and rebuild/redeploy the frontend. |
| Browser killed, service restarts, or timeouts | Inspect runtime logs and memory/CPU usage. Check the hosting plan can run Chromium within the application's rendering deadline. |
| Studio and library downloads differ | Save Studio changes first and compare the same saved record. Unsaved content is included only in the current Studio export. |

Puppeteer's [Linux dependencies and sandbox troubleshooting](https://pptr.dev/troubleshooting)
describe the runtime prerequisites. Render's native runtime is not verified for
this project's Chromium configuration yet; these settings establish installation
and routing, but successful deployed export is the final verification. If native
hosting lacks the necessary system support, use a compatible API host/container
and repeat the checks above.

## If the API also runs on Vercel

The Render setup does not configure Vercel's API function. That deployment needs
a serverless-compatible Chromium runtime and verified bundle size, native
libraries, browser isolation, memory, and cold-start behavior within the existing
30-second function limit. Installing Puppeteer during the Vercel build does not
guarantee its browser cache is present in the deployed function.

Until that separate setup is implemented and tested, route the frontend to the
Render API rather than assuming Vercel's function can generate these PDFs.

## Future deployments

After a deployed export succeeds, normal pushes can trigger both deployments
when automatic deployment is enabled. Keep `shared/` covered by deployment
filters, retain the browser-install step, and recheck PDF export after changing
puppeteer-core, Chromium, the Node version, or the hosting runtime.
