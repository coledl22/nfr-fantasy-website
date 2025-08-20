// tests/api.test.js
// Unit tests for API endpoints using supertest and jest

const request = require('supertest');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');



let app;
let inMemoryDb;
let dataAccess;


beforeAll(async () => {
  jest.resetModules();
  inMemoryDb = new sqlite3.Database(':memory:');
  dataAccess = require('../lib/dataAccess');
  await new Promise((resolve, reject) => {
    inMemoryDb.run(`CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year TEXT NOT NULL,
      name TEXT NOT NULL,
      selections TEXT NOT NULL,
      totalCost INTEGER NOT NULL,
      submittedAt TEXT NOT NULL
    )`, err => (err ? reject(err) : resolve()));
  });
  const origLoadTeams = dataAccess.loadTeams;
  const origSaveTeams = dataAccess.saveTeams;
  jest.spyOn(dataAccess, 'loadTeams').mockImplementation((year, dbOverride) => origLoadTeams.call(dataAccess, year, dbOverride || inMemoryDb));
  jest.spyOn(dataAccess, 'saveTeams').mockImplementation((year, teams) => origSaveTeams.call(dataAccess, year, teams, inMemoryDb));
  app = require('../server');
});

afterAll(() => {
  inMemoryDb.close();
  jest.restoreAllMocks();
});
describe('POST /api/teams and GET /api/results (mock DB)', () => {

  // Test: Attempting to create two teams with the same name for the same year
  // Success: The first team is created, the second attempt returns a 400 error for duplicate name
  it('should error when creating a team with a duplicate name', async () => {
    const year = dataAccess.SUPPORTED_YEARS[0] || '2024';
    const eventContestants = dataAccess.loadEventContestants(year);
    const events = Object.keys(eventContestants);
    const selections = events.map(() => 10);
    const teamName = 'DuplicateNameTeam';
    // First creation should succeed
    const firstRes = await request(app)
      .post('/api/validate')
      .send({ name: teamName, selections });
    expect(firstRes.statusCode).toBe(200);
    expect(firstRes.body.success).toBe(true);
    // Second creation with same name should fail
    const secondRes = await request(app)
      .post('/api/validate')
      .send({ name: teamName, selections });
    expect(secondRes.statusCode).toBe(400);
    expect(secondRes.body.error).toMatch(/already exists/i);
  });

  // Test: Attempting to create a team with an invalid selection index (out of range)
  // Success: Returns a 400 error for invalid selection
  it('should error when a selection index is out of range', async () => {
    const year = dataAccess.SUPPORTED_YEARS[0] || '2024';
    const eventContestants = dataAccess.loadEventContestants(year);
    const events = Object.keys(eventContestants);
    // Use a valid selection for all but one event, which is set to an invalid index (e.g., 99)
    const selections = events.map((_, i) => (i === 0 ? 99 : 10));
    const teamName = 'InvalidSelectionTeam';
    const res = await request(app)
      .post('/api/validate')
      .send({ name: teamName, selections });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/invalid selection/i);
  });

  // Test: Creating a team with a valid budget, then attempting to create a team that exceeds the budget
  // Success: The first team is created successfully, the second attempt returns a 400 error for exceeding the budget
  it('should error when team selections exceed the allowed budget', async () => {
    const year = dataAccess.SUPPORTED_YEARS[0] || '2024';
    const eventContestants = dataAccess.loadEventContestants(year);
    const events = Object.keys(eventContestants);
    // Select 1st place for each event (most expensive, $150,000 each)
    const expensiveSelections = events.map(() => 1);
    const teamName = 'BudgetTestTeam';
    // First, create a valid team (10th place, $60,000 each)
    const validSelections = events.map(() => 10);
    const validRes = await request(app)
      .post('/api/validate')
      .send({ name: teamName + 'Valid', selections: validSelections });
    expect(validRes.statusCode).toBe(200);
    expect(validRes.body.success).toBe(true);

    // Now, try to create a team that exceeds the budget
    const overBudgetRes = await request(app)
      .post('/api/validate')
      .send({ name: teamName + 'Over', selections: expensiveSelections });
    expect(overBudgetRes.statusCode).toBe(400);
    expect(overBudgetRes.body.error).toMatch(/exceeds budget/i);
  });
  // Test: Adding a new team and verifying it appears in the results
  // Success: The team is validated, added, and then found in the results list
  it('should add a new team and return it in results', async () => {
    const year = dataAccess.SUPPORTED_YEARS[0] || '2024';
    const eventContestants = dataAccess.loadEventContestants(year);
    const events = Object.keys(eventContestants);
  // Select 10th place for each event (cheaper, $60,000 each)
  const selections = events.map(() => 10);
    const teamName = 'MockTestTeam';
    const res = await request(app)
      .post('/api/validate')
      .send({ name: teamName, selections });
    if (res.statusCode !== 200) {
      // Print error for debugging
      console.error('Validation failed:', res.body);
    }
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    const resultsRes = await request(app).get('/api/results');
    expect(resultsRes.statusCode).toBe(200);
    const found = resultsRes.body.some(t => t.team === teamName);
    expect(found).toBe(true);
  });
});

describe('API Endpoints', () => {
  describe('GET /api/available-years', () => {
  // Test: Fetching available years
  // Success: Returns a 200 status and an array of 4-digit years
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
  // Test: Fetching event results for the default year
  // Success: Returns a 200 status and a defined object
  it('should return event results for the default year', async () => {
      const res = await request(app).get('/api/event-results');
      expect(res.statusCode).toBe(200);
      expect(res.body).toBeDefined();
      expect(typeof res.body).toBe('object');
    });
  // Test: Fetching event results for a specific year
  // Success: Returns a 200 status and a defined object
  it('should return event results for a specific year', async () => {
      const res = await request(app).get('/api/event-results?year=2024');
      expect(res.statusCode).toBe(200);
      expect(res.body).toBeDefined();
      expect(typeof res.body).toBe('object');
    });
  });

  // --- teams.js ---
  describe('POST /api/validate', () => {
  // Test: Validating a team with missing selections
  // Success: Returns a 400 status and an error message
  it('should return error for missing selections', async () => {
      const res = await request(app)
        .post('/api/validate')
        .send({ name: 'Test Team', selections: [] });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  // Test: Validating a team with missing name
  // Success: Returns a 400 status
  it('should return error for missing name', async () => {
      const res = await request(app)
        .post('/api/validate')
        .send({ selections: [1,2,3,4,5,6,7,8] });
      expect(res.statusCode).toBe(400);
    });
    // Add more edge cases as needed
  });

  describe('GET /api/team-exists/:name', () => {
  // Test: Checking if a random team name exists
  // Success: Returns a 200 status and exists=false
  it('should return exists=false for a random team name', async () => {
      const res = await request(app).get('/api/team-exists/SomeRandomName123');
      expect(res.statusCode).toBe(200);
      expect(res.body.exists).toBe(false);
    });
  });

  describe('GET /api/results', () => {
  // Test: Fetching results for all teams
  // Success: Returns a 200 status and an array of results
  it('should return results for all teams', async () => {
      const res = await request(app).get('/api/results');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // --- events.js ---
  describe('GET /api/events', () => {
  // Test: Fetching the list of events
  // Success: Returns a 200 status and an array of events
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
  // Test: Fetching contestants for an invalid event
  // Success: Returns a 404 status
  it('should return 404 for an invalid event', async () => {
      const res = await request(app).get('/api/contestants/NotARealEvent');
      expect(res.statusCode).toBe(404);
    });
  // Test: Fetching contestants for a valid event with an invalid year
  // Success: Returns a 404 status
  it('should return 404 for a valid event with an invalid year', async () => {
      const res = await request(app).get('/api/contestants/Steer%20Wrestling?year=1999');
      expect(res.statusCode).toBe(404);
    });
    for (const event of events) {
  // Test: Fetching contestants for an event for the default year
  // Success: Returns a 200 status and an array of contestants
  it(`should return a list of contestants for ${event} (default year)`, async () => {
        const res = await request(app).get(`/api/contestants/${encodeURIComponent(event)}`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });
      for (const year of years) {
        // Test: Fetching contestants for an event for a specific year
        // Success: Returns a 200 status and an array of contestants
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
