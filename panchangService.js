/**
 * Daily Panchang bundle for a location: Choghadiya + Rahu Kaal / Yamaganda / Gulika (daytime 8-part),
 * Hora (12+12), Abhijit (when applicable), Tithi/Nakshatra/Yoga at local solar noon.
 *
 * Rahu / Yam / Gul: standard weekday-to-segment mapping over sunrise→sunset (8 equal parts, 1-based index).
 * Hora: 12 equal parts day + 12 night; first hora lord at sunrise matches weekday (same table as Choghadiya day start).
 * Abhijit: 1/15 of daytime centered on solar noon; omitted on Wednesday (common exclusion for travel emphasis).
 *
 * Tithi/Nakshatra/Yoga/Karana: sidereal chart at local civil noon via vedic-astrology (Lahiri, whole sign). Karana from Moon−Sun elongation (6° steps; four fixed + seven movable).
 */

const vedicAstrology = require('vedic-astrology');
const { normalizeDateToYmd } = require('./utils');
const {
  jdToIsoUtc,
  isoUtcToJd,
  gregorianWeekdaySun0,
  sunriseForDate,
  sunsetForDate,
  nextSunriseAfter,
} = require('./solarDayService');
const { computeChoghadiya, PLANET_CYCLE, WEEKDAY_START_INDEX } = require('./choghadiyaService');

/** 1-based segment index (of 8 daytime parts from sunrise) for Sun=0 … Sat=6 */
const RAHU_KAAL_SEGMENT = { 0: 8, 1: 2, 2: 7, 3: 5, 4: 6, 5: 4, 6: 3 };
const YAMAGANDA_SEGMENT = { 0: 5, 1: 4, 2: 3, 3: 2, 4: 1, 5: 7, 6: 6 };
const GULIKA_SEGMENT = { 0: 6, 1: 3, 2: 2, 3: 1, 4: 7, 5: 5, 6: 4 };

const NAKSHATRA_NAMES = [
  'Ashwini',
  'Bharani',
  'Krittika',
  'Rohini',
  'Mrigashirsha',
  'Ardra',
  'Punarvasu',
  'Pushya',
  'Ashlesha',
  'Magha',
  'Purva Phalguni',
  'Uttara Phalguni',
  'Hasta',
  'Chitra',
  'Swati',
  'Vishakha',
  'Anuradha',
  'Jyeshtha',
  'Mula',
  'Purva Ashadha',
  'Uttara Ashadha',
  'Shravana',
  'Dhanishta',
  'Shatabhisha',
  'Purva Bhadrapada',
  'Uttara Bhadrapada',
  'Revati',
];

const NAKSHATRA_LORDS = [
  'Ketu',
  'Venus',
  'Sun',
  'Moon',
  'Mars',
  'Rahu',
  'Jupiter',
  'Saturn',
  'Mercury',
  'Ketu',
  'Venus',
  'Sun',
  'Moon',
  'Mars',
  'Rahu',
  'Jupiter',
  'Saturn',
  'Mercury',
  'Ketu',
  'Venus',
  'Sun',
  'Moon',
  'Mars',
  'Rahu',
  'Jupiter',
  'Saturn',
  'Mercury',
];

const TITHI_NAMES = [
  'Pratipada',
  'Dwitiya',
  'Tritiya',
  'Chaturthi',
  'Panchami',
  'Shashthi',
  'Saptami',
  'Ashtami',
  'Navami',
  'Dashami',
  'Ekadashi',
  'Dwadashi',
  'Trayodashi',
  'Chaturdashi',
  'Purnima',
  'Pratipada',
  'Dwitiya',
  'Tritiya',
  'Chaturthi',
  'Panchami',
  'Shashthi',
  'Saptami',
  'Ashtami',
  'Navami',
  'Dashami',
  'Ekadashi',
  'Dwadashi',
  'Trayodashi',
  'Chaturdashi',
  'Amavasya',
];

/** 27 yogas (first longitude sum mod 27 * 13°20') */
const YOGA_NAMES = [
  'Vishkambha',
  'Priti',
  'Ayushman',
  'Saubhagya',
  'Shobhana',
  'Atiganda',
  'Sukarma',
  'Dhriti',
  'Shoola',
  'Ganda',
  'Vriddhi',
  'Dhruva',
  'Vyaghata',
  'Harshana',
  'Vajra',
  'Siddhi',
  'Vyatipata',
  'Variyan',
  'Parigha',
  'Shiva',
  'Siddha',
  'Sadhya',
  'Shubha',
  'Shukla',
  'Brahma',
  'Indra',
  'Vaidhriti',
];

function nakshatraFromLongitude(longitude) {
  const span = 360 / 27;
  const idx = Math.floor(longitude / span) % 27;
  return {
    index: idx,
    name: NAKSHATRA_NAMES[idx],
    lord: NAKSHATRA_LORDS[idx],
    fractionInNakshatra: (longitude - idx * span) / span,
  };
}

function tithiFromElongation(elongDeg) {
  const t = Math.floor(elongDeg / 12);
  const paksha = t < 15 ? 'Shukla' : 'Krishna';
  const indexInPaksha = t < 15 ? t : t - 15;
  const name = TITHI_NAMES[indexInPaksha];
  const number = indexInPaksha + 1;
  return { index: t, number, name, paksha, fractionInTithi: (elongDeg - t * 12) / 12 };
}

function yogaFromLongitudes(sunLong, moonLong) {
  const sum = (sunLong + moonLong) % 360;
  const span = 360 / 27;
  const idx = Math.floor(sum / span) % 27;
  return { index: idx, name: YOGA_NAMES[idx] };
}

const MOVABLE_KARANAS = ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija', 'Vishti'];

/**
 * Karana from Moon−Sun elongation (0–360°, moon ahead of sun).
 * Each karana spans 6°. Four fixed karanas occur once per lunar month; the rest cycle through the seven movable names.
 * Aligns with common Siddhantic-style tables (Kimstughna at Shukla Pratipada first half, Shakuni/Chatushpada/Naga around Amavasya).
 */
function karanaFromElongation(elongDeg) {
  let e = elongDeg % 360;
  if (e < 0) e += 360;
  const t = Math.floor(e / 12);
  const inHalf = e - t * 12;
  const half = inHalf >= 6 ? 1 : 0;
  const serial = t * 2 + half;
  if (serial === 0) return { name: 'Kimstughna', serial, fixed: true };
  if (serial === 57) return { name: 'Shakuni', serial, fixed: true };
  if (serial === 58) return { name: 'Chatushpada', serial, fixed: true };
  if (serial === 59) return { name: 'Naga', serial, fixed: true };
  const name = MOVABLE_KARANAS[(serial - 1) % 7];
  return { name, serial, fixed: false };
}

function eightPartWindow(sunriseJd, sunsetJd, segment1Based) {
  const daySpan = sunsetJd - sunriseJd;
  const step = daySpan / 8;
  const i = segment1Based - 1;
  const a = sunriseJd + i * step;
  const b = sunriseJd + (i + 1) * step;
  return { startUtc: jdToIsoUtc(a), endUtc: jdToIsoUtc(b) };
}

function buildDayHoras(sunriseJd, sunsetJd, weekdaySun0) {
  const firstIdx = WEEKDAY_START_INDEX[weekdaySun0];
  const span = sunsetJd - sunriseJd;
  const step = span / 12;
  const horas = [];
  for (let i = 0; i < 12; i++) {
    const a = sunriseJd + i * step;
    const b = sunriseJd + (i + 1) * step;
    const lord = PLANET_CYCLE[(firstIdx + i) % 7];
    horas.push({ index: i + 1, phase: 'day', startUtc: jdToIsoUtc(a), endUtc: jdToIsoUtc(b), rulerPlanet: lord });
  }
  return horas;
}

function buildNightHoras(sunsetJd, nextSunriseJd, firstNightLordIndex) {
  const span = nextSunriseJd - sunsetJd;
  const step = span / 12;
  const horas = [];
  for (let i = 0; i < 12; i++) {
    const a = sunsetJd + i * step;
    const b = sunsetJd + (i + 1) * step;
    const lord = PLANET_CYCLE[(firstNightLordIndex + i) % 7];
    horas.push({ index: i + 1, phase: 'night', startUtc: jdToIsoUtc(a), endUtc: jdToIsoUtc(b), rulerPlanet: lord });
  }
  return horas;
}

/**
 * @param {object} params
 * @param {number} params.lat
 * @param {number} params.lng
 * @param {number} params.timezone
 * @param {string} [params.date] yyyy-mm-dd or dd-mm-yyyy
 */
function computePanchangDay(params) {
  const { lat, lng, timezone } = params;
  let { date } = params;
  if (!date) {
    throw new Error('date is required for panchang bundle');
  }
  date = normalizeDateToYmd(date);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Invalid date format; use YYYY-MM-DD or DD-MM-YYYY');
  }

  const [year, month, day] = date.split('-').map(Number);
  const wd = gregorianWeekdaySun0(year, month, day);

  const sunriseJd = sunriseForDate(year, month, day, lng, lat, timezone);
  const sunsetJd = sunsetForDate(year, month, day, lng, lat, timezone);
  const nextSunriseJd = nextSunriseAfter(sunsetJd, lng, lat);

  const rahuSeg = RAHU_KAAL_SEGMENT[wd];
  const yamSeg = YAMAGANDA_SEGMENT[wd];
  const gulSeg = GULIKA_SEGMENT[wd];

  const rahuKaal = { ...eightPartWindow(sunriseJd, sunsetJd, rahuSeg), type: 'Rahu Kaal' };
  const yamaganda = { ...eightPartWindow(sunriseJd, sunsetJd, yamSeg), type: 'Yamaganda' };
  const gulika = { ...eightPartWindow(sunriseJd, sunsetJd, gulSeg), type: 'Gulika' };

  const dayHoras = buildDayHoras(sunriseJd, sunsetJd, wd);
  const lastDayLordIdx = (WEEKDAY_START_INDEX[wd] + 11) % 7;
  const firstNightLordIdx = (lastDayLordIdx + 1) % 7;
  const nightHoras = buildNightHoras(sunsetJd, nextSunriseJd, firstNightLordIdx);

  let abhijit = null;
  if (wd !== 3) {
    const mid = (sunriseJd + sunsetJd) / 2;
    const half = (sunsetJd - sunriseJd) / 30;
    abhijit = {
      type: 'Abhijit',
      startUtc: jdToIsoUtc(mid - half),
      endUtc: jdToIsoUtc(mid + half),
      note: 'Midday auspicious window; excluded Wednesday per common practice',
    };
  }

  const chart = vedicAstrology.positioner.getBirthChart(date, '12:00:00', lat, lng, timezone);
  const sunLong = chart.meta.Su.longitude;
  const moonLong = chart.meta.Mo.longitude;
  let elong = moonLong - sunLong;
  if (elong < 0) elong += 360;

  const nak = nakshatraFromLongitude(moonLong);
  const tithi = tithiFromElongation(elong);
  const yoga = yogaFromLongitudes(sunLong, moonLong);
  const karana = karanaFromElongation(elong);

  const choghadiya = computeChoghadiya({ lat, lng, timezone, date, time: '12:00:00' });

  return {
    dateLocal: date,
    weekdayIndex: wd,
    sunriseUtc: jdToIsoUtc(sunriseJd),
    sunsetUtc: jdToIsoUtc(sunsetJd),
    nextSunriseUtc: jdToIsoUtc(nextSunriseJd),
    maleficDaytimeWindows: [rahuKaal, yamaganda, gulika],
    hora: { day: dayHoras, night: nightHoras },
    abhijit,
    limbsAtLocalNoon: {
      sunLongitude: sunLong,
      moonLongitude: moonLong,
      nakshatra: { name: nak.name, index: nak.index, lord: nak.lord },
      tithi: { name: tithi.name, number: tithi.number, paksha: tithi.paksha, index: tithi.index },
      yoga: { name: yoga.name, index: yoga.index },
      karana: { name: karana.name, serial: karana.serial, fixed: karana.fixed },
      note: 'Limbs sampled at local civil 12:00:00 for the given date and timezone offset; transitions occur at astronomical times.',
    },
    choghadiya: {
      day: choghadiya.day,
      night: choghadiya.night,
    },
  };
}

/**
 * Return true if [a0,a1) overlaps [b0,b1) in JD space
 */
function intervalsOverlapJd(a0, a1, b0, b1) {
  return a0 < b1 && b0 < a1;
}

/**
 * Intersect two half-open UTC intervals; returns null if empty.
 */
function intersectIso(startA, endA, startB, endB) {
  const a0 = isoUtcToJd(startA);
  const a1 = isoUtcToJd(endA);
  const b0 = isoUtcToJd(startB);
  const b1 = isoUtcToJd(endB);
  const s = Math.max(a0, b0);
  const e = Math.min(a1, b1);
  if (s >= e) return null;
  return { startUtc: jdToIsoUtc(s), endUtc: jdToIsoUtc(e) };
}

module.exports = {
  computePanchangDay,
  intersectIso,
  intervalsOverlapJd,
  PLANET_CYCLE,
  WEEKDAY_START_INDEX,
  karanaFromElongation,
};
