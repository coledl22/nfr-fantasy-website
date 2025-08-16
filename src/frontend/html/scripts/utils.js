// utils.js - shared helpers for frontend scripts


/**
 * Populate a <select> element with year options from /api/available-years
 * @param {HTMLSelectElement} yearSelect
 * @returns {Promise<void>}
 */
export async function populateYearDropdown(yearSelect) {
  if (!yearSelect) return;
  try {
    const years = await fetchJson('/api/available-years');
    yearSelect.innerHTML = '';
    years.sort((a, b) => b - a); // Descending order
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      yearSelect.appendChild(opt);
    });
    // Select the first year by default
    if (years.length > 0) yearSelect.value = years[0];
  } catch {
    yearSelect.innerHTML = '<option value="">No years available</option>';
  }
}

/**
 * Fetch JSON from a URL, with error handling.
 * @param {string} url
 * @returns {Promise<any>}
 */
export async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Network error');
  return res.json();
}

/**
 * Set text content of an element by selector.
 * @param {string} selector
 * @param {string} text
 */
export function setText(selector, text) {
  const el = document.querySelector(selector);
  if (el) el.textContent = text;
}

/**
 * Create an element with optional class and children.
 * @param {string} tag
 * @param {string[]} [classes]
 * @param {Array<Node|string>} [children]
 * @returns {HTMLElement}
 */
export function createEl(tag, classes = [], children = []) {
  const el = document.createElement(tag);
  classes.forEach(cls => el.classList.add(cls));
  children.forEach(child => {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else el.appendChild(child);
  });
  return el;
}

/**
 * Center a block element horizontally.
 * @param {HTMLElement} el
 */
export function centerBlock(el) {
  el.style.margin = '0 auto';
  el.style.display = 'table';
}
