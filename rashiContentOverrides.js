/**
 * Optional MongoDB overrides for generic prediction JSON (same Atlas/Cosmos DB as cosmicconnect-api is fine).
 * Collection: rashiGenericDataOverrides — documents { _id, payload }. When present, payload is the primary source;
 * disk JSON under data/ is fallback (see generic-predictions route: Mongo first, then file read).
 *
 * _id pattern: generic:<fileStem>:<locale>
 *   fileStem: planet | house | dasha-generic | dasha-maha | pratyadasha-generic | shani-moon-transit-phases
 *   locale: en | es | gu | hi
 * Yoga descriptions file (root data/): _id = yoga-descriptions
 *
 * Env: RASHI_CONTENT_MONGODB_URI (optional). If unset, disk-only behavior.
 */

const { MongoClient } = require('mongodb');

const COLLECTION = 'rashiGenericDataOverrides';

/** @type {Map<string, unknown>} */
const cache = new Map();

let clientPromise = null;
let lastRefreshAt = 0;
const DEFAULT_TTL_MS = 5 * 60 * 1000;

function getUri() {
  return (process.env.RASHI_CONTENT_MONGODB_URI || '').trim();
}

async function getClient() {
  const uri = getUri();
  if (!uri) return null;
  if (!clientPromise) {
    clientPromise = new MongoClient(uri).connect();
  }
  return clientPromise;
}

/**
 * Load all override documents into memory. Safe to call on startup and periodically.
 */
async function refreshRashiContentOverrides() {
  cache.clear();
  const uri = getUri();
  if (!uri) {
    return;
  }
  try {
    const client = await getClient();
    if (!client) return;
    const db = client.db();
    const col = db.collection(COLLECTION);
    const docs = await col.find({}).toArray();
    for (const doc of docs) {
      if (doc && doc._id != null && doc.payload != null) {
        cache.set(String(doc._id), doc.payload);
      }
    }
    lastRefreshAt = Date.now();
    console.log(`[rashiContentOverrides] Loaded ${cache.size} document(s) from ${COLLECTION}.`);
  } catch (e) {
    console.warn('[rashiContentOverrides] Refresh failed (using disk only):', e.message || e);
  }
}

/**
 * Throttled refresh for serverless / per-request paths (first load or TTL elapsed).
 * @param {number} [maxAgeMs]
 */
async function ensureRashiOverridesFresh(maxAgeMs = DEFAULT_TTL_MS) {
  if (!getUri()) return;
  if (cache.size > 0 && Date.now() - lastRefreshAt < maxAgeMs) return;
  await refreshRashiContentOverrides();
}

/**
 * @param {string} fileStem e.g. 'planet' from planet.json
 * @param {string} locale normalized locale
 * @returns {object|null} full JSON replacement or null
 */
function getGenericFileOverride(fileStem, locale) {
  const id = `generic:${fileStem}:${locale}`;
  const hit = cache.get(id);
  if (hit && typeof hit === 'object' && !Array.isArray(hit)) {
    return hit;
  }
  if (locale !== 'en') {
    const en = cache.get(`generic:${fileStem}:en`);
    if (en && typeof en === 'object' && !Array.isArray(en)) return en;
  }
  return null;
}

function getYogaDescriptionsOverride() {
  const hit = cache.get('yoga-descriptions');
  if (hit && typeof hit === 'object' && !Array.isArray(hit)) {
    return hit;
  }
  return null;
}

module.exports = {
  refreshRashiContentOverrides,
  ensureRashiOverridesFresh,
  getGenericFileOverride,
  getYogaDescriptionsOverride,
};
