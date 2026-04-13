const {
  detectMahapurushaYogas,
  detectLunarYogas,
  detectSolarYogas,
  detectRajaYogas,
  detectDhanaYogas,
  evaluateAllYogas,
} = require('../yogaService');
const { calculatePlanetAspects } = require('../aspectsService');
const { loadYogaReference } = require('../yogaUtils');

const ref = loadYogaReference();

function baseRashi(overrides = {}) {
  const d = {
    Ascendant: { current_sign: 1, isRetro: 'false' },
    Sun: { current_sign: 5, house_number: 5, isRetro: 'false' },
    Moon: { current_sign: 2, house_number: 2, isRetro: 'false' },
    Mars: { current_sign: 3, house_number: 3, isRetro: 'false' },
    Mercury: { current_sign: 4, house_number: 4, isRetro: 'false' },
    Jupiter: { current_sign: 6, house_number: 6, isRetro: 'false' },
    Venus: { current_sign: 7, house_number: 7, isRetro: 'false' },
    Saturn: { current_sign: 8, house_number: 8, isRetro: 'false' },
    Rahu: { current_sign: 9, house_number: 9, isRetro: 'false' },
    Ketu: { current_sign: 3, house_number: 3, isRetro: 'false' },
    Uranus: { current_sign: 10, house_number: 10, isRetro: 'false' },
    Neptune: { current_sign: 11, house_number: 11, isRetro: 'false' },
    Pluto: { current_sign: 12, house_number: 12, isRetro: 'false' },
  };
  return { ...d, ...overrides };
}

describe('detectMahapurushaYogas', () => {
  it('detects Hamsa when Jupiter exalted in Kendra', () => {
    const rashi = baseRashi({
      Ascendant: { current_sign: 1, isRetro: 'false' },
      Jupiter: { current_sign: 4, house_number: 1, isRetro: 'false' },
    });
    const yogas = detectMahapurushaYogas(rashi, ref);
    const hamsa = yogas.find((y) => y.name === 'Hamsa');
    expect(hamsa).toBeDefined();
    expect(hamsa.isExalted).toBe(true);
  });

  it('returns empty when no Mahapurusha', () => {
    const rashi = baseRashi({
      Jupiter: { current_sign: 4, house_number: 3, isRetro: 'false' },
    });
    const yogas = detectMahapurushaYogas(rashi, ref);
    expect(yogas.filter((y) => y.name === 'Hamsa')).toHaveLength(0);
  });
});

describe('detectLunarYogas', () => {
  it('detects Kemadruma when flanks empty', () => {
    const rashi = baseRashi({
      Moon: { current_sign: 6, house_number: 6, isRetro: 'false' },
      Sun: { current_sign: 1, house_number: 1, isRetro: 'false' },
      Mars: { current_sign: 8, house_number: 8, isRetro: 'false' },
      Mercury: { current_sign: 9, house_number: 9, isRetro: 'false' },
      Jupiter: { current_sign: 10, house_number: 10, isRetro: 'false' },
      Venus: { current_sign: 11, house_number: 11, isRetro: 'false' },
      Saturn: { current_sign: 12, house_number: 12, isRetro: 'false' },
    });
    const yogas = detectLunarYogas(rashi);
    expect(yogas.some((y) => y.name === 'Kemadruma')).toBe(true);
  });

  it('detects Chandra-Mangal when Moon and Mars conjoin', () => {
    const rashi = baseRashi({
      Moon: { current_sign: 5, house_number: 5, isRetro: 'false' },
      Mars: { current_sign: 5, house_number: 5, isRetro: 'false' },
    });
    const yogas = detectLunarYogas(rashi);
    expect(yogas.some((y) => y.name === 'Chandra-Mangal')).toBe(true);
  });
});

describe('detectSolarYogas', () => {
  it('detects Budhaditya when Sun and Mercury share a sign', () => {
    const rashi = baseRashi({
      Sun: { current_sign: 5, house_number: 5, isRetro: 'false' },
      Mercury: { current_sign: 5, house_number: 5, isRetro: 'false' },
    });
    const yogas = detectSolarYogas(rashi);
    expect(yogas.some((y) => y.name === 'Budhaditya')).toBe(true);
  });
});

describe('evaluateAllYogas', () => {
  it('returns yogas array and summary', () => {
    const rashi = baseRashi();
    const { yogas, summary } = evaluateAllYogas(rashi);
    expect(Array.isArray(yogas)).toBe(true);
    expect(typeof summary.totalYogas).toBe('number');
    expect(summary.byCategory).toBeDefined();
  });
});

describe('dedupe Raja / Dhana (same lords, multiple house pairs)', () => {
  it('merges multiple Raja Yogas for same kendra+trikona lords (e.g. Mercury rules 1 and 4)', () => {
    const rashi = baseRashi({
      Ascendant: { current_sign: 3, isRetro: 'false' },
      Mercury: { current_sign: 7, house_number: 5, isRetro: 'false' },
      Venus: { current_sign: 7, house_number: 5, isRetro: 'false' },
    });
    const aspectData = calculatePlanetAspects(rashi);
    const rajas = detectRajaYogas(rashi, ref, aspectData);
    const meVe = rajas.filter(
      (y) => y.name === 'Raja Yoga' && y.kendraLord === 'Mercury' && y.trikonaLord === 'Venus'
    );
    expect(meVe).toHaveLength(1);
    expect(meVe[0].formingDetails).toMatch(/2 qualifying links|H1–H5|H4–H5/);
  });

  it('merges duplicate Dhana Yoga for same two lords across wealth pairs', () => {
    const rashi = baseRashi({
      Ascendant: { current_sign: 6, isRetro: 'false' },
      Venus: { current_sign: 8, house_number: 3, isRetro: 'false' },
      Saturn: { current_sign: 8, house_number: 3, isRetro: 'false' },
    });
    const aspectData = calculatePlanetAspects(rashi);
    const dhanas = detectDhanaYogas(rashi, ref, aspectData);
    const keys = dhanas
      .filter((y) => y.name === 'Dhana Yoga')
      .map(
        (y) =>
          `${y.connectionType}:${[y.lord1, y.lord2].sort().join(',')}`
      );
    const unique = new Set(keys);
    expect(keys.length).toBe(unique.size);
  });
});
