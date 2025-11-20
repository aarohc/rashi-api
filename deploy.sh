#!/bin/bash

# Azure Functions Deployment Script for rashi-api
# This script deploys the rashi-api as Azure Functions

set -e

# Configuration
FUNCTION_APP_NAME="${AZURE_FUNCTION_APP_NAME:-rashi-api-function}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rashi-api-group}"
LOCATION="${AZURE_LOCATION:-eastus}"
NODE_VERSION="~20"

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
STORAGE_ACCOUNT_NAME="${FUNCTION_APP_NAME}storage$(date +%s | tail -c 6)"
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

# Deploy the function app
echo "📤 Deploying function code..."
func azure functionapp publish "$FUNCTION_APP_NAME" --node

# Get the function app URL
FUNCTION_APP_URL=$(az functionapp show \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query defaultHostName \
    --output tsv)

echo ""
echo "✅ Deployment complete!"
echo "🌐 Function App URL: https://${FUNCTION_APP_URL}"
echo ""
echo "📝 Available endpoints:"
echo "   - POST https://${FUNCTION_APP_URL}/api/rashi"
echo "   - POST https://${FUNCTION_APP_URL}/api/vimshottari"
echo "   - POST https://${FUNCTION_APP_URL}/api/compatibility"
echo "   - POST https://${FUNCTION_APP_URL}/api/horoscope"
echo "   - GET  https://${FUNCTION_APP_URL}/api/health"
echo ""
echo "💡 Update RASHI_API_URL in cosmicconnect-api to: https://${FUNCTION_APP_URL}"

