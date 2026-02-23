const vedicAstrology = require('vedic-astrology');

// Standard Vimshottari dasha sequence (in years)
const VIMSHOTTARI_DASHAS = [
  { lord: 'Ketu', years: 7 },
  { lord: 'Venus', years: 20 },
  { lord: 'Sun', years: 6 },
  { lord: 'Moon', years: 10 },
  { lord: 'Mars', years: 7 },
  { lord: 'Rahu', years: 18 },
  { lord: 'Jupiter', years: 16 },
  { lord: 'Saturn', years: 19 },
  { lord: 'Mercury', years: 17 }
];

// 27 Nakshatras in order with their lords (Vimshottari)
const NAKSHATRAS = [
  { name: 'Ashwini', lord: 'Ketu' },
  { name: 'Bharani', lord: 'Venus' },
  { name: 'Krittika', lord: 'Sun' },
  { name: 'Rohini', lord: 'Moon' },
  { name: 'Mrigashirsha', lord: 'Mars' },
  { name: 'Ardra', lord: 'Rahu' },
  { name: 'Punarvasu', lord: 'Jupiter' },
  { name: 'Pushya', lord: 'Saturn' },
  { name: 'Ashlesha', lord: 'Mercury' },
  { name: 'Magha', lord: 'Ketu' },
  { name: 'Purva Phalguni', lord: 'Venus' },
  { name: 'Uttara Phalguni', lord: 'Sun' },
  { name: 'Hasta', lord: 'Moon' },
  { name: 'Chitra', lord: 'Mars' },
  { name: 'Swati', lord: 'Rahu' },
  { name: 'Vishakha', lord: 'Jupiter' },
  { name: 'Anuradha', lord: 'Saturn' },
  { name: 'Jyeshtha', lord: 'Mercury' },
  { name: 'Mula', lord: 'Ketu' },
  { name: 'Purva Ashadha', lord: 'Venus' },
  { name: 'Uttara Ashadha', lord: 'Sun' },
  { name: 'Shravana', lord: 'Moon' },
  { name: 'Dhanishta', lord: 'Mars' },
  { name: 'Shatabhisha', lord: 'Rahu' },
  { name: 'Purva Bhadrapada', lord: 'Jupiter' },
  { name: 'Uttara Bhadrapada', lord: 'Saturn' },
  { name: 'Revati', lord: 'Mercury' }
];

const NAKSHATRA_SPAN = 360 / 27; // 13°20'

/**
 * Convert a local birth date/time and timezone to a JS Date in UTC
 */
function toUtcDate(normalizedDate, time, timezone) {
  const [year, month, day] = normalizedDate.split('-').map(Number);
  const [hours, minutes, seconds] = time.split(':').map(Number);
  const utcMillis =
    Date.UTC(year, month - 1, day, hours, minutes, seconds) -
    timezone * 60 * 60 * 1000;
  return new Date(utcMillis);
}

/**
 * Add fractional years to a JS Date (approximate using 365.25 days per year)
 */
function addYears(date, years) {
  const millisPerYear = 365.25 * 24 * 60 * 60 * 1000;
  return new Date(date.getTime() + years * millisPerYear);
}

/**
 * Generate Vimshottari Maha + Antar dasha schedule (approximate, standard rules)
 */
function generateVimshottariDasha(
  normalizedDate,
  time,
  lat,
  lng,
  timezone,
  maxYears = 120
) {
  // Get birth chart so we can use Moon longitude
  const birthChart = vedicAstrology.positioner.getBirthChart(
    normalizedDate,
    time,
    lat,
    lng,
    timezone
  );
  const moonLong = birthChart.meta.Mo.longitude; // sidereal longitude 0-360

  // Determine nakshatra index and fraction elapsed
  const nakIndex = Math.floor(moonLong / NAKSHATRA_SPAN); // 0-26
  const nakStart = nakIndex * NAKSHATRA_SPAN;
  const fractionElapsed = (moonLong - nakStart) / NAKSHATRA_SPAN; // 0-1

  const nakshatra = NAKSHATRAS[nakIndex];
  const startLordIndex = VIMSHOTTARI_DASHAS.findIndex(
    (d) => d.lord === nakshatra.lord
  );
  if (startLordIndex === -1) {
    throw new Error(
      `Unknown Vimshottari lord for nakshatra ${nakshatra?.name || 'unknown'}`
    );
  }

  // Remaining years in current (birth) Maha Dasha
  const currentDasha = VIMSHOTTARI_DASHAS[startLordIndex];
  const remainingYearsCurrent = currentDasha.years * (1 - fractionElapsed);

  const startDateUtc = toUtcDate(normalizedDate, time, timezone);

  const mahaDashas = [];
  const antarDashasByMaha = [];

  let totalYears = 0;
  let currentStart = startDateUtc;
  let index = startLordIndex;
  let first = true;

  while (totalYears < maxYears) {
    const dashaInfo = VIMSHOTTARI_DASHAS[index];
    const dashaYears = first ? remainingYearsCurrent : dashaInfo.years;
    const dashaStart = currentStart;
    const dashaEnd = addYears(dashaStart, dashaYears);

    mahaDashas.push({
      lord: dashaInfo.lord,
      start: dashaStart.toISOString(),
      end: dashaEnd.toISOString(),
      years: dashaYears
    });

    // Antar dashas inside this Maha Dasha
    const antars = [];
    let antarStart = dashaStart;
    for (let i = 0; i < VIMSHOTTARI_DASHAS.length; i++) {
      const antarLordInfo =
        VIMSHOTTARI_DASHAS[(startLordIndex + i) % VIMSHOTTARI_DASHAS.length];
      const antarYears = dashaYears * (antarLordInfo.years / 120); // standard proportion
      const antarEnd = addYears(antarStart, antarYears);
      antars.push({
        mahaLord: dashaInfo.lord,
        antarLord: antarLordInfo.lord,
        start: antarStart.toISOString(),
        end: antarEnd.toISOString(),
        years: antarYears
      });
      antarStart = antarEnd;
    }
    antarDashasByMaha.push(antars);

    totalYears += dashaYears;
    currentStart = dashaEnd;
    index = (index + 1) % VIMSHOTTARI_DASHAS.length;
    first = false;
  }

  return {
    nakshatra: {
      index: nakIndex + 1,
      name: nakshatra.name,
      lord: nakshatra.lord,
      fractionElapsed
    },
    mahaDashas,
    antarDashasByMaha
  };
}

/**
 * Get all pratyantardasha (pratyadasha) segments that fall within a given birth year.
 * Birth year = from the native's birthday in that year to the day before their next birthday.
 * Each antardasha is divided into 9 pratyadashas in Vimshottari order; this returns
 * every such segment that overlaps the birth year (typically 9 segments, or more if the
 * birth year spans an antardasha boundary).
 *
 * @param {string} normalizedDate - Birth date yyyy-mm-dd
 * @param {string} time - Birth time HH:MM:SS
 * @param {number} lat - Birth latitude
 * @param {number} lng - Birth longitude
 * @param {number} timezone - Birth timezone offset (hours)
 * @param {number} year - Birth year (e.g. 2025 = from birthday in 2025 to next birthday)
 * @returns {{ year: number, pratyadashaSegments: Array<{ mahaLord, antarLord, pratyadashaLord, start, end, days }> }}
 */
function getPratyadashaForYear(normalizedDate, time, lat, lng, timezone, year) {
  // Birth-year boundaries: birthday in year (inclusive start) to birthday in year+1 (exclusive end)
  const [birthY, birthM, birthD] = normalizedDate.split('-').map(Number);
  const yearStart = toUtcDate(
    `${year}-${String(birthM).padStart(2, '0')}-${String(birthD).padStart(2, '0')}`,
    '00:00:00',
    timezone
  );
  const yearEnd = toUtcDate(
    `${year + 1}-${String(birthM).padStart(2, '0')}-${String(birthD).padStart(2, '0')}`,
    '00:00:00',
    timezone
  );
  const yearMidpoint = new Date(
    (yearStart.getTime() + yearEnd.getTime()) / 2
  );

  const yearsFromBirth = year - parseInt(normalizedDate.slice(0, 4), 10) + 2;
  const maxYears = Math.min(120, Math.max(30, yearsFromBirth));
  const { mahaDashas, antarDashasByMaha } = generateVimshottariDasha(
    normalizedDate,
    time,
    lat,
    lng,
    timezone,
    maxYears
  );

  // Find the single antardasha that contains the midpoint of the birth year
  let chosenAntar = null;
  for (let m = 0; m < mahaDashas.length; m++) {
    const antars = antarDashasByMaha[m] || [];
    for (const antar of antars) {
      const antarStart = new Date(antar.start);
      const antarEnd = new Date(antar.end);
      if (yearMidpoint >= antarStart && yearMidpoint < antarEnd) {
        chosenAntar = antar;
        break;
      }
    }
    if (chosenAntar) break;
  }

  // Strict pratyadasha: 9 sub-periods of the antardasha (proportional to lord years/120),
  // clipped to the birth year. You get 2–9 segments depending on how the year overlaps the antardasha.
  const segments = [];
  if (chosenAntar) {
    const antarYears = chosenAntar.years;
    const antarLordIndex = VIMSHOTTARI_DASHAS.findIndex(
      (d) => d.lord === chosenAntar.antarLord
    );
    if (antarLordIndex !== -1) {
      let pratyStart = new Date(chosenAntar.start);
      for (let i = 0; i < VIMSHOTTARI_DASHAS.length; i++) {
        const pratyLordInfo =
          VIMSHOTTARI_DASHAS[(antarLordIndex + i) % VIMSHOTTARI_DASHAS.length];
        const pratyYears = antarYears * (pratyLordInfo.years / 120);
        const pratyEnd = addYears(pratyStart, pratyYears);

        const segStart = pratyStart < yearStart ? yearStart : pratyStart;
        const segEnd = pratyEnd > yearEnd ? yearEnd : pratyEnd;
        if (segStart < segEnd) {
          const days =
            Math.round(
              (segEnd.getTime() - segStart.getTime()) /
                (24 * 60 * 60 * 1000)
            ) || 0;
          segments.push({
            mahaLord: chosenAntar.mahaLord,
            antarLord: chosenAntar.antarLord,
            pratyadashaLord: pratyLordInfo.lord,
            start: segStart.toISOString(),
            end: segEnd.toISOString(),
            days
          });
        }
        pratyStart = pratyEnd;
      }
    }
  }

  segments.sort((a, b) => new Date(a.start) - new Date(b.start));

  return {
    year,
    pratyadashaSegments: segments
  };
}

module.exports = {
  generateVimshottariDasha,
  getPratyadashaForYear
};


