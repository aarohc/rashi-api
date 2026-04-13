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

