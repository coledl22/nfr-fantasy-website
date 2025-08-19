// tests/api.test.js
// Unit tests for API endpoints using supertest and jest
const request = require('supertest');
const app = require('../server');

describe('API Endpoints', () => {
  describe('GET /api/available-years', () => {
    it('should return a list of available years', async () => {
      const res = await request(app).get('/api/available-years');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Optionally, check that the years are 4-digit numbers
      res.body.forEach(year => expect(String(year)).toMatch(/^\d{4}$/));
    });
  });
  // --- results.js ---
  describe('GET /api/event-results', () => {
    it('should return event results for the default year', async () => {
      const res = await request(app).get('/api/event-results');
      expect(res.statusCode).toBe(200);
      expect(res.body).toBeDefined();
      expect(typeof res.body).toBe('object');
    });
    it('should return event results for a specific year', async () => {
      const res = await request(app).get('/api/event-results?year=2024');
      expect(res.statusCode).toBe(200);
      expect(res.body).toBeDefined();
      expect(typeof res.body).toBe('object');
    });
  });

  // --- teams.js ---
  describe('POST /api/validate', () => {
    it('should return error for missing selections', async () => {
      const res = await request(app)
        .post('/api/validate')
        .send({ name: 'Test Team', selections: [] });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBeDefined();
    });
    it('should return error for missing name', async () => {
      const res = await request(app)
        .post('/api/validate')
        .send({ selections: [1,2,3,4,5,6,7,8] });
      expect(res.statusCode).toBe(400);
    });
    // Add more edge cases as needed
  });

  describe('GET /api/team-exists/:name', () => {
    it('should return exists=false for a random team name', async () => {
      const res = await request(app).get('/api/team-exists/SomeRandomName123');
      expect(res.statusCode).toBe(200);
      expect(res.body.exists).toBe(false);
    });
  });

  describe('GET /api/results', () => {
    it('should return results for all teams', async () => {
      const res = await request(app).get('/api/results');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // --- events.js ---
  describe('GET /api/events', () => {
    it('should return a list of events', async () => {
      const res = await request(app).get('/api/events');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/contestants/:event', () => {
    const events = [
      'Bareback Riding',
      'Steer Wrestling',
      'Saddle Bronc Riding',
      'Bull Riding',
      'Team Roping Header',
      'Team Roping Heeler',
      'Tie-Down Roping',
      'Barrel Racing',
    ];
  const { SUPPORTED_YEARS: years } = require('../lib/dataAccess');
    // Failure test cases
    it('should return 404 for an invalid event', async () => {
      const res = await request(app).get('/api/contestants/NotARealEvent');
      expect(res.statusCode).toBe(404);
    });
    it('should return 404 for a valid event with an invalid year', async () => {
      const res = await request(app).get('/api/contestants/Steer%20Wrestling?year=1999');
      expect(res.statusCode).toBe(404);
    });
    for (const event of events) {
      it(`should return a list of contestants for ${event} (default year)`, async () => {
        const res = await request(app).get(`/api/contestants/${encodeURIComponent(event)}`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });
      for (const year of years) {
        it(`should return a list of contestants for ${event} (year ${year})`, async () => {
          const res = await request(app).get(`/api/contestants/${encodeURIComponent(event)}?year=${year}`);
          expect(res.statusCode).toBe(200);
          expect(Array.isArray(res.body)).toBe(true);
        });
      }
    }
  });

  // Add more tests for error/edge cases as needed
});
