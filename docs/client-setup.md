# Windows Client Setup Guide

This guide covers setting up the QSOlive Windows client that captures UDP ADIF packets from logging software and sends them to Supabase.

## Overview

The QSOlive client is a small Python application that:
1. Listens for UDP broadcasts from ham radio logging software
2. Parses ADIF format data
3. Geocodes grid squares to latitude/longitude
4. Sends contacts to Supabase via HTTPS

## Prerequisites

- Windows 10 or 11 (or Linux/Mac for development)
- Python 3.9 or higher
- Ham radio logging software that supports UDP ADIF output
- Supabase project credentials

## Development Setup

### 1. Install Python

Download from [python.org](https://www.python.org/downloads/)

**Important**: Check "Add Python to PATH" during installation

Verify:
```bash
python --version
# Should show Python 3.9.x or higher
```

### 2. Create Project Directory

```bash
mkdir qsolive-client
cd qsolive-client
```

### 3. Create Virtual Environment

```bash
# Create virtual environment
python -m venv .venv

# Activate
# Windows:
.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate
```

### 4. Install Dependencies

Create `requirements.txt`:

```txt
requests>=2.31.0
maidenhead>=1.7.0
python-dotenv>=1.0.0
```

Install:
```bash
pip install -r requirements.txt
```

### 5. Create Configuration File

Create `config.json`:

```json
{
  "supabase_url": "https://your-project.supabase.co",
  "supabase_key": "your-service-role-key",
  "udp_port": 2237,
  "udp_host": "0.0.0.0",
  "operator_callsign": "W6VIJ",
  "update_interval": 1,
  "retry_attempts": 3,
  "retry_delay": 5,
  "log_level": "INFO",
  "log_file": "qsolive_client.log"
}
```

**Configuration Options**:
- `supabase_url`: Your Supabase project URL
- `supabase_key`: Service role key (keep secret!)
- `udp_port`: Port to listen on (2237 is standard)
- `udp_host`: Interface to bind to (0.0.0.0 = all)
- `operator_callsign`: Your callsign
- `update_interval`: Seconds between batch sends
- `retry_attempts`: Number of retries on failure
- `retry_delay`: Seconds between retries
- `log_level`: DEBUG, INFO, WARNING, ERROR
- `log_file`: Where to write logs

### 6. Create Client Application

Create `qsolive_client.py`:

```python
#!/usr/bin/env python3
"""
QSOlive Client - Captures UDP ADIF and sends to Supabase
"""

import socket
import json
import logging
import sys
import time
from datetime import datetime
from typing import Dict, Optional
import requests
import maidenhead as mh

# Configuration
def load_config() -> Dict:
    """Load configuration from config.json"""
    try:
        with open('config.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print("ERROR: config.json not found!")
        sys.exit(1)
    except json.JSONDecodeError:
        print("ERROR: Invalid JSON in config.json")
        sys.exit(1)

config = load_config()

# Setup logging
logging.basicConfig(
    level=getattr(logging, config.get('log_level', 'INFO')),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(config.get('log_file', 'qsolive_client.log')),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('QSOlive')

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
        """Insert a contact into Supabase"""
        endpoint = f"{self.url}/rest/v1/contacts"
        
        try:
            response = requests.post(
                endpoint,
                headers=self.headers,
                json=contact,
                timeout=10
            )
            
            if response.status_code in [200, 201]:
                logger.info(f"✓ Logged contact: {contact.get('contacted_callsign')} on {contact.get('band')} {contact.get('mode')}")
                return True
            else:
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
                self.config.get('udp_port', 2237)
            ))
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
            
            # Build contact record
            contact = {
                'callsign': self.config.get('operator_callsign', fields.get('STATION_CALLSIGN', 'UNKNOWN')),
                'contacted_callsign': fields.get('CALL'),
                'qso_date': fields.get('QSO_DATE', datetime.utcnow().strftime('%Y%m%d')),
                'time_on': fields.get('TIME_ON', datetime.utcnow().strftime('%H%M%S')),
                'operator_callsign': self.config.get('operator_callsign', 'UNKNOWN')
            }
            
            # Convert date format: YYYYMMDD -> YYYY-MM-DD
            if len(contact['qso_date']) == 8:
                contact['qso_date'] = f"{contact['qso_date'][:4]}-{contact['qso_date'][4:6]}-{contact['qso_date'][6:]}"
            
            # Convert time format: HHMMSS -> HH:MM:SS
            if len(contact['time_on']) >= 6:
                contact['time_on'] = f"{contact['time_on'][:2]}:{contact['time_on'][2:4]}:{contact['time_on'][4:6]}"
            
            # Optional fields
            if 'BAND' in fields:
                contact['band'] = fields['BAND']
            if 'MODE' in fields:
                contact['mode'] = fields['MODE']
            if 'FREQ' in fields:
                try:
                    contact['frequency'] = float(fields['FREQ'])
                except ValueError:
                    pass
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
        logger.info("=" * 60)
        logger.info("QSOlive Client Started")
        logger.info(f"Operator: {self.config.get('operator_callsign')}")
        logger.info(f"Supabase: {self.config.get('supabase_url')}")
        logger.info("=" * 60)
        
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

if __name__ == '__main__':
    main()
```

## Testing the Client

### Test with Netcat (Manual UDP Send)

```bash
# Send test ADIF packet
echo "<CALL:5>W1ABC<QSO_DATE:8>20240210<TIME_ON:6>143000<BAND:3>20m<MODE:3>SSB<FREQ:6>14.250<GRIDSQUARE:6>FN42<eor>" | nc -u localhost 2237
```

### Test with Python Script

Create `test_udp.py`:

```python
import socket

def send_test_contact():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    
    adif = """<CALL:5>DL1ABC<QSO_DATE:8>20240210<TIME_ON:6>143000<BAND:3>20m<MODE:3>SSB<FREQ:6>14.250<RST_SENT:2>59<RST_RCVD:2>59<GRIDSQUARE:6>JO62qm<STATION_CALLSIGN:5>W1ABC<MY_GRIDSQUARE:6>FN31pr<eor>"""
    
    sock.sendto(adif.encode(), ('localhost', 2237))
    print("Sent test contact")
    sock.close()

if __name__ == '__main__':
    send_test_contact()
```

Run:
```bash
python test_udp.py
```

## Logging Software Configuration

### N1MM Logger+

1. Open **Config** → **Configure Ports, Mode Control, etc**
2. Go to **Broadcast Data** tab
3. Check **"Contact"**
4. Enter IP: `127.0.0.1`
5. Enter Port: `2237`
6. Format: **ADIF**
7. Click **Update**

### Win-Test

1. Open **Options** → **Interfaces**
2. Add new interface type: **UDP**
3. Host: `localhost`
4. Port: `2237`
5. Format: **ADIF**
6. Enable **Send each QSO**

### Logger32

1. **Setup** → **Options** → **UDP**
2. Enable UDP output
3. Port: `2237`
4. Format: **ADIF**

### DXLog

1. **Options** → **Network Setup**
2. Broadcast: Enable
3. Port: `2237`
4. Format: **ADIF**

## Packaging for Distribution

### Create Standalone Executable

Install PyInstaller:
```bash
pip install pyinstaller
```

Create executable:
```bash
pyinstaller --clean --onefile --name QSOlive --hidden-import=maidenhead --icon=icon.ico qsolive_client.py
```

Output: `dist/QSOlive.exe`

### Create Installer (Optional)

Use Inno Setup or NSIS to create a proper Windows installer.
 
Example Inno Setup script (`installer.iss`):

```ini
[Setup]
AppName=QSOlive Client
AppVersion=1.0
DefaultDirName={pf}\QSOlive
DefaultGroupName=QSOlive
OutputDir=installer_output
OutputBaseFilename=QSOlive_Setup

[Files]
Source: "dist\QSOlive.exe"; DestDir: "{app}"
Source: "config.example.json"; DestDir: "{app}"; DestName: "config.json"

[Icons]
Name: "{group}\QSOlive Client"; Filename: "{app}\QSOlive.exe"
Name: "{group}\Edit Config"; Filename: "notepad.exe"; Parameters: "{app}\config.json"
```

## Troubleshooting

### Client Won't Start

**Check Python installation**:
```bash
python --version
```

**Check port not in use**:
```bash
netstat -an | findstr :2237
```

### No Contacts Appearing

1. **Check logging software** is sending UDP
2. **Check firewall** isn't blocking port 2237
3. **Check config.json** has correct Supabase credentials
4. **Check logs**: `qsolive_client.log`

### Grid Square Errors

Some loggers don't send grid squares. Configure in logger software or manually add to config.

### Connection Errors

**Check internet connection**:
```bash
ping supabase.com
```

**Check Supabase URL** is correct in config.json

**Check API key** is service_role key (not anon key)

## Security Best Practices

1. **Never share config.json** (contains API keys)
2. **Use service_role key** only in client (not frontend)
3. **Keep client updated** with security patches
4. **Use firewall** to restrict UDP to local network only
5. **Log rotation** to prevent disk filling

## Next Steps

1. ✅ Client installed and configured
2. ✅ Logging software configured
3. → Test with live QSOs
4. → Deploy frontend ([deployment.md](deployment.md))
5. → Monitor on map!

## Support

- Check logs: `qsolive_client.log`
- GitHub Issues: Report bugs
- Discord/Email: Get help from community
