// LUMINA — listings.js
// Renders the full Excel-imported portfolio (photos matched by ref).

(function () {
  'use strict';

  const grid = document.getElementById('listings-grid');
  const count = document.getElementById('listing-count');
  const whatsappNumber = (window.LuminaConfig && window.LuminaConfig.whatsapp) || '962771505250';

  let allListings = [];

  const safeText = value => (value === null || value === undefined) ? '' : String(value);

  const whatsappUrl = message => `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

  const listingMessage = listing => [
    'Hello, I came across this property on Lumina and it caught my attention:',
    '',
    safeText(listing.title),
    listing.ref ? `Ref: ${listing.ref}` : null,
    safeText(listing.location_area),
    '',
    'Is it still available? I would like to know more.'
  ].filter(Boolean).join('\n');

  const viewingMessage = listing => [
    'Hello, I would like to schedule a viewing for:',
    '',
    safeText(listing.title),
    listing.ref ? `Ref: ${listing.ref}` : null,
    safeText(listing.location_area),
    '',
    'Please contact me.'
  ].filter(Boolean).join('\n');

  /* The card itself comes from js/property-card.js, the same builder the
     landing page uses — that is the only way the two grids stay
     identical. What is page-specific is passed in: the listings page
     keeps its two WhatsApp routes, which the home grid does not have. */
  const createListingCard = (listing, index) => {
    /* The gallery carries the enquiry route too, so a viewer opened
       from a card is not a dead end. */
    listing.__askUrl = whatsappUrl(listingMessage(listing));
    return window.Lumina.buildPropertyCard(listing, index, {
      /* No `wide` card here. The home grid features one; on a 129-card
         portfolio a double-width item just breaks the rhythm. */
      wide: false,
      /* On by name only: the builder caps the delay at the first nine
         cards, so the opening screen assembles and everything below the
         fold still reveals the moment it is scrolled to. Staggering all
         129 would leave the last card waiting twelve seconds. */
      stagger: true,
      actions: [
        { label: 'Request Details',  href: whatsappUrl(listingMessage(listing)), primary: true },
        { label: 'Schedule Viewing', href: whatsappUrl(viewingMessage(listing)) },
      ],
    });
  };

  /* The grid holds a hundred cards, so a filter that removes three of
     them changes almost nothing on screen. The number is the only honest
     feedback there is; make it move when it changes. */
  const setCount = n => {
    if (!count) return;
    const before = count.textContent;
    count.textContent = String(n);
    if (before === count.textContent) return;
    count.classList.remove('bump');
    void count.offsetWidth;   // restart the animation, not queue it
    count.classList.add('bump');
  };

  const renderListings = listings => {
    try {
      if (typeof (window.Lumina && window.Lumina.buildPropertyCard) !== 'function') {
        throw new Error('property-card.js did not load');
      }
      if (!listings.length) {
        /* Not a dead end: the filters that emptied the grid are the same
           ones the reader now has to undo, so the way out is offered here
           rather than left to be found back up the page. */
        const empty = document.createElement('div');
        empty.className = 'listing-error';
        const head = document.createElement('b');
        head.textContent = 'Nothing matches that combination.';
        const note = document.createElement('span');
        note.textContent = 'Widen one of the filters, or tell us what you are looking for — a good deal of what we hold is never listed publicly.';
        empty.append(head, note);
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.textContent = 'Clear all filters';
        reset.addEventListener('click', () => {
          const clear = document.getElementById('fx-clear');
          if (clear) clear.click();
        });
        empty.appendChild(reset);
        grid.replaceChildren(empty);
      } else {
        grid.replaceChildren(...listings.map(createListingCard));
        /* Filtering replaces the whole grid, so reveal and tilt have to
           be re-bound every render, not just on first paint. */
        window.Lumina.activateCards(grid);
      }
      setCount(listings.length);
    } catch (err) {
      console.error('Lumina renderListings error:', err);
      showFallback(err.message);
    }
  };

  const showFallback = (detail) => {
    console.error('Lumina listings fallback triggered:', detail || 'unknown');
    const message = document.createElement('div');
    message.className = 'listing-error';
    message.textContent = 'Portfolio is temporarily unavailable. Please try again later.';
    grid.replaceChildren(message);
    setCount(0);
  };

  const activeType = () => {
    const pill = document.querySelector('.type-pill.active');
    return (pill && pill.getAttribute('data-type')) || 'all';
  };

  /* ---- FLOOR ----
     The data holds 16 distinct floor strings for 112 listings, including
     "2nd floor (from lower street)" — Amman is built on hills, so a flat
     can be on two floors at once depending on which street you came from.
     Offering all 16 as filter options would be offering the reader the
     import's inconsistencies. These five bands are what someone actually
     chooses between. 17 listings have no floor recorded and match no
     band; they appear whenever the floor filter is off. */
  const FLOORS = [
    { value: 'lower',   label: 'Lower level' },
    { value: 'ground',  label: 'Ground floor' },
    { value: 'low',     label: '1st – 3rd floor' },
    { value: 'high',    label: '4th floor and above' },
    { value: 'rooftop', label: 'Rooftop' },
  ];

  const floorGroup = raw => {
    const s = safeText(raw).toLowerCase().trim();
    if (!s) return '';
    if (s.includes('roof')) return 'rooftop';
    /* "Level −1" is a basement. Checked before the others because the
       string also has to survive "(from lower street)", which is a
       description of the entrance, not a storey. */
    if (s.includes('level')) return 'lower';
    if (s.includes('ground')) return 'ground';
    const m = s.match(/(\d+)\s*(?:st|nd|rd|th)/);
    if (m) return Number(m[1]) <= 3 ? 'low' : 'high';
    return '';
  };

  /* ---- BEDROOMS ----
     1, 2, 3 and 4+. Four and eight are the only values above three, six
     listings between them, so they share a bucket. */
  const bedBucket = raw => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) return '';
    /* 46024 was an Excel date serial that landed in this column. It has
       been cleared, but a ceiling costs nothing and stops the next bad
       import inventing a bedroom count. */
    if (n > 30) return '';
    return String(Math.min(n, 4));
  };

  /* Selected values. Areas and floors are multi-select; bedrooms toggle
     independently, which single-choice pills cannot express — "two or
     three bedrooms" is one of the commonest searches there is. */
  const state = { areas: [], floors: [], beds: new Set(), deal: '' };

  /* ---- TRANSACTION ----
     The column holds "Rent", "Sale" and "Sale or Rent". The third is not a
     third category so much as a listing that answers both questions, so it
     matches Rent and it matches Sale. "both" is the way to see only those. */
  const dealMatch = (deal, raw) => {
    const s = safeText(raw).toLowerCase();
    const rent = s.includes('rent');
    const sale = s.includes('sale');
    if (deal === 'rent') return rent;
    if (deal === 'sale') return sale;
    if (deal === 'both') return rent && sale;
    return true;
  };

  const setDeal = (value, pill) => {
    state.deal = value;
    document.querySelectorAll('.fx-pill[data-deal]').forEach(p => {
      const on = p === pill;
      p.classList.toggle('active', on);
      p.setAttribute('aria-pressed', String(on));
    });
  };
  let msArea = null;
  let msFloor = null;

  /* Every footer on the site links to listings.html?type=villa,
     ?location=abdoun and so on. Nothing read those parameters, so all
     of them landed on the unfiltered page — the links looked like
     filters and behaved like a plain link to the portfolio. */
  /* ── arriving on a shared property ────────────────────────────
     The share button in the gallery hands out
     listings.html?property=<id>, so whoever opens it lands in the SAME
     viewer the sender was looking at rather than on a different page.
     This is the receiving half of that, and the two move together —
     see js/property-viewer.js.

     It runs after applyFilters so the grid behind the gallery is
     already painted: closing the viewer leaves the reader in the
     portfolio rather than on a blank page. If the id is no longer in
     the book the page is simply the portfolio, which is the right
     failure — a property that has gone is not an error state. */
  const openSharedProperty = listings => {
    const id = (new URLSearchParams(window.location.search).get('property') || '').trim();
    if (!id) return;
    const match = listings.find(l => String(l.id) === id);
    if (!match || !window.Lumina || typeof window.Lumina.openViewer !== 'function') return;
    /* One frame, so the grid has laid out before the viewer's own
       focus() runs against it. */
    requestAnimationFrame(() => window.Lumina.openViewer(match));
  };

  const applyUrlFilters = listings => {
    const q = new URLSearchParams(window.location.search);

    const type = (q.get('type') || '').trim().toLowerCase();
    if (type) {
      const pill = [...document.querySelectorAll('.type-pill')]
        .find(p => (p.getAttribute('data-type') || '').toLowerCase() === type);
      if (pill) {
        document.querySelectorAll('.type-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
      }
    }

    /* Comma-separates, so a link can carry more than one area now that
       the control can hold more than one. ?location=Abdoun still works
       — every footer on the site sends that form. */
    const norm = s => s.trim().toLowerCase().replace(/[-_]+/g, ' ');
    const locs = (q.get('location') || '').split(',').map(norm).filter(Boolean);
    if (locs.length && msArea) {
      /* Match loosely: the links are slugs ("dair-ghbar", "um-uthaina")
         while the data holds display names ("Dair Ghbar"). */
      const known = new Set(listings.map(l => safeText(l.location).trim()).filter(Boolean));
      const picked = [...known].filter(k => locs.includes(norm(k)));
      if (picked.length) { msArea.set(picked); state.areas = picked; }
    }

    const floors = (q.get('floor') || '').split(',').map(norm).filter(Boolean);
    if (floors.length && msFloor) {
      const picked = FLOORS.map(f => f.value).filter(v => floors.includes(v));
      if (picked.length) { msFloor.set(picked); state.floors = picked; }
    }

    const beds = (q.get('beds') || '').split(',').map(s => s.trim()).filter(Boolean);
    beds.forEach(b => {
      const pill = document.querySelector('.fx-pill[data-bed="' + b.replace(/\D/g, '') + '"]');
      if (!pill) return;
      pill.classList.add('active');
      pill.setAttribute('aria-pressed', 'true');
      state.beds.add(pill.getAttribute('data-bed'));
    });

    const budget = (q.get('budget') || '').trim();
    const bsel = document.getElementById('filter-budget');
    if (budget && bsel && [...bsel.options].some(o => o.value === budget)) bsel.value = budget;

    /* ?deal=rent|sale|both. "transaction" is accepted too because that is
       what the field is called everywhere else in the data. */
    const deal = (q.get('deal') || q.get('transaction') || '').trim().toLowerCase();
    if (deal) {
      const pill = document.querySelector('.fx-pill[data-deal="' + deal + '"]');
      if (pill) setDeal(deal, pill);
    }
  };

  const applyFilters = () => {
    let list = allListings.slice();
    const type = activeType();
    if (type && type !== 'all') {
      list = list.filter(l => safeText(l.property_type).toLowerCase().includes(type.toLowerCase()));
    }

    /* Within a filter the selected values are an OR — picking Abdoun and
       Swefieh means either. Between filters it is an AND. */
    if (state.areas.length) {
      const want = state.areas.map(a => a.toLowerCase());
      list = list.filter(l => {
        const a = safeText(l.location).toLowerCase();
        const b = safeText(l.location_area).toLowerCase();
        return want.some(w => a.includes(w) || b.includes(w));
      });
    }

    if (state.floors.length) {
      list = list.filter(l => state.floors.includes(floorGroup(l.floor)));
    }

    if (state.beds.size) {
      list = list.filter(l => state.beds.has(bedBucket(l.bedrooms)));
    }

    if (state.deal) {
      list = list.filter(l => dealMatch(state.deal, l.transaction));
    }

    const budgetSel = document.getElementById('filter-budget');
    const budget = budgetSel && budgetSel.value ? budgetSel.value : '';
    if (budget) {
      list = list.filter(l => {
        const isRent = /rent/i.test(safeText(l.transaction));
        const isSale = /sale/i.test(safeText(l.transaction));
        if (budget === 'for-sale') return isSale;

        const p = Number(l.price_jod_raw);
        /* A rate per m² is not comparable with an annual rent, and a
           figure held back for review is not comparable with anything.
           Either way it cannot answer a budget question. */
        if (!Number.isFinite(p) || l.needs_price_review || l.price_unit === 'per_sqm') return false;

        switch (budget) {
          case 'rent-under-10k':  return isRent && p < 10000;
          case 'rent-10-15k':     return isRent && p >= 10000 && p < 15000;
          case 'rent-15-20k':     return isRent && p >= 15000 && p < 20000;
          case 'rent-20-30k':     return isRent && p >= 20000 && p < 30000;
          case 'rent-30k-plus':   return isRent && p >= 30000;
          default: return true;
        }
      });
    }
    syncChrome();
    renderListings(list);
  };

  /* The budget select has no .active of its own, and "Clear all" should
     not sit there offering to clear nothing. */
  const syncChrome = () => {
    const bsel = document.getElementById('filter-budget');
    if (bsel) bsel.classList.toggle('active', !!bsel.value);

    const any = activeType() !== 'all'
      || state.areas.length > 0
      || state.floors.length > 0
      || state.beds.size > 0
      || !!state.deal
      || !!(bsel && bsel.value);

    const clear = document.getElementById('fx-clear');
    if (clear) {
      if (any) {
        clear.hidden = false;
        /* Unhide first, class on the next frame, or the fade has no
           start value to run from. */
        requestAnimationFrame(() => clear.classList.add('on'));
      } else {
        clear.classList.remove('on');
        setTimeout(() => { if (!clear.classList.contains('on')) clear.hidden = true; }, 340);
      }
    }
  };

  /* ---- HEADER STATS ----
     Three figures under the headline, all counted from the file that draws
     the grid. Typed in by hand they would be wrong the next time the
     portfolio moves, and this page's whole claim is that it shows
     everything we hold. */
  const buildHeaderStats = listings => {
    const mount = document.getElementById('ph-stats');
    if (!mount) return;
    const areas = new Set();
    let shots = 0;
    listings.forEach(l => {
      const a = safeText(l.location).trim();
      if (a) areas.add(a);
      shots += Array.isArray(l.images) ? l.images.length : 0;
    });
    const stats = [
      [listings.length, listings.length === 1 ? 'Residence' : 'Residences'],
      [areas.size, areas.size === 1 ? 'District' : 'Districts'],
      [shots.toLocaleString('en-US'), 'Photographs'],
    ];
    mount.replaceChildren(...stats.map(([n, label]) => {
      const li = document.createElement('li');
      const b = document.createElement('b');
      b.textContent = String(n);
      const s = document.createElement('span');
      s.textContent = label;
      li.append(b, s);
      return li;
    }));
  };

  /* ---- STICKY OFFSET ----
     The brand bar is fixed, so the filter bar has to stick below it rather
     than at zero — measured, not guessed, because the bar's height is a
     clamp() and changes with the viewport. */
  const syncBarHeight = () => {
    const bar = document.getElementById('bar');
    if (!bar) return;
    document.documentElement.style.setProperty('--bar-h', Math.round(bar.offsetHeight) + 'px');
  };

  /* Counts come from the data, never from a hand-written list. An option
     offering an area with one listing as an equal choice to one with
     sixty is a filter that hides the shape of the portfolio. */
  const buildFilters = listings => {
    if (typeof (window.Lumina && window.Lumina.multiSelect) !== 'function') {
      console.error('Lumina: filter-ui.js did not load — area and floor filters unavailable');
      return;
    }

    const areaCounts = new Map();
    listings.forEach(l => {
      const k = safeText(l.location).trim();
      if (k) areaCounts.set(k, (areaCounts.get(k) || 0) + 1);
    });
    const areaOptions = [...areaCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, label: value, count }));

    const floorCounts = new Map();
    listings.forEach(l => {
      const g = floorGroup(l.floor);
      if (g) floorCounts.set(g, (floorCounts.get(g) || 0) + 1);
    });
    /* Kept in building order — lower, ground, up, roof — rather than
       sorted by count. It is a vertical axis and reads as one. */
    const floorOptions = FLOORS
      .filter(f => floorCounts.get(f.value))
      .map(f => ({ value: f.value, label: f.label, count: floorCounts.get(f.value) }));

    const mountArea = document.getElementById('fx-location');
    if (mountArea) {
      msArea = window.Lumina.multiSelect({
        mount: mountArea,
        placeholder: 'All areas',
        noun: 'areas',
        aria: 'Filter by area',
        options: areaOptions,
        onChange: values => { state.areas = values; applyFilters(); },
      });
    }

    const mountFloor = document.getElementById('fx-floor');
    if (mountFloor) {
      msFloor = window.Lumina.multiSelect({
        mount: mountFloor,
        placeholder: 'Any floor',
        noun: 'floors',
        aria: 'Filter by floor',
        options: floorOptions,
        onChange: values => { state.floors = values; applyFilters(); },
      });
    }

    /* Bedroom pills carry their counts in the tooltip rather than the
       label — the pill is 40px wide and the number has to stay legible. */
    const bedCounts = new Map();
    listings.forEach(l => {
      const b = bedBucket(l.bedrooms);
      if (b) bedCounts.set(b, (bedCounts.get(b) || 0) + 1);
    });
    document.querySelectorAll('.fx-pill[data-bed]').forEach(pill => {
      const key = pill.getAttribute('data-bed');
      const n = bedCounts.get(key) || 0;
      const name = key === '4' ? 'four or more bedrooms' : key + '-bedroom';
      pill.title = n + (n === 1 ? ' property' : ' properties');
      pill.setAttribute('aria-label', name + ', ' + n + ' available');
      pill.setAttribute('aria-pressed', 'false');
      /* Nothing to show behind it, so do not offer it. */
      if (!n) pill.hidden = true;
    });
  };

  syncBarHeight();
  addEventListener('resize', syncBarHeight, { passive: true });
  addEventListener('load', syncBarHeight, { once: true });

  if (grid) {
    /* Relative, not root-absolute: a GitHub Pages project deploy serves
       this from /lumina/, where a leading slash 404s. */
    fetch('data/lumina-demo-leads.json?v=2026-08-22')
      .then(response => {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(data => {
        if (!Array.isArray(data)) throw new Error('Data is not an array');
        allListings = data;
        buildHeaderStats(data);
        buildFilters(data);
        /* After buildFilters, so the options a deep link asks for exist
           to be selected. */
        applyUrlFilters(data);
        applyFilters();
        openSharedProperty(data);
      })
      .catch(err => showFallback(err.message));
  } else {
    console.error('Lumina: listings-grid element not found in DOM');
  }

  document.querySelectorAll('.type-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.type-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      applyFilters();
    });
  });

  document.querySelectorAll('.fx-pill[data-bed]').forEach(pill => {
    pill.addEventListener('click', () => {
      const key = pill.getAttribute('data-bed');
      const on = !pill.classList.contains('active');
      pill.classList.toggle('active', on);
      pill.setAttribute('aria-pressed', String(on));
      if (on) state.beds.add(key);
      else state.beds.delete(key);
      applyFilters();
    });
  });

  /* Single choice, but clicking the active one turns it off — there is no
     "Any" pill, so the second click has to be the way back to everything. */
  document.querySelectorAll('.fx-pill[data-deal]').forEach(pill => {
    pill.addEventListener('click', () => {
      const key = pill.getAttribute('data-deal');
      if (state.deal === key) setDeal('', null);
      else setDeal(key, pill);
      applyFilters();
    });
  });

  const budgetSel = document.getElementById('filter-budget');
  if (budgetSel) budgetSel.addEventListener('change', applyFilters);

  const clearBtn = document.getElementById('fx-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      document.querySelectorAll('.type-pill').forEach(p => p.classList.remove('active'));
      const all = document.querySelector('.type-pill[data-type="all"]');
      if (all) all.classList.add('active');

      document.querySelectorAll('.fx-pill[data-bed]').forEach(p => {
        p.classList.remove('active');
        p.setAttribute('aria-pressed', 'false');
      });
      state.beds.clear();
      setDeal('', null);

      if (msArea) { msArea.clear(); state.areas = []; }
      if (msFloor) { msFloor.clear(); state.floors = []; }
      if (budgetSel) budgetSel.value = '';

      applyFilters();
    });
  }
})();
