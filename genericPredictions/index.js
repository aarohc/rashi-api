const path = require('path');
const fs = require('fs');

const SUPPORTED_LOCALES = ['en', 'es', 'gu', 'hi'];

function getBaseDataDir() {
  const candidates = [
    path.join(__dirname, '..', 'data'),
    path.join(process.cwd(), 'data')
  ];
  for (const dir of candidates) {
    const planetPath = path.join(dir, 'planet.json');
    if (fs.existsSync(planetPath)) return dir;
    const enDir = path.join(dir, 'en');
    if (fs.existsSync(path.join(enDir, 'planet.json'))) return dir;
  }
  throw new Error(`Data dir not found. Tried: ${candidates.join(', ')}. cwd=${process.cwd()}, __dirname=${__dirname}`);
}

function getDataDirForLocale(baseDataDir, locale) {
  const normalized = (locale && String(locale).toLowerCase()) || 'en';
  const chosen = SUPPORTED_LOCALES.includes(normalized) ? normalized : 'en';
  const localeDir = path.join(baseDataDir, chosen);
  if (fs.existsSync(localeDir)) return localeDir;
  return baseDataDir;
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

module.exports = async function (context, req) {
  try {
    const baseDataDir = getBaseDataDir();
    const locale = (req && req.query && req.query.locale) ? String(req.query.locale).toLowerCase() : 'en';
    const dataDir = getDataDirForLocale(baseDataDir, locale);
    const enDir = locale === 'en' ? dataDir : getDataDirForLocale(baseDataDir, 'en');
    const files = ['planet.json', 'house.json', 'dasha-generic.json', 'dasha-maha.json', 'pratyadasha-generic.json'];
    const keys = ['planetInHouse', 'houseByRashi', 'dashaGeneric', 'dashaMaha', 'pratyadashaGeneric'];
    const out = {};
    for (let i = 0; i < files.length; i++) {
      let data = readJsonIfExists(path.join(dataDir, files[i]));
      if (data == null && dataDir !== enDir) data = readJsonIfExists(path.join(enDir, files[i]));
      if (data == null) {
        context.res = {
          status: 500,
          body: { error: 'Failed to load generic prediction data', missing: files[i] },
          headers: { 'Content-Type': 'application/json' }
        };
        return;
      }
      out[keys[i]] = data;
    }
    context.res = {
      status: 200,
      body: out,
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
