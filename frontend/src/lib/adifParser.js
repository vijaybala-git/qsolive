/**
 * Parse ADIF file text into an array of QSO records.
 * Each record is an object of field names (uppercase) to values.
 * Matches client logic: <FIELD:LENGTH>value, records separated by <EOR>.
 */

/**
 * Parse a single ADIF record string into key-value pairs.
 * @param {string} adifString - One record's ADIF text
 * @returns {{ [key: string]: string }}
 */
export function parseAdifRecord(adifString) {
  const fields = {};
  let i = 0;
  const s = adifString.trim();
  while (i < s.length) {
    if (s[i] === '<') {
      const end = s.indexOf('>', i);
      if (end === -1) break;
      const fieldInfo = s.slice(i + 1, end);
      const parts = fieldInfo.split(':');
      if (parts.length >= 2) {
        const fieldName = parts[0].trim().toUpperCase();
        let fieldLen = 0;
        try {
          fieldLen = parseInt(parts[1].trim(), 10);
        } catch (_) {
          i = end + 1;
          continue;
        }
        const valueStart = end + 1;
        const value = s.slice(valueStart, valueStart + fieldLen).trim();
        fields[fieldName] = value;
        i = valueStart + fieldLen;
      } else {
        i = end + 1;
      }
    } else {
      i += 1;
    }
  }
  return fields;
}

const EOR_RE = /<EOR>\s*/gi;

/**
 * Parse a full ADIF file (multiple records) into an array of { fields, raw }.
 * @param {string} fileText - Full file content
 * @returns {{ fields: { [key: string]: string }, raw: string }[]}
 */
export function parseAdifFile(fileText) {
  if (!fileText || typeof fileText !== 'string') return [];
  const records = [];
  const blocks = fileText.split(EOR_RE);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const fields = parseAdifRecord(trimmed);
    if (Object.keys(fields).length > 0) records.push({ fields, raw: trimmed });
  }
  return records;
}
