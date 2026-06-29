// LUMINA — property-details.js
// Fetches and renders individual property detail pages from the JSON data feed.

(function () {
  'use strict';

  const root = document.getElementById('property-root');
  const placeholderImage = '/assets/images/hero-luxury-villa.jpg';
  const whatsappNumber = (window.LuminaConfig && window.LuminaConfig.whatsapp) || '962000000000';

  const safeText = value => (value === null || value === undefined) ? '' : String(value);
  const formatPrice = value => {
    const amount = Number(value);
    return Number.isFinite(amount) ? `${amount.toLocaleString('en-US')} JOD` : 'Price on request';
  };
  const imagePath = value => safeText(value).trim() || placeholderImage;
  const sourceUrl = value => {
    const url = safeText(value).trim();
    return (url.startsWith('https://') || url.startsWith('http://')) ? url : '#';
  };
  const whatsappUrl = listing => {
    const message = [
      'Hello, I came across this property on Lumina and it caught my attention:',
      '',
      safeText(listing.title),
      safeText(listing.location_area),
      '',
      'Is it still available? I would like to know more.'
    ].join('\n');
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  };

  const appendText = (parent, tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = text;
    parent.appendChild(el);
    return el;
  };

  const addSpec = (grid, label, value) => {
    if (value === null || value === undefined || value === '') return;
    const box = document.createElement('div');
    box.className = 'spec-box';
    appendText(box, 'div', 'spec-value', value);
    appendText(box, 'div', 'spec-label', label);
    grid.appendChild(box);
  };

  const showNotFound = () => {
    root.className = 'not-found';
    root.replaceChildren();
    const wrap = document.createElement('div');
    appendText(wrap, 'h1', '', 'Listing not found.');
    const link = document.createElement('a');
    link.href = 'listings.html';
    link.textContent = 'Back to Listings';
    wrap.appendChild(link);
    root.appendChild(wrap);
  };

  const renderListing = listing => {
    document.title = `${safeText(listing.title)} — Lumina Demo Listing`;
    root.className = 'detail-shell';
    root.replaceChildren();

    const hero = document.createElement('section');
    hero.className = 'detail-hero';
    const heroImg = document.createElement('img');
    heroImg.src = imagePath(listing.image_url);
    heroImg.alt = `${safeText(listing.title)} — ${safeText(listing.location_area)}`;
    heroImg.addEventListener('error', () => { heroImg.src = placeholderImage; }, { once: true });
    appendText(hero, 'div', 'detail-badge', 'Demo Listing — Verification Required');
    hero.prepend(heroImg);

    const wrap = document.createElement('section');
    wrap.className = 'detail-wrap';
    const container = document.createElement('div');
    container.className = 'container detail-grid-dynamic';

    const main = document.createElement('div');
    appendText(main, 'p', 'detail-kicker', safeText(listing.property_type));
    appendText(main, 'h1', 'dynamic-title', safeText(listing.title));
    appendText(main, 'p', 'curated-hook', 'Curated opportunity — limited visibility, details shared upon request.');
    appendText(main, 'div', 'dynamic-location', safeText(listing.location_area));
    appendText(main, 'div', 'dynamic-price', formatPrice(listing.price_jod_test_margin));
    appendText(main, 'div', 'source-price', `Original source price: ${formatPrice(listing.price_jod_raw)}`);
    appendText(main, 'div', 'demo-note', 'This listing is part of a workflow test. Availability, media, pricing, and ownership must be verified before public use.');

    const specs = document.createElement('div');
    specs.className = 'spec-grid';
    addSpec(specs, 'Property Type', safeText(listing.property_type));
    addSpec(specs, 'Size', listing.size_sqm ? `${Number(listing.size_sqm).toLocaleString('en-US')} sqm` : '');
    addSpec(specs, 'Land Area', listing.land_area_sqm ? `${Number(listing.land_area_sqm).toLocaleString('en-US')} sqm` : '');
    addSpec(specs, 'Bedrooms', safeText(listing.bedrooms));
    addSpec(specs, 'Bathrooms', safeText(listing.bathrooms));
    addSpec(specs, 'Quality Score', `${listing.quality_score}/5`);
    addSpec(specs, 'Status', safeText(listing.verification_status));
    main.appendChild(specs);

    const desc = document.createElement('div');
    desc.className = 'detail-description';
    appendText(desc, 'h2', '', 'About This Demo Listing');
    appendText(desc, 'p', '', safeText(listing.description));
    main.appendChild(desc);
    appendText(main, 'p', 'map-safety', 'Map shows the general area only. Exact property location is shared privately after buyer qualification and viewing approval.');

    const aside = document.createElement('aside');
    aside.className = 'side-panel';
    appendText(aside, 'h2', '', 'Private Inquiry');
    appendText(aside, 'p', '', 'Demo workflow inquiry. Verification is required before viewing, publication, or client presentation.');
    const actions = document.createElement('div');
    actions.className = 'detail-actions';
    const request = document.createElement('a');
    request.href = whatsappUrl(listing);
    request.className = 'detail-btn detail-btn-primary';
    request.target = '_blank';
    request.rel = 'noopener noreferrer';
    request.textContent = 'Request Details';
    request.addEventListener('click', () => console.log('WhatsApp intent:', { listing_id: listing.id, page_type: 'details' }));
    const trust = document.createElement('p');
    trust.className = 'trust-signal';
    trust.textContent = 'Direct response within 24 hours — private advisory approach';
    const source = document.createElement('a');
    source.href = sourceUrl(listing.source_url);
    source.className = 'detail-btn detail-btn-outline';
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = 'View Source';
    const back = document.createElement('a');
    back.href = 'listings.html';
    back.className = 'detail-btn detail-btn-outline';
    back.textContent = 'Back to Listings';
    actions.append(request, trust, source, back);
    aside.appendChild(actions);

    container.append(main, aside);
    wrap.appendChild(container);
    root.append(hero, wrap);
  };

  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) {
    showNotFound();
    return;
  }

  fetch('/data/lumina-demo-leads.json')
    .then(response => response.ok ? response.json() : Promise.reject(new Error('Listing data unavailable')))
    .then(data => {
      const listing = Array.isArray(data) ? data.find(item => item.id === id) : null;
      if (listing) renderListing(listing);
      else showNotFound();
    })
    .catch(showNotFound);
})();
