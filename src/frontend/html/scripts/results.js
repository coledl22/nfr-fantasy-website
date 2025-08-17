// ...existing code...
// results.js - refactored for maintainability, using utils.js
import { fetchJson, setText, centerBlock, populateYearDropdown } from './utils.js';

/**
 * Main entry point for results page.
 */
// Inject consistent table styles for all results tables
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
  .results-table th:nth-child(1), .results-table td:nth-child(1) { width: 150px; }
  .results-table th:nth-child(2), .results-table td:nth-child(2) { width: 150px; }
  .results-table th:nth-child(n+3), .results-table td:nth-child(n+3) { width: 35px; }
  `;
  document.head.appendChild(style);
}


(function resultsMain() {
  injectResultsTableStyles();
  const RESULTS_SEL = '#results';
  const TABS_SEL = '#results-tabs';
  const YEAR_SEL = '#year-select';


  function getSelectedYear() {
    const sel = document.querySelector(YEAR_SEL);
    return sel && sel.value ? sel.value : '2024';
  }


  function loadResults() {
    const year = getSelectedYear();
    fetchJson(`/api/results?year=${year}`)
      .then(data => renderResults(data))
      .catch(() => setText(RESULTS_SEL, 'Could not load results.'));
  }


  // Listen for year changes and populate dropdown
  (async () => {
    const yearSelect = document.querySelector(YEAR_SEL);
    await populateYearDropdown(yearSelect);
    if (yearSelect) {
      yearSelect.addEventListener('change', loadResults);
    }
    loadResults();
  })();

  /**
   * Render all results and tabs.
   * @param {Array} data
   */
  function renderResults(data) {
    const container = document.querySelector(RESULTS_SEL);
    const tabsContainer = document.querySelector(TABS_SEL);
    if (!Array.isArray(data) || data.length === 0) {
      setText(RESULTS_SEL, 'No results available.');
      return;
    }

    // Compute nonzeroRounds for all tabs
    const nonzeroRounds = [];
    // Only consider rounds 0-9 as numbered rounds; 10 is AVG
    for (let r = 0; r < 10; r++) {
      if (data.some(team => team.totalPerRound[r] && team.totalPerRound[r] !== 0)) {
        nonzeroRounds.push(r);
      }
    }
    const hasAVG = data.some(team => team.totalPerRound && typeof team.totalPerRound[10] === 'number');
    const tabLabels = [
      ...nonzeroRounds.map(i => `Round ${i + 1}`),
      ...(hasAVG ? ['AVG'] : []),
      'Overall',
    ];
    tabsContainer.innerHTML = tabLabels
      .map((label, idx) => `<button class="results-tab" data-tab="${idx}" style="margin-right:8px;">${label}</button>`)
      .join('');

    // Tab click handlers
    Array.from(tabsContainer.querySelectorAll('.results-tab')).forEach(btn => {
      btn.onclick = function () {
        Array.from(tabsContainer.querySelectorAll('.results-tab')).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderTab(Number(btn.dataset.tab));
      };
    });
    // Default to overall tab
    const overallTabIdx = tabLabels.length - 1;
    tabsContainer.querySelector(`.results-tab[data-tab="${overallTabIdx}"]`).classList.add('active');
    renderTab(overallTabIdx);

    /**
     * Render a specific tab (round, AVG, or overall)
     * @param {number} tabIdx
     */
    function renderTab(tabIdx) {
      let html = '';
      if (tabIdx < nonzeroRounds.length) {
        // Per-round tab (only for nonzero rounds)
        const r = nonzeroRounds[tabIdx];
        // Round winners
        let max = -Infinity;
        let winners = [];
        data.forEach(team => {
          const pts = team.totalPerRound[r];
          if (pts > max) {
            max = pts;
            winners = [team.team];
          } else if (pts === max) {
            winners.push(team.team);
          }
        });
        html += `<h2>Round ${r + 1} Winner(s): ${winners.join(', ')} (${max} pts)</h2>`;
        // Rankings for this round
        const ranked = [...data].sort((a, b) => b.totalPerRound[r] - a.totalPerRound[r]);
        html += `<h3 style="text-align:center;">Team Rankings (Round ${r + 1})</h3>`;
  html += '<div class="results-table-wrapper" style="margin:0 auto;display:table">';
  html += '<table class="results-table"><thead><tr><th>Rank</th><th>Team</th><th>Points</th></tr></thead><tbody>';
        ranked.forEach((team, idx) => {
          html += `<tr><td>${idx + 1}</td><td>${team.team}</td><td>${team.totalPerRound[r]}</td></tr>`;
        });
        html += '</tbody></table></div>';
        // Per-team event breakdown for this round
        data.forEach(team => {
          html += `<h3 style="text-align:center;">Team: ${team.team}</h3>`;
          html += '<div class="results-table-wrapper" style="margin:0 auto;display:table">';
          html += '<table class="results-table"><thead><tr><th>Event</th><th>Contestant</th><th>Points</th></tr></thead><tbody>';
          team.events.forEach(ev => {
            const pts = ev.rounds[r] || 0;
            let eventLabel = ev.event;
            if (eventLabel === 'Team Roping Header') eventLabel = 'TR Header';
            if (eventLabel === 'Team Roping Heeler') eventLabel = 'TR Heeler';
            html += `<tr><td>${eventLabel}</td><td>${ev.contestant}</td><td>${pts}</td></tr>`;
          });
          html += `<tr style="font-weight:bold;background:#f0f0f0;"><td colspan="2">Team Total</td><td>${team.totalPerRound[r]}</td></tr>`;
          html += '</tbody></table></div>';
        });
  } else if (hasAVG && tabIdx === nonzeroRounds.length) {
        // AVG tab
        let avgIdx = 10;
        html += `<h2>AVG Round</h2>`;
        // Rankings for AVG round
        const ranked = [...data].sort((a, b) => (b.totalPerRound[avgIdx] || 0) - (a.totalPerRound[avgIdx] || 0));
        html += `<h3 style="text-align:center;">Team Rankings (AVG)</h3>`;
  html += '<div class="results-table-wrapper" style="margin:0 auto;display:table">';
  html += '<table class="results-table"><thead><tr><th>Rank</th><th>Team</th><th>Points</th></tr></thead><tbody>';
        ranked.forEach((team, idx) => {
          html += `<tr><td>${idx + 1}</td><td>${team.team}</td><td>${team.totalPerRound[avgIdx] || 0}</td></tr>`;
        });
        html += '</tbody></table></div>';
        // Per-team event breakdown for AVG
        data.forEach(team => {
          html += `<h3 style="text-align:center;">Team: ${team.team}</h3>`;
          html += '<div class="results-table-wrapper" style="margin:0 auto;display:table">';
          html += '<table class="results-table"><thead><tr><th>Event</th><th>Contestant</th><th>Points</th></tr></thead><tbody>';
          team.events.forEach(ev => {
            const pts = ev.rounds[avgIdx] || 0;
            let eventLabel = ev.event;
            if (eventLabel === 'Team Roping Header') eventLabel = 'TR Header';
            if (eventLabel === 'Team Roping Heeler') eventLabel = 'TR Heeler';
            html += `<tr><td>${eventLabel}</td><td>${ev.contestant}</td><td>${pts}</td></tr>`;
          });
          html += `<tr style="font-weight:bold;background:#f0f0f0;"><td colspan="2">Team Total</td><td>${team.totalPerRound[avgIdx] || 0}</td></tr>`;
          html += '</tbody></table></div>';
        });
      } else {
        // Overall tab
        // Round winners table
        let roundWinnersHtml = '<h2>Round Winners</h2>';
  roundWinnersHtml += '<div class="results-table-wrapper"><table class="results-table"><thead><tr><th>Round</th><th>Winner(s)</th><th>Points</th></tr></thead><tbody>';
        nonzeroRounds.forEach(r => {
          let max = -Infinity;
          let winners = [];
          data.forEach(team => {
            const pts = team.totalPerRound[r];
            if (pts > max) {
              max = pts;
              winners = [team.team];
            } else if (pts === max) {
              winners.push(team.team);
            }
          });
          roundWinnersHtml += `<tr><td>${r + 1}</td><td>${winners.join(', ')}</td><td>${max}</td></tr>`;
        });
        // AVG round winner
        if (hasAVG) {
          let max = -Infinity;
          let winners = [];
          data.forEach(team => {
            const pts = team.totalPerRound[10];
            if (pts > max) {
              max = pts;
              winners = [team.team];
            } else if (pts === max) {
              winners.push(team.team);
            }
          });
          roundWinnersHtml += `<tr><td>AVG</td><td>${winners.join(', ')}</td><td>${max}</td></tr>`;
        }
  roundWinnersHtml += '</tbody></table></div>';

        // Rankings table (overall = sum of all rounds including AVG)
        const ranked = [...data].sort((a, b) => {
          const aTotal = a.totalPerRound.slice(0, hasAVG ? 11 : 10).reduce((sum, v) => sum + (v || 0), 0);
          const bTotal = b.totalPerRound.slice(0, hasAVG ? 11 : 10).reduce((sum, v) => sum + (v || 0), 0);
          return bTotal - aTotal;
        });
        let html2 = '<h2>Team Rankings</h2>';
  html2 += '<div class="results-table-wrapper"><table class="results-table"><thead><tr><th>Rank</th><th>Team</th><th>Total Points</th></tr></thead><tbody>';
        ranked.forEach((team, idx) => {
          const total = team.totalPerRound.slice(0, hasAVG ? 11 : 10).reduce((sum, v) => sum + (v || 0), 0);
          html2 += `<tr><td>${idx + 1}</td><td>${team.team}</td><td>${total}</td></tr>`;
        });
  html2 += '</tbody></table></div>';

        // Per-team breakdowns
        data.forEach(team => {
          html2 += `<h2>Team: ${team.team}</h2>`;
          html2 += '<div class="results-table-wrapper"><table class="results-table"><thead><tr><th>Event</th><th>Contestant</th>';
          nonzeroRounds.forEach(r => html2 += `<th>R${r+1}</th>`);
          if (hasAVG) html2 += '<th>AVG</th>';
          html2 += '<th>Total</th></tr></thead><tbody>';
          team.events.forEach(ev => {
            let total = 0;
            let eventLabel = ev.event;
            if (eventLabel === 'Team Roping Header') eventLabel = 'TR Header';
            if (eventLabel === 'Team Roping Heeler') eventLabel = 'TR Heeler';
            html2 += `<tr><td>${eventLabel}</td><td>${ev.contestant}</td>`;
            nonzeroRounds.forEach(r => {
              const pts = ev.rounds[r] || 0;
              total += pts;
              html2 += `<td>${pts}</td>`;
            });
            if (hasAVG) {
              total += ev.rounds[10] || 0;
              html2 += `<td>${ev.rounds[10] || 0}</td>`;
            }
            html2 += `<td>${total}</td></tr>`;
          });
          html2 += '<tr style="font-weight:bold;background:#f0f0f0;"><td colspan="2">Team Total</td>';
          let grand = 0;
          nonzeroRounds.forEach(r => {
            const pts = team.totalPerRound[r];
            grand += pts;
            html2 += `<td>${pts}</td>`;
          });
          if (hasAVG) {
            grand += team.totalPerRound[10] || 0;
            html2 += `<td>${team.totalPerRound[10] || 0}</td>`;
          }
          html2 += `<td>${grand}</td></tr>`;
          html2 += '</tbody></table></div>';
        });
        // Extract the Team Rankings table from html2
        const teamRankingsTableMatch = html2.match(/<table>[\s\S]*?<\/table>/);
        let teamRankingsTable = '';
        let restOfHtml2 = html2;
        if (teamRankingsTableMatch) {
          teamRankingsTable = teamRankingsTableMatch[0];
          restOfHtml2 = html2.replace(teamRankingsTable, '');
        }
        html = `<h2 style="text-align:center;">Round Winners</h2>`;
        html += '<div style="margin:0 auto;display:table">' + roundWinnersHtml.replace('<h2>Round Winners</h2>', '') + '</div>';
        html += '<div style="margin:0 auto;display:table">' + teamRankingsTable + '</div>';
        html += restOfHtml2;
      }
      container.innerHTML = html;
    }
  }

  // Center content
  const resultsDiv = document.querySelector(RESULTS_SEL);
  if (resultsDiv) resultsDiv.style.textAlign = 'center';
  const resultsTabs = document.querySelector(TABS_SEL);
  if (resultsTabs) resultsTabs.style.textAlign = 'center';
})();
