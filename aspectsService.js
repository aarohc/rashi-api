/**
 * Vedic Astrology Planet Aspects Service
 * 
 * In Vedic astrology, planets cast aspects (drishti) on other houses/planets.
 * All planets have a 7th house aspect (opposition), while Mars, Jupiter, and Saturn
 * have additional special aspects.
 */

// Aspect rules: which houses each planet aspects (relative to its position)
// House 1 = planet's own position, House 7 = opposite
const ASPECT_RULES = {
  // All planets aspect the 7th house
  default: [7],
  // Mars additionally aspects 4th and 8th houses
  Mars: [4, 7, 8],
  // Jupiter additionally aspects 5th and 9th houses
  Jupiter: [5, 7, 9],
  // Saturn additionally aspects 3rd and 10th houses
  Saturn: [3, 7, 10],
  // Rahu and Ketu - traditionally have 5th, 7th, 9th aspects (like Jupiter)
  Rahu: [5, 7, 9],
  Ketu: [5, 7, 9]
};

// Sign names for readability
const SIGN_NAMES = {
  1: 'Aries',
  2: 'Taurus',
  3: 'Gemini',
  4: 'Cancer',
  5: 'Leo',
  6: 'Virgo',
  7: 'Libra',
  8: 'Scorpio',
  9: 'Sagittarius',
  10: 'Capricorn',
  11: 'Aquarius',
  12: 'Pisces'
};

// Planet abbreviations for display
const PLANET_ABBREV = {
  Sun: 'Su',
  Moon: 'Mo',
  Mars: 'Ma',
  Mercury: 'Me',
  Jupiter: 'Ju',
  Venus: 'Ve',
  Saturn: 'Sa',
  Rahu: 'Ra',
  Ketu: 'Ke',
  Uranus: 'Ur',
  Neptune: 'Ne',
  Pluto: 'Pl'
};

/**
 * Calculate which sign a planet aspects given the aspect house number
 * @param {number} planetSign - The sign number (1-12) where the planet is located
 * @param {number} aspectHouse - The house number being aspected (1-12 relative to planet)
 * @returns {number} The sign number (1-12) being aspected
 */
function calculateAspectedSign(planetSign, aspectHouse) {
  // aspectHouse is relative: 1 = same sign, 7 = opposite, etc.
  // Formula: (planetSign + aspectHouse - 2) % 12 + 1
  let aspectedSign = ((planetSign + aspectHouse - 2) % 12) + 1;
  return aspectedSign;
}

/**
 * Get the aspect houses for a given planet
 * @param {string} planetName - Name of the planet
 * @returns {number[]} Array of house numbers the planet aspects
 */
function getAspectHouses(planetName) {
  return ASPECT_RULES[planetName] || ASPECT_RULES.default;
}

/**
 * Calculate all planetary aspects from rashi data
 * @param {Object} rashiData - Planet positions from /api/rashi endpoint
 * @returns {Object} Comprehensive aspect data
 */
function calculatePlanetAspects(rashiData) {
  const planets = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
  
  // Optionally include outer planets if available
  const outerPlanets = ['Uranus', 'Neptune', 'Pluto'];
  const availablePlanets = [...planets];
  
  outerPlanets.forEach(planet => {
    if (rashiData[planet] && rashiData[planet].current_sign > 0) {
      availablePlanets.push(planet);
    }
  });

  // Build a map of which planets are in which sign
  const planetsInSign = {};
  for (let i = 1; i <= 12; i++) {
    planetsInSign[i] = [];
  }
  
  availablePlanets.forEach(planet => {
    const sign = rashiData[planet]?.current_sign;
    if (sign && sign > 0) {
      planetsInSign[sign].push(planet);
    }
  });

  // Calculate aspects for each planet
  const aspectsByPlanet = {};
  const aspectsReceived = {};
  
  // Initialize aspectsReceived for all planets
  availablePlanets.forEach(planet => {
    aspectsReceived[planet] = [];
  });

  availablePlanets.forEach(planet => {
    const planetSign = rashiData[planet]?.current_sign;
    if (!planetSign || planetSign === 0) return;

    const aspectHouses = getAspectHouses(planet);
    const aspects = [];

    aspectHouses.forEach(houseNum => {
      const aspectedSign = calculateAspectedSign(planetSign, houseNum);
      const planetsAspected = planetsInSign[aspectedSign];
      
      const aspectInfo = {
        aspectType: houseNum === 7 ? 'full' : 'special',
        houseFromPlanet: houseNum,
        aspectedSign: aspectedSign,
        aspectedSignName: SIGN_NAMES[aspectedSign],
        planetsAspected: planetsAspected.filter(p => p !== planet) // Exclude self
      };
      
      aspects.push(aspectInfo);
      
      // Record which planets receive this aspect
      planetsAspected.forEach(aspectedPlanet => {
        if (aspectedPlanet !== planet) {
          aspectsReceived[aspectedPlanet].push({
            aspectingPlanet: planet,
            aspectingPlanetAbbrev: PLANET_ABBREV[planet],
            aspectType: houseNum === 7 ? 'full' : 'special',
            houseDistance: houseNum
          });
        }
      });
    });

    aspectsByPlanet[planet] = {
      abbreviation: PLANET_ABBREV[planet],
      inSign: planetSign,
      inSignName: SIGN_NAMES[planetSign],
      isRetrograde: rashiData[planet]?.isRetro === 'true',
      aspectHouses: aspectHouses,
      aspects: aspects
    };
  });

  // Calculate mutual aspects (planets aspecting each other)
  const mutualAspects = [];
  const checkedPairs = new Set();

  availablePlanets.forEach(planet1 => {
    availablePlanets.forEach(planet2 => {
      if (planet1 === planet2) return;
      
      const pairKey = [planet1, planet2].sort().join('-');
      if (checkedPairs.has(pairKey)) return;
      checkedPairs.add(pairKey);

      const planet1AspectsP2 = aspectsReceived[planet2]?.some(a => a.aspectingPlanet === planet1);
      const planet2AspectsP1 = aspectsReceived[planet1]?.some(a => a.aspectingPlanet === planet2);

      if (planet1AspectsP2 && planet2AspectsP1) {
        mutualAspects.push({
          planets: [planet1, planet2],
          description: `${planet1} and ${planet2} mutually aspect each other`
        });
      }
    });
  });

  // Generate house-wise aspect summary (which planets aspect each house/sign)
  const aspectsByHouse = {};
  for (let sign = 1; sign <= 12; sign++) {
    const aspectingPlanets = [];
    
    availablePlanets.forEach(planet => {
      const planetSign = rashiData[planet]?.current_sign;
      if (!planetSign || planetSign === 0) return;
      
      const aspectHouses = getAspectHouses(planet);
      aspectHouses.forEach(houseNum => {
        const aspectedSign = calculateAspectedSign(planetSign, houseNum);
        if (aspectedSign === sign) {
          aspectingPlanets.push({
            planet: planet,
            abbreviation: PLANET_ABBREV[planet],
            aspectType: houseNum === 7 ? 'full' : 'special',
            fromSign: planetSign
          });
        }
      });
    });

    aspectsByHouse[sign] = {
      signName: SIGN_NAMES[sign],
      planetsInSign: planetsInSign[sign],
      aspectingPlanets: aspectingPlanets
    };
  }

  return {
    aspectsByPlanet,
    aspectsReceived,
    mutualAspects,
    aspectsByHouse,
    summary: {
      totalPlanets: availablePlanets.length,
      planetsWithSpecialAspects: ['Mars', 'Jupiter', 'Saturn', 'Rahu', 'Ketu'].filter(
        p => availablePlanets.includes(p)
      ),
      aspectRulesUsed: {
        allPlanets: '7th house (opposition/full aspect)',
        Mars: '4th, 7th, 8th houses',
        Jupiter: '5th, 7th, 9th houses',
        Saturn: '3rd, 7th, 10th houses',
        RahuKetu: '5th, 7th, 9th houses'
      }
    }
  };
}

module.exports = {
  calculatePlanetAspects,
  calculateAspectedSign,
  getAspectHouses,
  ASPECT_RULES,
  SIGN_NAMES,
  PLANET_ABBREV
};
