const vedicAstrology = require('vedic-astrology');
const { generateHoroscopeSVG } = require('../horoscopeGenerator');

module.exports = async function (context, req) {
  const { date, time, lat, lng, timezone, size, chartType } = req.body;

  // Validation
  if (!date || !time || lat === undefined || lng === undefined || timezone === undefined) {
    context.res = {
      status: 400,
      body: { error: 'Missing required fields: date (dd-mm-yyyy), time (HH:MM:SS), lat, lng, timezone' }
    };
    return;
  }

  try {
    // Compute birth chart using vedic-astrology
    const birthChart = vedicAstrology.positioner.getBirthChart(date, time, lat, lng, timezone);

    // Map Rashi codes to sign numbers (1-12)
    const rashiToNumber = {
      'Ar': 1, 'Ta': 2, 'Ge': 3, 'Cn': 4, 'Le': 5, 'Vi': 6,
      'Li': 7, 'Sc': 8, 'Sg': 9, 'Cp': 10, 'Aq': 11, 'Pi': 12
    };

    // Helper function to calculate house number
    const calculateHouseNumber = (planetLongitude, lagnaLongitude) => {
      let diff = planetLongitude - lagnaLongitude;
      if (diff < 0) diff += 360;
      const houseNumber = Math.floor(diff / 30) + 1;
      return houseNumber > 12 ? houseNumber - 12 : houseNumber;
    };

    const lagnaLongitude = birthChart.meta.La.longitude;

    // Transform data to match rasi1.json format
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
      }
    };

    // Generate SVG
    const svg = generateHoroscopeSVG(rashiData, birthChart, {
      size: size || 800,
      chartType: chartType || 'north-indian'
    });

    // Check if client wants JSON or SVG directly
    const acceptHeader = req.headers?.accept || '';
    if (acceptHeader.includes('application/json')) {
      context.res = {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          success: true,
          svg: svg,
          format: 'svg'
        }
      };
    } else {
      context.res = {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml'
        },
        body: svg
      };
    }
  } catch (error) {
    context.log('Error generating horoscope:', error);
    context.res = {
      status: 500,
      body: { error: 'Failed to generate horoscope chart' }
    };
  }
};

