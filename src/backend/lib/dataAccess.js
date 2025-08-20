// dataAccess.js - handles all file/data access and year logic
const path = require('path');

const { readJsonFile, writeJsonFile, log } = require('./utils');

// SQLite setup for teams
const sqlite3 = require('sqlite3').verbose();
const TEAMS_DB_PATH = path.join(__dirname, '..', 'data', 'teams.db');

// Allow injection of a custom db (for testing)
function createTeamsDb(customPath) {
  const dbInstance = new sqlite3.Database(customPath || TEAMS_DB_PATH);
  dbInstance.serialize(() => {
    dbInstance.run(`CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year TEXT NOT NULL,
      name TEXT NOT NULL,
      selections TEXT NOT NULL,
      totalCost INTEGER NOT NULL,
      submittedAt TEXT NOT NULL
    )`);
  });
  return dbInstance;
}

const db = createTeamsDb();

// Gracefully close the database connection on process exit
function closeDbOnExit() {
  if (db) {
    db.close(err => {
      if (err) {
        log('Error closing database:', err);
      } else {
        log('Database connection closed.');
      }
    });
  }
}

process.on('SIGINT', () => {
  closeDbOnExit();
  process.exit(0);
});
process.on('SIGTERM', () => {
  closeDbOnExit();
  process.exit(0);
});
process.on('exit', () => {
  closeDbOnExit();
});


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

function loadTeams(year, dbOverride) {
  const useDb = dbOverride || db;
  return new Promise((resolve, reject) => {
    useDb.all('SELECT * FROM teams WHERE year = ?', [year], (err, rows) => {
      if (err) return reject(err);
      // Parse selections JSON for each team
      const teams = rows.map(row => ({
        name: row.name,
        selections: JSON.parse(row.selections),
        totalCost: row.totalCost,
        submittedAt: row.submittedAt
      }));
      resolve(teams);
    });
  });
}


function saveTeams(year, teams, dbOverride) {
  // Overwrite all teams for the year
  const useDb = dbOverride || db;
  return new Promise((resolve, reject) => {
    useDb.serialize(() => {
      useDb.run('DELETE FROM teams WHERE year = ?', [year], function (err) {
        if (err) return reject(err);
        const stmt = useDb.prepare('INSERT INTO teams (year, name, selections, totalCost, submittedAt) VALUES (?, ?, ?, ?, ?)');
        const insertPromises = teams.map(team => {
          return new Promise((res, rej) => {
            stmt.run(
              year,
              team.name,
              JSON.stringify(team.selections),
              team.totalCost,
              team.submittedAt,
              function (err) {
                if (err) return rej(err);
                res();
              }
            );
          });
        });
        Promise.all(insertPromises)
          .then(() => {
            stmt.finalize(err => {
              if (err) return reject(err);
              resolve();
            });
          })
          .catch(reject);
      });
    });
  });
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
  createTeamsDb, // export for test injection
};
