const request = require('supertest');
const app = require('./server');

function responseBodyAsString(res) {
  if (typeof res.text === 'string' && res.text.length) return res.text;
  if (typeof res.body === 'string') return res.body;
  if (Buffer.isBuffer(res.body)) return res.body.toString('utf8');
  return '';
}

describe('Rashi API Server', () => {
  // Test data: 5th September 1979, 19:35, Surat, Gujarat, India
  const testData = {
    date: '1979-09-05',
    time: '19:35:00',
    lat: 21.1702,
    lng: 72.8311,
    timezone: 5.5,
  };

  describe('GET /api/generic-predictions', () => {
    it('should include outer planets in planetInHouse', async () => {
      const response = await request(app).get('/api/generic-predictions?locale=en').expect(200);
      const { planetInHouse } = response.body;
      expect(planetInHouse).toBeDefined();
      for (const p of ['Uranus', 'Neptune', 'Pluto']) {
        expect(planetInHouse).toHaveProperty(p);
        expect(Object.keys(planetInHouse[p])).toHaveLength(12);
        expect(planetInHouse[p]['1']).toMatch(new RegExp(`### ${p} in`));
      }
    });
  });

  describe('POST /api/rashi', () => {
    it('should successfully compute Rashi data for the given birth details', async () => {
      const response = await request(app)
        .post('/api/rashi')
        .send(testData);
      
      // Log response for debugging
      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }
      
      expect(response.status).toBe(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');

      // Verify all required Rashi fields are present (matching rasi1.json format)
      const { data } = response.body;
      expect(data).toHaveProperty('Ascendant');
      expect(data).toHaveProperty('Sun');
      expect(data).toHaveProperty('Moon');
      expect(data).toHaveProperty('Mars');
      expect(data).toHaveProperty('Mercury');
      expect(data).toHaveProperty('Jupiter');
      expect(data).toHaveProperty('Venus');
      expect(data).toHaveProperty('Saturn');
      expect(data).toHaveProperty('Rahu');
      expect(data).toHaveProperty('Ketu');
      expect(data).toHaveProperty('Uranus');
      expect(data).toHaveProperty('Neptune');
      expect(data).toHaveProperty('Pluto');

      // Verify structure matches rasi1.json format
      expect(data.Ascendant).toHaveProperty('current_sign');
      expect(data.Ascendant).toHaveProperty('isRetro');
      expect(typeof data.Ascendant.current_sign).toBe('number');
      expect(typeof data.Ascendant.isRetro).toBe('string');

      // Verify planets have current_sign, house_number, and isRetro
      const planets = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
      planets.forEach(planet => {
        expect(data[planet]).toHaveProperty('current_sign');
        expect(data[planet]).toHaveProperty('house_number');
        expect(data[planet]).toHaveProperty('isRetro');
        expect(typeof data[planet].current_sign).toBe('number');
        expect(typeof data[planet].house_number).toBe('number');
        expect(typeof data[planet].isRetro).toBe('string');
        expect(data[planet].current_sign).toBeGreaterThanOrEqual(1);
        expect(data[planet].current_sign).toBeLessThanOrEqual(12);
        expect(data[planet].house_number).toBeGreaterThanOrEqual(1);
        expect(data[planet].house_number).toBeLessThanOrEqual(12);
      });

      // Verify against expected values from rashi.json
      expect(data.Ascendant.current_sign).toBe(12); // Pisces
      expect(data.Sun.current_sign).toBe(5); // Leo
      expect(data.Moon.current_sign).toBe(11); // Aquarius
      expect(data.Mars.current_sign).toBe(3); // Gemini
      expect(data.Mercury.current_sign).toBe(5); // Leo
      expect(data.Jupiter.current_sign).toBe(5); // Leo
      expect(data.Venus.current_sign).toBe(5); // Leo
      expect(data.Saturn.current_sign).toBe(5); // Leo
      expect(data.Rahu.current_sign).toBe(5); // Leo
      expect(data.Rahu.isRetro).toBe("true");
      expect(data.Ketu.current_sign).toBe(11); // Aquarius
      expect(data.Ketu.isRetro).toBe("true");

      // Log the results for verification
      console.log('\n=== Rashi Data for 5th September 1979, 19:35, Surat, Gujarat ===');
      console.log('Ascendant:', JSON.stringify(data.Ascendant, null, 2));
      console.log('Sun:', JSON.stringify(data.Sun, null, 2));
      console.log('Moon:', JSON.stringify(data.Moon, null, 2));
      console.log('Mars:', JSON.stringify(data.Mars, null, 2));
      console.log('Mercury:', JSON.stringify(data.Mercury, null, 2));
      console.log('Jupiter:', JSON.stringify(data.Jupiter, null, 2));
      console.log('Venus:', JSON.stringify(data.Venus, null, 2));
      console.log('Saturn:', JSON.stringify(data.Saturn, null, 2));
      console.log('Rahu:', JSON.stringify(data.Rahu, null, 2));
      console.log('Ketu:', JSON.stringify(data.Ketu, null, 2));
    });

    it('should return 400 error when date is missing', async () => {
      const { date, ...rest } = testData;
      const response = await request(app)
        .post('/api/rashi')
        .send(rest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should return 400 error when time is missing', async () => {
      const { time, ...rest } = testData;
      const response = await request(app)
        .post('/api/rashi')
        .send(rest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should return 400 error when lat is missing', async () => {
      const { lat, ...rest } = testData;
      const response = await request(app)
        .post('/api/rashi')
        .send(rest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should return 400 error when lng is missing', async () => {
      const { lng, ...rest } = testData;
      const response = await request(app)
        .post('/api/rashi')
        .send(rest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should return 400 error when timezone is missing', async () => {
      const { timezone, ...rest } = testData;
      const response = await request(app)
        .post('/api/rashi')
        .send(rest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should handle invalid date format gracefully', async () => {
      const invalidData = {
        ...testData,
        date: 'invalid-date'  // Should be in dd-mm-yyyy format
      };

      const response = await request(app)
        .post('/api/rashi')
        .send(invalidData)
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Failed to compute Rashi data');
    });

    it('should handle invalid coordinates gracefully', async () => {
      const invalidData = {
        ...testData,
        lat: 'invalid',
        lng: 'invalid'
      };

      const response = await request(app)
        .post('/api/rashi')
        .send(invalidData)
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/yogas', () => {
    it('should return yogas and summary for valid birth data', async () => {
      const response = await request(app).post('/api/yogas').send(testData).expect(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('yogas');
      expect(response.body.data).toHaveProperty('summary');
      expect(Array.isArray(response.body.data.yogas)).toBe(true);
      expect(typeof response.body.data.summary.totalYogas).toBe('number');
      const first = response.body.data.yogas[0];
      if (first) {
        expect(Array.isArray(first.opportunities)).toBe(true);
        expect(first.opportunities.length).toBeGreaterThan(0);
        expect(Array.isArray(first.challenges)).toBe(true);
        expect(first.challenges.length).toBeGreaterThan(0);
      }
    });
  });

  describe('POST /api/compatibility', () => {
    it('should return a normalized compatibility payload', async () => {
      const response = await request(app)
        .post('/api/compatibility')
        .send({ person1: testData, person2: testData })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalScore');
      expect(response.body.data).toHaveProperty('normalizedScore');
      expect(response.body.data).toHaveProperty('level');
      expect(response.body.data).toHaveProperty('compatible');
      expect(Array.isArray(response.body.data.details)).toBe(true);
      expect(typeof response.body.data.totalScore).toBe('number');
      expect(response.body.data.totalScore).toBeGreaterThanOrEqual(0);
    });

    it('should return 400 when person2 is missing', async () => {
      const response = await request(app)
        .post('/api/compatibility')
        .send({ person1: testData })
        .expect(400);

      expect(response.body.error).toContain('Missing required fields');
    });
  });

  describe('POST /api/ashtakoot', () => {
    it('should return classical compatibility with nakshatra payload', async () => {
      const response = await request(app)
        .post('/api/ashtakoot')
        .send({ person1: testData, person2: testData })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalScore');
      expect(response.body.data).toHaveProperty('nakshatra');
      expect(response.body.data.nakshatra).toHaveProperty('person1');
      expect(response.body.data.nakshatra).toHaveProperty('person2');
      expect(response.body.data.nakshatra).toHaveProperty('yoniScore');
      expect(response.body.data.nakshatra.person1).toHaveProperty('name');
      expect(response.body.data.nakshatra.person2).toHaveProperty('animal');
      expect(typeof response.body.data.nakshatra.yoniScore).toBe('number');
    });

    it('should return 400 for missing required compatibility fields', async () => {
      const badPerson = { ...testData };
      delete badPerson.time;
      const response = await request(app)
        .post('/api/ashtakoot')
        .send({ person1: badPerson, person2: testData })
        .expect(400);

      expect(response.body.error).toContain('Missing required field');
    });
  });

  describe('POST /api/horoscope', () => {
    it('should successfully generate horoscope SVG', async () => {
      const response = await request(app)
        .post('/api/horoscope')
        .send(testData)
        .expect(200);

      const svg = responseBodyAsString(response);
      expect(response.headers['content-type']).toMatch(/svg/);
      expect(svg).toContain('<svg');
      expect(svg).toMatch(/Vedic Horoscope/);
    });

    it('should return JSON format when Accept header is application/json', async () => {
      const response = await request(app)
        .post('/api/horoscope')
        .set('Accept', 'application/json')
        .send(testData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('svg');
      expect(response.body).toHaveProperty('format', 'svg');
      expect(typeof response.body.svg).toBe('string');
      expect(response.body.svg).toContain('<svg');
    });

    it('should return 400 error when required fields are missing', async () => {
      const { date, ...rest } = testData;
      const response = await request(app)
        .post('/api/horoscope')
        .send(rest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should accept size parameter', async () => {
      const response = await request(app)
        .post('/api/horoscope')
        .send({ ...testData, size: 1000 })
        .expect(200);

      const svg = responseBodyAsString(response);
      expect(svg).toContain('width="1000"');
      expect(svg).toContain('height="1000"');
    });
  });

  describe('POST /api/mudda-dasha', () => {
    it('should return exactly nine Mudda segments for a birth-year after birth', async () => {
      const response = await request(app)
        .post('/api/mudda-dasha')
        .send({ ...testData, year: 2002 })
        .expect(200);

      expect(response.body.success).toBe(true);
      const { muddaSegments, year } = response.body.data;
      expect(year).toBe(2002);
      expect(Array.isArray(muddaSegments)).toBe(true);
      expect(muddaSegments).toHaveLength(9);

      for (let i = 0; i < muddaSegments.length; i++) {
        const s = muddaSegments[i];
        expect(s).toHaveProperty('muddaLord');
        expect(s).toHaveProperty('start');
        expect(s).toHaveProperty('end');
        expect(s).toHaveProperty('days');
        expect(s.muddaLord).toBe(s.pratyadashaLord);
      }

      for (let i = 1; i < muddaSegments.length; i++) {
        const prevEnd = new Date(muddaSegments[i - 1].end).getTime();
        const curStart = new Date(muddaSegments[i].start).getTime();
        expect(curStart).toBe(prevEnd);
      }
    });

    it('should return 400 when birth-year is before birth calendar year', async () => {
      const response = await request(app)
        .post('/api/mudda-dasha')
        .send({ ...testData, year: 1970 })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/panchang', () => {
    it('should return malefic windows, hora, and limbs for Mumbai 2026-04-18', async () => {
      const response = await request(app)
        .post('/api/panchang')
        .send({
          lat: 19.076,
          lng: 72.8777,
          timezone: 5.5,
          date: '2026-04-18',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      const { data } = response.body;
      expect(data.dateLocal).toBe('2026-04-18');
      expect(data.maleficDaytimeWindows).toHaveLength(3);
      expect(data.hora.day).toHaveLength(12);
      expect(data.hora.night).toHaveLength(12);
      expect(data.choghadiya.day).toHaveLength(8);
      expect(data.limbsAtLocalNoon.nakshatra.name).toBeDefined();
      expect(data.limbsAtLocalNoon.karana).toMatchObject({
        name: expect.any(String),
        serial: expect.any(Number),
        fixed: expect.any(Boolean),
      });
    });

    it('should reject missing date', async () => {
      const response = await request(app)
        .post('/api/panchang')
        .send({ lat: 19.076, lng: 72.8777, timezone: 5.5 })
        .expect(400);
      expect(response.body.error).toMatch(/date/i);
    });
  });

  describe('karanaFromElongation', () => {
    const { karanaFromElongation } = require('./panchangService');

    it('maps 0° elongation to Kimstughna', () => {
      expect(karanaFromElongation(0)).toMatchObject({ name: 'Kimstughna', serial: 0, fixed: true });
    });

    it('maps first movable slice after Kimstughna to Bava', () => {
      expect(karanaFromElongation(6)).toMatchObject({ name: 'Bava', serial: 1, fixed: false });
    });
  });

  describe('POST /api/choghadiya', () => {
    it('should reject when lat, lng, or timezone is missing', async () => {
      const response = await request(app)
        .post('/api/choghadiya')
        .send({ lat: 19.076, lng: 72.8777 })
        .expect(400);

      expect(response.body.error).toMatch(/timezone/i);
    });

    it('should reject invalid time format', async () => {
      const response = await request(app)
        .post('/api/choghadiya')
        .send({
          lat: 19.076,
          lng: 72.8777,
          timezone: 5.5,
          date: '2026-04-18',
          time: 'noon',
        })
        .expect(400);

      expect(response.body.error).toMatch(/time/i);
    });

    /**
     * Golden: Mumbai, 18 Apr 2026 (Saturday). Swiss Ephemeris sunrise ~00:49 UTC;
     * first daytime Choghadiya starts with Saturn (Kaal); first night with Venus (Chal) as fifth day lord.
     * Cross-check style: https://www.drikpanchang.com/muhurat/choghadiya.html (city-specific table).
     */
    it('should return eight day and eight night segments with expected rulers for Mumbai 2026-04-18', async () => {
      const response = await request(app)
        .post('/api/choghadiya')
        .send({
          lat: 19.076,
          lng: 72.8777,
          timezone: 5.5,
          date: '2026-04-18',
          time: '12:00:00',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      const { data } = response.body;
      expect(data.location).toEqual({ lat: 19.076, lng: 72.8777, timezone: 5.5 });
      expect(data.dateLocal).toBe('2026-04-18');
      expect(data.weekdayIndex).toBe(6);
      expect(data.sunrise).toMatch(/^2026-04-18T00:49:1[0-2]\.\d{3}Z$/);
      expect(data.sunset).toMatch(/^2026-04-18T13:26:4[5-7]\.\d{3}Z$/);
      expect(data.day).toHaveLength(8);
      expect(data.night).toHaveLength(8);
      expect(data.day[0].rulerPlanet).toBe('Saturn');
      expect(data.day[0].label).toBe('Kaal');
      expect(data.night[0].rulerPlanet).toBe('Venus');
      expect(data.night[0].label).toBe('Chal');
      expect(data.current.phase).toBe('day');
      expect(data.current.rulerPlanet).toBe('Sun');
    });
  });

  describe('GET /health', () => {
    it('should return health check status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('service', 'Rashi Microservice');
    });
  });
});

