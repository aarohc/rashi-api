const { normalizeDateToYmd } = require('../utils');
const { computeFullRashiData } = require('../chartComputer');
const { evaluateAllYogas } = require('../yogaService');

function parseBody(raw) {
  if (raw == null) return {};
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
}

module.exports = async function (context, req) {
  const body = parseBody(req.body);
  const { date, time, lat, lng, timezone } = body;

  if (!date || !time || lat === undefined || lng === undefined || timezone === undefined) {
    context.res = {
      status: 400,
      body: {
        error: 'Missing required fields: date (YYYY-MM-DD or DD-MM-YYYY), time (HH:MM:SS), lat, lng, timezone',
      },
      headers: { 'Content-Type': 'application/json' },
    };
    return;
  }

  try {
    const normalizedDate = normalizeDateToYmd(date);
    const { rashiData } = computeFullRashiData(normalizedDate, time, lat, lng, timezone);
    const data = evaluateAllYogas(rashiData);
    context.res = {
      status: 200,
      body: {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      },
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    context.log('Error computing yogas:', error);
    context.res = {
      status: 500,
      body: { error: 'Failed to compute yogas' },
      headers: { 'Content-Type': 'application/json' },
    };
  }
};
