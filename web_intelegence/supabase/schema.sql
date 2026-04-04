create extension if not exists pgcrypto;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  auth_provider text default 'email',
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  auth_session_token text,
  device text,
  browser text,
  approximate_country text,
  ip_hash text,
  user_agent text,
  language text,
  timezone text,
  screen_width integer,
  screen_height integer,
  started_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.investigations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.user_sessions(id) on delete set null,
  query text not null,
  assistant_message text,
  answer text,
  provider text,
  verdict_label text,
  confidence numeric,
  uncertainty numeric,
  retries_used integer default 0,
  duration_ms integer,
  reformulated boolean not null default false,
  status text not null default 'started' check (status in ('started', 'completed', 'failed')),
  error_message text,
  sources_json jsonb,
  result_json jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.source_clicks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  source_url text not null,
  source_domain text,
  source_title text,
  stance text,
  clicked_at timestamptz not null default now()
);

create table if not exists public.investigation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  event_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  thumb text check (thumb in ('up', 'down')),
  rating integer check (rating between 1 and 5),
  comment text,
  copied boolean not null default false,
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (investigation_id, user_id)
);

create table if not exists public.user_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  got_value boolean,
  returned_later boolean,
  upgraded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (investigation_id, user_id)
);

create table if not exists public.admin_user_meta (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_blocked boolean not null default false,
  role text not null default 'user',
  plan text not null default 'free',
  consent_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, auth_provider, created_at, last_login_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_app_meta_data->>'provider', 'email'),
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    auth_provider = excluded.auth_provider,
    last_login_at = now();

  insert into public.admin_user_meta (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_sessions enable row level security;
alter table public.investigations enable row level security;
alter table public.source_clicks enable row level security;
alter table public.investigation_events enable row level security;
alter table public.feedback enable row level security;
alter table public.user_outcomes enable row level security;
alter table public.admin_user_meta enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id);

drop policy if exists "sessions_select_own" on public.user_sessions;
create policy "sessions_select_own" on public.user_sessions
for select using (auth.uid() = user_id);

drop policy if exists "sessions_insert_own" on public.user_sessions;
create policy "sessions_insert_own" on public.user_sessions
for insert with check (auth.uid() = user_id);

drop policy if exists "sessions_update_own" on public.user_sessions;
create policy "sessions_update_own" on public.user_sessions
for update using (auth.uid() = user_id);

drop policy if exists "investigations_select_own" on public.investigations;
create policy "investigations_select_own" on public.investigations
for select using (auth.uid() = user_id);

drop policy if exists "investigations_insert_own" on public.investigations;
create policy "investigations_insert_own" on public.investigations
for insert with check (auth.uid() = user_id);

drop policy if exists "investigations_update_own" on public.investigations;
create policy "investigations_update_own" on public.investigations
for update using (auth.uid() = user_id);

drop policy if exists "source_clicks_select_own" on public.source_clicks;
create policy "source_clicks_select_own" on public.source_clicks
for select using (auth.uid() = user_id);

drop policy if exists "source_clicks_insert_own" on public.source_clicks;
create policy "source_clicks_insert_own" on public.source_clicks
for insert with check (auth.uid() = user_id);

drop policy if exists "events_select_own" on public.investigation_events;
create policy "events_select_own" on public.investigation_events
for select using (auth.uid() = user_id);

drop policy if exists "events_insert_own" on public.investigation_events;
create policy "events_insert_own" on public.investigation_events
for insert with check (auth.uid() = user_id);

drop policy if exists "feedback_select_own" on public.feedback;
create policy "feedback_select_own" on public.feedback
for select using (auth.uid() = user_id);

drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own" on public.feedback
for insert with check (auth.uid() = user_id);

drop policy if exists "feedback_update_own" on public.feedback;
create policy "feedback_update_own" on public.feedback
for update using (auth.uid() = user_id);

drop policy if exists "outcomes_select_own" on public.user_outcomes;
create policy "outcomes_select_own" on public.user_outcomes
for select using (auth.uid() = user_id);

drop policy if exists "outcomes_insert_own" on public.user_outcomes;
create policy "outcomes_insert_own" on public.user_outcomes
for insert with check (auth.uid() = user_id);

drop policy if exists "outcomes_update_own" on public.user_outcomes;
create policy "outcomes_update_own" on public.user_outcomes
for update using (auth.uid() = user_id);

drop policy if exists "admin_meta_select_own" on public.admin_user_meta;
create policy "admin_meta_select_own" on public.admin_user_meta
for select using (auth.uid() = user_id);

drop trigger if exists set_feedback_updated_at on public.feedback;
create trigger set_feedback_updated_at
before update on public.feedback
for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists set_outcomes_updated_at on public.user_outcomes;
create trigger set_outcomes_updated_at
before update on public.user_outcomes
for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists set_admin_user_meta_updated_at on public.admin_user_meta;
create trigger set_admin_user_meta_updated_at
before update on public.admin_user_meta
for each row execute procedure public.set_current_timestamp_updated_at();
