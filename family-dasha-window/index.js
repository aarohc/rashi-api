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
  const { computeFamilyDashaWindow } = require('../familyDashaService');
  const body = parseBody(req.body);
  const { members, windowStart, windowEnd } = body;

  if (!Array.isArray(members) || !windowStart || !windowEnd) {
    context.res = {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Missing required fields: members[], windowStart, windowEnd' },
    };
    return;
  }

  if (members.length > 25) {
    context.res = {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Too many members (max 25)' },
    };
    return;
  }

  try {
    const data = computeFamilyDashaWindow({ members, windowStart, windowEnd });
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    const msg =
      error && typeof error.message === 'string' && error.message
        ? error.message
        : 'Failed to compute family dasha window';
    context.log('Error computing family dasha window:', msg);
    context.res = {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: { error: msg },
    };
  }
};
