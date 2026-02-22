#!/usr/bin/env python3
"""
Seed club_roster: assign operator callsigns (from contacts) to clubs at random.

- Fetches clubs from Supabase (uses first 5 by name, or pass --club-ids).
- Fetches distinct operator_callsign from the contacts table.
- Inserts each callsign into club_roster with a randomly chosen club.

Requires a key that can INSERT into club_roster (RLS: owner or master_admin).
Use supabase_service_key in config.json to bypass RLS, or run as a one-off in
Supabase SQL Editor (see comments at bottom).

Usage:
  python seed_club_roster.py [--file config.json] [--limit 5] [--dry-run]
  python seed_club_roster.py --club-ids "uuid1,uuid2,uuid3,uuid4,uuid5"
"""

import argparse
import json
import random
import sys
import os

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from qsolive_client import load_config


def load_config_file(path):
    with open(path, "r") as f:
        return json.load(f)


def get_headers(key):
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }


def fetch_clubs(url, key, limit=5, club_ids=None):
    """Fetch clubs. If club_ids given, fetch those; else fetch all and take first `limit` by name."""
    headers = get_headers(key)
    if club_ids:
        ids = [x.strip() for x in club_ids.split(",") if x.strip()][:limit]
        if not ids:
            return []
        # PostgREST: id=in.(uuid1,uuid2,...)
        in_filter = "in.(" + ",".join(ids) + ")"
        r = requests.get(
            f"{url}/rest/v1/clubs?select=id,name&id={in_filter}",
            headers=headers,
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()
        # Preserve order of requested ids
        by_id = {str(c["id"]): c for c in data}
        data = [by_id[i] for i in ids if i in by_id]
    else:
        r = requests.get(
            f"{url}/rest/v1/clubs?select=id,name&order=name&limit={limit}",
            headers=headers,
            timeout=15,
        )
        r.raise_for_status()
        data = r.json() or []
    return data


def fetch_operator_callsigns(url, key):
    """Fetch distinct operator_callsign from contacts (paginate if needed)."""
    headers = get_headers(key)
    headers["Accept"] = "application/json"
    seen = set()
    offset = 0
    page_size = 500
    while True:
        r = requests.get(
            f"{url}/rest/v1/contacts?select=operator_callsign&order=id&offset={offset}&limit={page_size}",
            headers=headers,
            timeout=15,
        )
        r.raise_for_status()
        rows = r.json()
        if not rows:
            break
        for row in rows:
            call = (row.get("operator_callsign") or "").strip()
            if call and len(call) >= 2:
                seen.add(call.upper())
        if len(rows) < page_size:
            break
        offset += page_size
    return sorted(seen)


def insert_roster_entry(url, key, club_id, callsign, dry_run=False):
    """Insert one (club_id, callsign) into club_roster. Uses upsert to avoid duplicate errors."""
    if dry_run:
        print(f"  [DRY-RUN] would add {callsign} -> club {club_id}")
        return True
    headers = get_headers(key)
    payload = {"club_id": club_id, "callsign": callsign}
    r = requests.post(
        f"{url}/rest/v1/club_roster",
        headers=headers,
        json=payload,
        timeout=10,
    )
    if r.status_code in (200, 201):
        return True
    if r.status_code == 409 or "23505" in (r.text or ""):
        # Unique violation - already in roster
        return True
    print(f"  FAILED {callsign} -> {club_id}: {r.status_code} {r.text[:200]}")
    return False


def main():
    ap = argparse.ArgumentParser(description="Assign operator callsigns to clubs at random")
    ap.add_argument("--file", default="config.json", help="Config file (default config.json)")
    ap.add_argument("--limit", type=int, default=5, help="Max clubs to use (default 5)")
    ap.add_argument("--club-ids", type=str, default=None, help="Comma-separated club UUIDs (optional)")
    ap.add_argument("--dry-run", action="store_true", help="Do not insert, only print")
    args = ap.parse_args()

    config = load_config_file(args.file)
    url = (config.get("supabase_url") or "").rstrip("/")
    if not url:
        print("ERROR: supabase_url missing in config")
        sys.exit(1)

    # Prefer service_role so we can insert into club_roster (bypasses RLS)
    key = config.get("supabase_service_key") or config.get("supabase_key")
    if not key:
        print("ERROR: supabase_key or supabase_service_key missing in config")
        sys.exit(1)
    if not config.get("supabase_service_key") and not args.dry_run:
        print("WARNING: Using anon key; club_roster inserts may fail (RLS). Use supabase_service_key for seeding.")

    print("Fetching clubs...")
    clubs = fetch_clubs(url, key, limit=args.limit, club_ids=args.club_ids)
    if not clubs:
        print("No clubs found. Create clubs in the app (Club Admin) first.")
        sys.exit(1)
    print(f"Using {len(clubs)} club(s): {[c['name'] for c in clubs]}")

    print("Fetching operator callsigns from contacts...")
    callsigns = fetch_operator_callsigns(url, key)
    if not callsigns:
        print("No operator_callsign values in contacts. Run test_client.py first to create contacts.")
        sys.exit(1)
    print(f"Found {len(callsigns)} unique operator callsign(s)")

    club_ids = [c["id"] for c in clubs]
    added = 0
    for call in callsigns:
        club_id = random.choice(club_ids)
        if insert_roster_entry(url, key, club_id, call, dry_run=args.dry_run):
            added += 1

    print("-" * 50)
    if args.dry_run:
        print(f"DRY-RUN: would assign {len(callsigns)} callsigns to {len(clubs)} clubs")
    else:
        print(f"Done. Assigned {added} callsigns to clubs at random.")


if __name__ == "__main__":
    main()
