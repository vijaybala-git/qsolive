#!/usr/bin/env python3
"""
QSOlive Test Client
Simulates traffic by replaying an ADIF log file with current timestamps.
"""

import argparse
import re
import time
import random
import sys
import os
from datetime import datetime, timezone, timedelta

# Ensure the script directory is in the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import classes from the main client to ensure consistent behavior
try:
    # Check dependencies explicitly to provide helpful installation commands
    try:
        import maidenhead
    except ImportError:
        print("Error: The 'maidenhead' library is missing.")
        print(f"Fix it by running: \"{sys.executable}\" -m pip install maidenhead")
        sys.exit(1)

    from qsolive_client import ADIFParser, GridSquareGeocoder, SupabaseClient, load_config
except ImportError as e:
    print(f"Error: Could not import from qsolive_client.py.\nDetails: {e}")
    print("Make sure qsolive_client.py is in the same directory.")
    sys.exit(1)

def run_simulation(args):
    # 1. Load Config
    config = load_config()
    print(f"Loaded config for Supabase: {config.get('supabase_url')}")

    # 2. Initialize Helpers
    supabase = SupabaseClient(config['supabase_url'], config['supabase_key'])
    parser = ADIFParser()
    geocoder = GridSquareGeocoder()

    # 3. Read ADIF File
    try:
        with open(args.file, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"Error: File {args.file} not found.")
        sys.exit(1)

    # Split by <EOR> (case insensitive) to get individual records
    raw_records = re.split(r'<eor>', content, flags=re.IGNORECASE)
    # Remove empty strings resulting from split
    raw_records = [r for r in raw_records if r.strip()]
    
    print(f"Found {len(raw_records)} raw records in {args.file}")
    
    # Pre-parse to find valid callsigns for the pool
    parsed_records = []
    all_callsigns = set()
    for r in raw_records:
        f = parser.parse(r)
        if f and 'CALL' in f:
            parsed_records.append(f)
            all_callsigns.add(f['CALL'])

    if not parsed_records:
        print("No valid ADIF records found.")
        sys.exit(1)

    # Operator selection: single callsign or pool
    if args.callsign:
        operator_callsign_fixed = args.callsign.strip().upper()
        client_pool = None
        print(f"Single operator mode: {operator_callsign_fixed} (tests 'My Personal Log')")
    else:
        pool_size = min(args.clients, len(all_callsigns))
        client_pool = random.sample(list(all_callsigns), pool_size)
        operator_callsign_fixed = None
        print(f"Simulating {pool_size} concurrent operators: {', '.join(client_pool[:5])}...")

    total_planned = min(args.limit, len(parsed_records))
    print(f"Sending max {args.limit} records with Poisson distribution (mean {args.delay}s)...")
    if args.hours_back > 0:
        print(f"Timestamps spread over last {args.hours_back} hours")
    if args.start_delay > 0:
        print(f"Starting in {args.start_delay}s...")
    print("-" * 50)

    # Start delay for multi-instance runs
    if args.start_delay > 0:
        time.sleep(args.start_delay)

    # 4. Simulation Loop
    count = 0

    for i, fields in enumerate(parsed_records):
        if count >= args.limit:
            print("Limit reached.")
            break

        # --- Operator ---
        if operator_callsign_fixed:
            operator_callsign = operator_callsign_fixed
        else:
            operator_callsign = client_pool[i % len(client_pool)]

        # --- Time Adjustment ---
        anchor = datetime.now(timezone.utc) - timedelta(hours=args.offset)
        if args.hours_back > 0 and total_planned > 1:
            frac = count / (total_planned - 1)
            qso_dt = anchor - timedelta(hours=args.hours_back) + timedelta(hours=args.hours_back * frac)
        else:
            qso_dt = anchor
        qso_date = qso_dt.strftime('%Y-%m-%d')
        time_on = qso_dt.strftime('%H:%M:%S')

        # Build Contact Object (Mirroring logic from qsolive_client.py)
        contact = {
            'callsign': operator_callsign,
            'contacted_callsign': fields.get('CALL'),
            'qso_date': qso_date,
            'time_on': time_on,
            'operator_callsign': operator_callsign,
            'band': fields.get('BAND'),
            'mode': fields.get('MODE'),
            'rst_sent': fields.get('RST_SENT'),
            'rst_rcvd': fields.get('RST_RCVD')
        }

        # Handle Frequency
        if 'FREQ' in fields:
            try:
                contact['frequency'] = float(fields['FREQ'])
            except ValueError:
                pass

        # Handle Geocoding
        loc_status = "No Grid"
        if 'GRIDSQUARE' in fields:
            contact['gridsquare'] = fields['GRIDSQUARE']
            latlon = geocoder.to_latlon(fields['GRIDSQUARE'])
            if latlon:
                contact['location'] = f"POINT({latlon[1]} {latlon[0]})"
                loc_status = f"Grid {fields['GRIDSQUARE']} OK"
            else:
                loc_status = f"Grid {fields['GRIDSQUARE']} FAIL"

        # 5. Send to Supabase
        print(f"[{count+1}] Sending {contact['contacted_callsign']} ({loc_status})...", end=" ", flush=True)
        success = supabase.insert_contact(contact)
        
        if success:
            print("OK")
        else:
            print("FAILED")

        count += 1
        
        # 6. Delay (Poisson Distribution)
        if args.delay > 0:
            # random.expovariate(lambd) where lambd = 1.0 / mean
            sleep_time = random.expovariate(1.0 / args.delay)
            time.sleep(sleep_time)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="QSOlive Test Client")
    parser.add_argument('--file', type=str, default='Log4OM_ADIF_20260212223913.adi', help='Path to ADIF file')
    parser.add_argument('--delay', type=float, default=1.0, help='Delay in seconds between sends')
    parser.add_argument('--limit', type=int, default=100, help='Max number of records to send')
    parser.add_argument('--clients', type=int, default=1, help='Number of simulated operators')
    parser.add_argument('--offset', type=float, default=0.0, help='Hours to subtract from current time (e.g. 2.5 for 2.5 hours ago)')
    parser.add_argument('--callsign', type=str, default=None, help='Single operator for all contacts (tests "My Personal Log"). Overrides --clients')
    parser.add_argument('--hours-back', type=float, default=0.0, help='Spread timestamps from (now - N hours) to now; 0 = all "now"')
    parser.add_argument('--start-delay', type=float, default=0.0, help='Seconds to wait before sending first contact (for multi-instance runs)')
    
    args = parser.parse_args()
    
    run_simulation(args)