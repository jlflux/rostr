-- ============================================================
--  Refuse a save that would wipe out a school's data
--
--  The app is one safeguard, but a bug in it can still send a bad write. This
--  is the backstop that doesn't depend on the app being correct: the database
--  itself rejects an update that destroys most of a school's records.
--
--  What it blocks: a write that cuts any sizeable collection to less than half
--  its size — 271 events becoming 117, or 37 teams becoming 11. That is what a
--  device pushing demo data or a stale cache looks like. A whole-total check is
--  not enough: the demo seed still carried half the record count, so it slipped
--  through one.
--  What it allows: normal editing, bulk deletes (those mark records deleted
--  rather than removing them), clearing out a small collection such as the
--  placeholder assets, adding and removing a school, and restoring a snapshot.
--
--  Run this once. Section 3 shows how to override it for a genuine bulk change.
-- ============================================================


-- ---------- 1. The check ----------

create or replace function guard_workspace_overwrite()
returns trigger
language plpgsql
as $$
declare
  colls text[] := array[
    'users','teams','events','opponents','sponsors','agreements',
    'benefitTemplates','tierSettings','requests','assets','tasks','activity'];
  c        text;
  old_n    integer;
  new_n    integer;
  -- Below this many records a collection is too small to judge, so early setup
  -- and small collections are never blocked.
  floor_n  constant integer := 20;
begin
  -- An explicit override, set for the current transaction only.
  if coalesce(current_setting('app.allow_shrink', true), 'off') = 'on' then
    return new;
  end if;

  foreach c in array colls loop
    old_n := jsonb_array_length(coalesce(old.data -> c, '[]'::jsonb));
    new_n := jsonb_array_length(coalesce(new.data -> c, '[]'::jsonb));

    if old_n >= floor_n and new_n * 2 < old_n then
      raise exception using
        errcode = 'check_violation',
        message = format(
          'Refused: this save would cut %s of %s from %s to %s.',
          c, new.id, old_n, new_n),
        hint = 'Nothing was changed. If this is deliberate, run "set local app.allow_shrink = ''on'';" in the same transaction.';
    end if;
  end loop;

  return new;
end $$;

drop trigger if exists workspaces_guard_overwrite on workspaces;
create trigger workspaces_guard_overwrite
  before update on workspaces
  for each row
  execute function guard_workspace_overwrite();


-- ---------- 2. Check it's active ----------

select tgname as trigger, tgenabled as enabled
from pg_trigger
where tgrelid = 'workspaces'::regclass and not tgisinternal;


-- ---------- 3. Overriding it, when you really mean it ----------
-- Both statements must run together, in one transaction:
--
--   begin;
--   set local app.allow_shrink = 'on';
--   update workspaces set data = ... where id = 'org-hhs';
--   commit;
--
-- Restoring a snapshot normally grows the row and needs no override. It only
-- comes up if you restore a much smaller snapshot on purpose.
