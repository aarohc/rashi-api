const request = require('supertest');
const app = require('./server');
const { computeFamilyDashaWindow, TRANSITION_CLUSTER_DAYS } = require('./familyDashaService');

const surat = { date: '1979-09-05', time: '19:35:00', lat: 21.1702, lng: 72.8311, timezone: 5.5 };
const mumbai = { date: '1981-02-12', time: '11:10:00', lat: 19.076, lng: 72.8777, timezone: 5.5 };

describe('familyDashaService.computeFamilyDashaWindow', () => {
  it('returns lanes for two members across a one-year rolling window', () => {
    const now = new Date();
    const winStart = now.toISOString();
    const winEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const data = computeFamilyDashaWindow({
      windowStart: winStart,
      windowEnd: winEnd,
      members: [
        { id: 'm1', displayName: 'Mom', ...surat },
        { id: 'm2', displayName: 'Dad', ...mumbai },
      ],
    });
    expect(data.lanes).toHaveLength(2);
    expect(data.lanes[0].segments.length).toBeGreaterThanOrEqual(1);
    for (const lane of data.lanes) {
      for (const seg of lane.segments) {
        expect(typeof seg.mahaLord).toBe('string');
        expect(typeof seg.antarLord).toBe('string');
        expect(['favorable', 'mixed', 'challenging']).toContain(seg.tone);
        expect(new Date(seg.start).getTime()).toBeLessThan(new Date(seg.end).getTime());
      }
    }
    expect(data.overview).toHaveProperty('headlineKey');
    expect(data.overview).toHaveProperty('bullets');
    expect(data.overview).toHaveProperty('transitionClusters');
    expect(data.overview).toHaveProperty('dominantThemes');
    expect(data.overviewRulesVersion).toBe('1.0');
  });

  it('marks members with missing birth data as excluded without throwing', () => {
    const now = new Date();
    const winStart = now.toISOString();
    const winEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const data = computeFamilyDashaWindow({
      windowStart: winStart,
      windowEnd: winEnd,
      members: [
        { id: 'm1', displayName: 'Mom', ...surat },
        { id: 'm2', displayName: 'Time-unknown' },
      ],
    });
    expect(data.lanes).toHaveLength(2);
    const excluded = data.lanes.find((l) => l.memberId === 'm2');
    expect(excluded.excludedReason).toBe('missing_birth_data');
    expect(excluded.segments).toEqual([]);
  });

  it('rejects invalid window order', () => {
    expect(() =>
      computeFamilyDashaWindow({
        windowStart: '2026-12-01T00:00:00Z',
        windowEnd: '2026-01-01T00:00:00Z',
        members: [],
      })
    ).toThrow(/Invalid window/);
  });

  it('exposes the cluster threshold constant for documentation', () => {
    expect(TRANSITION_CLUSTER_DAYS).toBe(14);
  });
});

describe('POST /api/family-dasha-window', () => {
  it('returns 200 with lanes + overview', async () => {
    const now = new Date();
    const winStart = now.toISOString();
    const winEnd = new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post('/api/family-dasha-window')
      .send({
        windowStart: winStart,
        windowEnd: winEnd,
        members: [
          { id: 'm1', displayName: 'Mom', ...surat },
          { id: 'm2', displayName: 'Dad', ...mumbai },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.lanes).toHaveLength(2);
    expect(res.body.data.overview).toBeDefined();
  });

  it('returns 400 when members array missing', async () => {
    const res = await request(app)
      .post('/api/family-dasha-window')
      .send({ windowStart: '2026-01-01T00:00:00Z', windowEnd: '2026-06-01T00:00:00Z' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when members exceed cap', async () => {
    const tooMany = Array.from({ length: 26 }, (_, i) => ({ id: `m${i}`, displayName: `M${i}`, ...surat }));
    const res = await request(app)
      .post('/api/family-dasha-window')
      .send({
        windowStart: '2026-01-01T00:00:00Z',
        windowEnd: '2026-12-01T00:00:00Z',
        members: tooMany,
      });
    expect(res.status).toBe(400);
  });
});
