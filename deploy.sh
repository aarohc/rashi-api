#!/bin/bash

# Azure Functions Deployment Script for rashi-api
# This script deploys the rashi-api as Azure Functions

set -e

# Configuration
FUNCTION_APP_NAME="${AZURE_FUNCTION_APP_NAME:-rashi-api-function}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rashi-api-group}"
LOCATION="${AZURE_LOCATION:-eastus}"
NODE_VERSION="22"

echo "🚀 Deploying rashi-api to Azure Functions..."
echo "Function App Name: $FUNCTION_APP_NAME"
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI is not installed. Please install it first."
    exit 1
fi

# Login check
echo "📋 Checking Azure login status..."
if ! az account show &> /dev/null; then
    echo "⚠️  Not logged in to Azure. Please run: az login"
    exit 1
fi

# Create resource group if it doesn't exist
echo "📦 Creating resource group if it doesn't exist..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" || true

# Use a fixed storage account name so we reuse the same account on redeploy (required for Azure Functions).
# Override with AZURE_STORAGE_ACCOUNT_NAME if needed (e.g. name taken globally). Azure: 3-24 chars, lowercase alphanumeric.
STORAGE_ACCOUNT_NAME="${AZURE_STORAGE_ACCOUNT_NAME:-rashiastrovoyages}"
echo "💾 Using storage account: $STORAGE_ACCOUNT_NAME"
if az storage account show --name "$STORAGE_ACCOUNT_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
    echo "   (already exists in $RESOURCE_GROUP, reusing)"
else
    echo "   Creating in $RESOURCE_GROUP..."
    az storage account create \
        --name "$STORAGE_ACCOUNT_NAME" \
        --location "$LOCATION" \
        --resource-group "$RESOURCE_GROUP" \
        --sku Standard_LRS
fi

# Create Function App
echo "⚡ Creating Function App..."
az functionapp create \
    --resource-group "$RESOURCE_GROUP" \
    --consumption-plan-location "$LOCATION" \
    --runtime node \
    --runtime-version "$NODE_VERSION" \
    --functions-version 4 \
    --name "$FUNCTION_APP_NAME" \
    --storage-account "$STORAGE_ACCOUNT_NAME" \
    --os-type Linux || echo "Function App may already exist, continuing..."

# Set Node version
echo "🔧 Setting Node.js version..."
az functionapp config appsettings set \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --settings WEBSITE_NODE_DEFAULT_VERSION="$NODE_VERSION" || true

# Ensure the app is started (in case it was stopped)
echo "▶️  Ensuring Function App is started..."
az functionapp start --name "$FUNCTION_APP_NAME" --resource-group "$RESOURCE_GROUP" 2>/dev/null || true

# Bundle shared numerology-core (monorepo path not present in Azure publish zip)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
echo "📎 Syncing shared/numerology-core into function app directory..."
rm -rf "$SCRIPT_DIR/shared-numerology-core"
cp -R "$REPO_ROOT/shared/numerology-core" "$SCRIPT_DIR/shared-numerology-core"

echo "📎 Syncing shared/app-locale-registry into function app directory..."
rm -rf "$SCRIPT_DIR/shared-app-locale-registry"
cp -R "$REPO_ROOT/shared/app-locale-registry" "$SCRIPT_DIR/shared-app-locale-registry"

# Deploy the function app (--build remote: npm install runs on Azure Linux, fixes native modules like swisseph-v2)
echo "📤 Deploying function code..."
func azure functionapp publish "$FUNCTION_APP_NAME" --node --build remote

# Get the function app URL
FUNCTION_APP_URL=$(az functionapp show \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query defaultHostName \
    --output tsv)

BASE_URL="https://${FUNCTION_APP_URL}"
echo "   Base URL: $BASE_URL"

# Remote build can take 2–3+ minutes; wait before health check
echo ""
echo "⏳ Waiting 120s for deployment and remote build to finish..."
sleep 120

# ---------------------------------------------------------------------------
# Post-deploy: verify every HTTP trigger (catches 404 / missing function)
# ---------------------------------------------------------------------------
RASHI_BIRTH_JSON='{"date":"1990-01-15","time":"10:30:00","lat":28.6,"lng":77.2,"timezone":5.5}'
PRATYADASHA_JSON='{"date":"1990-01-15","time":"10:30:00","lat":28.6,"lng":77.2,"timezone":5.5,"year":2025}'
COMPAT_TWO_JSON='{"person1":{"date":"1990-01-15","time":"10:30:00","lat":28.6,"lng":77.2,"timezone":5.5},"person2":{"date":"1990-01-15","time":"10:30:00","lat":28.6,"lng":77.2,"timezone":5.5}}'
COMPAT_WITH_NAMES_JSON='{"person1":{"date":"1990-05-15","time":"10:30:00","lat":28.6,"lng":77.2,"timezone":5.5,"name":"Arjun"},"person2":{"date":"1992-08-20","time":"11:00:00","lat":19.076,"lng":72.877,"timezone":5.5,"name":"Priya"}}'
SHANI_JSON='{"date":"1990-01-15","time":"10:30:00","lat":28.6,"lng":77.2,"timezone":5.5,"windowStart":"2020-01-01","windowEnd":"2025-12-31"}'
FAMILY_DASHA_JSON='{"members":[{"id":"t","displayName":"Test","date":"1990-01-15","time":"10:30:00","lat":28.6,"lng":77.2,"timezone":5.5}],"windowStart":"2025-01-01T00:00:00.000Z","windowEnd":"2026-01-01T00:00:00.000Z"}'
PANCHANG_JSON='{"date":"1990-01-15","lat":28.6,"lng":77.2,"timezone":5.5}'
CHOGHADIYA_JSON='{"date":"2026-04-18","time":"10:30:00","lat":19.076,"lng":72.8777,"timezone":5.5}'

rashi_verify_post() {
  local label="$1"
  local path="$2"
  local payload="$3"
  local pattern="$4"
  echo "🔍 Verifying ${path}..."
  local raw code body
  raw=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}${path}" \
    -H "Content-Type: application/json" \
    -d "$payload")
  code=$(echo "$raw" | tail -n1)
  body=$(echo "$raw" | sed '$d')
  if [ "$code" != "200" ]; then
    echo "❌ ${label} failed: HTTP $code"
    echo "$body"
    exit 1
  fi
  # Use ERE so JSON can be minified ("success":true) or pretty ("success": true)
  if [ -n "$pattern" ] && ! echo "$body" | grep -Eq "$pattern"; then
    echo "❌ ${label}: response missing pattern ${pattern}"
    echo "$(echo "$body" | head -c 600)"
    exit 1
  fi
  echo "✓ ${label} OK (HTTP $code)"
}

# Verify health endpoint (retry up to 4 times - cold start and sync can be slow)
echo ""
echo "🔍 Verifying /api/health..."
for attempt in 1 2 3 4; do
    HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/health")
    HEALTH_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
    HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')
    if [ "$HEALTH_CODE" = "200" ]; then
        echo "✓ Health OK (HTTP $HEALTH_CODE)"
        break
    fi
    if [ "$attempt" -lt 4 ]; then
        echo "   Attempt $attempt failed (HTTP $HEALTH_CODE), retrying in 30s..."
        sleep 30
    else
        echo "❌ Health check failed after 4 attempts: HTTP $HEALTH_CODE"
        echo "   URL tried: ${BASE_URL}/api/health"
        echo "   Response: $HEALTH_BODY"
        echo ""
        echo "💡 Check in Azure Portal:"
        echo "   - Function App $FUNCTION_APP_NAME → Overview → ensure Status is Running"
        echo "   - Deployment Center → confirm latest deploy succeeded"
        echo "   - Log stream for startup errors"
        echo ""
        echo "   To destroy and recreate:"
        echo "   az functionapp delete --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP"
        echo "   Then run ./deploy.sh again"
        exit 1
    fi
done

echo ""
echo "Verifying all API routes (every function.json route)..."

echo "🔍 Verifying /api/generic-predictions..."
GEN_RAW=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/generic-predictions")
GEN_CODE=$(echo "$GEN_RAW" | tail -n1)
GEN_BODY=$(echo "$GEN_RAW" | sed '$d')
if [ "$GEN_CODE" != "200" ]; then
  echo "❌ generic-predictions failed: HTTP $GEN_CODE"
  echo "$GEN_BODY"
  exit 1
fi
for needle in planetInHouse shaniMoonPhases; do
  if ! echo "$GEN_BODY" | grep -q "$needle"; then
    echo "❌ generic-predictions response missing ${needle}"
    echo "$(echo "$GEN_BODY" | head -c 600)"
    exit 1
  fi
done
echo "✓ generic-predictions OK (HTTP $GEN_CODE)"

rashi_verify_post "rashi" "/api/rashi" "$RASHI_BIRTH_JSON" 'Ascendant'
rashi_verify_post "vimshottari" "/api/vimshottari" "$RASHI_BIRTH_JSON" 'mahaDashas'
rashi_verify_post "pratyadasha" "/api/pratyadasha" "$PRATYADASHA_JSON" 'pratyadashaSegments'
rashi_verify_post "mudda-dasha" "/api/mudda-dasha" "$PRATYADASHA_JSON" 'muddaSegments'
rashi_verify_post "yogas" "/api/yogas" "$RASHI_BIRTH_JSON" '"yogas"'
rashi_verify_post "panchang" "/api/panchang" "$PANCHANG_JSON" 'sunriseUtc'
rashi_verify_post "shani-moon-transit" "/api/shani-moon-transit" "$SHANI_JSON" 'currentPhase'
rashi_verify_post "ashtakoot" "/api/ashtakoot" "$COMPAT_TWO_JSON" 'nakshatra'
rashi_verify_post "compatibility (no names)" "/api/compatibility" "$COMPAT_TWO_JSON" '"numerology"'
rashi_verify_post "compatibility (with names/numerology)" "/api/compatibility" "$COMPAT_WITH_NAMES_JSON" '"lifePath"'
# Verify the pair summary is present (cross-checks compatibility-lookup.json was bundled)
rashi_verify_post "compatibility (pair summary)" "/api/compatibility" "$COMPAT_WITH_NAMES_JSON" '"pair"'
rashi_verify_post "family-dasha-window" "/api/family-dasha-window" "$FAMILY_DASHA_JSON" '"lanes"'
rashi_verify_post "choghadiya" "/api/choghadiya" "$CHOGHADIYA_JSON" '"day"'
rashi_verify_post "planetaspects" "/api/planetaspects" "$RASHI_BIRTH_JSON" 'aspectsByPlanet'

echo "🔍 Verifying /api/horoscope (JSON)..."
HORO_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/horoscope" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$RASHI_BIRTH_JSON")
HORO_CODE=$(echo "$HORO_RESPONSE" | tail -n1)
HORO_BODY=$(echo "$HORO_RESPONSE" | sed '$d')
if [ "$HORO_CODE" != "200" ]; then
  echo "❌ horoscope failed: HTTP $HORO_CODE"
  echo "$HORO_BODY"
  exit 1
fi
if ! echo "$HORO_BODY" | grep -q '"svg"'; then
  echo "❌ horoscope JSON missing svg"
  echo "$(echo "$HORO_BODY" | head -c 600)"
  exit 1
fi
echo "✓ horoscope OK (HTTP $HORO_CODE)"

echo ""
echo "✅ Deployment and verification complete!"
echo "🌐 Function App URL: ${BASE_URL}"
echo ""
echo "📝 Available endpoints (all verified above after publish):"
echo "   - GET  ${BASE_URL}/api/health"
echo "   - GET  ${BASE_URL}/api/generic-predictions"
echo "   - POST ${BASE_URL}/api/rashi"
echo "   - POST ${BASE_URL}/api/vimshottari"
echo "   - POST ${BASE_URL}/api/pratyadasha"
echo "   - POST ${BASE_URL}/api/mudda-dasha"
echo "   - POST ${BASE_URL}/api/yogas"
echo "   - POST ${BASE_URL}/api/panchang"
echo "   - POST ${BASE_URL}/api/shani-moon-transit"
echo "   - POST ${BASE_URL}/api/ashtakoot"
echo "   - POST ${BASE_URL}/api/compatibility  (optional name fields → numerology block with lifePath, Chaldean, pair summary)"
echo "   - POST ${BASE_URL}/api/family-dasha-window"
echo "   - POST ${BASE_URL}/api/choghadiya"
echo "   - POST ${BASE_URL}/api/planetaspects"
echo "   - POST ${BASE_URL}/api/horoscope"
echo ""
echo "💡 Update RASHI_API_URL in cosmicconnect-api (and production env) to: ${BASE_URL}"

