const { normalizeDateToYmd } = require('../utils');

function parseBody(raw) {
  if (raw == null) return {};
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch (e) {
      return {};
    }
  }
  return {};
}

module.exports = async function (context, req) {
  const { computeFullRashiData } = require('../chartComputer');
  const { calculatePlanetAspects } = require('../aspectsService');
  const body = parseBody(req.body);
  const { date, time, lat, lng, timezone } = body;

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
    const normalizedDate = normalizeDateToYmd(date);
    const { rashiData } = computeFullRashiData(normalizedDate, time, lat, lng, timezone);
    const aspectData = calculatePlanetAspects(rashiData);
    context.res = {
      status: 200,
      body: {
        success: true,
        data: aspectData,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    context.log('Error computing planet aspects:', error);
    context.res = {
      status: 500,
      body: { error: 'Failed to compute planet aspects' }
    };
  }
};
