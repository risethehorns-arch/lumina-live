// LUMINA — areas.js
// Loads the three-listing preview on area-specific pages.
//
// The card comes from js/property-card.js, the same builder the landing
// page and the full portfolio use, so a preview here opens the same
// gallery it would anywhere else.

(function () {
  'use strict';

  const areaEl = document.querySelector('[data-area]');
  if (!areaEl) return;

  const area = String(areaEl.dataset.area || '').toLowerCase();
  const grid = document.getElementById('listing-preview');
  if (!grid) return;

  const PREVIEW = 3;

  /* Relative, not root-absolute: a GitHub Pages project deploy serves
     this from /lumina/, where a leading slash 404s. */
  fetch('data/lumina-demo-leads.json?v=2026-08-22')
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(items => {
      if (!Array.isArray(items) || !items.length) throw new Error('empty');
      const build = window.Lumina && window.Lumina.buildPropertyCard;
      if (typeof build !== 'function') throw new Error('property-card.js did not load');

      const inArea = items.filter(item =>
        String(item.location_area || '').toLowerCase().includes(area));
      const shown = (inArea.length ? inArea : items).slice(0, PREVIEW);

      grid.replaceChildren(...shown.map((l, i) => build(l, i, { wide: false })));
      window.Lumina.activateCards(grid);
    })
    .catch(err => {
      console.error('Lumina area preview failed:', err);
      grid.textContent = 'Listing previews are temporarily unavailable.';
    });
})();
