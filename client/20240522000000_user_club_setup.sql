-- ============================================================================
-- 1. PROFILES (The Viewer/User)
-- Extends auth.users to store application specific info
-- ============================================================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  callsign text, -- The user's personal callsign
  
  -- Configuration for the Display
  -- Example: { "mode": "club", "target_id": "uuid-of-club" }
  -- Example: { "mode": "self", "target_id": "W1ABC" }
  display_config jsonb default '{"mode": "self"}'::jsonb,
  
  updated_at timestamptz default now(),
  constraint callsign_length check (char_length(callsign) >= 3)
);

-- RLS for Profiles
alter table public.profiles enable row level security;

-- Policies (drop first so script is re-runnable)
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Trigger to create profile on signup (Optional but recommended)
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists to avoid errors on re-run
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- 2. CLUBS (The Grouping Entity)
-- ============================================================================
create table if not exists public.clubs (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  owner_id uuid references public.profiles(id), -- Admin of the club
  created_at timestamptz default now()
);

-- RLS for Clubs
alter table public.clubs enable row level security;

drop policy if exists "Clubs are viewable by everyone" on public.clubs;
create policy "Clubs are viewable by everyone" on public.clubs for select using (true);
drop policy if exists "Users can create clubs" on public.clubs;
create policy "Users can create clubs" on public.clubs for insert with check (auth.uid() = owner_id);
drop policy if exists "Owners can update clubs" on public.clubs;
create policy "Owners can update clubs" on public.clubs for update using (auth.uid() = owner_id);

-- ============================================================================
-- 3. CLUB ROSTER (Mapping Callsigns to Clubs)
-- ============================================================================
create table if not exists public.club_roster (
  id uuid default gen_random_uuid() primary key,
  club_id uuid references public.clubs(id) on delete cascade not null,
  callsign text not null, -- The operator callsign (e.g. "W1ABC")
  added_at timestamptz default now(),
  
  unique(club_id, callsign)
);

-- RLS for Roster
alter table public.club_roster enable row level security;

drop policy if exists "Roster is viewable by everyone" on public.club_roster;
create policy "Roster is viewable by everyone" on public.club_roster for select using (true);
drop policy if exists "Club owners can manage roster" on public.club_roster;
create policy "Club owners can manage roster" on public.club_roster for all 
using ( exists ( select 1 from public.clubs where id = club_roster.club_id and owner_id = auth.uid() ) );

-- ============================================================================
-- 4. DEFAULT DATA
-- ============================================================================
-- Create a single default 'Public Club' only if none exists (avoids duplicates on re-run)
insert into public.clubs (name, description)
select 'Public Club', 'Default group for new operators'
where not exists (select 1 from public.clubs where name = 'Public Club'); 

-- ============================================================================
-- 5. HELPER FUNCTION
-- Simplifies the frontend logic for fetching logs based on mode
-- ============================================================================
create or replace function get_display_logs(
  filter_mode text,   -- 'club' or 'self'
  filter_value text   -- club_id (uuid string) or callsign (string)
)
returns setof contacts
language sql
security definer
as $$
  select * from contacts
  where
    case
      -- If mode is Club, match any operator in that club's roster
      when filter_mode = 'club' then
        operator_callsign in (
          select callsign from club_roster 
          where club_id = filter_value::uuid
        )
      -- If mode is Self, match the specific callsign
      when filter_mode = 'self' then
        operator_callsign = filter_value
      else false
    end
  order by qso_date desc, time_on desc
  limit 1000;
$$;