# Rashi-API Azure Functions Migration Summary

## What Was Done

### 1. Converted Express.js Server to Azure Functions
- Created 5 Azure Functions to replace Express routes:
  - `rashi` - POST /api/rashi
  - `vimshottari` - POST /api/vimshottari
  - `compatibility` - POST /api/compatibility
  - `horoscope` - POST /api/horoscope
  - `health` - GET /api/health

### 2. Created Azure Functions Structure
- `host.json` - Azure Functions host configuration
- `local.settings.json.example` - Template for local development
- `.funcignore` - Files to exclude from deployment
- Each function has its own folder with `function.json` and `index.js`

### 3. Updated Dependencies
- Added `swisseph-v2` to `package.json` dependencies

### 4. Created Deployment Scripts
- `deploy.sh` - Automated deployment script
- `DEPLOYMENT.md` - Comprehensive deployment guide
- `README-AZURE.md` - Quick reference for post-deployment steps

### 5. Updated cosmicconnect-api Configuration
- Added `RASHI_API_URL` to `azure-env-setup.sh` (with placeholder comment)
- Added `RASHI_API_URL` to `scripts/setup-azure-env.js`

## File Structure

```
rashi-api/
├── host.json                          # Azure Functions host config
├── package.json                        # Updated with swisseph-v2
├── local.settings.json.example         # Local dev template
├── .funcignore                         # Deployment exclusions
├── deploy.sh                           # Deployment script
├── DEPLOYMENT.md                       # Deployment guide
├── README-AZURE.md                     # Quick reference
├── rashi/                              # Rashi calculation function
│   ├── function.json
│   └── index.js
├── vimshottari/                        # Vimshottari dasha function
│   ├── function.json
│   └── index.js
├── compatibility/                     # Compatibility function
│   ├── function.json
│   └── index.js
├── horoscope/                          # Horoscope SVG function
│   ├── function.json
│   └── index.js
├── health/                             # Health check function
│   ├── function.json
│   └── index.js
├── utils.js                            # Shared utilities
├── compatibilityService.js              # Compatibility logic
├── vimshottariService.js               # Vimshottari logic
├── horoscopeGenerator.js               # SVG generation
└── server.js                           # Original Express server (kept for reference)
```

## Next Steps

### 1. Deploy to Azure Functions

```bash
cd api/rashi-api

# Option 1: Use the deployment script
./deploy.sh

# Option 2: Manual deployment (see DEPLOYMENT.md)
```

### 2. Update cosmicconnect-api

After deployment, you'll get a Function App URL. Update cosmicconnect-api:

```bash
az webapp config appsettings set \
  --name cosmicconnect-api \
  --resource-group cosmicconnect-api_group \
  --settings RASHI_API_URL="https://YOUR-FUNCTION-APP-NAME.azurewebsites.net"
```

### 3. Test the Deployment

```bash
# Health check
curl https://YOUR-FUNCTION-APP-NAME.azurewebsites.net/api/health

# Test rashi endpoint
curl -X POST https://YOUR-FUNCTION-APP-NAME.azurewebsites.net/api/rashi \
  -H "Content-Type: application/json" \
  -d '{
    "date": "1979-09-05",
    "time": "19:35:00",
    "lat": 21.1702,
    "lng": 72.8311,
    "timezone": 5.5
  }'
```

## Important Notes

1. **Node.js Version**: Azure Functions v4 supports Node.js 18 and 20. The deployment script uses Node.js 20.

2. **Native Dependencies**: `swisseph-v2` is a native module. Ensure it builds correctly on Azure Functions runtime.

3. **Function Timeout**: Default timeout is 5 minutes (configured in `host.json`). Adjust if needed.

4. **Local Development**: The original Express server (`server.js`) is still available for local development and testing.

5. **API Compatibility**: All endpoints maintain the same request/response format as the original Express server.

## Troubleshooting

- **Function not found**: Ensure functions are in root-level folders (not in a `functions` subfolder)
- **Module not found**: Check that all dependencies are in `package.json`
- **Timeout errors**: Increase timeout in `host.json` or use a Premium plan
- **Native module issues**: Ensure `swisseph-v2` is compatible with Azure Functions runtime

## Rollback Plan

If needed, you can:
1. Keep the original Express server (`server.js`) running
2. Deploy it as an Azure Web App instead
3. Update `RASHI_API_URL` to point back to the Web App

