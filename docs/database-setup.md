# Database Setup Guide

**Part of the core docs:** [Documentation index](README.md) · [Architecture](architecture.md) · [Client setup](client-setup.md) · [Deployment](deployment.md)

This guide walks through setting up the PostgreSQL database in Supabase for QSOlive.

## Prerequisites

- Supabase account (free tier works)
- Basic SQL knowledge (optional but helpful)

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign in with GitHub
4. Click "New Project"
5. Fill in:
   - **Name**: `qsolive` (or your preferred name)
   - **Database Password**: Generate a strong password (save it!) qsolive-project!
   - **Region**: Choose closest to your operators
   - **Pricing Plan**: Free (can upgrade later)
6. Click "Create new project"
7. Wait ~2 minutes for provisioning

## Step 2: Enable PostGIS Extension

PostGIS adds geographic/spatial capabilities to PostgreSQL.

1. In Supabase dashboard, go to **Database** → **Extensions**
2. Search for "postgis"
3. Click "Enable" next to PostGIS
4. Wait for confirmation

## Step 3: Create Database Schema

### Using the SQL Editor

1. Go to **SQL Editor** in the sidebar
2. Click "New query"
3. Copy and paste the following SQL
4. Click "Run" or press `Ctrl+Enter`

### Main Schema SQL

```sql
-- ============================================================================
-- QSOlive Database Schema
-- ============================================================================

-- Enable PostGIS for geographic data types
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Main contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Contact identification
  callsign VARCHAR(20) NOT NULL,
  contacted_callsign VARCHAR(20) NOT NULL,
  qso_date DATE NOT NULL,
  time_on TIME NOT NULL,
  time_off TIME,
  
  -- Radio parameters
  band VARCHAR(10),
  mode VARCHAR(20),
  frequency DECIMAL(10, 6),  -- In MHz
  rst_sent VARCHAR(10),
  rst_rcvd VARCHAR(10),
  tx_power INTEGER,  -- Watts
  
  -- Location data (contacted station)
  gridsquare VARCHAR(10),
  country VARCHAR(100),
  dxcc INTEGER,
  state VARCHAR(50),
  county VARCHAR(100),
  location GEOGRAPHY(POINT, 4326),  -- PostGIS geography type
  
  -- Operator location
  my_gridsquare VARCHAR(10),
  my_country VARCHAR(100),
  my_state VARCHAR(50),
  my_location GEOGRAPHY(POINT, 4326),
  
  -- Operator identification
  operator_callsign VARCHAR(20) NOT NULL,
  station_callsign VARCHAR(20),
  
  -- Additional metadata
  logger_software VARCHAR(50),
  comment TEXT,
  notes TEXT,
  qsl_sent VARCHAR(1),
  qsl_rcvd VARCHAR(1),
  lotw_sent VARCHAR(1),
  lotw_rcvd VARCHAR(1),
  
  -- Contest/special event data
  contest_id VARCHAR(50),
  srx INTEGER,  -- Serial number received
  stx INTEGER,  -- Serial number sent
  
  -- Raw ADIF (for debugging/reprocessing)
  raw_adif TEXT,
  
  -- Constraints
  CONSTRAINT valid_frequency CHECK (frequency >= 0.001 AND frequency <= 300000),
  CONSTRAINT valid_power CHECK (tx_power >= 0 AND tx_power <= 2000)
);

-- Statistics/aggregation table (for performance)
CREATE TABLE IF NOT EXISTS contact_stats (
  id BIGSERIAL PRIMARY KEY,
  stat_date DATE NOT NULL,
  operator_callsign VARCHAR(20) NOT NULL,
  total_contacts INTEGER DEFAULT 0,
  unique_callsigns INTEGER DEFAULT 0,
  countries INTEGER DEFAULT 0,
  modes JSONB,  -- {"SSB": 10, "CW": 5, ...}
  bands JSONB,  -- {"20m": 8, "40m": 7, ...}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(stat_date, operator_callsign)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Contacts table indexes
CREATE INDEX IF NOT EXISTS idx_contacts_callsign 
  ON contacts(callsign);

CREATE INDEX IF NOT EXISTS idx_contacts_contacted 
  ON contacts(contacted_callsign);

CREATE INDEX IF NOT EXISTS idx_contacts_operator 
  ON contacts(operator_callsign);

CREATE INDEX IF NOT EXISTS idx_contacts_date_time 
  ON contacts(qso_date DESC, time_on DESC);

CREATE INDEX IF NOT EXISTS idx_contacts_created 
  ON contacts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contacts_mode 
  ON contacts(mode) 
  WHERE mode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_band 
  ON contacts(band) 
  WHERE band IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_frequency 
  ON contacts(frequency) 
  WHERE frequency IS NOT NULL;

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_contacts_operator_recent 
  ON contacts(operator_callsign, created_at DESC);

-- Spatial index for geographic queries
CREATE INDEX IF NOT EXISTS idx_contacts_location 
  ON contacts USING GIST(location) 
  WHERE location IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_my_location 
  ON contacts USING GIST(my_location) 
  WHERE my_location IS NOT NULL;

-- Full text search (optional, for searching comments/notes)
CREATE INDEX IF NOT EXISTS idx_contacts_search 
  ON contacts USING GIN(to_tsvector('english', 
    COALESCE(comment, '') || ' ' || COALESCE(notes, '')));

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Contact summary by operator
CREATE OR REPLACE VIEW operator_summary AS
SELECT 
  operator_callsign,
  COUNT(*) as total_contacts,
  COUNT(DISTINCT contacted_callsign) as unique_calls,
  COUNT(DISTINCT country) as countries,
  COUNT(DISTINCT mode) as modes_used,
  COUNT(DISTINCT band) as bands_used,
  MIN(created_at) as first_contact,
  MAX(created_at) as last_contact
FROM contacts
GROUP BY operator_callsign;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to calculate distance between two points
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 DECIMAL, 
  lon1 DECIMAL, 
  lat2 DECIMAL, 
  lon2 DECIMAL
)
RETURNS INTEGER AS $$
BEGIN
  -- Returns distance in kilometers
  RETURN ST_Distance(
    ST_MakePoint(lon1, lat1)::geography,
    ST_MakePoint(lon2, lat2)::geography
  ) / 1000;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to expose location as WKT (Well-Known Text) for frontend
CREATE OR REPLACE FUNCTION location_wkt(rec contacts)
RETURNS text AS $$
  SELECT ST_AsText(rec.location);
$$ LANGUAGE SQL STABLE;

-- Function to update statistics
CREATE OR REPLACE FUNCTION update_contact_stats()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_contacts INTEGER;
  v_unique_callsigns INTEGER;
  v_countries INTEGER;
  v_modes JSONB;
  v_bands JSONB;
BEGIN
  -- Calculate aggregates
  SELECT 
    COUNT(*),
    COUNT(DISTINCT contacted_callsign),
    COUNT(DISTINCT country)
  INTO v_total_contacts, v_unique_callsigns, v_countries
  FROM contacts
  WHERE operator_callsign = NEW.operator_callsign
    AND qso_date = NEW.qso_date;

  -- Calculate modes
  SELECT jsonb_object_agg(mode, cnt)
  INTO v_modes
  FROM (
    SELECT mode, COUNT(*) as cnt
    FROM contacts
    WHERE operator_callsign = NEW.operator_callsign
      AND qso_date = NEW.qso_date
      AND mode IS NOT NULL
    GROUP BY mode
  ) m;

  -- Calculate bands
  SELECT jsonb_object_agg(band, cnt)
  INTO v_bands
  FROM (
    SELECT band, COUNT(*) as cnt
    FROM contacts
    WHERE operator_callsign = NEW.operator_callsign
      AND qso_date = NEW.qso_date
      AND band IS NOT NULL
    GROUP BY band
  ) b;

  INSERT INTO contact_stats (
    stat_date,
    operator_callsign,
    total_contacts,
    unique_callsigns,
    countries,
    modes,
    bands,
    updated_at
  )
  VALUES (
    NEW.qso_date,
    NEW.operator_callsign,
    v_total_contacts,
    v_unique_callsigns,
    v_countries,
    COALESCE(v_modes, '{}'::jsonb),
    COALESCE(v_bands, '{}'::jsonb),
    NOW()
  )
  ON CONFLICT (stat_date, operator_callsign) 
  DO UPDATE SET
    total_contacts = EXCLUDED.total_contacts,
    unique_callsigns = EXCLUDED.unique_callsigns,
    countries = EXCLUDED.countries,
    modes = EXCLUDED.modes,
    bands = EXCLUDED.bands,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update stats on new contact
CREATE TRIGGER trigger_update_stats
  AFTER INSERT ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_stats();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on contacts table
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Allow public read access (anyone can view contacts)
DROP POLICY IF EXISTS "Public read access" ON contacts;
CREATE POLICY "Public read access" 
  ON contacts FOR SELECT 
  USING (true);

-- Allow insert with valid API key (anon role)
DROP POLICY IF EXISTS "Allow authenticated inserts" ON contacts;
CREATE POLICY "Allow authenticated inserts" 
  ON contacts FOR INSERT 
  TO anon
  WITH CHECK (true);

-- Allow stats table read
ALTER TABLE contact_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read stats" ON contact_stats;
CREATE POLICY "Public read stats" 
  ON contact_stats FOR SELECT 
  USING (true);

-- ============================================================================
-- USER, CLUBS, AND ROSTER (Settings & Club Admin)
-- Run after the main schema above. See Architecture doc for display_config usage.
-- ============================================================================

-- Profiles (extends auth.users: callsign, display_config)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  callsign TEXT,
  display_config JSONB DEFAULT '{"mode": "self"}'::jsonb,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'master_admin')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT callsign_length CHECK (char_length(callsign) >= 3)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Trigger: create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Clubs (name unique normalized; description required)
CREATE TABLE IF NOT EXISTS public.clubs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clubs_name_lower_unique
  ON public.clubs (lower(trim(name)));

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clubs are viewable by everyone" ON public.clubs;
CREATE POLICY "Clubs are viewable by everyone" ON public.clubs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can create clubs" ON public.clubs;
CREATE POLICY "Users can create clubs" ON public.clubs FOR INSERT WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "Owners and master admin can update clubs" ON public.clubs;
CREATE POLICY "Owners and master admin can update clubs" ON public.clubs FOR UPDATE
  USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master_admin'));

-- Club roster (callsigns per club)
CREATE TABLE IF NOT EXISTS public.club_roster (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE NOT NULL,
  callsign TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(club_id, callsign)
);

ALTER TABLE public.club_roster ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Roster is viewable by everyone" ON public.club_roster;
CREATE POLICY "Roster is viewable by everyone" ON public.club_roster FOR SELECT USING (true);
DROP POLICY IF EXISTS "Club owners and master admin can manage roster" ON public.club_roster;
CREATE POLICY "Club owners and master admin can manage roster" ON public.club_roster FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_roster.club_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_roster.club_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master_admin')
  );

-- RPC: display logs for self or single club
CREATE OR REPLACE FUNCTION get_display_logs(filter_mode TEXT, filter_value TEXT)
RETURNS SETOF contacts
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM contacts
  WHERE
    CASE
      WHEN filter_mode = 'club' THEN operator_callsign IN (SELECT callsign FROM club_roster WHERE club_id = filter_value::uuid)
      WHEN filter_mode = 'self' THEN operator_callsign = filter_value
      ELSE false
    END
  ORDER BY qso_date DESC, time_on DESC
  LIMIT 1000;
$$;

-- RPC: display logs for multiple clubs (up to 4)
CREATE OR REPLACE FUNCTION public.get_display_logs_clubs(club_ids UUID[])
RETURNS SETOF contacts
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.* FROM contacts c
  WHERE c.operator_callsign IN (
    SELECT cr.callsign FROM club_roster cr WHERE cr.club_id = ANY(club_ids)
  )
  ORDER BY c.qso_date DESC, c.time_on DESC
  LIMIT 1000;
$$;

-- RPC: get club by name (for duplicate-create message)
CREATE OR REPLACE FUNCTION public.get_club_by_name(name_input TEXT)
RETURNS SETOF public.clubs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.clubs WHERE lower(trim(name)) = lower(trim(name_input)) LIMIT 1;
$$;

-- Designate master admin (run once per user): update public.profiles set role = 'master_admin' where id = '<uuid>';

-- Optional (Phase 2): club_join_requests table for in-app "Pending requests" and Approve/Deny.
-- Phase 1 uses mailto to send join requests to the club owner; no table required.

-- ============================================================================
-- MAINTENANCE
-- ============================================================================

-- Function to cleanup old contacts (Retention Policy)
-- Usage: SELECT cleanup_contacts(48);  -- Delete older than 48 hours
-- Usage: SELECT cleanup_contacts(-1);  -- Do nothing (Test mode)
CREATE OR REPLACE FUNCTION cleanup_contacts(retention_hours INTEGER DEFAULT 48)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Safety check: if retention_hours is negative, disable deletion
  IF retention_hours < 0 THEN
    RETURN 0;
  END IF;

  DELETE FROM contacts
  WHERE created_at < NOW() - (retention_hours || ' hours')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Insert sample contact
INSERT INTO contacts (
  callsign,
  contacted_callsign,
  qso_date,
  time_on,
  band,
  mode,
  frequency,
  operator_callsign,
  gridsquare,
  location,
  my_gridsquare,
  my_location
)
VALUES (
  'W1ABC',
  'DL1ABC',
  CURRENT_DATE,
  CURRENT_TIME,
  '20m',
  'SSB',
  14.250,
  'W1ABC',
  'JO62qm',
  ST_SetSRID(ST_MakePoint(13.4050, 52.5200), 4326)::geography,  -- Berlin
  'FN31pr',
  ST_SetSRID(ST_MakePoint(-71.0589, 42.3601), 4326)::geography  -- Boston
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE contacts IS 'Main table storing all QSO contacts';
COMMENT ON COLUMN contacts.location IS 'Geographic location of contacted station (PostGIS)';
COMMENT ON COLUMN contacts.my_location IS 'Geographic location of operator (PostGIS)';
COMMENT ON TABLE contact_stats IS 'Aggregated statistics for performance';
```

## Step 4: Verify Installation

Run this query to verify everything is set up correctly:

```sql
-- Check tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected output (core + user/clubs):
-- contacts, contact_stats, profiles, clubs, club_roster

-- Check PostGIS
SELECT PostGIS_version();

-- Check indexes
SELECT indexname 
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY indexname;

-- Count contacts (should be 0 or 1 if sample data inserted)
SELECT COUNT(*) FROM contacts;
```

## Step 5: Get API Credentials

1. Go to **Settings** → **API**
2. Copy the following (you'll need these for configuration):
   - **Project URL**: `https://hrhenmerdrqtfbzcaxrq.supabase.co` (This is your Project ID + .supabase.co)
   - **anon public key**: `eyJhbGc...` (safe to use in frontend)
    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyaGVubWVyZHJxdGZiemNheHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NzgzMjQsImV4cCI6MjA4NjM1NDMyNH0.8ArH3_ssvMw5cW8zFaPvc61KPlXCBRIU4tmsSBQGnqw

   - **service_role key**: `eyJhbGc...` (keep secret, use in client)
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyaGVubWVyZHJxdGZiemNheHJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc3ODMyNCwiZXhwIjoyMDg2MzU0MzI0fQ.wXVsi-L_ycCDSDsZ0OKsEs3aNRMHf1jnLNW2TJri9d8
## Step 6: Test API Access

You can test the API directly from the SQL Editor or using curl:

```bash
# Test GET (retrieve contacts)
curl 'https://YOUR-PROJECT.supabase.co/rest/v1/contacts?select=*&limit=10' \
  -H "apikey: YOUR-ANON-KEY" \
  -H "Authorization: Bearer YOUR-ANON-KEY"

# Test POST (create contact)
curl -X POST 'https://YOUR-PROJECT.supabase.co/rest/v1/contacts' \
  -H "apikey: YOUR-ANON-KEY" \
  -H "Authorization: Bearer YOUR-ANON-KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "callsign": "W1ABC",
    "contacted_callsign": "G4ABC",
    "qso_date": "2024-02-10",
    "time_on": "14:30:00",
    "band": "20m",
    "mode": "SSB",
    "operator_callsign": "W1ABC"
  }'
```

## Optional Enhancements

### Data Retention Policy

Automatically delete contacts older than 90 days:

```sql
-- Create function to delete old contacts
CREATE OR REPLACE FUNCTION delete_old_contacts()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM contacts
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule using pg_cron (requires extension)
-- Run daily at 2 AM
SELECT cron.schedule(
  'delete-old-contacts',
  '0 2 * * *',
  'SELECT delete_old_contacts();'
);
```

### Partitioning (for high volume)

If you expect >1M contacts, consider partitioning by date:

```sql
-- Convert to partitioned table
CREATE TABLE contacts_partitioned (
  LIKE contacts INCLUDING ALL
) PARTITION BY RANGE (qso_date);

-- Create partitions
CREATE TABLE contacts_2024_q1 PARTITION OF contacts_partitioned
  FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');

CREATE TABLE contacts_2024_q2 PARTITION OF contacts_partitioned
  FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');

-- Continue for each quarter...
```

### Materialized Views (for performance)

Pre-compute expensive queries:

```sql
CREATE MATERIALIZED VIEW contact_heatmap AS
SELECT 
  DATE_TRUNC('hour', created_at) as time_bucket,
  operator_callsign,
  band,
  COUNT(*) as contact_count
FROM contacts
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1, 2, 3;

-- Refresh every hour
CREATE UNIQUE INDEX ON contact_heatmap (time_bucket, operator_callsign, band);

-- Schedule refresh
SELECT cron.schedule(
  'refresh-heatmap',
  '0 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY contact_heatmap;'
);
```

## Troubleshooting

### PostGIS Extension Not Available

If PostGIS doesn't show up:
1. Contact Supabase support
2. Ensure you're on a recent project (PostGIS is enabled by default)
3. Try creating a new project

### Permission Errors

If you get permission errors when inserting:
1. Check RLS policies are created
2. Verify API key is correct
3. Try using `service_role` key for testing (but don't use in production frontend!)

### Slow Queries

If queries are slow:
1. Run `EXPLAIN ANALYZE` on your query
2. Check indexes are being used
3. Ensure statistics are up to date: `ANALYZE contacts;`
4. Consider adding more specific indexes

### Connection Limits

Free tier has connection limits:
1. Use connection pooling (enabled by default in Supabase)
2. Close connections when done
3. Use the pooled connection string for apps

## Backup Recommendations

### Manual Backup

```bash
# Using pg_dump
pg_dump -h db.xxxxx.supabase.co \
  -U postgres \
  -d postgres \
  -t contacts \
  --format=custom \
  --file=contacts_backup.dump

# Restore
pg_restore -h db.xxxxx.supabase.co \
  -U postgres \
  -d postgres \
  contacts_backup.dump
```

### Automated Backups

Supabase provides:
- **Daily backups** (free tier: 7 days retention)
- **Point-in-time recovery** (paid tier: up to 30 days)

Access via: **Database** → **Backups**

## Next Steps

1. ✅ Database schema created
2. ✅ API credentials obtained
3. → Configure frontend with credentials ([deployment.md](deployment.md))
4. → Configure client with credentials ([client-setup.md](client-setup.md))
5. → Start testing!

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostGIS Documentation](https://postgis.net/docs/)
- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)

---

## Related documentation

- **[Architecture](architecture.md)** – Schema in context, indexes, and data flow.
- **[Client setup](client-setup.md)** – Configure the client and installer against this database.
- **[Deployment](deployment.md)** – Dev vs prod, Supabase CLI, migrations.
- **[Documentation index](README.md)** – Overview of all core docs.
