/**
 * Normalize input date string to yyyy-mm-dd for vedic-astrology / Swiss Ephemeris paths.
 * - yyyy-mm-dd → unchanged
 * - dd-mm-yyyy (dashes, zero-padded) → yyyy-mm-dd
 * - mm/dd/yyyy or m/d/yyyy (slashes) → yyyy-mm-dd
 *   If both month and day are ≤12 (ambiguous), uses US mm/dd order (matches product DOB convention).
 */
function normalizeDateToYmd(dateStr) {
  if (dateStr == null || dateStr === '') return dateStr;
  // Mongo lean() / JSON can yield a Date; axios JSON uses ISO strings with time / Z.
  if (dateStr instanceof Date && !Number.isNaN(dateStr.getTime())) {
    return dateStr.toISOString().slice(0, 10);
  }
  if (typeof dateStr !== 'string') return dateStr;
  const trimmed = dateStr.trim();

  // ISO-8601 datetime (…T…Z) or plain yyyy-mm-dd prefix — vedic-astrology expects yyyy-mm-dd only.
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const head = trimmed.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const ddmmyyyyPattern = /^(\d{2})-(\d{2})-(\d{4})$/;
  const dashMatch = trimmed.match(ddmmyyyyPattern);
  if (dashMatch) {
    const [, day, month, year] = dashMatch;
    return `${year}-${month}-${day}`;
  }

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const a = parseInt(slashMatch[1], 10);
    const b = parseInt(slashMatch[2], 10);
    const year = slashMatch[3];
    let month;
    let day;
    if (a > 12) {
      day = String(a).padStart(2, '0');
      month = String(b).padStart(2, '0');
    } else if (b > 12) {
      month = String(a).padStart(2, '0');
      day = String(b).padStart(2, '0');
    } else {
      month = String(a).padStart(2, '0');
      day = String(b).padStart(2, '0');
    }
    return `${year}-${month}-${day}`;
  }

  return trimmed;
}

/**
 * Normalize to HH:MM:SS for vedic-astrology `getBirthChart` (strict format).
 * Handles HH:MM, fractional seconds (Mongo / ISO), and single-digit seconds.
 */
function normalizeTimeToHms(timeStr) {
  if (timeStr == null || timeStr === '') return timeStr;
  const raw = String(timeStr).trim().replace(/Z$/i, '').trim();

  const withSecs = raw.match(/^(\d{1,2}):(\d{2}):(\d{1,2})(?:\.\d+)?$/);
  if (withSecs) {
    const [, h, min, sec] = withSecs;
    return `${h.padStart(2, '0')}:${min}:${String(sec).padStart(2, '0')}`;
  }

  const hmOnly = raw.match(/^(\d{1,2}):(\d{2})(?:\.\d+)?$/);
  if (hmOnly) {
    return `${hmOnly[1].padStart(2, '0')}:${hmOnly[2]}:00`;
  }

  return raw;
}

module.exports = {
  normalizeDateToYmd,
  normalizeTimeToHms
};


