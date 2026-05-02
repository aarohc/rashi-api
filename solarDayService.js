/**
 * Shared solar day helpers: Julian day, Swiss Ephemeris sunrise/sunset.
 * Used by choghadiyaService and panchangService.
 */

const path = require('path');
const swisseph = require('swisseph-v2');

let ephePathInitialized = false;

function ensureEphePath() {
  if (ephePathInitialized) return;
  const ephe = path.join(__dirname, 'node_modules', 'swisseph-v2', 'ephe');
  swisseph.swe_set_ephe_path(ephe);
  ephePathInitialized = true;
}

function jdToUnixMs(jdUt) {
  return (jdUt - 2440587.5) * 86400000;
}

function jdToIsoUtc(jdUt) {
  return new Date(jdToUnixMs(jdUt)).toISOString();
}

function isoUtcToJd(iso) {
  return Date.parse(iso) / 86400000 + 2440587.5;
}

/** Civil y-m-d at 00:00 in fixed-offset zone (hours east of UTC) → Julian day UT */
function localMidnightJdUt(year, month, day, timezoneHours) {
  const ms = Date.UTC(year, month - 1, day, 0, 0, 0) - timezoneHours * 3600000;
  const u = new Date(ms);
  const uy = u.getUTCFullYear();
  const um = u.getUTCMonth() + 1;
  const ud = u.getUTCDate();
  const uh =
    u.getUTCHours() +
    u.getUTCMinutes() / 60 +
    u.getUTCSeconds() / 3600 +
    u.getUTCMilliseconds() / 3600000;
  return swisseph.swe_julday(uy, um, ud, uh, swisseph.SE_GREG_CAL);
}

function gregorianWeekdaySun0(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

function addCalendarDays(year, month, day, delta) {
  const ms = Date.UTC(year, month - 1, day, 12, 0, 0) + delta * 86400000;
  const u = new Date(ms);
  return { year: u.getUTCFullYear(), month: u.getUTCMonth() + 1, day: u.getUTCDate() };
}

function localWallTimeFromUtcNow(timezoneHours) {
  const ms = Date.now() + timezoneHours * 3600000;
  const w = new Date(ms);
  return {
    year: w.getUTCFullYear(),
    month: w.getUTCMonth() + 1,
    day: w.getUTCDate(),
    hour: w.getUTCHours(),
    minute: w.getUTCMinutes(),
    second: w.getUTCSeconds(),
  };
}

function parseTimeHms(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.trim().split(':').map(Number);
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
  return {
    hour: parts[0],
    minute: parts[1] ?? 0,
    second: parts[2] ?? 0,
  };
}

function localDateTimeToJdUt(year, month, day, hour, minute, second, timezoneHours) {
  const ms =
    Date.UTC(year, month - 1, day, hour, minute, second) - timezoneHours * 3600000;
  const u = new Date(ms);
  const uy = u.getUTCFullYear();
  const um = u.getUTCMonth() + 1;
  const ud = u.getUTCDate();
  const uh = u.getUTCHours() + u.getUTCMinutes() / 60 + u.getUTCSeconds() / 3600;
  return swisseph.swe_julday(uy, um, ud, uh, swisseph.SE_GREG_CAL);
}

function sweRiseTrans(jdUtStart, ipl, rsmi, lng, lat, heightM = 0) {
  ensureEphePath();
  const flag = swisseph.SEFLG_SWIEPH;
  const atpress = 1013.25;
  const attemp = 10;
  const res = swisseph.swe_rise_trans(
    jdUtStart,
    ipl,
    '',
    flag,
    rsmi,
    lng,
    lat,
    heightM,
    atpress,
    attemp
  );
  if (res.error) {
    const err = new Error(res.error);
    err.code = 'EPHEMERIS';
    throw err;
  }
  if (res.transitTime === -2 || res.transitTime === undefined || Number.isNaN(res.transitTime)) {
    const err = new Error('Sunrise or sunset not found for this location (circumpolar or extreme latitude)');
    err.code = 'NO_RISE_SET';
    throw err;
  }
  return res.transitTime;
}

function sunriseForDate(year, month, day, lng, lat, timezoneHours) {
  const jd0 = localMidnightJdUt(year, month, day, timezoneHours);
  return sweRiseTrans(jd0, swisseph.SE_SUN, swisseph.SE_CALC_RISE, lng, lat);
}

function sunsetForDate(year, month, day, lng, lat, timezoneHours) {
  const jd0 = localMidnightJdUt(year, month, day, timezoneHours);
  return sweRiseTrans(jd0, swisseph.SE_SUN, swisseph.SE_CALC_SET, lng, lat);
}

function nextSunriseAfter(jdUtAfter, lng, lat) {
  return sweRiseTrans(jdUtAfter + 1 / 86400, swisseph.SE_SUN, swisseph.SE_CALC_RISE, lng, lat);
}

module.exports = {
  ensureEphePath,
  jdToUnixMs,
  jdToIsoUtc,
  isoUtcToJd,
  localMidnightJdUt,
  gregorianWeekdaySun0,
  addCalendarDays,
  localWallTimeFromUtcNow,
  parseTimeHms,
  localDateTimeToJdUt,
  sweRiseTrans,
  sunriseForDate,
  sunsetForDate,
  nextSunriseAfter,
};
