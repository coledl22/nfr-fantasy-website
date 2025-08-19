// dataAccess.js - handles all file/data access and year logic
const path = require('path');
const { readJsonFile, writeJsonFile, log } = require('./utils');


const fs = require('fs');
const DATA_DIR = path.join(__dirname, '..', 'data');
const SUPPORTED_YEARS = (() => {
  try {
    return fs.readdirSync(DATA_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .filter(name => /^\d{4}$/.test(name))
      .filter(year => fs.existsSync(path.join(DATA_DIR, year, 'eventContestants.json')))
      .sort();
  } catch (e) {
    return [];
  }
})();
const DEFAULT_YEAR = SUPPORTED_YEARS.length > 0 ? SUPPORTED_YEARS[SUPPORTED_YEARS.length - 1] : '2024';

function getYear(req, { throwIfInvalid = false } = {}) {
  const y = req.query.year;
  if (y && !SUPPORTED_YEARS.includes(y)) {
    if (throwIfInvalid) throw new Error('Year not found');
    return DEFAULT_YEAR;
  }
  if (y && SUPPORTED_YEARS.includes(y)) return y;
  return DEFAULT_YEAR;
}

function getDataDir(year) {
  const dir = path.join(__dirname, '..', 'data', year);
  log('getDataDir:', dir);
  return dir;
}
function getScraperResultsDir(year) {
  const dir = path.join(__dirname, '../scraper/results', year);
  log('getScraperResultsDir:', dir);
  return dir;
}
function getEventContestantsFile(year) {
  return path.join(getDataDir(year), 'eventContestants.json');
}
function getTeamsFile(year) {
  return path.join(getDataDir(year), 'teams.json');
}

function loadEventContestants(year) {
  const file = getEventContestantsFile(year);
  log('loadEventContestants:', file);
  return readJsonFile(file, {});
}
function loadTeams(year) {
  const file = getTeamsFile(year);
  log('loadTeams:', file);
  return readJsonFile(file, []);
}
function saveTeams(year, teams) {
  const file = getTeamsFile(year);
  log('saveTeams:', file);
  writeJsonFile(file, teams);
}

module.exports = {
  SUPPORTED_YEARS,
  DEFAULT_YEAR,
  getYear,
  getDataDir,
  getScraperResultsDir,
  getEventContestantsFile,
  getTeamsFile,
  loadEventContestants,
  loadTeams,
  saveTeams,
};
