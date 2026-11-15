-- Batch 8: bind certification questions to each attempt; refund AI follow-up quota on failure.

-- ---------------------------------------------------------------------------
-- 1) Persist the exact scenario IDs served at certification start.
-- ---------------------------------------------------------------------------
alter table public.certification_assessments
  add column if not exists question_ids uuid[];

-- ---------------------------------------------------------------------------
-- 2) Refund the most recent AI follow-up reservation when Claude fails.
-- ---------------------------------------------------------------------------
create or replace function public.refund_ai_followup_request(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.ai_followup_request_log
  where id = (
    select id
    from public.ai_followup_request_log
    where user_id = target_user
    order by created_at desc
    limit 1
  );
end;
$$;

revoke all on function public.refund_ai_followup_request(uuid) from public, anon, authenticated;
grant execute on function public.refund_ai_followup_request(uuid) to service_role;
