const express = require('express');
const bodyParser = require('body-parser');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { generateHoroscopeSVG } = require('./horoscopeGenerator');
const { generateVimshottariDasha, getPratyadashaForYear, getMuddaDashaForYear } = require('./vimshottariService');
const { computeCompatibility, computeClassicalCompatibility } = require('./compatibilityService');
const { calculatePlanetAspects } = require('./aspectsService');
const { computeFullRashiData } = require('./chartComputer');
const { evaluateAllYogas } = require('./yogaService');
const { computeChoghadiya } = require('./choghadiyaService');
const { computePanchangDay } = require('./panchangService');
const { normalizeDateToYmd } = require('./utils');
const path = require('path');
const fs = require('fs');
const { loadRashiRuntimeConfig, getRashiTunable } = require('./rashiRuntimeConfig');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Rashi API',
      version: '1.0.0',
      description: 'Vedic Astrology Rashi (Zodiac Sign) Calculation Microservice',
      contact: {
        name: 'API Support',
        email: 'support@astrovoyages.com'
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      }
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server'
      },
      {
        url: 'https://api.astrovoyages.com',
        description: 'Production server'
      }
    ],
    tags: [
      {
        name: 'Rashi',
        description: 'Vedic astrology Rashi calculations'
      },
      {
        name: 'Horoscope',
        description: 'Horoscope chart SVG generation'
      },
      {
        name: 'Health',
        description: 'Health check endpoints'
      },
      {
        name: 'Vimshottari',
        description: 'Vimshottari (Maha/Antar) dasha calculations'
      },
      {
        name: 'MuddaDasha',
        description: 'Mudda Dasha (Varshphala annual) proportional lords for a birth-year'
      },
      {
        name: 'Compatibility',
        description: 'Relationship compatibility calculations'
      },
      {
        name: 'Aspects',
        description: 'Vedic planetary aspect (drishti) calculations'
      },
      {
        name: 'Yogas',
        description: 'Classical Vedic yoga (planetary combination) detection'
      },
      {
        name: 'Choghadiya',
        description: 'Choghadiya muhurat windows from sunrise/sunset at a location (8 day + 8 night segments)'
      },
      {
        name: 'Panchang',
        description: 'Daily Panchang bundle (Choghadiya, Rahu Kaal, Yamaganda, Gulika, Hora, Abhijit, limbs at noon)'
      }
    ]
  },
  apis: ['./server.js'] // Path to the API files
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Swagger UI setup
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Rashi API Documentation'
}));

// Swagger JSON endpoint
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

/**
 * @swagger
 * /api/rashi:
 *   post:
 *     summary: Calculate Rashi (Zodiac Sign) data for a birth chart
 *     description: Computes Vedic astrology Rashi positions for all planets, including sign numbers, house numbers, and retrograde status
 *     tags: [Rashi]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *               - time
 *               - lat
 *               - lng
 *               - timezone
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "1979-09-05"
 *                 description: Birth date in yyyy-mm-dd format (or dd-mm-yyyy will be auto-converted)
 *               time:
 *                 type: string
 *                 format: time
 *                 example: "19:35:00"
 *                 description: Birth time in HH:MM:SS format (24-hour)
 *               lat:
 *                 type: number
 *                 format: float
 *                 example: 21.1702
 *                 description: Latitude of birth place (decimal degrees)
 *               lng:
 *                 type: number
 *                 format: float
 *                 example: 72.8311
 *                 description: Longitude of birth place (decimal degrees)
 *               timezone:
 *                 type: number
 *                 format: float
 *                 example: 5.5
 *                 description: Timezone offset in hours (e.g., 5.5 for IST, -5 for EST)
 *     responses:
 *       200:
 *         description: Successful calculation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     Ascendant:
 *                       type: object
 *                       properties:
 *                         current_sign:
 *                           type: integer
 *                           minimum: 1
 *                           maximum: 12
 *                           description: Zodiac sign number (1=Aries, 2=Taurus, ..., 12=Pisces)
 *                           example: 5
 *                         isRetro:
 *                           type: string
 *                           enum: ["true", "false"]
 *                           example: "false"
 *                     Sun:
 *                       type: object
 *                       properties:
 *                         current_sign:
 *                           type: integer
 *                           minimum: 1
 *                           maximum: 12
 *                           example: 5
 *                         isRetro:
 *                           type: string
 *                           enum: ["true", "false"]
 *                           example: "false"
 *                     Moon:
 *                       $ref: '#/components/schemas/PlanetData'
 *                     Mars:
 *                       $ref: '#/components/schemas/PlanetData'
 *                     Mercury:
 *                       $ref: '#/components/schemas/PlanetData'
 *                     Jupiter:
 *                       $ref: '#/components/schemas/PlanetData'
 *                     Venus:
 *                       $ref: '#/components/schemas/PlanetData'
 *                     Saturn:
 *                       $ref: '#/components/schemas/PlanetData'
 *                     Rahu:
 *                       $ref: '#/components/schemas/PlanetData'
 *                     Ketu:
 *                       $ref: '#/components/schemas/PlanetData'
 *                     Uranus:
 *                       $ref: '#/components/schemas/PlanetData'
 *                     Neptune:
 *                       $ref: '#/components/schemas/PlanetData'
 *                     Pluto:
 *                       $ref: '#/components/schemas/PlanetData'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-11-15T21:00:00.000Z"
 *       400:
 *         description: Bad request - Missing or invalid required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing required fields: date (YYYY-MM-DD), time (HH:MM:SS), lat, lng, timezone"
 *       500:
 *         description: Internal server error - Failed to compute Rashi data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to compute Rashi data"
 * 
 * components:
 *   schemas:
 *     PlanetData:
 *       type: object
 *       properties:
 *         current_sign:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *           description: Zodiac sign number (1=Aries, 2=Taurus, ..., 12=Pisces)
 *         house_number:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *           description: House position (1-12) from Lagna; used for generic predictions
 *         isRetro:
 *           type: string
 *           enum: ["true", "false"]
 *           description: Whether the planet is in retrograde motion
 */

app.post('/api/rashi', (req, res) => {
  const { date, time, lat, lng, timezone } = req.body;

  // Validation
  if (!date || !time || lat === undefined || lng === undefined || timezone === undefined) {
    return res.status(400).json({ error: 'Missing required fields: date (YYYY-MM-DD or DD-MM-YYYY), time (HH:MM:SS), lat, lng, timezone' });
  }

  try {
    const normalizedDate = normalizeDateToYmd(date);
    const { rashiData } = computeFullRashiData(normalizedDate, time, lat, lng, timezone);

    res.json({
      success: true,
      data: rashiData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error computing Rashi:', error);
    res.status(500).json({ error: 'Failed to compute Rashi data' });
  }
});

/**
 * @swagger
 * /api/yogas:
 *   post:
 *     summary: Detect classical Vedic yogas for a birth chart
 *     description: Computes rashi positions then evaluates Pancha Mahapurusha, lunar, solar, Raja, special, and Dhana yogas (whole-sign houses, Lahiri sidereal).
 *     tags: [Yogas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *               - time
 *               - lat
 *               - lng
 *               - timezone
 *             properties:
 *               date:
 *                 type: string
 *               time:
 *                 type: string
 *               lat:
 *                 type: number
 *               lng:
 *                 type: number
 *               timezone:
 *                 type: number
 *     responses:
 *       200:
 *         description: Applicable yogas and summary counts
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
app.post('/api/yogas', (req, res) => {
  const { date, time, lat, lng, timezone } = req.body;

  if (!date || !time || lat === undefined || lng === undefined || timezone === undefined) {
    return res.status(400).json({
      error: 'Missing required fields: date (YYYY-MM-DD or DD-MM-YYYY), time (HH:MM:SS), lat, lng, timezone'
    });
  }

  try {
    const normalizedDate = normalizeDateToYmd(date);
    const { rashiData } = computeFullRashiData(normalizedDate, time, lat, lng, timezone);
    const result = evaluateAllYogas(rashiData);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error computing yogas:', error);
    res.status(500).json({ error: 'Failed to compute yogas' });
  }
});

/**
 * @swagger
 * /api/choghadiya:
 *   post:
 *     summary: Choghadiya for a location (day and night eight-fold divisions)
 *     description: |
 *       Computes sunrise and sunset with Swiss Ephemeris, then splits daytime (sunrise→sunset)
 *       and night (sunset→next sunrise) into eight equal Choghadiya periods.
 *       Day sequence starts with the weekday lord; night starts with the ruler of the fifth daytime period.
 *       Optional date/time default to “now” in the given timezone offset. Time is only used to pick the current segment.
 *     tags: [Choghadiya]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - lat
 *               - lng
 *               - timezone
 *             properties:
 *               lat:
 *                 type: number
 *                 description: Latitude (decimal degrees)
 *               lng:
 *                 type: number
 *                 description: Longitude (decimal degrees)
 *               timezone:
 *                 type: number
 *                 description: Hours east of UTC (e.g. 5.5 for IST, -5 for EST)
 *               date:
 *                 type: string
 *                 description: Local civil date YYYY-MM-DD or DD-MM-YYYY (default today in zone)
 *               time:
 *                 type: string
 *                 description: Local time HH:MM:SS (default now in zone)
 *     responses:
 *       200:
 *         description: Day and night tables and optional current segment
 *       400:
 *         description: Bad request
 *       422:
 *         description: Rise/set not computable (e.g. extreme latitude)
 *       500:
 *         description: Server error
 */
app.post('/api/choghadiya', (req, res) => {
  const { lat, lng, timezone, date, time } = req.body;

  if (lat === undefined || lng === undefined || timezone === undefined) {
    return res.status(400).json({
      error: 'Missing required fields: lat, lng, timezone (hours east of UTC). Optional date, time (HH:MM:SS).',
    });
  }

  try {
    const raw = computeChoghadiya({ lat, lng, timezone, date, time });
    res.json({
      success: true,
      data: {
        location: { lat, lng, timezone },
        dateLocal: raw.dateLocal,
        weekdayIndex: raw.weekdayIndex,
        sunrise: raw.sunriseUtc,
        sunset: raw.sunsetUtc,
        nextSunrise: raw.nextSunriseUtc,
        day: raw.day,
        night: raw.night,
        current: raw.current,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error computing Choghadiya:', error);
    if (error.code === 'NO_RISE_SET' || error.code === 'EPHEMERIS') {
      return res.status(422).json({ error: error.message || 'Could not compute sunrise or sunset for this location' });
    }
    if (error.message && /Invalid|format/i.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to compute Choghadiya' });
  }
});

/**
 * @swagger
 * /api/panchang:
 *   post:
 *     summary: Daily Panchang bundle for a location and civil date
 *     description: |
 *       Choghadiya (day+night), Rahu Kaal / Yamaganda / Gulika (8 daytime eighths), 12+12 Hora,
 *       Abhijit (omitted Wednesday), Tithi/Nakshatra/Yoga at local noon (vedic-astrology).
 *     tags: [Panchang]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - lat
 *               - lng
 *               - timezone
 *               - date
 *             properties:
 *               lat: { type: number }
 *               lng: { type: number }
 *               timezone: { type: number }
 *               date: { type: string, description: YYYY-MM-DD or DD-MM-YYYY }
 *     responses:
 *       200:
 *         description: Panchang bundle
 *       400:
 *         description: Bad request
 *       422:
 *         description: Rise/set not computable
 *       500:
 *         description: Server error
 */
app.post('/api/panchang', (req, res) => {
  const { lat, lng, timezone, date } = req.body;

  if (lat === undefined || lng === undefined || timezone === undefined || !date) {
    return res.status(400).json({
      error: 'Missing required fields: lat, lng, timezone, date (YYYY-MM-DD or DD-MM-YYYY)',
    });
  }

  try {
    const normalizedDate = normalizeDateToYmd(date);
    const raw = computePanchangDay({ lat, lng, timezone, date: normalizedDate });
    res.json({
      success: true,
      data: {
        location: { lat, lng, timezone },
        ...raw,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error computing Panchang:', error);
    if (error.code === 'NO_RISE_SET' || error.code === 'EPHEMERIS') {
      return res.status(422).json({ error: error.message || 'Could not compute sunrise or sunset for this location' });
    }
    if (error.message && /Invalid|format|required/i.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to compute Panchang' });
  }
});

/**
 * @swagger
 * /api/vimshottari:
 *   post:
 *     summary: Calculate Vimshottari Maha and Antar Dasha periods
 *     description: Computes standard Vimshottari dasha schedule (approximate) based on Moon's nakshatra, including Maha Dashas and Antar Dashas for up to 120 years from birth.
 *     tags: [Vimshottari]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *               - time
 *               - lat
 *               - lng
 *               - timezone
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "1979-09-05"
 *                 description: Birth date in yyyy-mm-dd format (or dd-mm-yyyy will be auto-converted)
 *               time:
 *                 type: string
 *                 format: time
 *                 example: "19:35:00"
 *                 description: Birth time in HH:MM:SS format (24-hour)
 *               lat:
 *                 type: number
 *                 format: float
 *                 example: 21.1702
 *                 description: Latitude of birth place (decimal degrees)
 *               lng:
 *                 type: number
 *                 format: float
 *                 example: 72.8311
 *                 description: Longitude of birth place (decimal degrees)
 *               timezone:
 *                 type: number
 *                 format: float
 *                 example: 5.5
 *                 description: Timezone offset in hours (e.g., 5.5 for IST, -5 for EST)
 *               maxYears:
 *                 type: number
 *                 format: float
 *                 example: 120
 *                 description: Maximum number of years of dasha periods to generate (default 120)
 *     responses:
 *       200:
 *         description: Successful Vimshottari calculation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     nakshatra:
 *                       type: object
 *                       properties:
 *                         index:
 *                           type: integer
 *                           example: 26
 *                         name:
 *                           type: string
 *                           example: "Uttara Bhadrapada"
 *                         lord:
 *                           type: string
 *                           example: "Saturn"
 *                         fractionElapsed:
 *                           type: number
 *                           format: float
 *                     mahaDashas:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           lord:
 *                             type: string
 *                           start:
 *                             type: string
 *                             format: date-time
 *                           end:
 *                             type: string
 *                             format: date-time
 *                           years:
 *                             type: number
 *                     antarDashasByMaha:
 *                       type: array
 *                       items:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             mahaLord:
 *                               type: string
 *                             antarLord:
 *                               type: string
 *                             start:
 *                               type: string
 *                               format: date-time
 *                             end:
 *                               type: string
 *                               format: date-time
 *                             years:
 *                               type: number
 *       400:
 *         description: Bad request - Missing or invalid required fields
 *       500:
 *         description: Internal server error - Failed to compute Vimshottari dasha
 */
app.post('/api/vimshottari', (req, res) => {
  const { date, time, lat, lng, timezone, maxYears } = req.body;

  if (!date || !time || lat === undefined || lng === undefined || timezone === undefined) {
    return res.status(400).json({
      error: 'Missing required fields: date (YYYY-MM-DD or DD-MM-YYYY), time (HH:MM:SS), lat, lng, timezone'
    });
  }

  try {
    // Normalize date format to yyyy-mm-dd
    let normalizedDate = date;
    const ddmmyyyyPattern = /^(\d{2})-(\d{2})-(\d{4})$/;
    const match = date.match(ddmmyyyyPattern);
    if (match) {
      const [, day, month, year] = match;
      normalizedDate = `${year}-${month}-${day}`;
    }

    const dashaData = generateVimshottariDasha(normalizedDate, time, lat, lng, timezone, maxYears || 120);

    res.json({
      success: true,
      data: dashaData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error computing Vimshottari dasha:', error);
    res.status(500).json({ error: 'Failed to compute Vimshottari dasha' });
  }
});

/**
 * @swagger
 * /api/pratyadasha:
 *   post:
 *     summary: Get Pratyadasha segments for a given year
 *     description: Returns the pratyantardasha (pratyadasha) segments that fall within the specified birth year (birthday-to-birthday), based on birth chart. The year runs from the native's birthday in that year to the day before their next birthday. Each antardasha is divided into 9 pratyadashas in Vimshottari order; segments overlapping the birth year are returned in chronological order.
 *     tags: [Vimshottari]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *               - time
 *               - lat
 *               - lng
 *               - timezone
 *               - year
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "1979-09-05"
 *                 description: Birth date in yyyy-mm-dd format (or dd-mm-yyyy will be auto-converted)
 *               time:
 *                 type: string
 *                 format: time
 *                 example: "19:35:00"
 *                 description: Birth time in HH:MM:SS format (24-hour)
 *               lat:
 *                 type: number
 *                 format: float
 *                 example: 21.1702
 *                 description: Latitude of birth place (decimal degrees)
 *               lng:
 *                 type: number
 *                 format: float
 *                 example: 72.8311
 *                 description: Longitude of birth place (decimal degrees)
 *               timezone:
 *                 type: number
 *                 format: float
 *                 example: 5.5
 *                 description: Timezone offset in hours (e.g., 5.5 for IST, -5 for EST)
 *               year:
 *                 type: integer
 *                 example: 2025
 *                 description: Birth year (e.g. 2025 = from birthday in 2025 to next birthday)
 *     responses:
 *       200:
 *         description: Pratyadasha segments for the given year
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     year:
 *                       type: integer
 *                       example: 2025
 *                     pratyadashaSegments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           mahaLord:
 *                             type: string
 *                             description: Mahadasha lord
 *                           antarLord:
 *                             type: string
 *                             description: Antardasha lord
 *                           pratyadashaLord:
 *                             type: string
 *                             description: Pratyantardasha lord
 *                           start:
 *                             type: string
 *                             format: date-time
 *                           end:
 *                             type: string
 *                             format: date-time
 *                           days:
 *                             type: number
 *                             description: Approximate length of segment in days within the year
 *       400:
 *         description: Bad request - Missing or invalid required fields
 *       500:
 *         description: Internal server error - Failed to compute pratyadasha
 */
app.post('/api/pratyadasha', (req, res) => {
  const { date, time, lat, lng, timezone, year } = req.body;

  if (!date || !time || lat === undefined || lng === undefined || timezone === undefined || year === undefined) {
    return res.status(400).json({
      error: 'Missing required fields: date (YYYY-MM-DD or DD-MM-YYYY), time (HH:MM:SS), lat, lng, timezone, year'
    });
  }

  const yearNum = typeof year === 'string' ? parseInt(year, 10) : year;
  if (Number.isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
    return res.status(400).json({
      error: 'Invalid year: must be an integer between 1900 and 2100'
    });
  }

  try {
    let normalizedDate = date;
    const ddmmyyyyPattern = /^(\d{2})-(\d{2})-(\d{4})$/;
    const match = date.match(ddmmyyyyPattern);
    if (match) {
      const [, day, month, yearPart] = match;
      normalizedDate = `${yearPart}-${month}-${day}`;
    }

    const pratyadashaData = getPratyadashaForYear(
      normalizedDate,
      time,
      lat,
      lng,
      timezone,
      yearNum
    );

    res.json({
      success: true,
      data: pratyadashaData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error computing pratyadasha:', error);
    res.status(500).json({ error: 'Failed to compute pratyadasha' });
  }
});

/**
 * @swagger
 * /api/mudda-dasha:
 *   post:
 *     summary: Mudda Dasha segments for a birth-year (Varshphala / Tajik)
 *     description: Returns exactly nine proportional Mudda periods from birthday in `year` to next birthday. Lords follow Vimshottari order starting from (Moon birth-nakshatra lord index + completed varshas) mod 9. Durations scale (lord years / 120) × window length.
 *     tags: [MuddaDasha]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date, time, lat, lng, timezone, year]
 *     responses:
 *       200:
 *         description: Mudda segments for the birth-year
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
app.post('/api/mudda-dasha', (req, res) => {
  const { date, time, lat, lng, timezone, year } = req.body;

  if (!date || !time || lat === undefined || lng === undefined || timezone === undefined || year === undefined) {
    return res.status(400).json({
      error: 'Missing required fields: date (YYYY-MM-DD or DD-MM-YYYY), time (HH:MM:SS), lat, lng, timezone, year'
    });
  }

  const yearNum = typeof year === 'string' ? parseInt(year, 10) : year;
  if (Number.isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
    return res.status(400).json({
      error: 'Invalid year: must be an integer between 1900 and 2100'
    });
  }

  try {
    let normalizedDate = date;
    const ddmmyyyyPattern = /^(\d{2})-(\d{2})-(\d{4})$/;
    const match = date.match(ddmmyyyyPattern);
    if (match) {
      const [, day, month, yearPart] = match;
      normalizedDate = `${yearPart}-${month}-${day}`;
    }

    const muddaData = getMuddaDashaForYear(
      normalizedDate,
      time,
      lat,
      lng,
      timezone,
      yearNum
    );

    res.json({
      success: true,
      data: muddaData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error computing mudda-dasha:', error);
    const msg = error && error.message ? String(error.message) : 'Failed to compute mudda-dasha';
    if (msg.includes('before birth') || msg.includes('Invalid')) {
      return res.status(400).json({ error: msg });
    }
    res.status(500).json({ error: 'Failed to compute mudda-dasha', detail: msg });
  }
});

/**
 * @swagger
 * /api/compatibility:
 *   post:
 *     summary: Calculate relationship compatibility score between two birth charts
 *     description: Uses vedic-astrology compatibility module to compute an overall compatibility score and detailed breakdown.
 *     tags: [Compatibility]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - person1
 *               - person2
 *             properties:
 *               person1:
 *                 type: object
 *                 required:
 *                   - date
 *                   - time
 *                   - lat
 *                   - lng
 *                   - timezone
 *                 properties:
 *                   date:
 *                     type: string
 *                     format: date
 *                     example: "1979-09-05"
 *                     description: Birth date in yyyy-mm-dd format (or dd-mm-yyyy will be auto-converted)
 *                   time:
 *                     type: string
 *                     format: time
 *                     example: "19:35:00"
 *                     description: Birth time in HH:MM:SS format (24-hour)
 *                   lat:
 *                     type: number
 *                     format: float
 *                     example: 21.1702
 *                   lng:
 *                     type: number
 *                     format: float
 *                     example: 72.8311
 *                   timezone:
 *                     type: number
 *                     format: float
 *                     example: 5.5
 *               person2:
 *                 type: object
 *                 required:
 *                   - date
 *                   - time
 *                   - lat
 *                   - lng
 *                   - timezone
 *                 properties:
 *                   date:
 *                     type: string
 *                     format: date
 *                   time:
 *                     type: string
 *                     format: time
 *                   lat:
 *                     type: number
 *                     format: float
 *                   lng:
 *                     type: number
 *                     format: float
 *                   timezone:
 *                     type: number
 *                     format: float
 *     responses:
 *       200:
 *         description: Compatibility score calculated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     compatible:
 *                       type: boolean
 *                     totalScore:
 *                       type: number
 *                       description: Raw compatibility score (0-30)
 *                       example: 22
 *                     normalizedScore:
 *                       type: number
 *                       description: Normalized score between 0 and 1 (totalScore / 30)
 *                       example: 0.73
 *                     level:
 *                       type: string
 *                       description: Discrete label for compatibility band
 *                       example: "good"
 *                     helpText:
 *                       type: string
 *                       description: Human-readable interpretation of the score (for UI display)
 *                       example: "Overall good compatibility (22/30). This is well above the default threshold of 12/30, indicating a supportive connection with some areas of growth."
 *       400:
 *         description: Bad request - Missing or invalid required fields
 *       500:
 *         description: Internal server error - Failed to compute compatibility
 */
app.post('/api/compatibility', (req, res) => {
  const { person1, person2, threshold } = req.body || {};

  if (!person1 || !person2) {
    return res
      .status(400)
      .json({ error: 'Missing required fields: person1, person2' });
  }

  const requiredFields = ['date', 'time', 'lat', 'lng', 'timezone'];
  for (const [idx, person] of [person1, person2].entries()) {
    const label = idx === 0 ? 'person1' : 'person2';
    for (const f of requiredFields) {
      if (person[f] === undefined || person[f] === null || person[f] === '') {
        return res
          .status(400)
          .json({ error: `Missing required field for ${label}: ${f}` });
      }
    }
  }

  try {
    const result = computeCompatibility(person1, person2, threshold);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error computing compatibility:', error);
    res.status(500).json({ error: 'Failed to compute compatibility' });
  }
});

/**
 * @swagger
 * /api/ashtakoot:
 *   post:
 *     summary: Classical compatibility payload for two birth charts
 *     description: Returns normalized classical compatibility score with current breakdown details and nakshatra/yoni signal. This endpoint is designed as the stable classical contract for life-partner compatibility.
 *     tags: [Compatibility]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - person1
 *               - person2
 *             properties:
 *               person1:
 *                 type: object
 *               person2:
 *                 type: object
 *               threshold:
 *                 type: number
 *                 example: 0.4
 *     responses:
 *       200:
 *         description: Classical compatibility computed successfully
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Internal server error
 */
app.post('/api/ashtakoot', (req, res) => {
  const { person1, person2, threshold } = req.body || {};

  if (!person1 || !person2) {
    return res
      .status(400)
      .json({ error: 'Missing required fields: person1, person2' });
  }

  const requiredFields = ['date', 'time', 'lat', 'lng', 'timezone'];
  for (const [idx, person] of [person1, person2].entries()) {
    const label = idx === 0 ? 'person1' : 'person2';
    for (const f of requiredFields) {
      if (person[f] === undefined || person[f] === null || person[f] === '') {
        return res
          .status(400)
          .json({ error: `Missing required field for ${label}: ${f}` });
      }
    }
  }

  try {
    const result = computeClassicalCompatibility(person1, person2, threshold);
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error computing ashtakoot compatibility:', error);
    res.status(500).json({ error: 'Failed to compute ashtakoot compatibility' });
  }
});

/**
 * @swagger
 * /api/planetaspects:
 *   post:
 *     summary: Calculate Vedic planetary aspects (drishti)
 *     description: |
 *       Computes planetary aspects based on Vedic astrology rules.
 *       
 *       **Aspect Rules:**
 *       - All planets have a 7th house aspect (full/opposition aspect)
 *       - Mars has special aspects on 4th, 7th, and 8th houses
 *       - Jupiter has special aspects on 5th, 7th, and 9th houses
 *       - Saturn has special aspects on 3rd, 7th, and 10th houses
 *       - Rahu/Ketu have aspects on 5th, 7th, and 9th houses
 *     tags: [Aspects]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *               - time
 *               - lat
 *               - lng
 *               - timezone
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "1979-09-05"
 *                 description: Birth date in yyyy-mm-dd format (or dd-mm-yyyy will be auto-converted)
 *               time:
 *                 type: string
 *                 format: time
 *                 example: "19:35:00"
 *                 description: Birth time in HH:MM:SS format (24-hour)
 *               lat:
 *                 type: number
 *                 format: float
 *                 example: 21.1702
 *                 description: Latitude of birth place (decimal degrees)
 *               lng:
 *                 type: number
 *                 format: float
 *                 example: 72.8311
 *                 description: Longitude of birth place (decimal degrees)
 *               timezone:
 *                 type: number
 *                 format: float
 *                 example: 5.5
 *                 description: Timezone offset in hours (e.g., 5.5 for IST, -5 for EST)
 *     responses:
 *       200:
 *         description: Successful aspect calculation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     aspectsByPlanet:
 *                       type: object
 *                       description: Aspects cast by each planet
 *                     aspectsReceived:
 *                       type: object
 *                       description: Aspects received by each planet
 *                     mutualAspects:
 *                       type: array
 *                       description: Pairs of planets that mutually aspect each other
 *                     aspectsByHouse:
 *                       type: object
 *                       description: Which planets aspect each house/sign
 *                     summary:
 *                       type: object
 *                       description: Summary of aspect rules used
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Bad request - Missing or invalid required fields
 *       500:
 *         description: Internal server error - Failed to compute aspects
 */
app.post('/api/planetaspects', (req, res) => {
  const { date, time, lat, lng, timezone } = req.body;

  // Validation
  if (!date || !time || lat === undefined || lng === undefined || timezone === undefined) {
    return res.status(400).json({ 
      error: 'Missing required fields: date (YYYY-MM-DD or DD-MM-YYYY), time (HH:MM:SS), lat, lng, timezone' 
    });
  }

  try {
    const normalizedDate = normalizeDateToYmd(date);
    const { rashiData } = computeFullRashiData(normalizedDate, time, lat, lng, timezone);
    const aspectData = calculatePlanetAspects(rashiData);

    res.json({
      success: true,
      data: aspectData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error computing planet aspects:', error);
    res.status(500).json({ error: 'Failed to compute planet aspects' });
  }
});

/**
 * @swagger
 * /api/horoscope:
 *   post:
 *     summary: Generate horoscope chart SVG
 *     description: Generates a North Indian style Vedic astrology horoscope chart as SVG
 *     tags: [Horoscope]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *               - time
 *               - lat
 *               - lng
 *               - timezone
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "1979-09-05"
 *                 description: Birth date in yyyy-mm-dd format (or dd-mm-yyyy will be auto-converted)
 *               time:
 *                 type: string
 *                 format: time
 *                 example: "19:35:00"
 *                 description: Birth time in HH:MM:SS format (24-hour)
 *               lat:
 *                 type: number
 *                 format: float
 *                 example: 21.1702
 *                 description: Latitude of birth place (decimal degrees)
 *               lng:
 *                 type: number
 *                 format: float
 *                 example: 72.8311
 *                 description: Longitude of birth place (decimal degrees)
 *               timezone:
 *                 type: number
 *                 format: float
 *                 example: 5.5
 *                 description: Timezone offset in hours (e.g., 5.5 for IST, -5 for EST)
 *               size:
 *                 type: integer
 *                 example: 800
 *                 description: "SVG size in pixels (default: 800)"
 *                 minimum: 400
 *                 maximum: 2000
 *               chartType:
 *                 type: string
 *                 enum: ["north-indian", "circle", "box"]
 *                 example: "north-indian"
 *                 description: "Chart style (north-indian for classic diamond-in-square, circle for wheel, box for simple 4x3 grid)"
 *     responses:
 *       200:
 *         description: SVG chart generated successfully
 *         content:
 *           image/svg+xml:
 *             schema:
 *               type: string
 *               format: binary
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 svg:
 *                   type: string
 *                   description: SVG markup string
 *                 format:
 *                   type: string
 *                   example: "svg"
 *       400:
 *         description: Bad request - Missing or invalid required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing required fields: date (YYYY-MM-DD), time (HH:MM:SS), lat, lng, timezone"
 *       500:
 *         description: Internal server error - Failed to generate horoscope
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to generate horoscope chart"
 */
app.post('/api/horoscope', (req, res) => {
  const { date, time, lat, lng, timezone, size, chartType } = req.body;

  // Validation
  if (!date || !time || lat === undefined || lng === undefined || timezone === undefined) {
    return res.status(400).json({ error: 'Missing required fields: date (dd-mm-yyyy), time (HH:MM:SS), lat, lng, timezone' });
  }

  try {
    const normalizedDate = normalizeDateToYmd(date);
    const { birthChart, rashiData } = computeFullRashiData(normalizedDate, time, lat, lng, timezone);

    const svg = generateHoroscopeSVG(rashiData, birthChart, {
      size: size || 800,
      chartType: chartType || 'north-indian'
    });

    // Check if client wants JSON or SVG directly
    const acceptHeader = req.headers.accept || '';
    if (acceptHeader.includes('application/json')) {
      res.json({
        success: true,
        svg: svg,
        format: 'svg'
      });
    } else {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(svg);
    }
  } catch (error) {
    console.error('Error generating horoscope:', error);
    res.status(500).json({ error: 'Failed to generate horoscope chart' });
  }
});

/**
 * @swagger
 * /api/generic-predictions:
 *   get:
 *     summary: Get generic prediction data (planet-in-house and house-by-rashi)
 *     description: Returns static JSON from data/planet.json and data/house.json for building generic predictions by lookup. planetInHouse keys = Sun..Ketu plus Uranus, Neptune, Pluto, then house "1".."12"; houseByRashi keys = house "1".."12" then rashi "1".."12". Locale-specific files live under data/{locale}/ when present.
 *     tags: [Rashi]
 *     parameters:
 *       - in: query
 *         name: locale
 *         schema:
 *           type: string
 *           enum: [en, es, gu, hi]
 *           default: en
 *         description: Language for generic content (en=English, es=Spanish, gu=Gujarati, hi=Hindi)
 *     responses:
 *       200:
 *         description: Generic prediction data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 planetInHouse:
 *                   type: object
 *                   description: Planet name -> house number "1".."12" -> text block
 *                 houseByRashi:
 *                   type: object
 *                   description: House "1".."12" -> rashi "1".."12" -> text block
 *       500:
 *         description: Error reading data files
 */
const SUPPORTED_LOCALES = ['en', 'es', 'gu', 'hi'];
function getGenericPredictionsDataDir(baseDataDir, locale) {
  const normalized = (locale && String(locale).toLowerCase()) || 'en';
  const chosen = SUPPORTED_LOCALES.includes(normalized) ? normalized : 'en';
  const localeDir = path.join(baseDataDir, chosen);
  if (fs.existsSync(localeDir)) return localeDir;
  return baseDataDir;
}
function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
app.get('/api/generic-predictions', async (req, res) => {
  try {
    const { ensureRashiOverridesFresh, getGenericFileOverride, getYogaDescriptionsOverride } = require('./rashiContentOverrides');
    await ensureRashiOverridesFresh();
    const baseDataDir = path.join(__dirname, 'data');
    const locale = (req.query.locale && String(req.query.locale).toLowerCase()) || 'en';
    const dataDir = getGenericPredictionsDataDir(baseDataDir, locale);
    const enDir = locale === 'en' ? dataDir : getGenericPredictionsDataDir(baseDataDir, 'en');
    const files = ['planet.json', 'house.json', 'dasha-generic.json', 'dasha-maha.json', 'pratyadasha-generic.json'];
    const keys = ['planetInHouse', 'houseByRashi', 'dashaGeneric', 'dashaMaha', 'pratyadashaGeneric'];
    const out = {};
    for (let i = 0; i < files.length; i++) {
      const stem = files[i].replace(/\.json$/i, '');
      let data = getGenericFileOverride(stem, locale);
      if (!data) {
        data = readJsonIfExists(path.join(dataDir, files[i]));
        if (data == null && dataDir !== enDir) data = readJsonIfExists(path.join(enDir, files[i]));
      }
      if (data == null) {
        return res.status(500).json({ error: 'Failed to load generic prediction data', missing: files[i] });
      }
      out[keys[i]] = data;
    }
    const yogaDescPath = path.join(baseDataDir, 'yoga-descriptions.json');
    const yogaDescriptions = getYogaDescriptionsOverride() || readJsonIfExists(yogaDescPath) || {};
    out.yogaDescriptions = yogaDescriptions;
    res.json(out);
  } catch (err) {
    console.error('Error serving generic-predictions:', err);
    res.status(500).json({ error: 'Failed to load generic prediction data' });
  }
});

/**
 * @swagger
 * /version:
 *   get:
 *     summary: Version endpoint
 *     description: Returns the deployed application version (from package.json and optional build/git info)
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Version info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                 version:
 *                   type: string
 *                 build:
 *                   type: string
 *                   description: Build or git commit if set at deploy time
 */
app.get('/version', (req, res) => {
  let version = process.env.BUILD_VERSION || process.env.npm_package_version;
  if (!version) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
      version = pkg.version || 'unknown';
    } catch {
      version = 'unknown';
    }
  }
  res.json({
    name: 'rashi-api',
    version,
    ...(process.env.GIT_COMMIT && { build: process.env.GIT_COMMIT }),
  });
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the health status of the Rashi API service
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "OK"
 *                 service:
 *                   type: string
 *                   example: "Rashi Microservice"
 */
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'Rashi Microservice' });
});

// Export app for testing
module.exports = app;

// Start server only if not in test environment
if (require.main === module) {
  (async () => {
    try {
      const { refreshRashiContentOverrides } = require('./rashiContentOverrides');
      await refreshRashiContentOverrides();
      await loadRashiRuntimeConfig();
    } catch (e) {
      console.warn('[rashiContentOverrides] startup:', e && e.message ? e.message : e);
    }
    const runtimePort = Number.parseInt(getRashiTunable('PORT', String(PORT)), 10) || PORT;
    app.listen(runtimePort, () => {
      console.log(`Rashi microservice running on port ${runtimePort}`);
      console.log(`Swagger documentation available at http://localhost:${runtimePort}/api-docs`);
    });
  })();
}