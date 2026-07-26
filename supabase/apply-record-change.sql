-- ============================================================
--  apply_record_change — merge a single record server-side
--
--  Replaces "upload the entire workspace on every edit" with "send the one
--  record that changed." Because the merge happens inside Postgres against the
--  CURRENT row, two people editing different records no longer overwrite each
--  other — which whole-document upserts could not avoid.
--
--  security invoker (the default) so the existing row-level policy still
--  decides who may write. This grants no new access.
-- ============================================================

create or replace function apply_record_change(
  p_workspace  text,
  p_collection text,
  p_id         text,
  p_patch      jsonb,   -- update: fields to merge. add: the whole new record.
  p_op         text     -- 'update' | 'add' | 'remove'
) returns boolean
language plpgsql
as $$
declare
  current_list jsonb;
  next_list    jsonb;
  found        boolean := false;
begin
  if p_op not in ('update', 'add', 'remove') then
    raise exception 'apply_record_change: unknown op %', p_op;
  end if;

  select data -> p_collection into current_list
  from workspaces where id = p_workspace;

  if current_list is null then
    return false;                       -- unknown workspace or collection
  end if;

  if p_op = 'update' then
    select coalesce(jsonb_agg(
             case when elem ->> 'id' = p_id then elem || p_patch else elem end
             order by ord),
           '[]'::jsonb)
      into next_list
      from jsonb_array_elements(current_list) with ordinality as t(elem, ord);
    select exists (
      select 1 from jsonb_array_elements(current_list) e where e ->> 'id' = p_id
    ) into found;
    if not found then
      return false;                     -- caller falls back to a full save
    end if;

  elsif p_op = 'add' then
    -- Guard against a retry inserting a duplicate.
    if exists (select 1 from jsonb_array_elements(current_list) e where e ->> 'id' = p_id) then
      return true;
    end if;
    next_list := jsonb_build_array(p_patch) || current_list;

  else -- remove
    select coalesce(jsonb_agg(elem order by ord), '[]'::jsonb)
      into next_list
      from jsonb_array_elements(current_list) with ordinality as t(elem, ord)
      where elem ->> 'id' <> p_id;
  end if;

  update workspaces
     set data = jsonb_set(data, array[p_collection], next_list),
         updated_at = now()
   where id = p_workspace;

  return true;
end $$;
