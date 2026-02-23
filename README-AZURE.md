# Azure Functions Deployment - Quick Start

## After Deployment

Once you've deployed rashi-api to Azure Functions, you'll get a URL like:
```
https://rashi-api-function.azurewebsites.net
```

## Update cosmicconnect-api

After deployment, update the `RASHI_API_URL` in cosmicconnect-api:

```bash
az webapp config appsettings set \
  --name cosmicconnect-api \
  --resource-group cosmicconnect-api_group \
  --settings RASHI_API_URL="https://rashi-api-function.azurewebsites.net"
```

Replace `rashi-api-function` with your actual Function App name.

## Verify Deployment

Test the health endpoint:
```bash
curl https://rashi-api-function.azurewebsites.net/api/health
```

Test the rashi endpoint:
```bash
curl -X POST https://rashi-api-function.azurewebsites.net/api/rashi \
  -H "Content-Type: application/json" \
  -d '{
    "date": "1979-09-05",
    "time": "19:35:00",
    "lat": 21.1702,
    "lng": 72.8311,
    "timezone": 5.5
  }'
```

## Available Endpoints

- `POST /api/rashi` - Calculate Rashi positions
- `POST /api/vimshottari` - Calculate Vimshottari dasha
- `POST /api/pratyadasha` - Pratyadasha segments for a given year
- `POST /api/compatibility` - Calculate compatibility
- `POST /api/horoscope` - Generate horoscope SVG
- `GET /api/health` - Health check

