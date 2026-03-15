#!/usr/bin/env python3
"""
QSOlive Client - Captures UDP ADIF and sends to Supabase
"""

import os
import socket
import json
import logging
import sys
import time
import traceback
from datetime import datetime, timezone
from typing import Dict, Optional
import requests

import maidenhead as mh

# PyInstaller sets this when built as a frozen exe
FROZEN = getattr(sys, 'frozen', False)


def _exe_dir() -> str:
    """Install directory: same folder as the executable (or script when not frozen)."""
    if FROZEN:
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.abspath(os.path.realpath(__file__)))


def _writable_dir() -> str:
    """Directory where we can write log and crash files. When frozen on Windows, NEVER use
    exe dir (Program Files) - use %LOCALAPPDATA%\\QSOlive or TEMP so 'all users' installs work."""
    if FROZEN and sys.platform == 'win32':
        # Try these in order; never fall back to Program Files
        candidates = []
        for env_key in ('LOCALAPPDATA', 'TEMP', 'TMP', 'USERPROFILE'):
            base = os.environ.get(env_key, '').strip()
            if base:
                candidates.append(os.path.join(base, 'QSOlive'))
        try:
            candidates.append(os.path.join(os.path.expanduser('~'), 'QSOlive'))
        except Exception:
            pass
        for path in candidates:
            try:
                os.makedirs(path, exist_ok=True)
                test = os.path.join(path, '.write_test')
                with open(test, 'w') as f:
                    f.write('')
                os.remove(test)
                return path
            except OSError:
                continue
        # Last resort: write directly to TEMP (no QSOlive subdir) so we never use exe dir
        for env_key in ('TEMP', 'TMP'):
            base = os.environ.get(env_key, '').strip()
            if base and os.path.isdir(base):
                return base
        try:
            return os.path.expanduser('~')
        except Exception:
            pass
    return _exe_dir()


def _config_path() -> str:
    """Resolve config.json path: same dir as exe, or current working directory."""
    candidates = [
        os.path.join(_exe_dir(), 'config.json'),
        os.path.join(os.getcwd(), 'config.json'),
    ]
    for p in candidates:
        if os.path.isfile(p):
            return p
    return os.path.join(_exe_dir(), 'config.json')


def _crash_file() -> str:
    """Path for crash/startup error log. Uses writable dir (AppData when frozen on Windows)."""
    return os.path.join(_writable_dir(), 'qsolive_client_crash.txt')


def _write_crash_and_exit(msg: str) -> None:
    """Write error to crash file in writable dir, print, pause if frozen, then exit(1)."""
    crash_path = _crash_file()
    try:
        with open(crash_path, 'w') as f:
            f.write(msg)
    except Exception:
        pass
    print(msg)
    if FROZEN:
        input("Press Enter to close...")
    sys.exit(1)


def _global_excepthook(typ, value, tb):
    """Catch any uncaught exception (including during import) and write to crash file + pause."""
    try:
        tb_str = traceback.format_exception(typ, value, tb) if tb else [str(typ), str(value)]
        msg = ''.join(tb_str)
    except Exception:
        msg = f"{typ} {value}"
    crash_path = None
    try:
        crash_path = _crash_file()
        with open(crash_path, 'w') as f:
            f.write(msg)
    except Exception:
        # Last resort: try TEMP directly (e.g. if _writable_dir failed)
        try:
            d = os.environ.get('TEMP') or os.environ.get('TMP') or os.path.expanduser('~')
            crash_path = os.path.join(d, 'qsolive_client_crash.txt')
            with open(crash_path, 'w') as f:
                f.write(msg)
        except Exception:
            pass
    print(msg, file=sys.stderr)
    if FROZEN:
        if crash_path:
            print(f"Crash log: {crash_path}", file=sys.stderr)
        try:
            input("Press Enter to close...")
        except Exception:
            pass
    sys.exit(1)


# Install before any other imports/code that can fail (so import errors are caught)
sys.excepthook = _global_excepthook

# Built-in Supabase (hidden from user). Set via build_config.py at build time, or env for dev.
try:
    from build_config import BUILTIN_SUPABASE_URL, BUILTIN_SUPABASE_KEY  # type: ignore
    import build_config as _bc  # type: ignore
    _BUILD_LABEL = getattr(_bc, 'BUILD_LABEL', None)
    _BUILD_BRANCH = getattr(_bc, 'BUILD_BRANCH', None)
except ImportError:
    BUILTIN_SUPABASE_URL = (
        os.environ.get('QSOLIVE_SUPABASE_URL') or
        os.environ.get('QSOLIVE_DEV_URL') or
        os.environ.get('QSOLIVE_PROD_URL') or
        ''
    )
    BUILTIN_SUPABASE_KEY = (
        os.environ.get('QSOLIVE_SUPABASE_KEY') or
        os.environ.get('QSOLIVE_DEV_KEY') or
        os.environ.get('QSOLIVE_PROD_KEY') or
        ''
    )
    _BUILD_LABEL = os.environ.get('QSOLIVE_ENV')
    _BUILD_BRANCH = os.environ.get('QSOLIVE_BRANCH')


def load_config() -> Dict:
    """Load configuration from config.json. Supabase URL/key can be built-in (user never sees them)."""
    path = _config_path()
    try:
        with open(path, 'r') as f:
            data = json.load(f)
    except FileNotFoundError:
        _write_crash_and_exit(
            "ERROR: config.json not found! Please run the installer or copy config.example.json to config.json.\n"
            f"Looked in: {path}"
        )
    except json.JSONDecodeError as e:
        _write_crash_and_exit(f"ERROR: Invalid JSON in config.json: {e}")
    # Prefer built-in Supabase (from build_config or env); accept same env names as build_config
    _url = (
        data.get('supabase_url') or BUILTIN_SUPABASE_URL or
        os.environ.get('QSOLIVE_SUPABASE_URL') or os.environ.get('QSOLIVE_DEV_URL') or os.environ.get('QSOLIVE_PROD_URL')
    )
    _key = (
        data.get('supabase_key') or BUILTIN_SUPABASE_KEY or
        os.environ.get('QSOLIVE_SUPABASE_KEY') or os.environ.get('QSOLIVE_DEV_KEY') or os.environ.get('QSOLIVE_PROD_KEY')
    )
    if _url:
        data['supabase_url'] = _url
    if _key:
        data['supabase_key'] = _key
    if not data.get('supabase_url') or not data.get('supabase_key'):
        _write_crash_and_exit(
            "ERROR: Supabase URL and key are not configured. Use built-in build or set in config.json."
        )
    return data


config = load_config()


def _get_env_display() -> tuple:
    """Return (env_label, branch) for startup display. env_label is 'DEV' or 'PROD'; branch may be empty."""
    label = (_BUILD_LABEL or config.get('environment') or '').strip().upper() or None
    if not label and config.get('supabase_url'):
        url = config['supabase_url']
        if 'supabase.co' in url:
            try:
                ref = url.replace('https://', '').split('.')[0]
                label = 'PROD' if ref and 'dev' not in ref.lower() else 'DEV'
            except Exception:
                label = 'DEV'
        else:
            label = 'DEV'
    if not label:
        label = 'DEV'
    branch = _BUILD_BRANCH or config.get('git_branch') or ''
    if not branch:
        try:
            import subprocess
            r = subprocess.run(
                ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
                capture_output=True, text=True, timeout=2, cwd=os.path.dirname(os.path.abspath(__file__))
            )
            if r.returncode == 0 and r.stdout:
                branch = r.stdout.strip()
        except Exception:
            pass
    if not branch:
        branch = 'release'
    env_display = 'PROD' if label == 'PROD' else 'DEV'
    return (env_display, branch)


def _get_db_display() -> str:
    """Short Supabase DB identifier for logs (e.g. project ref or host)."""
    url = config.get('supabase_url') or ''
    if not url:
        return 'none'
    try:
        host = url.replace('https://', '').split('/')[0]
        return host.split('.')[0] if 'supabase.co' in host else host
    except Exception:
        return 'supabase'

# Setup logging: when frozen on Windows always use writable dir (never Program Files)
_log_path = config.get('log_file', 'qsolive_client.log')
if FROZEN and sys.platform == 'win32':
    _log_path = os.path.join(_writable_dir(), os.path.basename(_log_path))
elif not os.path.isabs(_log_path):
    _log_path = os.path.join(_writable_dir(), os.path.basename(_log_path))
try:
    logging.basicConfig(
        level=getattr(logging, config.get('log_level', 'INFO')),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(_log_path),
            logging.StreamHandler()
        ]
    )
except Exception as e:
    _write_crash_and_exit(f"Failed to create log file at {_log_path}: {e}")
logger = logging.getLogger('QSOlive')
# So startup banner can show log/crash location when installed for all users
LOG_FILE_PATH = _log_path
CRASH_FILE_PATH = _crash_file()

class ADIFParser:
    """Parse ADIF format QSO data"""
    
    @staticmethod
    def parse(adif_string: str) -> Dict:
        """Parse ADIF string into dictionary"""
        fields = {}
        
        # Simple ADIF parser - handles <FIELD:LENGTH>VALUE format
        i = 0
        while i < len(adif_string):
            if adif_string[i] == '<':
                # Find field name and length
                end = adif_string.find('>', i)
                if end == -1:
                    break
                
                field_info = adif_string[i+1:end]
                parts = field_info.split(':')
                
                if len(parts) >= 2:
                    field_name = parts[0].upper()
                    try:
                        field_length = int(parts[1])
                    except ValueError:
                        i = end + 1
                        continue
                    
                    # Extract value
                    value_start = end + 1
                    value = adif_string[value_start:value_start + field_length]
                    fields[field_name] = value.strip()
                    
                    i = value_start + field_length
                else:
                    i = end + 1
            else:
                i += 1
        
        return fields

class GridSquareGeocoder:
    """Convert Maidenhead grid squares to lat/lon"""
    
    @staticmethod
    def to_latlon(grid: str) -> Optional[tuple]:
        """Convert grid square to (lat, lon) tuple"""
        try:
            if not grid or len(grid) < 4:
                return None
            
            # Use maidenhead library
            lat, lon = mh.to_location(grid)
            return (lat, lon)
        except Exception as e:
            logger.warning(f"Failed to geocode grid square {grid}: {e}")
            return None

class SupabaseClient:
    """Client for sending data to Supabase"""
    
    def __init__(self, url: str, key: str):
        self.url = url.rstrip('/')
        self.key = key
        self.headers = {
            'apikey': key,
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        }
    
    def insert_contact(self, contact: Dict) -> bool:
        """Insert a contact into Supabase. Duplicates (same QSO) are skipped (409)."""
        endpoint = f"{self.url}/rest/v1/contacts"
        # Ensure dedup key field is set (unique on operator, contacted, qso_date, time_on, mode)
        if 'mode' not in contact or contact.get('mode') is None:
            contact['mode'] = ''

        try:
            response = requests.post(
                endpoint,
                headers=self.headers,
                json=contact,
                timeout=10
            )

            if response.status_code in [200, 201]:
                logger.info(f"[OK] Logged contact: {contact.get('contacted_callsign')} on {contact.get('band')} {contact.get('mode')}")
                return True
            if response.status_code == 409:
                # Unique violation: duplicate QSO (e.g. same ADIF via UDP + upload, or re-send)
                logger.debug("Duplicate QSO skipped: %s %s %s %s", contact.get('operator_callsign'), contact.get('contacted_callsign'), contact.get('qso_date'), contact.get('time_on'))
                return True
            try:
                err = response.json()
                if err.get('code') == '23505':
                    logger.debug("Duplicate QSO skipped (23505): %s", contact.get('contacted_callsign'))
                    return True
            except Exception:
                pass
            logger.error(f"Failed to insert contact: {response.status_code} - {response.text}")
            return False

        except requests.exceptions.RequestException as e:
            logger.error(f"Network error: {e}")
            return False

class QSOliveClient:
    """Main client application"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.supabase = SupabaseClient(
            config['supabase_url'],
            config['supabase_key']
        )
        self.parser = ADIFParser()
        self.geocoder = GridSquareGeocoder()
        self.sock = None
        
    def setup_udp_listener(self):
        """Setup UDP socket listener"""
        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.sock.bind((
                self.config.get('udp_host', '0.0.0.0'),
                self.config.get('udp_port', 2337)
            ))
            self.sock.settimeout(1.0)  # Set timeout to allow loop to check for interrupts
            logger.info(f"UDP listener started on {self.config.get('udp_host')}:{self.config.get('udp_port')}")
        except OSError as e:
            logger.error(f"Failed to bind UDP socket: {e}")
            logger.error("Is another instance running? Is the port already in use?")
            sys.exit(1)
    
    def process_adif(self, adif_data: str) -> Optional[Dict]:
        """Process ADIF data into contact record"""
        try:
            # Parse ADIF
            fields = self.parser.parse(adif_data)
            
            if not fields:
                logger.warning("No ADIF fields parsed")
                return None
            
            # Required fields
            if 'CALL' not in fields:
                logger.warning("Missing CALL field in ADIF")
                return None
            mode = (fields.get('MODE') or '').strip()
            if not mode:
                print("Invalid record (missing MODE): CALL=%s DATE=%s TIME=%s" % (
                    fields.get('CALL'), fields.get('QSO_DATE'), fields.get('TIME_ON')))
                return None
            try:
                frequency = float(fields['FREQ']) if fields.get('FREQ') else None
            except (ValueError, TypeError):
                frequency = None
            if frequency is None or frequency <= 0:
                print("Invalid record (missing or invalid FREQ): CALL=%s DATE=%s TIME=%s MODE=%s" % (
                    fields.get('CALL'), fields.get('QSO_DATE'), fields.get('TIME_ON'), mode))
                return None

            # Build contact record
            contact = {
                'callsign': self.config.get('operator_callsign', fields.get('STATION_CALLSIGN', 'UNKNOWN')),
                'contacted_callsign': fields.get('CALL'),
                'qso_date': fields.get('QSO_DATE', datetime.now(timezone.utc).strftime('%Y%m%d')),
                'time_on': fields.get('TIME_ON', datetime.now(timezone.utc).strftime('%H%M%S')),
                'operator_callsign': self.config.get('operator_callsign', 'UNKNOWN'),
                'mode': mode,
                'frequency': frequency,
            }
            # Convert date format: YYYYMMDD -> YYYY-MM-DD
            if len(contact['qso_date']) == 8:
                contact['qso_date'] = f"{contact['qso_date'][:4]}-{contact['qso_date'][4:6]}-{contact['qso_date'][6:]}"
            # Convert time format: HHMMSS -> HH:MM:SS
            if len(contact['time_on']) >= 6:
                contact['time_on'] = f"{contact['time_on'][:2]}:{contact['time_on'][2:4]}:{contact['time_on'][4:6]}"
            elif len(contact['time_on']) == 4:
                contact['time_on'] = f"{contact['time_on'][:2]}:{contact['time_on'][2:4]}:00"

            # Optional fields
            if 'BAND' in fields:
                contact['band'] = fields['BAND']
            if 'RST_SENT' in fields:
                contact['rst_sent'] = fields['RST_SENT']
            if 'RST_RCVD' in fields:
                contact['rst_rcvd'] = fields['RST_RCVD']

            # Geocode grid square
            if 'GRIDSQUARE' in fields:
                contact['gridsquare'] = fields['GRIDSQUARE']
                latlon = self.geocoder.to_latlon(fields['GRIDSQUARE'])
                if latlon:
                    # PostGIS POINT format: POINT(lon lat)
                    contact['location'] = f"POINT({latlon[1]} {latlon[0]})"
            
            # Operator grid square
            if 'MY_GRIDSQUARE' in fields:
                contact['my_gridsquare'] = fields['MY_GRIDSQUARE']
                latlon = self.geocoder.to_latlon(fields['MY_GRIDSQUARE'])
                if latlon:
                    contact['my_location'] = f"POINT({latlon[1]} {latlon[0]})"
            
            # Store raw ADIF for debugging
            contact['raw_adif'] = adif_data
            
            return contact
            
        except Exception as e:
            logger.error(f"Error processing ADIF: {e}", exc_info=True)
            return None
    
    def run(self):
        """Main run loop"""
        env_label, branch = _get_env_display()
        db_display = _get_db_display()
        logger.info("=" * 60)
        logger.info("QSOlive Client Started")
        logger.info("[%s] Branch: %s | DB: %s", env_label, branch, db_display)
        logger.info(f"Operator: {self.config.get('operator_callsign')}")
        logger.info(f"Supabase: {self.config.get('supabase_url')}")
        logger.info("=" * 60)
        if FROZEN:
            logger.info("Log file: %s", LOG_FILE_PATH)
            logger.info("Crash log (on error): %s", CRASH_FILE_PATH)
        print(f"QSOlive [%s] branch=%s db=%s" % (env_label, branch, db_display))
        if FROZEN:
            print("Log file:", LOG_FILE_PATH)
        
        self.setup_udp_listener()
        
        logger.info("Waiting for UDP ADIF packets...")
        logger.info("Press Ctrl+C to stop")
        
        try:
            while True:
                try:
                    # Receive UDP packet
                    data, addr = self.sock.recvfrom(4096)
                    adif_string = data.decode('utf-8', errors='ignore')
                    
                    logger.debug(f"Received {len(data)} bytes from {addr}")
                    logger.debug(f"ADIF: {adif_string[:100]}...")
                    
                    # Process ADIF
                    contact = self.process_adif(adif_string)
                    
                    if contact:
                        # Send to Supabase with retry
                        success = False
                        for attempt in range(self.config.get('retry_attempts', 3)):
                            if self.supabase.insert_contact(contact):
                                success = True
                                break
                            else:
                                if attempt < self.config.get('retry_attempts', 3) - 1:
                                    delay = self.config.get('retry_delay', 5)
                                    logger.warning(f"Retry in {delay} seconds...")
                                    time.sleep(delay)
                        
                        if not success:
                            logger.error(f"Failed to log contact after {self.config.get('retry_attempts', 3)} attempts")
                    
                except socket.timeout:
                    continue
                except KeyboardInterrupt:
                    raise
                except Exception as e:
                    logger.error(f"Error in main loop: {e}", exc_info=True)
                    time.sleep(1)
                    
        except KeyboardInterrupt:
            logger.info("Shutting down...")
        finally:
            if self.sock:
                self.sock.close()
            logger.info("QSOlive client stopped")

def main():
    """Entry point"""
    client = QSOliveClient(config)
    client.run()


def _run_with_crash_handling() -> None:
    """Run main(); on exception write traceback to install-dir crash file and pause if frozen."""
    try:
        main()
    except Exception:
        crash_path = _crash_file()
        tb = traceback.format_exc()
        try:
            with open(crash_path, 'w') as f:
                f.write(tb)
        except Exception:
            pass
        try:
            logger.exception("Unhandled exception")
        except Exception:
            pass
        print(tb)
        if FROZEN:
            print(f"Crash log written to: {crash_path}")
            input("Press Enter to close...")
        sys.exit(1)


if __name__ == '__main__':
    _run_with_crash_handling()