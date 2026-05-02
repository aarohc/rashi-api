#!/bin/bash

# List storage accounts in the rashi-api resource group and show which one the Function App uses.
# Use this to find and then delete unnecessary (orphaned) storage accounts from past deploys.

set -e

RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rashi-api-group}"
FUNCTION_APP_NAME="${AZURE_FUNCTION_APP_NAME:-rashi-api-function}"

echo "📋 Storage accounts in resource group: $RESOURCE_GROUP"
echo ""

if ! az account show &>/dev/null; then
    echo "❌ Not logged in. Run: az login"
    exit 1
fi

# Storage account currently used by the Function App (from its app settings)
IN_USE=""
if az functionapp show --name "$FUNCTION_APP_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
    IN_USE=$(az functionapp show --name "$FUNCTION_APP_NAME" --resource-group "$RESOURCE_GROUP" \
        --query "storageAccount" -o tsv 2>/dev/null || true)
    if [ -z "$IN_USE" ]; then
        # Fallback: AzureWebJobsStorage contains the connection string; account name is in it
        CONN=$(az functionapp config appsettings list --name "$FUNCTION_APP_NAME" --resource-group "$RESOURCE_GROUP" \
            --query "[?name=='AzureWebJobsStorage'].value" -o tsv 2>/dev/null || true)
        if [ -n "$CONN" ]; then
            # Connection string format: AccountName=xxx;...
            IN_USE=$(echo "$CONN" | sed -n 's/.*AccountName=\([^;]*\).*/\1/p')
        fi
    fi
fi

echo "Current Function App storage (in use): ${IN_USE:-<none or unknown>}"
echo ""

az storage account list --resource-group "$RESOURCE_GROUP" -o table

echo ""
echo "To delete an unused storage account (after confirming it's not in use):"
echo "  az storage account delete --name <STORAGE_ACCOUNT_NAME> --resource-group $RESOURCE_GROUP --yes"
echo ""
echo "To delete all storage accounts except the one in use (review carefully first):"
echo "  for name in \$(az storage account list -g $RESOURCE_GROUP --query \"[?name!='$IN_USE'].name\" -o tsv); do"
echo "    az storage account delete --name \"\$name\" --resource-group $RESOURCE_GROUP --yes"
echo "  done"
echo ""
echo "💡 After deleting unused accounts, future deploys use the fixed name (rashiastrovoyages by default)."
