const { MongoClient } = require('mongodb');

const COLLECTION = 'runtimeAppConfig';
const DOC_ID = 'rashi-global';
const SAFE_KEYS = ['PORT'];

let clientPromise = null;
let cachedValues = {};

function getMongoUri() {
  return (process.env.RASHI_CONTENT_MONGODB_URI || '').trim();
}

async function getClient() {
  const uri = getMongoUri();
  if (!uri) return null;
  if (!clientPromise) {
    clientPromise = new MongoClient(uri).connect();
  }
  return clientPromise;
}

async function loadRashiRuntimeConfig() {
  cachedValues = {};
  const client = await getClient();
  if (!client) {
    console.log('[rashiRuntimeConfig] Skipping Mongo load (RASHI_CONTENT_MONGODB_URI is unset).');
    return;
  }
  try {
    const doc = await client.db().collection(COLLECTION).findOne({ _id: DOC_ID });
    const values = (doc && doc.values && typeof doc.values === 'object' && !Array.isArray(doc.values))
      ? doc.values
      : {};
    for (const key of SAFE_KEYS) {
      const raw = values[key];
      if (raw == null) continue;
      const value = String(raw).trim();
      if (value) cachedValues[key] = value;
    }
    console.log(`[rashiRuntimeConfig] Loaded ${Object.keys(cachedValues).length} key(s) from ${COLLECTION}/${DOC_ID}.`);
  } catch (e) {
    console.warn('[rashiRuntimeConfig] Mongo load failed, env/defaults only:', e && e.message ? e.message : e);
  }
}

function getRashiTunable(key, fallbackValue) {
  const fromEnv = process.env[key];
  if (fromEnv != null && String(fromEnv).trim() !== '') {
    return String(fromEnv).trim();
  }
  const fromDb = cachedValues[key];
  if (fromDb != null && String(fromDb).trim() !== '') {
    return String(fromDb).trim();
  }
  return fallbackValue;
}

module.exports = {
  loadRashiRuntimeConfig,
  getRashiTunable,
};
