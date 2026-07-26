-- Mirror Supabase: anon/authenticated roles + auth.jwt() reading request.jwt.claims
create schema if not exists auth;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema auth, public to anon, authenticated;
grant execute on function auth.jwt() to anon, authenticated;

drop table if exists workspaces;
create table workspaces (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on workspaces to anon, authenticated;
alter table workspaces enable row level security;

-- The app's own Users list, as it actually lives inside the JSON blob
insert into workspaces (id, data) values ('ws', jsonb_build_object('users', jsonb_build_array(
  jsonb_build_object('email','jl@fluxmedia.org','status','active'),
  jsonb_build_object('email','Coach@school.org','status','active'),   -- mixed case on purpose
  jsonb_build_object('email','old@school.org','status','revoked'),
  jsonb_build_object('email','nostatus@school.org')                   -- status field absent
)));

-- ===== THE POLICY UNDER TEST =====
create policy "workspace member access" on workspaces
  for all to authenticated
  using (
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

\echo '--- reads: rows visible per identity (want 1 = allowed, 0 = blocked) ---'
\set claims_coach '{"email":"coach@school.org"}'

reset role; set role anon;
select 'anon (signed out)          ' as who, count(*) as rows from workspaces;

reset role; set role authenticated;
set request.jwt.claims = '{"email":"jl@fluxmedia.org"}';
select 'owner                      ' as who, count(*) as rows from workspaces;

set request.jwt.claims = '{"email":"coach@school.org"}';
select 'staff on list (case-diff)  ' as who, count(*) as rows from workspaces;

set request.jwt.claims = '{"email":"nostatus@school.org"}';
select 'staff, no status field     ' as who, count(*) as rows from workspaces;

set request.jwt.claims = '{"email":"old@school.org"}';
select 'revoked staff             ' as who, count(*) as rows from workspaces;

set request.jwt.claims = '{"email":"stranger@gmail.com"}';
select 'stranger w/ Supabase acct  ' as who, count(*) as rows from workspaces;

\echo '--- writes ---'
set request.jwt.claims = '{"email":"stranger@gmail.com"}';
do $$ begin
  update workspaces set data = data || '{"hacked":true}'::jsonb where id='ws';
  raise notice 'stranger UPDATE affected % row(s)', (select count(*) from workspaces);
exception when others then raise notice 'stranger UPDATE error: %', sqlerrm; end $$;

set request.jwt.claims = '{"email":"coach@school.org"}';
do $$
declare n int; begin
  update workspaces set updated_at = now() where id='ws';
  get diagnostics n = row_count;
  raise notice 'staff UPDATE affected % row(s)', n;
end $$;

\echo '--- lockout safety: owner still gets in if the users list is emptied ---'
reset role;
update workspaces set data = '{"users":[]}'::jsonb where id='ws';
set role authenticated;
set request.jwt.claims = '{"email":"jl@fluxmedia.org"}';
select 'owner, empty users list    ' as who, count(*) as rows from workspaces;
set request.jwt.claims = '{"email":"coach@school.org"}';
select 'staff, empty users list    ' as who, count(*) as rows from workspaces;

\echo '--- and if the users key is missing entirely (malformed data) ---'
reset role;
update workspaces set data = '{}'::jsonb where id='ws';
set role authenticated;
set request.jwt.claims = '{"email":"jl@fluxmedia.org"}';
select 'owner, no users key        ' as who, count(*) as rows from workspaces;
reset role;
