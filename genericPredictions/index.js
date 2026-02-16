const path = require('path');
const fs = require('fs');

module.exports = async function (context, req) {
  try {
    const dataDir = path.join(__dirname, '..', 'data');
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
    context.log.error('Error serving generic-predictions:', err);
    context.res = {
      status: 500,
      body: { error: 'Failed to load generic prediction data' },
      headers: { 'Content-Type': 'application/json' }
    };
  }
};
