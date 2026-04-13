/**
 * Classical Parashari yoga detection from D1 rashi data (whole-sign houses).
 */

const path = require('path');
const fs = require('fs');
const { calculatePlanetAspects } = require('./aspectsService');
const {
  getHouseLords,
  signFromMoon,
  isKendraFromMoon,
} = require('./yogaUtils');

const CORE_PLANETS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
const LUNAR_AUX = ['Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
const SOLAR_AUX = ['Sun', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];

function loadJson(file) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', file), 'utf8'));
}

function planetSign(rashiData, planet) {
  const n = rashiData[planet]?.current_sign;
  return typeof n === 'number' ? n : Number(n);
}

function planetHouse(rashiData, planet) {
  const n = rashiData[planet]?.house_number;
  return typeof n === 'number' ? n : Number(n);
}

function isConjunct(rashiData, a, b) {
  const sa = planetSign(rashiData, a);
  const sb = planetSign(rashiData, b);
  return sa >= 1 && sa <= 12 && sa === sb;
}

function mutualAspect(aspectData, a, b) {
  const recA = aspectData.aspectsReceived[a] || [];
  const recB = aspectData.aspectsReceived[b] || [];
  const aToB = recB.some((x) => x.aspectingPlanet === a);
  const bToA = recA.some((x) => x.aspectingPlanet === b);
  return aToB && bToA;
}

function conjunctOrMutualAspect(rashiData, aspectData, a, b) {
  if (a === b) return false;
  return isConjunct(rashiData, a, b) || mutualAspect(aspectData, a, b);
}

function lordOfSign(referenceData, signNum) {
  return referenceData.signLordship[String(signNum)];
}

/** Parivartana: P sits in sign ruled by Q and Q sits in sign ruled by P. */
function parivartana(rashiData, referenceData, p, q) {
  const sp = planetSign(rashiData, p);
  const sq = planetSign(rashiData, q);
  if (sp < 1 || sq < 1) return false;
  return lordOfSign(referenceData, sp) === q && lordOfSign(referenceData, sq) === p;
}

function isKendraHouse(h) {
  return [1, 4, 7, 10].includes(h);
}

function isTrikonaHouse(h) {
  return [1, 5, 9].includes(h);
}

function isDusthanaHouse(h) {
  return [6, 8, 12].includes(h);
}

/** Deduplicate [[a,b],...] treating order as irrelevant. */
function uniqueHousePairs(pairs) {
  const seen = new Set();
  const out = [];
  for (const [x, y] of pairs) {
    const lo = Math.min(x, y);
    const hi = Math.max(x, y);
    const k = `${lo},${hi}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push([lo, hi]);
    }
  }
  return out;
}

/**
 * Same two lords often qualify for multiple kendra×trikona house pairs (e.g. Mercury rules both 4 and 7).
 * Merge into one Raja Yoga with combined house-pair detail.
 */
function dedupeRajaYogas(items) {
  const m = new Map();
  for (const it of items) {
    const pk = `${it.connectionType}\0${[it.kendraLord, it.trikonaLord].sort().join(',')}`;
    if (!m.has(pk)) {
      m.set(pk, {
        ...it,
        _pairs: [[it.kendraHouse, it.trikonaHouse]],
      });
    } else {
      m.get(pk)._pairs.push([it.kendraHouse, it.trikonaHouse]);
    }
  }
  return [...m.values()].map((it) => {
    const pairs = uniqueHousePairs(it._pairs);
    delete it._pairs;
    const Lk = it.kendraLord;
    const Lt = it.trikonaLord;
    const ct = it.connectionType.replace(/_/g, ' ');
    let formingDetails;
    if (pairs.length === 1) {
      const [hK, hT] = pairs[0];
      formingDetails = `Lord of ${hK} (${Lk}) and lord of ${hT} (${Lt}) in ${ct}`;
    } else {
      const seg = pairs.map(([hK, hT]) => `H${hK}–H${hT}`).join(', ');
      formingDetails = `${Lk} (kendra) and ${Lt} (trikona) in ${ct} — ${pairs.length} qualifying links: ${seg}`;
    }
    const [hK0, hT0] = pairs[0];
    return {
      ...it,
      kendraHouse: hK0,
      trikonaHouse: hT0,
      formingDetails,
    };
  });
}

/**
 * Same two lords can link multiple wealth-house pairs (e.g. same lord for 2 and 9 with another lord).
 * Lakshmi/Dhana duplicates merge by yoga name + connection + sorted lords.
 */
function dedupeDhanaYogas(items) {
  const m = new Map();
  for (const it of items) {
    const pk = `${it.name}\0${it.connectionType}\0${[it.lord1, it.lord2].sort().join(',')}`;
    if (!m.has(pk)) {
      m.set(pk, {
        ...it,
        _pairs: [[it.house1, it.house2]],
      });
    } else {
      m.get(pk)._pairs.push([it.house1, it.house2]);
    }
  }
  return [...m.values()].map((it) => {
    const pairs = uniqueHousePairs(it._pairs);
    delete it._pairs;
    const L1 = it.lord1;
    const L2 = it.lord2;
    const ct = it.connectionType;
    let formingDetails;
    if (pairs.length === 1) {
      const [h1, h2] = pairs[0];
      formingDetails = `Lords of houses ${h1} (${L1}) and ${h2} (${L2}) — ${ct}`;
    } else {
      const seg = pairs.map(([h1, h2]) => `H${h1}–H${h2}`).join(', ');
      formingDetails = `${L1} and ${L2} in ${ct} — ${pairs.length} qualifying wealth links: ${seg}`;
    }
    const [h1, h2] = pairs[0];
    return {
      ...it,
      house1: h1,
      house2: h2,
      formingDetails,
    };
  });
}

function detectMahapurushaYogas(rashiData, referenceData) {
  const kendra = referenceData.houseClassifications.kendra;
  const own = referenceData.planetOwnSigns;
  const ex = referenceData.exaltation;
  const configs = [
    { name: 'Ruchaka', sanskritName: 'रुचक', planet: 'Mars' },
    { name: 'Bhadra', sanskritName: 'भद्र', planet: 'Mercury' },
    { name: 'Hamsa', sanskritName: 'हंस', planet: 'Jupiter' },
    { name: 'Malavya', sanskritName: 'मालव्य', planet: 'Venus' },
    { name: 'Shasha', sanskritName: 'शश', planet: 'Saturn' },
  ];
  const out = [];
  for (const c of configs) {
    const p = c.planet;
    const sign = planetSign(rashiData, p);
    const house = planetHouse(rashiData, p);
    if (!kendra.includes(house)) continue;
    const ownSigns = own[p] || [];
    const isOwn = ownSigns.includes(sign);
    const isExalted = ex[p] === sign;
    if (!isOwn && !isExalted) continue;
    out.push({
      name: c.name,
      sanskritName: c.sanskritName,
      category: 'Pancha Mahapurusha',
      nature: 'benefic',
      rarity: 'uncommon',
      planet: p,
      planetSign: sign,
      planetHouse: house,
      isExalted: isExalted,
      isOwnSign: isOwn,
      isPresent: true,
      formingPlanets: [p],
      formingDetails: `${p} in sign ${sign} (${isExalted ? 'exalted' : 'own'}) in Kendra house ${house}`,
    });
  }
  return out;
}

function detectLunarYogas(rashiData) {
  const moonSign = planetSign(rashiData, 'Moon');
  if (moonSign < 1 || moonSign > 12) return [];
  const sign2 = signFromMoon(moonSign, 2);
  const sign12 = signFromMoon(moonSign, 12);
  const in2 = LUNAR_AUX.filter((p) => planetSign(rashiData, p) === sign2);
  const in12 = LUNAR_AUX.filter((p) => planetSign(rashiData, p) === sign12);
  const has2 = in2.length > 0;
  const has12 = in12.length > 0;

  const out = [];
  const juSign = planetSign(rashiData, 'Jupiter');
  if (juSign >= 1 && isKendraFromMoon(moonSign, juSign)) {
    out.push({
      name: 'Gajakesari',
      sanskritName: 'गजकेसरी',
      category: 'Lunar',
      nature: 'benefic',
      rarity: 'uncommon',
      formingPlanets: ['Moon', 'Jupiter'],
      formingDetails: `Jupiter in a Kendra (1/4/7/10) from Moon`,
      isPresent: true,
    });
  }
  if (planetSign(rashiData, 'Moon') === planetSign(rashiData, 'Mars')) {
    out.push({
      name: 'Chandra-Mangal',
      sanskritName: 'चन्द्रमंगल',
      category: 'Lunar',
      nature: 'benefic',
      rarity: 'common',
      formingPlanets: ['Moon', 'Mars'],
      formingDetails: 'Moon and Mars in the same sign',
      isPresent: true,
    });
  }
  if (has2) {
    out.push({
      name: 'Sunafa',
      sanskritName: 'सुनफ',
      category: 'Lunar',
      nature: 'benefic',
      rarity: 'common',
      formingPlanets: in2,
      formingDetails: `Planet(s) in 2nd from Moon: ${in2.join(', ')}`,
      isPresent: true,
    });
  }
  if (has12) {
    out.push({
      name: 'Anafa',
      sanskritName: 'अनफ',
      category: 'Lunar',
      nature: 'benefic',
      rarity: 'common',
      formingPlanets: in12,
      formingDetails: `Planet(s) in 12th from Moon: ${in12.join(', ')}`,
      isPresent: true,
    });
  }
  if (has2 && has12) {
    out.push({
      name: 'Durudhara',
      sanskritName: 'दुरुधर',
      category: 'Lunar',
      nature: 'benefic',
      rarity: 'uncommon',
      formingPlanets: [...new Set([...in2, ...in12])],
      formingDetails: 'Planets in both 2nd and 12th from Moon',
      isPresent: true,
    });
  }
  if (!has2 && !has12) {
    out.push({
      name: 'Kemadruma',
      sanskritName: 'केमद्रुम',
      category: 'Lunar',
      nature: 'challenging',
      rarity: 'uncommon',
      formingPlanets: ['Moon'],
      formingDetails: 'No planet (except Sun/Rahu/Ketu rule) in 2nd or 12th from Moon',
      isPresent: true,
    });
  }

  const jupSign = planetSign(rashiData, 'Jupiter');
  if (jupSign >= 1) {
    const moonFromJup = [6, 8, 12].some(
      (h) => moonSign === signFromMoon(jupSign, h)
    );
    if (moonFromJup) {
      out.push({
        name: 'Sakata',
        sanskritName: 'शकट',
        category: 'Lunar',
        nature: 'challenging',
        rarity: 'uncommon',
        formingPlanets: ['Moon', 'Jupiter'],
        formingDetails: 'Moon in 6th, 8th, or 12th from Jupiter',
        isPresent: true,
      });
    }
  }
  return out;
}

function detectSolarYogas(rashiData) {
  const sunSign = planetSign(rashiData, 'Sun');
  if (sunSign < 1 || sunSign > 12) return [];
  const sign2 = signFromMoon(sunSign, 2);
  const sign12 = signFromMoon(sunSign, 12);
  const in2 = SOLAR_AUX.filter((p) => planetSign(rashiData, p) === sign2);
  const in12 = SOLAR_AUX.filter((p) => planetSign(rashiData, p) === sign12);

  const out = [];
  if (planetSign(rashiData, 'Sun') === planetSign(rashiData, 'Mercury')) {
    const strong = [1, 3, 5, 6].includes(sunSign);
    out.push({
      name: 'Budhaditya',
      sanskritName: 'बुधादित्य',
      category: 'Solar',
      nature: 'benefic',
      rarity: 'common',
      formingPlanets: ['Sun', 'Mercury'],
      formingDetails: `Sun–Mercury conjunction in sign ${sunSign}${strong ? ' (Mercury-friendly sign)' : ''}`,
      isPresent: true,
    });
  }
  if (in2.length) {
    out.push({
      name: 'Veshi',
      sanskritName: 'वेशी',
      category: 'Solar',
      nature: 'benefic',
      rarity: 'common',
      formingPlanets: in2,
      formingDetails: `Planet(s) in 2nd from Sun: ${in2.join(', ')}`,
      isPresent: true,
    });
  }
  if (in12.length) {
    out.push({
      name: 'Voshi',
      sanskritName: 'वोशी',
      category: 'Solar',
      nature: 'benefic',
      rarity: 'common',
      formingPlanets: in12,
      formingDetails: `Planet(s) in 12th from Sun: ${in12.join(', ')}`,
      isPresent: true,
    });
  }
  if (in2.length && in12.length) {
    out.push({
      name: 'Ubhayachari',
      sanskritName: 'उभयचारी',
      category: 'Solar',
      nature: 'benefic',
      rarity: 'uncommon',
      formingPlanets: [...new Set([...in2, ...in12])],
      formingDetails: 'Planets in both 2nd and 12th from Sun',
      isPresent: true,
    });
  }
  return out;
}

function detectRajaYogas(rashiData, referenceData, aspectData) {
  const houseLords = getHouseLords(rashiData, referenceData);
  if (!houseLords) return [];
  const kendra = [1, 4, 7, 10];
  const trikona = [1, 5, 9];
  const out = [];
  for (const hK of kendra) {
    for (const hT of trikona) {
      const Lk = houseLords[hK];
      const Lt = houseLords[hT];
      if (!Lk || !Lt || Lk === Lt) continue;
      if (!CORE_PLANETS.includes(Lk) || !CORE_PLANETS.includes(Lt)) continue;
      let connectionType = null;
      if (isConjunct(rashiData, Lk, Lt)) connectionType = 'conjunction';
      else if (mutualAspect(aspectData, Lk, Lt)) connectionType = 'mutual_aspect';
      if (!connectionType) continue;
      out.push({
        name: 'Raja Yoga',
        sanskritName: 'राज योग',
        category: 'Raja',
        nature: 'benefic',
        rarity: 'uncommon',
        kendraLord: Lk,
        trikonaLord: Lt,
        kendraHouse: hK,
        trikonaHouse: hT,
        connectionType,
        formingPlanets: [Lk, Lt],
        formingDetails: `Lord of ${hK} (${Lk}) and lord of ${hT} (${Lt}) in ${connectionType.replace('_', ' ')}`,
        isPresent: true,
      });
    }
  }
  return dedupeRajaYogas(out);
}

function detectDhanaYogas(rashiData, referenceData, aspectData) {
  const houseLords = getHouseLords(rashiData, referenceData);
  if (!houseLords) return [];
  const wealthHouses = [2, 5, 9, 11];
  const out = [];

  function addPair(h1, h2, L1, L2, label) {
    if (!L1 || !L2 || L1 === L2) return;
    if (!CORE_PLANETS.includes(L1) || !CORE_PLANETS.includes(L2)) return;
    let connectionType = null;
    if (isConjunct(rashiData, L1, L2)) connectionType = 'conjunction';
    else if (mutualAspect(aspectData, L1, L2)) connectionType = 'mutual_aspect';
    else if (parivartana(rashiData, referenceData, L1, L2)) connectionType = 'parivartana';
    if (!connectionType) return;
    const name = label || 'Dhana Yoga';
    out.push({
      name,
      sanskritName: name === 'Lakshmi Yoga' ? 'लक्ष्मी योग' : 'धन योग',
      category: 'Dhana',
      nature: 'benefic',
      rarity: 'uncommon',
      house1: h1,
      house2: h2,
      lord1: L1,
      lord2: L2,
      connectionType,
      formingPlanets: [L1, L2],
      formingDetails: `Lords of houses ${h1} (${L1}) and ${h2} (${L2}) — ${connectionType}`,
      isPresent: true,
    });
  }

  for (let i = 0; i < wealthHouses.length; i++) {
    for (let j = i + 1; j < wealthHouses.length; j++) {
      const h1 = wealthHouses[i];
      const h2 = wealthHouses[j];
      addPair(h1, h2, houseLords[h1], houseLords[h2], 'Dhana Yoga');
    }
  }
  const L1 = houseLords[1];
  if (houseLords[2]) addPair(1, 2, L1, houseLords[2], 'Lakshmi Yoga');
  if (houseLords[11]) addPair(1, 11, L1, houseLords[11], 'Lakshmi Yoga');

  return dedupeDhanaYogas(out);
}

function detectKalaSarpa(rashiData) {
  const rahu = planetSign(rashiData, 'Rahu');
  const ketu = planetSign(rashiData, 'Ketu');
  if (rahu < 1 || ketu < 1) return null;
  const r0 = rahu - 1;
  const half1 = new Set();
  for (let i = 0; i < 6; i++) {
    half1.add((r0 + i) % 12);
  }
  const allInHalf = (half) =>
    CORE_PLANETS.every((p) => half.has(planetSign(rashiData, p) - 1));
  const h1ok = allInHalf(half1);
  const half2 = new Set();
  for (let i = 0; i < 12; i++) {
    if (!half1.has(i)) half2.add(i);
  }
  const h2ok = allInHalf(half2);
  if (!h1ok && !h2ok) return null;
  return {
    name: 'Kala Sarpa',
    sanskritName: 'कालसर्प',
    category: 'Special',
    nature: 'challenging',
    rarity: 'rare',
    formingPlanets: CORE_PLANETS,
    formingDetails: 'All seven grahas lie on one side of the Rahu–Ketu axis (by sign)',
    isPresent: true,
  };
}

function detectVipareetaRaja(rashiData, referenceData) {
  const houseLords = getHouseLords(rashiData, referenceData);
  if (!houseLords) return [];
  const out = [];
  for (const h of [6, 8, 12]) {
    const L = houseLords[h];
    if (!L || !CORE_PLANETS.includes(L)) continue;
    const hh = planetHouse(rashiData, L);
    if (isDusthanaHouse(hh) && hh !== h) {
      out.push({
        name: 'Vipareeta Raja Yoga',
        sanskritName: 'विपरीत राज योग',
        category: 'Special',
        nature: 'mixed',
        rarity: 'uncommon',
        formingPlanets: [L],
        formingDetails: `Lord of ${h} (${L}) placed in dusthana house ${hh}`,
        isPresent: true,
      });
    }
  }
  return out;
}

function detectSaraswati(rashiData) {
  const allowed = new Set([1, 2, 4, 5, 7, 9, 10]);
  const ju = planetHouse(rashiData, 'Jupiter');
  const ve = planetHouse(rashiData, 'Venus');
  const me = planetHouse(rashiData, 'Mercury');
  if (allowed.has(ju) && allowed.has(ve) && allowed.has(me)) {
    return [
      {
        name: 'Saraswati Yoga',
        sanskritName: 'सरस्वती योग',
        category: 'Special',
        nature: 'benefic',
        rarity: 'rare',
        formingPlanets: ['Jupiter', 'Venus', 'Mercury'],
        formingDetails: `Jupiter (H${ju}), Venus (H${ve}), Mercury (H${me}) in Kendra/Trikona/2nd from Lagna`,
        isPresent: true,
      },
    ];
  }
  return [];
}

function planetAspectsSign(aspectData, fromPlanet, targetSign) {
  const by = aspectData.aspectsByPlanet[fromPlanet];
  if (!by || !by.aspects) return false;
  return by.aspects.some((a) => a.aspectedSign === targetSign);
}

function detectNeechabhanga(rashiData, referenceData, aspectData) {
  const houseLords = getHouseLords(rashiData, referenceData);
  if (!houseLords) return [];
  const moonSign = planetSign(rashiData, 'Moon');
  const out = [];

  for (const p of CORE_PLANETS) {
    const sign = planetSign(rashiData, p);
    const deb = referenceData.debilitation[p];
    if (sign !== deb) continue;

    const debLord = lordOfSign(referenceData, deb);
    const exSign = referenceData.exaltation[p];
    const exLord = lordOfSign(referenceData, exSign);

    const conditions = [];
    if (debLord && CORE_PLANETS.includes(debLord)) {
      const h = planetHouse(rashiData, debLord);
      const fromMoon = isKendraFromMoon(moonSign, planetSign(rashiData, debLord));
      if (isKendraHouse(h) || fromMoon) {
        conditions.push('debilitation sign lord in Kendra from Lagna or Moon');
      }
    }
    if (exLord && CORE_PLANETS.includes(exLord)) {
      const h = planetHouse(rashiData, exLord);
      const fromMoon = isKendraFromMoon(moonSign, planetSign(rashiData, exLord));
      if (isKendraHouse(h) || fromMoon) {
        conditions.push('exaltation sign lord in Kendra from Lagna or Moon');
      }
    }
    if (debLord && CORE_PLANETS.includes(debLord)) {
      if (planetAspectsSign(aspectData, debLord, sign)) {
        conditions.push('aspected by lord of debilitation sign');
      }
    }

    if (conditions.length) {
      out.push({
        name: 'Neechabhanga Raja Yoga',
        sanskritName: 'नीचभंग राज योग',
        category: 'Special',
        nature: 'benefic',
        rarity: 'uncommon',
        formingPlanets: [p, ...(debLord && CORE_PLANETS.includes(debLord) ? [debLord] : [])],
        formingDetails: `${p} debilitated in sign ${deb}; cancellation: ${conditions.join('; ')}`,
        cancellationConditions: conditions,
        isPresent: true,
      });
    }
  }
  return out;
}

function detectSpecialYogas(rashiData, referenceData, aspectData) {
  const out = [];
  const ks = detectKalaSarpa(rashiData);
  if (ks) out.push(ks);
  out.push(...detectNeechabhanga(rashiData, referenceData, aspectData));
  out.push(...detectVipareetaRaja(rashiData, referenceData));
  out.push(...detectSaraswati(rashiData));
  return out;
}

function enrichWithDescriptions(yogas, descriptions) {
  return yogas.map((y) => {
    const d = descriptions[y.name] || {};
    return {
      ...y,
      sanskritName: y.sanskritName || d.sanskritName || y.name,
      shortDescription: d.shortDescription || '',
      fullDescription: d.fullDescription || '',
      ...(Array.isArray(d.opportunities) &&
        d.opportunities.length && { opportunities: d.opportunities }),
      ...(Array.isArray(d.challenges) && d.challenges.length && { challenges: d.challenges }),
      ...(d.keywords && { keywords: d.keywords }),
      ...(d.lifeDomains && { lifeDomains: d.lifeDomains }),
    };
  });
}

function buildSummary(yogas) {
  const byCategory = {};
  const byNature = {};
  for (const y of yogas) {
    byCategory[y.category] = (byCategory[y.category] || 0) + 1;
    const n = y.nature || 'benefic';
    byNature[n] = (byNature[n] || 0) + 1;
  }
  return {
    totalYogas: yogas.length,
    byCategory,
    byNature,
  };
}

/**
 * @param {object} rashiData /api/rashi shape
 * @param {object} [referenceData] optional loaded yoga-reference
 * @param {object} [descriptions] optional loaded yoga-descriptions
 */
function evaluateAllYogas(rashiData, referenceData, descriptions) {
  const ref = referenceData || loadJson('yoga-reference.json');
  const desc = descriptions || loadJson('yoga-descriptions.json');
  const aspectData = calculatePlanetAspects(rashiData);

  const all = [
    ...detectMahapurushaYogas(rashiData, ref),
    ...detectLunarYogas(rashiData),
    ...detectSolarYogas(rashiData),
    ...detectRajaYogas(rashiData, ref, aspectData),
    ...detectSpecialYogas(rashiData, ref, aspectData),
    ...detectDhanaYogas(rashiData, ref, aspectData),
  ];

  const enriched = enrichWithDescriptions(all, desc);
  return {
    yogas: enriched,
    summary: buildSummary(enriched),
  };
}

module.exports = {
  evaluateAllYogas,
  detectMahapurushaYogas,
  detectLunarYogas,
  detectSolarYogas,
  detectRajaYogas,
  detectDhanaYogas,
  detectSpecialYogas,
  enrichWithDescriptions,
  buildSummary,
};
