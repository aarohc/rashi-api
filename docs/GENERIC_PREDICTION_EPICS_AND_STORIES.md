# Generic Rashi-Based Predictions — Epics & User Stories

Converted from [GENERIC_PREDICTION_PLAN.md](../../../docs/GENERIC_PREDICTION_PLAN.md). Use this for execution and tracking.

---

## Epic 1: Rashi API returns house number per planet ✅ DONE

**Goal:** Consumers can know which house each planet is in (from Lagna), so generic planet and house predictions can be looked up on the fly.

| ID | User Story | Acceptance criteria | Status |
|----|------------|---------------------|--------|
| 1.1 | As a **consumer of the rashi API**, I want each planet in the `POST /api/rashi` response to include `house_number` (1–12) so that I can compute generic predictions without recalculating house positions. | • `house_number` present for Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu (and optionally Uranus, Neptune, Pluto). • Value is 1–12. • Calculation uses Lagna (Ascendant) longitude; same logic as existing horoscope/planetaspects (e.g. `calculateHouseNumber(planetLongitude, lagnaLongitude)`). | ✅ |
| 1.2 | As a **consumer**, I want the Ascendant in the rashi response to include `current_sign` (or equivalent) so that I can compute the rashi (sign) for each house (House 1 = Lagna sign, House 2 = next, …). | • Ascendant/Lagna sign number (1–12) is available in the response (e.g. `data.Ascendant.current_sign`). | ✅ (already present) |
| 1.3 | As a **maintainer**, I want the Azure function `rashi/index.js` (if in use) to also return `house_number` per planet so that all entry points are consistent. | • If the app uses the Azure function for rashi, its response is updated to include `house_number`; otherwise N/A. | ✅ |

---

## Epic 2: Generic prediction content (planet-in-house & house-by-rashi)

**Goal:** Fixed generic texts for (planet, house) and (house, rashi) live in rashi-api so predictions can be served by lookup only. **Content generation is done**; remaining work is documentation and ensuring consumers handle missing keys.

**Current state:** `data/planet.json` (planet-in-house) and `data/house.json` (house-by-rashi) exist with full content. House prediction is **by rashi** (sign on the house from Ascendant), not by combining planets.

| ID | User Story | Acceptance criteria | Status |
|----|------------|---------------------|--------|
| 2.1 | As a **content owner**, I want **planet-in-house** generic texts (9 planets × 12 houses = 108) in rashi-api so we can serve one generic prediction per planet per user. | • File `data/planet.json` with structure `[planet][house]` (keys "1".."12" per planet). • All 9 planets: Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu. | Done |
| 2.2 | As a **content owner**, I want **house-by-rashi** generic texts (12 houses × 12 rashi = 144) so we can serve one generic prediction per house per user (by sign on the house, not by combining planets). | • File `data/house.json` with structure `[house][rashi]` (house "1".."12", rashi "1".."12"). • 144 entries; each house prediction = single lookup by rashi of that house. | Done |
| 2.3 | As a **developer**, I want the JSON schema and usage documented so that content can be updated and consumers know the shape. | • README or docs describe `planet.json` and `house.json` shape, keys, and how they are used (planet lookup vs house-by-rashi formula). | Done |
| 2.4 | As a **product owner**, I want missing (planet, house) or (house, rashi) keys handled gracefully so we can ship and add content incrementally later. | • Lookup logic in Epic 4 returns null/empty or skips missing keys; no crash. | Done (Epic 4) |

---

## Epic 3: Rashi API serves generic prediction data

**Goal:** Rashi-api exposes `planet.json` and `house.json` so that cosmicconnect-api or the client can fetch them and perform lookups.

| ID | User Story | Acceptance criteria | Status |
|----|------------|---------------------|--------|
| 3.1 | As a **consumer**, I want to get generic prediction data (planet + house JSON) from rashi-api so I do not duplicate content. | • Either: (A) a GET endpoint (e.g. `GET /api/generic-predictions` or separate GETs) returns the JSON from `data/planet.json` and `data/house.json`, or (B) these are embedded in another response. • Response is valid JSON; structure matches planet.json (planetInHouse) and house.json (houseByRashi). | Done |
| 3.2 | As a **consumer**, I want the endpoint(s) documented (e.g. Swagger) so I can integrate reliably. | • Route(s) documented in rashi-api (e.g. server.js Swagger or OpenAPI). | Done |

---

## Epic 4: Cosmicconnect-api builds and serves generic predictions

**Goal:** Given a user’s rashi (`house_number` per planet and Ascendant `current_sign`), cosmicconnect-api returns generic predictions for **planets** (lookup by planet + house) and **houses** (lookup by house + rashi of that house). No combining of planet texts for houses.

| ID | User Story | Acceptance criteria | Status |
|----|------------|---------------------|--------|
| 4.1 | As a **backend developer**, I want a module that, given rashi data, returns **planet generic predictions** by looking up `planet[planetName][house_number]` for each planet. | • Input: rashi object (with `house_number` per planet). Output: list or map of planet → generic text (from planet.json). • Uses data from rashi-api or local copy of planet.json. • Handles missing keys without crashing. | Done |
| 4.2 | As a **backend developer**, I want the same (or same module) to return **house generic predictions** by computing **rashi of each house** from Ascendant (House 1 = Lagna, House 2 = next, …) and looking up `house[houseNumber][rashi]`. | • Formula: rashi of house H = `((Ascendant.current_sign + H - 2) % 12) + 1` (House 1 = Lagna, …, House 12 = previous). • Output: list or map of house number → generic text (from house.json). **Single lookup per house; no combining of planet texts.** | Done |
| 4.3 | As an **app client**, I want an API to get generic house predictions for the logged-in user (e.g. `GET /predictions/:username/house/generic` or fallback when `GET /predictions/:username/house` has no personalized data) so the House Predictions screen is never empty. | • Endpoint returns 12 house predictions in a format the frontend can use (e.g. same shape as existing house prediction response). | Done |
| 4.4 | As an **app client**, I want an API to get generic planet predictions for the logged-in user so that the Planet Predictions (or equivalent) screen can show generic content when personalized is not available. | • Endpoint returns 9 planet predictions; format documented and usable by frontend. | Done |
| 4.5 | As a **product owner**, I want generic predictions to be used as fallback when no personalized prediction exists for that user so that new users see content immediately. | • When fetching house (or planet) predictions, if no stored personalized prediction exists, backend returns generic prediction built from user’s rashi + planet.json / house.json. | Done |

---

## Epic 5: Frontend shows generic predictions

**Goal:** House Predictions and Planet Predictions screens display generic content when personalized is not available, using the same or minimal extra UI.

| ID | User Story | Acceptance criteria | Status |
|----|------------|---------------------|--------|
| 5.1 | As a **user**, I want to see house-wise predictions (generic) when I have no personalized house prediction so the screen is never empty. | • House Predictions screen calls the endpoint that returns generic when personalized is missing; existing `parsePredictions` (or equivalent) works with the generic format. • Display shows 12 houses with content. | Done |
| 5.2 | As a **user**, I want to see planet-wise predictions (generic) when I have no personalized planet prediction so I get immediate value. | • Planet Predictions (or relevant) screen uses generic planet endpoint when needed; 9 planets shown with content. | Done |
| 5.3 | As a **developer**, I want the same UI components to work for both generic and personalized content so we avoid duplicate screens. | • Same parsing/formatting approach; only the source (generic vs stored) differs. Optional: label as “Generic” vs “Personalized” if desired. | Done |

---

## Execution order (revised)

1. **Epic 1** — Done. Rashi API returns `house_number` per planet and Ascendant `current_sign`.
2. **Epic 2** — Content done (planet.json, house.json). Remaining: 2.3 document schema/usage; 2.4 handled in Epic 4 (graceful missing keys).
3. **Epic 3** — Expose planet.json and house.json from rashi-api (GET endpoint(s) or embed).
4. **Epic 4** — Build and expose generic prediction endpoints in cosmicconnect-api (planet + house lookups; house = by rashi only).
5. **Epic 5** — Wire frontend to use generic as fallback and display.

---

## Reference: data shapes and house-by-rashi logic

- **planet.json** (planet-in-house): `{ "Sun": { "1": "...", "2": "...", ..., "12": "..." }, "Moon": { ... }, ... }` — 9 planets × 12 houses. Keyed by planet name, then house "1".."12".
- **house.json** (house-by-rashi): `{ "1": { "1": "...", ..., "12": "..." }, "2": { ... }, ..., "12": { ... } }` — 12 houses × 12 rashi. Keyed by house "1".."12", then rashi "1".."12" (1=Aries … 12=Pisces).
- **Rashi of house H** (from Ascendant sign 1–12): House 1 = Lagna sign, House 2 = next sign, …, House 12 = previous. Formula: `rashi = ((Ascendant.current_sign + H - 2) % 12) + 1` (ensure result 1–12).
- **Planet generic:** For each planet, use `rashiData[planet].house_number` → lookup `planet[planet][house_number]`.
- **House generic:** For each house H, compute rashi of that house from Ascendant, then lookup `house[H][rashi]`. **No combining of planet texts.**

### User and premium (frontend / cosmicconnect-api)

- **Signup:** New users get `role: 'user'` and see generic predictions by default.
- **Payment:** When the user completes a PayPal payment, the frontend calls `POST /payments/capture-order/:orderId` with auth; the backend captures the order and sets the user's `role` to `premium`.
- **Frontend:** House and Planet prediction screens show a one-time popup when the user is not premium (generic content), explaining they can upgrade for personalized predictions.
