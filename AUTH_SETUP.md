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

*(Optional: **Authentication → Providers → Email** lets you change how long a code
stays valid. One hour is the default and is a reasonable setting.)*

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

## Step 6 — Lock the data down (do this once logins work)

Until now, the data could still be read by anyone with the site address. Once
you've confirmed logins work, tighten it so **only signed-in people** can read or
write. In **SQL Editor**, run:

```sql
drop policy if exists "workspace transition access" on workspaces;
create policy "workspace authenticated access" on workspaces
  for all to authenticated using (true) with check (true);
```

After this, a signed-out visitor can't reach the data at all.

---

## Good to know

- **What "invitation" means here.** Adding someone in Settings is the invitation —
  tell them to visit the site and sign in with that email. (The app doesn't send a
  "you've been added" email itself; that's a future enhancement, along with an
  in-app "invite" button.)
- **Roles today.** Everyone you add gets the role you pick, and the app already
  enforces what each role can see. Right now give trusted staff an admin or editor
  role; fine-grained per-person tweaks can come later.
- **One remaining nuance.** With the Step 6 policy, anyone who creates *any*
  Supabase account is technically "authenticated," so the strongest possible
  lockdown (data readable only by emails on your list) is a further step we can add
  when you want it. For an internal tool this level is a big, sensible improvement
  to start with.
- **Codes not arriving?** Supabase's built-in email sender is rate-limited and meant
  for testing (a handful of messages per hour). Once real staff are using this,
  connect a proper sender under **Authentication → SMTP Settings**, or codes will
  silently stop going out during a busy stretch.
- **Passwords instead?** We can add email + password login if you'd still prefer it.
  Worth knowing: the emailed code already solves the installed-app problem, and it
  removes password resets, weak passwords, and shared logins as things you'd have to
  manage. If you want passwords for a different reason, say the word.
