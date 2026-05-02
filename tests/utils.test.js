const { normalizeDateToYmd, normalizeTimeToHms } = require('../utils');

describe('normalizeDateToYmd', () => {
  it('leaves ISO yyyy-mm-dd', () => {
    expect(normalizeDateToYmd('1979-10-19')).toBe('1979-10-19');
  });

  it('strips ISO datetime to yyyy-mm-dd (Mongo/JSON)', () => {
    expect(normalizeDateToYmd('1979-10-19T00:00:00.000Z')).toBe('1979-10-19');
    expect(normalizeDateToYmd('1979-10-19T05:30:00+05:30')).toBe('1979-10-19');
  });

  it('converts dd-mm-yyyy with dashes', () => {
    expect(normalizeDateToYmd('19-10-1979')).toBe('1979-10-19');
  });

  it('converts mm/dd/yyyy slashes (US)', () => {
    expect(normalizeDateToYmd('09/05/1979')).toBe('1979-09-05');
  });

  it('treats ambiguous slash dates as mm/dd when both parts ≤12', () => {
    expect(normalizeDateToYmd('05/09/1979')).toBe('1979-05-09');
  });

  it('uses dd/mm when first part > 12', () => {
    expect(normalizeDateToYmd('19/10/1979')).toBe('1979-10-19');
  });

  it('uses mm/dd when second part > 12', () => {
    expect(normalizeDateToYmd('10/19/1979')).toBe('1979-10-19');
  });
});

describe('normalizeTimeToHms', () => {
  it('adds seconds to HH:mm', () => {
    expect(normalizeTimeToHms('19:35')).toBe('19:35:00');
  });

  it('zero-pads hour in HH:mm', () => {
    expect(normalizeTimeToHms('9:05')).toBe('09:05:00');
  });

  it('leaves HH:MM:SS', () => {
    expect(normalizeTimeToHms('20:40:00')).toBe('20:40:00');
  });

  it('strips fractional seconds (Mongo / ISO)', () => {
    expect(normalizeTimeToHms('20:40:00.000')).toBe('20:40:00');
    expect(normalizeTimeToHms('09:05:30.12')).toBe('09:05:30');
  });

  it('pads single-digit seconds', () => {
    expect(normalizeTimeToHms('20:40:5')).toBe('20:40:05');
  });
});
