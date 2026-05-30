-- ===========================================================================
-- TravelGit schema
--
-- NOTE ON SECURITY MODEL (read this):
-- For the hackathon/POC we use APP-MANAGED identity (simple email login), not
-- Supabase Auth. That means RLS cannot key off auth.uid(). To still ship with
-- RLS enabled (so the table isn't wide open by accident), we enable RLS and add
-- permissive policies scoped to the anon role. This is NOT production-secure —
-- anyone with the anon key can read/write. The prod path is to migrate to
-- Supabase Auth and replace these policies with auth.uid()-based ownership
-- checks. This is intentional and documented.
-- ===========================================================================

-- Users (app-managed; not Supabase Auth users)
create table if not exists public.users (
  id text primary key,
  name text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

-- Trips. The itinerary, commits, and vibe answers are stored as JSONB blobs to
-- mirror the existing client model with minimal friction.
create table if not exists public.trips (
  id text primary key,
  name text not null,
  destination text not null,
  start_date text not null,
  end_date text not null,
  owner_id text not null references public.users(id) on delete cascade,
  collaborator_emails jsonb not null default '[]'::jsonb,
  plan_path text not null default 'known-destination',
  vibe_answers jsonb,
  itinerary jsonb not null default '[]'::jsonb,
  commits jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Merge requests live in their own table so collaborators can open them
-- independently and the owner can merge/close.
create table if not exists public.merge_requests (
  id text primary key,
  trip_id text not null references public.trips(id) on delete cascade,
  title text not null,
  description text not null default '',
  author_id text not null,
  author_name text not null,
  status text not null default 'open', -- open | merged | closed
  proposed_itinerary jsonb not null default '[]'::jsonb,
  base_itinerary jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Collaboration invites: owner invites an email; invitee accepts to join.
create table if not exists public.invites (
  id text primary key,
  trip_id text not null references public.trips(id) on delete cascade,
  trip_name text not null,
  inviter_name text not null,
  invitee_email text not null,
  status text not null default 'pending', -- pending | accepted | declined
  created_at timestamptz not null default now()
);

create index if not exists idx_trips_owner on public.trips(owner_id);
create index if not exists idx_mr_trip on public.merge_requests(trip_id);
create index if not exists idx_invites_email on public.invites(invitee_email);

-- --- RLS -------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.trips enable row level security;
alter table public.merge_requests enable row level security;
alter table public.invites enable row level security;

-- Permissive policies for the anon role (POC). Replace with auth.uid()-based
-- policies when migrating to Supabase Auth.
do $$
begin
  -- users
  if not exists (select 1 from pg_policies where tablename = 'users' and policyname = 'anon_all_users') then
    create policy anon_all_users on public.users for all to anon using (true) with check (true);
  end if;
  -- trips
  if not exists (select 1 from pg_policies where tablename = 'trips' and policyname = 'anon_all_trips') then
    create policy anon_all_trips on public.trips for all to anon using (true) with check (true);
  end if;
  -- merge_requests
  if not exists (select 1 from pg_policies where tablename = 'merge_requests' and policyname = 'anon_all_mr') then
    create policy anon_all_mr on public.merge_requests for all to anon using (true) with check (true);
  end if;
  -- invites
  if not exists (select 1 from pg_policies where tablename = 'invites' and policyname = 'anon_all_invites') then
    create policy anon_all_invites on public.invites for all to anon using (true) with check (true);
  end if;
end $$;

-- Seed the demo users so quick-login works cross-device.
insert into public.users (id, name, email) values
  ('user_aashna', 'Aashna', 'aashnakunk@gmail.com'),
  ('user_anushka', 'Anushka', 'anushka@gmail.com'),
  ('user_binku', 'Binku', 'binkuoyl@gmail.com')
on conflict (email) do nothing;
