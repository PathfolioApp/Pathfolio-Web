# PathfolioApp â€” Student Lifecycle & Career Portal (SLCP)

> **"Every student leaves college not just with a degree, but with a living record of who they became â€” and a clear, evidence-based view of where that record can take them next."**

---

## 1. Project Overview

**PathfolioApp** is a student lifecycle platform that begins by onboarding students upon college admission and progressively builds a record of their academic, personal, and professional growth across all four years.

This foundational release delivers:
1. **The Public Landing Page** (`/`): Communicating the long-term product vision, lifecycle framework, and privacy principles.
2. **The Student Onboarding Experience** (`/onboarding`): A calm, 13-stage guided journey for admitted students to establish their initial academic identity, interests, passions, milestones, and personal background context.
3. **The Genesis Completion State** (`/onboarding/complete`): A summary of the initialized profile and clear indicators for upcoming lifecycle modules.
4. **Independent Express REST API** (`/api`): Providing username availability checks, enrollment roll verification, validation, and consent-guarded registration.

---

## 2. Technology Stack & Architecture

### Frontend (`/frontend`)
- **Framework**: React 18 + Vite
- **Routing**: React Router DOM 6
- **Styling**: Design Token-based Vanilla CSS (`tokens.css`, `global.css`, modular CSS)
- **Typography**: Editorial Serif (*Newsreader*) + Sans-Serif (*Plus Jakarta Sans*)
- **Icons**: Lucide React
- **Aesthetic**: Calm, academic, editorial minimalism (warm cream backgrounds, white content surfaces, sage & forest green accents, dark charcoal typography).

### Backend (`/api`)
- **Runtime**: Node.js & Express
- **Architecture**: REST API with dedicated routes, controllers, services, middleware, and models
- **Verification Engine**: Institutional roll-number validator with mock registry data
- **Privacy & Consent Engine**: Strict section-level validation ensuring sensitive personal/family data cannot be stored without explicit student consent.

---

## 3. Project Structure

```
Pathfolio-Web/
â”œâ”€â”€ package.json                   # Root workspace orchestration
â”œâ”€â”€ README.md                      # Complete documentation
â”‚
â”œâ”€â”€ api/                           # Independent Express REST API
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ config/                # Environment variables & constants
â”‚   â”‚   â”œâ”€â”€ controllers/           # Onboarding controller logic
â”‚   â”‚   â”œâ”€â”€ middleware/            # Error handling & privacy filtering
â”‚   â”‚   â”œâ”€â”€ models/                # In-memory student data store
â”‚   â”‚   â”œâ”€â”€ routes/                # Onboarding REST routes
â”‚   â”‚   â”œâ”€â”€ services/              # Validation, verification & registration logic
â”‚   â”‚   â”œâ”€â”€ app.js                 # Express app definition
â”‚   â”‚   â””â”€â”€ server.js              # Server listener
â”‚   â”œâ”€â”€ .env                       # Local environment configuration
â”‚   â”œâ”€â”€ .env.example
â”‚   â””â”€â”€ package.json
â”‚
â””â”€â”€ frontend/                      # React + Vite Client
    â”œâ”€â”€ index.html                 # Typography & meta tags
    â”œâ”€â”€ vite.config.js             # Vite config with API proxy
    â”œâ”€â”€ package.json
    â””â”€â”€ src/
        â”œâ”€â”€ components/            # Design-system UI (Header, Footer, Button, Badge, Modal)
        â”œâ”€â”€ features/
        â”‚   â””â”€â”€ onboarding/        # Staged Onboarding Feature
        â”‚       â”œâ”€â”€ components/    # StepHeader, StepNavigation, TagSelector, AchievementManager, ConsentBox, ReviewSummary, StageRenderer
        â”‚       â”œâ”€â”€ context/       # OnboardingContext (state, validation, sessionStorage sync)
        â”‚       â”œâ”€â”€ layouts/       # OnboardingLayout (progress bar, responsive frame)
        â”‚       â””â”€â”€ types/config.js# 13 stages configuration & categories
        â”œâ”€â”€ hooks/                 # useDebounce for live username checking
        â”œâ”€â”€ pages/                 # LandingPage, OnboardingPage, CompletionPage, NotFoundPage
        â”œâ”€â”€ services/              # onboardingApi client
        â”œâ”€â”€ styles/                # tokens.css & global.css
        â”œâ”€â”€ App.jsx                # Router configuration
        â””â”€â”€ main.jsx
```

---

## 4. Getting Started & Setup

### Prerequisites
- Node.js (v18 or higher recommended)
- npm (v9 or higher)

### 1. Install All Dependencies
From the repository root:
```bash
npm run install:all
```
*(Or install in `api` and `frontend` individually with `npm install`)*

### 2. Development Mode
To start both the Express backend (`http://localhost:5000`) and Vite frontend (`http://localhost:5173`) concurrently on separate ports with hot reload:
```bash
npm run dev
# or: pnpm dev
```

### 3. Production Pipeline (`start:prod`)
To install all dependencies, build the optimized frontend bundle, and run both services independently on separate ports:
```bash
npm run start:prod
# or: pnpm start:prod
# or: pnpm prod
```

- **Frontend Client**: `http://localhost:5173/`
- **Backend API**: `http://localhost:5000/`

### 4. Running Services Independently
To run backend only:
```bash
npm run dev:api    # Development mode (port 5000)
npm run start:api  # Production mode (port 5000)
```
To run frontend only:
```bash
npm run dev:frontend   # Development Vite server (port 5173)
npm run start:frontend # Production Preview server (port 5173)
```

---

## 5. API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status |
| `POST` | `/api/onboarding/check-username` | Validates format and checks uniqueness |
| `POST` | `/api/onboarding/verify-roll-number` | Validates institutional roll format & pre-enrolled records |
| `POST` | `/api/onboarding/register` | Validates full payload with consent enforcement |
| `POST` | `/api/onboarding/complete` | Finalizes onboarding session |

### Sample Verified Roll Numbers (Pre-Enrolled Mock Data)
- `2024CS101` (Computer Science & Engineering, Batch 2024-2028)
- `2024ECE204` (Electronics & Communication, Batch 2024-2028)
- `2024DS108` (Data Science & AI, Batch 2024-2028)
- *(Any 4-16 character alphanumeric roll number is also valid in open admission mode)*

---

## 6. Onboarding Stages (13 Stages)

1. **Stage 1 â€” Welcome**: Introduction setting an academic, calm tone.
2. **Stage 2 â€” Name**: Legal / preferred full name.
3. **Stage 3 â€” Age**: Demographics (15-99) with quick selection pills.
4. **Stage 4 â€” Institutional Email**: University contact identifier.
5. **Stage 5 â€” Username**: Real-time availability check via debounced API.
6. **Stage 6 â€” Roll Number**: Connects college identity with verification feedback.
7. **Stage 7 â€” Academic Context**: Department / major and batch year cohort.
8. **Stage 8 â€” Hobbies**: Curated tag selection + searchable filter + custom entries.
9. **Stage 9 â€” Passions / Interests**: Intellectual curiosities and ambition tracks.
10. **Stage 10 â€” Initial Achievements**: Milestones, competitions, and certifications (with skip option).
11. **Stage 11 â€” Family & Personal Context**: Sensitive optional section with explicit, non-prechecked consent checkbox.
12. **Stage 12 â€” Review**: Comprehensive domain summary with inline jump-to-stage edit triggers.
13. **Stage 13 â€” Completion**: Celebration screen showing profile initialized, summary badges, and "Coming Next" preview.

---

## 7. Scope Demarcation

### Implemented in this Release
- [x] Public Landing Page (`/`) with editorial hero, product preview, features, 3-phase lifecycle, privacy card, and footer
- [x] 13-stage guided onboarding journey (`/onboarding`)
- [x] Onboarding completion state (`/onboarding/complete`)
- [x] Express REST backend (`/api`) with verification & consent validation
- [x] Live username availability checking
- [x] Responsive layout (Mobile 375px to Desktop 1440px)
- [x] WCAG 2.1 AA accessible focus rings, keyboard navigation, and semantic markup.

### Intentionally Out of Scope (Upcoming Modules)
- Profile Builder (Dynamic resume generator, skill matrix)
- Story Mode (Semester narrative reflections, mentorship logs)
- Living Timeline (Coursework & project artifact feed)
- Career Prediction & Placement Portal
- Full Authentication / SSO / LDAP
- Production Database Migrations (PostgreSQL extension points prepared)
