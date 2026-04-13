/**
 * Idempotent: add Uranus, Neptune, Pluto to every planet.json used by /api/generic-predictions.
 * (Root data/planet.json plus data/en|es|gu|hi/planet.json when those locale dirs exist.)
 *
 * Run from rashi-api: node scripts/append-outer-planets-to-planet-json.cjs
 */
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');

function ordinal(n) {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

function rankingFor(planet, house) {
  const base = planet === 'Uranus' ? 5 : planet === 'Neptune' ? 5 : 6;
  const bump = (house % 3) - 1;
  return Math.min(7, Math.max(4, base + bump));
}

function buildBlock(planet, house) {
  const r = rankingFor(planet, house);
  const themes =
    planet === 'Uranus'
      ? 'sudden change, originality, technology, and personal freedom'
      : planet === 'Neptune'
        ? 'sensitivity, ideals, imagination, and subtle influences'
        : 'transformation, depth, power dynamics, and renewal';
  return (
    `### ${planet} in ${ordinal(house)} House ###\n` +
    `*** Ranking: ${r}/10\n\n` +
    `*** Prediction:\n` +
    `- ${planet} (outer / modern) highlights ${themes} in this life area when read together with classical grahas.\n` +
    `- Treat as slow background pressure, not a replacement for Vimshottari lords.\n\n` +
    `*** Opportunities:\n` +
    `- Fresh perspective, creative or technical openings when you stay adaptable.\n\n` +
    `*** Challenges:\n` +
    `- Restlessness, blurred boundaries, or extremes if signals are ignored.\n\n` +
    `*** Recommendations:\n` +
    `- Use as context alongside Sun–Ketu analysis; prefer grounded choices over drama.`
  );
}

function collectPlanetJsonPaths() {
  const paths = [path.join(dataDir, 'planet.json')];
  for (const ent of fs.readdirSync(dataDir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const p = path.join(dataDir, ent.name, 'planet.json');
    if (fs.existsSync(p)) paths.push(p);
  }
  return [...new Set(paths)];
}

const outers = ['Uranus', 'Neptune', 'Pluto'];

for (const planetPath of collectPlanetJsonPaths()) {
  const data = JSON.parse(fs.readFileSync(planetPath, 'utf8'));
  let added = 0;
  for (const planet of outers) {
    if (data[planet]) continue;
    data[planet] = {};
    for (let h = 1; h <= 12; h++) {
      data[planet][String(h)] = buildBlock(planet, h);
    }
    added++;
  }
  if (added === 0) {
    console.log('skip (already has outers):', path.relative(dataDir, planetPath));
    continue;
  }
  fs.writeFileSync(planetPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('wrote', added, 'planet(s) ->', path.relative(path.join(__dirname, '..'), planetPath));
}
