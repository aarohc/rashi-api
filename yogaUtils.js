/**
 * House lords from Ascendant (whole-sign). Aligns with cosmicconnect-api houseLordsService.
 */

const path = require('path');
const fs = require('fs');

const REF_PATH = path.join(__dirname, 'data', 'yoga-reference.json');

function loadYogaReference() {
  return JSON.parse(fs.readFileSync(REF_PATH, 'utf8'));
}

/**
 * Sign (1–12) on house H from Ascendant. House 1 = Lagna sign.
 */
function rashiOfHouse(ascendantSign, houseNumber) {
  if (ascendantSign < 1 || ascendantSign > 12 || houseNumber < 1 || houseNumber > 12) {
    return 1;
  }
  const rashi = ((ascendantSign + houseNumber - 2) % 12) + 1;
  return rashi >= 1 && rashi <= 12 ? rashi : ((rashi + 11) % 12) + 1;
}

/**
 * @param {number} ascendantSign 1–12
 * @returns {Record<number, string>} house 1–12 → lord planet name
 */
function getHouseLordsFromAscendant(ascendantSign, referenceData) {
  const signLordship = referenceData.signLordship;
  const lords = {};
  for (let h = 1; h <= 12; h++) {
    const sign = rashiOfHouse(ascendantSign, h);
    const lord = signLordship[String(sign)];
    if (lord) lords[h] = lord;
  }
  return lords;
}

/**
 * @param {object} rashiData same shape as /api/rashi
 * @returns {Record<number, string>|null}
 */
function getHouseLords(rashiData, referenceData) {
  if (!rashiData || typeof rashiData !== 'object') return null;
  const raw = rashiData.Ascendant?.current_sign;
  const asc = typeof raw === 'number' ? raw : Number(raw);
  if (Number.isNaN(asc) || asc < 1 || asc > 12) return null;
  return getHouseLordsFromAscendant(asc, referenceData);
}

/** Sign counted from Moon sign as house 1 (1–12). */
function signFromMoon(moonSign, houseFromMoon) {
  if (moonSign < 1 || moonSign > 12 || houseFromMoon < 1 || houseFromMoon > 12) return 1;
  return ((moonSign + houseFromMoon - 2) % 12) + 1;
}

function isKendraFromMoon(moonSign, planetSign) {
  const k = [1, 4, 7, 10];
  return k.some((h) => signFromMoon(moonSign, h) === planetSign);
}

module.exports = {
  loadYogaReference,
  rashiOfHouse,
  getHouseLordsFromAscendant,
  getHouseLords,
  signFromMoon,
  isKendraFromMoon,
  REF_PATH,
};
