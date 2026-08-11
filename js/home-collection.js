// LUMINA — home collection
// Picks the featured slice of the Excel-imported inventory and renders
// it into the landing page grid.
//
// The card itself is built by js/property-card.js, which listings.js
// also uses — the featured eight and the full portfolio are the same
// component, so they can only ever look and behave the same.

(function () {
  'use strict';

  const grid = document.getElementById('home-collection-grid');
  if (!grid) return;

  const DATA_URL = 'data/lumina-demo-leads.json?v=2026-08-06';

  /* Eight, not six, and the count is load-bearing. The first card spans
     two columns, so six cards over the home grid's three columns left
     the sixth alone on a row with two empty cells. Eight fills
     2+1 / 3 / 3 exactly. index.html pins the column count for the same
     reason — see the #home-collection-grid rule there. */
  const FEATURED = 8;

  const str = v => (v === null || v === undefined) ? '' : String(v);
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

  const HERO    = /villa|rooftop|penthouse/i;
  const OUTSIDE = /garden|terrace|pool/i;
  /* "on the level −1" is a basement flat. Fine on the full list, wrong
     as the first thing a buyer sees. The dash in the data is U+2212. */
  const BELOW   = /level\s*[-−–]/i;

  const priceOf = l => {
    const raw = l.price_jod_test_margin != null ? l.price_jod_test_margin : l.price_jod_raw;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  };

  /* What is allowed in the shop window at all. Everything rejected here
     is still on listings.html — this is a curation rule, not a data
     judgement. The point is that the eight cards on the landing page
     never include one that raises a question instead of interest. */
  const shortlisted = l => {
    if (num(l.photo_count) < 6 || !l.image_url) return false;   // enough to fill the viewer
    if (l.needs_price_review || l.price_unit === 'per_sqm') return false;  // renders "Price on request"
    /* quality_score is the import's record-completeness grade, not a
       judgement on the photography — 86 of 118 records score 5. It only
       filters out the sparse rows that would render half a card. */
    if (num(l.quality_score) < 4) return false;
    /* "Sale or Rent" records carry a rent figure — 30,000 JOD against a
       200 m² 4th Circle flat is an annual rent, not a purchase price.
       The card prints "30,000 JOD · Sale or Rent", which reads as the
       latter. Fine on the full list next to its neighbours; not on the
       eight cards a buyer sees first. */
    if (/or rent/i.test(str(l.transaction))) return false;
    if (BELOW.test(str(l.title))) return false;
    const size = num(l.size_sqm);
    if (size < 130) return false;
    const price = priceOf(l);
    if (!price) return false;
    if (!/sale/i.test(str(l.transaction))) {
      /* Rents here are annual and run 55–320 JOD/m². Anything outside
         that is a monthly figure sitting among annual ones, or a typo;
         either way it undersells or oversells by a wide margin. */
      const perSqm = price / size;
      if (price < 7000 || perSqm < 55 || perSqm > 320) return false;
    }
    return true;
  };

  /* Coarse character of the property, used to keep the eight from being
     eight of the same thing. Deliberately reads the title rather than
     the `outdoor` field — almost every flat lists a balcony there, so
     that bucket would swallow the whole grid. */
  const shapeOf = l => {
    const t = str(l.property_type) + ' ' + str(l.title);
    if (/villa/i.test(t)) return 'villa';
    if (/rooftop|penthouse/i.test(t)) return 'roof';
    if (OUTSIDE.test(str(l.title))) return 'outdoor';
    return num(l.size_sqm) >= 240 ? 'large' : 'flat';
  };

  /* Desirability, in the order a buyer reads a card: how big, what kind
     of thing it is, whether it has outside space, how much of it was
     photographed. Nothing here can judge the photograph itself — that is
     why the eight covers are curated in the data instead. */
  const score = l => {
    const t = str(l.title) + ' ' + str(l.property_type) + ' ' + str(l.outdoor);
    let v = Math.min(num(l.size_sqm), 700) / 45;      // capped, or one 1,200 m² record wins outright
    if (HERO.test(str(l.property_type))) v += 9;
    if (OUTSIDE.test(t)) v += 5;
    v += 4 * num(l.quality_score);
    v += 0.4 * Math.min(num(l.photo_count), 12);
    v += 1.5 * Math.min(num(l.bedrooms), 5);
    /* "Villa, 700 m²" — a row that never got its bedroom count. Reads
       as an unfinished record next to eight written ones. */
    if (/^(villa|apartment)\b/i.test(str(l.title))) v -= 4;
    /* A pure sale quotes a real purchase price, so it is the one card a
       buyer rather than a tenant can act on. "Sale or Rent" is filtered
       out above and deliberately gets nothing here. */
    if (str(l.transaction).trim().toLowerCase() === 'sale') v += 5;
    return v;
  };

  /* Greedy pick with diminishing returns. Straight top-eight-by-score
     returns eight Abdoun villas; one-per-district returns eight
     identical "three-bedroom apartment on the ground floor" cards.
     Penalising each district and each character as it is used gives a
     window that varies on both axes without hard-coding either. */
  const pickFeatured = listings => {
    let pool = listings.filter(shortlisted);
    if (pool.length < FEATURED) {
      pool = listings.filter(l => num(l.photo_count) > 0 && l.image_url);
    }

    const areas = Object.create(null);
    const shapes = Object.create(null);
    const titles = Object.create(null);
    const out = [];

    while (out.length < FEATURED && pool.length) {
      let best = -1, bestV = -Infinity;
      for (let i = 0; i < pool.length; i++) {
        const l = pool[i];
        const key = str(l.title).toLowerCase();
        if (titles[key]) continue;                    // never two cards reading the same
        const v = score(l)
          - 9 * (areas[str(l.location)] || 0)
          - 5 * (shapes[shapeOf(l)] || 0);
        if (v > bestV) { bestV = v; best = i; }
      }
      if (best < 0) break;
      const chosen = pool.splice(best, 1)[0];
      areas[str(chosen.location)] = (areas[str(chosen.location)] || 0) + 1;
      shapes[shapeOf(chosen)] = (shapes[shapeOf(chosen)] || 0) + 1;
      titles[str(chosen.title).toLowerCase()] = 1;
      out.push(chosen);
    }
    return out;
  };

  /* Rank order alone puts the two garden villas in the same row. Keep
     the best property first — it is the one that runs full width — then
     take the strongest remaining card whose character differs from the
     one before it, so the grid alternates instead of grouping. */
  const arrange = picked => {
    if (picked.length < 3) return picked;
    const rest = picked.slice(1);
    const out = [picked[0]];
    while (rest.length) {
      const prev = shapeOf(out[out.length - 1]);
      let i = rest.findIndex(l => shapeOf(l) !== prev);
      if (i < 0) i = 0;
      out.push(rest.splice(i, 1)[0]);
    }
    return out;
  };

  fetch(DATA_URL)
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(data => {
      if (!Array.isArray(data) || !data.length) throw new Error('empty');
      const build = window.Lumina && window.Lumina.buildPropertyCard;
      if (typeof build !== 'function') throw new Error('property-card.js did not load');

      grid.replaceChildren(
        // the first card runs full width — it is the one with room for
        // a 16:9 cover, so it gets the best photograph of the eight
        ...arrange(pickFeatured(data)).map((l, i) => build(l, i, { wide: i === 0 }))
      );
      window.Lumina.activateCards(grid);
    })
    .catch(err => {
      console.error('Home collection load failed:', err);
      grid.innerHTML = `
        <p class="lede" style="grid-column:1/-1">
          Portfolio is loading slowly.
          <a href="listings.html" style="color:var(--gold);text-decoration:underline">View all properties →</a>
        </p>`;
    });
})();
