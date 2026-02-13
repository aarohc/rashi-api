# Azure Functions Deployment Guide for rashi-api

This guide explains how to deploy the rashi-api as Azure Functions. For a **step-by-step deployment plan** (prerequisites, options, post-deploy, troubleshooting), see **[DEPLOYMENT_PLAN.md](./DEPLOYMENT_PLAN.md)**.

## Prerequisites

1. **Azure CLI** installed and configured
   ```bash
   az login
   az account set --subscription <your-subscription-id>
   ```

2. **Azure Functions Core Tools** installed
   ```bash
   npm install -g azure-functions-core-tools@4 --unsafe-perm true
   ```

3. **Node.js 20** (Azure Functions v4 supports Node.js 18 and 20)

## Deployment Steps

### Option 1: Using the Deployment Script

1. Set environment variables (optional):
   ```bash
   export AZURE_FUNCTION_APP_NAME="rashi-api-function"
   export AZURE_RESOURCE_GROUP="rashi-api-group"
   export AZURE_LOCATION="eastus"
   ```

2. Run the deployment script:
   ```bash
   ./deploy.sh
   ```

### Option 2: Manual Deployment

1. **Create Resource Group** (if it doesn't exist):
   ```bash
   az group create --name rashi-api-group --location eastus
   ```

2. **Create Storage Account**:
   ```bash
   az storage account create \
     --name rashi-api-storage \
     --location eastus \
     --resource-group rashi-api-group \
     --sku Standard_LRS
   ```

3. **Create Function App**:
   ```bash
   az functionapp create \
     --resource-group rashi-api-group \
     --consumption-plan-location eastus \
     --runtime node \
     --runtime-version ~20 \
     --functions-version 4 \
     --name rashi-api-function \
     --storage-account rashi-api-storage \
     --os-type Linux
   ```

4. **Deploy the Function Code**:
   ```bash
   func azure functionapp publish rashi-api-function --node
   ```

## Configuration

After deployment, you'll get a Function App URL like:
```
https://rashi-api-function.azurewebsites.net
```

## Available Endpoints

Once deployed, the following endpoints will be available:

- `POST /api/rashi` - Calculate Rashi positions
- `POST /api/vimshottari` - Calculate Vimshottari dasha
- `POST /api/compatibility` - Calculate compatibility
- `POST /api/horoscope` - Generate horoscope SVG
- `GET /api/health` - Health check

## Updating cosmicconnect-api

After deployment, update the `RASHI_API_URL` environment variable in cosmicconnect-api:

```bash
az webapp config appsettings set \
  --name cosmicconnect-api \
  --resource-group cosmicconnect-api_group \
  --settings RASHI_API_URL="https://rashi-api-function.azurewebsites.net"
```

Or add it to your `.env` file for local development:
```
RASHI_API_URL=https://rashi-api-function.azurewebsites.net
```

## Local Testing

To test the functions locally before deployment:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `local.settings.json.example` to `local.settings.json`:
   ```bash
   cp local.settings.json.example local.settings.json
   ```

3. Start the Functions runtime:
   ```bash
   func start
   ```

4. Test endpoints:
   ```bash
   curl -X POST http://localhost:7071/api/rashi \
     -H "Content-Type: application/json" \
     -d '{"date":"1979-09-05","time":"19:35:00","lat":21.1702,"lng":72.8311,"timezone":5.5}'
   ```

## Troubleshooting

### Function App not starting
- Check the logs: `az functionapp log tail --name rashi-api-function --resource-group rashi-api-group`
- Verify Node.js version: `az functionapp config appsettings list --name rashi-api-function --resource-group rashi-api-group`

### Dependencies not found
- Ensure `package.json` includes all required dependencies
- Check that native modules (like `swisseph-v2`) are compatible with Azure Functions runtime

### Timeout issues
- Increase function timeout in `host.json` if needed
- Consider using Premium or Dedicated plans for longer execution times

## Cost Considerations

Azure Functions Consumption Plan:
- First 1 million requests per month: Free
- After that: $0.20 per million requests
- Execution time: $0.000016/GB-second

For production workloads, consider:
- Premium Plan for better performance
- Dedicated (App Service) Plan for consistent performance

