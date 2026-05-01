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

# Verify generic-predictions endpoint
echo "🔍 Verifying /api/generic-predictions..."
GENERIC_RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/generic-predictions")
GENERIC_CODE=$(echo "$GENERIC_RESPONSE" | tail -n1)
GENERIC_BODY=$(echo "$GENERIC_RESPONSE" | sed '$d')
if [ "$GENERIC_CODE" != "200" ]; then
    echo "❌ generic-predictions failed: HTTP $GENERIC_CODE"
    echo "Response: $(echo "$GENERIC_BODY" | head -c 500)"
    exit 1
fi
if ! echo "$GENERIC_BODY" | grep -q '"planetInHouse"'; then
    echo "❌ generic-predictions response missing planetInHouse"
    echo "Response: $(echo "$GENERIC_BODY" | head -c 500)"
    exit 1
fi
if ! echo "$GENERIC_BODY" | grep -q '"shaniMoonPhases"'; then
    echo "❌ generic-predictions response missing shaniMoonPhases"
    echo "Response: $(echo "$GENERIC_BODY" | head -c 500)"
    exit 1
fi
echo "✓ generic-predictions OK (HTTP $GENERIC_CODE)"

# Verify pratyadasha endpoint (POST with minimal valid payload)
echo "🔍 Verifying /api/pratyadasha..."
PRATYADASHA_PAYLOAD='{"date":"1990-01-15","time":"10:30:00","lat":28.6,"lng":77.2,"timezone":5.5,"year":2025}'
PRATYADASHA_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/pratyadasha" -H "Content-Type: application/json" -d "$PRATYADASHA_PAYLOAD")
PRATYADASHA_CODE=$(echo "$PRATYADASHA_RESPONSE" | tail -n1)
PRATYADASHA_BODY=$(echo "$PRATYADASHA_RESPONSE" | sed '$d')
if [ "$PRATYADASHA_CODE" != "200" ]; then
    echo "❌ pratyadasha failed: HTTP $PRATYADASHA_CODE"
    echo "Full response body:"
    echo "$PRATYADASHA_BODY"
    echo "---"
    exit 1
fi
if ! echo "$PRATYADASHA_BODY" | grep -q 'pratyadashaSegments'; then
    echo "❌ pratyadasha response missing pratyadashaSegments"
    echo "Response: $(echo "$PRATYADASHA_BODY" | head -c 500)"
    exit 1
fi
echo "✓ pratyadasha OK (HTTP $PRATYADASHA_CODE)"

echo "🔍 Verifying /api/mudda-dasha..."
MUDDA_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/mudda-dasha" -H "Content-Type: application/json" -d "$PRATYADASHA_PAYLOAD")
MUDDA_CODE=$(echo "$MUDDA_RESPONSE" | tail -n1)
MUDDA_BODY=$(echo "$MUDDA_RESPONSE" | sed '$d')
if [ "$MUDDA_CODE" != "200" ]; then
    echo "❌ mudda-dasha failed: HTTP $MUDDA_CODE"
    echo "Full response body:"
    echo "$MUDDA_BODY"
    echo "---"
    exit 1
fi
if ! echo "$MUDDA_BODY" | grep -q 'muddaSegments'; then
    echo "❌ mudda-dasha response missing muddaSegments"
    echo "Response: $(echo "$MUDDA_BODY" | head -c 500)"
    exit 1
fi
echo "✓ mudda-dasha OK (HTTP $MUDDA_CODE)"

echo "🔍 Verifying /api/shani-moon-transit..."
SHANI_PAYLOAD='{"date":"1990-01-15","time":"10:30:00","lat":28.6,"lng":77.2,"timezone":5.5,"windowStart":"2020-01-01","windowEnd":"2025-12-31"}'
SHANI_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/shani-moon-transit" -H "Content-Type: application/json" -d "$SHANI_PAYLOAD")
SHANI_CODE=$(echo "$SHANI_RESPONSE" | tail -n1)
SHANI_BODY=$(echo "$SHANI_RESPONSE" | sed '$d')
if [ "$SHANI_CODE" != "200" ]; then
    echo "❌ shani-moon-transit failed: HTTP $SHANI_CODE"
    echo "Full response body:"
    echo "$SHANI_BODY"
    echo "---"
    exit 1
fi
if ! echo "$SHANI_BODY" | grep -q 'currentPhase'; then
    echo "❌ shani-moon-transit response missing currentPhase"
    echo "Response: $(echo "$SHANI_BODY" | head -c 500)"
    exit 1
fi
echo "✓ shani-moon-transit OK (HTTP $SHANI_CODE)"

echo "🔍 Verifying /api/ashtakoot..."
COMPAT_PAYLOAD='{"person1":{"date":"1990-01-15","time":"10:30:00","lat":28.6,"lng":77.2,"timezone":5.5},"person2":{"date":"1990-01-15","time":"10:30:00","lat":28.6,"lng":77.2,"timezone":5.5}}'
ASHTAKOOT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/ashtakoot" -H "Content-Type: application/json" -d "$COMPAT_PAYLOAD")
ASHTAKOOT_CODE=$(echo "$ASHTAKOOT_RESPONSE" | tail -n1)
ASHTAKOOT_BODY=$(echo "$ASHTAKOOT_RESPONSE" | sed '$d')
if [ "$ASHTAKOOT_CODE" != "200" ]; then
    echo "❌ ashtakoot failed: HTTP $ASHTAKOOT_CODE"
    echo "Full response body:"
    echo "$ASHTAKOOT_BODY"
    echo "---"
    exit 1
fi
if ! echo "$ASHTAKOOT_BODY" | grep -q 'nakshatra'; then
    echo "❌ ashtakoot response missing nakshatra"
    echo "Response: $(echo "$ASHTAKOOT_BODY" | head -c 500)"
    exit 1
fi
echo "✓ ashtakoot OK (HTTP $ASHTAKOOT_CODE)"

echo "🔍 Verifying /api/choghadiya..."
CHOGHADIYA_PAYLOAD='{"date":"2026-04-18","time":"10:30:00","lat":19.076,"lng":72.8777,"timezone":5.5}'
CHOGHADIYA_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/choghadiya" -H "Content-Type: application/json" -d "$CHOGHADIYA_PAYLOAD")
CHOGHADIYA_CODE=$(echo "$CHOGHADIYA_RESPONSE" | tail -n1)
CHOGHADIYA_BODY=$(echo "$CHOGHADIYA_RESPONSE" | sed '$d')
if [ "$CHOGHADIYA_CODE" != "200" ]; then
    echo "❌ choghadiya failed: HTTP $CHOGHADIYA_CODE"
    echo "Full response body:"
    echo "$CHOGHADIYA_BODY"
    echo "---"
    exit 1
fi
if ! echo "$CHOGHADIYA_BODY" | grep -q '"day"'; then
    echo "❌ choghadiya response missing day segments"
    echo "Response: $(echo "$CHOGHADIYA_BODY" | head -c 500)"
    exit 1
fi
echo "✓ choghadiya OK (HTTP $CHOGHADIYA_CODE)"

echo "🔍 Verifying /api/planetaspects..."
PLANETASPECTS_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/planetaspects" -H "Content-Type: application/json" -d "$PRATYADASHA_PAYLOAD")
PLANETASPECTS_CODE=$(echo "$PLANETASPECTS_RESPONSE" | tail -n1)
PLANETASPECTS_BODY=$(echo "$PLANETASPECTS_RESPONSE" | sed '$d')
if [ "$PLANETASPECTS_CODE" != "200" ]; then
    echo "❌ planetaspects failed: HTTP $PLANETASPECTS_CODE"
    echo "Full response body:"
    echo "$PLANETASPECTS_BODY"
    echo "---"
    exit 1
fi
if ! echo "$PLANETASPECTS_BODY" | grep -q 'aspectsByPlanet'; then
    echo "❌ planetaspects response missing aspectsByPlanet"
    echo "Response: $(echo "$PLANETASPECTS_BODY" | head -c 500)"
    exit 1
fi
echo "✓ planetaspects OK (HTTP $PLANETASPECTS_CODE)"

echo ""
echo "✅ Deployment and verification complete!"
echo "🌐 Function App URL: ${BASE_URL}"
echo ""
echo "📝 Available endpoints:"
echo "   - GET  ${BASE_URL}/api/health"
echo "   - GET  ${BASE_URL}/api/generic-predictions"
echo "   - POST ${BASE_URL}/api/rashi"
echo "   - POST ${BASE_URL}/api/vimshottari"
echo "   - POST ${BASE_URL}/api/pratyadasha"
echo "   - POST ${BASE_URL}/api/mudda-dasha"
echo "   - POST ${BASE_URL}/api/shani-moon-transit"
echo "   - POST ${BASE_URL}/api/compatibility"
echo "   - POST ${BASE_URL}/api/ashtakoot"
echo "   - POST ${BASE_URL}/api/choghadiya"
echo "   - POST ${BASE_URL}/api/planetaspects"
echo "   - POST ${BASE_URL}/api/horoscope"
echo ""
echo "💡 Update RASHI_API_URL in cosmicconnect-api (and production env) to: ${BASE_URL}"

