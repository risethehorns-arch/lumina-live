// LUMINA — property card
// Builds one floating property card, and wires up the behaviour it
// needs (scroll reveal, tilt, cursor parallax).
//
// Shared by js/home-collection.js and js/listings.js so the featured
// six and the full portfolio are literally the same component. Pairs
// with css/property-ui.css and js/property-viewer.js.
//
// Exposes:
//   Lumina.buildPropertyCard(listing, index, opts) -> Element
//   Lumina.activateCards(scope)
//
// On index.html, lumina.js already owns reveal, tilt and the pointer
// loop; activateCards defers to it. On pages without lumina.js it
// installs equivalents of its own.

(function () {
  'use strict';

  const Lumina = window.Lumina = window.Lumina || {};

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine   = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const PLACEHOLDER = 'assets/images/hero-luxury-villa.jpg';

  /* Levitation params, one row per card, cycled. Hand-picked rather
     than random so a grid never drifts into unison — that shared pulse
     is the whole failure mode this table exists to avoid. Six rows with
     mutually prime-ish durations keeps a 124-card page incoherent. */
  const FLOAT = [
    { d: 20, dur: 12.5, amp: 11, delay: 0,    rot: .30 },
    { d: 13, dur:  9.8, amp:  8, delay: -2.4, rot: .20 },
    { d: 17, dur: 14.2, amp: 13, delay: -5.1, rot: .26 },
    { d: 11, dur: 11.1, amp:  9, delay: -1.3, rot: .34 },
    { d: 22, dur: 13.4, amp: 12, delay: -3.7, rot: .18 },
    { d: 15, dur: 10.6, amp: 10, delay: -6.2, rot: .28 },
  ];

  const text = v => (v === null || v === undefined) ? '' : String(v);

  /* The JSON stores paths root-absolute ("/assets/..."), which 404s the
     moment the site is served from anything but a domain root — which is
     exactly what a GitHub Pages project deploy is. */
  const rel = p => {
    const s = text(p).trim();
    if (!s) return '';
    return s.startsWith('/') ? s.slice(1) : s;
  };
  Lumina.relPath = rel;

  const coverOf = listing => rel(listing.image_url) || PLACEHOLDER;

  const shotCount = listing => {
    const n = Array.isArray(listing.images) ? listing.images.length : 0;
    return n || Number(listing.photo_count) || 0;
  };

  /* Seven 4th Circle records quote a rate per square metre, not a total
     — 885 JOD for a 260 m² apartment. Computing a total would be
     inventing a figure, so `price_unit` marks them and they render as
     what they are, which is how Amman new-build sales are quoted. */
  const formatPrice = listing => {
    /* Five rents sit in the 500–1,200 band while every other rent here
       runs 6,000–120,000 — monthly figures among annual ones. Until the
       period is confirmed, showing nothing beats showing a number that
       may be wrong by a factor of twelve. */
    if (listing.needs_price_review) return 'Price on request';
    const raw = listing.price_jod_test_margin != null
      ? listing.price_jod_test_margin : listing.price_jod_raw;
    const amount = Number(raw);
    if (!Number.isFinite(amount)) return 'Price on request';
    const unit = listing.price_unit === 'per_sqm' ? ' JOD/m²' : ' JOD';
    const tx = text(listing.transaction).trim();
    return `${amount.toLocaleString('en-US')}${unit}${tx ? ' · ' + tx : ''}`;
  };
  Lumina.formatPrice = formatPrice;

  const CAMERA =
    `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"
       stroke-linejoin="round" aria-hidden="true">
       <rect x="1.6" y="4.2" width="12.8" height="9.2" rx="2"/>
       <circle cx="8" cy="8.8" r="2.6"/><path d="M5.4 4.2l1-1.6h3.2l1 1.6"/>
     </svg>`;

  const ARROW =
    `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
       aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>`;

  const openFor = listing => {
    if (typeof Lumina.openViewer === 'function') {
      Lumina.openViewer(listing);
    } else {
      // Viewer missing or failed to parse — the details page is still
      // the honest destination, so degrade to it rather than to a
      // dead click.
      window.location.href = `property-details.html?id=${encodeURIComponent(text(listing.id))}`;
    }
  };

  /**
   * @param {object} listing  a record from data/lumina-demo-leads.json
   * @param {number} index    position in the grid, drives float + stagger
   * @param {object} [opts]   { wide:boolean, stagger:boolean,
   *                            actions:[{label,href,primary}] }
   */
  Lumina.buildPropertyCard = (listing, index, opts) => {
    const o = opts || {};
    const f = FLOAT[index % FLOAT.length];

    /* Outer: grid item + scroll reveal. */
    const shell = document.createElement('div');
    shell.className = `prop-float rv${o.wide ? ' wide' : ''}`;
    /* Stagger only reads as intentional on a short grid. On the full
       portfolio it would leave the last card waiting eleven seconds. */
    if (o.stagger !== false && index > 0 && index < 10) {
      shell.style.setProperty('--rvd', `${index * 90}ms`);
    }

    /* Cursor parallax. */
    const depth = document.createElement('div');
    depth.className = 'depth';
    depth.style.setProperty('--d', `${f.d}px`);

    /* Levitation. Separate element on purpose — a CSS animation on the
       card itself would outrank the inline transform the tilt handler
       writes, and the tilt would silently stop working. */
    const lev = document.createElement('div');
    lev.className = 'lev';
    lev.style.setProperty('--dur',   `${f.dur}s`);
    lev.style.setProperty('--amp',   `${f.amp}px`);
    lev.style.setProperty('--delay', `${f.delay}s`);
    lev.style.setProperty('--rot',   `${f.rot}deg`);

    const article = document.createElement('article');
    article.className = 'card tilt';

    const spec = document.createElement('span');
    spec.className = 'spec';
    spec.setAttribute('aria-hidden', 'true');

    const media = document.createElement('div');
    media.className = 'card-media';

    /* Twelve records have no photography. Filling the frame with the
       stock villa shows a building that is not the one being sold —
       every other asset on this site is the client's own, and a
       stand-in read as a real photograph is worse than an empty frame
       that says so. */
    if (shotCount(listing) < 1) {
      media.classList.add('no-photo');
      const note = document.createElement('span');
      note.className = 'no-photo-note';
      note.textContent = 'Photography on request';
      media.appendChild(note);
    } else {
      const img = document.createElement('img');
      img.src = coverOf(listing);
      img.alt = `${text(listing.title) || 'Property'} — ${text(listing.location || listing.location_area) || 'Amman'}`;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', () => { img.src = PLACEHOLDER; }, { once: true });
      media.appendChild(img);
    }

    const where = text(listing.location || listing.location_area).trim();
    if (where) {
      const tag = document.createElement('span');
      tag.className = 'card-tag';
      tag.textContent = where;
      media.appendChild(tag);
    }

    const tx = text(listing.transaction).trim();
    if (tx) {
      const badge = document.createElement('span');
      badge.className = 'card-badge';
      badge.textContent = tx;
      media.appendChild(badge);
    }

    const shots = shotCount(listing);
    if (shots > 1) {
      const chip = document.createElement('span');
      chip.className = 'card-shots';
      chip.innerHTML = `${CAMERA}<span>${shots} photos</span>`;
      media.appendChild(chip);
    }

    const body = document.createElement('div');
    body.className = 'card-body';

    const kicker = document.createElement('p');
    kicker.className = 'kicker';
    kicker.textContent = [
      listing.ref ? `Ref ${text(listing.ref)}` : null,
      text(listing.location).trim() || null,
      text(listing.property_type).trim() || null,
    ].filter(Boolean).join(' · ');

    const title = document.createElement('h3');
    title.className = 'display';
    title.textContent = text(listing.title) || 'Residence';

    const specs = document.createElement('ul');
    specs.className = 'specs';
    const items = [];
    if (listing.size_sqm)   items.push(`<li><span class="num">${Number(listing.size_sqm).toLocaleString('en-US')}</span> m²</li>`);
    if (listing.bedrooms)   items.push(`<li><span class="num">${text(listing.bedrooms)}</span> bedrooms</li>`);
    if (listing.bathrooms)  items.push(`<li><span class="num">${text(listing.bathrooms)}</span> baths</li>`);
    specs.innerHTML = items.join('') || '<li>Particulars on request</li>';

    const price = document.createElement('div');
    price.className = 'price';
    const amount = document.createElement('b');
    amount.className = 'num';
    amount.textContent = formatPrice(listing);

    const view = document.createElement('button');
    view.type = 'button';
    view.className = 'view-btn';
    view.setAttribute('aria-label', `View property — ${text(listing.title) || 'Residence'}`);
    view.innerHTML = `<span>View property</span><span class="arrow" aria-hidden="true">${ARROW}</span>`;
    view.addEventListener('click', e => { e.stopPropagation(); openFor(listing); });

    price.append(amount, view);
    body.append(kicker, title, specs, price);

    if (Array.isArray(o.actions) && o.actions.length) {
      const row = document.createElement('div');
      row.className = 'card-actions';
      o.actions.forEach(a => {
        const link = document.createElement('a');
        link.className = 'card-act' + (a.primary ? ' card-act-primary' : '');
        link.href = a.href;
        link.textContent = a.label;
        if (a.external !== false) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
        /* These sit inside a card whose own click opens the gallery. */
        link.addEventListener('click', e => e.stopPropagation());
        row.appendChild(link);
      });
      body.appendChild(row);
    }

    article.append(spec, media, body);

    /* The whole card is a target too, but the button above is the one
       that carries the accessible name and the keyboard path. */
    article.style.cursor = 'pointer';
    article.addEventListener('click', () => openFor(listing));

    lev.appendChild(article);
    depth.appendChild(lev);
    shell.appendChild(depth);
    return shell;
  };

  /* ── local fallbacks, used only where lumina.js is absent ── */

  let localIO = null;
  const localReveal = scope => {
    const root = scope || document;
    if (reduce) {
      root.querySelectorAll('.rv').forEach(el => el.classList.add('in'));
      return;
    }
    if (!localIO) {
      localIO = new IntersectionObserver(entries => {
        entries.forEach(en => {
          if (en.isIntersecting) { en.target.classList.add('in'); localIO.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: .12 });
    }
    const pending = [...root.querySelectorAll('.rv:not(.in)')];
    pending.forEach(el => localIO.observe(el));

    /* Safety net. Cards start at opacity 0, so if the observer never
       fires the page reads as empty — survivable for the six on the
       landing page, not for a hundred-odd here. If nothing at all has
       revealed shortly after render, show everything rather than show
       nothing. A partial reveal means the observer is working and the
       rest are simply below the fold, so that case is left alone. */
    if (!pending.length) return;
    setTimeout(() => {
      if (root.querySelector('.rv.in')) return;
      pending.forEach(el => { el.classList.add('in'); localIO.unobserve(el); });
    }, 1500);
  };

  const localTilt = scope => {
    if (!fine || reduce) return;
    (scope || document).querySelectorAll('.tilt').forEach(card => {
      if (card.dataset.tilt) return;
      card.dataset.tilt = '1';
      let raf = null, rx = 0, ry = 0;
      const apply = () => {
        card.style.transform = `perspective(1000px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-6px)`;
        raf = null;
      };
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        ry = (px - .5) * 7; rx = (.5 - py) * 5;
        card.style.setProperty('--sx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--sy', (py * 100).toFixed(1) + '%');
        if (!raf) raf = requestAnimationFrame(apply);
      }, { passive: true });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
  };

  /* --px/--py drive .depth. lumina.js publishes them on index.html and
     flags itself as the owner; anywhere else this fills in. */
  let parallaxStarted = false;
  const ensureParallax = () => {
    if (parallaxStarted || Lumina.parallax || !fine || reduce) return;
    parallaxStarted = true;
    Lumina.parallax = true;
    let tx = 0, ty = 0, cx = 0, cy = 0;
    addEventListener('pointermove', e => {
      tx = (e.clientX / innerWidth  - .5) * 2;
      ty = (e.clientY / innerHeight - .5) * 2;
    }, { passive: true });
    (function loop() {
      cx += (tx - cx) * .06; cy += (ty - cy) * .06;
      const root = document.documentElement.style;
      root.setProperty('--px', cx.toFixed(4));
      root.setProperty('--py', cy.toFixed(4));
      requestAnimationFrame(loop);
    })();
  };

  /* Levitation is a compositor animation per card, and the portfolio grid
     holds over a hundred of them — all ticking, on or off screen, on a
     phone as much as a laptop. This parks the ones nobody can see. Paused
     rather than removed, so a card resumes where it left off instead of
     snapping back to phase 0 and pulsing in step with its neighbours. */
  let restIO = null;
  const restOffscreen = scope => {
    if (reduce || typeof IntersectionObserver !== 'function') return;
    if (!restIO) {
      restIO = new IntersectionObserver(entries => {
        entries.forEach(en => en.target.classList.toggle('rest', !en.isIntersecting));
      }, { rootMargin: '260px 0px' });
    }
    (scope || document).querySelectorAll('.prop-float').forEach(el => {
      if (el.dataset.rest) return;
      el.dataset.rest = '1';
      el.classList.add('rest');       // nothing runs until it is seen
      restIO.observe(el);
    });
  };

  /** Call after injecting cards. Idempotent. */
  Lumina.activateCards = scope => {
    if (typeof Lumina.refreshReveals === 'function') Lumina.refreshReveals();
    else localReveal(scope);

    if (typeof Lumina.bindTilt === 'function') Lumina.bindTilt(scope);
    else localTilt(scope);

    restOffscreen(scope);
    ensureParallax();
  };
})();
