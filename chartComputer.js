/**
 * Shared birth chart → rashiData (sign, house, retrograde) for rashi-api routes.
 * Keeps Lahiri sidereal + whole-sign houses aligned with /api/rashi.
 */

const vedicAstrology = require('vedic-astrology');
const swisseph = require('swisseph-v2');

const RASHI_TO_NUMBER = {
  Ar: 1,
  Ta: 2,
  Ge: 3,
  Cn: 4,
  Le: 5,
  Vi: 6,
  Li: 7,
  Sc: 8,
  Sg: 9,
  Cp: 10,
  Aq: 11,
  Pi: 12,
};

function calculateHouseNumber(planetLongitude, lagnaLongitude) {
  let diff = planetLongitude - lagnaLongitude;
  if (diff < 0) diff += 360;
  const houseNumber = Math.floor(diff / 30) + 1;
  return houseNumber > 12 ? houseNumber - 12 : houseNumber;
}

function calculateOuterPlanet(planetNum, normalizedDate, time, timezone) {
  try {
    const [year, month, day] = normalizedDate.split('-').map(Number);
    const [hours, minutes, seconds] = time.split(':').map(Number);

    let utcHours = hours - timezone;
    let utcDay = day;
    if (utcHours < 0) {
      utcHours += 24;
      utcDay--;
    } else if (utcHours >= 24) {
      utcHours -= 24;
      utcDay++;
    }

    const jd = swisseph.swe_julday(
      year,
      month,
      utcDay,
      utcHours + minutes / 60 + seconds / 3600,
      1
    );
    swisseph.swe_set_sid_mode(1);
    const ayanamsha = swisseph.swe_get_ayanamsa_ut(jd);
    const result = swisseph.swe_calc_ut(jd, planetNum, 0);
    const tropicalLong = result.longitude;
    const siderealLong = tropicalLong - ayanamsha;
    const normalizedLong = siderealLong < 0 ? siderealLong + 360 : siderealLong;
    const sign = Math.floor(normalizedLong / 30) + 1;
    const isRetro = result.longitudeSpeed < 0;

    return {
      current_sign: sign,
      isRetro: String(isRetro),
      longitude: normalizedLong,
    };
  } catch (error) {
    console.error(`Error calculating outer planet ${planetNum}:`, error);
    return {
      current_sign: 0,
      isRetro: 'false',
      longitude: 0,
    };
  }
}

/**
 * @param {string} normalizedDate yyyy-mm-dd
 * @param {string} time HH:MM:SS
 */
function computeFullRashiData(normalizedDate, time, lat, lng, timezone) {
  const birthChart = vedicAstrology.positioner.getBirthChart(
    normalizedDate,
    time,
    lat,
    lng,
    timezone
  );

  const lagnaLongitude = birthChart.meta.La.longitude;

  const uranusData = calculateOuterPlanet(7, normalizedDate, time, timezone);
  const neptuneData = calculateOuterPlanet(8, normalizedDate, time, timezone);
  const plutoData = calculateOuterPlanet(9, normalizedDate, time, timezone);

  const rashiData = {
    Ascendant: {
      current_sign: RASHI_TO_NUMBER[birthChart.meta.La.rashi] || 0,
      isRetro: String(birthChart.meta.La.isRetrograde || false),
    },
    Sun: {
      current_sign: RASHI_TO_NUMBER[birthChart.meta.Su.rashi] || 0,
      house_number: calculateHouseNumber(birthChart.meta.Su.longitude, lagnaLongitude),
      isRetro: String(birthChart.meta.Su.isRetrograde || false),
    },
    Moon: {
      current_sign: RASHI_TO_NUMBER[birthChart.meta.Mo.rashi] || 0,
      house_number: calculateHouseNumber(birthChart.meta.Mo.longitude, lagnaLongitude),
      isRetro: String(birthChart.meta.Mo.isRetrograde || false),
    },
    Mars: {
      current_sign: RASHI_TO_NUMBER[birthChart.meta.Ma.rashi] || 0,
      house_number: calculateHouseNumber(birthChart.meta.Ma.longitude, lagnaLongitude),
      isRetro: String(birthChart.meta.Ma.isRetrograde || false),
    },
    Mercury: {
      current_sign: RASHI_TO_NUMBER[birthChart.meta.Me.rashi] || 0,
      house_number: calculateHouseNumber(birthChart.meta.Me.longitude, lagnaLongitude),
      isRetro: String(birthChart.meta.Me.isRetrograde || false),
    },
    Jupiter: {
      current_sign: RASHI_TO_NUMBER[birthChart.meta.Ju.rashi] || 0,
      house_number: calculateHouseNumber(birthChart.meta.Ju.longitude, lagnaLongitude),
      isRetro: String(birthChart.meta.Ju.isRetrograde || false),
    },
    Venus: {
      current_sign: RASHI_TO_NUMBER[birthChart.meta.Ve.rashi] || 0,
      house_number: calculateHouseNumber(birthChart.meta.Ve.longitude, lagnaLongitude),
      isRetro: String(birthChart.meta.Ve.isRetrograde || false),
    },
    Saturn: {
      current_sign: RASHI_TO_NUMBER[birthChart.meta.Sa.rashi] || 0,
      house_number: calculateHouseNumber(birthChart.meta.Sa.longitude, lagnaLongitude),
      isRetro: String(birthChart.meta.Sa.isRetrograde || false),
    },
    Rahu: {
      current_sign: RASHI_TO_NUMBER[birthChart.meta.Ra.rashi] || 0,
      house_number: calculateHouseNumber(birthChart.meta.Ra.longitude, lagnaLongitude),
      isRetro: String(birthChart.meta.Ra.isRetrograde || false),
    },
    Ketu: {
      current_sign: RASHI_TO_NUMBER[birthChart.meta.Ke.rashi] || 0,
      house_number: calculateHouseNumber(birthChart.meta.Ke.longitude, lagnaLongitude),
      isRetro: String(birthChart.meta.Ke.isRetrograde || false),
    },
    Uranus: {
      current_sign: uranusData.current_sign,
      house_number: calculateHouseNumber(uranusData.longitude, lagnaLongitude),
      isRetro: uranusData.isRetro,
    },
    Neptune: {
      current_sign: neptuneData.current_sign,
      house_number: calculateHouseNumber(neptuneData.longitude, lagnaLongitude),
      isRetro: neptuneData.isRetro,
    },
    Pluto: {
      current_sign: plutoData.current_sign,
      house_number: calculateHouseNumber(plutoData.longitude, lagnaLongitude),
      isRetro: plutoData.isRetro,
    },
  };

  return { birthChart, rashiData, lagnaLongitude };
}

module.exports = {
  computeFullRashiData,
  calculateHouseNumber,
  RASHI_TO_NUMBER,
};
