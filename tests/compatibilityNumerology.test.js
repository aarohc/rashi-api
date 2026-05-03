'use strict';

const { computeCompatibility } = require('../compatibilityService');

describe('computeCompatibility numerology', () => {
  const base = (name1, name2) => ({
    person1: {
      date: '1990-05-15',
      time: '10:30:00',
      lat: 28.6,
      lng: 77.2,
      timezone: 5.5,
      ...(name1 != null ? { name: name1 } : {}),
    },
    person2: {
      date: '1992-08-20',
      time: '11:00:00',
      lat: 19.076,
      lng: 72.8777,
      timezone: 5.5,
      ...(name2 != null ? { name: name2 } : {}),
    },
  });

  it('includes numerology with life paths and optional names', () => {
    const p = base('Alpha', 'Beta');
    const result = computeCompatibility(p.person1, p.person2, 0.4);
    expect(result.totalScore).toBeDefined();
    expect(result.numerology).toBeDefined();
    expect(result.numerology.person1.lifePath).not.toBeNull();
    expect(result.numerology.person2.lifePath).not.toBeNull();
    expect(result.numerology.pair).not.toBeNull();
    expect(result.numerology.person1.chaldean.expression).not.toBeNull();
  });

  it('omits name-derived numbers when names missing', () => {
    const p = base(null, null);
    const result = computeCompatibility(p.person1, p.person2, 0.4);
    expect(result.numerology.person1.chaldean.expression).toBeNull();
    expect(result.numerology.person1.lifePath).not.toBeNull();
  });
});
