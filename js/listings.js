// LUMINA — listings.js
// Fetches and renders property listing cards from the JSON data feed.

(function () {
  'use strict';

  const grid = document.getElementById('listings-grid');
  const count = document.getElementById('listing-count');
  const placeholderImage = '/assets/images/hero-luxury-villa.jpg';
  const whatsappNumber = (window.LuminaConfig && window.LuminaConfig.whatsapp) || '962000000000';

  const formatPrice = value => {
    const amount = Number(value);
    return Number.isFinite(amount) ? `${amount.toLocaleString('en-US')} JOD` : 'Price on request';
  };

  const safeText = value => (value === null || value === undefined) ? '' : String(value);

  const imagePath = value => {
    const src = safeText(value).trim();
    return src || placeholderImage;
  };

  const sourceUrl = value => {
    const url = safeText(value).trim();
    return (url.startsWith('https://') || url.startsWith('http://')) ? url : '#';
  };

  const whatsappUrl = message => `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

  const listingMessage = listing => [
    'Hello, I came across this property on Lumina and it caught my attention:',
    '',
    safeText(listing.title),
    safeText(listing.location_area),
    '',
    'Is it still available? I would like to know more.'
  ].join('\n');

  const viewingMessage = listing => [
    'Hello, I would like to schedule a viewing for:',
    '',
    safeText(listing.title),
    safeText(listing.location_area),
    '',
    'Please contact me.'
  ].join('\n');

  const trackWhatsAppClick = listing => {
    console.log('WhatsApp intent:', { listing_id: listing.id, page_type: 'listings' });
  };

  const createWhatsAppButton = (listing, label, message, className) => {
    const button = document.createElement('a');
    button.href = whatsappUrl(message);
    button.className = `listing-whatsapp ${className}`;
    button.target = '_blank';
    button.rel = 'noopener noreferrer';
    button.textContent = label;
    button.addEventListener('click', () => trackWhatsAppClick(listing));
    return button;
  };

  const createListingCard = (listing, index) => {
    const card = document.createElement('div');
    card.className = `listing-card property-card demo-card delay-${index % 10}`;

    const imageWrap = document.createElement('div');
    imageWrap.className = 'card-img listing-image';

    const img = document.createElement('img');
    img.src = imagePath(listing.image_url);
    img.alt = `${safeText(listing.title) || 'Lumina demo listing'} — ${safeText(listing.location_area) || 'Jordan'}`;
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      if (img.src !== new URL(placeholderImage, window.location.origin).href) img.src = placeholderImage;
    }, { once: true });

    const badge = document.createElement('span');
    badge.className = 'card-badge';
    badge.textContent = 'Demo Lead';

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
    price.textContent = formatPrice(listing.price_jod_test_margin);

    const details = document.createElement('p');
    details.className = 'details';
    const detailParts = [];
    if (listing.bedrooms) detailParts.push(`${safeText(listing.bedrooms)} Beds`);
    if (listing.size_sqm) detailParts.push(`${Number(listing.size_sqm).toLocaleString('en-US')} sqm`);
    details.textContent = detailParts.join(' · ');

    const link = document.createElement('a');
    link.href = sourceUrl(listing.source_url);
    link.className = 'card-link';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'View Source';

    const propertyLink = document.createElement('a');
    propertyLink.href = `property-details.html?id=${encodeURIComponent(safeText(listing.id))}`;
    propertyLink.className = 'listing-whatsapp listing-whatsapp-secondary';
    propertyLink.textContent = 'View Property';

    const actions = document.createElement('div');
    actions.className = 'listing-actions';
    actions.append(
      createWhatsAppButton(listing, 'Request Details', listingMessage(listing), 'listing-whatsapp-primary'),
      createWhatsAppButton(listing, 'Schedule Viewing', viewingMessage(listing), 'listing-whatsapp-secondary'),
      propertyLink,
      link
    );

    const status = document.createElement('p');
    status.className = 'status';
    status.textContent = 'Demo Listing — Verification Required';

    content.append(title, location, price);
    if (detailParts.length) content.appendChild(details);
    content.append(actions, status);
    card.append(imageWrap, content);
    return card;
  };

  const renderListings = listings => {
    try {
      grid.replaceChildren(...listings.map(createListingCard));
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
    message.textContent = 'Demo listings are temporarily unavailable. Please try again later.';
    grid.replaceChildren(message);
    if (count) count.textContent = '0';
  };

  if (grid) {
    fetch('/data/lumina-demo-leads.json')
      .then(response => {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(data => {
        if (!Array.isArray(data)) throw new Error('Data is not an array');
        renderListings(data);
      })
      .catch(err => showFallback(err.message));
  } else {
    console.error('Lumina: listings-grid element not found in DOM');
  }

  document.querySelectorAll('.type-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.type-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    });
  });
})();
