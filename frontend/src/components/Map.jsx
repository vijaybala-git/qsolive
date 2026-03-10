import React, { useEffect, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, LayersControl, GeoJSON, LayerGroup } from 'react-leaflet'
import L from 'leaflet'
import { prefixesData } from '../prefixes.js'
import { supabase } from '../lib/supabase'

// Fix for default marker icons in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Built-in Map (component is also named Map, so avoid new Map() inside the component)
const MapData = globalThis.Map;

// Parse PostGIS EWKB hex string (Supabase returns geography as this)
function parseEWKBHex(hex) {
  if (typeof hex !== 'string' || hex.length < 34) return null;
  const len = hex.length / 2;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  const view = new DataView(bytes.buffer);
  const littleEndian = bytes[0] === 1;
  const wkbType = view.getUint32(1, littleEndian);
  const hasSrid = (wkbType & 0x20000000) !== 0;
  const headerSize = hasSrid ? 9 : 5;
  if (len < headerSize + 16) return null;
  const lon = view.getFloat64(headerSize, littleEndian);
  const lat = view.getFloat64(headerSize + 8, littleEndian);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return [lat, lon];
}

// Helper to parse location data (WKT, GeoJSON, EWKB hex, or PostGIS geography object)
const parseLocation = (loc) => {
  if (loc == null) return null;

  if (typeof loc === 'object') {
    if (Array.isArray(loc.coordinates)) {
      const [lon, lat] = loc.coordinates;
      if (typeof lat === 'number' && typeof lon === 'number') return [lat, lon];
    }
    if (typeof loc.x !== 'undefined' && typeof loc.y !== 'undefined') return [loc.y, loc.x];
    if (typeof loc.lat === 'number' && typeof loc.lng === 'number') return [loc.lat, loc.lng];
    if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number') return [loc.latitude, loc.longitude];
  }

  if (typeof loc === 'string') {
    if (/^[0-9a-fA-F]+$/.test(loc)) return parseEWKBHex(loc);
    const wktMatch = loc.match(/POINT\s*\(\s*([-\d.eE+]+)\s+([-\d.eE+]+)\s*\)/i);
    if (wktMatch) {
      const lat = parseFloat(wktMatch[2]);
      const lon = parseFloat(wktMatch[1]);
      if (!Number.isNaN(lat) && !Number.isNaN(lon)) return [lat, lon];
    }
    try {
      const parsed = JSON.parse(loc);
      if (parsed && Array.isArray(parsed.coordinates)) {
        const [lon, lat] = parsed.coordinates;
        if (typeof lat === 'number' && typeof lon === 'number') return [lat, lon];
      }
    } catch (_) {}
  }

  return null;
};

// Get display position: contacted station location, or operator location as fallback
const getContactPosition = (contact) =>
  parseLocation(contact?.location_wkt || contact?.location) ||
  parseLocation(contact?.my_location);

// Band → Color (for marker fill)
const BAND_COLORS = {
  '160m': '#4a148c', '80m': '#6a1b9a', '60m': '#7b1fa2', '40m': '#8e24aa', '30m': '#ab47bc',
  '20m': '#1f77b4', '17m': '#2196f3', '15m': '#03a9f4', '12m': '#00bcd4', '10m': '#009688',
  '6m': '#4caf50', '2m': '#8bc34a', '1.25m': '#cddc39', '70cm': '#ff9800', '33cm': '#ff5722',
  '23cm': '#795548', '13cm': '#607d8b',
};
export const getBandColor = (band) => {
  if (!band) return '#7f7f7f';
  const b = band.toLowerCase().replace(/\s/g, '');
  for (const [key, color] of Object.entries(BAND_COLORS)) {
    if (b.includes(key.replace(/\s/g, ''))) return color;
  }
  return '#7f7f7f';
};

// Mode → Shape (each mode distinct where possible: circle=SSB, diamond=CW, square=AM/FM/FT*, triangle=digital)
const MODE_SHAPES = {
  CW: 'shape-diamond',
  SSB: 'shape-circle',
  AM: 'shape-square', FM: 'shape-square',
  RTTY: 'shape-triangle', PSK31: 'shape-triangle', PSK63: 'shape-triangle', JT65: 'shape-triangle', JT9: 'shape-triangle',
  FT8: 'shape-square', FT4: 'shape-square',
};
export const getModeShapeClass = (mode) => {
  if (!mode) return 'shape-circle';
  const u = (mode || '').toUpperCase();
  return MODE_SHAPES[u] || MODE_SHAPES[u.substring(0, 2)] || 'shape-circle';
};

// Standard bands/modes for filter buttons (order for display)
export const STANDARD_BANDS = ['160m', '80m', '60m', '40m', '30m', '20m', '17m', '15m', '12m', '10m', '6m', '2m', '70cm'];
export const STANDARD_MODES = ['CW', 'SSB', 'AM', 'FM', 'RTTY', 'FT8', 'FT4', 'PSK31', 'PSK63', 'JT65', 'JT9'];

// Time filter: value in minutes; 0 = All
const TIME_FILTER_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hr' },
  { value: 120, label: '2 hr' },
  { value: 240, label: '4 hr' },
  { value: 480, label: '8 hr' },
  { value: 960, label: '16 hr' },
  { value: 1440, label: '24 hr' },
  { value: 2880, label: '48 hr' },
  { value: 0, label: 'All' },
];

/** Get contact time as Date: prefer QSO time (qso_date + time_on in UTC), else created_at */
function getContactTime(c) {
  let qsoDate = (c.qso_date || '').toString().trim();
  let timeOn = c.time_on;
  if (qsoDate && timeOn != null) {
    if (qsoDate.length === 8 && qsoDate.indexOf('-') === -1) {
      qsoDate = `${qsoDate.slice(0, 4)}-${qsoDate.slice(4, 6)}-${qsoDate.slice(6, 8)}`;
    }
    timeOn = String(timeOn).trim();
    if (timeOn.length === 5 && timeOn[2] === ':') timeOn += ':00'; // HH:MM -> HH:MM:00
    const iso = `${qsoDate}T${timeOn}Z`; // Z = UTC; QSO time is always UTC in ADIF
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(c.created_at || 0);
}

/** Filter by QSO time (UTC). Cutoff is now_UTC - N minutes; comparison is UTC-to-UTC. */
function filterByTime(contacts, timeMinutes) {
  if (timeMinutes <= 0) return contacts;
  const cut = new Date(Date.now() - timeMinutes * 60 * 1000); // UTC
  return contacts.filter((c) => getContactTime(c) >= cut);
}

export default function Map() {
  const [contacts, setContacts] = useState([]);
  const [currentUserCall, setCurrentUserCall] = useState(null);
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [operators, setOperators] = useState([]);
  const [timeFilterMinutes, setTimeFilterMinutes] = useState(2880); // 48 hr default
  const [selectedBands, setSelectedBands] = useState(new Set());
  const [selectedModes, setSelectedModes] = useState(new Set());

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let fetchedContacts = [];

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile) {
          setCurrentUserCall(profile.callsign);
          const config = profile.display_config || { mode: 'self' };
          const displayMode = String(config.mode || 'self').toLowerCase().trim();
          const clubIds = displayMode === 'clubs' && config.club_ids
            ? (Array.isArray(config.club_ids) ? config.club_ids : [config.club_ids].filter(Boolean))
            : [];

          if (displayMode === 'public') {
            const { data, error } = await supabase
              .from('contacts')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(1000);
            if (error) console.error('contacts (public):', error);
            if (data) fetchedContacts = data;
            // Ensure current user's personal contacts are included (merge by id, then sort by created_at)
            if (profile.callsign?.trim()) {
              const { data: selfData } = await supabase.rpc('get_display_logs', { filter_mode: 'self', filter_value: profile.callsign.trim() });
              if (selfData?.length) {
                const ids = new Set((fetchedContacts || []).map((c) => c.id));
                const extra = (selfData || []).filter((c) => !ids.has(c.id));
                fetchedContacts = [...(fetchedContacts || []), ...extra].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
              }
            }
          } else if (clubIds.length > 0) {
            const { data, error } = await supabase.rpc('get_display_logs_clubs', { club_ids: clubIds });
            if (error) console.error('get_display_logs_clubs:', error);
            if (data && Array.isArray(data)) fetchedContacts = data;
          } else if (displayMode === 'club' && config.target_id) {
            const { data, error } = await supabase.rpc('get_display_logs', { filter_mode: 'club', filter_value: config.target_id });
            if (error) console.error('get_display_logs:', error);
            if (data) fetchedContacts = data;
          } else if (displayMode === 'self' && profile.callsign) {
            const { data, error } = await supabase.rpc('get_display_logs', { filter_mode: 'self', filter_value: profile.callsign });
            if (error) console.error('get_display_logs:', error);
            if (data) fetchedContacts = data;
          }
        }
      }

      if (fetchedContacts.length === 0) {
        const { data, error } = await supabase
          .from('contacts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1000);
        if (error) console.error('contacts fallback:', error);
        if (data) fetchedContacts = data;
      }

      if (mounted) {
        setContacts(fetchedContacts);
        const ops = [...new Set(fetchedContacts.map((c) => c.operator_callsign))];
        setOperators(ops.sort());
        const withPos = fetchedContacts.filter((c) => getContactPosition(c)).length;
        console.log('[Map] Loaded', fetchedContacts.length, 'contacts, with position:', withPos);
        if (fetchedContacts.length > 0 && withPos === 0 && typeof console !== 'undefined') {
          const first = fetchedContacts[0];
          console.log('[Map] First contact location:', typeof first?.location, first?.location);
          console.log('[Map] First contact my_location:', typeof first?.my_location, first?.my_location);
        }
      }
    };

    loadData();

    const channel = supabase
      .channel('realtime_contacts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contacts' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const norm = (s) => (s || '').toLowerCase().trim();
  const bandMatches = (cBand, selBand) => {
    const a = norm(cBand);
    const b = norm(selBand);
    return a && b && (a.includes(b) || b.includes(a));
  };
  const modeMatches = (cMode, selMode) => norm(cMode).startsWith(norm(selMode)) || norm(selMode).startsWith(norm(cMode));

  const filteredContacts = (() => {
    let list = filterByTime(contacts, timeFilterMinutes);
    if (selectedBands.size > 0) list = list.filter((c) => c.band && [...selectedBands].some((b) => bandMatches(c.band, b)));
    if (selectedModes.size > 0) list = list.filter((c) => c.mode && [...selectedModes].some((m) => modeMatches(c.mode, m)));
    return list;
  })();

  const filteredOperators = [...new Set(filteredContacts.map((c) => c.operator_callsign))].sort();
  const bandsInData = [...new Set(contacts.map((c) => c.band).filter(Boolean))];
  const modesInData = [...new Set(contacts.map((c) => c.mode).filter(Boolean))];
  const bandOptions = [...STANDARD_BANDS, ...bandsInData.filter((d) => !STANDARD_BANDS.some((s) => norm(s) === norm(d)))];
  const modeOptions = [...STANDARD_MODES, ...modesInData.filter((d) => !STANDARD_MODES.some((s) => norm(s) === norm(d)))];

  const toggleBand = (band) => {
    setSelectedBands((prev) => {
      const next = new Set(prev);
      if (next.has(band)) next.delete(band);
      else next.add(band);
      return next;
    });
  };
  const toggleMode = (mode) => {
    setSelectedModes((prev) => {
      const next = new Set(prev);
      if (next.has(mode)) next.delete(mode);
      else next.add(mode);
      return next;
    });
  };

  // One marker per location (round to 4 decimals); popup shows ALL contact groups at that point
  const locationGroups = useMemo(() => {
    const posKey = (pos) => `${pos[0].toFixed(4)},${pos[1].toFixed(4)}`;
    const eventKey = (c) => {
      const ca = (c.contacted_callsign || '').trim();
      const band = (c.band || '').trim();
      const mode = (c.mode || '').trim();
      return `${ca}|${band}|${mode}`;
    };
    const byLocation = new MapData(); // positionKey -> { position, byEvent: Map eventKey -> contacts[] }
    for (const c of filteredContacts) {
      const pos = getContactPosition(c);
      if (!pos) continue;
      const pk = posKey(pos);
      if (!byLocation.has(pk)) byLocation.set(pk, { position: pos, byEvent: new MapData() });
      const entry = byLocation.get(pk);
      const ek = eventKey(c);
      if (!entry.byEvent.has(ek)) entry.byEvent.set(ek, []);
      entry.byEvent.get(ek).push(c);
    }
    return Array.from(byLocation.entries()).map(([positionKey, entry]) => {
      const groups = Array.from(entry.byEvent.entries()).map(([eventKey, list]) => {
        const sorted = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return { eventKey, contacts: sorted, first: sorted[0] };
      });
      const totalContacts = groups.reduce((sum, g) => sum + g.contacts.length, 0);
      return { positionKey, position: entry.position, groups, totalContacts };
    }).filter((g) => g.position);
  }, [filteredContacts]);

  const position = [20, 0];

  return (
    <div className="map-page">
      <div className="map-sidebar">
        <div className="map-sidebar-header">
          <h3>FILTERS</h3>
        </div>
        <div className="map-filters">
          <label className="map-filter-label">Time</label>
          <select
            value={timeFilterMinutes}
            onChange={(e) => setTimeFilterMinutes(Number(e.target.value))}
            className="map-time-select"
          >
            {TIME_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <label className="map-filter-label">Band</label>
          <div className="map-filter-buttons">
            {bandOptions.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => toggleBand(b)}
                className={`map-filter-btn map-filter-btn-band ${selectedBands.has(b) ? 'map-filter-btn-on' : ''}`}
                title={selectedBands.size > 0 && !selectedBands.has(b) ? 'Filtered out' : ''}
              >
                <span className="map-filter-btn-band-dot" style={{ backgroundColor: getBandColor(b) }} />
                {b}
              </button>
            ))}
          </div>
          <label className="map-filter-label">Mode</label>
          <div className="map-filter-buttons">
            {modeOptions.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => toggleMode(m)}
                className={`map-filter-btn map-filter-btn-mode ${getModeShapeClass(m)} ${selectedModes.has(m) ? 'map-filter-btn-on' : ''}`}
              >
                <span className="map-filter-btn-mode-symbol" />
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="map-sidebar-header">
          <h3>ACTIVE OPERATORS ({filteredOperators.length})</h3>
        </div>
        <div className="map-sidebar-list">
          {filteredOperators.length === 0 && <div className="map-sidebar-empty">No operators in range</div>}
          {filteredOperators.map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => setSelectedOperator((prev) => (prev === op ? null : op))}
              className={`map-operator-item ${op === currentUserCall ? 'current' : ''} ${selectedOperator === op ? 'selected' : ''}`}
            >
              <span>{op}</span>
              <span className="map-operator-dot">●</span>
            </button>
          ))}
        </div>
      </div>
      <div className="map-content">
        <div className="map-inner">
    <MapContainer center={position} zoom={2} style={{ height: "100%", width: "100%" }}>
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Standard Map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>

        <LayersControl.Overlay checked name="Ham Prefixes">
          {prefixesData && prefixesData.features && (
            <GeoJSON 
              key="prefixes-layer"
              data={prefixesData} 
              style={{ stroke: false, fill: false }}
              onEachFeature={(feature, layer) => {
                if (feature.properties && feature.properties.prefix) {
                  layer.bindTooltip(feature.properties.prefix, { direction: 'center', className: 'prefix-label', permanent: true });
                }
              }}
            />
          )}
        </LayersControl.Overlay>

        <LayersControl.Overlay checked name="Contacts">
          <LayerGroup>
            {locationGroups.map((loc) => {
        const { positionKey, position, groups, totalContacts } = loc;
        const hasSelectedOp = selectedOperator && groups.some((g) => g.contacts.some((c) => c.operator_callsign === selectedOperator));
        const isDimmed = selectedOperator && !hasSelectedOp;
        const opacity = isDimmed ? 0.25 : 1.0;
        const zIndexOffset = hasSelectedOp ? 1000 : 0;

        const firstGroup = groups[0];
        const color = getBandColor(firstGroup.first.band);
        const shapeClass = getModeShapeClass(firstGroup.first.mode);
        const size = hasSelectedOp ? 14 : 8;
        const anchor = size / 2;
        const highlightClass = hasSelectedOp ? 'marker-highlight' : '';

        const customIcon = L.divIcon({
          className: 'custom-marker-container',
          html: `<div class="marker-base ${shapeClass} ${highlightClass}" style="background-color: ${color};"></div>`,
          iconSize: [size, size],
          iconAnchor: [anchor, anchor],
          popupAnchor: [0, -6]
        });

        const maxOps = 4;
        const popupLines = groups.map((g) => {
          const ops = g.contacts.slice(0, maxOps).map((c) => c.operator_callsign).join(' ');
          const more = g.contacts.length > maxOps ? ` +${g.contacts.length - maxOps} more` : '';
          const rst = g.first.rst_rcvd ?? g.first.rst_received ?? '';
          return `${ops}${more} | ${(g.first.contacted_callsign || '').trim()} | ${(g.first.band || '').trim()} | ${(g.first.mode || '').trim()} | ${rst}`.trim();
        });

        return (
          <Marker
            key={positionKey}
            position={position}
            icon={customIcon}
            opacity={opacity}
            zIndexOffset={zIndexOffset}
          >
            <Popup className="map-contact-popup">
              <div className="map-contact-popup-inner">
                <div className="map-contact-popup-title">{totalContacts} contact{totalContacts !== 1 ? 's' : ''} at this point</div>
                <div className="map-contact-popup-list">
                  {popupLines.map((line, i) => (
                    <div key={i} className="map-contact-popup-line">{line}</div>
                  ))}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
          </LayerGroup>
        </LayersControl.Overlay>
      </LayersControl>
    </MapContainer>
        </div>
      </div>
    </div>
  )
}