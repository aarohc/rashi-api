const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const COLLECTION = 'runtimeAppConfig';
const DOC_ID = 'rashi-global';
const SAFE_KEYS = ['PORT'];

function readEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function pickNonEmptyValues(source, keys) {
  const out = {};
  for (const key of keys) {
    const raw = source[key];
    if (raw == null) continue;
    const value = String(raw).trim();
    if (!value) continue;
    out[key] = value;
  }
  return out;
}

async function main() {
  const envPath = path.resolve(__dirname, '..', '.env');
  const envValues = readEnvFile(envPath);
  const uri = (process.env.RASHI_CONTENT_MONGODB_URI || envValues.RASHI_CONTENT_MONGODB_URI || '').trim();

  if (!uri) {
    throw new Error('RASHI_CONTENT_MONGODB_URI is required (env or api/rashi-api/.env).');
  }

  const values = pickNonEmptyValues(envValues, SAFE_KEYS);
  const client = await new MongoClient(uri).connect();
  try {
    await client.db().collection(COLLECTION).updateOne(
      { _id: DOC_ID },
      { $setOnInsert: { values } },
      { upsert: true }
    );
    console.log(
      `[upsert-runtime-config] Upsert complete for ${COLLECTION}/${DOC_ID}. Seeded keys: ${Object.keys(values).length}`
    );
    console.log('[upsert-runtime-config] Existing Mongo values are preserved; only missing docs are inserted.');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('[upsert-runtime-config] Failed:', error);
  process.exit(1);
});
