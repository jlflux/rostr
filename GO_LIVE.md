# Going live — where things stand

A single place to see what's done, what's left, and what's risky. Detailed
instructions live in the linked docs; this is the map.

Last updated: July 2026

---

## Phase 1 — Shared data (cloud sync) ✅ DONE

The app saves to a Supabase project instead of just the browser, so everyone sees
the same data. See `SUPABASE_SETUP.md`.

## Phase 2 — File uploads ✅ DONE

Real image/file uploads for the asset library and school logo, in a private
Supabase Storage bucket. See `STORAGE_SETUP.md`.

## Phase 3 — Logins ⚠️ IN PROGRESS

Invite-only sign-in with a 6-digit emailed code. See `AUTH_SETUP.md`.

- [x] Email templates carry the code (`{{ .Token }}`)
- [x] Resend connected so codes reach non-team addresses
- [ ] **Set `VITE_REQUIRE_LOGIN=true` in Vercel and redeploy** — until this is done,
      the site is still open to anyone with the link
- [ ] Add real staff under Settings → Users & roles
- [ ] Test on an installed phone app, in both light and dark mode

## Phase 4 — Lock down the data ❗ NOT STARTED — DO NOT SKIP

Right now the database policy is `using (true)`: **anyone who knows the project URL
can read and write everything**, signed in or not. That was deliberate so setup
couldn't lock you out, but it must be tightened before real data goes in.

- [ ] Run the Step 6 SQL in `AUTH_SETUP.md` — it makes your Users list the
      database's gate, so a stranger who signs themselves up still gets nothing
- [ ] Confirm a signed-out/incognito browser can no longer load data

**Do Phase 3 and 4 together.** Logins are cosmetic until the database is locked —
someone could still read everything by going around the app.

## Phase 5 — Real data

- [ ] Clear the demo content (Assets → "Clear placeholders"; Settings → Prototype
      controls for the rest)
- [ ] Enter real teams, events, sponsors
- [ ] Export a backup from Settings → Data & backup once it's loaded

## Phase 5b — Separate each school's data ❗ REQUIRED BEFORE A SECOND REAL SCHOOL

Staff are now locked to their own school: only the platform owner (plus anyone
granted it on the Platform page) sees the school switcher, and anyone else is
snapped back to their own school even if the saved state is tampered with.

**But that lock is in the interface, not in the data.** Every school still lives
in one JSON document, and the browser downloads the whole thing. A Homewood coach
who opened browser devtools could read Riverbend's records out of it. That's fine
while every school on the platform is yours, and not fine the moment a paying
client's data is in there next to another client's.

The fix is smaller than Phase 6: give **each school its own row** in the
`workspaces` table (row id = the school's id) instead of one shared row. The
security policy already written in `AUTH_SETUP.md` generalizes to this for free —
it grants access when your email appears in *that row's* user list, so Homewood
staff could only ever fetch the Homewood row. Work needed is on the app side:
loading and saving per school, and keeping the school registry in its own row.

- [ ] Split the workspace document into one row per school
- [ ] Verify a school user's browser can only fetch their own school's row

## Phase 6 — Multi-user data model 🔧 THE REAL "BACKEND" WORK

Not required to go live with a small number of people. Required before a full staff
uses it at the same time. See the warning below.

---

## ⚠️ The one thing that will bite you: simultaneous edits

You already *have* a backend — Supabase is the database, login system, and file
storage. What you don't have is a **per-record** data model.

Today the entire app (every event, sponsor, team, task) is stored as **one big JSON
document in a single database row**. The app loads that document when it starts, and
saves the whole thing back about a second after any change.

That means:

> If two people have the app open at once, whoever saves **last** overwrites
> everything the other person did — silently, with no warning and no way to recover
> it except a backup file.

Concretely: you open the app at 9:00. A coach opens it at 9:00. They add three
events at 10:00. At 10:05 you change one phone number — your app sends its whole
9:00 snapshot, and those three events are gone.

It's also worth knowing the app only fetches data **once, at startup**. It won't pick
up someone else's changes until you reload.

### What to do about it

**Short term (works now, no code):** treat it as a one-editor-at-a-time tool. One
person edits, others reload before they start. Export a backup from Settings before
any big editing session. Genuinely fine for one or two people.

**Proper fix (Phase 6):** split the JSON document into real database tables — events,
sponsors, teams, users, tasks — so each record saves independently. Two people
editing different events stop colliding entirely, and it unlocks per-record
permissions (a coach only touching their own team) and live updates without a
reload.

That's a substantial piece of work and it touches every page, so it's worth doing
deliberately rather than mid-season. **My recommendation:** finish Phases 3–5, run
with a small group for a bit, and start Phase 6 before opening it to the whole
staff.

---

## Admin / CMS surface

Two places to configure things without code:

- **Settings** — per school: school logo, colors, users & roles, sponsorship tiers,
  benefit templates, appearance, backups.
- **Platform** (platform owner only) — across schools: the browser-tab icon used by
  every school, add/remove schools, switch between them, and per school switch
  sections on/off, rename them, and set a default visual style.

Still code-only: page copy beyond section names (subtitles, empty-state text,
button labels), dashboard card selection, and nav ordering.

## Optional polish

- [ ] Custom domain in Vercel (e.g. `athletics.fluxmedia.org`)
- [ ] A real "you've been invited" email when an admin adds someone
- [ ] Scheduled backups (today it's a manual export)
