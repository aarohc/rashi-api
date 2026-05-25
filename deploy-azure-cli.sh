#!/bin/bash

# Azure Functions Deployment Script using Azure CLI (no func tools required)
# This script deploys the rashi-api as Azure Functions using zip deployment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Configuration
FUNCTION_APP_NAME="${AZURE_FUNCTION_APP_NAME:-rashi-api-function}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rashi-api-group}"
LOCATION="${AZURE_LOCATION:-eastus}"
NODE_VERSION="22"
# Fixed storage account name so we reuse on redeploy (override with AZURE_STORAGE_ACCOUNT_NAME). 3-24 chars, lowercase alphanumeric.
STORAGE_ACCOUNT_NAME="${AZURE_STORAGE_ACCOUNT_NAME:-rashiastrovoyages}"

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
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" 2>/dev/null || echo "Resource group already exists"

# Create storage account (required for Azure Functions)
echo "💾 Creating storage account: $STORAGE_ACCOUNT_NAME"
if az storage account show --name "$STORAGE_ACCOUNT_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
    echo "Storage account already exists"
else
    az storage account create \
        --name "$STORAGE_ACCOUNT_NAME" \
        --location "$LOCATION" \
        --resource-group "$RESOURCE_GROUP" \
        --sku Standard_LRS
fi

# Create Function App
echo "⚡ Creating Function App..."
if az functionapp show --name "$FUNCTION_APP_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
    echo "Function App already exists"
else
    az functionapp create \
        --resource-group "$RESOURCE_GROUP" \
        --consumption-plan-location "$LOCATION" \
        --runtime node \
        --runtime-version "$NODE_VERSION" \
        --functions-version 4 \
        --name "$FUNCTION_APP_NAME" \
        --storage-account "$STORAGE_ACCOUNT_NAME" \
        --os-type Linux
fi

# Set Node version
echo "🔧 Setting Node.js version..."
az functionapp config appsettings set \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --settings WEBSITE_NODE_DEFAULT_VERSION="$NODE_VERSION" 2>/dev/null || true

# Install dependencies (optional - Azure will install during deployment)
echo "📥 Installing dependencies (if npm is available)..."
if command -v npm &> /dev/null && [ -f "package.json" ]; then
    npm install --production
else
    echo "⚠️  npm not found, Azure will install dependencies during deployment"
fi

echo "📎 Syncing shared/app-locale-registry into function app directory..."
rm -rf "$SCRIPT_DIR/shared-app-locale-registry"
cp -R "$REPO_ROOT/shared/app-locale-registry" "$SCRIPT_DIR/shared-app-locale-registry"

# Create deployment package
echo "📦 Creating deployment package..."
DEPLOYMENT_ZIP="deployment.zip"

# Create zip file excluding unnecessary files
if command -v zip &> /dev/null; then
    zip -r "$DEPLOYMENT_ZIP" . \
        -x "*.git*" \
        -x "node_modules/.cache/*" \
        -x "*.log" \
        -x ".DS_Store" \
        -x "deployment.zip" \
        -x ".vscode/*" \
        -x "*.test.js" \
        -x "coverage/*" 2>/dev/null || true
else
    echo "⚠️  zip command not found. Please install zip or use Azure Functions Core Tools."
    echo "   Alternative: Install Azure Functions Core Tools:"
    echo "   npm install -g azure-functions-core-tools@4 --unsafe-perm true"
    echo "   Then run: func azure functionapp publish $FUNCTION_APP_NAME"
    exit 1
fi

# Deploy using zip
if [ -f "$DEPLOYMENT_ZIP" ]; then
    echo "📤 Deploying function code..."
    az functionapp deployment source config-zip \
        --resource-group "$RESOURCE_GROUP" \
        --name "$FUNCTION_APP_NAME" \
        --src "$DEPLOYMENT_ZIP"
    
    # Clean up
    rm -f "$DEPLOYMENT_ZIP"
    echo "✅ Deployment package uploaded successfully"
else
    echo "❌ Failed to create deployment package"
    exit 1
fi

# Get the function app URL
FUNCTION_APP_URL=$(az functionapp show \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query defaultHostName \
    --output tsv)

BASE_URL="https://${FUNCTION_APP_URL}"

echo ""
echo "⏳ Waiting 30s for deployment to be live..."
sleep 30

# Verify health endpoint
echo ""
echo "🔍 Verifying /api/health..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/health")
HEALTH_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')
if [ "$HEALTH_CODE" != "200" ]; then
    echo "❌ Health check failed: HTTP $HEALTH_CODE"
    echo "Response: $HEALTH_BODY"
    exit 1
fi
echo "✓ Health OK (HTTP $HEALTH_CODE)"

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

