const path = require('path');
const fs = require('fs');

function getDataDir() {
  const candidates = [
    path.join(__dirname, '..', 'data'),
    path.join(process.cwd(), 'data')
  ];
  for (const dir of candidates) {
    const planetPath = path.join(dir, 'planet.json');
    if (fs.existsSync(planetPath)) return dir;
  }
  throw new Error(`Data dir not found. Tried: ${candidates.join(', ')}. cwd=${process.cwd()}, __dirname=${__dirname}`);
}

module.exports = async function (context, req) {
  try {
    const dataDir = getDataDir();
    const planetPath = path.join(dataDir, 'planet.json');
    const housePath = path.join(dataDir, 'house.json');
    const dashaGenericPath = path.join(dataDir, 'dasha-generic.json');
    const dashaMahaPath = path.join(dataDir, 'dasha-maha.json');
    const planetInHouse = JSON.parse(fs.readFileSync(planetPath, 'utf8'));
    const houseByRashi = JSON.parse(fs.readFileSync(housePath, 'utf8'));
    const dashaGeneric = JSON.parse(fs.readFileSync(dashaGenericPath, 'utf8'));
    const dashaMaha = JSON.parse(fs.readFileSync(dashaMahaPath, 'utf8'));
    context.res = {
      status: 200,
      body: { planetInHouse, houseByRashi, dashaGeneric, dashaMaha },
      headers: { 'Content-Type': 'application/json' }
    };
  } catch (err) {
    context.log.error('Error serving generic-predictions:', err.message, err.stack);
    context.res = {
      status: 500,
      body: {
        error: 'Failed to load generic prediction data',
        detail: err.message
      },
      headers: { 'Content-Type': 'application/json' }
    };
  }
};
