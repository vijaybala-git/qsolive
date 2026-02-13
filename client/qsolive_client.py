#!/usr/bin/env python3
"""
QSOlive Client - Captures UDP ADIF and sends to Supabase
"""

import socket
import json
import logging
import sys
import time
from datetime import datetime, timezone
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
        print("ERROR: config.json not found! Please copy config.example.json to config.json")
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
                logger.info(f"[OK] Logged contact: {contact.get('contacted_callsign')} on {contact.get('band')} {contact.get('mode')}")
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
            
            # Build contact record
            contact = {
                'callsign': self.config.get('operator_callsign', fields.get('STATION_CALLSIGN', 'UNKNOWN')),
                'contacted_callsign': fields.get('CALL'),
                'qso_date': fields.get('QSO_DATE', datetime.now(timezone.utc).strftime('%Y%m%d')),
                'time_on': fields.get('TIME_ON', datetime.now(timezone.utc).strftime('%H%M%S')),
                'operator_callsign': self.config.get('operator_callsign', 'UNKNOWN')
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