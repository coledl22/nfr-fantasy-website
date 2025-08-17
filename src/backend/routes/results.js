// routes/results.js
const express = require('express');
const router = express.Router();

// GET /api/event-results
const { loadAllEventResults } = require('../lib/scoring');
const { getYear } = require('../lib/dataAccess');
  const { loadEventContestants } = require('../lib/dataAccess');
router.get('/event-results', (req, res) => {
  const year = getYear(req);
  // Load eventContestants for the given year using dataAccess
  const eventContestants = loadEventContestants(year);
  const results = loadAllEventResults(year, eventContestants);
  res.json(results);
});

module.exports = router;
