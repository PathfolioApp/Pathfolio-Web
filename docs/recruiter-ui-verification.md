# Recruiter responsive UI verification

The recruiter layout covers `/recruiter` and its overview, jobs, candidates, and recruitment sections. Responsive styles are scoped to this portal and its job composer in `RecruiterExperience.css`. API routes, authorization, and request payload formats are unchanged.

## Automated browser checks

From the repository root, with frontend dependencies and Puppeteer's Chrome installed:

```powershell
node --test api/scripts/recruiter-ui.test.cjs
```

To save screenshots under `tmp/recruiter-review`:

```powershell
$env:RECRUITER_UI_ARTIFACTS = '1'
node --test api/scripts/recruiter-ui.test.cjs
```

The test bundles the actual recruiter components and portal layout with synthetic authentication and a local HTTP fixture. External browser requests are blocked. It does not connect to a database, contact AI providers, or send messages to real users.

Coverage includes:

- All four views at 320, 375, 768, 1024, and 1440px, including long names, job titles, departments, skills, and conversation text.
- Job composer viewport bounds and reachable submit controls, also at 812 × 375px in landscape.
- Expanded candidates, feedback controls, history cards, proposal conversations, and navigation back to proposals.
- Mocked create/edit/submit job requests, form values preserved after a failed save, and errors visible inside the modal.
- Mocked candidate feedback, date response, message submission, and conversation summary.
- Overview failure/retry and empty job, candidate, and proposal lists.
- Browser runtime errors and horizontal document overflow.

Run the frontend production build separately:

```powershell
cd frontend
node node_modules/vite/bin/vite.js build
```

These checks verify presentation and client requests. They do not replace backend authorization tests or real-device checks for virtual keyboards and browser-specific date pickers.
