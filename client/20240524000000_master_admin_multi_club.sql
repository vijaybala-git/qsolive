-- ============================================================================
-- Master Admin, Multi-Club Display, and Club Managers (future)
-- Run after 20240522000000_user_club_setup.sql
-- See docs/requirements-settings-club-admin.md
-- ============================================================================

-- ============================================================================
-- 1. PROFILES: Add role for master admin (and future club manager)
-- ============================================================================
alter table public.profiles
  add column if not exists role text default 'user' check (role in ('user', 'master_admin'));

comment on column public.profiles.role is 'user = normal; master_admin = can manage roster for any club. Future: club_manager per club_managers.';

-- Optional: backfill existing rows
update public.profiles set role = 'user' where role is null;

-- ============================================================================
-- 2. CLUB_MANAGERS (future: per-club managers who can add/remove roster)
-- ============================================================================
create table if not exists public.club_managers (
  id uuid default gen_random_uuid() primary key,
  club_id uuid references public.clubs(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  added_at timestamptz default now(),
  unique(club_id, profile_id)
);

alter table public.club_managers enable row level security;

-- Everyone can see who is a manager (for UI)
create policy "Club managers are viewable by everyone"
  on public.club_managers for select using (true);

-- Only master admin (or club owner) can add/remove managers
create policy "Master admin and club owner can manage club_managers"
  on public.club_managers for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'master_admin')
    or exists (select 1 from public.clubs where id = club_managers.club_id and owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'master_admin')
    or exists (select 1 from public.clubs where id = club_managers.club_id and owner_id = auth.uid())
  );

-- ============================================================================
-- 3. RLS: Allow master admin to update any club and manage any roster
-- ============================================================================

-- Drop existing restrictive policies so we can replace with role-aware ones
drop policy if exists "Owners can update clubs" on public.clubs;

create policy "Owners and master admin can update clubs"
  on public.clubs for update
  using (
    owner_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'master_admin')
  );

-- Roster: allow owner OR master admin OR club manager (future) to insert/update/delete
drop policy if exists "Club owners can manage roster" on public.club_roster;

create policy "Club owners and master admin can manage roster"
  on public.club_roster for all
  using (
    exists (select 1 from public.clubs c where c.id = club_roster.club_id and c.owner_id = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'master_admin')
    or exists (select 1 from public.club_managers where club_id = club_roster.club_id and profile_id = auth.uid())
  )
  with check (
    exists (select 1 from public.clubs c where c.id = club_roster.club_id and c.owner_id = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'master_admin')
    or exists (select 1 from public.club_managers where club_id = club_roster.club_id and profile_id = auth.uid())
  );

-- ============================================================================
-- 4. RPC: Multi-club display (up to 4 clubs)
-- ============================================================================
create or replace function public.get_display_logs_clubs(club_ids uuid[])
returns setof contacts
language sql
security definer
set search_path = public
as $$
  select c.*
  from contacts c
  where c.operator_callsign in (
    select cr.callsign
    from club_roster cr
    where cr.club_id = any(club_ids)
  )
  order by c.qso_date desc, c.time_on desc
  limit 1000;
$$;

comment on function public.get_display_logs_clubs(uuid[]) is 'Returns contacts for operators in any of the given club rosters. Used when display_config.mode = clubs and club_ids has 1-4 UUIDs.';

-- ============================================================================
-- 5. HOW TO SET A MASTER ADMIN
-- Run in SQL Editor after replacing YOUR_PROFILE_UUID with the user's profile id (same as auth.users.id)
-- ============================================================================
-- update public.profiles set role = 'master_admin' where id = 'YOUR_PROFILE_UUID';
