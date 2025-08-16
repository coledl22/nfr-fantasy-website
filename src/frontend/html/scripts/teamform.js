import { fetchJson, setText, populateYearDropdown } from './utils.js';

function getSelectedYear() {
  return document.getElementById('year-select')?.value || '2024';
}

function loadTeamForm() {
  const STANDINGS_SEL = '#standings';
  const BUDGET = 550000;
  const year = getSelectedYear();

  fetchJson(`/api/events?year=${year}`)
    .then(events => Promise.all(events.map(event => fetchJson(`/api/contestants/${encodeURIComponent(event)}?year=${year}`)))
      .then(allContestants => ({ events, allContestants })))
    .then(({ events, allContestants }) => {
      const standingsDiv = document.querySelector(STANDINGS_SEL);
      if (!standingsDiv) return;

      // Render form
      let formHtml = `<div style="margin-bottom:1em;padding:1em;border:1px solid #ccc;background:#f9f9f9;">
        <strong>How to Play:</strong><br>
        Select one person for each of the 8 events (including both Team Roping Header and Team Roping Heeler). Each person has a cost based on their rank (1st: $150,000, 15th: $10,000).<br>
        You have a total budget of $550,000 for your team.<br>
        If your selections exceed the budget, you will see an error.
      </div>`;
      formHtml += '<div id="budgetDisplay" style="margin-bottom:1em;font-weight:bold;">Budget Remaining: $550,000</div>';
      formHtml += '<form id="fantasyForm">';
      formHtml += '<label for="userName">Your Name:</label> <input id="userName" name="userName" required /><br><br>';
      events.forEach((event, idx) => {
        let label = event;
        formHtml += `<label for="event${idx}">${label}:</label> `;
        formHtml += `<select id="event${idx}" name="event${idx}">`;
        formHtml += '<option value="">Select a person</option>';
        allContestants[idx].forEach(person => {
          formHtml += `<option value="${person.id}">${person.name} (Rank: ${person.rank}, $${person.cost})</option>`;
        });
        formHtml += '</select><br><br>';
      });
      formHtml += '<button type="submit">Submit Team</button>';
      formHtml += '</form>';
      standingsDiv.innerHTML = formHtml + '<div id="formMessage"></div>';

      // Handle form submission via AJAX
      const form = document.getElementById('fantasyForm');
      form.onsubmit = async function(e) {
        e.preventDefault();
        const name = document.getElementById('userName').value;
        const selections = [];
        for (let i = 0; i < events.length; i++) {
          selections.push(document.getElementById(`event${i}`).value);
        }
        const year = getSelectedYear();
        try {
          const resp = await fetch('/api/validate?year=' + encodeURIComponent(year), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, selections })
          });
          const result = await resp.json();
          if (resp.ok && result.success) {
            setText('#formMessage', `Team submitted! Total cost: $${result.totalCost.toLocaleString()}`);
          } else {
            setText('#formMessage', result.error || 'Submission failed.');
          }
        } catch (err) {
          setText('#formMessage', 'Submission failed.');
        }
      };

      // Add Select Random button
      const randomBtn = document.createElement('button');
      randomBtn.type = 'button';
      randomBtn.textContent = 'Select Random Team ($550,000)';
      randomBtn.style.marginBottom = '1em';
      standingsDiv.insertBefore(randomBtn, standingsDiv.firstChild.nextSibling);

      randomBtn.onclick = function () {
        const maxTries = 10000;
        let found = false;
        let attempt = 0;
        let lastTeam = null;
        while (attempt < maxTries && !found) {
          attempt++;
          const selections = [];
          const usedIds = new Set();
          let total = 0;
          let valid = true;
          for (let i = 0; i < events.length; i++) {
            const available = allContestants[i].filter(p => !usedIds.has(p.id));
            if (available.length === 0) {
              valid = false;
              break;
            }
            const pick = available[Math.floor(Math.random() * available.length)];
            selections.push(pick.id);
            usedIds.add(pick.id);
            total += pick.cost;
          }
          if (valid && total === BUDGET) {
            found = true;
            for (let i = 0; i < events.length; i++) {
              document.getElementById(`event${i}`).value = selections[i];
            }
            updateBudget();
            setText('#formMessage', 'Random team selected!');
          }
          lastTeam = { selections, total };
        }
        if (!found) {
          setText('#formMessage', 'Could not find a random team with exactly $550,000 after many tries.');
        }
      };

      // Budget update logic
      function updateBudget() {
        let total = 0;
        for (let i = 0; i < events.length; i++) {
          const sel = document.getElementById(`event${i}`);
          const val = sel.value;
          if (val) {
            const person = allContestants[i].find(p => p.id == val);
            if (person) total += person.cost;
          }
        }
        const remaining = BUDGET - total;
        const display = document.getElementById('budgetDisplay');
        if (display) {
          display.textContent = `Budget Remaining: $${remaining.toLocaleString()}`;
        }
      }

      // Attach change listeners to all selects
      for (let i = 0; i < events.length; i++) {
        const sel = document.getElementById(`event${i}`);
        if (sel) sel.addEventListener('change', updateBudget);
      }

      // Optionally, update budget on initial render
      updateBudget();
    });
}


(async () => {
  const yearSelect = document.getElementById('year-select');
  await populateYearDropdown(yearSelect);
  if (yearSelect) {
    yearSelect.addEventListener('change', loadTeamForm);
  }
  loadTeamForm();
})();
