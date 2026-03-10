# QSOlive Architecture

**Part of the core docs:** [Documentation index](README.md) · [Client setup](client-setup.md) · [Database setup](database-setup.md) · [Deployment](deployment.md)

## Overview

QSOlive uses a serverless, real-time architecture designed for scalability and simplicity. The system handles real-time ham radio contact data from multiple operators and displays it on an interactive map.

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Ham Radio Operators                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Logger 1 │  │ Logger 2 │  │ Logger N │  │ Logger N │    │
│  │ (N1MM+)  │  │ (Win-Test│  │ (Logger32│  │   ...    │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │ UDP         │ UDP         │ UDP         │ UDP        │
│       │ :2237       │ :2237       │ :2237       │ :2237      │
└───────┼─────────────┼─────────────┼─────────────┼────────────┘
        │             │             │             │
        ▼             ▼             ▼             ▼
┌──────────────────────────────────────────────────────────────┐
│                  QSOlive Windows Clients                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Python Client (qsolive_client.py)                   │   │
│  │  - Listens on UDP port 2237                          │   │
│  │  - Parses ADIF format                                │   │
│  │  - Geocodes grid squares to lat/lng                  │   │
│  │  - Enriches with metadata (operator, timestamp)      │   │
│  │  - Posts to Supabase via HTTPS                       │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTPS POST
                            │ (JSON payload)
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                      Supabase Backend                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ PostgreSQL 15 + PostGIS                                │ │
│  │  - Contacts table (with geography column)             │ │
│  │  - Profiles, clubs, club_roster (display/roster)      │ │
│  │  - Indexes on callsign, timestamp, operator           │ │
│  │  - Row-level security policies                        │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Auto-generated REST API                                │ │
│  │  POST /rest/v1/contacts                                │ │
│  │  GET  /rest/v1/contacts (with filters)                │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Realtime Subscriptions (WebSocket)                     │ │
│  │  - Push new contacts to connected clients             │ │
│  │  - Filter subscriptions by operator/mode/band         │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────────────────┬──────────────────────────────────┘
                            │ WebSocket
                            │ (Realtime updates)
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                    Web Frontend (Vercel)                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ React Application                                      │ │
│  │  ├── Leaflet Map Component                            │ │
│  │  │   - Display contacts as markers                    │ │
│  │  │   - Great circle paths                             │ │
│  │  │   - Clustering for performance                     │ │
│  │  ├── Filter Controls                                  │ │
│  │  │   - Time range selector                            │ │
│  │  │   - Operator filter                                │ │
│  │  │   - Mode/Band/Frequency filters                    │ │
│  │  ├── Contact List (sidebar)                           │ │
│  │  └── Statistics Dashboard                             │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Supabase JavaScript Client                             │ │
│  │  - Subscribe to real-time contact stream              │ │
│  │  - Query historical data with filters                 │ │
│  │  - Handle authentication                              │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Data Flow

### Contact Submission Flow

1. **Logger Software** broadcasts UDP ADIF packet on port 2237
2. **QSOlive Client** receives UDP packet
3. Client **parses ADIF** fields
4. Client **geocodes** grid square to latitude/longitude
5. Client **posts JSON** to Supabase REST API via HTTPS
6. Supabase **validates** and **stores** in PostgreSQL
7. Supabase **broadcasts** via Realtime to all subscribers
8. **Frontend** receives update and adds marker to map

### Query Flow (Historical Data)

1. User adjusts filters in frontend
2. Frontend queries Supabase REST API with filter parameters
3. PostgreSQL executes optimized query with indexes
4. Results returned as JSON
5. Frontend updates map with filtered contacts

### Real-time Subscription Flow

1. Frontend subscribes to `contacts` table changes
2. Optional filters applied (e.g., only specific operator)
3. New contacts matching filters pushed via WebSocket
4. Frontend incrementally updates map (no full reload)

## Components Detail

### Windows Client (Python)

**File**: `client/qsolive_client.py`

**Responsibilities**:
- Listen for UDP broadcasts from logging software
- Parse ADIF format into structured data
- Convert grid squares to geographic coordinates
- Add operator metadata (callsign, timestamp)
- Submit to Supabase via HTTPS POST
- Handle retries and error logging

**Key Libraries**:
```python
import socket          # UDP listener
import requests        # HTTPS client
from adif_parser import parse_adif
from maidenhead import to_location  # Grid square conversion
```

**Configuration**:
- Supabase URL and API key
- Operator callsign
- UDP port (default 2237)
- Retry settings

### Database Schema (Supabase/PostgreSQL)

#### `contacts` Table

```sql
CREATE TABLE contacts (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Contact details
  callsign VARCHAR(20) NOT NULL,
  contacted_callsign VARCHAR(20) NOT NULL,
  qso_date DATE NOT NULL,
  time_on TIME NOT NULL,
  
  -- Radio details
  band VARCHAR(10),
  mode VARCHAR(20),
  frequency DECIMAL(10, 4),
  rst_sent VARCHAR(10),
  rst_rcvd VARCHAR(10),
  
  -- Location
  gridsquare VARCHAR(10),
  location GEOGRAPHY(POINT, 4326),  -- PostGIS geography
  my_gridsquare VARCHAR(10),
  my_location GEOGRAPHY(POINT, 4326),
  
  -- Metadata
  operator_callsign VARCHAR(20) NOT NULL,
  logger_software VARCHAR(50),
  
  -- Indexes
  INDEX idx_callsign (callsign),
  INDEX idx_operator (operator_callsign),
  INDEX idx_timestamp (qso_date DESC, time_on DESC),
  INDEX idx_mode (mode),
  INDEX idx_band (band)
);

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Spatial index for geographic queries
CREATE INDEX idx_location ON contacts USING GIST(location);
```

#### Row-Level Security

```sql
-- Enable RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Allow inserts with valid API key
CREATE POLICY "Allow inserts with API key"
  ON contacts FOR INSERT
  WITH CHECK (auth.role() = 'anon');

-- Allow public reads
CREATE POLICY "Allow public reads"
  ON contacts FOR SELECT
  USING (true);
```

### Frontend (React + Leaflet)

#### Component Structure

```
src/
├── App.jsx                  # Main app component
├── components/
│   ├── Map.jsx             # Leaflet map with markers
│   ├── Filters.jsx         # Filter controls
│   ├── ContactList.jsx     # Scrollable contact list
│   ├── ContactMarker.jsx   # Individual map marker
│   ├── Statistics.jsx      # Summary stats
│   └── Header.jsx          # App header with logo
├── hooks/
│   ├── useContacts.js      # Fetch & subscribe to contacts
│   ├── useFilters.js       # Filter state management
│   └── useGeocoding.js     # Grid square conversion
├── lib/
│   ├── supabase.js         # Supabase client setup
│   └── adif.js             # ADIF field definitions
└── utils/
    ├── geocoding.js        # Maidenhead to lat/lng
    └── formatting.js       # Display formatting
```

#### Key Frontend Logic

**Real-time Subscription**:
```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Subscribe to new contacts
supabase
  .channel('contacts')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'contacts',
    filter: filters.operator ? `operator_callsign=eq.${filters.operator}` : undefined
  }, (payload) => {
    addContactToMap(payload.new)
  })
  .subscribe()
```

**Filtered Query**:
```javascript
const { data: contacts } = await supabase
  .from('contacts')
  .select('*')
  .gte('created_at', filters.startTime)
  .lte('created_at', filters.endTime)
  .eq('operator_callsign', filters.operator)
  .in('mode', filters.modes)
  .order('created_at', { ascending: false })
  .limit(1000)
```

## Settings, clubs, and roster

Who is shown on the map is controlled by the **logged-in user’s profile**: `profiles.display_config` (Settings). Clubs group operators; the map can show one user’s contacts, one club’s roster, or up to four clubs (union of rosters).

### Settings and display configuration

- **Display user:** The authenticated user has a **profile** (`profiles`: callsign, `display_config`). They choose what to monitor:
  - **My contacts only** – `display_config.mode = "self"`, `target_id` = user’s callsign. Map shows contacts where `operator_callsign` = that callsign.
  - **One club** – `mode = "club"`, `target_id` = club UUID. Map shows contacts for all operators in that club’s roster.
  - **Multiple clubs (up to 4)** – `mode = "clubs"`, `club_ids` = array of UUIDs. Map shows contacts for operators in **any** of those clubs’ rosters.
- **RPCs:** `get_display_logs(filter_mode, filter_value)` for self or single club; `get_display_logs_clubs(club_ids)` for multiple clubs. Frontend also subscribes to `contacts` for real-time updates.
- **Requirements:** User can set/edit callsign and monitoring mode; select one club or up to 4 clubs; save updates `profiles.callsign` and `profiles.display_config`. Settings are per user (RLS); not logged in ⇒ show “Sign in to configure display”.

### Club Admin and roster

- **Clubs:** Each club has **name** (short, unique identifier), **description** (required, full name or description), and **owner_id** (profile that administers it). **Roster** = `club_roster`: which callsigns belong to which club (unique per club_id + callsign).
- **Who can manage:** **Club owner** can update club and manage roster for their clubs. **Master admin** (`profiles.role = 'master_admin'`) can manage roster (and optionally edit club details) for **any** club. Set master admin via SQL: `update profiles set role = 'master_admin' where id = '<uuid>';`. Per-club managers are deferred (no `club_managers` table).
- **Club Admin UI:** “My Clubs” (clubs you own) and, for master admin, “All clubs” / “Manage roster”. For a selected club: add/remove callsigns (no duplicates), show roster as list (callsign, date added, remove). Create club: name + description; owner = current user. Must be logged in to create/add/remove.

### Club uniqueness

- **Unique name:** One canonical name per club. Enforced by unique index on `lower(trim(clubs.name))` (case-insensitive, trimmed). **Description** is required (NOT NULL, default `''`).
- **Create flow:** User enters name + description; frontend trims both. On insert, if Postgres returns **23505** (unique_violation), show: “A club with this name already exists. Please join the existing club instead.” (e.g. link to Request to join). Optional RPC `get_club_by_name(name)` returns the existing club for a friendly “join that club” message.
- **Club Admin display:** List and roster panel show club **name**, **description**, and **manager** (owner’s callsign from `profiles`). Create form: “Club name (abbreviation or callsign)” + “Full name or description”.

### Request to join a club

- **Goal:** A user can request that their callsign be added to a club. The request is delivered to the **club owner** (e.g. by email) so they can add the callsign in Club Admin.
- **Phase 1 (mailto):** In Settings, “Request to join a club” opens a form: select club, callsign (default from profile), optional message. On submit, open **mailto:** owner’s `profiles.email` with subject/body (club name, callsign, message). No backend email service; if owner has no email, show “No contact email for this club.”
- **Phase 2 (optional):** Table `club_join_requests` (club_id, callsign, requester_id, message, status, reviewed_at, reviewed_by) and “Pending requests” in Club Admin with Approve/Deny. Omit in Phase 1.

## Deployment Architecture

### Development Environment

```
Developer Machine (VS Code)
├── Frontend runs on localhost:3000 (Vite dev server)
├── Connects to Supabase cloud instance
└── Client runs locally, posts to Supabase
```

### Production Environment

```
┌─────────────────┐
│ Vercel (Global) │  Frontend static files
│  - Edge Network │  Served from CDN
│  - Auto HTTPS   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Supabase        │  Backend + Database
│  - US/EU region │  (choose closest to operators)
│  - Connection   │
│    pooling      │
└─────────────────┘
         ▲
         │
┌────────┴────────┐
│ Windows Clients │  Distributed to operators
│  (Packaged .exe)│  Run on local networks
└─────────────────┘
```

### Scaling Considerations

**Current Capacity (Free Tier)**:
- Database: 500MB storage
- Bandwidth: 2GB/month
- Realtime: 200 concurrent connections
- API: 50,000 requests/month

**Expected Usage (100 operators)**:
- Each contact: ~1KB JSON
- 10 contacts/hour/operator: ~1000 contacts/hour
- Daily storage: ~24MB/day
- Monthly: ~720MB (~$10/month beyond free tier)

**Optimization Strategies**:
- Implement data retention (delete contacts >30 days)
- Use connection pooling
- Cache frequent queries
- Implement contact aggregation for statistics

## Security Architecture

### Transport Security

- All client-server: HTTPS only (TLS 1.3)
- WebSocket: WSS (secure WebSocket)
- No UDP over internet (local network only)

### Authentication & Authorization

```
Client → API Key (in HTTP header)
  ↓
Supabase validates API key
  ↓
Row-Level Security checks
  ↓
Allow/Deny access
```

**API Key Management**:
- Anon key: Public, read-only access (embedded in frontend)
- Service key: Admin access (stored in client config, not in frontend)
- Per-operator keys: Future feature for multi-tenancy

### Data Validation

**Client-side**:
- ADIF field validation
- Grid square format validation
- Frequency range checks

**Server-side** (PostgreSQL constraints):
- NOT NULL constraints on required fields
- CHECK constraints on frequency ranges
- NOT NULL and CHECK constraints on contacts

## Monitoring & Observability

### Built-in Monitoring (Supabase Dashboard)

- Database size and growth
- Query performance
- API request rates
- Real-time connections
- Error logs

### Recommended Additional Monitoring

- Frontend: Sentry for error tracking
- Client: Local log files with rotation
- Alerts: Email notifications for database >80% capacity

## Disaster Recovery

### Backup Strategy

**Supabase Automated Backups**:
- Daily backups (retained 7 days on free tier)
- Point-in-time recovery (paid tier)

**Manual Exports**:
```bash
# Weekly export to CSV
pg_dump -h db.xxx.supabase.co \
  -U postgres \
  -t contacts \
  --format=csv \
  > contacts_backup_$(date +%Y%m%d).csv
```

### Recovery Procedures

1. **Database corruption**: Restore from latest backup
2. **Supabase outage**: Display cached data, queue writes
3. **Client failure**: Restart client, replay missed contacts

## Performance Optimization

### Database Indexes

```sql
-- Most common query patterns (contacts table)
CREATE INDEX idx_contacts_operator_recent 
  ON contacts (operator_callsign, created_at DESC);

CREATE INDEX idx_mode_band 
  ON contacts (mode, band) 
  WHERE created_at > NOW() - INTERVAL '7 days';
```

### Frontend Optimization

- **Virtual scrolling**: Only render visible contacts
- **Map clustering**: Group nearby markers at low zoom
- **Debounced filters**: Wait 300ms after user stops typing
- **Lazy loading**: Load historical data on scroll

### Client Optimization

- **Batching**: Group contacts if multiple arrive <1 second
- **Retry logic**: Exponential backoff on failures
- **Local cache**: Prevent duplicate submissions

## Technology Decisions & Rationale

| Choice | Rationale |
|--------|-----------|
| **Supabase** | Built-in realtime, no backend code needed, generous free tier |
| **PostgreSQL** | Mature, PostGIS for geospatial queries, strong indexing |
| **React** | Large ecosystem, good Leaflet integration, developer familiarity |
| **Leaflet** | Lightweight, performs well with many markers, free |
| **Python client** | Easy ADIF parsing, cross-platform, simple distribution |
| **Vercel** | Zero-config deployment, edge network, generous free tier |

## Future Architecture Enhancements

- **Caching layer**: Redis for frequently accessed data
- **Message queue**: Handle bursts during contests
- **CDN**: Store contact history as static JSON for fast loading
- **GraphQL**: More flexible querying than REST
- **Offline support**: Service worker for PWA capabilities

---

## Related documentation

- **[Client setup](client-setup.md)** – Install and configure the Windows client; build the executable and installer.
- **[Database setup](database-setup.md)** – Create the Supabase project, schema, RLS, and functions.
- **[Deployment](deployment.md)** – Dev vs prod, Vercel, Supabase CLI, release process.
- **[Documentation index](README.md)** – Overview of all core docs.
