// Lazy-load vimshottariService (pulls vedic-astrology) so worker can start.
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
  const { getMuddaDashaForYear } = require('../vimshottariService');
  const body = parseBody(req.body);
  const { date, time, lat, lng, timezone, year } = body;

  if (!date || !time || lat === undefined || lng === undefined || timezone === undefined || year === undefined) {
    context.res = {
      status: 400,
      body: {
        error: 'Missing required fields: date (YYYY-MM-DD or DD-MM-YYYY), time (HH:MM:SS), lat, lng, timezone, year'
      }
    };
    return;
  }

  const yearNum = typeof year === 'string' ? parseInt(year, 10) : year;
  if (Number.isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
    context.res = {
      status: 400,
      body: { error: 'Invalid year: must be an integer between 1900 and 2100' }
    };
    return;
  }

  try {
    const normalizedDate = normalizeDateToYmd(date);
    const muddaData = getMuddaDashaForYear(
      normalizedDate,
      time,
      lat,
      lng,
      timezone,
      yearNum
    );

    context.res = {
      status: 200,
      body: {
        success: true,
        data: muddaData,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    const detail =
      (error && typeof error.message === 'string' && error.message) ||
      (error && String(error)) ||
      'Unknown error';
    const status = /before birth|Invalid/i.test(String(detail)) ? 400 : 500;
    const errorPayload = {
      error: status === 400 ? String(detail) : 'Failed to compute mudda-dasha',
      detail: String(detail)
    };
    context.log('Error computing mudda-dasha:', JSON.stringify(errorPayload));
    context.res = {
      status,
      headers: { 'Content-Type': 'application/json' },
      body: errorPayload
    };
  }
};
