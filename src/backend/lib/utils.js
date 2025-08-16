// Logging utility, controlled by LOG_LEVEL env var
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
function log(...args) {
  if (LOG_LEVEL === 'debug') {
    console.log('[DEBUG]', ...args);
  }
}

// utils.js - shared helpers for backend
const fs = require('fs');
const path = require('path');

function readJsonFile(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    return fallback;
  }
}

function writeJsonFile(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Fuzzy match for contestant names (used in scoring)
// Enhanced: for Team Roping, match either side of the team regardless of order
function matchContestant(name, arr, event = null) {
  if (!Array.isArray(arr)) return undefined;
  name = name.trim().toLowerCase();
  const isTeamRoping = event && event.toLowerCase().includes('team roping');
  for (const row of arr) {
    if (row.Contestant) {
      let contestantField = row.Contestant.trim();
      if (isTeamRoping && contestantField.includes('/')) {
        const [side1, side2] = contestantField.split('/').map(s => s.trim().toLowerCase());
        if (side1 === name || side2 === name) {
          return row.Place;
        }
      } else if (contestantField.toLowerCase() === name) {
        return row.Place;
      }
    }
  }
  // Try loose match (ignore case, spaces, punctuation)
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const row of arr) {
    if (row.Contestant) {
      let contestantField = row.Contestant.trim();
      if (isTeamRoping && contestantField.includes('/')) {
        const [side1, side2] = contestantField.split('/').map(s => norm(s));
        if (side1 === norm(name) || side2 === norm(name)) {
          return row.Place;
        }
      } else if (norm(contestantField) === norm(name)) {
        return row.Place;
      }
    }
  }
  return undefined;
}

module.exports = {
  readJsonFile,
  writeJsonFile,
  matchContestant,
  log,
};
