#!/bin/bash

# Destroy rashi-api Function App and resources (use when stuck or need clean redeploy)

set -e

FUNCTION_APP_NAME="${AZURE_FUNCTION_APP_NAME:-rashi-api-function}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rashi-api-group}"

echo "⚠️  This will DELETE the Function App and all resources in $RESOURCE_GROUP"
echo "   Function App: $FUNCTION_APP_NAME"
echo ""
read -p "Are you sure? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo "🗑️  Deleting Function App..."
az functionapp delete --name "$FUNCTION_APP_NAME" --resource-group "$RESOURCE_GROUP" --yes 2>/dev/null || true

echo "🗑️  Deleting resource group (Function App + Storage + all resources)..."
az group delete --name "$RESOURCE_GROUP" --yes --no-wait

echo ""
echo "✅ Delete initiated. Resource group deletion may take a few minutes."
echo "   Run './deploy.sh' when ready to recreate everything."
