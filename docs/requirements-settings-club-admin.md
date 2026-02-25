# Requirements: Settings & Club Admin

This document defines requirements for the **Settings** and **Club Admin** features of QSOlive, and how they relate to the map display and existing database.

**Related docs:** [Architecture](architecture.md), [Database Setup](database-setup.md), [README](../README.md) (map, real-time contacts), [Request to Join Club](requirements-club-join-request.md) (design).

---

## 1. Context: Map & Contacts

- The **map** shows **Ham Radio contacts** (QSOs) made by operators, **live-updated** from the Supabase database.
- Contacts are inserted by the **QSOlive Windows client** (UDP → ADIF → HTTPS to Supabase). See [Architecture](architecture.md) and [Client Setup](client-setup.md).
- The frontend loads and displays contacts via:
  - **RPC:** `get_display_logs(filter_mode, filter_value)` for filtered data.
  - **Realtime:** Subscription to `contacts` table INSERTs for live updates.
- **Who** is shown on the map is controlled by the **display configuration** stored in the logged-in user’s **profile** (Settings).

---

## 2. Database Architecture (User & Club)

The following tables and function support Settings and Club Admin. Schema is from `client/20240522000000_user_club_setup.sql`.

### 2.1 Tables

| Table         | Purpose |
|---------------|--------|
| **profiles**  | One row per auth user. Extends `auth.users`. Holds **callsign** and **display_config** (what to show on the map). |
| **clubs**     | Clubs (e.g. a club name). Has **name**, **description**, **owner_id** (profile that administers the club). |
| **club_roster** | Many-to-many: which **callsigns** belong to which **club**. One row per (club_id, callsign). |

**profiles**

- `id` (UUID, PK, FK to `auth.users`)
- `email`, `full_name`, `callsign` (user’s personal callsign)
- `display_config` (JSONB):  
  - `mode`: `"self"` | `"club"` | `"clubs"`  
  - `target_id`: for `"self"` = callsign (string); for `"club"` = single club UUID (string)  
  - `club_ids`: for `"clubs"` = array of club UUIDs (max 4); e.g. `["uuid1", "uuid2"]`
- `updated_at`

**clubs**

- `id` (UUID, PK)
- `name` (required), `description`, `owner_id` (FK to `profiles.id`), `created_at`

**club_roster**

- `id` (UUID, PK)
- `club_id` (FK to `clubs.id`, CASCADE delete)
- `callsign` (operator callsign, e.g. `W1ABC`)
- `added_at`
- UNIQUE(`club_id`, `callsign`)

### 2.2 RPC: get_display_logs

**Single-club / self (existing):**

```sql
get_display_logs(filter_mode text, filter_value text) → setof contacts
```

- **filter_mode = 'self'**: returns contacts where `operator_callsign = filter_value` (filter_value = user’s callsign).
- **filter_mode = 'club'**: returns contacts where `operator_callsign` is in the selected club’s roster (filter_value = club UUID).

**Multiple clubs (new):** Either extend the function or add an overload that accepts an array of club UUIDs, e.g.:

```sql
get_display_logs_clubs(club_ids uuid[]) → setof contacts
```

- Returns contacts where `operator_callsign` is in **any** of the given clubs’ rosters. Used when `display_config.mode = 'clubs'` and `display_config.club_ids` has 1–4 UUIDs.

### 2.3 RLS (summary)

- **profiles:** Public read; user can update/insert own row.
- **clubs:** Public read; insert/update only when `owner_id = auth.uid()`.
- **club_roster:** Public read; all write operations only if the club’s `owner_id = auth.uid()`.

---

## 3. Settings – Requirements

**Goal:** Configure the **display user** for the map: who the “user” is (person with callsign or a club), and what to monitor (only that user’s contacts or one club).

### 3.1 User of the display

- The “user” of the display is the **logged-in Supabase Auth user**, with an associated **profile** (callsign + display_config).
- The user may be:
  - A **person** with a **callsign** (stored in `profiles.callsign`).
  - Representing a **club** (they choose which club to monitor; the club has a **name** and, if we add it, an optional **callsign** — see open point below).

### 3.2 What can be monitored

1. **My contacts only** (only when the user has a callsign)
   - **Mode:** `display_config.mode = "self"`.
   - **Target:** `display_config.target_id = profiles.callsign`.
   - Map shows only contacts where `operator_callsign` = that callsign.

2. **One club**
   - **Mode:** `display_config.mode = "club"** (single club, backward compatible).
   - **Target:** `display_config.target_id = <club UUID>`.
   - Map shows contacts for all operators in that club’s roster.

3. **Multiple clubs** (e.g. up to 4)
   - **Mode:** `display_config.mode = "clubs"`.
   - **Target:** `display_config.club_ids` = array of club UUIDs (max 4).
   - Map shows contacts for all operators in **any** of the selected clubs’ rosters (union). Limit to a small number (e.g. 4) to keep queries and UI simple.

### 3.3 Functional requirements (Settings screen)

- **S1** User can set or edit their **callsign** (saved to `profiles.callsign`).
- **S2** User can choose **monitoring mode**: “My Personal Log” (`self`), “One Club” (`club`), or “Multiple Clubs” (`clubs`).
- **S3** If mode is “One Club”, user can **select one club** from a list of existing clubs.
- **S3b** If mode is “Multiple Clubs”, user can **select up to 4 clubs** (e.g. multi-select or checkboxes). Validation: at least 1, at most 4.
- **S4** On save, update `profiles.callsign` and `profiles.display_config` (and `updated_at`). Map (and header) reflect new config after reload or realtime profile update.
- **S5** Settings are **per authenticated user** (RLS ensures users only update their own profile).
- **S6** If user is not logged in, show a clear message (e.g. “Sign in to configure display”) and do not allow saving.

### 3.4 UI/UX (current / desired)

- Current implementation: form with callsign, two radio options (My Personal Log / Club Roster), club dropdown when club mode, Save button. Success/error message after save.
- Optional: show current “MONITORING: …” in header or on Settings page so it’s clear what the display is showing.

---

## 4. Club Admin – Requirements

**Goal:** Create and manage **clubs** (name and optionally callsign) and maintain a **roster of callsigns** per club. **Who** can add/remove members is governed by **master admin** (first phase) and **club manager** (later phase).

### 4.1 Club entity

- A **club** has:
  - **Name** (required).
  - **Callsign** (optional, if we add it to the schema).
- Each club has an **owner** (`clubs.owner_id` = profile id). Owner can update club details and manage roster (current behavior).

### 4.2 Who can manage roster (add/remove members)

- **Phase 1 – Master admin:** A **master admin** is a designated user (e.g. one or more profiles marked `role = 'master_admin'` or `is_master_admin = true`). Master admin can:
  - Add/remove members (roster) for **any club**, not only clubs they own.
  - Optionally: create clubs, edit any club’s name/description (or restrict to roster-only). Document the chosen scope.
- **Phase 2 – Club manager (future):** A **manager** is a person who can add/remove members for **specific** club(s). Implemented via a table e.g. `club_managers` (club_id, profile_id). A manager can register (e.g. with email) and be granted access to manage one or more clubs without being the club owner. Details (invite flow, email verification) can be expanded later.

### 4.3 Roster

- A **roster** is the list of **operator callsigns** that belong to a club (`club_roster`).
- When a user selects “One Club” or “Multiple Clubs” in Settings, the map shows contacts from all operators in the selected club(s)’ rosters.

### 4.4 Functional requirements (Club Admin screen)

- **C1** User can **create a club**: name (required). Optional: description, club callsign (if we add the column). Creation may be restricted to master admin only in a later phase; for now any authenticated user can create (owner = self).
- **C2** Only **authenticated** users can create clubs; new club’s `owner_id` = current user (unless creation is restricted to master admin).
- **C3** User sees:
  - **“My Clubs”** – clubs they **own** (owner_id = self); they can manage roster and club details.
  - **“All clubs” (or “Manage roster”)** – if the user is a **master admin**, they can also open **any club** and add/remove members (and optionally edit club details). UI should make it clear which clubs are “yours” vs “manageable as admin”.
- **C4** For a selected club, **authorized** user (owner or master admin, and later club manager) can **add** operator callsigns to the roster (no duplicates per club).
- **C5** **Authorized** user can **remove** a callsign from the roster.
- **C6** Display roster as a list/table (callsign, date added, remove action).
- **C7** If not logged in, show a message and do not allow create/add/remove.
- **C8** RLS (or app checks) must allow: (a) club owner to manage roster, (b) master admin to manage roster for any club. Later: (c) club manager to manage roster only for clubs they are assigned to.

---

## 5. Security & Authentication

- **Current:** Supabase Auth; RLS on `profiles`, `clubs`, `club_roster`. Only club owner can mutate club and roster.
- **Master admin:**
  - **A1** Add a role or flag on `profiles` (e.g. `role text` with value `'master_admin'`, or `is_master_admin boolean default false`). Only designated users (e.g. set via SQL or a future admin UI) have this role.
  - **A2** RLS for `clubs` and `club_roster` must be updated so that:
    - **Owner** can update club and manage roster for their clubs (unchanged).
    - **Master admin** can update club and manage roster for **any** club (new policies: e.g. `using (owner_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'master_admin'))`).
  - **A3** Club Admin UI: show “All clubs” or “Manage any club” only when the current user is a master admin; otherwise show only “My Clubs”.
- **Club manager (future):**
  - **A4** Add table `club_managers` (club_id, profile_id). A profile can be a “manager” for specific clubs. Managers can add/remove roster for those clubs only (RLS and UI). Later: allow managers to “register” (e.g. invite by email, link to profile) and assign them to clubs.

---

## 6. Open Points / Questions

1. **Club callsign**  
   You mentioned “Club with names and/or callsign”. The current **clubs** table has `name` and `description` but no `callsign`. Should we add an optional **club callsign** (e.g. for display or for a future “club log” identity)? If yes, we can add a column and show it in Club Admin and in Settings (e.g. in the club dropdown).

2. **“Public Club” / default club**  
   The migration inserts a default “Public Club” with no `owner_id`. How should this be used (e.g. fallback for new users, or not used in Settings at all)? Should it be editable or hidden from Club Admin?

3. **Who can create clubs**  
   Right now any logged-in user can create a club and become its owner. Do you want to restrict creation to a subset of users (e.g. admins) in a later phase?

4. **Multiple clubs display**  
   **Resolved:** User can select **up to 4 clubs** in Settings (mode `clubs`, `display_config.club_ids`). Map shows contacts from any of those clubs. Requires `get_display_logs_clubs(club_ids uuid[])` (or equivalent) and frontend support.

5. **Providing DB architecture for review**  
   You asked how to provide the DB architecture. This doc summarizes it; the single source of truth is:
   - **User/Club:** `client/20240522000000_user_club_setup.sql`
   - **Contacts/Core:** `docs/database-setup.md` (and any migrations under `supabase/migrations/` if present).  
   For future reviews you can: (a) point to this doc and those files, or (b) export the schema from Supabase (SQL Editor → “Export schema”) and paste or attach it.

---

## 7. Summary

| Feature      | Purpose |
|-------------|---------|
| **Settings** | Set the **display user** (callsign) and **what to monitor**: “My Personal Log” (self), **one club**, or **multiple clubs** (up to 4). Stored in `profiles.display_config` (mode + target_id or club_ids). Map uses `get_display_logs` / `get_display_logs_clubs`. |
| **Club Admin** | **Create clubs** and manage **roster** (add/remove callsigns). **Master admin** can manage roster for any club; **owner** for their clubs. Later: **club manager** (per-club, e.g. register with email) can manage roster for assigned clubs. |

---

## 8. Schema changes required (and migration)

Implemented in **`client/20240524000000_master_admin_multi_club.sql`** (run after `20240522000000_user_club_setup.sql`):

- **profiles:** Add `role text` default `'user'`, check `role in ('user', 'master_admin')`. Designate master admins with `update profiles set role = 'master_admin' where id = '<uuid>';`
- **display_config (frontend):** Support `mode = 'clubs'` and `club_ids` (array of UUIDs, max 4).
- **RPC:** `get_display_logs_clubs(club_ids uuid[])` returns contacts for operators in any of the given clubs’ rosters.
- **club_managers:** Table `club_managers (club_id, profile_id)` with RLS so managers can manage roster for assigned clubs only; only master admin or club owner can add/remove managers.
- **RLS:** `clubs` and `club_roster` updated so owner **or** master admin **or** club manager (for that club) can update/manage.
