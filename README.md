# PathfolioApp — College ERP Platform

> "Every student leaves college not just with a degree, but with a living record of who they became — and a clear, evidence-based view of where that record can take them next."

PathfolioApp is a modular college ERP built around three role-based portals — **Student**, **Recruiter**, and **Admin (T&P cell)** — on top of a shared public site, onboarding journey, and design system. The codebase follows a feature/module-oriented architecture so each portal and domain can evolve independently.

---

## 1. Project Overview

- **Public site** (`/`): Landing page, policies, the student/recruiter onboarding entry, and the 12-stage student onboarding journey.
- **Student portal** (`/dashboard`, `/profile`, `/placement`, …): Profile dossier (academic, schooling, internships, achievements), resume management, placement opportunities, story timeline, and account settings.
- **Recruiter portal** (`/recruiter`): job-post submission with eligibility criteria (published only after admin approval), shared-candidate referrals, and pipeline overview.
- **Admin portal** (`/admin`): T&P operations workspace — job approval & publishing, admin-only student search/filtering, recruiter candidate shares, users, companies, application review, and a JD analyser.

All three portals share one authentication session, one design system, and one REST API. Route access is enforced centrally; users cannot enter a portal they are not authorized for.

---

## 2. Technology Stack

### Frontend (`/frontend`)
- **Framework**: React 18 + Vite
- **Routing**: React Router DOM 6 (central route table + reusable guards)
- **Styling**: Design-token vanilla CSS (`tokens.css`, `global.css`, colocated module CSS)
- **Typography**: Editorial Serif (_Newsreader_) + Sans-Serif (_Plus Jakarta Sans_)
- **Icons**: Lucide React
- **Aesthetic**: Calm, academic, editorial minimalism (warm cream backgrounds, white content surfaces, sage & forest green accents, dark charcoal typography)

### Backend (`/api`)
- **Runtime**: Node.js & Express (CommonJS)
- **Architecture**: Domain modules (each owns routes, controllers, services, validation, and data access) + shared infrastructure (auth middleware, error handling, utilities)
- **Persistence**: MySQL (production) with a development-only volatile in-memory mode
- **Storage**: Cloudinary (avatars, logos, attachments) and Cloudflare R2 (resumes, academic documents)

---

## 3. Architecture

```text
Pathfolio-Web/
├── package.json                     # Root workspace orchestration
├── README.md
├── api/                             # Independent Express REST API
│   └── src/
│       ├── app.js                   # Express app: middleware + module mounting
│       ├── server.js                # Server bootstrap & lifecycle
│       ├── config/                  # Environment configuration
│       ├── modules/                 # Domain modules (business ownership)
│       │   ├── auth/                #   login, logout, sessions, me
│       │   ├── onboarding/          #   12-stage email-first registration & verification
│       │   ├── students/            #   profile dossier, academics, settings
│       │   ├── recruiters/          #   own job posts (submit for approval), shared candidates
│       │   ├── admin/               #   users, companies, job posts, JD analyser
│       │   ├── applications/        #   student-facing opportunities & apply
│       │   ├── resumes/             #   resume upload, tags, R2 storage
│       │   ├── notifications/       #   in-app notifications
│       │   └── preferences/         #   cookie / consent preferences
│       └── shared/                  # Cross-module infrastructure
│           ├── authenticate.js      #   session auth (cookie → req.student)
│           ├── requireAdmin.js      #   admin-only guard
│           ├── requireRecruiter.js  #   recruiter-or-admin guard
│           ├── errorHandler.js      #   centralized error handling
│           └── textMatch.js         #   JD/profile term matching
│
└── frontend/                        # React + Vite client
    └── src/
        ├── App.jsx                  # App shell: providers + router
        ├── app/
        │   ├── router/              #   AppRoutes (route table) + guards
        │   ├── providers/           #   AuthProvider (authentication state)
        │   ├── config/              #   roles.js (authorization helpers)
        │   └── services/            #   auth, consent, notification APIs
        ├── layouts/                 # Portal layouts
        │   ├── PortalShell.jsx      #   shared workspace chrome
        │   ├── PublicLayout/        #   marketing & policy pages
        │   ├── AuthLayout/          #   sign-in / password recovery
        │   ├── StudentLayout/       #   student nav + portal switcher
        │   ├── RecruiterLayout/     #   recruiter nav + portal switcher
        │   └── AdminLayout/         #   admin nav + portal switcher
        ├── modules/                 # Feature modules by portal
        │   ├── public/              #   landing, policies, 404
        │   ├── auth/                #   sign-in, forgot password,
        │   │   └── onboarding/      #   12-stage onboarding journey (email-first)
        │   ├── student/
        │   │   ├── dashboard/       #   welcome + progress overview
        │   │   ├── story/           #   living timeline
        │   │   ├── profile/         #   dossier pages, modals, services, utils
        │   │   ├── placements/      #   opportunity list + apply flow
        │   │   ├── resume/          #   PDF resume manager
        │   │   └── settings/        #   account, security, privacy controls
        │   ├── recruiter/           #   container + search/jobs components
        │   └── admin/               #   container + 5 workspaces
        ├── components/
        │   ├── ui/                  #   Button, Badge, Modal, StatCard, …
        │   └── layout/              #   public Header / Footer
        ├── hooks/                   #   shared hooks (useDebounce)
        └── styles/                  #   tokens.css, global.css
```

---

## 4. Frontend Structure

### App layer (`src/app/`)
- **`router/AppRoutes.jsx`** — the single route table. Routes are grouped by portal (`public`, `auth`, `student`, `recruiter`, `admin`); every protected route is wrapped by a guard.
- **`router/guards.jsx`** — reusable guards: `RequireAuth` (signed-in + onboarded), `RequireRole` (portal authorization), `GuestRoute`, `OnboardingRoute`, `OnboardingCompleteRoute`.
- **`providers/AuthProvider.jsx`** — centralized authentication state (`useAuth()`), session bootstrap, login/logout/refresh.
- **`config/roles.js`** — authorization helpers (`roleOf`, `isAdmin`, `isRecruiter`, `allowedPortals`, `homeFor`). Portal checks never appear inline in pages.
- **`services/`** — cross-portal API clients (auth, notifications, cookie consent).

### Layouts (`src/layouts/`)
`PortalShell` implements the shared workspace chrome (brand, sidebar, top bar with notifications and avatar, compact footer) once. Each portal layout supplies only its navigation items and portal switcher:

- `StudentLayout` — Dashboard, My Profile, Story, Placement Portal, Settings
- `RecruiterLayout` — Overview, My job posts, Shared candidates
- `AdminLayout` — Overview, Job posts, Companies, Applications, Users, JD analyser

Recruiters and admins also see the **portal switcher**, allowing one account to move between authorized workspaces.

### Modules (`src/modules/`)
Each module owns its pages, components, services, and utilities. Cross-portal imports go through `components/ui`, `app/`, or `hooks/` — modules never reach into another module's internals.

- **`public/`** — LandingPage, PolicyPages, NotFoundPage.
- **`auth/`** — SignInPage (portal-aware), ForgotPasswordPage, CompletionPage, plus the full `onboarding/` journey (stage renderer, context, types).
- **`student/`**
  - `dashboard/` — profile progress, journey milestones, quick actions.
  - `story/` — chronological narrative timeline.
  - `profile/` — `pages/` (view + edit), `components/` (internship modals), `services/profileApi.js`, `utils/` (completeness score, internship formatting).
  - `placements/` — published opportunities list, detail view, apply flow, `opportunitiesApi.js`.
  - `resume/` — multi-resume PDF manager with role tags, `resumeApi.js`.
  - `settings/` — account settings, security (password), privacy/sharing controls.
- **`recruiter/`** — `RecruiterPage` (slim container) composing `components/`: JobPostList, JobPostCard, JobPostComposer, SharedCandidates; `utils/jobFormatting.js`.
- **`admin/`** — `AdminPage` (slim container) composing `components/`: UserWorkspace, CompanyWorkspace (+ import), JobWorkspace (approval workflow), StudentSearchWorkspace (+ share wizard), SharesWorkspace, ApplicationWorkspace, JDWorkspace; shared `utils/adminHelpers.jsx` (CSV parsing, Cloudinary upload, form primitives).

### Shared components (`src/components/`)
- **`ui/`** — genuinely cross-portal primitives: Button, Badge, Modal, StatCard/OverviewCards, NotificationPanel, AvatarEditor, AchievementIcon, PdfIcon, SignOutButton, ConsentBanner.
- **`layout/`** — public Header and Footer.

Only components used by more than one portal live here; portal-specific components stay inside their module.

---

## 5. Backend Structure

Each module in `api/src/modules/` owns its slice of the API:

| Module | Files | Owns |
| --- | --- | --- |
| `auth/` | routes, service | Login, logout, session cookie, `/me` |
| `onboarding/` | routes, controller, service | Username/roll verification, registration, consent enforcement |
| `students/` | routes, controller, service, uploads, `studentStore` | Profile dossier CRUD, academics, settings, notifications store |
| `recruiters/` | routes, `recruiterShare.service` | Own job-post management with submit-for-approval, shared-candidate referrals (no student search) |
| `admin/` | routes, services, `adminContentStore`, `studentSearch.service` | Users & roles, companies, job approval/publishing, admin-only student search, shares, applications, JD analyser |
| `applications/` | routes | Student-facing opportunity feed and application submission |
| `resumes/` | routes, controller, validation, upload, store, `r2.service` | Resume upload/tags/defaults via R2 |
| `notifications/` | routes | List, read, clear in-app notifications |
| `preferences/` | routes | Cookie/consent preference recording |

`shared/` holds infrastructure used across modules: session authentication (`authenticate.js`), role guards (`requireAdmin.js`, `requireRecruiter.js`), centralized error handling (`errorHandler.js`), and text-matching utilities (`textMatch.js`).

Cross-module dependencies are intentional and explicit: recruiters/admin read the students store for talent data; students/resumes reuse the shared R2 service. Everything else stays module-local.

---

## 6. Authentication & Authorization

- **Authentication** (who is the user?): HTTP-only `pf_session` session cookie, validated by `shared/authenticate.js`, state managed by `AuthProvider` on the frontend.
- **Authorization** (what may they access?):
  - Frontend: `RequireRole` guards on portal routes + `roles.js` helpers.
  - Backend: `requireAdmin` / `requireRecruiter` middleware on admin/recruiter routers; blocked accounts are rejected at authentication.

A user manually entering `/admin` without the admin role is redirected to their own workspace, and the matching API routes return `403`.

---

## 7. Development Setup

### Prerequisites
- Node.js v18+
- npm v9+

### 1. Install dependencies

```bash
npm run install:all
```

_(Or install in `api` and `frontend` individually with `npm install`)_

### 2. Run both services

```bash
npm run dev
```

- Frontend (Vite): `http://localhost:5173` (proxies `/api` to the backend)
- Backend API: `http://localhost:5000`

To point the frontend at a different backend, set `VITE_API_PROXY_TARGET` in `frontend/.env.local`. Set `VITE_PORT` to change the Vite port and include that origin in the API `CLIENT_ORIGIN` (comma-separated).

### Bootstrap administrator

Set these values in the ignored `api/.env` before starting the API:

```env
BOOTSTRAP_ADMIN_EMAIL=admin@kiit.ac.in
BOOTSTRAP_ADMIN_PASSWORD=use-a-strong-password-here
BOOTSTRAP_ADMIN_NAME=Pathfolio Administrator
```

On startup, the API creates the account (or restores its admin flag if it exists). The password is hashed and never returned. In development without a database, storage is intentionally volatile and the account is recreated after each restart.

After signing in through the Admin portal, the **Users** tab supports CSV bulk import and role switching between student and recruiter. CSV columns: `fullName,email,password,role,department,batchYear,rollNumber` (template downloadable in-app).

### 3. Production pipeline

```bash
npm run start:prod
```

- Frontend: `http://localhost:5173/`
- Backend API: `http://localhost:5000/`

### 4. Running services independently

```bash
npm run dev:api      # Backend, development (port 5000)
npm run start:api    # Backend, production mode
npm run dev:frontend # Frontend, Vite dev server
npm run start:frontend # Frontend, production preview (uses VITE_HOST/VITE_PORT)
```

---

## 8. Environment Variables (`api/.env`)

| Variable | Purpose |
| --- | --- |
| `HOST` | API bind address (default `0.0.0.0`) |
| `PORT` | API port (default 5000) |
| `NODE_ENV` | `development` / `production` |
| `CLIENT_ORIGIN` | Allowed exact frontend origins, comma-separated, including scheme and port |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | MySQL connection |
| `USE_DATABASE` | Force DB mode in development (`true`) |
| `SESSION_SECRET` | Session secret (for production hardening) |
| `BOOTSTRAP_ADMIN_*` | Initial admin account (see above) |
| `STRICT_EMAIL_VERIFICATION` | `true` = registration requires a time-limited emailed verification link; `false` = dev-friendly flow (format still enforced server-side) |
| `EMAIL_VERIFICATION_TOKEN_TTL_MINUTES` | Verification link lifetime in minutes (default 60) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Server-only SMTP credentials for verification email. If strict verification is on but SMTP is missing, registration fails with a clear 503 instead of skipping verification |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_UPLOAD_FOLDER` | Image/attachment storage |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_PUBLIC_URL` | Resume & document storage |

Without database configuration, the API runs in development-only volatile mode. Production requires the database (`databaseConfigured` check on boot).

### Frontend host and API address

The frontend reads these values from `frontend/.env`:

| Variable | Purpose |
| --- | --- |
| `VITE_HOST` | Vite bind address (use `0.0.0.0` for external access) |
| `VITE_PORT` | Frontend port |
| `VITE_API_BASE_URL` | API URL embedded in the frontend production bundle |
| `VITE_API_PROXY_TARGET` | API target used by the Vite proxy |

For the production host in this deployment, use `http://139.99.121.67:25613`
for the frontend and `http://139.99.121.67:25569` for the API. Keep
`api/.env` `CLIENT_ORIGIN` aligned with the frontend URL.

---

## 9. API Structure

Public URL contract is unchanged by the restructuring.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Service health status |
| `POST` | `/api/onboarding/check-email` | Institutional email format + early duplicate detection; returns the derived roll number |
| `POST` | `/api/onboarding/verify-roll-number` | Institutional roll verification |
| `POST` | `/api/onboarding/register` | Full payload validation with consent enforcement; returns 202 + emails a verification link when strict mode is on |
| `POST` | `/api/onboarding/verify-email` | Consumes a time-limited verification token and creates the account |
| `POST` | `/api/auth/login` / `POST /api/auth/logout` | Session management |
| `GET` | `/api/auth/me` | Current session |
| `GET/PATCH` | `/api/profile/*` | Profile dossier sections (personal, DOB, structured interests, achievements, internships, academics) |
| `PATCH` | `/api/settings/security/password` | Password change |
| `GET` | `/api/notifications` | In-app notifications |
| `GET` | `/api/opportunities` | Published job posts (students) |
| `POST` | `/api/opportunities/:id/applications` | Apply to a role (deadline + eligibility + duplicate checks) |
| `GET/POST/PATCH/DELETE` | `/api/resumes/*` | Resume upload and management |
| `GET/POST/PATCH/DELETE` | `/api/recruiter/jobs/*` | Recruiter's own job posts |
| `POST` | `/api/recruiter/jobs/:id/submit` | Submit a draft/rejected job for admin approval |
| `GET` | `/api/recruiter/shared-candidates` | Candidate lists shared by the admin (only these; no student search) |
| `GET` | `/api/recruiter/shared-candidates/:id` | Open a share (marks viewed); whitelisted profile fields only |
| `POST` | `/api/recruiter/shared-candidates/:id/feedback` | Record per-student recruiter feedback |
| `GET` | `/api/admin/students` | **Admin-only** student search/filtering (department, batch, skills, CGPA, backlogs, …) |
| `GET` | `/api/admin/students/:id` | **Admin-only** full student detail |
| `GET/POST` | `/api/admin/shares` | Share history / create a recruiter share (student shortlist) |
| `GET` | `/api/admin/recruiters` | Recruiter directory for share targeting |
| `POST` | `/api/admin/job-posts/:id/review` | **Admin-only** approve / reject (with note) a pending job |
| `POST` | `/api/admin/job-posts/:id/publish` | **Admin-only** publish an approved job to students |
| `POST` | `/api/admin/job-posts/:id/unpublish` · `/reopen` | Close a live job / reopen a closed one |
| `GET/POST/PATCH/DELETE` | `/api/admin/*` | Users, companies, job posts, applications, JD analysis |

> **Removed:** `POST /api/onboarding/check-username` (username concept removed) and
> `GET /api/recruiter/students` (recruiter talent search removed — student discovery is
> now exclusively an admin capability, shared outward via recruiter shares).

### Core workflow: recruiters never search students

```text
RECRUITER ──creates + submits job──▶ ADMIN (reviews: approve / reject+note)
ADMIN ──publishes approved job──▶ STUDENTS (discover + apply)
STUDENT applications ──▶ ADMIN (reviews, filters eligible students)
ADMIN ──shares selected students──▶ RECRUITER ("Shared candidates")
```

Job lifecycle: `draft → pending_approval → approved | rejected → published → closed`.
Share lifecycle: `shared → viewed → feedback`.

Smoke tests: `npm run test:smoke` (onboarding/auth/profile workflows) and `npm run test:tnp`
(the complete recruiter → admin → student → admin → recruiter workflow) from `api/`.

---

## 10. Adding a New Module

**Backend**

1. Create `api/src/modules/<domain>/` with `\<domain>.routes.js` and, as needed, controller/service/model files.
2. Use `shared/authenticate.js` (+ role guards) for protection.
3. Mount the router in `api/src/app.js` under its public path — the URL contract stays stable.

**Frontend**

1. Create `frontend/src/modules/<portal>/<feature>/` with page/component files colocated with any feature-specific service or utils.
2. Register the route in `src/app/router/AppRoutes.jsx` inside the portal's guarded block.
3. Add navigation in the portal's layout (`src/layouts/<Portal>Layout/`).

**Rules of thumb**

- Shared UI goes to `components/ui/` only when used by 2+ portals.
- Cross-module needs go through `shared/` (backend) or `app/` + `components/` (frontend) — never by reaching into another module's internals.
- Reuse existing design tokens (`styles/tokens.css`); do not introduce arbitrary values.
- Keep state local to components; use `AuthProvider` only for session concerns.

---

## 11. Scope Demarcation

### Implemented
- [x] Public landing page and policy pages
- [x] Onboarding entry with explicit **Student / Recruiter** paths; recruiter onboarding is **invite-only** (`placement@kiit.ac.in`)
- [x] 12-stage student onboarding: **email-first** (`rollnumber@kiit.ac.in`), roll number derived and locked, DOB picker (age calculated, never stored as source of truth), structured interests/curiosities (proficiency + optional reason), consent enforcement
- [x] Optional strict email verification (`STRICT_EMAIL_VERIFICATION`) with hashed, single-use, time-limited tokens sent over SMTP
- [x] Roll number + email uniqueness enforced server-side (unique DB columns)
- [x] Student portal: profile dossier, academics/schooling/transcripts, internships, achievements, resumes, story, placements, settings
- [x] Recruiter portal: job-post creation + **submit for approval** (recruiters cannot publish), shared-candidate referrals with feedback; **no talent search**
- [x] Admin portal: job approval workflow (approve / reject-with-note / publish / close / reopen), **admin-only student search & filtering**, **recruiter shares** (student shortlists) with audit-friendly status trail, user management, companies, application review, JD analyser
- [x] Role-based portal access (frontend guards + backend middleware); recruiter↔student discovery boundary enforced server-side
- [x] Notification center, cookie consent, responsive layout, WCAG 2.1 AA focus/keyboard support

### Future modules
- Career prediction & mentoring workflows
- Interview scheduling within the recruiter portal
- Institutional reports & analytics exports
- Full SSO / LDAP integration
