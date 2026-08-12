// LUMINA — property viewer
// A semi-fullscreen gallery that hovers over the page. Opened from a
// collection card; driven entirely by the listing's own `images` array.
//
// Exposes window.Lumina.openViewer(listing). Kept out of
// home-collection.js so the listings page can reuse it later without
// dragging the home grid's rendering along with it.

(function () {
  'use strict';

  const PLACEHOLDER = 'assets/images/hero-luxury-villa.jpg';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* JSON stores paths root-absolute ("/assets/..."), which 404s under a
     sub-path deploy. Same normalisation home-collection.js applies. */
  const rel = p => {
    const s = String(p || '').trim();
    if (!s) return '';
    return s.startsWith('/') ? s.slice(1) : s;
  };

  const shotsOf = listing => {
    const list = Array.isArray(listing.images) ? listing.images.map(rel).filter(Boolean) : [];
    if (list.length) return list;
    const one = rel(listing.image_url);
    return one ? [one] : [PLACEHOLDER];
  };

  const svg = d =>
    `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

  const ICON_PREV  = 'M10 3 5 8l5 5';
  const ICON_NEXT  = 'M6 3l5 5-5 5';
  const ICON_CLOSE = 'M4 4l8 8M12 4l-8 8';

  /* ── one instance, reused ───────────────────────────────── */
  let root = null, els = null;
  let shots = [], index = 0, lastFocus = null, open = false;

  const build = () => {
    root = document.createElement('div');
    root.className = 'pv';
    root.hidden = true;
    root.innerHTML = `
      <button class="pv-scrim" type="button" tabindex="-1" aria-label="Close gallery"></button>
      <div class="pv-win" role="dialog" aria-modal="true" aria-label="Property gallery">
        <div class="pv-stage"></div>
        <div class="pv-head">
          <p class="kicker"></p>
          <h3 class="display"></h3>
        </div>
        <button class="pv-nav pv-prev" type="button" aria-label="Previous photo">${svg(ICON_PREV)}</button>
        <button class="pv-nav pv-next" type="button" aria-label="Next photo">${svg(ICON_NEXT)}</button>
        <button class="pv-x" type="button" aria-label="Close gallery">${svg(ICON_CLOSE)}</button>
        <div class="pv-foot">
          <div class="pv-info">
            <b></b>
            <div class="pv-links">
              <a class="pv-more" href="#">Full particulars <span aria-hidden="true">&rarr;</span></a>
              <a class="pv-more pv-ask" href="#" target="_blank" rel="noopener noreferrer" hidden>Ask about this <span aria-hidden="true">&rarr;</span></a>
              <button class="pv-more pv-share" type="button"
                      aria-label="Share this property" title="Share this property">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
                     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M21.5 2.5 10.8 13.2"/>
                  <path d="M21.5 2.5 14.8 21.5 10.8 13.2 2.5 9.2Z"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="pv-strip"><div class="pv-track"></div></div>
          <span class="pv-count" aria-live="polite"></span>
        </div>
      </div>`;
    document.body.appendChild(root);

    els = {
      scrim: root.querySelector('.pv-scrim'),
      win:   root.querySelector('.pv-win'),
      stage: root.querySelector('.pv-stage'),
      kicker: root.querySelector('.pv-head .kicker'),
      title: root.querySelector('.pv-head h3'),
      prev:  root.querySelector('.pv-prev'),
      next:  root.querySelector('.pv-next'),
      close: root.querySelector('.pv-x'),
      price: root.querySelector('.pv-info b'),
      more:  root.querySelector('.pv-more'),
      ask:   root.querySelector('.pv-ask'),
      share: root.querySelector('.pv-share'),
      strip: root.querySelector('.pv-strip'),
      track: root.querySelector('.pv-track'),
      count: root.querySelector('.pv-count'),
    };

    els.scrim.addEventListener('click', close);
    els.close.addEventListener('click', close);
    els.prev.addEventListener('click', () => step(-1));
    els.next.addEventListener('click', () => step(1));

    /* Swipe. Touch is the one input where edge arrows are awkward to
       reach, so the stage itself has to answer. */
    let sx = 0, sy = 0, tracking = false;
    els.stage.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      sx = e.clientX; sy = e.clientY; tracking = true;
    }, { passive: true });
    els.stage.addEventListener('pointerup', e => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(e.clientY - sy)) step(dx < 0 ? 1 : -1);
    }, { passive: true });

    addEventListener('keydown', e => {
      if (!open) return;
      if (e.key === 'Escape')     { e.preventDefault(); close(); }
      else if (e.key === 'ArrowLeft')  { e.preventDefault(); step(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'Tab')   trapTab(e);
    });
  };

  /* Focus stays inside the dialog while it owns the screen. */
  const trapTab = e => {
    const f = [...els.win.querySelectorAll('button, a[href]')]
      .filter(el => !el.hidden && el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  /* Only shots near the current one get a src — a twelve-photo listing
     would otherwise pull every full-size image the moment the window
     opens. The rail is windowed too and for the same reason: there are
     no separate thumbnail files, so each 60×44 thumb is one of those
     same full-size photos. The mask fades everything past roughly the
     third neighbour, so a ±4 window is wider than the eye can see. */
  const near = (i, n, span) => Math.abs(i - index) <= span
    || Math.abs(i - index) >= n - span;   // wrap-around

  const hydrate = () => {
    const layers = els.stage.querySelectorAll('.pv-shot');
    layers.forEach((img, i) => {
      if (!img.src && near(i, layers.length, 1)) img.src = img.dataset.src;
    });
    const thumbs = els.track.children;
    for (let i = 0; i < thumbs.length; i++) {
      const t = thumbs[i].firstElementChild;
      if (t && !t.src && near(i, thumbs.length, 4)) t.src = t.dataset.src;
    }
  };

  const centreStrip = () => {
    const thumb = els.track.children[index];
    if (!thumb) return;
    const offset = els.strip.clientWidth / 2 - (thumb.offsetLeft + thumb.offsetWidth / 2);
    els.track.style.transform = `translate3d(${offset.toFixed(1)}px,0,0)`;
  };

  const show = i => {
    index = (i + shots.length) % shots.length;
    hydrate();
    els.stage.querySelectorAll('.pv-shot').forEach((img, n) => img.classList.toggle('on', n === index));
    [...els.track.children].forEach((t, n) => {
      t.classList.toggle('on', n === index);
      t.setAttribute('aria-current', n === index ? 'true' : 'false');
    });
    els.count.textContent = `${index + 1} / ${shots.length}`;
    centreStrip();
  };

  const step = d => { if (shots.length > 1) show(index + d); };

  function close() {
    if (!open) return;
    open = false;
    root.classList.remove('open');
    document.documentElement.classList.remove('pv-lock');
    lastFocus?.focus?.();
    /* Wait out the fade before pulling it from the a11y tree, otherwise
       the exit transition never gets to run. */
    setTimeout(() => { if (!open) root.hidden = true; }, reduce ? 0 : 460);
  }

  /* ── sharing the property you are looking at ────────────────
     The link points at listings.html?property=<id>, NOT at
     property-details.html. That is the whole point: whoever opens it
     should land in this same gallery, not on a different page — so
     the thing they were sent is the thing they see.

     listings.html is the target because it is the only page that
     carries the full book AND this viewer. The home grid holds eight
     properties and the area pages hold one district each, so a link
     built from either would break for anything outside them.

     One button, two behaviours, chosen by what the browser has:
       - navigator.share  → the OS sheet, which on a phone is WhatsApp,
         Messages and AirDrop in one tap and carries a Copy option of
         its own.
       - clipboard        → desktop. Copies and says so, because a copy
         that reports nothing reads as a copy that failed.
     Neither: select the URL in a temporary input so it can still be
     copied by hand. */
  let shareReset = null;
  let shareToast = null;

  const shareSay = word => {
    if (!shareToast) {
      shareToast = document.createElement('div');
      shareToast.className = 'pv-toast';
      shareToast.setAttribute('role', 'status');
      document.body.appendChild(shareToast);
    }
    shareToast.textContent = word;
    void shareToast.offsetWidth;   /* real start value for the fade */
    shareToast.dataset.on = '1';
    if (els.share) els.share.dataset.done = '1';
    clearTimeout(shareReset);
    shareReset = setTimeout(() => {
      shareToast.removeAttribute('data-on');
      if (els.share) els.share.removeAttribute('data-done');
    }, 2000);
  };

  const shareFor = listing => {
    if (!els.share) return;
    /* p/<id>.html, not listings.html?property=<id> — and the destination has
       not changed, only the address handed out. That card redirects here.

       WhatsApp, iMessage and Slack build their preview from Open Graph tags in
       the STATIC html at whatever URL they are given, and never run the script
       that fetches this property. Given the gallery link they read
       listings.html's own tags, so every property in the book previewed as the
       same generic villa — which is what a recipient judges the message by.
       A query string cannot change static html and there is no server here to
       change it on, so the tags have to live in a file of their own.

       Generated by scripts/build-share-cards.py; regenerate after any change to
       data/lumina-demo-leads.json or a card outlives its property. */
    const url = new URL(
      'p/' + encodeURIComponent(listing.id) + '.html',
      location.href
    ).href;
    const title = String(listing.title || 'Property').trim();
    const where = String(listing.location || listing.location_area || 'Amman').trim();

    /* Replace rather than add: openViewer runs again for every
       property, and stacking listeners would fire the old property's
       share alongside the new one. */
    els.share.onclick = () => {
      if (navigator.share) {
        navigator.share({
          title: title + ' — Lumina',
          text: [title, where].filter(Boolean).join(' · '),
          url: url,
        }).catch(() => {});          /* cancelling is not an error */
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(
          () => shareSay('Link copied'), () => shareFallback(url));
      } else {
        shareFallback(url);
      }
    };
  };

  const shareFallback = url => {
    const box = document.createElement('input');
    box.value = url;
    box.setAttribute('readonly', '');
    box.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'z-index:200;width:min(420px,86vw);padding:12px;font:inherit;';
    document.body.appendChild(box);
    box.select();
    try { document.execCommand('copy'); shareSay('Link copied'); }
    catch (e) { shareSay('Copy the link'); }
    setTimeout(() => box.remove(), 2400);
  };

  const openViewer = listing => {
    if (!listing) return;
    if (!root) build();

    shots = shotsOf(listing);
    index = 0;
    lastFocus = document.activeElement;

    const where = listing.location || listing.location_area || 'Amman';
    const bits = [listing.ref ? `Ref ${listing.ref}` : null, where, listing.property_type]
      .filter(Boolean);
    els.kicker.textContent = bits.join(' · ');
    els.title.textContent = listing.title || 'Residence';

    /* property-card.js owns the formatting, including the per-m² rates
       — one implementation, so the card and the gallery can never
       disagree about the same listing's price. */
    if (typeof Lumina.formatPrice === 'function') {
      els.price.textContent = Lumina.formatPrice(listing);
    } else {
      const raw = listing.price_jod_test_margin != null
        ? listing.price_jod_test_margin : listing.price_jod_raw;
      const amount = Number(raw);
      const tx = String(listing.transaction || '').trim();
      els.price.textContent = Number.isFinite(amount)
        ? `${amount.toLocaleString('en-US')} JOD${tx ? ' · ' + tx : ''}`
        : 'Price on request';
    }
    els.more.href = `property-details.html?id=${encodeURIComponent(listing.id)}`;

    /* Optional WhatsApp route. The listings page passes one so the
       enquiry path survives the card redesign; the home grid does not. */
    const ask = listing.__askUrl;
    els.ask.hidden = !ask;
    if (ask) els.ask.href = ask;

    shareFor(listing);

    /* Stage layers */
    els.stage.replaceChildren(...shots.map((src, i) => {
      const img = document.createElement('img');
      img.className = 'pv-shot';
      img.dataset.src = src;
      img.alt = `${listing.title || 'Property'} — photo ${i + 1} of ${shots.length}`;
      img.decoding = 'async';
      img.addEventListener('error', () => { img.src = PLACEHOLDER; }, { once: true });
      return img;
    }));

    /* Thumbnail rail */
    els.track.replaceChildren(...shots.map((src, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pv-thumb';
      b.setAttribute('aria-label', `Photo ${i + 1}`);
      const t = document.createElement('img');
      t.dataset.src = src;
      t.alt = '';
      t.decoding = 'async';
      t.addEventListener('error', () => { t.src = PLACEHOLDER; }, { once: true });
      b.appendChild(t);
      b.addEventListener('click', () => show(i));
      return b;
    }));

    const solo = shots.length < 2;
    els.prev.hidden = els.next.hidden = solo;
    els.strip.style.display = solo ? 'none' : '';
    els.count.style.display = solo ? 'none' : '';

    /* Lock the page behind it. Reserving the scrollbar's width keeps the
       fixed brand bar from sliding sideways as the page loses its bar. */
    const sbw = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.setProperty('--sbw', sbw + 'px');
    document.documentElement.classList.add('pv-lock');

    root.hidden = false;
    open = true;
    /* Force layout so the transition has a real start value to run from.
       A rAF pair reads more idiomatic but requestAnimationFrame is
       throttled to a standstill in a backgrounded tab, which left the
       window mounted-but-invisible; a synchronous reflow always runs. */
    void root.offsetWidth;
    root.classList.add('open');
    /* Only now are the strip's widths real. */
    show(0);
    els.close.focus({ preventScroll: true });
  };

  /* The strip is centred from measured geometry, so a resize invalidates it. */
  let rt = null;
  addEventListener('resize', () => {
    if (!open) return;
    clearTimeout(rt);
    rt = setTimeout(centreStrip, 120);
  }, { passive: true });

  const Lumina = window.Lumina = window.Lumina || {};
  Lumina.openViewer = openViewer;
})();
