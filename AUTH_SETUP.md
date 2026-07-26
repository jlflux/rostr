# Turn on logins (invite-only, admin-controlled)

Once cloud sync is working (see `SUPABASE_SETUP.md`), you can require people to
**sign in** before they see anything. Logins are **invitation-only**: a person can
only use the app if an administrator has added their email under
**Settings → Users & roles**. Everyone signs in with a **6-digit code emailed to
them** — no passwords to manage, reset, or forget.

### Why a code instead of just a link

A tap-to-sign-in link opens in the phone's **web browser**. If someone installed
this app to their home screen, the sign-in then lands in the browser and the
installed app stays logged out — a dead end. A code avoids that entirely: the
person reads it from their email and types it into whichever app they're standing
in. On most phones the keyboard will even offer the code for one-tap entry.

The emails contain both, so the link still works for anyone using a browser.

Logins stay **off** until you set one flag, and you can always turn them back off,
so you can't get permanently locked out. Do the steps in order.

---

## How access works

- **The Users & roles list is the guest list.** Only emails you add there can get
  in, and each person's **role** controls what they can see and do.
- Someone signs in → the app matches their email to your Users list → if they're
  there and active, they're in with their role; if not, they see a polite
  "ask your administrator for access" screen.
- **Revoke** (in the Users list) instantly blocks someone while keeping their
  history; **Delete** removes them entirely.

## Step 1 — Put your own email on an admin account (do this first!)

While logins are still off, open **Settings → Users & roles** and make sure
**your** email (the one you'll sign in with) is on an account with an admin role
(**Platform Owner** or **School Administrator**). If it isn't, edit an admin user
or add yourself. This guarantees you can get in once logins are on.

Then add the other staff you want to have access (email + role). You can do this
now or later — you can add people any time.

## Step 2 — Turn on email logins in Supabase

In your Supabase dashboard:

1. **Authentication → Providers → Email**: make sure **Email** is enabled (it is by
   default). This is what sends the sign-in emails.
2. **Authentication → URL Configuration**: set **Site URL** to your live site
   address (your Vercel URL, e.g. `https://your-app.vercel.app`), and add that same
   URL under **Redirect URLs**. This lets the sign-in link bring people back to
   your site. *(If you skip this, the link may bounce to the wrong place.)*

## Step 2b — Put the 6-digit code in the email ⚠️ REQUIRED

**Do not skip this.** People sign in by typing a 6-digit code, which matters
especially in the installed app (see "Why a code" below). Supabase only puts that
code in the email if the template asks for it — by default the email contains just
a link, and the code box will never work.

Go to **Authentication → Email Templates** and edit **both** of these:

- **Magic Link** — used when the email already has a Supabase account
- **Confirm signup** — used the first time a given email signs in

Supabase picks between them automatically, so both need the code or first-time
sign-ins will fail. Paste this as the body of each:

```html
<h2>Your sign-in code</h2>
<p>Enter this code in the app:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>This code expires in one hour. If you didn't request it, you can ignore this email.</p>
<hr>
<p>Or, if you're in a web browser, <a href="{{ .ConfirmationURL }}">tap here to sign in</a>.</p>
```

`{{ .Token }}` is the code and `{{ .ConfirmationURL }}` is the link. Keeping both
means the code works everywhere and the link still works in a browser.

Editing these templates is free and needs no other setup — you do **not** need a
custom email provider to do this.

*(Optional: **Authentication → Providers → Email** lets you change how long a code
stays valid. One hour is the default and is a reasonable setting.)*

## Step 2c — Connect an email provider (SMTP) ⚠️ REQUIRED before staff can log in

Supabase's built-in email sender **will not deliver to your staff.** Since
September 2024, if you haven't connected your own email provider, Supabase only
sends auth emails to addresses that are members of your Supabase organization —
everyone else gets nothing, with no bounce and no error. It's also capped at about
**2 emails per hour** for the entire project.

So you can test the login flow with your own address today, but the moment you add
a coach, their code silently never arrives. Connect a provider before rolling this
out to anyone.

### What you need

1. **A domain you can add DNS records to.** You'll send from something like
   `noreply@fluxmedia.org`. The provider gives you a few DNS records (DKIM/SPF) to
   paste in, which proves you own the domain and keeps codes out of spam folders.
2. **An email provider account.** Any SMTP provider works. Reasonable options:
   - **Resend** — simplest setup, free tier covers a few thousand emails a month.
     Host `smtp.resend.com`, port `587`, username `resend`, password = your API key.
   - **Brevo** — free tier around 300/day. Host `smtp-relay.brevo.com`, port `587`.
   - **Amazon SES** — cheapest at volume, but the most setup and a sandbox mode you
     must request out of first.

   Free-tier limits change, so confirm current numbers when you sign up. For a staff
   of this size, any of these is far more than enough.

### What to enter in Supabase

**Authentication → Emails → SMTP Settings**, enable custom SMTP, then fill in:

| Field | What it is |
| --- | --- |
| Sender email | The "from" address, e.g. `noreply@fluxmedia.org` (must be on your verified domain) |
| Sender name | What staff see as the sender, e.g. `Homewood Athletics` |
| Host | From your provider, e.g. `smtp.resend.com` |
| Port | `587` in almost all cases |
| Username | From your provider (Resend uses the literal word `resend`) |
| Password | Your provider's API key or SMTP password |

Then go to **Authentication → Rate Limits** and raise the email limit — it defaults
to 30/hour once SMTP is connected, which is fine, but worth a look if you ever
onboard a lot of people at once.

## Step 3 — Let the app reach data whether or not someone is logged in

The original setup only allowed access for signed-out visitors. Before enabling
logins, broaden it so signed-in users work too. In **SQL Editor**, run:

```sql
drop policy if exists "workspace open access" on workspaces;
create policy "workspace transition access" on workspaces
  for all to public using (true) with check (true);
```

## Step 4 — Flip the login switch

In **Vercel → Settings → Environment Variables**, add:

| Name | Value |
| --- | --- |
| `VITE_REQUIRE_LOGIN` | `true` |

Then **redeploy**. Now the site asks everyone to sign in.

## Step 5 — Test it

1. Open the site — you should see the sign-in screen.
2. Enter your email. Check that the email that arrives **contains a 6-digit code**.
   If it only has a link, Step 2b wasn't applied to the right template — go back
   and edit both templates.
3. Type the code into the app and confirm you land in with your normal access.
4. **Test the installed app specifically**, since that's the case a link can't
   handle: add the site to your phone's home screen, open it from there, and sign
   in with a code. You should end up signed in *inside* the installed app.
5. (Recommended) Sign in as another staff member you added and confirm they only
   see what their role allows.

If something's wrong, set `VITE_REQUIRE_LOGIN` back to `false` and redeploy — you're
immediately back to open access, and no data is lost.

## Step 6 — Lock the data down ❗ (do this once logins work)

Until now, the data can be read by anyone who knows the project address, signed in
or not. This step closes that.

The obvious rule — "allow any signed-in user" — isn't enough on its own, because
**anyone can create a Supabase account by requesting a code for their own email.**
They'd be blocked by the app's front door but could still reach the database
directly. So instead, the rule below makes **your Users list the actual gate**: an
account only gets data if its email is on the list in Settings → Users & roles and
isn't revoked.

Run this in **SQL Editor**:

```sql
drop policy if exists "workspace open access" on workspaces;
drop policy if exists "workspace transition access" on workspaces;
drop policy if exists "workspace authenticated access" on workspaces;

create policy "workspace member access" on workspaces
  for all to authenticated
  using (
    -- Safety valve: the platform owner can always get in, even if the user
    -- list is ever emptied or damaged. Change this to your own email.
    lower(auth.jwt() ->> 'email') = 'jl@fluxmedia.org'
    or exists (
      select 1 from jsonb_array_elements(coalesce(data -> 'users', '[]'::jsonb)) u
      where lower(u ->> 'email') = lower(auth.jwt() ->> 'email')
        and coalesce(u ->> 'status', 'active') <> 'revoked'
    )
  )
  with check (
    lower(auth.jwt() ->> 'email') = 'jl@fluxmedia.org'
    or exists (
      select 1 from jsonb_array_elements(coalesce(data -> 'users', '[]'::jsonb)) u
      where lower(u ->> 'email') = lower(auth.jwt() ->> 'email')
        and coalesce(u ->> 'status', 'active') <> 'revoked'
    )
  );
```

This was tested against a real Postgres with the same table shape. Verified
behavior:

| Who | Result |
| --- | --- |
| Signed out | No access |
| You (the owner) | Full access, always |
| Staff on the Users list | Full access — email matching ignores capitalization |
| Staff added without a status set | Full access |
| Staff you **revoked** | No access |
| Stranger who made their own Supabase account | **No read, write, delete, or insert** |
| Owner, if the user list were emptied or damaged | Still gets in (safety valve) |

### After running it

1. Open the site in a private/incognito window. You should get the sign-in screen
   and **no data**.
2. Sign in normally and confirm everything still loads.
3. Revoking someone in Settings → Users & roles now cuts off their database access
   as well, not just their view of the app.

---

## Good to know

- **What "invitation" means here.** Adding someone in Settings is the invitation —
  tell them to visit the site and sign in with that email. (The app doesn't send a
  "you've been added" email itself; that's a future enhancement, along with an
  in-app "invite" button.)
- **Roles today.** Everyone you add gets the role you pick, and the app already
  enforces what each role can see. Right now give trusted staff an admin or editor
  role; fine-grained per-person tweaks can come later.
- **Revoking really revokes.** With the Step 6 policy, the Users list is the
  database's gate too — so revoking someone cuts off their data access, not just
  their menu. It takes effect the next time their app talks to the server.
- **Codes not arriving?** By far the most likely cause is Step 2c: without your own
  email provider connected, Supabase only delivers to members of your Supabase
  organization, and silently drops everything else. Second most likely is the
  ~2/hour cap on the built-in sender. Both are fixed by connecting SMTP.
- **Passwords instead?** We can add email + password login if you'd still prefer it.
  Worth knowing: the emailed code already solves the installed-app problem, and it
  removes password resets, weak passwords, and shared logins as things you'd have to
  manage. If you want passwords for a different reason, say the word.
