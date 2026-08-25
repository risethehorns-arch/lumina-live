/* The room — an empty shell furnishing itself, and then a switch.
   ---------------------------------------------------------------
   Replaces the drawn SVG scheme this page carried until 2026-08-25. Same
   machinery as js/hero-descent.js: a WebP ladder painted into a canvas and
   scrubbed off scroll position. Read the long note at the top of that file
   first — why not a <video>, why <img> and not createImageBitmap, why one
   rAF that stops. All of it applies here and none of it is repeated.

   WHAT IS DIFFERENT, and it is the whole point of this page.

   The ladder is ONE sequence with two halves that behave nothing alike:

     1 .. SCRUB      the furnishing. A pure function of scroll, so scrolling
                     back up un-furnishes the room exactly as carefully as
                     scrolling down furnished it.
     SCRUB .. TOTAL  the cove lighting coming up. NOT a function of scroll.
                     It is played, once, when the reader presses a button —
                     the one thing on this page they do rather than watch.

   Between them the pin holds a beat of darkness with nothing moving, because
   an interaction offered while the page is still settling gets pressed by
   accident and then it was not a decision.

   THE SUN GOES DOWN IN CSS, NOT IN THE CANVAS. The source already loses two
   stops as the camera settles; four overlay layers carry it the rest of the
   way to dusk, driven by three custom properties this file writes. A filter
   on the canvas would be a second full-frame pass on every painted frame;
   four alpha-composited layers are one composite each and can each move on
   their own curve. --rp, --dk and --lit are the only state, which is what
   makes every bit of it reversible.

   FRAMES ARE 1-BASED AND UNPADDED — 1.webp, not 001.webp, unlike the hero.
   scripts/build-room-frames.py writes them; it also prints the two constants
   below and they must agree with it. Sampling is NOT uniform: dense through
   the arrivals, sparse through the settle, sparse again through the lights,
   which is why 124 frames covers 300 of source. */
(() => {
  'use strict';

  const section = document.getElementById('room');
  const cv = document.getElementById('rmCanvas');
  if (!section || !cv) return;

  /* Must match scripts/build-room-frames.py. It prints them. */
  const TOTAL = 124;
  const SCRUB = 109;          /* room complete, lights off */
  const EAGER = 34;           /* the empty shell and the floor going down */
  const LANES = 6;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pin = section.querySelector('.room-pin') || section;
  const stage = document.getElementById('stage');
  const still = document.getElementById('rmStill');
  const swBox = document.getElementById('rmSwitch');
  const swBtn = document.getElementById('rmLights');

  /* Chosen once. A mid-session resize that swapped ladders would re-download
     124 files to change nothing a reader can see, while the page is moving. */
  /* 1280 is the master's own width. 406x1080... no — 406x720 is a native
     PORTRAIT centre crop, because a 16:9 frame cover-cropped into a 390x844
     pin shows only the middle 26% of its width: the old 720 rung stretched
     188 source pixels across 1170 device pixels and threw the rest away.
     Same pixel count, no resampling, about 2.2x the effective resolution.
     See scripts/build-room-frames.py. */
  const LADDER = innerWidth >= 760 ? 1280 : 406;
  const DIM = LADDER === 1280 ? [1280, 720] : [406, 720];
  const src = i => 'assets/room/' + LADDER + '/' + i + '.webp';

  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  /* Writing a custom property that has not changed still invalidates the
     subtree that reads it. Both setters below are write-once caches. */
  const setEl = (() => {
    const seen = new WeakMap();
    return (el, k, v) => {
      let m = seen.get(el);
      if (!m) { m = {}; seen.set(el, m); }
      if (m[k] === v) return;
      m[k] = v;
      el.style.setProperty(k, v);
    };
  })();
  const setVar = (() => {
    const last = {};
    return (k, v) => {
      const s = v.toFixed(4);
      if (last[k] === s) return;
      last[k] = s;
      pin.style.setProperty(k, s);
    };
  })();

  /* ── the switch, which exists on every path ───────────────────
     Including the ones where nothing scrubs. A reduced-motion reader and a
     phone still get to turn the lights on; they just get it as a cross-fade
     between two stills rather than fifteen frames of ramp. Offering the
     interaction only to the fast path would make it decoration. */
  let lit = 0;             /* 0..1, the lights' own progress */
  let litTarget = 0;
  let litRaf = 0;

  const armSwitch = on => {
    if (!swBox) return;
    swBox.classList.toggle('armed', on);
    swBox.setAttribute('aria-hidden', on ? 'false' : 'true');
    if (swBtn) swBtn.tabIndex = on ? 0 : -1;
  };

  const sayLit = on => {
    if (!swBtn) return;
    swBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    const label = swBtn.querySelector('.rm-btn-label');
    if (label) label.textContent = on ? 'Lights on' : 'Turn the lights on';
  };

  /* ── reduced motion: a different path, not a degraded one ─────
     The pin collapses to one viewport, the canvas goes, and the markup's own
     <img> shows the finished room. The switch swaps that <img> for the lit
     poster. One request instead of 124. */
  if (reduce) {
    cv.remove();
    section.classList.add('room-static');
    armSwitch(true);
    if (swBtn) {
      swBtn.addEventListener('click', () => {
        lit = lit ? 0 : 1;
        if (still) still.src = lit ? 'assets/room/poster-lit.jpg'
                                   : 'assets/room/poster-dark.jpg';
        pin.style.setProperty('--lit', String(lit));
        sayLit(!!lit);
      });
    }
    return;
  }

  /* Everything the stylesheet drives from --rp/--dk/--lit is gated behind
     this class, added HERE and not in the markup: with the script blocked
     the page has to be a finished room and a readable list, not a dark
     rectangle waiting for a scrub that will never run. */
  pin.classList.add('rm-live');

  cv.width = DIM[0];
  cv.height = DIM[1];
  const ctx = cv.getContext('2d', { alpha: false });

  const frames = new Array(TOTAL + 1);
  const ready = new Uint8Array(TOTAL + 1);

  const nearest = i => {
    if (ready[i]) return i;
    for (let d = 1; d < TOTAL; d++) {
      if (i - d >= 1 && ready[i - d]) return i - d;
      if (i + d <= TOTAL && ready[i + d]) return i + d;
    }
    return 0;
  };

  /* Two draws, not one, and only while the lights are coming up.
     The lights half is sampled every FOURTH source frame because it is a
     pure luminance ramp with no geometry — nothing moves, so there is
     nothing to alias. Blending between neighbours turns fifteen stills into
     a continuous fade for the cost of a second drawImage on a ramp that
     lasts under two seconds. The scrub itself never does this: it competes
     with a scroll gesture, and it has the frames. */
  let drawn = -1;
  let drawnMix = -1;
  const paint = (idx, mix) => {
    const i = nearest(Math.round(idx));
    if (!i) return;
    if (mix > 0.004 && i < TOTAL && ready[i + 1]) {
      ctx.globalAlpha = 1;
      ctx.drawImage(frames[i], 0, 0, DIM[0], DIM[1]);
      ctx.globalAlpha = mix;
      ctx.drawImage(frames[i + 1], 0, 0, DIM[0], DIM[1]);
      ctx.globalAlpha = 1;
      drawn = i; drawnMix = mix;
      if (!cv.classList.contains('on')) cv.classList.add('on');
      return;
    }
    if (i === drawn && drawnMix <= 0.004) return;
    ctx.drawImage(frames[i], 0, 0, DIM[0], DIM[1]);
    drawn = i; drawnMix = 0;
    /* The context is alpha:false, so before the first draw the canvas is an
       opaque black rectangle. It stays transparent until there is something
       in it and the markup's <img> holds the frame until then. */
    if (!cv.classList.contains('on')) cv.classList.add('on');
  };

  const load = (i, priority) => new Promise(res => {
    const img = new Image();
    img.decoding = 'async';
    if (priority) img.fetchPriority = priority;
    img.onload = () => {
      frames[i] = img;
      /* Ready means DECODED, not merely arrived — see the note in
         js/hero-descent.js. drawImage on an undecoded frame decodes it
         synchronously and that is a long task in the middle of a gesture. */
      (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => {
        ready[i] = 1;
        if (drawn < 0) paint(1, 0);
        res();
      });
    };
    img.onerror = () => res();
    img.src = src(i);
  });

  const queue = (from, to, priority) => {
    let next = from;
    const lane = () => {
      if (next > to) return Promise.resolve();
      const i = next++;
      return load(i, priority).then(lane);
    };
    return Promise.all(
      Array.from({ length: Math.min(LANES, to - from + 1) }, lane));
  };

  /* ── the runway ───────────────────────────────────────────────
     FURN is where the furnishing ends and the dark beat begins. The
     stylesheet's .room height and this number are one decision: at 560vh the
     pin runs 460vh, so 0.78 leaves very nearly one viewport of scrolling in
     the dark. Change either and check the other. */
  const FURN = 0.78;

  const measure = () => {
    const r = section.getBoundingClientRect();
    const runway = section.offsetHeight - innerHeight;
    return runway > 0 ? clamp01(-r.top / runway) : 0;
  };

  /* ── the nine stages ──────────────────────────────────────────
     Read off the ladder, not invented: assets/room/1280/*.webp at 7-frame
     intervals shows the planks at 8, the fluting at 36, the pendants hung by
     43, the niches lit at 50, the mirror at 57, the bed at 64, the bench at
     78, the rug at 85 and nothing but the sun going down after 92. These are
     those frames as a fraction of SCRUB. */
  const STAGES = [
    { at: 0.04, label: 'Floor' },
    { at: 0.25, label: 'Walls' },
    { at: 0.33, label: 'Pendants' },
    { at: 0.45, label: 'Niches' },
    { at: 0.52, label: 'Mirror' },
    { at: 0.58, label: 'Bed' },
    { at: 0.71, label: 'Bench' },
    { at: 0.78, label: 'Rug' },
    { at: 0.88, label: 'Dusk' },
  ];

  /* ── the reading panel ────────────────────────────────────────
     Its copy is read out of the real <ol> in the document rather than held
     in an array here, so there is exactly one copy of the copy: it survives
     JS being blocked and a crawler sees it. */
  const read = document.getElementById('read');
  const readTag = document.getElementById('readTag');
  const readName = document.getElementById('readName');
  const readLight = document.getElementById('readLight');
  const entries = [...document.querySelectorAll('#schedule li')].map(li => ({
    tag: li.dataset.tag, name: li.dataset.name, note: li.textContent.trim(),
  }));

  let shown = -2, swapTimer = null;
  const show = i => {
    if (i === shown) return;
    shown = i;
    const e = i < 0
      ? { tag: '00 / SETTING OUT', name: 'An empty shell',
          note: 'Nine stages to go. The shell is the only thing here a buyer cannot change.' }
      : (i >= entries.length
         ? { tag: '10 / THE SWITCH', name: 'And then it is yours',
             note: 'Everything from here is the light you chose.' }
         : entries[i]);
    if (!e) return;
    const paintRead = () => {
      readTag.textContent = e.tag;
      readName.textContent = e.name;
      readLight.textContent = e.note;
      read.classList.remove('out');
    };
    /* 190ms against the stylesheet's .18s fade: the repaint lands the frame
       AFTER the fade has bottomed out. The two are one number. clearTimeout
       or a fast scroll stacks timers and the panel paints the wrong entry
       last. */
    clearTimeout(swapTimer);
    read.classList.add('out');
    swapTimer = setTimeout(paintRead, 190);
  };

  /* ── the rail ─────────────────────────────────────────────────
     Progress meter, table of contents and transport in one object. The tenth
     tick says "Lit" from the first frame, because telling the reader where a
     five-viewport pin ENDS is what stops it feeling like being led. */
  const rail = document.getElementById('rail');
  const railFill = document.getElementById('railFill');
  const railCount = document.getElementById('railCount');
  const ticks = [];

  const scrollToP = target => {
    const top = section.offsetTop;
    const total = section.offsetHeight - innerHeight;
    scrollTo({ top: top + total * target, behavior: 'smooth' });
  };

  if (rail) {
    const frag = document.createDocumentFragment();
    STAGES.concat([{ at: 1, label: 'Lit' }]).forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rr-tick';
      b.dataset.on = 'future';
      b.innerHTML = '<span></span>';
      b.querySelector('span').textContent = t.label;
      b.setAttribute('aria-label', 'Jump to ' + t.label);
      /* +0.02 so a click lands just INSIDE the stage rather than on its
         first frame, where the piece has not started moving and the jump
         reads as having done nothing. */
      b.addEventListener('click', () =>
        scrollToP(Math.min(t.at * FURN + 0.02, 1)));
      ticks.push(b);
      frag.appendChild(b);
    });
    rail.insertBefore(frag, railCount);
  }

  /* ── the clock ────────────────────────────────────────────────
     16:40 to 19:20 across the furnishing, then it stops — the room is
     finished and the sun has gone whatever the reader does next. Naming the
     time out loud is the cheapest way to turn a gradient into an evening. */
  const tbClock = document.getElementById('tbClock');
  const tbStatus = document.getElementById('tbStatus');
  const clockAt = t => {
    const mins = 1000 + t * 160;                 /* 16:40 → 19:20 */
    const h = Math.floor(mins / 60), m = Math.floor(mins % 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  };

  const intro = document.getElementById('intro');

  /* ── the scene ────────────────────────────────────────────────
     One number in, everything out, and nothing held anywhere else. */
  let armed = false;
  const setScene = p => {
    const rp = clamp01(p / FURN);
    const dk = clamp01((p - FURN) / (1 - FURN));

    setVar('--rp', rp);
    setVar('--dk', dk);

    /* The intro clears out of the way of the first plank. It drives the
       --intro-* custom properties the stylesheet already had rather than a
       class, so it leaves continuously with the scroll instead of snapping
       at a threshold — and css/room.css keeps working unchanged. */
    if (intro) {
      const gone = clamp01((rp - 0.02) / 0.10);
      setEl(intro, '--intro-o', (1 - gone).toFixed(3));
      setEl(intro, '--intro-y', (gone * -70).toFixed(1) + 'px');
      setEl(intro, '--intro-b', (gone * 12).toFixed(1) + 'px');
      setEl(intro, '--intro-pe', gone > 0.5 ? 'none' : 'auto');
    }

    /* the reading panel arrives with the first piece and stays */
    if (stage) stage.classList.toggle('reading', rp > 0.04);

    let stageIdx = -1;
    for (let i = 0; i < STAGES.length; i++) if (rp >= STAGES[i].at) stageIdx = i;
    if (dk > 0.55 || lit > 0) stageIdx = entries.length;
    show(stageIdx);

    if (railFill) railFill.style.transform = 'scaleY(' + p.toFixed(4) + ')';
    if (railCount) {
      railCount.textContent =
        String(Math.min(10, stageIdx + 2)).padStart(2, '0') + ' / 10';
    }
    ticks.forEach((b, n) => {
      const on = n === Math.min(stageIdx + 1, ticks.length - 1);
      b.dataset.on = on ? 'now' : (n <= stageIdx ? 'past' : 'future');
    });

    if (tbClock) tbClock.textContent = clockAt(rp);
    if (tbStatus) {
      tbStatus.textContent = lit > 0.5 ? 'Lit'
        : dk > 0.35 ? 'Unlit'
        : rp > 0.97 ? 'Finished' : 'Furnishing';
    }

    /* The switch arms only once the room has been dark for a beat. Offered
       the instant the furnishing ends, it gets pressed by a reader still
       scrolling and then it was not a decision. */
    const wantArmed = dk > 0.42;
    if (wantArmed !== armed) { armed = wantArmed; armSwitch(wantArmed); }

    /* Scrolling back into the furnishing puts the lights out again — the
       alternative is a page whose state depends on how you got here.

       The test is on p against FURN with a margin, NOT on rp against 1.
       rp is p/FURN clamped, so "rp < 0.995" is p < 0.776 — three thousandths
       of the runway from the boundary, which the lerp's own settling can sit
       inside. And because litTick calls setScene, that made a loop: throw the
       switch while the scroll had settled a hair short, and the next lit
       frame reset it. Measured from a keyboard, where the button had not
       moved the page at all: Enter left aria-pressed="false".

       0.04 of the runway is about 18vh — an unmistakable scroll back, and far
       outside anything the smoothing can produce on its own. */
    if (p < FURN - 0.04 && litTarget > 0) {
      litTarget = 0;
      sayLit(false);
      if (swBox) swBox.classList.remove('on', 'rm-flash');
      pin.classList.remove('rm-flash');
      kickLit();
    }
  };

  /* ── the switch's own animation ───────────────────────────────
     Not a transition on a property — the frame index has to move with it,
     and a CSS transition cannot drive a canvas. Same exponential shape as
     the scrub's smoothing so the two feel like one machine. */
  /* Asymmetric on purpose. Coming ON is the moment the page exists for and
     it takes its time. Going OFF happens because the reader scrolled back
     into the furnishing — and while lit > 0 the canvas is painting the LIT
     end of the ladder, so a slow fade means watching a finished, lit room
     while scrubbing backwards through a half-built one. Measured at 340ms
     both ways: still 0.126 a second after the scroll had settled. */
  const LIT_ON = 340;
  const LIT_OFF = 110;
  let litLast = 0;
  const litTick = now => {
    const dt = litLast ? Math.min(64, now - litLast) : 16.7;
    litLast = now;
    const d = litTarget - lit;
    const tau = d > 0 ? LIT_ON : LIT_OFF;
    lit = Math.abs(d) < 0.0008 ? litTarget : lit + d * (1 - Math.exp(-dt / tau));
    setVar('--lit', lit);
    draw();
    /* setScene runs off the scroll loop, and throwing the switch is not
       a scroll — without this the title block still read UNLIT with the
       room lit, and the reading panel kept the dusk entry. */
    setScene(heldP);
    litRaf = Math.abs(litTarget - lit) < 0.0008 ? 0 : requestAnimationFrame(litTick);
    if (!litRaf) litLast = 0;
  };
  const kickLit = () => { if (!litRaf) { litLast = 0; litRaf = requestAnimationFrame(litTick); } };

  if (swBtn) {
    let flash = 0;
    swBtn.addEventListener('click', () => {
      litTarget = litTarget > 0.5 ? 0 : 1;
      sayLit(litTarget > 0.5);
      swBox.classList.toggle('on', litTarget > 0.5);
      /* The half-second where the bloom is brighter than it settles at — a
         filament coming up to temperature rather than a checkbox. It is a
         `filter` on a static overlay, which this page's own doctrine warns
         about; that warning was about a filter INSIDE a scaling camera,
         re-rastering its region on every frame of a dolly. There is no
         camera any more, this layer never moves, and it runs once, for
         900ms, in response to a press. */
      clearTimeout(flash);
      if (litTarget > 0.5) {
        pin.classList.add('rm-flash');
        flash = setTimeout(() => pin.classList.remove('rm-flash'), 520);
      } else {
        pin.classList.remove('rm-flash');
      }
      kickLit();
    });
  }

  /* ── the frame ────────────────────────────────────────────────
     One place decides what is on the canvas, from the two numbers above. */
  let heldP = 0;
  const draw = () => {
    const rp = clamp01(heldP / FURN);
    if (lit > 0.002) {
      const f = SCRUB + lit * (TOTAL - SCRUB);
      paint(Math.floor(f), f - Math.floor(f));
    } else {
      paint(1 + rp * (SCRUB - 1), 0);
    }
  };

  /* ── the loop ─────────────────────────────────────────────────
     Lerps a held position toward the scroll target and stops the moment it
     arrives, so there is no permanent ticker. TAU in milliseconds, not a
     per-frame constant: the old shape converged twice as fast on a 120Hz
     display as on a 60Hz one and the scrub genuinely felt different
     depending on the monitor. */
  const TAU = 90;
  let target = 0, raf = 0, last = 0;

  const tick = now => {
    const dt = last ? Math.min(64, now - last) : 16.7;
    last = now;
    target = measure();                              /* the only read */
    const d = target - heldP;
    heldP = Math.abs(d) < 0.0002 ? target : heldP + d * (1 - Math.exp(-dt / TAU));
    if (lit <= 0.002) draw();
    setScene(heldP);                                 /* the writes */
    raf = Math.abs(target - heldP) < 0.0002 ? 0 : requestAnimationFrame(tick);
    if (!raf) last = 0;
  };

  /* Gated on the runway being near, for the same reason the hero's is: this
     is one bounding-rect read per scroll frame, and outside the room it is a
     forced relayout that answers a question nobody asked. Defaults to near
     where there is no IntersectionObserver. */
  let near = true;
  const kick = () => { if (!raf && near) { last = 0; raf = requestAnimationFrame(tick); } };
  if (typeof IntersectionObserver === 'function') {
    new IntersectionObserver(es => {
      const was = near;
      near = es[es.length - 1].isIntersecting;
      if (near && !was) kick();
      if (!near && was) { near = true; kick(); near = false; }
    }, { rootMargin: '200px 0px' }).observe(section);
  }

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

  /* ── go, once the page exists ─────────────────────────────────
     5.3MB of ladder against a page whose first screen is a headline and a
     scroll cue. requestIdleCallback yields to the render-blocking work and
     fires almost immediately on a fast connection; the timeout is the
     guarantee that a reader who scrolls straight away is not left waiting on
     an idle callback that never comes. */
  const go = () => load(1, 'high')
    .then(() => { kick(); return queue(2, EAGER, null); })
    .then(() => { kick(); return queue(EAGER + 1, SCRUB, 'low'); })
    /* The lights half last: nobody can reach it without scrolling the whole
       runway first, and it is the only part that is not on the critical
       path of the gesture. */
    .then(() => queue(SCRUB + 1, TOTAL, 'low'));

  kick();
  if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 2000 });
  else setTimeout(go, 400);

  /* ── the way out ──────────────────────────────────────────────
     A five-viewport pin you cannot escape is a trap. The button is the first
     tab stop inside the pin and Escape does the same thing. */
  const offer = document.getElementById('offer');
  const skip = document.getElementById('skip');
  const bail = () => offer && offer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (skip) skip.addEventListener('click', bail);
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && section.getBoundingClientRect().top < 0) bail();
  });

  /* ── the enquiry ──────────────────────────────────────────────
     The anchor is a real wa.me link in the markup, so it works with the
     script blocked; this only composes the message into the href just before
     the browser follows it. */
  const send = document.getElementById('regSend');
  if (send) {
    const val = id => {
      const el = document.getElementById(id);
      return el ? String(el.value || '').trim() : '';
    };
    send.addEventListener('click', () => {
      const name = val('r-name');
      const msg =
        'Hello Lumina — ' + (name || 'enquiry') + ' here.\n' +
        'Looking for: ' + val('r-size') + ' in ' + val('r-where') + '\n' +
        'Arriving: ' + val('r-when') + '\n\n' +
        'Could you send me what is available?';
      send.href = 'https://wa.me/962771505250?text=' + encodeURIComponent(msg);
    });
    const form = document.getElementById('regForm');
    if (form) form.addEventListener('submit', e => { e.preventDefault(); send.click(); });
  }

  /* The stock count ships as a literal in the markup and is corrected from
     the data on load, failing silently. CLAUDE.md records that hardcoded
     counts go stale on re-import and start the pages lying. */
  const stock = document.getElementById('stockCount');
  if (stock) {
    fetch('data/lumina-demo-leads.json?v=2026-08-25b')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (Array.isArray(d) && d.length) stock.textContent = String(d.length); })
      .catch(() => {});
  }
})();
