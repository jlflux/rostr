-- ============================================================
--  Recover work that landed in the pre-split `default` row
--
--  Symptom: edits made by a browser still running the pre-split build went into
--  `default`, while the deployed app reads the per-school rows — so the work is
--  safe in the database but invisible in the app.
--
--  Fix: rebuild the per-school rows from `default`, which is exactly what the
--  original migration does. Run the steps in order and read each result.
--
--  COST: any edit made in the NEW app since the migration is replaced by what
--  `default` holds. Step 1 preserves those first so nothing is unrecoverable.
-- ============================================================


-- ---------- 0. Confirm the work is really there ----------
-- Compare the two rows side by side before changing anything. The `default`
-- side should list the sponsors and teams you're missing.

select 'default' as row, jsonb_array_length(coalesce(data -> 'sponsors', '[]'::jsonb)) as sponsors,
       jsonb_array_length(coalesce(data -> 'teams', '[]'::jsonb)) as teams,
       jsonb_array_length(coalesce(data -> 'events', '[]'::jsonb)) as events, updated_at
from workspaces where id = 'default'
union all
select w.id, jsonb_array_length(coalesce(w.data -> 'sponsors', '[]'::jsonb)),
       jsonb_array_length(coalesce(w.data -> 'teams', '[]'::jsonb)),
       jsonb_array_length(coalesce(w.data -> 'events', '[]'::jsonb)), w.updated_at
from workspaces w where w.id not in ('default', '__platform__');

-- The actual names, so you can eyeball which ones are missing.
-- `in_default` = present in the old row; `in_school_row` = visible in the app now.
select coalesce(d.name, s.name) as sponsor,
       (d.name is not null) as in_default,
       (s.name is not null) as in_school_row
from (select e ->> 'name' as name from workspaces,
        jsonb_array_elements(coalesce(data -> 'sponsors', '[]'::jsonb)) e
      where id = 'default') d
full outer join
     (select e ->> 'name' as name from workspaces,
        jsonb_array_elements(coalesce(data -> 'sponsors', '[]'::jsonb)) e
      where id not in ('default', '__platform__')) s
  on d.name = s.name
order by in_school_row, sponsor;

-- Same for teams.
select coalesce(d.name, s.name) as team,
       (d.name is not null) as in_default,
       (s.name is not null) as in_school_row
from (select e ->> 'name' as name from workspaces,
        jsonb_array_elements(coalesce(data -> 'teams', '[]'::jsonb)) e
      where id = 'default') d
full outer join
     (select e ->> 'name' as name from workspaces,
        jsonb_array_elements(coalesce(data -> 'teams', '[]'::jsonb)) e
      where id not in ('default', '__platform__')) s
  on d.name = s.name
order by in_school_row, team;


-- ---------- 1. Preserve the current rows before overwriting them ----------
-- Forces a snapshot of every row as it stands right now, so anything entered in
-- the new app since the migration can be retrieved afterwards. Returns the
-- number of rows captured. Run this even if you think you changed nothing.

select take_workspace_snapshots() as rows_snapshotted;

-- Note the snapshot ids you may need to look at later:
select id, workspace_id, taken_at
from workspace_snapshots
where taken_at > now() - interval '10 minutes'
order by workspace_id;


-- ---------- 2. Rebuild the per-school rows from `default` ----------
--
--   Run section 1 of `supabase/split-per-school.sql` (the `do $$ ... $$` block).
--   It is written to be re-runnable: it replaces the derived rows and never
--   touches `default`.
--
--   Then run section 2 of that same file and confirm every line says OK.
--
-- Come back here afterwards.


-- ---------- 3. Confirm the app will now show the work ----------
-- The per-school totals should match `default`, and updated_at should be now.

select w.id, w.updated_at,
       jsonb_array_length(coalesce(w.data -> 'sponsors', '[]'::jsonb)) as sponsors,
       jsonb_array_length(coalesce(w.data -> 'teams', '[]'::jsonb)) as teams,
       jsonb_array_length(coalesce(w.data -> 'events', '[]'::jsonb)) as events
from workspaces w
order by (w.id = 'default'), w.id;

-- Then reload the app on every device. Hard-reload (Ctrl+Shift+R) on desktop;
-- on the phone, close the app fully and reopen it.


-- ============================================================
--  4. Afterwards — stop this from recurring
-- ============================================================
-- The old row is now a live hazard: any browser still on the pre-split build
-- writes to it, and that work will silently not appear. Once step 3 looks right
-- and you've spent a day in the app, remove it:
--
--   delete from workspaces where id = 'default';
--
-- Snapshots of `default` are retained independently, so this is not the last
-- copy. After this, an out-of-date browser fails loudly instead of writing
-- somewhere nobody reads.
