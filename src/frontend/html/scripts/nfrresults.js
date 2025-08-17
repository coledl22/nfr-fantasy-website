import { fetchJson, setText, centerBlock, populateYearDropdown } from './utils.js';


function getSelectedYear() {
  return document.getElementById('year-select')?.value || '2024';
}


// Inject consistent table styles for all results tables (matches results.js)
function injectResultsTableStyles() {
  if (document.getElementById('results-table-style')) return;
  const style = document.createElement('style');
  style.id = 'results-table-style';
  style.textContent = `
    .results-table {
      table-layout: fixed;
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 2em;
      margin-left: auto;
      margin-right: auto;
    }
    .results-table th, .results-table td {
      border: 1px solid #ccc;
      text-align: center;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  /* Set explicit widths for each column type */
  .results-table th:nth-child(1), .results-table td:nth-child(1) { width: 35px; }
  .results-table th:nth-child(2), .results-table td:nth-child(2) { width: 100px; }
  .results-table th:nth-child(n+3), .results-table td:nth-child(n+3) { width: 35px; }
  `;
  document.head.appendChild(style);
}


async function nfrResultsMain() {
  const EVENTS = [
    { code: 'BB', name: 'Bareback Riding' },
    { code: 'SW', name: 'Steer Wrestling' },
    { code: 'SB', name: 'Saddle Bronc Riding' },
    { code: 'BR', name: 'Bull Riding' },
    { code: 'TR-Header', name: 'Team Roping Header' },
    { code: 'TR-Heeler', name: 'Team Roping Heeler' },
    { code: 'TD', name: 'Tie-Down Roping' },
    { code: 'GB', name: 'Barrel Racing' },
  ];
  const NUM_ROUNDS = 10;
  const TABS_SEL = '#round-tabs';
  const CONTENT_SEL = '#results-content';
  let eventResults = null;

  injectResultsTableStyles();
  await populateYearDropdown(document.getElementById('year-select'));

  function loadEventResults() {
    const year = getSelectedYear();
    if (!year) {
      setText(CONTENT_SEL, 'No year selected.');
      return;
    }
    fetchJson(`/api/event-results?year=${year}`)
      .then(data => {
        eventResults = data;
        createTabs();
        setActiveTab(0);
        showRound(1);
        centerAll();
      })
      .catch(() => setText(CONTENT_SEL, 'Could not load official results.'));
  }

  function setActiveTab(idx) {
    const roundTabs = document.querySelector(TABS_SEL);
    Array.from(roundTabs.children).forEach((tab, i) => {
      tab.classList.toggle('active', i === idx);
    });
  }

  function createTabs() {
    const roundTabs = document.querySelector(TABS_SEL);
    roundTabs.innerHTML = '';
    if (!eventResults) return;
    // Determine which rounds have at least one event with results
    const roundsWithResults = [];
    for (let i = 1; i <= NUM_ROUNDS; i++) {
      let hasResults = false;
      for (const eventName in eventResults) {
        if (Array.isArray(eventResults[eventName][i]) && eventResults[eventName][i].length > 0) {
          hasResults = true;
          break;
        }
      }
      if (hasResults) roundsWithResults.push(i);
    }
    // Create a tab for each round with results
    roundsWithResults.forEach((roundNum, idx) => {
      const tab = document.createElement('button');
      tab.textContent = `Round ${roundNum}`;
      tab.className = 'tab-btn';
      tab.onclick = () => {
        setActiveTab(idx);
        showRound(roundNum);
      };
      roundTabs.appendChild(tab);
    });
    // Add AVG tab if present in any event
    let hasAVG = false;
    for (const eventName in eventResults) {
      if (eventResults[eventName]['AVG'] && eventResults[eventName]['AVG'].length > 0) {
        hasAVG = true;
        break;
      }
    }
    if (hasAVG) {
      const avgTab = document.createElement('button');
      avgTab.textContent = 'AVG';
      avgTab.className = 'tab-btn';
      avgTab.onclick = () => {
        setActiveTab(roundTabs.children.length);
        showRound('AVG');
      };
      roundTabs.appendChild(avgTab);
    }
  }

  function showRound(roundNum) {
    const resultsContent = document.querySelector(CONTENT_SEL);
    resultsContent.innerHTML = '';
    for (const event of EVENTS) {
      const eventData = eventResults && eventResults[event.name];
      if (!eventData) continue;
      const rows = eventData[roundNum] || [];
      if (rows.length === 0) continue;
      const section = document.createElement('section');
      section.innerHTML = `<h2>${event.name}</h2>`;
      const table = document.createElement('table');
      table.className = 'results-table';
      table.innerHTML = `<thead><tr><th>Place</th><th>Contestant</th><th>Time/Score</th></tr></thead><tbody>`;
      rows.forEach(r => {
        table.innerHTML += `<tr><td>${r.Place}</td><td>${r.Contestant}</td><td>${r['Time/Score']}</td></tr>`;
      });
      table.innerHTML += '</tbody>';
      section.appendChild(table);
      resultsContent.appendChild(section);
    }
    centerAll();
  }

  function centerAll() {
    const resultsContent = document.querySelector(CONTENT_SEL);
    if (resultsContent) resultsContent.style.textAlign = 'center';
    const roundTabs = document.querySelector(TABS_SEL);
    if (roundTabs) roundTabs.style.textAlign = 'center';
  }

  document.getElementById('year-select')?.addEventListener('change', loadEventResults);
  loadEventResults();
}

nfrResultsMain();
