create table public.ai_followup_request_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index ai_followup_request_log_created_at_idx
  on public.ai_followup_request_log (created_at);

create index ai_followup_request_log_user_created_at_idx
  on public.ai_followup_request_log (user_id, created_at);

alter table public.ai_followup_request_log enable row level security;
revoke all on public.ai_followup_request_log from public, anon, authenticated;
grant all on public.ai_followup_request_log to service_role;
grant usage, select on sequence public.ai_followup_request_log_id_seq to service_role;

create or replace function public.reserve_ai_followup_request(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_at timestamptz := now();
  utc_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  utc_month_start timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  usage_settings jsonb;
  rate_settings jsonb;
  monthly_request_limit bigint;
  rate_limit bigint;
  rate_window_minutes integer;
  daily_request_count bigint;
  monthly_request_count bigint;
  window_request_count bigint;
begin
  if target_user is null then
    raise exception 'AI_FOLLOWUP_INVALID_USER';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('marics:ai-followup:quota', 0));

  select value into usage_settings
  from public.platform_settings
  where key = 'ai_usage_cap';

  select value into rate_settings
  from public.platform_settings
  where key = 'rate_limit_config';

  if usage_settings is null
    or rate_settings is null
    or jsonb_typeof(usage_settings) <> 'object'
    or coalesce(usage_settings ->> 'monthlyRequests', '') !~ '^[1-9][0-9]{0,8}$'
    or jsonb_typeof(rate_settings) <> 'object'
    or coalesce(rate_settings ->> 'max', '') !~ '^[1-9][0-9]{0,8}$'
    or coalesce(rate_settings ->> 'timeWindowMinutes', '') !~ '^[1-9][0-9]{0,8}$'
  then
    raise exception 'AI_FOLLOWUP_LIMIT_CONFIG_INVALID';
  end if;

  monthly_request_limit := (usage_settings ->> 'monthlyRequests')::bigint;
  rate_limit := (rate_settings ->> 'max')::bigint;
  rate_window_minutes := (rate_settings ->> 'timeWindowMinutes')::integer;

  delete from public.ai_followup_request_log
  where created_at < least(
    utc_month_start,
    requested_at - make_interval(mins => rate_window_minutes)
  );

  select count(*) into daily_request_count
  from public.ai_followup_request_log
  where user_id = target_user and created_at >= utc_day_start;

  if daily_request_count >= 10 then
    raise exception 'AI_FOLLOWUP_DAILY_LIMIT';
  end if;

  select count(*) into monthly_request_count
  from public.ai_followup_request_log
  where created_at >= utc_month_start;

  if monthly_request_count >= monthly_request_limit then
    raise exception 'AI_USAGE_CAP_REACHED';
  end if;

  select count(*) into window_request_count
  from public.ai_followup_request_log
  where user_id = target_user
    and created_at >= requested_at - make_interval(mins => rate_window_minutes);

  if window_request_count >= rate_limit then
    raise exception 'AI_RATE_LIMITED';
  end if;

  insert into public.ai_followup_request_log (user_id, created_at)
  values (target_user, requested_at);
end;
$$;

revoke all on function public.reserve_ai_followup_request(uuid) from public, anon, authenticated;
grant execute on function public.reserve_ai_followup_request(uuid) to service_role;
