/**
 * Maidenhead grid square to latitude/longitude (WGS84).
 * Pure JS, no API. Handles 4- and 6-character (and 8-char) grid locators.
 */

/**
 * Convert Maidenhead grid locator to [lat, lon].
 * @param {string} grid - e.g. "FN42", "JO62qm"
 * @returns {[number, number] | null} [latitude, longitude] or null if invalid
 */
export function gridToLatLon(grid) {
  if (!grid || typeof grid !== 'string') return null;
  const g = grid.trim().toUpperCase();
  if (g.length < 4) return null;
  try {
    // First 2 chars: longitude (A-R = 0-17), latitude (A-R = 0-17)
    const lon1 = (g.charCodeAt(0) - 65) * 20;
    const lat1 = (g.charCodeAt(1) - 65) * 10;
    const lon2 = parseInt(g.charAt(2), 10) * 2;
    const lat2 = parseInt(g.charAt(3), 10) * 1;
    let lon = lon1 + lon2 - 180;
    let lat = lat1 + lat2 - 90;
    if (g.length >= 6) {
      const lon3 = (g.charCodeAt(4) - 65) * (2 / 24);
      const lat3 = (g.charCodeAt(5) - 65) * (1 / 24);
      lon += lon3 + 1 / 24;
      lat += lat3 + 0.5 / 24;
    }
    if (g.length >= 8) {
      const lon4 = parseInt(g.charAt(6), 10) * (2 / 240);
      const lat4 = parseInt(g.charAt(7), 10) * (1 / 240);
      lon += lon4 + 1 / 240;
      lat += lat4 + 0.5 / 240;
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return [lat, lon];
  } catch (_) {
    return null;
  }
}
