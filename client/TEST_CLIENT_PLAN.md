# Test Client Expansion Plan

This document outlines the plan for expanding `test_client.py` to support common test scenarios using the Log4OM ADIF file as input.

---

## Current Behavior (Summary)

- **Input:** ADIF file (e.g. `Log4OM_ADIF_20260212223913.adi`) with ~5990 records
- **Operator selection:** Picks N unique callsigns from the `CALL` (contacted) field as a pool; assigns each contact round-robin to simulate N concurrent operators
- **Timestamps:** All QSOs use current UTC (or `--offset` hours back)
- **Output:** Inserts contacts into Supabase via `SupabaseClient.insert_contact()`
- **Args:** `--file`, `--delay`, `--limit`, `--clients`, `--offset`

---

## Proposed Scenarios & Options

### 1. Single Callsign Mode ("Display My Log")

**Goal:** Test the frontend "My Personal Log" mode where one operator's contacts are shown on the map.

**Implementation:**
- Add `--callsign <CALLSIGN>` (e.g. `--callsign W6VIJ`)
- When set, **all** contacts use this single operator; ignore `--clients`
- Conflict: if both `--callsign` and `--clients` are provided, `--callsign` wins
- Example: `python test_client.py --callsign W6VIJ --limit 50 --delay 0.5`

**Use case:** User sets profile to "My Personal Log" with callsign W6VIJ, runs test client with `--callsign W6VIJ`, then watches the map populate with only those contacts.

---

### 2. Multiple Instances / Timing Control

**Goal:** Safely run several copies of the test client in parallel (e.g. 3 terminals) without all hammering the DB at once.

**Implementation:**
- Add `--instance <I>` and `--total <T>` (or `--stagger <SEC>`)
  - **Option A:** `--instance 0 --total 3` = this is instance 0 of 3; wait `0 * stagger` seconds before starting (stagger default: 5s)
  - **Option B:** Simpler: `--start-delay <SEC>` = wait N seconds before sending first contact
- For parallel runs, user would do:
  ```
  python test_client.py --instance 0 --total 3 &
  python test_client.py --instance 1 --total 3 &
  python test_client.py --instance 2 --total 3 &
  ```
  Instance 0 starts immediately, 1 after 5s, 2 after 10s.

- **Optional:** `--record-offset N` so instance 1 sends records 34–66, instance 2 sends 67–100, etc. (split the limit across instances to avoid duplicates)

**Recommendation:** Implement `--start-delay` (simple) plus optional `--instance I --total T` with `stagger = 5` seconds. For record splitting, add `--skip N` to skip first N records so each instance can process a different slice of the file.

---

### 3. Time Range (Spread Timestamps Over N Hours)

**Goal:** Instead of all QSOs having "now" as timestamp, spread them over a time window (e.g. last 2 hours) for more realistic distribution.

**Implementation:**
- Add `--hours-back <N>` (float, e.g. 2.0 or 0.5)
- For each contact i of N: assign timestamp = `now - (hours_back * (1 - i/N))` so the first contact is oldest, last is newest (or use random distribution within the window)
- Simpler: linear spread—contact 0 gets `now - hours_back`, contact N-1 gets `now`
- Alternative: random uniform in `[now - hours_back, now]` for each contact

**Recommendation:** Linear spread (oldest first, newest last) keeps ordering predictable. Use `--hours-back 2` to simulate contacts from the last 2 hours.

---

### 4. Additional Scenarios (Optional / Future)

| Scenario | Description | Implementation idea |
|----------|-------------|---------------------|
| **Club roster test** | Generate contacts only for callsigns in a given club roster | `--club-id <UUID>` fetch roster from Supabase, filter operators to roster callsigns; or `--operators A,B,C` explicit list |
| **Shuffle order** | Randomize the order of records before sending | `--shuffle` flag |
| **Preserve relative spacing** | Keep original time deltas between contacts, anchor to "now" | Parse original QSO_DATE/TIME_ON, compute deltas, apply to current time |
| **Dry run** | Don't send to Supabase, only print what would be sent | `--dry-run` |
| **Resume / skip** | Skip first N records (e.g. already sent) | `--skip N` |
| **Band / mode filter** | Only send records matching band or mode | `--band 40m` or `--mode FT8` |
| **Use ADIF OPERATOR** | Use OPERATOR field from ADIF when present (e.g. W6VIJ) | When `--callsign` not set and OPERATOR in record, could use it for single-operator mode |

---

## Implementation Priority

1. **Phase 1 (Core):**
   - `--callsign X` — single operator mode (for "My Personal Log" test)
   - `--hours-back N` — time range for timestamps
   - `--start-delay N` — delay before first send (for multi-instance)

2. **Phase 2 (Multi-instance):**
   - `--instance I --total T` — stagger start by `I * 5` seconds
   - `--skip N` — skip first N records (so instances can split the file)

3. **Phase 3 (Nice-to-have):**
   - `--dry-run`
   - `--shuffle`
   - `--operators A,B,C` (explicit list instead of pool from file)

---

## Argument Summary (Proposed)

| Argument | Default | Description |
|----------|---------|-------------|
| `--file` | Log4OM_ADIF_... | Path to ADIF file |
| `--delay` | 1.0 | Mean delay (s) between sends (Poisson) |
| `--limit` | 100 | Max records to send |
| `--clients` | 1 | Number of simulated operators (round-robin from contacted pool) |
| `--offset` | 0.0 | Hours to subtract from "now" (legacy; partly overlaps --hours-back) |
| `--callsign` | (none) | Single operator for all contacts (overrides --clients) |
| `--hours-back` | 0 | Spread timestamps from (now - N hours) to now; 0 = all "now" |
| `--start-delay` | 0 | Seconds to wait before sending first contact |
| `--instance` | (none) | Instance index (0-based) when running multiple copies |
| `--total` | (none) | Total instances; used with --instance for stagger |
| `--skip` | 0 | Skip first N records in file |

---

## Notes on --offset vs --hours-back

- **--offset:** Current behavior: subtract N hours from "now" for *all* contacts. So every contact gets the same timestamp (now - offset).
- **--hours-back:** New: spread contacts over a window. First contact ≈ (now - N hours), last ≈ now.
- We can keep both: `--offset` shifts the whole window back, `--hours-back` defines the window size. Or simplify: deprecate `--offset` and use only `--hours-back` (0 = all now, N = spread over N hours ending at now).

---

## Example Commands (After Implementation)

```bash
# Test "My Personal Log" with W6VIJ
python test_client.py --callsign W6VIJ --limit 30 --delay 0.5

# Spread 50 contacts over last 2 hours, single operator
python test_client.py --callsign W6VIJ --limit 50 --hours-back 2 --delay 0

# Run 3 instances in parallel, staggered
python test_client.py --instance 0 --total 3 --limit 100 --clients 5 &
python test_client.py --instance 1 --total 3 --limit 100 --clients 5 &
python test_client.py --instance 2 --total 3 --limit 100 --clients 5 &

# Dry run (no Supabase)
python test_client.py --callsign W6VIJ --limit 10 --dry-run
```
