// routes/teams.js
const express = require('express');
const router = express.Router();
const { getYear, loadEventContestants, loadTeams, saveTeams } = require('../lib/dataAccess');
const { log } = require('../lib/utils');

const BUDGET = 550000;
const NUM_ROUNDS = 10;

// POST /api/validate
router.post('/validate', async (req, res) => {
  const year = getYear(req);
  const eventContestants = loadEventContestants(year);
  const events = Object.keys(eventContestants);
  const { name, selections, budget = BUDGET } = req.body;
  if (!Array.isArray(selections) || selections.length !== events.length) {
    return res.status(400).json({ error: `Select one person for each of ${events.length} events.` });
  }
  let totalCost = 0;
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const id = selections[i];
    const people = eventContestants[event];
    const person = people[id-1];
    if (!person) {
      log(`[VALIDATE] Invalid selection for event: ${event}. Selection ID: ${id}. People:`, people);
      return res.status(400).json({ error: `Invalid selection for event: ${event}` });
    }
  // Cost: 1st place (index 0) = $150,000, 2nd = $140,000, ..., 15th (index 14) = $10,000
  const cost = 150000 - ((id-1) * 10000);
  totalCost += cost;
  }
  if (totalCost > budget) {
    return res.status(400).json({ error: `Selection exceeds budget of $${budget}.` });
  }
  let teams = await loadTeams(year);
  const newTeam = { name, selections, totalCost, submittedAt: new Date().toISOString() };
  const existingIdx = teams.findIndex(t => t.name && t.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (existingIdx !== -1) {
    return res.status(400).json({ error: 'A team with this name already exists for this year.' });
  } else {
    teams.push(newTeam);
    await saveTeams(year, teams);
    res.json({ success: true, totalCost });
  }
});

// GET /api/team-exists/:name
router.get('/team-exists/:name', async (req, res) => {
  const year = getYear(req);
  const teams = await loadTeams(year);
  const name = req.params.name;
  const exists = teams.some(t => t.name && t.name.trim().toLowerCase() === name.trim().toLowerCase());
  res.json({ exists });
});

// GET /api/results
const { loadAllEventResults, scoreTeams } = require('../lib/scoring');
router.get('/results', async (req, res) => {
  const year = getYear(req);
  log('API /results year', year);
  const eventContestants = loadEventContestants(year);
  const events = Object.keys(eventContestants);
  const teams = await loadTeams(year);
  const eventResults = loadAllEventResults(year, eventContestants);
  log('API /results loaded eventResults keys', Object.keys(eventResults));
  for (const [event, data] of Object.entries(eventResults)) {
    if (data) {
      const rounds = Object.keys(data);
      log(`API /results Event: ${event}, Rounds: ${rounds.join(', ')}`);
    } else {
      log(`API /results Event: ${event}, No data loaded`);
    }
  }
  const results = scoreTeams(teams, events, eventContestants, eventResults);
  res.json(results);
});

module.exports = router;
