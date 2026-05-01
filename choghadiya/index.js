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
  const { computeChoghadiya } = require('../choghadiyaService');
  const body = parseBody(req.body);
  const { lat, lng, timezone, date, time } = body;

  if (lat === undefined || lng === undefined || timezone === undefined) {
    context.res = {
      status: 400,
      body: { error: 'Missing required fields: lat, lng, timezone' }
    };
    return;
  }

  try {
    const raw = computeChoghadiya({ lat, lng, timezone, date, time });
    context.res = {
      status: 200,
      body: {
        success: true,
        data: {
          location: { lat, lng, timezone },
          ...raw
        },
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    context.log('Error computing Choghadiya:', error);
    const message = error && error.message ? String(error.message) : 'Failed to compute Choghadiya';
    const status = error && (error.code === 'NO_RISE_SET' || error.code === 'EPHEMERIS')
      ? 422
      : /Invalid|format|required/i.test(message)
        ? 400
        : 500;
    context.res = {
      status,
      body: { error: status === 500 ? 'Failed to compute Choghadiya' : message }
    };
  }
};
