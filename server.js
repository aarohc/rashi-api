const express = require('express');
const bodyParser = require('body-parser');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const vedicAstrology = require('vedic-astrology');
const swisseph = require('swisseph-v2');
const { generateHoroscopeSVG } = require('./horoscopeGenerator');
const { generateVimshottariDasha } = require('./vimshottariService');
const { computeCompatibility } = require('./compatibilityService');
const { calculatePlanetAspects } = require('./aspectsService');
const { normalizeDateToYmd } = require('./utils');
const path = require('path');
const fs = require('fs');

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
        name: 'Compatibility',
        description: 'Relationship compatibility calculations'
      },
      {
        name: 'Aspects',
        description: 'Vedic planetary aspect (drishti) calculations'
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
    // Normalize date format to yyyy-mm-dd (vedic-astrology expects this format)
    const normalizedDate = normalizeDateToYmd(date);

    // Compute birth chart using vedic-astrology
    const birthChart = vedicAstrology.positioner.getBirthChart(normalizedDate, time, lat, lng, timezone);

    // Map Rashi codes to sign numbers (1-12)
    const rashiToNumber = {
      'Ar': 1,  // Aries
      'Ta': 2,  // Taurus
      'Ge': 3,  // Gemini
      'Cn': 4,  // Cancer
      'Le': 5,  // Leo
      'Vi': 6,  // Virgo
      'Li': 7,  // Libra
      'Sc': 8,  // Scorpio
      'Sg': 9,  // Sagittarius
      'Cp': 10, // Capricorn
      'Aq': 11, // Aquarius
      'Pi': 12  // Pisces
    };

    // Helper function to calculate house number from planet longitude and Lagna (1-12)
    const calculateHouseNumber = (planetLongitude, lagnaLongitude) => {
      let diff = planetLongitude - lagnaLongitude;
      if (diff < 0) diff += 360;
      const houseNumber = Math.floor(diff / 30) + 1;
      return houseNumber > 12 ? houseNumber - 12 : houseNumber;
    };

    const lagnaLongitude = birthChart.meta.La.longitude;

    // Helper function to calculate outer planets (Uranus, Neptune, Pluto) using swisseph
    // These are not provided by vedic-astrology library; returns longitude for house calculation
    const calculateOuterPlanet = (planetNum, normalizedDate, time, timezone) => {
      try {
        // Parse date and time
        const [year, month, day] = normalizedDate.split('-').map(Number);
        const [hours, minutes, seconds] = time.split(':').map(Number);
        
        // Convert to UTC (subtract timezone)
        let utcHours = hours - timezone;
        let utcDay = day;
        if (utcHours < 0) {
          utcHours += 24;
          utcDay--;
        } else if (utcHours >= 24) {
          utcHours -= 24;
          utcDay++;
        }
        
        // Calculate Julian Day
        const jd = swisseph.swe_julday(year, month, utcDay, utcHours + minutes/60 + seconds/3600, 1);
        
        // Set sidereal mode to Lahiri (same as vedic-astrology)
        swisseph.swe_set_sid_mode(1); // 1 = SE_SIDM_LAHIRI
        const ayanamsha = swisseph.swe_get_ayanamsa_ut(jd);
        
        // Calculate planet position
        const result = swisseph.swe_calc_ut(jd, planetNum, 0);
        const tropicalLong = result.longitude;
        const siderealLong = tropicalLong - ayanamsha;
        const normalizedLong = siderealLong < 0 ? siderealLong + 360 : siderealLong;
        const sign = Math.floor(normalizedLong / 30) + 1;
        const isRetro = result.longitudeSpeed < 0;
        
        return {
          current_sign: sign,
          isRetro: String(isRetro),
          longitude: normalizedLong
        };
      } catch (error) {
        console.error(`Error calculating outer planet ${planetNum}:`, error);
        return {
          current_sign: 0,
          isRetro: "false",
          longitude: 0
        };
      }
    };

    const uranusData = calculateOuterPlanet(7, normalizedDate, time, timezone);
    const neptuneData = calculateOuterPlanet(8, normalizedDate, time, timezone);
    const plutoData = calculateOuterPlanet(9, normalizedDate, time, timezone);

    // Transform data to match rashi.json format (with house_number for generic predictions)
    const rashiData = {
      Ascendant: {
        current_sign: rashiToNumber[birthChart.meta.La.rashi] || 0,
        isRetro: String(birthChart.meta.La.isRetrograde || false)
      },
      Sun: {
        current_sign: rashiToNumber[birthChart.meta.Su.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Su.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Su.isRetrograde || false)
      },
      Moon: {
        current_sign: rashiToNumber[birthChart.meta.Mo.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Mo.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Mo.isRetrograde || false)
      },
      Mars: {
        current_sign: rashiToNumber[birthChart.meta.Ma.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Ma.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Ma.isRetrograde || false)
      },
      Mercury: {
        current_sign: rashiToNumber[birthChart.meta.Me.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Me.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Me.isRetrograde || false)
      },
      Jupiter: {
        current_sign: rashiToNumber[birthChart.meta.Ju.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Ju.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Ju.isRetrograde || false)
      },
      Venus: {
        current_sign: rashiToNumber[birthChart.meta.Ve.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Ve.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Ve.isRetrograde || false)
      },
      Saturn: {
        current_sign: rashiToNumber[birthChart.meta.Sa.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Sa.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Sa.isRetrograde || false)
      },
      Rahu: {
        current_sign: rashiToNumber[birthChart.meta.Ra.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Ra.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Ra.isRetrograde || false)
      },
      Ketu: {
        current_sign: rashiToNumber[birthChart.meta.Ke.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Ke.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Ke.isRetrograde || false)
      },
      Uranus: {
        current_sign: uranusData.current_sign,
        house_number: calculateHouseNumber(uranusData.longitude, lagnaLongitude),
        isRetro: uranusData.isRetro
      },
      Neptune: {
        current_sign: neptuneData.current_sign,
        house_number: calculateHouseNumber(neptuneData.longitude, lagnaLongitude),
        isRetro: neptuneData.isRetro
      },
      Pluto: {
        current_sign: plutoData.current_sign,
        house_number: calculateHouseNumber(plutoData.longitude, lagnaLongitude),
        isRetro: plutoData.isRetro
      }
    };

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
    // Normalize date format to yyyy-mm-dd
    const normalizedDate = normalizeDateToYmd(date);

    // Compute birth chart using vedic-astrology
    const vedicAstrology = require('vedic-astrology');
    const swisseph = require('swisseph-v2');
    const birthChart = vedicAstrology.positioner.getBirthChart(normalizedDate, time, lat, lng, timezone);

    // Map Rashi codes to sign numbers (1-12)
    const rashiToNumber = {
      'Ar': 1, 'Ta': 2, 'Ge': 3, 'Cn': 4, 'Le': 5, 'Vi': 6,
      'Li': 7, 'Sc': 8, 'Sg': 9, 'Cp': 10, 'Aq': 11, 'Pi': 12
    };

    // Helper function to calculate outer planets using swisseph
    const calculateOuterPlanet = (planetNum, normalizedDate, time, timezone) => {
      try {
        const [year, month, day] = normalizedDate.split('-').map(Number);
        const [hours, minutes, seconds] = time.split(':').map(Number);
        
        let utcHours = hours - timezone;
        let utcDay = day;
        if (utcHours < 0) {
          utcHours += 24;
          utcDay--;
        } else if (utcHours >= 24) {
          utcHours -= 24;
          utcDay++;
        }
        
        const jd = swisseph.swe_julday(year, month, utcDay, utcHours + minutes/60 + seconds/3600, 1);
        swisseph.swe_set_sid_mode(1);
        const ayanamsha = swisseph.swe_get_ayanamsa_ut(jd);
        
        const result = swisseph.swe_calc_ut(jd, planetNum, 0);
        const tropicalLong = result.longitude;
        const siderealLong = tropicalLong - ayanamsha;
        const normalizedLong = siderealLong < 0 ? siderealLong + 360 : siderealLong;
        const sign = Math.floor(normalizedLong / 30) + 1;
        const isRetro = result.longitudeSpeed < 0;
        
        return { current_sign: sign, isRetro: String(isRetro) };
      } catch (error) {
        return { current_sign: 0, isRetro: "false" };
      }
    };

    // Build rashi data for aspect calculation
    const rashiData = {
      Ascendant: {
        current_sign: rashiToNumber[birthChart.meta.La.rashi] || 0,
        isRetro: String(birthChart.meta.La.isRetrograde || false)
      },
      Sun: {
        current_sign: rashiToNumber[birthChart.meta.Su.rashi] || 0,
        isRetro: String(birthChart.meta.Su.isRetrograde || false)
      },
      Moon: {
        current_sign: rashiToNumber[birthChart.meta.Mo.rashi] || 0,
        isRetro: String(birthChart.meta.Mo.isRetrograde || false)
      },
      Mars: {
        current_sign: rashiToNumber[birthChart.meta.Ma.rashi] || 0,
        isRetro: String(birthChart.meta.Ma.isRetrograde || false)
      },
      Mercury: {
        current_sign: rashiToNumber[birthChart.meta.Me.rashi] || 0,
        isRetro: String(birthChart.meta.Me.isRetrograde || false)
      },
      Jupiter: {
        current_sign: rashiToNumber[birthChart.meta.Ju.rashi] || 0,
        isRetro: String(birthChart.meta.Ju.isRetrograde || false)
      },
      Venus: {
        current_sign: rashiToNumber[birthChart.meta.Ve.rashi] || 0,
        isRetro: String(birthChart.meta.Ve.isRetrograde || false)
      },
      Saturn: {
        current_sign: rashiToNumber[birthChart.meta.Sa.rashi] || 0,
        isRetro: String(birthChart.meta.Sa.isRetrograde || false)
      },
      Rahu: {
        current_sign: rashiToNumber[birthChart.meta.Ra.rashi] || 0,
        isRetro: String(birthChart.meta.Ra.isRetrograde || false)
      },
      Ketu: {
        current_sign: rashiToNumber[birthChart.meta.Ke.rashi] || 0,
        isRetro: String(birthChart.meta.Ke.isRetrograde || false)
      },
      Uranus: calculateOuterPlanet(7, normalizedDate, time, timezone),
      Neptune: calculateOuterPlanet(8, normalizedDate, time, timezone),
      Pluto: calculateOuterPlanet(9, normalizedDate, time, timezone)
    };

    // Calculate aspects
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
    // Compute birth chart using vedic-astrology
    const birthChart = vedicAstrology.positioner.getBirthChart(date, time, lat, lng, timezone);

    // Map Rashi codes to sign numbers (1-12)
    const rashiToNumber = {
      'Ar': 1, 'Ta': 2, 'Ge': 3, 'Cn': 4, 'Le': 5, 'Vi': 6,
      'Li': 7, 'Sc': 8, 'Sg': 9, 'Cp': 10, 'Aq': 11, 'Pi': 12
    };

    // Helper function to calculate house number
    const calculateHouseNumber = (planetLongitude, lagnaLongitude) => {
      let diff = planetLongitude - lagnaLongitude;
      if (diff < 0) diff += 360;
      const houseNumber = Math.floor(diff / 30) + 1;
      return houseNumber > 12 ? houseNumber - 12 : houseNumber;
    };

    const lagnaLongitude = birthChart.meta.La.longitude;

    // Transform data to match rasi1.json format
    const rashiData = {
      Ascendant: {
        current_sign: rashiToNumber[birthChart.meta.La.rashi] || 0,
        isRetro: String(birthChart.meta.La.isRetrograde || false)
      },
      Sun: {
        current_sign: rashiToNumber[birthChart.meta.Su.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Su.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Su.isRetrograde || false)
      },
      Moon: {
        current_sign: rashiToNumber[birthChart.meta.Mo.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Mo.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Mo.isRetrograde || false)
      },
      Mars: {
        current_sign: rashiToNumber[birthChart.meta.Ma.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Ma.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Ma.isRetrograde || false)
      },
      Mercury: {
        current_sign: rashiToNumber[birthChart.meta.Me.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Me.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Me.isRetrograde || false)
      },
      Jupiter: {
        current_sign: rashiToNumber[birthChart.meta.Ju.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Ju.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Ju.isRetrograde || false)
      },
      Venus: {
        current_sign: rashiToNumber[birthChart.meta.Ve.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Ve.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Ve.isRetrograde || false)
      },
      Saturn: {
        current_sign: rashiToNumber[birthChart.meta.Sa.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Sa.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Sa.isRetrograde || false)
      },
      Rahu: {
        current_sign: rashiToNumber[birthChart.meta.Ra.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Ra.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Ra.isRetrograde || false)
      },
      Ketu: {
        current_sign: rashiToNumber[birthChart.meta.Ke.rashi] || 0,
        house_number: calculateHouseNumber(birthChart.meta.Ke.longitude, lagnaLongitude),
        isRetro: String(birthChart.meta.Ke.isRetrograde || false)
      }
    };

    // Generate SVG
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
 *     description: Returns static JSON from data/planet.json and data/house.json for building generic predictions by lookup. planetInHouse keys = planet names then house "1".."12"; houseByRashi keys = house "1".."12" then rashi "1".."12".
 *     tags: [Rashi]
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
app.get('/api/generic-predictions', (req, res) => {
  try {
    const dataDir = path.join(__dirname, 'data');
    const planetPath = path.join(dataDir, 'planet.json');
    const housePath = path.join(dataDir, 'house.json');
    const planetInHouse = JSON.parse(fs.readFileSync(planetPath, 'utf8'));
    const houseByRashi = JSON.parse(fs.readFileSync(housePath, 'utf8'));
    res.json({ planetInHouse, houseByRashi });
  } catch (err) {
    console.error('Error serving generic-predictions:', err);
    res.status(500).json({ error: 'Failed to load generic prediction data' });
  }
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
app.listen(PORT, () => {
  console.log(`Rashi microservice running on port ${PORT}`);
    console.log(`Swagger documentation available at http://localhost:${PORT}/api-docs`);
});
}