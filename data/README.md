# Rashi API — Data folder

Static JSON used for **generic predictions** (on-the-fly lookup, no per-user generation).

## Files

| File | Purpose | Shape |
|------|--------|--------|
| **planet.json** | Generic prediction **by planet**. One text per (planet, house). | `planetInHouse`: 9 planets × 12 houses = 108 entries. Keys: `Sun`, `Moon`, `Mars`, `Mercury`, `Jupiter`, `Venus`, `Saturn`, `Rahu`, `Ketu` → each has `"1"`..`"12"` (house). |
| **house.json** | Generic prediction **by house** (keyed by rashi/sign on the house). | `houseByRashi`: 12 houses × 12 rashi = 144 entries. Keys: `"1"`..`"12"` (house) → each has `"1"`..`"12"` (rashi: 1=Aries … 12=Pisces). |

## JSON schema

- **planet.json**: Root keys = planet names (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu). Each planet has keys "1".."12" (house). Values = full text block.
- **house.json**: Root keys = "1".."12" (house). Each house has keys "1".."12" (rashi). Values = full text block.

## Usage

- **Planet generic**: Given user’s rashi chart, for each planet get its `house_number` → lookup `planet.json[planet][house_number]`. One paragraph per planet.
- **House generic**: For each house H, rashi of house = `((Ascendant.current_sign + H - 2) % 12) + 1`. Lookup `house.json[H][rashi]`. One paragraph per house.

## Editing content

Replace the string values with your final Vedic astrology texts. Keys must remain `"1"`..`"12"` for compatibility. Missing keys are handled gracefully by the app (no crash).
