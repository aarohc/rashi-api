const vedicAstrology = require('vedic-astrology');
const swisseph = require('swisseph-v2');
const { normalizeDateToYmd } = require('../utils');

module.exports = async function (context, req) {
  const { date, time, lat, lng, timezone } = req.body;

  // Validation
  if (!date || !time || lat === undefined || lng === undefined || timezone === undefined) {
    context.res = {
      status: 400,
      body: { error: 'Missing required fields: date (YYYY-MM-DD or DD-MM-YYYY), time (HH:MM:SS), lat, lng, timezone' }
    };
    return;
  }

  try {
    // Normalize date format to yyyy-mm-dd (vedic-astrology expects this format)
    const normalizedDate = normalizeDateToYmd(date);

    // Compute birth chart using vedic-astrology
    const birthChart = vedicAstrology.positioner.getBirthChart(normalizedDate, time, lat, lng, timezone);

    // Map Rashi codes to sign numbers (1-12)
    const rashiToNumber = {
      'Ar': 1,  // Aries
      'Ta': 2,  // Taurus
      'Ge': 3,  // Gemini
      'Cn': 4,  // Cancer
      'Le': 5,  // Leo
      'Vi': 6,  // Virgo
      'Li': 7,  // Libra
      'Sc': 8,  // Scorpio
      'Sg': 9,  // Sagittarius
      'Cp': 10, // Capricorn
      'Aq': 11, // Aquarius
      'Pi': 12  // Pisces
    };

    // Helper function to calculate house number from planet longitude and Lagna (1-12)
    const calculateHouseNumber = (planetLongitude, lagnaLongitude) => {
      let diff = planetLongitude - lagnaLongitude;
      if (diff < 0) diff += 360;
      const houseNumber = Math.floor(diff / 30) + 1;
      return houseNumber > 12 ? houseNumber - 12 : houseNumber;
    };

    const lagnaLongitude = birthChart.meta.La.longitude;

    // Helper function to calculate outer planets (Uranus, Neptune, Pluto) using swisseph
    // Returns longitude for house calculation; not provided by vedic-astrology
    const calculateOuterPlanet = (planetNum, normalizedDate, time, timezone) => {
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
        const jd = swisseph.swe_julday(year, month, utcDay, utcHours + minutes/60 + seconds/3600, 1);
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
          longitude: normalizedLong
        };
      } catch (error) {
        context.log(`Error calculating outer planet ${planetNum}:`, error);
        return { current_sign: 0, isRetro: "false", longitude: 0 };
      }
    };

    const uranusData = calculateOuterPlanet(7, normalizedDate, time, timezone);
    const neptuneData = calculateOuterPlanet(8, normalizedDate, time, timezone);
    const plutoData = calculateOuterPlanet(9, normalizedDate, time, timezone);

    // Transform data to match rashi.json format (with house_number for generic predictions)
    const rashiData = {
      Ascendant: {
        current_sign: rashiToNumber[birthChart.meta.La.rashi] || 0,
        isRetro: String(birthChart.meta.La.isRetrograde || false)
      },
      Sun: {
        current_sign: rashiToNumber[birthChart.meta.Su.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Su.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Su.isRetrograde || false)
      },
      Moon: {
        current_sign: rashiToNumber[birthChart.meta.Mo.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Mo.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Mo.isRetrograde || false)
      },
      Mars: {
        current_sign: rashiToNumber[birthChart.meta.Ma.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Ma.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Ma.isRetrograde || false)
      },
      Mercury: {
        current_sign: rashiToNumber[birthChart.meta.Me.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Me.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Me.isRetrograde || false)
      },
      Jupiter: {
        current_sign: rashiToNumber[birthChart.meta.Ju.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Ju.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Ju.isRetrograde || false)
      },
      Venus: {
        current_sign: rashiToNumber[birthChart.meta.Ve.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Ve.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Ve.isRetrograde || false)
      },
      Saturn: {
        current_sign: rashiToNumber[birthChart.meta.Sa.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Sa.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Sa.isRetrograde || false)
      },
      Rahu: {
        current_sign: rashiToNumber[birthChart.meta.Ra.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Ra.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Ra.isRetrograde || false)
      },
      Ketu: {
        current_sign: rashiToNumber[birthChart.meta.Ke.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Ke.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Ke.isRetrograde || false)
      },
      Uranus: {
        current_sign: uranusData.current_sign,
        house_number: calculateHouseNumber(uranusData.longitude, lagnaLongitude),
        isRetro: uranusData.isRetro
      },
      Neptune: {
        current_sign: neptuneData.current_sign,
        house_number: calculateHouseNumber(neptuneData.longitude, lagnaLongitude),
        isRetro: neptuneData.isRetro
      },
      Pluto: {
        current_sign: plutoData.current_sign,
        house_number: calculateHouseNumber(plutoData.longitude, lagnaLongitude),
        isRetro: plutoData.isRetro
      }
    };

    context.res = {
      status: 200,
      body: {
        success: true,
        data: rashiData,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    context.log('Error computing Rashi:', error);
    context.res = {
      status: 500,
      body: { error: 'Failed to compute Rashi data' }
    };
  }
};

