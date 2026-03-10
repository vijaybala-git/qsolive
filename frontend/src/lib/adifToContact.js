/**
 * Convert one ADIF record (and operator callsign) to a contact object for Supabase.
 * Matches client (qsolive_client.py) field mapping and formats.
 */

import { gridToLatLon } from './gridToLatLon.js';

function nowDate() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function nowTime() {
  const d = new Date();
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${h}${m}${s}`;
}

/**
 * @param {{ [key: string]: string }} record - Parsed ADIF record (fields)
 * @param {string} operatorCallsign - Logged-in user's callsign
 * @param {string} [rawAdif] - Original ADIF line for this record (optional)
 * @returns {{ contact?: object, error?: string }} contact to insert, or error
 */
export function adifRecordToContact(record, operatorCallsign, rawAdif = '') {
  if (!record || !record.CALL || !record.CALL.trim()) {
    return { error: 'Missing CALL' };
  }
  const op = (operatorCallsign || '').trim() || 'UNKNOWN';
  let qsoDate = (record.QSO_DATE || nowDate()).trim();
  let timeOn = (record.TIME_ON || nowTime()).trim();
  if (qsoDate.length === 8) {
    qsoDate = `${qsoDate.slice(0, 4)}-${qsoDate.slice(4, 6)}-${qsoDate.slice(6, 8)}`;
  }
  if (timeOn.length >= 6) {
    timeOn = `${timeOn.slice(0, 2)}:${timeOn.slice(2, 4)}:${timeOn.slice(4, 6)}`;
  } else if (timeOn.length === 4) {
    timeOn = `${timeOn.slice(0, 2)}:${timeOn.slice(2, 4)}:00`;
  }
  const contact = {
    callsign: op,
    contacted_callsign: record.CALL.trim(),
    qso_date: qsoDate,
    time_on: timeOn,
    operator_callsign: op,
  };
  if (record.BAND) contact.band = record.BAND.trim();
  if (record.MODE) contact.mode = record.MODE.trim();
  if (record.FREQ) {
    const f = parseFloat(record.FREQ);
    if (Number.isFinite(f)) contact.frequency = f;
  }
  if (record.RST_SENT) contact.rst_sent = record.RST_SENT.trim();
  if (record.RST_RCVD) contact.rst_rcvd = record.RST_RCVD.trim();
  if (record.GRIDSQUARE) {
    contact.gridsquare = record.GRIDSQUARE.trim();
    const latlon = gridToLatLon(record.GRIDSQUARE);
    if (latlon) contact.location = `SRID=4326;POINT(${latlon[1]} ${latlon[0]})`;
  }
  if (record.MY_GRIDSQUARE) {
    contact.my_gridsquare = record.MY_GRIDSQUARE.trim();
    const latlon = gridToLatLon(record.MY_GRIDSQUARE);
    if (latlon) contact.my_location = `SRID=4326;POINT(${latlon[1]} ${latlon[0]})`;
  }
  if (rawAdif) contact.raw_adif = rawAdif;
  return { contact };
}
