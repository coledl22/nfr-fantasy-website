// routes/events.js
const express = require('express');
const router = express.Router();
const { getYear, loadEventContestants } = require('../lib/dataAccess');

// GET /api/events
router.get('/events', (req, res) => {
  const year = getYear(req);
  const eventContestants = loadEventContestants(year);
  res.json(Object.keys(eventContestants));
});

// GET /api/contestants/:event
router.get('/contestants/:event', (req, res) => {
  const year = getYear(req);
  const eventContestants = loadEventContestants(year);
  const event = req.params.event;
  const people = eventContestants[event];
  if (!people) {
    return res.status(404).json({ error: 'Event not found' });
  }
  // Transform to array of objects: { id, name, rank, cost }
  // id: 1-based index, name: string, rank: 1-based index, cost: $150,000 - $10,000 steps
  const maxCost = 150000;
  const minCost = 10000;
  const n = people.length;
  const step = n > 1 ? (maxCost - minCost) / (n - 1) : 0;
  const result = people.map((name, i) => ({
    id: i + 1,
    name,
    rank: i + 1,
    cost: Math.round(maxCost - step * i)
  }));
  res.json(result);
});

module.exports = router;
