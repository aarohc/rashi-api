const { generateVimshottariDasha } = require('../vimshottariService');
const { normalizeDateToYmd } = require('../utils');

module.exports = async function (context, req) {
  const { date, time, lat, lng, timezone, maxYears } = req.body;

  if (!date || !time || lat === undefined || lng === undefined || timezone === undefined) {
    context.res = {
      status: 400,
      body: {
        error: 'Missing required fields: date (YYYY-MM-DD or DD-MM-YYYY), time (HH:MM:SS), lat, lng, timezone'
      }
    };
    return;
  }

  try {
    // Normalize date format to yyyy-mm-dd
    const normalizedDate = normalizeDateToYmd(date);

    const dashaData = generateVimshottariDasha(normalizedDate, time, lat, lng, timezone, maxYears || 120);

    context.res = {
      status: 200,
      body: {
        success: true,
        data: dashaData,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    context.log('Error computing Vimshottari dasha:', error);
    context.res = {
      status: 500,
      body: { error: 'Failed to compute Vimshottari dasha' }
    };
  }
};

