# QSOlive

**See your club's QSOs, live**

QSOlive is a real-time ham radio contact mapping application that visualizes ADIF log entries from multiple operators on an interactive map. Built for ham radio clubs to track and display contacts as they happen.

![QSOlive Logo](docs/logo.png)

## Features

- 📡 **Real-time Contact Tracking** - See QSOs appear on the map as they happen
- 🗺️ **Interactive Mapping** - Visualize contacts by location with detailed popups
- 🔍 **Advanced Filtering** - Filter by operator, mode, band, frequency, and time range
- 👥 **Multi-Operator Support** - Track hundreds of club members simultaneously
- 🔒 **Secure Transport** - HTTPS-only communication from clients to backend
- 📊 **Contact Statistics** - View activity metrics and trends

## Architecture Overview

QSOlive uses a three-tier architecture:

```
┌─────────────────┐
│ Windows Client  │  Captures UDP from logger software
│   (Python)      │  Converts ADIF → JSON
└────────┬────────┘  Posts via HTTPS
         │
         ▼
┌─────────────────┐
│   Supabase      │  PostgreSQL + PostGIS
│   - Database    │  Real-time subscriptions
│   - Auth        │  Edge Functions
│   - Realtime    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Web Frontend   │  React + Leaflet
│  (Vercel/       │  Real-time map updates
│   Netlify)      │  Filter controls
└─────────────────┘
```

## Technology Stack

### Windows Client
- **Language**: Python 3.9+
- **Key Libraries**: 
  - `socket` - UDP listener
  - `requests` - HTTPS transport
  - `adif-parser` - ADIF decoding

### Backend (Supabase)
- **Database**: PostgreSQL 15 with PostGIS
- **Real-time**: Supabase Realtime subscriptions
- **API**: Auto-generated REST API
- **Auth**: API key-based authentication

### Frontend
- **Framework**: React 18
- **Mapping**: Leaflet.js
- **Deployment**: Vercel (recommended) or Netlify
- **State Management**: React hooks + Supabase client
- **Styling**: Tailwind CSS

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.9+ (for Windows client)
- Git
- Supabase account (free tier)
- VS Code (recommended)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/qsolive.git
cd qsolive
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the database schema (see [docs/database-setup.md](docs/database-setup.md))
3. Get your project URL and anon key from Settings → API

### 3. Configure Environment

```bash
# Frontend
cd frontend
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Client
cd ../client
cp config.example.json config.json
# Edit config.json with your Supabase URL and API key
```

### 4. Install Dependencies

```bash
# Frontend
cd frontend
npm install

# Client
cd ../client
pip install -r requirements.txt
```

### 5. Run Locally

```bash
# Frontend (terminal 1)
cd frontend
npm run dev
# Opens at http://localhost:3000

# Client (terminal 2)
cd client
python qsolive_client.py
```

## Project Structure

```
qsolive/
├── client/                 # Windows UDP client
│   ├── qsolive_client.py  # Main client application
│   ├── adif_parser.py     # ADIF format parser
│   ├── config.json        # Client configuration
│   └── requirements.txt   # Python dependencies
│
├── frontend/              # React web application
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── Map.jsx    # Leaflet map component
│   │   │   ├── Filters.jsx
│   │   │   └── ContactList.jsx
│   │   ├── lib/
│   │   │   └── supabase.js  # Supabase client
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── supabase/              # Database schema & functions
│   ├── migrations/        # SQL migration files
│   └── seed.sql          # Sample data
│
├── docs/                  # Documentation
│   ├── architecture.md
│   ├── database-setup.md
│   ├── client-setup.md
│   ├── deployment.md
│   └── api-reference.md
│
├── README.md
└── LICENSE
```

## Configuration

### Client Configuration

Edit `client/config.json`:

```json
{
  "supabase_url": "https://your-project.supabase.co",
  "supabase_key": "your-anon-key",
  "udp_port": 2237,
  "udp_host": "0.0.0.0",
  "operator_callsign": "W1ABC",
  "update_interval": 1
}
```

### Frontend Configuration

Edit `frontend/.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Deployment

### Frontend Deployment (Vercel)

```bash
cd frontend
npm install -g vercel
vercel
```

Follow prompts to deploy. See [docs/deployment.md](docs/deployment.md) for detailed instructions.

### Client Distribution

Package the Windows client:

```bash
cd client
pip install pyinstaller
pyinstaller --onefile --name QSOlive qsolive_client.py
```

Distributable `.exe` will be in `client/dist/`

## Usage

### For Club Members (Operators)

1. Download and install the QSOlive client
2. Configure with your callsign and the club's Supabase URL
3. Ensure your logging software outputs UDP ADIF (port 2237)
4. Run the client - contacts will automatically appear on the map

### For Viewers

1. Visit your club's QSOlive URL
2. Use filters to view:
   - Specific operators
   - Time ranges (last hour, 6 hours, 24 hours)
   - Modes (SSB, CW, FT8, etc.)
   - Bands (160m through 70cm)
   - Frequencies

### Supported Logging Software

The client accepts UDP ADIF output from:
- N1MM Logger+
- Win-Test
- Logger32
- DXLog
- Writelog
- Any logger supporting UDP ADIF broadcast

## Filtering & Features

### Time Filters
- Last hour
- Last 6 hours
- Last 24 hours
- Custom date range

### Contact Filters
- By operator callsign
- By contacted station
- By mode (SSB, CW, RTTY, FT8, FT4, etc.)
- By band (160m, 80m, 40m, 20m, etc.)
- By frequency range

### Map Features
- Clickable markers with contact details
- Great circle path visualization
- Contact clustering at low zoom
- Grid square overlay (Maidenhead)
- Dark/light mode

## ADIF Field Support

QSOlive parses and displays the following ADIF fields:

| Field | Description | Usage |
|-------|-------------|-------|
| CALL | Contacted station | Primary identifier |
| QSO_DATE | Date of contact | Filtering/sorting |
| TIME_ON | Time of contact | Filtering/sorting |
| BAND | Radio band | Filtering/display |
| MODE | Operating mode | Filtering/display |
| FREQ | Frequency in MHz | Filtering/display |
| RST_SENT | Signal report sent | Display |
| RST_RCVD | Signal report received | Display |
| GRIDSQUARE | Maidenhead locator | Geolocation |
| STATION_CALLSIGN | Operator callsign | Multi-op tracking |
| MY_GRIDSQUARE | Operator location | Great circle path |

## Security

- ✅ All client-server communication via HTTPS
- ✅ API key authentication required
- ✅ Row-level security policies in Supabase
- ✅ Rate limiting on API endpoints
- ✅ Input validation and sanitization
- ❌ No UDP packets transmitted over internet (local only)

## Performance

- **Database**: Indexes on callsign, timestamp, operator
- **Real-time**: Subscribes only to filtered data
- **Frontend**: Virtual scrolling for large contact lists
- **Map**: Clustering for >1000 contacts
- **Scalability**: Tested with 100+ simultaneous operators

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 📖 **Documentation**: [docs/](docs/)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/yourusername/qsolive/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/yourusername/qsolive/discussions)
- 📧 **Email**: support@qsolive.io

## Roadmap

- [ ] Mobile app (React Native)
- [ ] Contest mode (real-time scoring)
- [ ] Awards tracking (DXCC, WAS, etc.)
- [ ] Export to CSV/ADIF
- [ ] Multi-club support
- [ ] Integration with QRZ.com lookup
- [ ] Propagation prediction overlay
- [ ] Audio alerts for rare DX

## Acknowledgments

- Ham radio logging software developers
- ADIF specification maintainers
- OpenStreetMap contributors
- Leaflet.js and Supabase teams

## 73!

Built with ❤️ for the ham radio community.

---

**QSOlive** - *See your club's QSOs, live*
