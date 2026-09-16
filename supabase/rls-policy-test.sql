\set ON_ERROR_STOP on

-- ============================================================
--  LOCAL HARNESS — NOT FOR YOUR SUPABASE PROJECT
--
--  This file DROPS AND RECREATES the workspaces table and is meant for a
--  throwaway Postgres database. Running it anywhere holding real data would
--  destroy it. It also uses psql commands (\i, \echo) that the Supabase SQL
--  editor cannot run.
--
--  To check a real project, run `supabase/verify-role-enforcement.sql`
--  instead — that one only reads.
--
--  Run this with:  psql -f supabase/rls-policy-test.sql <scratch-db>
-- ============================================================

-- Refuse to run against anything that looks like a real project.
do $$
declare n bigint := 0;
begin
  if to_regclass('public.workspaces') is not null then
    execute 'select count(*) from public.workspaces' into n;
  end if;
  if n > 0
     or to_regclass('public.public_site') is not null
     or to_regclass('public.workspace_snapshots') is not null then
    raise exception
      'Refusing to run: this harness drops tables and this database holds real data.'
      using hint = 'Run supabase/verify-role-enforcement.sql against a real project instead.';
  end if;
end $$;

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
insert into workspaces (id, data) values ('ws', jsonb_build_object(
  'users', jsonb_build_array(
    jsonb_build_object('email','jl@fluxmedia.org','status','active','role','platform_owner'),
    jsonb_build_object('email','Coach@school.org','status','active','role','coach'),   -- mixed case on purpose
    jsonb_build_object('email','ad@school.org','status','active','role','school_admin'),
    jsonb_build_object('email','booster@school.org','status','active','role','read_only'),
    jsonb_build_object('email','old@school.org','status','revoked','role','coach'),
    jsonb_build_object('email','nostatus@school.org','role','coach')                   -- status field absent
  ),
  'events', jsonb_build_array(jsonb_build_object('id','e1','status','scheduled')),
  'sponsors', jsonb_build_array(jsonb_build_object('id','s1','contractValue',50000))));

-- A second school, to prove one school's staff cannot reach another's.
insert into workspaces (id, data) values ('ws-other', jsonb_build_object(
  'users', jsonb_build_array(jsonb_build_object('email','rival@other.org','status','active','role','school_admin'))));

-- ===== THE POLICY UNDER TEST =====
-- Loaded from the file that is actually deployed, so this cannot drift from it.
\i supabase/role-enforcement.sql

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

\echo ''
\echo '--- role enforcement on writes (the app hides these; the database must too) ---'

set request.jwt.claims = '{"email":"coach@school.org"}';
do $$ begin
  update workspaces set data = jsonb_set(data,'{users,1,role}','"school_admin"') where id='ws';
  raise notice 'coach promotes self            : ALLOWED  <-- ESCALATION';
exception when insufficient_privilege then raise notice 'coach promotes self            : blocked'; end $$;

do $$ begin
  update workspaces set data = jsonb_set(data,'{events,0,status}','"confirmed"') where id='ws';
  raise notice 'coach edits an event           : allowed (correct)';
exception when insufficient_privilege then raise notice 'coach edits an event           : BLOCKED <-- too strict'; end $$;

do $$ begin
  update workspaces set data = '{"users":[]}'::jsonb where id='ws';
  raise notice 'coach wipes the document       : ALLOWED  <-- DATA LOSS';
exception when insufficient_privilege then raise notice 'coach wipes the document       : blocked'; end $$;

select 'coach sees other school    ' as who, count(*) as rows from workspaces where id='ws-other';

set request.jwt.claims = '{"email":"booster@school.org"}';
select 'read-only reads            ' as who, count(*) as rows from workspaces where id='ws';
do $$ begin
  update workspaces set data = jsonb_set(data,'{events,0,status}','"canceled"') where id='ws';
  raise notice 'read-only changes data         : ALLOWED  <-- should be read only';
exception when insufficient_privilege then raise notice 'read-only changes data         : blocked'; end $$;

set request.jwt.claims = '{"email":"ad@school.org"}';
do $$ begin
  update workspaces set data = jsonb_set(data,'{users,1,role}','"comms_admin"') where id='ws';
  raise notice 'admin changes a role           : allowed (correct)';
exception when insufficient_privilege then raise notice 'admin changes a role           : BLOCKED <-- too strict'; end $$;
do $$ begin
  update workspaces set data = jsonb_set(data,'{sponsors,0,contractValue}','60000') where id='ws';
  raise notice 'admin edits sponsorship        : allowed (correct)';
exception when insufficient_privilege then raise notice 'admin edits sponsorship        : BLOCKED <-- too strict'; end $$;

\echo ''
\echo '--- deleting a school (takes every record in it) ---'

set request.jwt.claims = '{"email":"coach@school.org"}';
do $$ begin
  delete from workspaces where id='ws';
  if found then raise notice 'coach deletes the school       : ALLOWED  <-- DATA LOSS';
  else raise notice 'coach deletes the school       : blocked (policy hid the row)'; end if;
exception when insufficient_privilege then raise notice 'coach deletes the school       : blocked'; end $$;

set request.jwt.claims = '{"email":"booster@school.org"}';
do $$ begin
  delete from workspaces where id='ws';
  if found then raise notice 'read-only deletes the school   : ALLOWED  <-- DATA LOSS';
  else raise notice 'read-only deletes the school   : blocked (policy hid the row)'; end if;
exception when insufficient_privilege then raise notice 'read-only deletes the school   : blocked'; end $$;

set request.jwt.claims = '{"email":"rival@other.org"}';
do $$ begin
  delete from workspaces where id='ws';
  if found then raise notice 'another school deletes it      : ALLOWED  <-- LEAK';
  else raise notice 'another school deletes it      : blocked (not a member)'; end if;
exception when insufficient_privilege then raise notice 'another school deletes it      : blocked'; end $$;

-- Ask as the owner, who can see every row — asking as the outsider would report
-- zero because the policy hides it, not because the deletes worked.
set request.jwt.claims = '{"email":"jl@fluxmedia.org"}';
select 'school survived all three attempts' as check, count(*) as rows from workspaces where id='ws';

-- Only now let someone who should be able to, do it. Put it back afterwards so
-- the checks below still have a row to work with.
set request.jwt.claims = '{"email":"ad@school.org"}';
do $$ begin
  delete from workspaces where id='ws-other';
  raise notice 'admin deletes another school   : allowed but row hidden (correct)';
exception when insufficient_privilege then raise notice 'admin deletes another school   : blocked (correct)'; end $$;

do $$
declare keep jsonb; begin
  select data into keep from workspaces where id='ws';
  delete from workspaces where id='ws';
  if found then
    raise notice 'admin deletes own school       : allowed (correct)';
    reset role;
    set request.jwt.claims = '{}';
    insert into workspaces (id, data) values ('ws', keep);
    set role authenticated;
  else
    raise notice 'admin deletes own school       : BLOCKED <-- too strict';
  end if;
exception when insufficient_privilege then raise notice 'admin deletes own school       : BLOCKED <-- too strict'; end $$;

set request.jwt.claims = '{"email":"jl@fluxmedia.org"}';
select 'owner sees every school    ' as who, count(*) as rows from workspaces;

\echo ''
\echo '--- lockout safety: owner still gets in if the users list is emptied ---'
reset role;
set request.jwt.claims = '{}';   -- the SQL editor carries no signed-in identity
update workspaces set data = '{"users":[]}'::jsonb where id='ws';
set role authenticated;
set request.jwt.claims = '{"email":"jl@fluxmedia.org"}';
select 'owner, empty users list    ' as who, count(*) as rows from workspaces;
set request.jwt.claims = '{"email":"coach@school.org"}';
select 'staff, empty users list    ' as who, count(*) as rows from workspaces;

\echo '--- and if the users key is missing entirely (malformed data) ---'
reset role;
set request.jwt.claims = '{}';
update workspaces set data = '{}'::jsonb where id='ws';
set role authenticated;
set request.jwt.claims = '{"email":"jl@fluxmedia.org"}';
select 'owner, no users key        ' as who, count(*) as rows from workspaces;
reset role;
