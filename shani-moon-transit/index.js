const { normalizeDateToYmd } = require('../utils');
const { computeShaniMoonTransit, currentPhaseAt } = require('../shaniMoonTransitService');

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
  const body = parseBody(req.body);
  const { date, time, lat, lng, timezone, windowStart, windowEnd } = body;

  if (
    !date ||
    !time ||
    lat === undefined ||
    lng === undefined ||
    timezone === undefined ||
    !windowStart ||
    !windowEnd
  ) {
    context.res = {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        error:
          'Missing required fields: date, time, lat, lng, timezone, windowStart, windowEnd (window dates as yyyy-mm-dd)'
      }
    };
    return;
  }

  try {
    const normalizedDate = normalizeDateToYmd(date);

    const ws = String(windowStart).slice(0, 10);
    const we = String(windowEnd).slice(0, 10);

    const data = computeShaniMoonTransit({
      date: normalizedDate,
      time,
      lat: Number(lat),
      lng: Number(lng),
      timezone: Number(timezone),
      windowStart: ws,
      windowEnd: we
    });

    const nowInfo = currentPhaseAt({
      date: normalizedDate,
      time,
      lat: Number(lat),
      lng: Number(lng),
      timezone: Number(timezone)
    });

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        success: true,
        data: {
          ...data,
          currentPhase: nowInfo
        },
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    const msg = error && error.message ? String(error.message) : 'Failed to compute shani-moon-transit';
    const status = /windowStart|before/i.test(msg) ? 400 : 500;
    context.log('Error computing shani-moon-transit:', msg);
    context.res = {
      status,
      headers: { 'Content-Type': 'application/json' },
      body: status === 400 ? { error: msg } : { error: 'Failed to compute shani-moon-transit', detail: msg }
    };
  }
};
