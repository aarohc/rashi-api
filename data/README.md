# Rashi API — Data folder

Static JSON used for **generic predictions** (on-the-fly lookup, no per-user generation).

## i18n (locales)

Supported languages: **en** (English), **es** (Spanish), **gu** (Gujarati), **hi** (Hindi).

- **Root files** (`planet.json`, `house.json`, etc.) are used when no locale subfolder exists (legacy) or as fallback for `en`.
- **Locale folders**: `data/en/`, `data/es/`, `data/gu/`, `data/hi/` each contain the same five JSON files. The API accepts `?locale=en|es|gu|hi` on `GET /api/generic-predictions` and serves from the matching folder. Missing keys or missing locale folders fall back to English.
- To add or edit translations, update the JSON files in the corresponding locale folder (e.g. `data/es/planet.json` for Spanish planet-in-house content).

## Files

| File | Purpose | Shape |
|------|--------|--------|
| **planet.json** | Generic prediction **by planet**. One text per (planet, house). | `planetInHouse`: 9 planets × 12 houses = 108 entries. Keys: `Sun`, `Moon`, `Mars`, `Mercury`, `Jupiter`, `Venus`, `Saturn`, `Rahu`, `Ketu` → each has `"1"`..`"12"` (house). |
| **house.json** | Generic prediction **by house** (keyed by rashi/sign on the house). | `houseByRashi`: 12 houses × 12 rashi = 144 entries. Keys: `"1"`..`"12"` (house) → each has `"1"`..`"12"` (rashi: 1=Aries … 12=Pisces). |
| **dasha-generic.json** | Generic **dasha period** prediction (Mahadasha × Antardasha). | `dashaGeneric`: 9 × 9 = 81 entries. Keys: `Ketu`, `Venus`, `Sun`, `Moon`, `Mars`, `Rahu`, `Jupiter`, `Saturn`, `Mercury` → each has nested lord keys. Each entry: `{ summary, tone?, keywords? }`. |
| **dasha-maha.json** | Mahadasha-only fallback (when antardasha lookup fails). | `dashaMaha`: 9 entries. Keys: same lords. Each: `{ summary }`. |
| **pratyadasha-generic.json** | Generic pratyadasha (sub-period) summaries for year-at-a-glance. | `pratyadashaGeneric`: 9 entries. Keys: Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury. Each: `{ summary, tone?, impact? }`. |

## JSON schema

- **planet.json**: Root keys = planet names (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu). Each planet has keys "1".."12" (house). Values = full text block.
- **house.json**: Root keys = "1".."12" (house). Each house has keys "1".."12" (rashi). Values = full text block.
- **dasha-generic.json**: Root keys = Mahadasha lords (Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury). Each has nested keys = Antardasha lords. Values = `{ summary: string, tone?: "favorable"|"mixed"|"challenging", keywords?: string[] }`.
- **dasha-maha.json**: Root keys = lords. Values = `{ summary: string }`. Fallback when antardasha lookup fails.
- **pratyadasha-generic.json**: Root keys = lords (same 9). Values = `{ summary: string, tone?: "favorable"|"mixed"|"challenging", impact?: number }`. Used for pratyadasha segment descriptions and optional rating fallback.

## Usage

- **Planet generic**: Given user’s rashi chart, for each planet get its `house_number` → lookup `planet.json[planet][house_number]`. One paragraph per planet.
- **House generic**: For each house H, rashi of house = `((Ascendant.current_sign + H - 2) % 12) + 1`. Lookup `house.json[H][rashi]`. One paragraph per house.
- **Dasha generic**: Given current Mahadasha and Antardasha lords from Vimshottari, lookup `dasha-generic.json[mahadashaLord][antardashaLord]`. Fallback: `dasha-maha.json[mahadashaLord]` → neutral message. Content describes period influence (timing), not natal placement.

## Editing content

Replace the string values with your final Vedic astrology texts. Keys must remain `"1"`..`"12"` for compatibility. Missing keys are handled gracefully by the app (no crash).
