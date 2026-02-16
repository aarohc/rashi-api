#!/bin/bash

# Fix AzureWebJobsStorage for rashi-api-function
# Run this when deployment fails with: "Error creating a Blob container reference"

set -e

FUNCTION_APP_NAME="${AZURE_FUNCTION_APP_NAME:-rashi-api-function}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rashi-api-group}"

echo "🔧 Fixing AzureWebJobsStorage for $FUNCTION_APP_NAME in $RESOURCE_GROUP"
echo ""

# Check Azure CLI
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI not installed. Install from: https://docs.microsoft.com/cli/azure/install-azure-cli"
    exit 1
fi

if ! az account show &> /dev/null; then
    echo "❌ Not logged in. Run: az login"
    exit 1
fi

# Use storage account from env, or find one in the resource group
if [ -n "$AZURE_STORAGE_ACCOUNT" ]; then
    STORAGE_ACCOUNT="$AZURE_STORAGE_ACCOUNT"
    echo "📋 Using storage account from AZURE_STORAGE_ACCOUNT: $STORAGE_ACCOUNT"
else
    echo "📋 Finding storage account in resource group..."
    STORAGE_ACCOUNT=$(az storage account list \
        --resource-group "$RESOURCE_GROUP" \
        --query "[0].name" -o tsv)
fi

if [ -z "$STORAGE_ACCOUNT" ] || [ "$STORAGE_ACCOUNT" == "None" ]; then
    echo "❌ No storage account found in $RESOURCE_GROUP."
    echo "   Create one with:"
    echo "   az storage account create --name rashiStorage\$(date +%s | tail -c 6) \\"
    echo "     --resource-group $RESOURCE_GROUP --location eastus --sku Standard_LRS"
    exit 1
fi

echo "   Using storage account: $STORAGE_ACCOUNT"
echo ""

# Get connection string
echo "🔑 Retrieving connection string..."
CONN_STRING=$(az storage account show-connection-string \
    --name "$STORAGE_ACCOUNT" \
    --resource-group "$RESOURCE_GROUP" \
    --query connectionString -o tsv)

if [ -z "$CONN_STRING" ]; then
    echo "❌ Failed to get connection string for $STORAGE_ACCOUNT"
    exit 1
fi

# Update Function App
echo "📤 Updating AzureWebJobsStorage on Function App..."
az functionapp config appsettings set \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --settings AzureWebJobsStorage="$CONN_STRING" \
    --output none

echo ""
echo "✅ AzureWebJobsStorage updated successfully."
echo "   Try deploying again:"
echo "   func azure functionapp publish $FUNCTION_APP_NAME --node"
echo ""
