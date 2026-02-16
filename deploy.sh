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

echo ""
echo "⏳ Waiting 60s for deployment to be live (remote build needs extra spin-up time)..."
sleep 60

# Verify health endpoint (retry up to 3 times - cold start can be slow)
echo ""
echo "🔍 Verifying /api/health..."
for attempt in 1 2 3; do
    HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/health")
    HEALTH_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
    HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')
    if [ "$HEALTH_CODE" = "200" ]; then
        echo "✓ Health OK (HTTP $HEALTH_CODE)"
        break
    fi
    if [ "$attempt" -lt 3 ]; then
        echo "   Attempt $attempt failed (HTTP $HEALTH_CODE), retrying in 20s..."
        sleep 20
    else
        echo "❌ Health check failed after 3 attempts: HTTP $HEALTH_CODE"
        echo "Response: $HEALTH_BODY"
        echo ""
        echo "💡 If this persists, try destroying and recreating:"
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

echo ""
echo "✅ Deployment and verification complete!"
echo "🌐 Function App URL: ${BASE_URL}"
echo ""
echo "📝 Available endpoints:"
echo "   - GET  ${BASE_URL}/api/health"
echo "   - GET  ${BASE_URL}/api/generic-predictions"
echo "   - POST ${BASE_URL}/api/rashi"
echo "   - POST ${BASE_URL}/api/vimshottari"
echo "   - POST ${BASE_URL}/api/compatibility"
echo "   - POST ${BASE_URL}/api/horoscope"
echo ""
echo "💡 Update RASHI_API_URL in cosmicconnect-api to: ${BASE_URL}"

