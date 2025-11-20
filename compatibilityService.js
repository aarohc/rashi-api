const vedicAstrology = require('vedic-astrology');
const { normalizeDateToYmd } = require('./utils');

function normalizeBirthDetails(person) {
  return {
    dateString: normalizeDateToYmd(person.date),
    timeString: person.time,
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

function computeCompatibility(person1, person2, threshold) {
  const bd1 = normalizeBirthDetails(person1);
  const bd2 = normalizeBirthDetails(person2);

  const rawScore = vedicAstrology.compatibility.getCompatibilityScore(
    bd1,
    bd2,
    threshold
  );

  const totalScore = rawScore.total_score ?? rawScore;
  const interpretation = interpretCompatibilityScore(totalScore, threshold);

  return {
    totalScore,
    normalizedScore: interpretation.normalizedScore,
    level: interpretation.level,
    helpText: interpretation.helpText,
    compatible: interpretation.compatible,
    details: rawScore.interim ?? []
  };
}

module.exports = {
  computeCompatibility
};


