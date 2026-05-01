const {
  phaseKeyFromOffset,
  computeShaniMoonTransit,
  currentPhaseAt
} = require('./shaniMoonTransitService');

describe('shaniMoonTransitService', () => {
  it('maps whole-sign offsets to phase keys', () => {
    expect(phaseKeyFromOffset(11)).toBe('sade_sati_12th');
    expect(phaseKeyFromOffset(0)).toBe('sade_sati_1st');
    expect(phaseKeyFromOffset(1)).toBe('sade_sati_2nd');
    expect(phaseKeyFromOffset(3)).toBe('dhaiya_4th');
    expect(phaseKeyFromOffset(7)).toBe('dhaiya_8th');
    expect(phaseKeyFromOffset(2)).toBe('none');
    expect(phaseKeyFromOffset(5)).toBe('none');
  });

  it('returns ordered segments for a sample window', () => {
    const birth = {
      date: '1985-03-20',
      time: '10:30:00',
      lat: 19.076,
      lng: 72.8777,
      timezone: 5.5
    };
    const out = computeShaniMoonTransit({
      ...birth,
      windowStart: '2020-01-01',
      windowEnd: '2025-12-31'
    });
    expect(out.moonSignIndex).toBeGreaterThanOrEqual(0);
    expect(out.moonSignIndex).toBeLessThanOrEqual(11);
    for (const seg of out.segments) {
      expect(new Date(seg.start).getTime()).toBeLessThan(new Date(seg.end).getTime());
      expect([
        'sade_sati_12th',
        'sade_sati_1st',
        'sade_sati_2nd',
        'dhaiya_4th',
        'dhaiya_8th'
      ]).toContain(seg.phaseKey);
    }
    const cur = currentPhaseAt(birth);
    expect(cur.phaseKey).toBeTruthy();
    expect(cur.moonSignName).toBeTruthy();
    expect(cur.saturnSignName).toBeTruthy();
  });
});
