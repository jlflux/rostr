# Turn on real file uploads (images & assets)

This lets people upload real images and files — asset library items and the school
logo — instead of the placeholder catalog records. Files live in **Supabase
Storage** (a private file bucket), separate from the app data.

You chose **private** storage: only **signed-in** people can view uploaded files.
Because of that, uploads become viewable only once logins are on (see
`AUTH_SETUP.md`) — so it's best to roll these out together, or turn on logins first.

Until you do the steps below, the app keeps its current placeholder behavior, so
nothing breaks.

---

## Step 1 — Create the bucket

In your Supabase dashboard → **Storage**:

1. Click **New bucket**.
2. Name it exactly **`assets`**.
3. Leave **Public** **OFF** (this is the private choice).
4. *(Optional)* Set a file size limit (e.g. 25 MB) and restrict types to images.
5. Create it.

*(If you name the bucket something other than `assets`, add a Vercel env var
`VITE_STORAGE_BUCKET` set to that name.)*

## Step 2 — Allow signed-in users to upload and view

In **SQL Editor**, run this once. It lets any signed-in user upload to, view, and
delete files in the `assets` bucket. (Viewing needs the "read" policy because
private files are shown through short-lived signed links.)

```sql
create policy "assets read for authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'assets');

create policy "assets upload for authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'assets');

create policy "assets delete for authenticated"
  on storage.objects for delete to authenticated
  using (bucket_id = 'assets');
```

## Step 3 — Make sure people are signed in

Since the bucket is private, a person must be **signed in** for images to display
and for uploads to work. Follow `AUTH_SETUP.md` to turn on logins. (If logins are
off, everyone is anonymous and uploaded images won't load.)

## Step 4 — Try it

1. Sign in.
2. Go to **Assets → Upload**. You'll now see a **File** picker (not the old "mock"
   note). Choose an image and upload — its thumbnail should appear on the card.
3. Go to **Settings → School logo** and upload a logo — it should show in the
   sidebar.

That's it. No redeploy is needed for uploads themselves; they use the same Supabase
project you're already connected to.

---

## Good to know

- **Where files go.** Each upload is stored under a folder named for its asset type
  (e.g. `sponsor-logo/…`, `logos/…`) with a random filename, so names never collide.
- **What's saved in the app.** The app stores only a small reference to the file, not
  the file itself — so the database stays small and fast. (The old school logo was
  stored *inside* the database as text; new uploads no longer do that.)
- **Downloads / viewing.** The Download button and thumbnails open the file through a
  temporary signed link that expires after an hour and is refreshed automatically.
- **Approval flow unchanged.** Uploaded assets still start as "pending" and go through
  the same approve/reject step as before.
- **Existing placeholder assets** stay as they are; they simply don't have a file
  attached. You can re-upload real files for them any time.

---

# The public bucket (for the fan-facing site)

The `assets` bucket above is **private**: its files are served through signed URLs
that expire, which is right for rosters, documents and anything internal. Those
URLs cannot back a public web page — a fan has no sign-in, and the link would go
dead anyway.

So the handful of images that appear publicly live in a second, **public** bucket.
Only logos go in it: the school logo, opponent logos, and sponsor logos. Athlete
photos, team photos and documents stay in the private bucket.

## Step 1 — Create it

Supabase dashboard → **Storage** → **New bucket**

- Name: `public-assets`
- Public bucket: **on** (this one is deliberately public)

## Step 2 — Only the app may write to it

Anyone may read; only signed-in staff may add or replace files.

```sql
create policy "public assets are readable by anyone"
  on storage.objects for select
  using (bucket_id = 'public-assets');

create policy "signed-in staff can write public assets"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'public-assets');

create policy "signed-in staff can replace public assets"
  on storage.objects for update to authenticated
  using (bucket_id = 'public-assets');

create policy "signed-in staff can remove public assets"
  on storage.objects for delete to authenticated
  using (bucket_id = 'public-assets');
```

## How files are named

A logo's public path is always `<schoolId>/<assetId>` — for example
`org-hhs/as-2f9c1`. That's fixed, so `supabase/public-site.sql` can name the path
when it builds a school's public data without needing to know whether the file
has been copied across yet. An image that hasn't been copied simply doesn't
appear; nothing breaks.

**Copying the files across is not wired up yet.** It arrives with the public site
itself (Phase B in `PUBLIC_SITE.md`), which is the first thing that needs to
render them.
