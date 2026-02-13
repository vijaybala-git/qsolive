import { useState, useEffect, useMemo } from 'react'
import { supabase } from './lib/supabase'
import Map, { getModeColor, getBandShapeClass } from './components/Map'
import './index.css'

function App() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOperator, setSelectedOperator] = useState(null)
  const [timeRange, setTimeRange] = useState(48)
  const [selectedModes, setSelectedModes] = useState([])
  const [selectedBands, setSelectedBands] = useState([])

  useEffect(() => {
    fetchContacts()
    
    // Real-time subscription
    const channel = supabase
      .channel('realtime contacts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contacts' }, async (payload) => {
        // Fetch the full row with the formatted location_wkt
        const { data } = await supabase
          .from('contacts')
          .select('*, location_wkt')
          .eq('id', payload.new.id)
          .single()
        
        if (data) {
          setContacts((current) => [data, ...current])
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function fetchContacts() {
    try {
      setLoading(true)
      // Fetch last 2000 contacts (Increased limit)
      const { data, error } = await supabase
        .from('contacts')
        .select('*, location_wkt')
        .order('qso_date', { ascending: false })
        .order('time_on', { ascending: false })
        .limit(2000)

      if (error) throw error
      setContacts(data)
    } catch (error) {
      console.error('Error fetching contacts:', error.message)
    } finally {
      setLoading(false)
    }
  }

  // Filter contacts by time slider
  const visibleContacts = useMemo(() => {
    const cutoff = new Date(Date.now() - timeRange * 60 * 60 * 1000);
    
    return contacts.filter(c => {
      // Combine qso_date (YYYY-MM-DD) and time_on (HH:MM:SS) into UTC Date
      const contactTime = new Date(`${c.qso_date}T${c.time_on}Z`);
      return contactTime >= cutoff;
    }).sort((a, b) => {
      // Ensure list remains sorted by QSO time even when new data arrives via realtime
      if (a.qso_date !== b.qso_date) return b.qso_date.localeCompare(a.qso_date);
      return b.time_on.localeCompare(a.time_on);
    });
  }, [contacts, timeRange])

  // Filter contacts for the Map based on visual filters (Mode/Band)
  const mapContacts = useMemo(() => {
    return visibleContacts.filter(c => {
      if (selectedModes.length > 0) {
        const m = (c.mode || '??').substring(0, 2).toUpperCase();
        if (!selectedModes.includes(m)) return false;
      }
      if (selectedBands.length > 0) {
        const b = c.band || '??';
        if (!selectedBands.includes(b)) return false;
      }
      return true;
    });
  }, [visibleContacts, selectedModes, selectedBands]);

  // Extract operators with counts, sorted by count descending
  const operatorStats = useMemo(() => {
    const stats = {};
    mapContacts.forEach(c => {
      const op = c.operator_callsign || 'Unknown';
      stats[op] = (stats[op] || 0) + 1;
    });
    return Object.entries(stats)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [mapContacts])

  // Extract Mode and Band stats for Legend (from visible time range)
  const legendStats = useMemo(() => {
    const modes = {};
    const bands = {};
    visibleContacts.forEach(c => {
      const m = (c.mode || '??').substring(0, 2).toUpperCase();
      modes[m] = (modes[m] || 0) + 1;
      const b = c.band || '??';
      bands[b] = (bands[b] || 0) + 1;
    });
    return {
      modes: Object.entries(modes).sort((a, b) => b[1] - a[1]),
      bands: Object.entries(bands).sort((a, b) => b[1] - a[1])
    };
  }, [visibleContacts]);

  return (
    <div className="app-container">
      <div className="main-content">
      <div className="sidebar">
        <div className="demo-warning">DEMO ONLY - NOT REAL CONTACTS</div>
        <div className="logo">
          QSOLive <div className="pulsing-dot"></div>
        </div>
        <div className="stats">
          <p>Live Contacts: {contacts.length}</p>
          {contacts.length >= 2000 && (
            <p className="warning">⚠️ Display limit (2000) reached</p>
          )}
        </div>
        
        <h3>Operators</h3>
        <ul className="operator-list">
          <li 
            className={`operator-item ${selectedOperator === null ? 'active' : ''}`}
            onClick={() => setSelectedOperator(null)}
          >
            <span>All Operators</span>
            <span className="badge">{mapContacts.length}</span>
          </li>
          {operatorStats.map(({ name, count }) => (
            <li 
              key={name} 
              className={`operator-item ${selectedOperator === name ? 'active' : ''}`}
              onClick={() => setSelectedOperator(name)}
            >
              <span>{name}</span>
              <span className="badge">{count}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="map-wrapper">
        <Map contacts={mapContacts} selectedOperator={selectedOperator} />
      </div>
      </div>

      <div className="bottom-controls">
        <div className="time-filter">
          <label>
            History: {timeRange} Hours
          </label>
          <input 
            type="range" 
            min="1" 
            max="48" 
            value={timeRange} 
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="slider"
          />
        </div>

        <div className="legend-section">
          <h3>Mode (Color)</h3>
          <div className="legend-grid">
            {legendStats.modes.map(([mode, count]) => (
              <div 
                key={mode} 
                className={`legend-item ${selectedModes.includes(mode) ? 'selected' : ''}`}
                onClick={() => setSelectedModes(prev => 
                  prev.includes(mode) ? prev.filter(m => m !== mode) : [...prev, mode]
                )}
              >
                <span className="legend-color-box" style={{ backgroundColor: getModeColor(mode) }}></span>
                <span>{mode}</span>
                <span className="badge">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="legend-section">
          <h3>Band (Shape)</h3>
          <div className="legend-grid">
            {legendStats.bands.map(([band, count]) => (
              <div 
                key={band} 
                className={`legend-item ${selectedBands.includes(band) ? 'selected' : ''}`}
                onClick={() => setSelectedBands(prev => 
                  prev.includes(band) ? prev.filter(b => b !== band) : [...prev, band]
                )}
              >
                {/* Render a mini shape for the legend */}
                <div style={{ width: 12, height: 12, position: 'relative' }}>
                  <div className={`marker-base ${getBandShapeClass(band)}`} style={{ backgroundColor: '#999' }}></div>
                </div>
                <span>{band}</span>
                <span className="badge">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {(selectedModes.length > 0 || selectedBands.length > 0) && (
          <button 
            className="reset-filters-btn"
            onClick={() => { setSelectedModes([]); setSelectedBands([]); }}
          >
            Reset Filters
          </button>
        )}
      </div>
    </div>
  )
}

export default App