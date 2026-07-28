// LUMINA — listings.js
// Renders the full Excel-imported portfolio (photos matched by ref).

(function () {
  'use strict';

  const grid = document.getElementById('listings-grid');
  const count = document.getElementById('listing-count');
  const placeholderImage = '/assets/images/hero-luxury-villa.jpg';
  const whatsappNumber = (window.LuminaConfig && window.LuminaConfig.whatsapp) || '962771505250';

  let allListings = [];

  const formatPrice = value => {
    const amount = Number(value);
    return Number.isFinite(amount) ? `${amount.toLocaleString('en-US')} JOD` : 'Price on request';
  };

  const safeText = value => (value === null || value === undefined) ? '' : String(value);

  const imagePath = value => {
    const src = safeText(value).trim();
    return src || placeholderImage;
  };

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

  const createWhatsAppButton = (listing, label, message, className) => {
    const button = document.createElement('a');
    button.href = whatsappUrl(message);
    button.className = `listing-whatsapp ${className}`;
    button.target = '_blank';
    button.rel = 'noopener noreferrer';
    button.textContent = label;
    return button;
  };

  const createListingCard = (listing, index) => {
    const card = document.createElement('div');
    card.className = `listing-card property-card demo-card delay-${index % 10}`;

    const imageWrap = document.createElement('div');
    imageWrap.className = 'card-img listing-image';

    const img = document.createElement('img');
    img.src = imagePath(listing.image_url);
    img.alt = `${safeText(listing.title) || 'Lumina listing'} — ${safeText(listing.location_area) || 'Jordan'}`;
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      img.src = placeholderImage;
    }, { once: true });

    const badge = document.createElement('span');
    badge.className = 'card-badge';
    badge.textContent = listing.ref ? `Ref ${safeText(listing.ref)}` : 'Portfolio';

    imageWrap.append(img, badge);

    const content = document.createElement('div');
    content.className = 'listing-content';

    const title = document.createElement('h3');
    title.textContent = safeText(listing.title);

    const location = document.createElement('p');
    location.className = 'location';
    location.textContent = safeText(listing.location_area);

    const price = document.createElement('p');
    price.className = 'price';
    const priceValue = listing.price_jod_test_margin != null ? listing.price_jod_test_margin : listing.price_jod_raw;
    const tx = safeText(listing.transaction);
    price.textContent = priceValue != null
      ? `${formatPrice(priceValue)}${tx ? ` · ${tx}` : ''}`
      : 'Price on request';

    const details = document.createElement('p');
    details.className = 'details';
    const detailParts = [];
    if (listing.property_type) detailParts.push(safeText(listing.property_type));
    if (listing.bedrooms) detailParts.push(`${safeText(listing.bedrooms)} Beds`);
    if (listing.bathrooms) detailParts.push(`${safeText(listing.bathrooms)} Baths`);
    if (listing.size_sqm) detailParts.push(`${Number(listing.size_sqm).toLocaleString('en-US')} sqm`);
    if (listing.photo_count) detailParts.push(`${listing.photo_count} photos`);
    details.textContent = detailParts.join(' · ');

    const propertyLink = document.createElement('a');
    propertyLink.href = `property-details.html?id=${encodeURIComponent(safeText(listing.id))}`;
    propertyLink.className = 'listing-whatsapp listing-whatsapp-secondary';
    propertyLink.textContent = 'View Property';

    const actions = document.createElement('div');
    actions.className = 'listing-actions';
    actions.append(
      createWhatsAppButton(listing, 'Request Details', listingMessage(listing), 'listing-whatsapp-primary'),
      createWhatsAppButton(listing, 'Schedule Viewing', viewingMessage(listing), 'listing-whatsapp-secondary'),
      propertyLink
    );

    const status = document.createElement('p');
    status.className = 'status';
    status.textContent = listing.status
      ? safeText(listing.status)
      : 'Lumina portfolio — final particulars on request';

    content.append(title, location, price);
    if (detailParts.length) content.appendChild(details);
    content.append(actions, status);
    card.append(imageWrap, content);
    return card;
  };

  const renderListings = listings => {
    try {
      if (!listings.length) {
        const empty = document.createElement('div');
        empty.className = 'listing-error';
        empty.textContent = 'No properties match these filters.';
        grid.replaceChildren(empty);
      } else {
        grid.replaceChildren(...listings.map(createListingCard));
      }
      if (count) count.textContent = String(listings.length);
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
    if (count) count.textContent = '0';
  };

  const activeType = () => {
    const pill = document.querySelector('.type-pill.active');
    return (pill && pill.getAttribute('data-type')) || 'all';
  };

  const applyFilters = () => {
    let list = allListings.slice();
    const type = activeType();
    if (type && type !== 'all') {
      list = list.filter(l => safeText(l.property_type).toLowerCase().includes(type.toLowerCase()));
    }
    const locSel = document.getElementById('filter-location');
    const loc = locSel && locSel.value ? locSel.value.trim() : '';
    if (loc) {
      list = list.filter(l =>
        safeText(l.location).toLowerCase().includes(loc.toLowerCase()) ||
        safeText(l.location_area).toLowerCase().includes(loc.toLowerCase())
      );
    }
    const budgetSel = document.getElementById('filter-budget');
    const budget = budgetSel && budgetSel.value ? budgetSel.value : '';
    if (budget) {
      list = list.filter(l => {
        const p = Number(l.price_jod_raw);
        if (!Number.isFinite(p)) return false;
        const isRent = /rent/i.test(safeText(l.transaction));
        const isSale = /sale/i.test(safeText(l.transaction));
        switch (budget) {
          case 'rent-under-15k': return isRent && p < 15000;
          case 'rent-15-30k': return isRent && p >= 15000 && p <= 30000;
          case 'rent-30k-plus': return isRent && p > 30000;
          case 'sale-under-400k': return isSale && p < 400000;
          case 'sale-400-800k': return isSale && p >= 400000 && p <= 800000;
          case 'sale-800k-plus': return isSale && p > 800000;
          default: return true;
        }
      });
    }
    renderListings(list);
  };

  const populateLocations = listings => {
    const sel = document.getElementById('filter-location');
    if (!sel) return;
    const locs = [...new Set(listings.map(l => safeText(l.location).trim()).filter(Boolean))].sort();
    const current = sel.value;
    sel.innerHTML = '<option value="">All Locations</option>';
    locs.forEach(loc => {
      const opt = document.createElement('option');
      opt.value = loc;
      opt.textContent = loc;
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  };

  if (grid) {
    fetch('/data/lumina-demo-leads.json')
      .then(response => {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(data => {
        if (!Array.isArray(data)) throw new Error('Data is not an array');
        allListings = data;
        populateLocations(data);
        applyFilters();
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

  const locSel = document.getElementById('filter-location');
  if (locSel) locSel.addEventListener('change', applyFilters);
  const budgetSel = document.getElementById('filter-budget');
  if (budgetSel) budgetSel.addEventListener('change', applyFilters);
})();
