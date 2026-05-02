/**
 * Shani Moon transit: Sade Sati (12th, 1st, 2nd from natal Moon) + Dhaiya (4th, 8th).
 * Lahiri sidereal, whole-sign from natal Moon; daily sample at local noon; segment bounds at local midnight.
 */

const vedicAstrology = require('vedic-astrology');

const SIGN_NAMES = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces'
];

const SAMPLE_TIME = '12:00:00';

function toUtcDate(normalizedDate, time, timezone) {
  const [year, month, day] = normalizedDate.split('-').map(Number);
  const [hours, minutes, seconds] = time.split(':').map(Number);
  const utcMillis =
    Date.UTC(year, month - 1, day, hours, minutes, seconds) - timezone * 60 * 60 * 1000;
  return new Date(utcMillis);
}

function saturnSignIndexAt(normalizedDate, lat, lng, timezone) {
  const chart = vedicAstrology.positioner.getBirthChart(
    normalizedDate,
    SAMPLE_TIME,
    lat,
    lng,
    timezone
  );
  const long = chart.meta.Sa.longitude;
  const idx = Math.floor(long / 30);
  return Math.max(0, Math.min(11, idx));
}

function moonSignIndexAtBirth(normalizedDate, time, lat, lng, timezone) {
  const chart = vedicAstrology.positioner.getBirthChart(normalizedDate, time, lat, lng, timezone);
  const long = chart.meta.Mo.longitude;
  const idx = Math.floor(long / 30);
  return Math.max(0, Math.min(11, idx));
}

function phaseKeyFromOffset(offset) {
  switch (offset) {
    case 11:
      return 'sade_sati_12th';
    case 0:
      return 'sade_sati_1st';
    case 1:
      return 'sade_sati_2nd';
    case 3:
      return 'dhaiya_4th';
    case 7:
      return 'dhaiya_8th';
    default:
      return 'none';
  }
}

function phaseAtDate(normalizedDate, moonSignIndex, lat, lng, timezone) {
  const satIdx = saturnSignIndexAt(normalizedDate, lat, lng, timezone);
  const offset = (satIdx - moonSignIndex + 12) % 12;
  return {
    phaseKey: phaseKeyFromOffset(offset),
    saturnSignIndex: satIdx,
    offset
  };
}

function addCalendarDay(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function compareYmd(a, b) {
  return a.localeCompare(b);
}

/**
 * @param {object} params
 * @param {string} params.date - birth yyyy-mm-dd
 * @param {string} params.time - birth HH:MM:SS
 * @param {number} params.lat
 * @param {number} params.lng
 * @param {number} params.timezone - hours east of UTC
 * @param {string} params.windowStart - yyyy-mm-dd (inclusive)
 * @param {string} params.windowEnd - yyyy-mm-dd (inclusive)
 */
function computeShaniMoonTransit(params) {
  const { date: birthDate, time: birthTime, lat, lng, timezone, windowStart, windowEnd } = params;

  const moonSignIndex = moonSignIndexAtBirth(birthDate, birthTime, lat, lng, timezone);
  const startDate = String(windowStart).slice(0, 10);
  const endDate = String(windowEnd).slice(0, 10);

  if (compareYmd(startDate, endDate) > 0) {
    throw new Error('windowStart must be on or before windowEnd');
  }

  const segments = [];
  let prevKey = null;
  /** @type {string|null} */
  let segmentStartDay = null;

  for (
    let d = startDate;
    compareYmd(d, endDate) <= 0;
    d = addCalendarDay(d)
  ) {
    const { phaseKey } = phaseAtDate(d, moonSignIndex, lat, lng, timezone);

    if (phaseKey !== prevKey) {
      if (prevKey && prevKey !== 'none' && segmentStartDay) {
        const endIso = toUtcDate(d, '00:00:00', timezone).toISOString();
        const startMeta = phaseAtDate(segmentStartDay, moonSignIndex, lat, lng, timezone);
        segments.push({
          phaseKey: prevKey,
          start: toUtcDate(segmentStartDay, '00:00:00', timezone).toISOString(),
          end: endIso,
          moonSignIndex,
          saturnSignIndex: startMeta.saturnSignIndex,
          saturnSignName: SIGN_NAMES[startMeta.saturnSignIndex]
        });
      }
      prevKey = phaseKey;
      segmentStartDay = phaseKey !== 'none' ? d : null;
    }
  }

  if (prevKey && prevKey !== 'none' && segmentStartDay) {
    const endIso = toUtcDate(addCalendarDay(endDate), '00:00:00', timezone).toISOString();
    const startMeta = phaseAtDate(segmentStartDay, moonSignIndex, lat, lng, timezone);
    segments.push({
      phaseKey: prevKey,
      start: toUtcDate(segmentStartDay, '00:00:00', timezone).toISOString(),
      end: endIso,
      moonSignIndex,
      saturnSignIndex: startMeta.saturnSignIndex,
      saturnSignName: SIGN_NAMES[startMeta.saturnSignIndex]
    });
  }

  return {
    moonSignIndex,
    moonSignName: SIGN_NAMES[moonSignIndex],
    segments,
    reference: {
      ayanamsa: 'Lahiri',
      moonReference: 'whole_sign_from_natal_moon',
      sampling: 'daily_noon_local',
      segmentBoundary: 'local_midnight'
    }
  };
}

/**
 * Current phase at instant `now` (default: Date.now()) using the same daily sample date as civil `asOfYmd`.
 * @param {object} params
 * @param {string} [params.asOfYmd] - yyyy-mm-dd; default UTC date of `now`
 */
function currentPhaseAt(params, now = new Date()) {
  const {
    date: birthDate,
    time: birthTime,
    lat,
    lng,
    timezone,
    asOfYmd
  } = params;
  const moonSignIndex = moonSignIndexAtBirth(birthDate, birthTime, lat, lng, timezone);
  let ymd = asOfYmd;
  if (!ymd) {
    ymd = now.toISOString().slice(0, 10);
  }
  const { phaseKey, saturnSignIndex, offset } = phaseAtDate(
    String(ymd).slice(0, 10),
    moonSignIndex,
    lat,
    lng,
    timezone
  );
  return {
    phaseKey,
    asOf: toUtcDate(String(ymd).slice(0, 10), SAMPLE_TIME, timezone).toISOString(),
    moonSignIndex,
    moonSignName: SIGN_NAMES[moonSignIndex],
    saturnSignIndex,
    saturnSignName: SIGN_NAMES[saturnSignIndex],
    offset
  };
}

module.exports = {
  computeShaniMoonTransit,
  currentPhaseAt,
  phaseKeyFromOffset,
  phaseAtDate,
  SIGN_NAMES
};
