// LUMINA — home collection
// Renders featured portfolio cards from the Excel-imported inventory,
// using photos matched by reference number under /assets/listings/{ref}/

(function () {
  'use strict';

  const grid = document.getElementById('home-collection-grid');
  if (!grid) return;

  const DATA_URL = 'data/lumina-demo-leads.json';
  const PLACEHOLDER = 'assets/images/hero-luxury-villa.jpg';
  const FEATURED = 6;

  const formatPrice = (value, transaction) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return 'Price on request';
    const base = `${amount.toLocaleString('en-US')} JOD`;
    const tx = String(transaction || '').trim();
    return tx ? `${base} · ${tx}` : base;
  };

  const imgSrc = listing => {
    const src = (listing.image_url || '').trim();
    if (!src) return PLACEHOLDER;
    return src.startsWith('/') ? src.slice(1) : src;
  };

  const pickFeatured = listings => {
    const withPhotos = listings.filter(l => (l.photo_count || 0) > 0 && l.image_url);
    const pool = withPhotos.length ? withPhotos : listings;
    // Prefer variety: sale first, then rent; keep ref order otherwise
    const sale = pool.filter(l => /sale/i.test(l.transaction || ''));
    const rest = pool.filter(l => !/sale/i.test(l.transaction || ''));
    return [...sale, ...rest].slice(0, FEATURED);
  };

  const createCard = (listing, index) => {
    const article = document.createElement('article');
    article.className = `card tilt rv${index === 0 ? ' wide' : ''}`;
    if (index > 0) article.style.setProperty('--rvd', `${index * 90}ms`);

    const spec = document.createElement('span');
    spec.className = 'spec';
    spec.setAttribute('aria-hidden', 'true');

    const media = document.createElement('div');
    media.className = 'card-media';
    const img = document.createElement('img');
    img.src = imgSrc(listing);
    img.alt = `${listing.title || 'Property'} — ${listing.location || listing.location_area || 'Amman'}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => { img.src = PLACEHOLDER; }, { once: true });
    media.appendChild(img);

    const body = document.createElement('div');
    body.className = 'card-body';

    const kicker = document.createElement('p');
    kicker.className = 'kicker';
    const parts = [
      listing.ref ? `Ref ${listing.ref}` : null,
      listing.location || null,
      listing.property_type || null,
    ].filter(Boolean);
    kicker.textContent = parts.join(' · ');

    const title = document.createElement('h3');
    title.className = 'display';
    title.textContent = listing.title || 'Residence';

    const specs = document.createElement('ul');
    specs.className = 'specs';
    const specItems = [];
    if (listing.size_sqm) specItems.push(`<li><span class="num">${Number(listing.size_sqm).toLocaleString('en-US')}</span> m²</li>`);
    if (listing.bedrooms) specItems.push(`<li><span class="num">${listing.bedrooms}</span> bedrooms</li>`);
    if (listing.bathrooms) specItems.push(`<li><span class="num">${listing.bathrooms}</span> baths</li>`);
    if (listing.floor) specItems.push(`<li>${listing.floor}</li>`);
    specs.innerHTML = specItems.join('') || '<li>Particulars on request</li>';

    const price = document.createElement('div');
    price.className = 'price';
    const priceVal = listing.price_jod_test_margin != null ? listing.price_jod_test_margin : listing.price_jod_raw;
    price.innerHTML = `
      <b class="num">${formatPrice(priceVal, listing.transaction)}</b>
      <span class="arrow" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
      </span>`;

    body.append(kicker, title, specs, price);
    article.append(spec, media, body);

    article.style.cursor = 'pointer';
    article.addEventListener('click', () => {
      window.location.href = `property-details.html?id=${encodeURIComponent(listing.id)}`;
    });

    return article;
  };

  fetch(DATA_URL)
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(data => {
      if (!Array.isArray(data) || !data.length) throw new Error('empty');
      const featured = pickFeatured(data);
      grid.replaceChildren(...featured.map(createCard));
      // re-trigger scroll reveal if lumina.js already ran
      if (window.Lumina && typeof window.Lumina.refreshReveals === 'function') {
        window.Lumina.refreshReveals();
      } else {
        grid.querySelectorAll('.rv').forEach(el => el.classList.add('in'));
      }
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
