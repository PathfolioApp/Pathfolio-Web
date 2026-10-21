# Admin presentation and viewport checks

The admin visual refinement covers all 11 `/admin/:tab` workspaces, the nested
company relationship views, and their forms and dialogs. It keeps the existing
API clients, endpoint paths, authorization gates, approval rules, and payload
contracts. No production API service or route logic changes are required.

## Presentation boundaries

- `AdminExperience.css` scopes page styles to `.pf-admin-page` and shared shell
  adjustments to `.pf-admin-shell`. Container queries respond to the content
  width available beside the sidebar, rather than assuming the full viewport.
- `AdminModal` and `AdminDrawer` apply `.pf-admin-overlay` to portalled surfaces.
  Their scrolling bodies and wrapping footers remain usable on narrow screens.
- The shared Drawer gains an optional `className`; its existing default behavior
  is retained for student and recruiter call sites.
- Application rows opt into DataRow's `interactiveChildren` behavior to keep
  their own action buttons out of nested HTML buttons. The row supports keyboard
  activation while its child actions retain their existing handlers.
- Company/job save errors appear inside the open form. Closing those drawers
  while saving is ignored, and opening a form clears stale page errors.
- Overview loading and errors have visible feedback and a retry action. Its
  duplicate initial request is removed. Application counts refer to applications.

## Browser verification

From the repository root, after installing frontend and API dependencies and
Puppeteer's Chrome:

```sh
node --test api/scripts/admin-ui.test.cjs
```

This test bundles the real admin components and shared portal shell with a
synthetic auth provider. It serves a local fake API and blocks external browser
requests. It does not connect to a database, send outreach, or modify live data.

It checks all 11 workspaces at 320, 375, 768, and 1280 pixels, plus company/job
drawers, user import, candidate review, recruiter-sharing wizard, expanded
student filters, user dossiers, recruitment views, all company relationship tabs,
overview failure/retry, company save failure/success, and populated JD results.
Read-only navigation is checked for unintended API writes. Synthetic company
creation and JD analysis are explicitly handled by the local fake server.

Set `ADMIN_UI_ARTIFACTS=1` to retain screenshots in `tmp/admin-review/` for visual
inspection. Screenshot generation uses reduced motion for stable measurements.

## Workflow regression checks

```sh
node api/scripts/tnp-smoke-test.js
node api/scripts/recruitment-smoke-test.js
node api/scripts/verify-async-safety.js
```

Run the service smoke checks from the repository root with database access and AI
providers disabled in the test process. The recruitment smoke script does not
configure those environment values itself. The TnP smoke script uses volatile
storage and fixture-only Cloudinary signing credentials, and seeds a resume to
meet the existing application requirement. It checks the current nested profile
snapshot format. Neither script should use production credentials or services.

Frontend compilation:

```sh
npm --prefix frontend run build
```

These checks verify fixture-based workflows and presentation. Real uploads,
outreach delivery, production data volume, and hosting behavior still depend on
the deployed environment and are outside the mocked browser checks.
