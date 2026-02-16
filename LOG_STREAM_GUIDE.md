# Viewing rashi-api Logs (Debugging 500 Errors)

## Option 1: Log Stream (Real-time)

1. Go to [Azure Portal](https://portal.azure.com)
2. Search for **rashi-api-function** (or navigate: Resource groups → rashi-api-group → rashi-api-function)
3. In the left menu: **Monitoring** → **Log stream**
4. In another tab/terminal, hit the endpoint:
   ```bash
   curl https://rashi-api-function.azurewebsites.net/api/health
   ```
5. Watch the log stream for errors that appear when the request comes in

## What to Look For

| Error / Message | Likely Cause |
|-----------------|--------------|
| `Cannot find module 'index.js'` or `ENOENT` | Missing root index.js (we added one) |
| `Error: Cannot find module 'swisseph-v2'` | Native module failed to load (remote build issue) |
| `Did not find any initialized language workers` | Node worker crashed at startup |
| `SyntaxError` or `ReferenceError` | Bug in function code |
| `EACCES` or permission errors | File system / path issue |
| `Worker process exited` | Worker crashed; check the line just before this |

## Option 2: Diagnose and Solve (Kudu)

1. Azure Portal → rashi-api-function → **Development Tools** → **Advanced Tools** → **Go**
2. In Kudu: **Debug console** → **CMD**
3. Navigate to `site/wwwroot` and inspect:
   - `ls` – confirm `data/`, `genericPredictions/`, `health/`, etc. exist
   - `ls data/` – confirm `planet.json`, `house.json`, etc.
   - `cat package.json` – confirm dependencies

## Option 3: Enable Verbose Logging

Add this App Setting (Azure Portal → Configuration → Application settings):

- **Name:** `AzureWebJobsDisableHomeAndLog`
- **Value:** (leave empty or delete if present)

Or enable detailed errors:

- **Name:** `SCM_LOG_LEVEL`
- **Value:** `Verbose`

Save and redeploy or wait a few minutes, then check Log stream again.
