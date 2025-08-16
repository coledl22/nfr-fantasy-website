# Frontend Scripts Structure

## Entry Points
- `app.js`: Minimal entry for team.html (loads `teamform.js`)
- `results.js`: For results.html (team results/tabs)
- `nfrresults.js`: For nfrresults.html (official NFR results)

## Shared Utilities
- `utils.js`: Fetch, DOM, and formatting helpers. Use for all new code.

## Team Form Logic
- `teamform.js`: Handles team creation, validation, and random team selection. Used by `app.js`.

## Maintenance Tips
- Use ES modules for all new scripts.
- Keep all DOM selectors as constants at the top of each file.
- Use helpers from `utils.js` for fetch, DOM, and centering.
- Keep each script focused on a single page or feature.

## How to Add a New Page
1. Create a new script file as a module.
2. Use `import` to bring in helpers from `utils.js`.
3. Add your script to the HTML with `type="module"`.
