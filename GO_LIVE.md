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

Invite-only sign-in with a one-time emailed code. See `AUTH_SETUP.md`.

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

## Phase 5b — Separate each school's data ✅ DONE

Staff are locked to their own school in the interface: only the platform owner
(plus anyone granted it on the Platform page) sees the school switcher, and anyone
else is snapped back to their own school even if the saved state is tampered with.

That lock is now in the **data** as well. Each school has its own row in the
`workspaces` table (row id = the school's id), plus a `__platform__` row for the
shared tab icon. The security policy in `AUTH_SETUP.md` grants access when your
email appears in *that row's* user list, so a Homewood coach's browser only ever
receives the Homewood row — another school's records aren't hidden in devtools,
they're never sent.

- [x] Split the workspace document into one row per school
      (`supabase/split-per-school.sql`)
- [x] Verify a school user's browser can only fetch their own school's row
- [x] Retire the old `default` row (`supabase/retire-default-row.sql`)

### What went wrong, and the rule that came out of it

The migration ran on a Friday and the site deployed on the Sunday. Over the
Saturday in between, a browser still running the pre-split build kept saving into
`default` — successfully, with no error shown — while the deployed app read the
per-school rows. That work was invisible in the app until it was recovered from
the old row (`supabase/recover-weekend-work.sql`).

Two fixes came out of it, both in place now:

- **A retired row is deleted *and* blocked.** Deleting alone isn't enough: an
  out-of-date browser recreates the row on its next save. `retire-default-row.sql`
  adds a RESTRICTIVE policy so `default` can't be read, written, or recreated.
- **A failed save is now visible on every page**, not just Settings. If the app
  can't save, a red banner says so and warns that changes are local only.

**The rule for any future data migration: never leave a row that the old build
writes and the new build ignores.** Either ship the schema change and the deploy
together, or make the old row read-only the moment the new one exists. A rollback
target that's still writable is a data-loss trap, not a safety net.

## Protecting against data loss

Three independent layers, added after a device pushed demo data over a live
school (see `supabase/recover-overwritten-data.sql`):

1. **A device that can't read can't write.** If the startup load fails — or comes
   back empty, which is what an expired sign-in looks like — auto-save stays off
   and the red "Not saving" banner appears. Nothing is uploaded.
2. **Manual "Save to cloud" needs a successful load first.** It's disabled until
   then, with an explicit confirmation available for the one legitimate case:
   filling a brand-new, empty project.
3. **The database refuses a destructive write** (`supabase/guard-overwrites.sql`).
   Any save that would cut a sizeable collection to less than half its size is
   rejected outright. This one doesn't depend on the app being correct, which is
   the point — it's the layer that catches bugs nobody predicted.

Plus hourly snapshots (`supabase/snapshots.sql`) as the recovery path if
something still gets through.

**If a save is ever legitimately meant to remove most of a collection**, run it as:

```sql
begin;
set local app.allow_shrink = 'on';
-- your update here
commit;
```

## Phase 6 — Multi-user data model 🔧 THE REAL "BACKEND" WORK

Not required to go live with a small number of people. Required before a full staff
uses it at the same time. See the warning below.

---

## ⚠️ Simultaneous edits — mostly fixed, worth understanding

You already *have* a backend — Supabase is the database, login system, and file
storage. What you don't have yet is a **per-record** data model.

Each school's data is still one JSON document in one database row. **But saves are
now record-level**: changing an event sends just that event's changed fields (about
100 bytes) and the database merges it into the document. It no longer uploads your
whole snapshot.

That removes the bad failure:

> Two people editing **different** records no longer overwrite each other. You can
> change a sponsor's phone number while a coach adds three events, and both survive.

What's still true:

- **Same record, same moment** — if you and a coach edit the *same* event within a
  second of each other, the later save wins for the fields it touched. Small blast
  radius, and no longer silent data loss across the whole workspace.
- **The app fetches once, at startup.** It won't show someone else's changes until
  you reload.
- **A few whole-document saves remain** as a fallback (imports, restoring a backup,
  bulk operations). Those still behave the old way.

### What to do about it

**Now:** nothing special for day-to-day use. Before a bulk import or restoring a
backup, make sure nobody else is mid-edit, and export a backup from Settings first.
Hourly snapshots (`supabase/snapshots.sql`) run regardless.

**Proper fix (Phase 6):** split the JSON document into real database tables — events,
sponsors, teams, users, tasks — so each record is a real row. That gets you live
updates without a reload, per-record permissions (a coach only touching their own
team), and it stops the per-school document growing without bound.

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
