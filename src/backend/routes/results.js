// routes/results.js
const express = require('express');
const router = express.Router();

// GET /api/event-results
const { loadAllEventResults } = require('../lib/scoring');
const { getYear } = require('../lib/dataAccess');
router.get('/event-results', (req, res) => {
  const year = getYear(req);
  const results = loadAllEventResults(year);
  res.json(results);
});

module.exports = router;
