-- ============================================================
--  Enforce membership and role at the database
--
--  The existing policy answers one question: is this person a member of this
--  school? If yes, they could read and write the whole row — so a coach could
--  promote themselves to administrator, rewrite sponsorship figures, or replace
--  the document with an empty one. The app hid those actions; nothing stopped
--  them from being sent directly.
--
--  This adds two things:
--    1. A `platform_owners` table, replacing the owner's email hard-coded into
--       the policy. Owners can be added and removed without editing SQL.
--    2. A trigger that checks the writer's role in the row they are writing.
--
--  WHAT THIS CANNOT DO. A school is one JSON document, so the database can see
--  *who* is writing but not *which part* they changed — except where it can
--  compare before and after, which is how the checks below work. Stopping a
--  coach from editing sponsorship while allowing them to edit their own
--  schedule needs per-record tables (Phase 6 in GO_LIVE.md). Role escalation is
--  blocked here because that is the step that unlocks everything else.
-- ============================================================


-- ---------- 1. Who the platform owners are ----------

create table if not exists public.platform_owners (
  email    text primary key,
  added_at timestamptz not null default now()
);

alter table public.platform_owners enable row level security;
-- No policy: the app never reads this table. Only the SQL editor and the
-- security-definer helpers below can see it.

insert into public.platform_owners (email) values ('jl@fluxmedia.org')
on conflict (email) do nothing;

/** True when the caller is a platform owner. */
create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_owners
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
$$;

/** The caller's role in one school, or null if they aren't a member. */
create or replace function public.role_in_workspace(doc jsonb)
returns text
language sql
stable
as $$
  select coalesce(u ->> 'role', 'read_only')
  from jsonb_array_elements(coalesce(doc -> 'users', '[]'::jsonb)) u
  where lower(u ->> 'email') = lower(coalesce(auth.jwt() ->> 'email', ''))
    and coalesce(u ->> 'status', 'active') <> 'revoked'
  limit 1
$$;


-- ---------- 2. The membership policy, without the hard-coded email ----------

drop policy if exists "workspace member access" on public.workspaces;
create policy "workspace member access" on public.workspaces
  for all to authenticated
  using (public.is_platform_owner() or public.role_in_workspace(data) is not null)
  with check (public.is_platform_owner() or public.role_in_workspace(data) is not null);


-- ---------- 3. Role checks on every write ----------

create or replace function public.enforce_workspace_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  caller_role  text;
begin
  -- No signed-in identity means this is the SQL editor, a migration or the
  -- service role — trusted server-side work, not a request from the app. The
  -- membership policy already stops signed-out users from matching any row, so
  -- the trigger never sees them.
  if caller_email = '' then
    return new;
  end if;

  if public.is_platform_owner() then
    return new;
  end if;

  -- Judge the role from the row as it stands, so nobody can grant themselves a
  -- role in the same statement that uses it.
  caller_role := public.role_in_workspace(old.data);

  if caller_role is null then
    raise exception 'You are not a member of this school.'
      using errcode = 'insufficient_privilege';
  end if;

  if caller_role = 'read_only' then
    raise exception 'Read-only access: this account cannot change data.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Changing the user list is how someone would grant themselves more access,
  -- so it belongs to administrators alone.
  if caller_role not in ('school_admin', 'platform_owner')
     and (new.data -> 'users') is distinct from (old.data -> 'users') then
    raise exception 'Only a school administrator can change who has access or what role they hold.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end $$;

drop trigger if exists workspaces_enforce_roles on public.workspaces;
create trigger workspaces_enforce_roles
  before update on public.workspaces
  for each row
  execute function public.enforce_workspace_roles();


-- ---------- 4. Check it ----------

select email from public.platform_owners order by email;

select tgname as trigger
from pg_trigger
where tgrelid = 'public.workspaces'::regclass and not tgisinternal
order by tgname;


-- ---------- 5. Managing owners ----------
--   insert into public.platform_owners (email) values ('someone@example.com');
--   delete from public.platform_owners where email = 'someone@example.com';
