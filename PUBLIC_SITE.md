# Public site — plan

A fan-facing site generated from the same data the staff already keep in Command
Center. Replaces a hosted vendor site (Ballfrog, VNN, rSchoolToday) rather than
sitting alongside one.

The pitch: **the schedule the AD already maintains is the website.** Every vendor
site is stale because it's a second place to type everything. This one can't be.

---

## What already exists

Most of the game page is derivable from data the app stores today. This is the
reason the idea is cheap to build:

| On the public game page | Comes from | Status |
|---|---|---|
| "Homewood vs Mountain Brook" with both logos and colors | `Organization.theme` + `logoUrl`; `Opponent.logoAssetId` + `tint` | exists |
| "Presented by <sponsor>" | `SportEvent.sponsorActivations[].activation` | exists |
| "Senior Night" / "Homecoming" | `SportEvent.designation` | exists |
| "Honoring the state championship track team" | `SportEvent.gameMoments[].title` | exists |
| Date, time, venue, home/away, region game | `SportEvent` fields | exists |
| Tickets, watch live | `ticketLink`, `broadcastLink`, `broadcastStatus` | exists |
| Final score / result | `SportEvent.score` | exists |
| Rosters, records, schedules | `Team`, `Athlete`, `teamRecord()` | exists |

Deliberately **not** published, though they live on the same event:
`staffSlots`, `runOfShow`, `broadcastChecklist`, `checkoutTime`, internal `notes`,
and the `ownerId` / `notes` inside each game moment.

That split is the product. The AD enters a game once; the public sees the half
that's for fans, and the staff see the half that's for running it.

---

## Architecture

**The public never reads `workspaces`.** Anonymous access to that table would
expose staffing, sponsorship terms and athlete records, and one forgotten field
would be a leak. Instead:

1. A `public_site` table, one row per school, holding only a whitelisted
   projection of that school's data.
2. A database trigger rebuilds a school's row whenever its data changes, so the
   public site is never stale and the app doesn't have to remember to publish.
3. Anonymous read is granted **only** on `public_site`. `workspaces` keeps the
   member-only policy it has now.
4. A per-school `published` flag, plus per-section toggles reusing the existing
   section config on the Platform page.

The whitelist is built as an allow-list, so a field added to `Athlete` next
season is excluded until someone deliberately adds it.

### Images need a public bucket

Uploads currently live in a **private** Storage bucket served by signed URLs that
expire — those cannot back a public page. The publish step needs to copy the
handful of images that appear publicly (school logo, opponent logos, sponsor
logos) into a separate **public** bucket. Athlete photos stay private unless
explicitly opted in.

This is easy but has to be designed in from the start, not bolted on.

### Front end

A second entry point in this repo sharing types and date helpers, but its own
small bundle with no admin code in it, deployed as a separate Vercel project.
One template themed per school from `Organization.theme` and `logoUrl` — no
per-school layouts. Custom layouts are a web design business.

Routes: home · schedule · scores · teams/roster · **game page** · links.

---

## Build order

**A. Foundation** — `public_site` table, the whitelist projection, the refresh
trigger, anonymous read policy, public image bucket. No UI. Verified by proving
an anonymous client can read a school's public row and *nothing* else.

**B. Schedule + game page** — the differentiator, so it comes before breadth.
Dual branding, presented-by, special events, tickets and watch links.

**C. Teams, rosters, scores** — the bulk of what fans browse.

**D. Domains** — `hhs.fluxathletics.com` first via a wildcard, then custom
domains per school. Needs a `slug` on `Organization`.

**E. Extras** — social embeds, external links, sponsor wall.

---

## Decisions still open

**Athlete contact and medical fields.** DragonFly is the state-mandated system of
record for eligibility and compliance, so `phone`, `email`, `medicalNotes` and
`guardians` in Command Center duplicate it. Dropping them removes the most
sensitive data in the app and some double entry.

Two cautions before doing it: rosters already have contacts entered, so removing
the fields deletes real data; and coaches liked having emergency info reachable
on the sideline without loading DragonFly. Options are to keep collecting them,
stop showing them, or purge them — worth a decision, not an assumption. Either
way they are never published.

**Per-athlete opt-out.** Some families opt out of directory information. A
"hide from public site" flag per athlete is a few lines and avoids an awkward
conversation later.

**Sponsor wall.** Sponsorship stays internal, but logo-and-link on the public
site is what a sponsor is actually buying, and it makes the sponsorship module
sell itself. Per-sponsor opt-in. Contract terms never leave the backend.

---

## Phase B — status

**Done:** the public app itself — home, schedule and the game page — reading the
`public_site` projection anonymously, themed per school at runtime.

It builds as a second entry point (`fans.html`) alongside the staff app. The fan
bundle is ~12 KB against the staff app's ~570 KB, which is the check that no
admin code reached it. `FANS_ONLY=1` builds only the public site and emits it as
`index.html`, which is what its own Vercel project deploys.

Addressing a school: the subdomain is the slug in production, `?school=<slug>`
overrides it for previews and local work, and `VITE_PUBLIC_DEFAULT_SLUG` is the
fallback. Real domains are Phase D.

**Still to do before this can go live:**

- **Copy logo files into the public bucket.** Paths are already correct
  (`<schoolId>/<assetId>`); nothing copies the files across yet, so crests fall
  back to initials. This is the next piece of work.
- **Rosters, team pages and a scores page** — Phase C.
- **Domains** — Phase D.
