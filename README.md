# Rostr — The Athletics Command Center

A clickable, front-end prototype of a multi-tenant school athletics operations platform.
Homewood High School Athletics is the pilot/demo organization; the app structure, roles,
and branding are configurable per organization.

## What's in the prototype

| Module | Highlights |
| --- | --- |
| **Dashboard** | Exception-first: unfilled staff roles, unpaid agreements, missing sponsor assets, obligations due, overdue tasks, content reminders, recent activity |
| **Master calendar** | Month / week / agenda views; filters for sport, team, type, home/away, venue, broadcast, staffing; cross-sport venue conflict flags |
| **Events** | 115 real events from the Fall 2026 composite schedule; searchable list; create/edit with validation |
| **Event detail** | Overview, Staffing (assign & confirm roles), Run of show, Sponsors, Tasks & content reminders, Assets, Results & postgame |
| **Sponsors** | Directory with tier/payment filters; profiles with agreements, payments, benefit fulfillment checklist, event assignments, notes; seeded from the Fall 2026 sponsorship workbook (Red/White/Blue tiers, Patriot Partners, broadcast add-ons) |
| **Requests** | Coach portal with the Submitted → Reviewed → In progress → Completed workflow, priorities, internal notes, assignees |
| **Teams** | Workspaces with schedule, results, coaching staff, broadcasts, open requests, missing-info flags, completeness score |
| **Assets** | Searchable library with type/sport/sponsor/approval filters and mock upload + approval flow |
| **Reports** | Revenue by tier, collected vs outstanding, fulfillment, renewals, events hosted, staffing fill rate, request volume, content completion, team completeness |
| **Settings** | Configurable org branding (theme colors flow app-wide), user/role management, role permission summary, light/dark mode, demo controls |

### Prototype conventions

- **No backend.** All data is local mock data; your changes persist to `localStorage`.
  Reset from **Settings → Reset demo data**.
- **Demo clock.** The app's "today" is frozen at **Sept 25, 2026** (mid-season) so the
  Fall 2026 data reads as a live season. Change it in Settings.
- **Roles.** Use the profile menu ("View as") to experience the app as an AD, comms
  admin, finance user, coach, event staff, or read-only user. Editing affordances and
  visible data adjust per role.
- **Multi-tenant.** The org switcher in the top bar includes a second (empty) school to
  demonstrate tenant isolation and per-org theming.

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build to dist/
```

Stack: React 18 + TypeScript + Vite + React Router. No UI framework — a small
hand-rolled design system in `src/styles.css` with light/dark themes.

## Project structure

```
src/
  types.ts            # TypeScript interfaces for every major record
  data/
    scheduleEvents.json  # Fall 2026 composite schedule (imported from spreadsheet)
    seed.ts              # Demo org, users, teams, sponsors, agreements, requests, assets, tasks
  store/store.tsx     # App state (React context) + localStorage persistence + toasts
  lib/
    dates.ts          # Date/currency formatting helpers
    derive.ts         # Business logic: dashboard metrics, conflicts, permissions
  components/         # Reusable UI (badges, cards, modals, tables, shell, icons)
  pages/              # One file per module screen
```

## Deploying to Vercel

The repo is Vercel-ready (`vercel.json` provides the SPA rewrite so deep links work).

**Option A — Vercel dashboard (easiest):**
1. Push this repo to GitHub (already done if you're reading this there).
2. Go to [vercel.com/new](https://vercel.com/new), sign in, and **Import** the `rostr` repository.
3. Vercel auto-detects Vite. Accept the defaults (Build command `npm run build`, output `dist`).
4. Click **Deploy**. You'll get a shareable `*.vercel.app` URL in about a minute.

**Option B — CLI:**
```bash
npm i -g vercel
vercel          # first deploy (accept prompts)
vercel --prod   # promote to production
```

No environment variables or server configuration are required.
