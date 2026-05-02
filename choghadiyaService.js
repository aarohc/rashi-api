/**
 * Choghadiya:8 equal divisions of daytime (sunrise→sunset) and of night (sunset→next sunrise).
 * Weekday lord starts daytime; first night lord is the ruler of the 5th daytime segment.
 * Planet cycle (repeating): Sun → Venus → Mercury → Moon → Saturn → Jupiter → Mars
 *
 * Sunrise/sunset: Swiss Ephemeris swe_rise_trans (see solarDayService.js).
 */

const { normalizeDateToYmd } = require('./utils');
const {
  jdToIsoUtc,
  isoUtcToJd,
  gregorianWeekdaySun0,
  addCalendarDays,
  localWallTimeFromUtcNow,
  parseTimeHms,
  localDateTimeToJdUt,
  sunriseForDate,
  sunsetForDate,
  nextSunriseAfter,
} = require('./solarDayService');

const PLANET_CYCLE = ['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars'];

/** JavaScript getUTCDay(): 0=Sun … 6=Sat → index into PLANET_CYCLE for daytime start */
const WEEKDAY_START_INDEX = {
  0: 0, // Sun
  1: 3, // Mon → Moon
  2: 6, // Tue → Mars
  3: 2, // Wed → Mercury
  4: 5, // Thu → Jupiter
  5: 1, // Fri → Venus
  6: 4, // Sat → Saturn
};

const RULER_TO_LABEL = {
  Sun: 'Udveg',
  Venus: 'Chal',
  Mercury: 'Labh',
  Moon: 'Amrit',
  Saturn: 'Kaal',
  Jupiter: 'Shubh',
  Mars: 'Rog',
};

const RULER_TO_NATURE = {
  Sun: 'inauspicious',
  Venus: 'auspicious',
  Mercury: 'auspicious',
  Moon: 'auspicious',
  Saturn: 'inauspicious',
  Jupiter: 'auspicious',
  Mars: 'inauspicious',
};

function buildEightSegments(startJd, endJd, startPlanetIndex) {
  const span = endJd - startJd;
  const step = span / 8;
  const segments = [];
  for (let i = 0; i < 8; i++) {
    const a = startJd + i * step;
    const b = startJd + (i + 1) * step;
    const idx = (startPlanetIndex + i) % 7;
    const rulerPlanet = PLANET_CYCLE[idx];
    segments.push({
      index: i + 1,
      startUtc: jdToIsoUtc(a),
      endUtc: jdToIsoUtc(b),
      rulerPlanet,
      label: RULER_TO_LABEL[rulerPlanet],
      nature: RULER_TO_NATURE[rulerPlanet],
    });
  }
  return segments;
}

function segmentContainingInstant(segments, instantJd) {
  for (const seg of segments) {
    const a = isoUtcToJd(seg.startUtc);
    const b = isoUtcToJd(seg.endUtc);
    if (instantJd >= a && instantJd < b) {
      return seg;
    }
  }
  return null;
}

/**
 * @param {object} params
 * @param {number} params.lat
 * @param {number} params.lng
 * @param {number} params.timezone hours east of UTC (e.g. 5.5 for India)
 * @param {string} [params.date] yyyy-mm-dd or dd-mm-yyyy
 * @param {string} [params.time] HH:MM:SS — defaults to current local time in zone
 */
function computeChoghadiya(params) {
  const { lat, lng, timezone } = params;
  let { date, time } = params;

  const nowWall = localWallTimeFromUtcNow(timezone);
  if (!date) {
    date = `${nowWall.year}-${String(nowWall.month).padStart(2, '0')}-${String(nowWall.day).padStart(2, '0')}`;
  } else {
    date = normalizeDateToYmd(date);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Invalid date format; use YYYY-MM-DD or DD-MM-YYYY');
    }
  }
  if (!time) {
    time = `${String(nowWall.hour).padStart(2, '0')}:${String(nowWall.minute).padStart(2, '0')}:${String(nowWall.second).padStart(2, '0')}`;
  }

  const [year, month, day] = date.split('-').map(Number);

  const tParts = parseTimeHms(time);
  if (!tParts) {
    throw new Error('Invalid time format; use HH:MM:SS');
  }

  const instantJd = localDateTimeToJdUt(
    year,
    month,
    day,
    tParts.hour,
    tParts.minute,
    tParts.second,
    timezone
  );

  const sunriseJd = sunriseForDate(year, month, day, lng, lat, timezone);
  const sunsetJd = sunsetForDate(year, month, day, lng, lat, timezone);
  const nextSunriseJd = nextSunriseAfter(sunsetJd, lng, lat);

  const wd = gregorianWeekdaySun0(year, month, day);
  const dayStartIndex = WEEKDAY_START_INDEX[wd];
  const daySegments = buildEightSegments(sunriseJd, sunsetJd, dayStartIndex);
  const nightStartPlanet = daySegments[4].rulerPlanet;
  const nightStartIndex = PLANET_CYCLE.indexOf(nightStartPlanet);
  const nightSegments = buildEightSegments(sunsetJd, nextSunriseJd, nightStartIndex);

  const prev = addCalendarDays(year, month, day, -1);
  const prevSunriseJd = sunriseForDate(prev.year, prev.month, prev.day, lng, lat, timezone);
  const prevSunsetJd = sunsetForDate(prev.year, prev.month, prev.day, lng, lat, timezone);
  const prevWd = gregorianWeekdaySun0(prev.year, prev.month, prev.day);
  const prevDayStartIndex = WEEKDAY_START_INDEX[prevWd];
  const prevDaySegments = buildEightSegments(prevSunriseJd, prevSunsetJd, prevDayStartIndex);
  const prevNightStartIndex = PLANET_CYCLE.indexOf(prevDaySegments[4].rulerPlanet);
  const prevNightSegments = buildEightSegments(prevSunsetJd, sunriseJd, prevNightStartIndex);

  let current = null;
  if (instantJd >= sunriseJd && instantJd < sunsetJd) {
    const seg = segmentContainingInstant(daySegments, instantJd);
    if (seg) {
      current = {
        phase: 'day',
        segment: seg.index,
        rulerPlanet: seg.rulerPlanet,
        label: seg.label,
        nature: seg.nature,
        startUtc: seg.startUtc,
        endUtc: seg.endUtc,
      };
    }
  } else if (instantJd >= sunsetJd && instantJd < nextSunriseJd) {
    const seg = segmentContainingInstant(nightSegments, instantJd);
    if (seg) {
      current = {
        phase: 'night',
        segment: seg.index,
        rulerPlanet: seg.rulerPlanet,
        label: seg.label,
        nature: seg.nature,
        startUtc: seg.startUtc,
        endUtc: seg.endUtc,
      };
    }
  } else if (instantJd < sunriseJd) {
    const seg = segmentContainingInstant(prevNightSegments, instantJd);
    if (seg) {
      current = {
        phase: 'night',
        segment: seg.index,
        rulerPlanet: seg.rulerPlanet,
        label: seg.label,
        nature: seg.nature,
        startUtc: seg.startUtc,
        endUtc: seg.endUtc,
        note: 'Segment belongs to night ending at this date sunrise (previous civil day evening)',
      };
    }
  }

  return {
    dateLocal: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    weekdayIndex: wd,
    sunriseUtc: jdToIsoUtc(sunriseJd),
    sunsetUtc: jdToIsoUtc(sunsetJd),
    nextSunriseUtc: jdToIsoUtc(nextSunriseJd),
    day: daySegments,
    night: nightSegments,
    current,
  };
}

module.exports = {
  computeChoghadiya,
  PLANET_CYCLE,
  WEEKDAY_START_INDEX,
};
