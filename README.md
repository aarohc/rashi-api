# Rashi API

Vedic Astrology Rashi (Zodiac Sign) Calculation Microservice

## Description

This microservice calculates Vedic astrology Rashi positions for all planets based on birth details. It provides sign numbers (1-12), house numbers (1-12), and retrograde status for each planet.

## Features

- Calculate Rashi positions for all planets
- Calculate house numbers based on Lagna
- Determine retrograde status for planets
- RESTful API with Swagger documentation
- Comprehensive unit tests

## Installation

**Important:** This project requires Node.js 24.11.1. Make sure you're using Node.js 24.11.1 before installing.

```bash
# Check Node version
node --version  # Should be v24.11.1

# If not using Node 24.11.1, switch to it:
nvm use 24.11.1
# Or install it:
nvm install 24.11.1
nvm alias default 24.11.1

# Install dependencies
npm install

# Or use the setup script (automatically uses Node 24.11.1)
npm run setup
```

## Running the Server

```bash
node server.js
```

The server will start on port 3000 (or the port specified in the `PORT` environment variable).

## API Documentation

Once the server is running, you can access the Swagger UI documentation at:

- **Swagger UI**: http://localhost:3000/api-docs
- **Swagger JSON**: http://localhost:3000/api-docs.json

## API Endpoints

### POST /api/rashi

Calculate Rashi data for a birth chart.

**Request Body:**
```json
{
  "date": "05-09-1979",
  "time": "17:35:00",
  "lat": 21.1702,
  "lng": 72.8311,
  "timezone": 5.5
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "Ascendant": {
      "current_sign": 5,
      "isRetro": "false"
    },
    "Sun": {
      "current_sign": 11,
      "house_number": 7,
      "isRetro": "false"
    },
    "Moon": {
      "current_sign": 3,
      "house_number": 11,
      "isRetro": "false"
    },
    ...
  },
  "timestamp": "2024-11-15T21:00:00.000Z"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "OK",
  "service": "Rashi Microservice"
}
```

## Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Generate coverage report:

```bash
npm run test:coverage
```

## Sign Numbers

- 1 = Aries (Ar)
- 2 = Taurus (Ta)
- 3 = Gemini (Ge)
- 4 = Cancer (Cn)
- 5 = Leo (Le)
- 6 = Virgo (Vi)
- 7 = Libra (Li)
- 8 = Scorpio (Sc)
- 9 = Sagittarius (Sg)
- 10 = Capricorn (Cp)
- 11 = Aquarius (Aq)
- 12 = Pisces (Pi)

## Requirements

- Node.js >= 24.11.1
- npm >= 11.0.0

## Dependencies

- express - Web framework
- body-parser - Request body parsing
- vedic-astrology - Vedic astrology calculations
- swagger-jsdoc - Swagger documentation generation
- swagger-ui-express - Swagger UI interface

## License

ISC

