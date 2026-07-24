# Turn on cloud sync (shared data across every device)

By default the app stores data in each browser separately. Connecting a free
**Supabase** project makes all devices share one live dataset — enter something on
your home computer and it's there on your work computer, a teammate's computer, or
your phone. It stays **off** until you complete these steps, so nothing changes
until you're ready.

The whole dataset is stored as a single JSON document in one table, so setup is
short.

---

## 1. Create a Supabase project (free)

1. Go to <https://supabase.com>, sign up, and click **New project**.
2. Give it a name (e.g. `command-center`), set a database password (save it
   somewhere), pick a region near you, and create it. Wait ~1 minute for it to
   finish provisioning.

## 2. Create the table (one SQL snippet)

In the Supabase dashboard, open **SQL Editor → New query**, paste this, and click
**Run**:

```sql
create table if not exists workspaces (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table workspaces enable row level security;

-- Open access for now (anyone with the site can read/write the shared data).
-- Fine for internal testing; we'll tighten this when we add per-person logins.
create policy "workspace open access" on workspaces
  for all to anon
  using (true) with check (true);
```

## 3. Copy your project keys

In the dashboard, open **Project Settings → API** and copy:

- **Project URL** — looks like `https://abcdefgh.supabase.co`
- **anon public** key — a long token under "Project API keys" (the one labeled
  `anon` / `public`). This one is safe to use in a browser.

## 4. Add them to Vercel and redeploy

In **Vercel → your project → Settings → Environment Variables**, add:

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | your Project URL from step 3 |
| `VITE_SUPABASE_KEY` | your anon public key from step 3 |
| `VITE_WORKSPACE_ID` | *(optional)* a label like `homewood` |

Then **redeploy** (Vercel → Deployments → ⋯ → Redeploy, or push any commit).

## 5. Seed the cloud from the device that has your data

1. On the computer that already has all your entered data, open the site →
   **Settings → Cloud sync**. It should now say **Connected**.
2. Click **Save to cloud**. This uploads your current data as the shared copy.
3. On every other computer or phone, just open the site — it loads the shared
   data automatically. (You can also click **Load from cloud** to refresh.)

That's it. From now on, edits save to the cloud automatically and show up
everywhere.

---

## Notes & next steps

- **No login yet.** With the open policy above, anyone who has the site URL can see
  and edit the shared data. That's fine for internal testing. The recommended next
  step is real per-person email logins (Supabase Auth) with row-level security, so
  each teammate signs in and access is controlled — ask and we'll add it.
- **Simultaneous edits.** This first version is "last save wins" — if two people
  edit at the exact same time, the later save wins. For a small group taking turns
  it's fine; per-record syncing comes with the login phase.
- **Backups still work.** Settings → Data & backup can export/import a file at any
  time, independent of the cloud.
- **Turning it off.** Remove the two environment variables in Vercel and redeploy;
  the app goes back to per-device local storage.
