// Lazy-load compatibilityService (pulls vedic-astrology) so worker can start
module.exports = async function (context, req) {
  const { computeCompatibility } = require('../compatibilityService');
  const { person1, person2, threshold } = req.body || {};

  if (!person1 || !person2) {
    context.res = {
      status: 400,
      body: { error: 'Missing required fields: person1, person2' }
    };
    return;
  }

  const requiredFields = ['date', 'time', 'lat', 'lng', 'timezone'];
  for (const [idx, person] of [person1, person2].entries()) {
    const label = idx === 0 ? 'person1' : 'person2';
    for (const f of requiredFields) {
      if (person[f] === undefined || person[f] === null || person[f] === '') {
        context.res = {
          status: 400,
          body: { error: `Missing required field for ${label}: ${f}` }
        };
        return;
      }
    }
  }

  try {
    const result = computeCompatibility(person1, person2, threshold);

    context.res = {
      status: 200,
      body: {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    context.log('Error computing compatibility:', error);
    context.res = {
      status: 500,
      body: { error: 'Failed to compute compatibility' }
    };
  }
};

