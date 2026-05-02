const path = require('path');
const {
  rashiOfHouse,
  getHouseLordsFromAscendant,
  signFromMoon,
  isKendraFromMoon,
  loadYogaReference,
} = require('../yogaUtils');

describe('yogaUtils', () => {
  let ref;

  beforeAll(() => {
    ref = loadYogaReference();
  });

  describe('rashiOfHouse', () => {
    it('Aries ascendant: house 1 is Aries (1), house 2 Taurus (2)', () => {
      expect(rashiOfHouse(1, 1)).toBe(1);
      expect(rashiOfHouse(1, 2)).toBe(2);
      expect(rashiOfHouse(1, 12)).toBe(12);
    });
  });

  describe('getHouseLordsFromAscendant', () => {
    it('Aries Lagna: 1=Mars, 2=Venus, 4=Cancer=Moon, 7=Libra=Venus', () => {
      const lords = getHouseLordsFromAscendant(1, ref);
      expect(lords[1]).toBe('Mars');
      expect(lords[2]).toBe('Venus');
      expect(lords[4]).toBe('Moon');
      expect(lords[7]).toBe('Venus');
    });

    it('Cancer Lagna: 1=Moon, 4=Libra=Venus', () => {
      const lords = getHouseLordsFromAscendant(4, ref);
      expect(lords[1]).toBe('Moon');
      expect(lords[4]).toBe('Venus');
    });

    it('Libra Lagna: 1=Venus, 10=Cancer=Moon', () => {
      const lords = getHouseLordsFromAscendant(7, ref);
      expect(lords[1]).toBe('Venus');
      expect(lords[10]).toBe('Moon');
    });
  });

  describe('signFromMoon / isKendraFromMoon', () => {
    it('Moon in Gemini (3): Kendra signs include 3,6,9,12', () => {
      expect(signFromMoon(3, 1)).toBe(3);
      expect(signFromMoon(3, 4)).toBe(6);
      expect(isKendraFromMoon(3, 6)).toBe(true);
      expect(isKendraFromMoon(3, 5)).toBe(false);
    });
  });
});
