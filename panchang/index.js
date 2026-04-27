const { normalizeDateToYmd } = require('../utils');

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
  const { lat, lng, timezone, date } = body;

  if (lat === undefined || lng === undefined || timezone === undefined || !date) {
    context.res = {
      status: 400,
      body: {
        error: 'Missing required fields: lat, lng, timezone, date (YYYY-MM-DD or DD-MM-YYYY)',
      },
      headers: { 'Content-Type': 'application/json' },
    };
    return;
  }

  try {
    // Lazy-load because Panchang pulls native ephemeris dependencies used only by this endpoint.
    const { computePanchangDay } = require('../panchangService');
    const normalizedDate = normalizeDateToYmd(date);
    const raw = computePanchangDay({ lat, lng, timezone, date: normalizedDate });

    context.res = {
      status: 200,
      body: {
        success: true,
        data: {
          location: { lat, lng, timezone },
          ...raw,
        },
        timestamp: new Date().toISOString(),
      },
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    context.log('Error computing Panchang:', error);
    if (error.code === 'NO_RISE_SET' || error.code === 'EPHEMERIS') {
      context.res = {
        status: 422,
        body: { error: error.message || 'Could not compute sunrise or sunset for this location' },
        headers: { 'Content-Type': 'application/json' },
      };
      return;
    }
    if (error.message && /Invalid|format|required/i.test(error.message)) {
      context.res = {
        status: 400,
        body: { error: error.message },
        headers: { 'Content-Type': 'application/json' },
      };
      return;
    }
    context.res = {
      status: 500,
      body: { error: 'Failed to compute Panchang' },
      headers: { 'Content-Type': 'application/json' },
    };
  }
};
