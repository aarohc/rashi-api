const fs = require('fs');
const path = require('path');
const vedicAstrology = require('vedic-astrology');
const { normalizeDateToYmd, normalizeTimeToHms } = require('./utils');

function numerologyPackageDir() {
  const bundled = path.join(__dirname, 'shared-numerology-core');
  if (fs.existsSync(path.join(bundled, 'index.js'))) return bundled;
  return path.join(__dirname, '../../shared/numerology-core');
}

const numerologyCore = require(numerologyPackageDir());
const compatLookup = require(path.join(numerologyPackageDir(), 'compatibility-lookup.json'));

function buildNumerologyPayload(person1, person2) {
  const ymd1 = normalizeDateToYmd(person1.date);
  const ymd2 = normalizeDateToYmd(person2.date);
  const n1 = typeof person1.name === 'string' ? person1.name.trim() : '';
  const n2 = typeof person2.name === 'string' ? person2.name.trim() : '';
  try {
    return numerologyCore.computePairNumerology(
      { dateYmd: ymd1, name: n1 },
      { dateYmd: ymd2, name: n2 },
      compatLookup
    );
  } catch (err) {
    return undefined;
  }
}

function normalizeBirthDetails(person) {
  return {
    dateString: normalizeDateToYmd(person.date),
    timeString: normalizeTimeToHms(person.time),
    lat: person.lat,
    lng: person.lng,
    timezone: person.timezone
  };
}

function interpretCompatibilityScore(totalScore, threshold = 0.4) {
  const maxScore = 30;
  const normalizedScore = totalScore / maxScore;

  let level;
  let helpText;

  if (normalizedScore < 0.4) {
    level = 'low';
    helpText =
      'Overall low compatibility (below 12/30). This tends to be a more challenging connection with significant differences in needs and temperament.';
  } else if (normalizedScore < 0.6) {
    level = 'moderate';
    helpText =
      'Moderate compatibility (around 12–18/30). There is some natural harmony, but also noticeable friction that may require conscious effort to balance.';
  } else if (normalizedScore < 0.8) {
    level = 'good';
    helpText =
      'Good compatibility (roughly 18–24/30). This is comfortably above the default threshold, suggesting a generally supportive relationship with a few growth areas.';
  } else {
    level = 'very_high';
    helpText =
      'Very high compatibility (above 24/30). This usually indicates strong mutual understanding, shared direction and a naturally supportive bond.';
  }

  return {
    normalizedScore,
    level,
    helpText,
    compatible: normalizedScore >= (threshold ?? 0.4)
  };
}

function toFiniteScore(rawScore) {
  if (typeof rawScore === 'number' && Number.isFinite(rawScore)) return rawScore;
  if (rawScore && typeof rawScore.total_score === 'number' && Number.isFinite(rawScore.total_score)) {
    return rawScore.total_score;
  }
  return 0;
}

function computeClassicalCompatibility(person1, person2, threshold) {
  const bd1 = normalizeBirthDetails(person1);
  const bd2 = normalizeBirthDetails(person2);

  const rawScore = vedicAstrology.compatibility.getCompatibilityScore(
    bd1,
    bd2
  );

  const totalScore = toFiniteScore(rawScore);
  const interpretation = interpretCompatibilityScore(totalScore, threshold);
  const details = rawScore && rawScore.interim ? rawScore.interim : [];

  // This is the currently available classical signal in the library.
  const person1BirthChart = vedicAstrology.positioner.getBirthChart(
    bd1.dateString,
    bd1.timeString,
    bd1.lat,
    bd1.lng,
    bd1.timezone
  );
  const person2BirthChart = vedicAstrology.positioner.getBirthChart(
    bd2.dateString,
    bd2.timeString,
    bd2.lat,
    bd2.lng,
    bd2.timezone
  );
  const nakshatra1 = vedicAstrology.compatibility.calculateNakshatra(person1BirthChart);
  const nakshatra2 = vedicAstrology.compatibility.calculateNakshatra(person2BirthChart);
  const yoniScore = vedicAstrology.compatibility.calculateNakshatraCompatibility(
    nakshatra1.animal,
    nakshatra2.animal
  );

  return {
    totalScore,
    normalizedScore: interpretation.normalizedScore,
    level: interpretation.level,
    helpText: interpretation.helpText,
    compatible: interpretation.compatible,
    details,
    nakshatra: {
      person1: nakshatra1,
      person2: nakshatra2,
      yoniScore
    }
  };
}

function computeCompatibility(person1, person2, threshold) {
  const classical = computeClassicalCompatibility(person1, person2, threshold);
  const numerology = buildNumerologyPayload(person1, person2);
  return {
    totalScore: classical.totalScore,
    normalizedScore: classical.normalizedScore,
    level: classical.level,
    helpText: classical.helpText,
    compatible: classical.compatible,
    details: classical.details,
    numerology
  };
}

module.exports = {
  computeCompatibility,
  computeClassicalCompatibility
};


