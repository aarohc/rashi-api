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

# Create storage account (required for Azure Functions)
# Azure limit: 3-24 chars, lowercase alphanumeric only
STORAGE_SUFFIX=$(date +%s | tail -c 6)
STORAGE_ACCOUNT_NAME="rashi${STORAGE_SUFFIX}"
echo "💾 Creating storage account: $STORAGE_ACCOUNT_NAME"
az storage account create \
    --name "$STORAGE_ACCOUNT_NAME" \
    --location "$LOCATION" \
    --resource-group "$RESOURCE_GROUP" \
    --sku Standard_LRS || true

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
echo "   - POST ${BASE_URL}/api/compatibility"
echo "   - POST ${BASE_URL}/api/horoscope"
echo ""
echo "💡 Update RASHI_API_URL in cosmicconnect-api (and production env) to: ${BASE_URL}"

