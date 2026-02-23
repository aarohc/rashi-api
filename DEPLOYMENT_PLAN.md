# Rashi-API: Azure Deployment Plan

## Goal
Deploy rashi-api to Azure as an Azure Functions app so cosmicconnect-api (and other clients) can call it in production.

---

## 1. What We’re Deploying

- **App**: rashi-api (Vedic astrology: Rashi, Vimshottari, compatibility, horoscope).
- **Shape**: Azure Functions (Node.js), Consumption plan (pay-per-execution).
- **Endpoints** (under `https://<your-app>.azurewebsites.net`):
  - `GET  /api/health` – health check
  - `GET  /api/generic-predictions` – generic prediction data (planet.json + house.json)
  - `POST /api/rashi` – Rashi positions
  - `POST /api/vimshottari` – Vimshottari dasha
  - `POST /api/pratyadasha` – Pratyadasha segments for a given year
  - `POST /api/compatibility` – compatibility
  - `POST /api/horoscope` – horoscope SVG

---

## 2. Prerequisites (Before You Run Anything)

| Requirement | How to check |
|-------------|----------------|
| **Azure subscription** | [Azure Portal](https://portal.azure.com) → Subscriptions |
| **Azure CLI** | `az --version`; install: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli |
| **Logged in** | `az login` and `az account set --subscription <id>` if you have multiple |
| **Node.js** | Local: Node 22+ (for `func` tools and optional zip). Azure Function App uses Node 22. |
| **Azure Functions Core Tools** (for Option A) | `func --version` (v4). Install: `npm install -g azure-functions-core-tools@4 --unsafe-perm true` |
| **zip** (for Option B only) | `zip --version` (for CLI-only deploy) |

---

## 3. Deployment Options (Pick One)

### Option A – Deploy with Functions Core Tools (recommended)

Uses **remote build** on Azure so `npm install` (and native modules like `swisseph-v2`) run on Linux. Best for native dependencies.

1. From repo root:
   ```bash
   cd api/rashi-api
   ```
2. Ensure Azure CLI is logged in:
   ```bash
   az login
   az account set --subscription "<your-subscription-id>"   # if needed
   ```
3. (Optional) Set names and region:
   ```bash
   export AZURE_FUNCTION_APP_NAME="rashi-api-function"
   export AZURE_RESOURCE_GROUP="rashi-api-group"
   export AZURE_LOCATION="eastus"
   ```
4. Run the script (it creates resource group, storage, function app, then publishes with remote build):
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```
5. When it finishes, it prints the Function App URL. Use that as `RASHI_API_URL` (see §6).

### Option B – Deploy with Azure CLI only (zip deploy)

No `func` required; uses zip deploy. **Important**: Zip deploy can include local `node_modules`; if you build on macOS/Windows, native modules may not work on Azure (Linux). So either:

- Don’t include `node_modules` in the zip and rely on Azure build (if enabled), or  
- Prefer **Option A** so Azure runs `npm install` on the server.

If you still use Option B:

1. `cd api/rashi-api`
2. `az login` (and set subscription if needed)
3. (Optional) Set env vars as in Option A.
4. Run:
   ```bash
   chmod +x deploy-azure-cli.sh
   ./deploy-azure-cli.sh
   ```

---

## 4. One-Time Resource Creation (If Scripts Don’t Do It)

If you prefer to create resources by hand (or the script fails partway), use the same names as in the scripts:

1. **Resource group**
   ```bash
   az group create --name rashi-api-group --location eastus
   ```

2. **Storage account** (required for Functions)
   ```bash
   az storage account create \
     --name <unique-storage-name> \
     --location eastus \
     --resource-group rashi-api-group \
     --sku Standard_LRS
   ```
   Use a globally unique name (e.g. `rashiapi<random>`).

3. **Function App** (Node 22, Linux, Consumption)
   ```bash
   az functionapp create \
     --resource-group rashi-api-group \
     --consumption-plan-location eastus \
     --runtime node \
     --runtime-version 22 \
     --functions-version 4 \
     --name rashi-api-function \
     --storage-account <your-storage-name> \
     --os-type Linux
   ```

4. **Deploy code** (Option A):
   ```bash
   cd api/rashi-api
   func azure functionapp publish rashi-api-function --node
   ```

---

## 5. Node Version (Important)

- **Local repo**: `.nvmrc` / `package.json` may require Node 22.
- **Azure Functions**: Use **Node 22**. The deploy scripts are set to use Node 22 for the Function App.
- If `package.json` has a **preinstall** that enforces Node 22, it will fail on Azure when the remote build runs. Options:
  - **Recommended**: Ensure Node 22 is set in Azure (`WEBSITE_NODE_DEFAULT_VERSION` = `22`), or
  - Remove the preinstall for the deployment path only (e.g. via an env var or a separate `package.json` script for Azure).

---

## 6. After Deployment: Configure cosmicconnect-api

1. **Get the Function App URL**  
   From the script output or:
   ```bash
   az functionapp show --name rashi-api-function --resource-group rashi-api-group --query defaultHostName -o tsv
   ```
   Base URL: `https://<defaultHostName>` (e.g. `https://rashi-api-function.azurewebsites.net`).

2. **Set `RASHI_API_URL` in cosmicconnect-api**
   - **If cosmicconnect-api is an Azure Web App**:
     ```bash
     az webapp config appsettings set \
       --name <cosmicconnect-api-app-name> \
       --resource-group <cosmicconnect-api-resource-group> \
       --settings RASHI_API_URL="https://<rashi-api-defaultHostName>"
     ```
   - **Local / .env**: Add to `.env`:
     ```bash
     RASHI_API_URL=https://<rashi-api-defaultHostName>
     ```

3. **No trailing slash** – Use `https://rashi-api-function.azurewebsites.net`, not `.../`.

---

## 7. Verify Deployment

```bash
# Health
curl https://<your-function-app-host>/api/health

# Rashi (example)
curl -X POST https://<your-function-app-host>/api/rashi \
  -H "Content-Type: application/json" \
  -d '{"date":"1979-09-05","time":"19:35:00","lat":21.17,"lng":72.83,"timezone":5.5}'
```

---

## 8. Troubleshooting

| Issue | What to do |
|-------|------------|
| **403 / Not logged in** | `az login` and `az account set --subscription <id>` |
| **Native module (swisseph-v2) fails** | Use **Option A** (`deploy.sh` with `func ... publish --node`) so npm install runs on Azure (Linux). |
| **Node version error on Azure** | Set Function App to Node 22: App settings → `WEBSITE_NODE_DEFAULT_VERSION` = `22`. |
| **Zip deploy: wrong platform** | Don’t zip `node_modules` from macOS/Windows; use Option A or enable build-on-deploy so Azure runs `npm install`. |
| **Timeout** | Increase in `host.json` (`functionTimeout`). For heavy use, consider Premium or Dedicated plan. |
| **"Error creating a Blob container reference" / AzureWebJobsStorage invalid** | The Function App's storage connection string is invalid (e.g. keys rotated, storage recreated). Run `./fix-storage.sh` to refresh it from the storage account in the same resource group. Or manually: Azure Portal → Function App → Configuration → Application settings → `AzureWebJobsStorage` → set to the storage account's connection string (Storage Account → Access keys → Connection string). |

---

## 9. Checklist (Summary)

- [ ] Azure CLI installed and logged in; subscription set
- [ ] (Option A) Azure Functions Core Tools v4 installed
- [ ] `cd api/rashi-api` and run `./deploy.sh` (or Option B)
- [ ] Note the printed Function App URL
- [ ] Set `RASHI_API_URL` in cosmicconnect-api (Azure app settings or .env)
- [ ] Test `GET /api/health` and one `POST` (e.g. `/api/rashi`)
- [ ] (If needed) Verify Node 22 is supported in your Azure region

After this, rashi-api is deployed on Azure and cosmicconnect-api can call it via `RASHI_API_URL`.
