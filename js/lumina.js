(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine   = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  document.getElementById('yr').textContent = new Date().getFullYear();

  /* ── boot ─────────────────────────────────────────────── */
  const boot = $('#boot');
  const lift = () => setTimeout(() => boot.classList.add('done'), 240);
  window.addEventListener('load', lift);
  setTimeout(lift, 2200);              // never hold the page hostage

  /* ── cursor parallax + light follower ─────────────────── */
  const glow = $('#glow');
  let tx = 0, ty = 0, cx = 0, cy = 0, gx = 0, gy = 0, moved = false;

  if (fine && !reduce) {
    /* Claim ownership of --px/--py. property-card.js installs its own
       pointer loop on pages without this file, and must not double up
       here. */
    (window.Lumina = window.Lumina || {}).parallax = true;
    addEventListener('pointermove', e => {
      tx = (e.clientX / innerWidth  - .5) * 2;
      ty = (e.clientY / innerHeight - .5) * 2;
      gx = e.clientX; gy = e.clientY;
      if (!moved) { moved = true; glow.classList.add('on'); }
    }, { passive: true });

    let glowX = 0, glowY = 0;
    (function loop() {
      cx += (tx - cx) * .06;  cy += (ty - cy) * .06;
      glowX += (gx - glowX) * .1; glowY += (gy - glowY) * .1;
      document.documentElement.style.setProperty('--px', cx.toFixed(4));
      document.documentElement.style.setProperty('--py', cy.toFixed(4));
      glow.style.transform = `translate3d(${glowX.toFixed(1)}px,${glowY.toFixed(1)}px,0)`;
      requestAnimationFrame(loop);
    })();
  }

  /* ── reveal on scroll ─────────────────────────────────── */
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: .12 });
  const observeReveals = () => $$('.rv').forEach(el => {
    if (!el.classList.contains('in')) io.observe(el);
  });
  observeReveals();

  /* Public hook. home-collection.js injects its cards after its JSON
     resolves, i.e. long after this ran, and already looks for this —
     without it the cards were being force-marked 'in' and skipped the
     reveal every other section gets. */
  const Lumina = window.Lumina = window.Lumina || {};
  Lumina.refreshReveals = observeReveals;

  /* ── per-line headline reveal ──────────────────────────── */
  /* Splits h1.display/h2.display into per-line spans so each line can
     rise from 110% with a dissolving blur, staggered by --lnd. Line
     breaks are layout-dependent, so this re-runs (debounced) on resize;
     an already-revealed headline is marked 'in' immediately, with no
     replay, since the DOM swap happens before the next paint. */
  const headlines = $$('h1.display, h2.display, .hero-title');
  if (!reduce && headlines.length) {
    /* Observe the (untransformed) .ln-wrap, not the .ln itself — the line
       span is deliberately transformed outside its wrapper's clipped box
       pre-reveal, so its own clipped intersection area is always zero and
       it would never be seen as intersecting. */
    const lineIO = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.querySelector('.ln').classList.add('in');
          lineIO.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: .12 });

    const splitLines = h => {
      const text = h.dataset.lnText || (h.dataset.lnText = h.textContent.trim());
      const measure = document.createElement('span');
      const words = text.split(/\s+/);
      words.forEach((w, i) => {
        const wd = document.createElement('span');
        wd.style.display = 'inline-block';
        wd.textContent = w;
        measure.appendChild(wd);
        if (i < words.length - 1) measure.appendChild(document.createTextNode(' '));
      });
      h.innerHTML = '';
      h.appendChild(measure);

      const lines = [];
      let lastTop = null;
      $$('span', measure).forEach(wd => {
        const top = wd.offsetTop;
        if (top !== lastTop) { lines.push([]); lastTop = top; }
        lines[lines.length - 1].push(wd.textContent);
      });

      h.innerHTML = '';
      lines.forEach((words, i) => {
        const wrap = document.createElement('span');
        wrap.className = 'ln-wrap';
        const ln = document.createElement('span');
        ln.className = 'ln';
        ln.style.setProperty('--lnd', (i * 90) + 'ms');
        ln.textContent = words.join(' ');
        wrap.appendChild(ln);
        h.appendChild(wrap);
        if (i < lines.length - 1) h.appendChild(document.createTextNode(' '));
        lineIO.observe(wrap);
      });
    };

    headlines.forEach(splitLines);

    let rTimer;
    addEventListener('resize', () => {
      clearTimeout(rTimer);
      rTimer = setTimeout(() => {
        headlines.forEach(h => {
          const wasRevealed = h.querySelector('.ln')?.classList.contains('in') ?? false;
          splitLines(h);
          if (wasRevealed) $$('.ln', h).forEach(l => l.classList.add('in'));
        });
      }, 200);
    }, { passive: true });
  }

  /* ── brand bar condense ───────────────────────────────── */
  const bar = $('#bar');
  const onScrollBar = () => bar.classList.toggle('stuck', scrollY > 40);
  onScrollBar();

  /* ── spine: progress + active section ─────────────────── */
  const fill  = $('#fill');
  const dots  = $$('#spine button');
  const secs  = dots.map(b => document.getElementById(b.dataset.to)).filter(Boolean);

  dots.forEach(b => b.addEventListener('click', () => {
    document.getElementById(b.dataset.to)
      ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }));

  const onScrollSpine = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const n = max > 0 ? clamp(scrollY / max, 0, 1) : 0;
    /* Two properties for one number, deliberately. css/elevated.css scales
       the rail with --prog-n rather than resizing it — a height re-resolved
       every frame the page moves is the one thing this site's rules forbid.
       index.html and invest.html still carry their own inline copies of the
       spine reading --prog as a percentage, so it keeps being written until
       they are converted too. */
    fill.style.setProperty('--prog', (n * 100) + '%');
    fill.style.setProperty('--prog-n', n.toFixed(4));
    const mid = scrollY + innerHeight * .42;
    let active = 0;
    secs.forEach((s, i) => { if (s.offsetTop <= mid) active = i; });
    dots.forEach((d, i) => d.setAttribute('aria-current', i === active ? 'true' : 'false'));
  };

  /* ── background parallax on the villa band ────────────── */
  /* The image is CSS-scaled to 1.18, leaving 9% overflow top and bottom, so a
     ±7% translate can never expose an edge. It drifts down as the page scrolls
     up, which reads as the background moving slower than the foreground. */
  const plx = $$('[data-plx]');
  const onScrollPlx = () => {
    if (reduce) return;
    plx.forEach(img => {
      const host = img.closest('section');
      if (!host) return;
      const r = host.getBoundingClientRect();
      if (r.bottom < -120 || r.top > innerHeight + 120) return;
      const p = clamp((innerHeight / 2 - (r.top + r.height / 2)) / ((innerHeight + r.height) / 2), -1, 1);
      img.style.transform = `translate3d(0,${(p * 7).toFixed(2)}%,0) scale(1.18)`;
    });
  };

  /* ── aperture bridge: clip-path reveal across the pinned scroll range ──
     Shut at the top and bottom of the pin, fully open across the middle,
     scaled by the section's own --ap-max.

     A bare triangle wave (apMax * |2p - 1|) hit 0% at exactly one value of
     p, so across three viewports of scrolling the film was genuinely open
     for a single frame — a shutter that flickers rather than opens. The
     0.22 deadband gives the wave a plateau: |2p - 1| below it reads as
     fully open, which holds the frame clear for the middle ~22% of the
     pin. Everything is still a pure function of p, so scrubbing back is
     exact and nothing holds a timer.

     --fi is the copy's own 0-1 envelope, ramping up as the shutter opens
     and down as it closes, so the words and the frame are one moment
     rather than two. index.html's .film-inner is what consumes it. */
  const aperture = $('#film');
  const apMax = aperture ? parseFloat(getComputedStyle(aperture).getPropertyValue('--ap-max')) || 42 : 42;
  const onScrollAperture = () => {
    if (!aperture || reduce) return;
    const r = aperture.getBoundingClientRect();
    const total = r.height - innerHeight;
    const p = total > 0 ? clamp(-r.top / total, 0, 1) : 0;
    const w = Math.abs(2 * p - 1);
    aperture.style.setProperty('--ap', (apMax * clamp((w - .22) / .78, 0, 1)).toFixed(2) + '%');
    aperture.style.setProperty('--fi',
      Math.min(clamp((p - .28) / .14, 0, 1), clamp((.72 - p) / .14, 0, 1)).toFixed(3));
  };

  /* ── the hero's call to action ──────────────────────────────
     Held back until the reader scrolls once, then popped up from
     below. An offer made after somebody has shown a flicker of
     interest reads as an offer; the same offer made at t=0, before
     they have looked at anything, reads as a banner — and it was
     competing with the headline's own per-line rise for the same half
     second.

     `armed` is set HERE rather than in the markup, so with this file
     blocked the button is simply visible at rest. The primary call to
     action is the last thing on the page that should need JavaScript.

     Runs once and then costs a boolean per frame. */
  const cta = $('#heroCta');
  if (cta) cta.classList.add('armed');
  let ctaUp = false;
  const onScrollCta = () => {
    if (ctaUp || !cta) return;
    /* TWO conditions, and it needs both.

       They scrolled — about one wheel notch on a laptop and comfortably
       less than a phone flick. Capped rather than a pure fraction of
       the viewport, because the threshold means "they engaged", not
       "they reached a position". */
    if (scrollY < Math.min(110, innerHeight * 0.13)) return;
    /* AND it is on screen. The hero runs taller than the fold on a
       laptop — measured at 1440x900 the button sits 1178px down — so
       the scroll threshold alone fired the pop below the fold and the
       reader arrived to find it already landed. An entrance nobody
       sees is not an entrance. */
    if (cta.getBoundingClientRect().top > innerHeight - 24) return;
    ctaUp = true;
    cta.classList.add('up');
  };

  /* ── the showroom pill on a phone ───────────────────────────
     On a phone the hero's glass panels stack down the page and the
     fixed pill sits on top of them for the whole of that scroll — it
     was landing on the quiz card's own control. It tucks away until
     the reader is past the hero. On desktop the hero is a wide grid
     and the pill sits in dead space, so this leaves it alone.

     .tuck is added HERE and not in the markup: with the script blocked
     the pill has to be visible, not permanently hidden off screen. */
  const fabEl = $('.fab');
  const heroEl = $('#hero');
  const phone = matchMedia('(max-width: 860px)');
  const onScrollFab = () => {
    if (!fabEl || !heroEl) return;
    if (!phone.matches) { fabEl.classList.remove('tuck'); return; }
    fabEl.classList.toggle('tuck',
      heroEl.getBoundingClientRect().bottom > innerHeight * 0.5);
  };
  /* crossing the breakpoint mid-session has to re-decide it */
  if (fabEl && heroEl && phone.addEventListener) phone.addEventListener('change', onScrollFab);

  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      onScrollBar(); onScrollSpine(); onScrollPlx(); onScrollAperture();
      onScrollCta(); onScrollFab();
      ticking = false;
    });
  }, { passive: true });
  onScrollSpine(); onScrollPlx(); onScrollAperture(); onScrollFab();
  /* If the page is restored mid-scroll — a refresh, a back button, a
     deep link — the hero is already gone and there is nothing to wait
     for. */
  onScrollCta();

  /* ── card tilt + tracking specular ────────────────────── */
  /* Exposed as a public hook: the collection cards are injected after
     their JSON resolves, long after this file runs, so they were never
     picked up by the one-shot pass this used to be. Marks what it has
     already bound so a re-scan can't stack a second set of listeners. */
  const bindTilt = (scope = document) => {
    if (!fine || reduce) return;
    $$('.tilt', scope).forEach(card => {
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
  bindTilt();
  Lumina.bindTilt = bindTilt;

  if (fine && !reduce) {
    /* ── magnetic buttons ───────────────────────────────── */
    $$('.mag').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        el.style.transform = `translate(${(dx * 7).toFixed(1)}px,${(dy * 5 - 2).toFixed(1)}px)`;
      }, { passive: true });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ── film band: play only while visible, draw loop progress ── */
  const band = $('#bandFilm'), prog = $('#filmProg');
  if (band) {
    const vis = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { band.preload = 'auto'; band.play?.().catch(() => {}); }
      else band.pause?.();
    }), { threshold: .18 });
    vis.observe(band);

    let pRaf = null;
    const draw = () => {
      if (band.duration) prog.style.width = (band.currentTime / band.duration * 100) + '%';
      pRaf = requestAnimationFrame(draw);
    };
    band.addEventListener('play',  () => { if (!pRaf) draw(); });
    band.addEventListener('pause', () => { cancelAnimationFrame(pRaf); pRaf = null; });
  }

  /* ── deep-link landing ────────────────────────────────────
     Arriving at index.html#hoods from another page used to land at the
     top of the document. Two causes, compounding: the collection grid
     is injected asynchronously and adds ~1800px *below* the fragment
     target, so the browser's own scroll resolves against a document
     that is still short; and `scroll-behavior: smooth` turns that into
     an animation which the subsequent layout shift cancels outright.
     Re-seat the target once the page has actually settled, without
     animating — a deep link should arrive, not scroll. */
  const landOnHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    const root = document.documentElement;
    const prev = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    target.scrollIntoView({ block: 'start' });
    root.style.scrollBehavior = prev;
  };

  if (location.hash) {
    addEventListener('load', landOnHash);
    /* The grid resolves on its own schedule; re-seat when it lands,
       then stop watching. Capped so a failed fetch can't leave this
       observer running for the life of the page. */
    const grid = $('#home-collection-grid');
    if (grid) {
      const mo = new MutationObserver(() => { landOnHash(); mo.disconnect(); });
      mo.observe(grid, { childList: true });
      setTimeout(() => mo.disconnect(), 6000);
    }
  }

  /* ── contact form → prefilled WhatsApp ────────────────── */
  $('#send')?.addEventListener('click', () => {
    const name   = $('#f-name').value.trim();
    const hood   = $('#f-hood').value;
    const budget = $('#f-budget').value;
    const note   = $('#f-note').value.trim();
    const msg =
      `Hello Lumina — ${name || 'enquiry'} here.\n` +
      `District: ${hood}\nBudget: ${budget}` +
      (note ? `\nNotes: ${note}` : '') +
      `\n\nCould you send the current collection?`;
    open('https://wa.me/962771505250?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  });
})();