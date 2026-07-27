-- ============================================================
--  Retire the pre-split `default` row
--
--  ONLY run this AFTER `recover-weekend-work.sql` and after you've confirmed in
--  the app that everything you expect to see is there. This is the last step of
--  the per-school migration.
--
--  Why it matters: while `default` exists and is writable, a browser still
--  running the pre-split build keeps saving into it — successfully, with no
--  error — and that work never appears in the app. Deleting the row isn't
--  enough on its own, because an old build would just recreate it on its next
--  save. So we delete it AND block it from coming back.
-- ============================================================


-- ---------- 1. Last check before deleting ----------
-- The per-school rows must already contain everything. If any count here is
-- lower than `default`, STOP — run the recovery first.

select w.id,
       jsonb_array_length(coalesce(w.data -> 'sponsors', '[]'::jsonb)) as sponsors,
       jsonb_array_length(coalesce(w.data -> 'teams',    '[]'::jsonb)) as teams,
       jsonb_array_length(coalesce(w.data -> 'events',   '[]'::jsonb)) as events,
       w.updated_at
from workspaces w
order by (w.id = 'default'), w.id;

-- Belt and braces: capture the current state of everything one more time.
select take_workspace_snapshots() as rows_snapshotted;


-- ---------- 2. Delete the row ----------
-- Snapshots of `default` are kept on their own retention schedule, so this is
-- not the last copy. To see them:
--   select id, taken_at from workspace_snapshots
--   where workspace_id = 'default' order by taken_at desc;

delete from workspaces where id = 'default';


-- ---------- 3. Stop it from ever coming back ----------
-- A RESTRICTIVE policy is ANDed with the existing permissive one, so this can
-- only ever subtract access. Any client — old build or new — is now refused
-- when it tries to read or write `default`, which turns a silent
-- writing-to-nowhere into a visible "Not saving" error in the app.

drop policy if exists "retired rows are off limits" on workspaces;
create policy "retired rows are off limits" on workspaces
  as restrictive for all to authenticated
  using (id <> 'default')
  with check (id <> 'default');


-- ---------- 4. Verify ----------
-- Expect: no `default` row, and the policy listed as RESTRICTIVE.

select count(*) as default_rows_remaining
from workspaces where id = 'default';

select polname as policy,
       case when polpermissive then 'permissive' else 'RESTRICTIVE' end as kind
from pg_policy
where polrelid = 'workspaces'::regclass
order by polpermissive, polname;

-- Finally, reload the app and confirm it still works normally.
