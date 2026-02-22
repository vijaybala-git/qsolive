-- ============================================================================
-- CLEANUP FUNCTION
-- Deletes contacts and stats older than a specified number of hours.
-- Usage: SELECT cleanup_old_data(24); -- Deletes data older than 24 hours
-- ============================================================================

create or replace function public.cleanup_old_data(hours_retention int)
returns jsonb
language plpgsql
security definer
as $$
declare
  deleted_contacts int;
  deleted_stats int;
begin
  -- 1. Delete contacts older than the retention period
  delete from public.contacts 
  where created_at < now() - (hours_retention || ' hours')::interval;
  
  get diagnostics deleted_contacts = row_count;

  -- 2. Delete stats where the stat_date is older than the retention period
  delete from public.contact_stats
  where stat_date < (now() - (hours_retention || ' hours')::interval)::date;
  
  get diagnostics deleted_stats = row_count;

  -- 3. Return a summary of what was deleted
  return jsonb_build_object('contacts_deleted', deleted_contacts, 'stats_deleted', deleted_stats);
end;
$$;