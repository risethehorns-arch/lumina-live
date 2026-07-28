// LUMINA — property details
// Minimal detail view + swipeable photo gallery

(function () {
  'use strict';

  const root = document.getElementById('property-root');
  if (!root) return;

  const PLACEHOLDER = '/assets/images/hero-luxury-villa.jpg';
  const WHATSAPP = (window.LuminaConfig && window.LuminaConfig.whatsapp) || '962771505250';

  const t = v => (v == null ? '' : String(v));
  const money = v => {
    const n = Number(v);
    return Number.isFinite(n) ? `${n.toLocaleString('en-US')} JOD` : 'Price on request';
  };
  const img = v => {
    const s = t(v).trim();
    return s || PLACEHOLDER;
  };

  const waLink = listing => {
    const msg = [
      'Hello Lumina — I’m interested in this property:',
      '',
      t(listing.title),
      listing.ref ? `Ref: ${listing.ref}` : null,
      t(listing.location_area || listing.location),
      '',
      'Please share more details.',
    ].filter(Boolean).join('\n');
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
  };

  const showNotFound = () => {
    root.innerHTML = `
      <div class="pd-empty">
        <div>
          <h1>Property not found</h1>
          <p>This listing may have been moved or is no longer available.</p>
          <a href="listings.html">← Back to properties</a>
        </div>
      </div>`;
  };

  /** Build swipeable gallery */
  const buildGallery = (images, title) => {
    const gallery = document.createElement('section');
    gallery.className = 'pd-gallery';
    gallery.setAttribute('aria-label', 'Property photos');

    const viewport = document.createElement('div');
    viewport.className = 'pd-viewport';
    viewport.setAttribute('role', 'region');
    viewport.setAttribute('aria-roledescription', 'carousel');

    const track = document.createElement('div');
    track.className = 'pd-track';

    images.forEach((src, i) => {
      const slide = document.createElement('div');
      slide.className = 'pd-slide';
      slide.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');
      const el = document.createElement('img');
      el.src = src;
      el.alt = `${title} — photo ${i + 1} of ${images.length}`;
      el.loading = i === 0 ? 'eager' : 'lazy';
      el.decoding = 'async';
      el.addEventListener('error', () => { el.src = PLACEHOLDER; }, { once: true });
      slide.appendChild(el);
      track.appendChild(slide);
    });

    viewport.appendChild(track);

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'pd-nav pd-nav--prev';
    prev.setAttribute('aria-label', 'Previous photo');
    prev.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 6 9 12l6 6"/></svg>';

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'pd-nav pd-nav--next';
    next.setAttribute('aria-label', 'Next photo');
    next.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 6 6 6-6 6"/></svg>';

    const chrome = document.createElement('div');
    chrome.className = 'pd-chrome';
    const counter = document.createElement('span');
    counter.className = 'pd-counter';
    counter.textContent = `1 / ${images.length}`;
    const dots = document.createElement('div');
    dots.className = 'pd-dots';
    images.forEach((_, i) => {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'pd-dot';
      d.setAttribute('aria-label', `Go to photo ${i + 1}`);
      if (i === 0) d.setAttribute('aria-current', 'true');
      dots.appendChild(d);
    });
    chrome.append(counter, dots);

    gallery.append(viewport, prev, next, chrome);

    // thumbs (only if more than 1)
    let thumbs = null;
    if (images.length > 1) {
      thumbs = document.createElement('div');
      thumbs.className = 'pd-thumbs';
      thumbs.setAttribute('aria-label', 'Photo thumbnails');
      images.forEach((src, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pd-thumb';
        b.setAttribute('aria-label', `Photo ${i + 1}`);
        if (i === 0) b.setAttribute('aria-current', 'true');
        const im = document.createElement('img');
        im.src = src;
        im.alt = '';
        im.loading = 'lazy';
        b.appendChild(im);
        thumbs.appendChild(b);
      });
      gallery.appendChild(thumbs);
    }

    // state + interactions
    let index = 0;
    let dragX = 0;
    let startX = 0;
    let startY = 0;
    let dragging = false;
    let locked = null; // 'x' | 'y' | null
    const n = images.length;

    const go = (i, { animate = true } = {}) => {
      if (n === 0) return;
      index = ((i % n) + n) % n;
      if (!animate) track.classList.add('no-anim');
      track.style.transform = `translate3d(calc(${-index * 100}% + ${dragX}px),0,0)`;
      if (!animate) {
        // force reflow then re-enable
        void track.offsetWidth;
        track.classList.remove('no-anim');
      }
      counter.textContent = `${index + 1} / ${n}`;
      prev.disabled = n <= 1;
      next.disabled = n <= 1;
      [...dots.children].forEach((d, di) => {
        if (di === index) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
      if (thumbs) {
        [...thumbs.children].forEach((th, ti) => {
          if (ti === index) {
            th.setAttribute('aria-current', 'true');
            th.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
          } else th.removeAttribute('aria-current');
        });
      }
      [...track.children].forEach((slide, si) => {
        slide.setAttribute('aria-hidden', si === index ? 'false' : 'true');
      });
    };

    prev.addEventListener('click', () => go(index - 1));
    next.addEventListener('click', () => go(index + 1));
    [...dots.children].forEach((d, i) => d.addEventListener('click', () => go(i)));
    if (thumbs) {
      [...thumbs.children].forEach((th, i) => th.addEventListener('click', () => go(i)));
    }

    // keyboard
    viewport.tabIndex = 0;
    viewport.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    });

    // pointer / touch swipe
    const onDown = e => {
      if (n <= 1) return;
      dragging = true;
      locked = null;
      viewport.classList.add('is-dragging');
      track.classList.add('no-anim');
      const pt = e.touches ? e.touches[0] : e;
      startX = pt.clientX;
      startY = pt.clientY;
      dragX = 0;
    };

    const onMove = e => {
      if (!dragging) return;
      const pt = e.touches ? e.touches[0] : e;
      const dx = pt.clientX - startX;
      const dy = pt.clientY - startY;
      if (locked == null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if (locked === 'y') return; // allow page scroll
      if (locked === 'x') {
        if (e.cancelable) e.preventDefault();
        // edge resistance
        const atStart = index === 0 && dx > 0;
        const atEnd = index === n - 1 && dx < 0;
        dragX = atStart || atEnd ? dx * 0.35 : dx;
        track.style.transform = `translate3d(calc(${-index * 100}% + ${dragX}px),0,0)`;
      }
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      viewport.classList.remove('is-dragging');
      track.classList.remove('no-anim');
      const threshold = Math.min(80, viewport.clientWidth * 0.18);
      if (locked === 'x') {
        if (dragX < -threshold) go(index + 1);
        else if (dragX > threshold) go(index - 1);
        else go(index);
      } else {
        go(index);
      }
      dragX = 0;
      locked = null;
    };

    viewport.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    // touch fallback for older browsers
    viewport.addEventListener('touchstart', onDown, { passive: true });
    viewport.addEventListener('touchmove', onMove, { passive: false });
    viewport.addEventListener('touchend', onUp);
    viewport.addEventListener('touchcancel', onUp);

    if (n <= 1) {
      prev.style.display = 'none';
      next.style.display = 'none';
      dots.style.display = 'none';
    }

    go(0, { animate: false });
    return gallery;
  };

  const chip = (label, value) => {
    if (value == null || value === '') return '';
    return `<li><b>${label}</b>${value}</li>`;
  };

  const metaRow = (label, value) => {
    if (value == null || value === '') return '';
    return `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  };

  const renderListing = listing => {
    document.title = `${t(listing.title)} — Lumina`;

    const gallery = Array.isArray(listing.images) && listing.images.length
      ? listing.images.map(img)
      : [img(listing.image_url)];

    const priceVal = listing.price_jod_test_margin != null
      ? listing.price_jod_test_margin
      : listing.price_jod_raw;
    const priceLabel = money(priceVal);
    const tx = t(listing.transaction);
    const priceLine = tx ? `${priceLabel} · ${tx}` : priceLabel;

    const specsHtml = [
      listing.size_sqm != null ? chip('Area', `${Number(listing.size_sqm).toLocaleString('en-US')} m²`) : '',
      listing.bedrooms != null ? chip('Beds', t(listing.bedrooms)) : '',
      listing.bathrooms != null ? chip('Baths', t(listing.bathrooms)) : '',
      listing.floor ? chip('Floor', t(listing.floor)) : '',
      listing.furnished ? chip('', t(listing.furnished)) : '',
    ].join('');

    const metaHtml = [
      metaRow('Reference', listing.ref ? t(listing.ref) : ''),
      metaRow('Type', t(listing.property_type)),
      metaRow('Outdoor', t(listing.outdoor)),
      metaRow('Cooling', t(listing.cooling)),
      metaRow('Kitchen', t(listing.kitchen)),
      metaRow('Status', t(listing.status)),
    ].join('');

    root.replaceChildren();

    const galleryEl = buildGallery(gallery, t(listing.title) || 'Property');
    root.appendChild(galleryEl);

    const body = document.createElement('div');
    body.className = 'pd-body';
    body.innerHTML = `
      <a class="pd-back" href="listings.html">← All properties</a>
      <p class="pd-kicker">${[
        listing.ref ? `Ref ${t(listing.ref)}` : null,
        t(listing.property_type) || null,
        t(listing.transaction) || null,
      ].filter(Boolean).join(' · ')}</p>
      <h1 class="pd-title">${t(listing.title) || 'Property'}</h1>
      <p class="pd-location">${t(listing.location_area || listing.location) || 'Amman'}</p>
      <p class="pd-price">${priceLine}</p>
      ${specsHtml ? `<ul class="pd-specs">${specsHtml}</ul>` : ''}
      ${t(listing.description) ? `
        <div class="pd-desc">
          <h2>About</h2>
          <p>${t(listing.description)}</p>
        </div>` : ''}
      ${metaHtml ? `<dl class="pd-meta">${metaHtml}</dl>` : ''}
    `;
    root.appendChild(body);

    const cta = document.createElement('div');
    cta.className = 'pd-cta';
    cta.innerHTML = `
      <a class="pd-cta-ghost" href="listings.html">Back</a>
      <a class="pd-cta-primary" href="${waLink(listing)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
    `;
    root.appendChild(cta);
  };

  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) {
    showNotFound();
    return;
  }

  fetch('/data/lumina-demo-leads.json')
    .then(r => (r.ok ? r.json() : Promise.reject()))
    .then(data => {
      const listing = Array.isArray(data) ? data.find(item => item.id === id) : null;
      if (listing) renderListing(listing);
      else showNotFound();
    })
    .catch(showNotFound);
})();
