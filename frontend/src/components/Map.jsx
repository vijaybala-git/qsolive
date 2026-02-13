import React from 'react'
import { MapContainer, TileLayer, Marker, Popup, LayersControl, GeoJSON, LayerGroup } from 'react-leaflet'
import L from 'leaflet'
import { prefixesData } from '../prefixes.js'

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

// Helper to parse location data
const parseLocation = (loc) => {
  if (!loc) return null;
  
  // Handle GeoJSON object (if Supabase returns it as JSON)
  if (typeof loc === 'object' && loc.coordinates) {
    return [loc.coordinates[1], loc.coordinates[0]]; // [lat, lon]
  }
  
  // Handle WKT string: "POINT(-122.4 37.7)" -> [37.7, -122.4]
  if (typeof loc === 'string') {
    // Improved regex to handle scientific notation and various spacing
    const match = loc.match(/POINT\s*\(\s*(\S+)\s+(\S+)\s*\)/i);
    if (match) {
      return [parseFloat(match[2]), parseFloat(match[1])];
    }
  }
  
  return null;
};

// Export helpers so App.jsx can use them for the Legend
export const getModeColor = (mode) => {
  if (!mode) return '#7f7f7f';
  const m = mode.substring(0, 2).toUpperCase();
  switch (m) {
    case 'CW': return '#1f77b4'; // Blue
    case 'SS': return '#2ca02c'; // Green (SSB)
    case 'FT': return '#d62728'; // Red (FT8/FT4)
    case 'FM': return '#ff7f0e'; // Orange
    case 'AM': return '#9467bd'; // Purple
    default: return '#7f7f7f';   // Gray
  }
};

export const getBandShapeClass = (band) => {
  if (!band) return 'shape-circle';
  const b = band.toLowerCase();
  if (b.includes('20m')) return 'shape-diamond';
  if (b.includes('40m')) return 'shape-square';
  if (b.includes('80m') || b.includes('160m')) return 'shape-triangle';
  if (b.includes('10m') || b.includes('15m') || b.includes('12m') || b.includes('17m')) return 'shape-circle';
  return 'shape-circle'; // Default
};

export default function Map({ contacts, selectedOperator }) {
  // Default view: World map
  const position = [20, 0] 

  // Debug: Check if data is loaded
  console.log("Prefixes Data:", prefixesData);

  return (
    <MapContainer center={position} zoom={2} style={{ height: "100vh", width: "100%" }}>
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
            {contacts.map((contact) => {
        // Use the computed WKT column if available, otherwise fall back to raw
        const position = parseLocation(contact.location_wkt || contact.location);
        if (!position) return null;

        // Highlight logic: 
        const isSelected = selectedOperator && contact.operator_callsign === selectedOperator;
        const isDimmed = selectedOperator && !isSelected;
        
        const opacity = isDimmed ? 0.2 : 1.0;
        const zIndexOffset = isSelected ? 1000 : 0; // Bring selected to front

        // Create custom icon based on Mode (Color) and Band (Shape)
        const color = getModeColor(contact.mode);
        const shapeClass = getBandShapeClass(contact.band);
        
        // Enhance visibility for selected operator
        const size = isSelected ? 14 : 8;
        const anchor = size / 2;
        const highlightClass = isSelected ? 'marker-highlight' : '';

        const customIcon = L.divIcon({
          className: 'custom-marker-container', // Empty class to avoid default styles
          html: `<div class="marker-base ${shapeClass} ${highlightClass}" style="background-color: ${color};"></div>`,
          iconSize: [size, size],
          iconAnchor: [anchor, anchor],
          popupAnchor: [0, -6]
        });

        return (
          <Marker 
            key={contact.id} 
            position={position}
            icon={customIcon}
            opacity={opacity}
            zIndexOffset={zIndexOffset}
          >
            <Popup>
              <strong>{contact.contacted_callsign}</strong><br/>
              Op: {contact.operator_callsign}<br/>
              {contact.band} {contact.mode}
            </Popup>
          </Marker>
        );
      })}
          </LayerGroup>
        </LayersControl.Overlay>
      </LayersControl>
    </MapContainer>
  )
}