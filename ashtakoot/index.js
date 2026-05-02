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

// Lazy-load compatibilityService (pulls vedic-astrology) so worker can start.
module.exports = async function (context, req) {
  const { computeClassicalCompatibility } = require('../compatibilityService');
  const { person1, person2, threshold } = parseBody(req.body);

  if (!person1 || !person2) {
    context.res = {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Missing required fields: person1, person2' }
    };
    return;
  }

  const requiredFields = ['date', 'time', 'lat', 'lng', 'timezone'];
  for (const [idx, person] of [person1, person2].entries()) {
    const label = idx === 0 ? 'person1' : 'person2';
    for (const field of requiredFields) {
      if (person[field] === undefined || person[field] === null || person[field] === '') {
        context.res = {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: { error: `Missing required field for ${label}: ${field}` }
        };
        return;
      }
    }
  }

  try {
    const result = computeClassicalCompatibility(person1, person2, threshold);
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    context.log('Error computing ashtakoot compatibility:', error);
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Failed to compute ashtakoot compatibility' }
    };
  }
};
