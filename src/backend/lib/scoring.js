// scoring.js - shared scoring logic for teams/results endpoints
const fs = require('fs');
const path = require('path');
const { getScraperResultsDir } = require('./dataAccess');
const { matchContestant, log } = require('./utils');

const NUM_ROUNDS = 10;
const AVG_ROUND_LABELS = ['Avg', 'AVG', 'avg'];
const EVENT_CSV_MAP = {
  'Bareback Riding': 'BB_results.csv',
  'Steer Wrestling': 'SW_results.csv',
  'Saddle Bronc Riding': 'SB_results.csv',
  'Bull Riding': 'BR_results.csv',
  'Team Roping Header': 'TR_results.csv',
  'Team Roping Heeler': 'TR_results.csv',
  'Tie-Down Roping': 'TD_results.csv',
  'Barrel Racing': 'GB_results.csv',
};

// Enhanced parseCsv to support splitting Team Roping contestants into Header/Heeler
function parseCsv(csv, eventName = '', eventContestants = null) {
  log('parseCsv: parsing CSV');
  const lines = csv.trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  const roundIdx = headers.indexOf('Round');
  const nameIdx = headers.indexOf('Contestant');
  const scoreIdx = headers.indexOf('Time/Score');
  const placeIdx = headers.indexOf('Place');
  const eventData = {};
  const isHeading = !!(eventName.includes('Header') && eventContestants);
  const isHeeling = !!(eventName.includes('Heeler') && eventContestants);
  let headerList = [], heelerList = [];
  if (isHeeling && eventContestants) {
    heelerList = (eventContestants['Team Roping Heeler'] || []).map(n => n.toLowerCase());
  }
  if (isHeading && eventContestants) {
    headerList = (eventContestants['Team Roping Header'] || []).map(n => n.toLowerCase());
  }
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    let roundRaw = row[roundIdx];
    let round = parseInt(roundRaw);
    if (isNaN(round)) {
      if (AVG_ROUND_LABELS.includes(roundRaw.trim())) {
        round = 'AVG';
      } else {
        continue;
      }
    }
    let name = row[nameIdx].replace(/"/g, '').trim();
    const score = row[scoreIdx];
    const place = parseInt(row[placeIdx]);
    if (!eventData[round]) eventData[round] = [];
    if ((isHeading || isHeeling) && name.includes('/')) {
      // Split and assign to header/heeler
      const [name1, name2] = name.split('/').map(s => s.trim());
      // Check which is header/heeler by matching to eventContestants
      let header = null, heeler = null;
      if (isHeading) {
        if (headerList.includes(name1.toLowerCase())) header = name1;
        if (headerList.includes(name2.toLowerCase())) header = name2;
        
        if (header) {
          eventData[round].push({ Contestant: header, 'Time/Score': score, Place: place });
        }
      } else if (isHeeling) {
        if (heelerList.includes(name1.toLowerCase())) heeler = name1;
        if (heelerList.includes(name2.toLowerCase())) heeler = name2;

        if (heeler) {
          eventData[round].push({ Contestant: heeler, 'Time/Score': score, Place: place });
        }
      }
      if (!header && !heeler) {
        eventData[round].push({ Contestant: name, 'Time/Score': score, Place: place });
      }
    } else {
      eventData[round].push({ Contestant: name, 'Time/Score': score, Place: place });
    }
  }
  log('parseCsv: eventData keys', Object.keys(eventData));
  return eventData;
}

// Pass eventContestants to parseCsv for Team Roping split logic
function loadAllEventResults(year, eventContestants = null) {
  const SCRAPER_RESULTS_DIR = getScraperResultsDir(year);
  log('loadAllEventResults: SCRAPER_RESULTS_DIR', SCRAPER_RESULTS_DIR);
  const results = {};
  for (const [event, csvFile] of Object.entries(EVENT_CSV_MAP)) {
    const filePath = path.join(SCRAPER_RESULTS_DIR, csvFile);
    log('Checking for event CSV:', event, filePath);
    if (fs.existsSync(filePath)) {
      log('Found CSV for', event);
      const csv = fs.readFileSync(filePath, 'utf-8');
      results[event] = parseCsv(csv, event, eventContestants);
    } else {
      log('Missing CSV for', event, filePath);
    }
  }
  log('loadAllEventResults: loaded events', Object.keys(results));
  return results;
}

function scoreTeams(teams, events, eventContestants, eventResults) {
  log('scoreTeams: teams', teams.map(t => t.name));
  log('scoreTeams: events', events);
  log('scoreTeams: eventResults keys', Object.keys(eventResults));
  return teams.map(team => {
    let totalPerRound = Array(NUM_ROUNDS + 1).fill(0); // 0-9: rounds 1-10, 10: AVG
    let total = 0;
    const eventResultsArr = team.selections.map((contestantId, eventIdx) => {
      const event = events[eventIdx];
      const people = eventContestants[event];
      let contestantName = (Array.isArray(people) && people[contestantId - 1]) ? people[contestantId - 1] : null;
      log('Scoring:', { team: team.name, event, contestantId, contestantName });
      const rounds = [];
      for (let r = 1; r <= NUM_ROUNDS; r++) {
        let pts = 0;
        if (contestantName && eventResults[event] && eventResults[event][r]) {
          let place = matchContestant(contestantName, eventResults[event][r], event);
          log('Round', r, 'event', event, 'contestant', contestantName, 'place', place);
          if (place !== undefined && place >= 1 && place <= 15) {
            pts = 16 - place;
          }
        }
        rounds.push(pts);
        totalPerRound[r-1] += pts;
        total += pts;
      }
      let avgPts = 0;
      if (contestantName && eventResults[event] && eventResults[event]['AVG']) {
        let place = matchContestant(contestantName, eventResults[event]['AVG'], event);
        log('AVG event', event, 'contestant', contestantName, 'place', place);
        if (place !== undefined && place >= 1 && place <= 15) {
          avgPts = 16 - place;
        }
      }
      rounds.push(avgPts); // index 10
      totalPerRound[10] += avgPts;
      total += avgPts;
      return {
        event,
        contestant: contestantName || `#${contestantId}`,
        rounds
      };
    });
    return {
      team: team.name,
      events: eventResultsArr,
      totalPerRound,
      total
    };
  });
}

module.exports = {
  parseCsv,
  loadAllEventResults,
  scoreTeams,
  EVENT_CSV_MAP,
  NUM_ROUNDS,
};
