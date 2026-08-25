/* The hero descent — a 217-frame scrub through cloud into the valley.
   ------------------------------------------------------------------
   Drives <canvas data-descent> from the scroll position of its section.
   The section is the runway; a sticky child is what stays on screen.

   WHY NO LIBRARY. The brief specified GSAP ScrollTrigger and Lenis. Neither
   is here and neither is needed: the pin is `position:sticky`, which is
   native, has no layout cost and reverses exactly; progress is one
   getBoundingClientRect; and this repo's CLAUDE.md permits no dependency but
   Lenis. A scrubber that is a pure function of scrollTop cannot desynchronise
   from the scrollbar, which is the failure mode every JS pin eventually has.

   WHY <img> AND NOT createImageBitmap. The brief asks for createImageBitmap so
   decode leaves the main thread. It does — but a decoded 1440x810 bitmap is
   4.7MB, and 217 of them is 1.01GB of retained memory. ImageBitmaps are not
   evictable; the browser cannot reclaim them under pressure and a phone dies.
   HTMLImageElement keeps the *compressed* bytes (3.58MB for the whole ladder)
   and lets the browser decode on demand and evict when it needs to. decode()
   is awaited on EVERY frame before it is eligible to be drawn, which buys the
   same off-thread decode without the retained memory. Sequential access is the
   friendliest possible pattern for that cache, and this only ever moves one
   frame at a time.

   WHY ONE RAF THAT STOPS. Scroll fires in bursts; a frame index taken straight
   off it steps unevenly on a trackpad. The loop lerps a held position toward
   the scroll target and stops the moment it arrives, so there is no permanent
   ticker — the same shape js/room-scrub.js uses for its own scrub.

   REDUCED MOTION IS A DIFFERENT PATH, NOT A DEGRADED ONE. Nothing here runs.
   The section collapses to one viewport, the sticky child unsticks, and the
   markup's own <img> shows frame 217 — the resting composition, the villa
   lit on its plinth. That is one 29KB request instead of 217.

   Frames are 1-based on disk, and are every SECOND source frame: 001.webp is
   master frame 0, 002.webp is master frame 2. The master is 452 frames and
   the runway is 220vh, so shipping all of them would be 4.4px of scroll per
   frame — twice the density the eye can use, for twice the bytes. See
   scripts/build-hero-frames.py. */
(() => {
  'use strict';

  const root = document.querySelector('[data-descent]');
  if (!root) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sec = root.closest('[data-descent-runway]') || root.parentElement;

  const TOTAL = 152;
  const EAGER = 44;      /* the whole above-the-cloud phase */
  const LANES = 6;

  /* Chosen once and never re-chosen. A mid-session resize that swapped
     ladders would re-download 217 files to change nothing a reader can see
     while the page is already moving under them. */
  /* 1920 is the master's own width — the rung is native, not a downscale.
     608x1080 is a native PORTRAIT centre crop, because a 16:9 frame
     cover-cropped into a 390x844 pin shows only the middle 26% of its width:
     the old 960 rung was stretching 250 source pixels across 1170 device
     pixels and discarding the rest of every file it downloaded. Same bytes,
     about 2.2x the effective resolution. See scripts/build-hero-frames.py. */
  const LADDER = innerWidth >= 760 ? 1920 : 608;
  const DIM = LADDER === 1920 ? [1920, 1080] : [608, 1080];
  const src = i => 'assets/hero/' + LADDER + '/' + String(i).padStart(3, '0') + '.webp';

  /* ── reduced motion: hand the page back and leave ──────────── */
  if (reduce) {
    root.remove();
    if (sec) sec.classList.add('descent-static');
    return;
  }

  /* Everything the stylesheet drives from --dp is gated behind this class.
     It is added HERE and not in the markup on purpose: with the script blocked
     the hero has to be a plain, fully legible block of type, and with reduced
     motion the function above has already returned. */
  const pin = sec.querySelector('.hero-pin') || sec;
  pin.classList.add('dp-live');

  const cv = root;
  cv.width = DIM[0];
  cv.height = DIM[1];
  const ctx = cv.getContext('2d', { alpha: false });

  const frames = new Array(TOTAL + 1);
  const ready = new Uint8Array(TOTAL + 1);
  let loadedLo = 0;          /* frames 1..loadedLo are contiguous and ready */

  /* Never draw a hole. Until the sequence has filled in, the nearest frame
     that HAS arrived is a better answer than a blank canvas — and because
     the eager block is the whole cloud phase, in practice this only ever
     resolves during the first moments of a cold load. */
  const nearest = i => {
    if (ready[i]) return i;
    for (let d = 1; d < TOTAL; d++) {
      if (i - d >= 1 && ready[i - d]) return i - d;
      if (i + d <= TOTAL && ready[i + d]) return i + d;
    }
    return 0;
  };

  let drawn = -1;
  const paint = idx => {
    const i = nearest(idx);
    if (!i || i === drawn) return;
    ctx.drawImage(frames[i], 0, 0, DIM[0], DIM[1]);
    drawn = i;
  };

  const load = (i, priority) => new Promise(res => {
    const img = new Image();
    img.decoding = 'async';
    if (priority) img.fetchPriority = priority;
    img.onload = () => {
      frames[i] = img;
      /* A frame counts as ready only once it has DECODED, not merely
         arrived. Marking it ready on load let the scrub reach a frame whose
         decode had not run yet, and drawImage then decoded it synchronously
         — one 59ms long task on a 4x-throttled CPU, against a budget of
         zero over 50ms. Holding it back means nearest() draws the closest
         decoded frame for a beat instead, which is invisible; a stall in
         the middle of the gesture is not. */
      (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => {
        ready[i] = 1;
        while (ready[loadedLo + 1]) loadedLo++;
        if (drawn < 0) paint(1);
        res();
      });
    };
    img.onerror = () => res();
    img.src = src(i);
  });

  /* A fixed number of lanes walking one shared cursor. Six is the brief's
     cap and also roughly what a browser will open per origin anyway. */
  const queue = (from, to, priority) => {
    let next = from;
    const lane = () => {
      if (next > to) return Promise.resolve();
      const i = next++;
      return load(i, priority).then(lane);
    };
    return Promise.all(Array.from({ length: Math.min(LANES, to - from + 1) }, lane));
  };

  /* ── progress ──────────────────────────────────────────────── */
  /* The section is longer than the fall — it also holds the arrival, which
     scrolls over a pin that is still stuck. So the scroll distance comes from
     the spacer, not from the section's own height. Without a spacer (the bare
     isolation page) it falls back to the section, which is the older shape. */
  const span = document.querySelector('[data-descent-span]');
  const arrival = document.querySelector('.ways');
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

  /* ── every read here, every write in commit(), never interleaved ──
     The previous shape wrote --dp and then called a getBoundingClientRect to
     work out the cover — which forces a synchronous layout, because the
     browser has to flush the style it was just handed before it can answer
     the read. Once per frame, for the whole of the descent. Batching the
     reads ahead of the writes is the no-layout-thrash rule, and it is the
     cheapest correctness fix in this file. */
  const measure = () => {
    const r = sec.getBoundingClientRect();
    const runway = span ? span.offsetHeight : sec.offsetHeight - innerHeight;
    return {
      p: runway > 0 ? clamp01(-r.top / runway) : 0,
      c: arrival ? clamp01(1 - arrival.getBoundingClientRect().top / innerHeight) : 0
    };
  };

  /* Written on the PIN. See the long note above .hero-pin in index.html:
     the section also contains the arrival, and a custom property written
     there re-styles four glass cards every frame. Writes are skipped when
     the value has not actually changed, which is what makes the tail of the
     arrival free. */
  let wroteP = '';
  let wroteC = '';
  /* NOTHING READS --dp THROUGH THE MIDDLE OF THE FALL, so it is not written
     there. The cue reads it below .08 and the arrival above .70; between those
     the lede, the cards and the CTA are all invisible and static, and the
     canvas never reads it at all — it is driven by the frame index.

     This matters because the four cards moved back inside the pin, and they
     carry backdrop-filter: a custom property written on the pin invalidates
     their subtree on every frame. Measured at 4x CPU on a phone, patching the
     write out entirely took the fall from 29fps to 71fps. Skipping it where
     it is unread recovers most of that for free.

     The stale value left parked at the band edge is correct by construction:
     at .08 the cue is already out and the arrival has not begun. */
  const READS_DP = p => p < 0.08 || p > 0.70;

  const commit = (p, c) => {
    if (!READS_DP(p)) { wroteP = ''; return; }
    const ps = p.toFixed(4);
    if (ps !== wroteP) {
      pin.style.setProperty('--dp', ps);
      /* The cue is fully transparent by .045; past .05 it comes out of the
         box tree entirely so its three animations and its backdrop-filter
         stop costing anything. Folded into this branch so it is only
         evaluated when --dp actually moved. */
      pin.classList.toggle('dp-moved', p > 0.05);
      /* The arrival's own gate. Before this the cards were painting — and
         compositing four backdrop-filters — through the entire fall while
         invisible. .74 is where --hin starts, so this is a hair ahead of it. */
      pin.classList.toggle('dp-arriving', p > 0.72);
      wroteP = ps;
    }
    const cs = c.toFixed(4);
    if (cs !== wroteC) {
      pin.style.setProperty('--dc', cs);
      pin.classList.toggle('dp-covered', c > 0.92);
      wroteC = cs;
    }
  };

  /* Time constant, in milliseconds, for the scrub's smoothing. The old form
     was `held += d * 0.18` — per FRAME, so it converged twice as fast on a
     120Hz display as on a 60Hz one and the scrub genuinely felt different
     depending on the monitor. 85ms reproduces the 60Hz feel of that constant
     and now holds it at any refresh rate. */
  const TAU = 85;

  let target = 0;
  let held = 0;
  let cov = -1;
  let raf = 0;
  let last = 0;

  const tick = now => {
    const dt = last ? Math.min(64, now - last) : 16.7;
    last = now;

    const m = measure();                       /* ── reads ── */
    target = m.p;

    const d = target - held;
    held = Math.abs(d) < 0.0002 ? target : held + d * (1 - Math.exp(-dt / TAU));

    paint(1 + Math.round(held * (TOTAL - 1))); /* canvas only, no layout */
    commit(held, m.c);                         /* ── writes ── */

    /* Keep going while the scrub is still catching up, and for one frame
       past a change in cover so the arrival's hand-over lands. */
    const settled = Math.abs(target - held) < 0.0002;
    const still = m.c === cov;
    cov = m.c;
    raf = (settled && still) ? 0 : requestAnimationFrame(tick);
  };

  /* The tick parks itself once the scrub has settled, but kick() was wired
     to every scroll event on the page — so scrolling the footer still woke
     the scrubber for a frame, and that frame reads a bounding rect and an
     offsetHeight after the page has just been written to, which forces a
     synchronous relayout. Measured at 1440: one of about twelve layout
     reads per scroll frame, all of them outside the hero.

     The gate is the runway itself. When it leaves, kick() runs ONCE more so
     the scrub settles on the clamped end value rather than freezing
     wherever it happened to be, and then stops. Without an
     IntersectionObserver `near` stays true and this is the old behaviour. */
  let near = true;
  const kick = () => {
    if (raf || !near) return;
    last = 0;
    raf = requestAnimationFrame(tick);
  };
  if (typeof IntersectionObserver === 'function') {
    new IntersectionObserver(es => {
      const was = near;
      near = es[es.length - 1].isIntersecting;
      if (near && !was) kick();
      if (!near && was) { near = true; kick(); near = false; }
    }, { rootMargin: '200px 0px' }).observe(sec);
  }

  /* One listener for the whole page. js/lumina.js owns the scroll loop on
     index.html and exposes onScroll for exactly this; standalone — the
     isolation harness — this installs its own rAF-gated one instead. */
  const L = window.Lumina;
  if (L && typeof L.onScroll === 'function') {
    L.onScroll(kick);
  } else {
    let t = false;
    addEventListener('scroll', () => {
      if (t) return;
      t = true;
      requestAnimationFrame(() => { kick(); t = false; });
    }, { passive: true });
  }
  addEventListener('resize', kick, { passive: true });

  /* ── go, but only once the page exists ─────────────────────
     The frames cost ~960ms of FIRST PAINT on Fast 3G — measured by blocking
     them: 2980ms as shipped against 2020ms without, on a page whose own HTML
     takes 1600ms to arrive. None of it is visible until the reader scrolls,
     and the inlined LQIP is already on screen, so there is nothing to show for
     the bandwidth it takes from the render-blocking CSS.

     requestIdleCallback yields to that work and fires almost immediately on a
     fast connection, so this costs nothing where there is nothing to save.
     The timeout is the guarantee: a reader who scrolls straight away still
     gets frames within two seconds, and until they arrive nearest() simply
     draws the closest frame it has. */
  const go = () => load(1, 'high')
    .then(() => { kick(); return queue(2, EAGER, null); })
    .then(() => { kick(); return queue(EAGER + 1, TOTAL, 'low'); });

  kick();
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(go, { timeout: 2000 });
  } else {
    setTimeout(go, 400);
  }

  (window.Lumina = window.Lumina || {}).descent = {
    get frame() { return drawn; },
    get loaded() { return loadedLo; },
    get progress() { return held; },
    ladder: LADDER
  };
})();
