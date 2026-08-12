// LUMINA — room.js
// The scroll-to-furnish room. One pinned section, one 0…1 progress, and
// every moving thing on the screen is a pure function of it.
//
// WHY NOTHING HERE HOLDS A TIMER OR INTEGRATES A SPRING
// Every bounce, flutter and pendulum below is a closed form — osc() —
// evaluated at p, never accumulated frame to frame. That is what makes
// scrolling BACK UP un-furnish the room exactly as carefully as scrolling
// down furnished it: the lamp un-ignites through its own flicker envelope,
// the table folds its legs and lifts, the picture un-swings. An integrated
// spring would break the instant somebody scrolled up, and scrolling up is
// a designed feature of this page, not an accident it has to survive.
//
// js/lumina.js owns the bar, the spine, the reveal observer and its own
// rAF-gated scroll listener. This file adds ONE more rather than reaching
// into that one, because the two ship independently — same shape, same
// gating, and under reduced motion this one binds nothing at all.

(function () {
  'use strict';

  const stage = document.getElementById('stage');
  const svg = document.getElementById('roomSvg');
  const section = document.getElementById('room');
  if (!stage || !svg || !section) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* Map v from [a,b] onto [0,1], clamped. Every phase on this page is one
     of these, which is what keeps them all in step. */
  const span = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const smooth = t => t * t * (3 - 2 * t);
  const easeOutQuart = t => 1 - Math.pow(1 - t, 4);
  const easeOutQuint = t => 1 - Math.pow(1 - t, 5);
  const easeOutExpo = t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
  const easeInQuad = t => t * t;
  const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOutBack = t => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);

  /* A damped oscillation that is exactly zero at t=0 and t=1. Every
     overshoot, rebound, flutter and pendulum in the piece is this one
     function with different n (half-cycles) and d (damping). */
  const osc = (t, n, d) => Math.cos(t * Math.PI * n) * Math.exp(-t * d) * (1 - t);

  /* ── phase constants ──────────────────────────────────────────
     The whole score. Move one and the rest still line up, because
     nothing here is expressed in seconds. */
  const ARM = 0.945;
  const READING = 0.22;

  /* Each piece: its own span and its own ease. invest.js uses ONE overlap
     constant for every level, so every arrival has the same duration and
     the same shape and the section is a metronome with the tick softened.
     Here the overlap is COMPOSED — simultaneity peaks at four around
     p .50 and is driven deliberately to zero at .745–.815, so ignition
     lands in silence. The rests are as authored as the arrivals. */
  const PIECES = [
    { i: 1, a: 0.150, b: 0.250, ease: easeOutQuint },  // rug
    { i: 2, a: 0.215, b: 0.365, ease: easeOutQuart },  // sofa
    { i: 3, a: 0.358, b: 0.435, ease: easeInQuad },    // coffee table (gravity)
    { i: 4, a: 0.395, b: 0.545, ease: easeInOutCubic },// armchair
    { i: 5, a: 0.480, b: 0.660, ease: easeOutExpo },   // credenza
    { i: 6, a: 0.600, b: 0.630, ease: easeInQuad },    // picture drop
    { i: 7, a: 0.640, b: 0.745, ease: easeOut },       // arc lamp
    { i: 8, a: 0.815, b: 0.845, ease: easeOut },       // plant pot
    { i: 9, a: 0.885, b: 0.925, ease: easeOut },       // side table
  ];

  const objs = new Map();
  [...svg.querySelectorAll('.obj')].forEach(g => objs.set(+g.dataset.i, g));
  const ghosts = new Map();
  [...svg.querySelectorAll('.gh')].forEach(g => ghosts.set(+g.dataset.g, g));
  const shadows = new Map();
  [...svg.querySelectorAll('.sh')].forEach(g => shadows.set(+g.dataset.s, g));
  const legs = [...svg.querySelectorAll('.leg')];
  const leaves = [...svg.querySelectorAll('.lf')];

  /* ── the write cache ──────────────────────────────────────────
     setProperty on an element invalidates its subtree. With composed
     overlap only three or four of the nine pieces are live in any frame,
     so roughly two thirds of the potential writes are the same string
     they already were. Comparing first is cheaper than the invalidation.
     This is also the honest answer for --lamp and --warm, which are read
     by every object's rim and so must live on a common ancestor: they
     only genuinely move over narrow ranges, and the cache bounds the
     invalidation to exactly those. */
  const cache = new WeakMap();
  const set = (el, prop, val) => {
    if (!el) return;
    let m = cache.get(el);
    if (!m) { m = new Map(); cache.set(el, m); }
    if (m.get(prop) === val) return;
    m.set(prop, val);
    el.style.setProperty(prop, val);
  };
  const setAttr = (el, name, val) => {
    if (!el) return;
    if (el.getAttribute(name) !== val) el.setAttribute(name, val);
  };

  /* ── the reading panel ────────────────────────────────────────
     Its copy is read out of the real <ol> in the document rather than
     held in an array here, so there is exactly one copy of the copy: it
     survives JS being blocked and a crawler sees it. */
  const read = document.getElementById('read');
  const readTag = document.getElementById('readTag');
  const readName = document.getElementById('readName');
  const readLight = document.getElementById('readLight');
  const entries = [...document.querySelectorAll('#schedule li')].map(li => ({
    tag: li.dataset.tag, name: li.dataset.name, note: li.textContent.trim(),
  }));

  let shown = -2, swapTimer = null, lightLine = '';
  const show = i => {
    if (i === shown) return;
    shown = i;
    const e = i < 0
      ? { tag: '00 / SETTING OUT', name: 'An empty shell', note: 'Nine pieces to go. The shell is the only thing here that a buyer cannot change.' }
      : entries[i];
    if (!e) return;
    const paint = () => {
      readTag.textContent = e.tag;
      readName.textContent = e.name;
      readLight.textContent = e.note;
      read.classList.remove('out');
    };
    if (reduce) { paint(); return; }
    read.classList.add('out');
    /* 190ms against the stylesheet's .18s fade: the repaint lands the
       frame AFTER the fade has bottomed out. The two are one number —
       change either and change both. clearTimeout or a fast scroll
       stacks timers and the panel paints the wrong entry last. */
    clearTimeout(swapTimer);
    swapTimer = setTimeout(paint, 190);
  };

  /* ── the rail ─────────────────────────────────────────────────
     Progress meter, table of contents and transport control in one
     object. Tick 10 says "Yours" from the first frame — telling the
     reader where a five-viewport pin ENDS is what stops it feeling like
     being led somewhere. */
  const RAIL = [
    { at: 0.02, label: 'Empty' },   { at: 0.15, label: 'Rug' },
    { at: 0.24, label: 'Sofa' },    { at: 0.36, label: 'Table' },
    { at: 0.44, label: 'Chair' },   { at: 0.52, label: 'Storage' },
    { at: 0.63, label: 'Picture' }, { at: 0.70, label: 'Lamp' },
    { at: 0.80, label: 'Light' },   { at: 0.94, label: 'Yours' },
  ];
  const rail = document.getElementById('rail');
  const railFill = document.getElementById('railFill');
  const railCount = document.getElementById('railCount');
  const ticks = [];

  const scrollToP = target => {
    const top = section.offsetTop;
    const total = section.offsetHeight - innerHeight;
    scrollTo({ top: top + total * target, behavior: reduce ? 'auto' : 'smooth' });
  };

  if (rail) {
    const frag = document.createDocumentFragment();
    RAIL.forEach((t, n) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rr-tick';
      b.dataset.on = 'future';
      b.innerHTML = '<span></span>';
      b.querySelector('span').textContent = t.label;
      b.setAttribute('aria-label', 'Jump to ' + t.label);
      /* +0.02 so a click lands just INSIDE the stage rather than on its
         first frame, where the piece has not started moving yet and the
         jump reads as having done nothing. */
      b.addEventListener('click', () => scrollToP(Math.min(t.at + 0.02, 1)));
      ticks.push(b);
      frag.appendChild(b);
    });
    rail.insertBefore(frag, railCount);
  }

  /* ── the clock ────────────────────────────────────────────────
     06:10 → 19:40 over the sun's range. Naming the time out loud is the
     cheapest way to turn a pretty gradient into a day passing. */
  const tbClock = document.getElementById('tbClock');
  const tbStatus = document.getElementById('tbStatus');
  const clockAt = sun => {
    const mins = 370 + sun * 810;
    const h = Math.floor(mins / 60), m = Math.floor(mins % 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  };

  /* ── the scene ────────────────────────────────────────────────
     One progress value drives everything below. Read the phase table at
     the top of css/room.css alongside this. */
  const cam = document.getElementById('cam');
  const objLayer = document.getElementById('objLayer');
  const shell = document.getElementById('shell');
  const intro = document.getElementById('intro');
  const pool = document.getElementById('pool');

  const setScene = p => {
    /* ── the nine arrivals ── */
    let front = -1;
    for (const P of PIECES) {
      const g = objs.get(P.i);
      const t = span(p, P.a, P.b);
      let v = P.ease(t);

      /* Overshoot lives INSIDE --p, so a single property carries the
         landing and the bounce and the stylesheet never has to know a
         bounce happened. */
      if (P.i === 2 && t > 0.82) v += osc((t - 0.82) / 0.18, 1, 6) * 0.04;
      if (P.i === 3 && t > 0.9) v += osc((t - 0.9) / 0.1, 1, 9) * 0.035;
      /* osc() is 1 at t=0, not 0 — it is a DECAYING oscillator, so it
         only ever belongs after the landing. Applied across a whole span
         it parks the piece at its amplitude from the very first frame,
         which left the plant pot faintly visible over an empty plot. */
      if (P.i === 8 && t > 0.7) v += osc((t - 0.7) / 0.3, 1, 8) * 0.05;

      set(g, '--p', v.toFixed(4));
      set(ghosts.get(P.i), '--gp', Math.min(1, v).toFixed(3));
      set(shadows.get(P.i), '--sp', Math.min(1, v).toFixed(3));

      /* will-change is toggled, not declared: nine permanently promoted
         full-width SVG layers is a memory problem on a mid laptop, and
         this codebase already names ~12 backdrop-filter panels as the
         ceiling. */
      setAttr(g, 'data-live', t > 0 && t < 1 ? '1' : '0');

      /* THE LATEST-STARTED live piece, not the first — and this is the
         INVERSE of invest.js line 211, deliberately. invest takes the
         first match so the construction line rides the frontier of a
         building going up. When a ROOM fills, the newest and nearest
         thing is the interesting one. Copy invest's line verbatim here
         and the panel talks about the rug for the whole middle of the
         scroll while the picture is visibly swinging. */
      if (t > 0 && t < 1) front = P.i - 1;
      else if (t >= 1 && front < P.i - 1) front = P.i - 1;
    }

    /* per-part drivers, each bounded to its own window so the cache
       skips them the rest of the time */
    const legT = span(p, 0.330, 0.385);
    legs.forEach((el, n) => set(el, '--l', easeOutBack(clamp((legT - n * 0.06) / 0.82, 0, 1)).toFixed(3)));

    const leafT = span(p, 0.830, 0.905);
    leaves.forEach((el, n) => set(el, '--f', easeOutBack(clamp((leafT - n * 0.09) / 0.37, 0, 1)).toFixed(3)));

    /* the rug's yaw and the sofa's late shadow */
    const rugT = span(p, 0.150, 0.250);
    set(objs.get(1)?.querySelector('.obj-alt'), '--yaw', (osc(rugT, 3, 5) * 1.2).toFixed(2) + 'deg');
    set(shadows.get(2), '--sp', easeOut(span(p, 0.300, 0.375)).toFixed(3));

    /* the picture's pendulum: still moving after it has arrived, which
       is why the eye tracks it longest */
    const pendT = span(p, 0.630, 0.720);
    set(objs.get(6)?.querySelector('.obj-alt'), '--pend', (osc(pendT, 2, 3.4) * 11).toFixed(2) + 'deg');

    /* ── the camera ──
       Walking forward in one-point perspective IS scaling about the
       vanishing point, so the dolly is one scale on one group.

       --cam-y is driven by `built`, the FURNISHING's own progress, not
       by p — invest.js measured this and called driving it from the
       scrollbar "the worst thing about the first cut". The eye surveys
       from higher while the room is empty and settles as it fills.

       The dolly is DELIBERATELY FINISHED BY .62. Stillness at the end is
       what makes a finished room feel finished; invest's camera runs to
       .86 and its ending is restless because of it. */
    const built = smooth(span(p, 0.150, 0.905));
    const z = smooth(span(p, 0.10, 0.62));
    /* a BUMP, not a step: the camera flinches at ignition and comes
       back. span() alone stays at 1 for the rest of the page and the
       flinch becomes a permanent 0.008 of extra zoom. */
    const ignite = span(p, 0.760, 0.775) * (1 - span(p, 0.775, 0.815));
    set(cam, '--cam-z', (1 + z * 0.13 + ignite * 0.01).toFixed(4));
    set(cam, '--cam-y', ((1 - built) * -26).toFixed(1) + 'px');
    /* a slow S: out to the left following the sofa and the plant, then
       back as the credenza, the picture and the lamp land right — and it
       clears the lower-left reading panel on the way back */
    const sx = smooth(span(p, 0.10, 0.55)), sx2 = smooth(span(p, 0.55, 0.95));
    set(cam, '--cam-x', ((1 - sx) * 22 - sx * 14 + sx2 * 20).toFixed(1) + 'px');
    if (objLayer) {
      set(objLayer, '--cam-z', (1 + z * 0.13 + ignite * 0.01).toFixed(4));
      set(objLayer, '--cam-y', ((1 - built) * -26).toFixed(1) + 'px');
      set(objLayer, '--cam-x', ((1 - sx) * 22 - sx * 14 + sx2 * 20).toFixed(1) + 'px');
    }

    /* ── the shell draws itself out of one point of light ── */
    const draw = easeOutExpo(span(p, 0, 0.075));
    set(shell, '--draw', (0.55 + draw * 0.45).toFixed(4));
    set(shell, '--draw-o', draw.toFixed(3));
    set(svg, '--solid', smooth(span(p, 0.075, 0.200)).toFixed(3));
    set(svg, '--plan', (smooth(span(p, 0.075, 0.20)) * 0.5).toFixed(3));
    set(svg, '--survey', (span(p, 0, 0.02) * (1 - span(p, 0.09, 0.15)) * 0.34).toFixed(3));
    /* the window inks LAST, so the light arrives with it */
    set(svg, '--win', smooth(span(p, 0.13, 0.22)).toFixed(3));
    set(svg, '--haze', smooth(span(p, 0.10, 0.30)).toFixed(3));

    /* ── the title ── invest.html's exact numbers, deliberately. This
       should read as the same firm's next drawing. */
    const gone = span(p, 0.03, 0.19);
    set(intro, '--intro-o', (1 - gone).toFixed(3));
    set(intro, '--intro-y', (gone * -70).toFixed(1) + 'px');
    set(intro, '--intro-b', (gone * 12).toFixed(1) + 'px');
    set(intro, '--intro-pe', gone > 0.5 ? 'none' : 'auto');

    /* ── the sun, running underneath all of it ── */
    const sun = smooth(span(p, 0.12, 0.90));
    set(svg, '--sun', sun.toFixed(4));
    set(svg, '--warm', smooth(span(p, 0.30, 0.88)).toFixed(3));
    set(svg, '--pool', (span(p, 0.16, 0.30) * (1 - span(p, 0.80, 0.92))).toFixed(3));
    /* the patch of light travels the floor with the sun that casts it —
       a pool that holds still under a moving sun is the kind of detail
       nobody names and everybody feels */
    set(pool, '--pool-x', (sun * 300).toFixed(0) + 'px');
    set(svg, '--city', span(p, 0.86, 0.96).toFixed(3));

    /* ── IGNITION. The peak of the page. ──
       The lamp arrived at .745 and did nothing for fifteen percent of
       the scroll. That unfired gun is the strongest retention device
       available and it costs one line of the table. Flash, drop, two
       flickers, settle — capped at .55 over gold-lt on the flash and
       NEVER white, because white here reads as a bug rather than a bulb. */
    let lamp = 0;
    if (p >= 0.760) {
      if (p < 0.767) lamp = span(p, 0.760, 0.767) * 0.55;
      else if (p < 0.781) lamp = 0.55 - span(p, 0.767, 0.781) * 0.20;
      else if (p < 0.795) lamp = 0.35 + span(p, 0.781, 0.795) * 0.65 + osc(span(p, 0.781, 0.795), 3, 1) * 0.1;
      else lamp = 0.90 + span(p, 0.795, 0.808) * 0.10;
    }
    set(svg, '--lamp', clamp(lamp, 0, 1).toFixed(3));
    set(svg, '--lamp2', span(p, 0.915, 0.975).toFixed(3));

    /* ── chrome ── */
    if (railFill) set(railFill, '--rp', p.toFixed(3));
    let now = 0;
    RAIL.forEach((t, n) => { if (p >= t.at) now = n; });
    ticks.forEach((b, n) => setAttr(b, 'data-on', n < now ? 'past' : n === now ? 'now' : 'future'));
    if (railCount) {
      const s = String(now + 1).padStart(2, '0') + ' / 10';
      if (railCount.textContent !== s) railCount.textContent = s;
    }

    if (tbClock) {
      const s = clockAt(sun);
      if (tbClock.textContent !== s) tbClock.textContent = s;
    }
    /* status is guarded — writing textContent every frame is a layout
       invalidation for no reason */
    const st = p < 0.075 ? 'Setting out'
      : p < 0.15 ? 'Shell'
      : p < 0.745 ? 'Furnishing ' + Math.round(span(p, 0.15, 0.905) * 100) + '%'
      : p < 0.808 ? 'Lighting'
      : p < ARM ? 'Settling' : 'Ready';
    if (tbStatus && tbStatus.textContent !== st) tbStatus.textContent = st;

    /* Two different moments, and they must not be collapsed: .reading is
       once the title has cleared, .armed is once there is a finished
       room to point at. */
    stage.classList.toggle('reading', p >= READING);
    stage.classList.toggle('armed', p >= ARM);

    /* Before the stage arms the panel narrates whatever just landed;
       after, the pointer takes over and this stops fighting it. */
    if (p < ARM) show(p < 0.15 ? -1 : front);
  };

  /* ── the finished frame, for phones and reduced motion ────────
     Every driver written to its end state, once. flat() must add BOTH
     .reading and .armed — missing one is named in CLAUDE.md and it bit
     both previous set-pieces on this site. */
  const flat = () => {
    for (const P of PIECES) {
      set(objs.get(P.i), '--p', '1');
      set(ghosts.get(P.i), '--gp', '1');
      set(shadows.get(P.i), '--sp', '1');
      setAttr(objs.get(P.i), 'data-live', '0');
    }
    legs.forEach(el => set(el, '--l', '1'));
    leaves.forEach(el => set(el, '--f', '1'));
    set(objs.get(1)?.querySelector('.obj-alt'), '--yaw', '0deg');
    set(objs.get(6)?.querySelector('.obj-alt'), '--pend', '0deg');
    [cam, objLayer].forEach(el => {
      set(el, '--cam-x', '0px'); set(el, '--cam-y', '0px'); set(el, '--cam-z', '1');
    });
    set(shell, '--draw', '1'); set(shell, '--draw-o', '1');
    ['--solid', '--win', '--haze', '--lamp', '--lamp2', '--sun', '--warm', '--city']
      .forEach(k => set(svg, k, '1'));
    set(svg, '--plan', '0.5');
    set(svg, '--survey', '0');
    set(svg, '--pool', '0');
    set(intro, '--intro-o', '1'); set(intro, '--intro-y', '0px');
    set(intro, '--intro-b', '0px'); set(intro, '--intro-pe', 'auto');
    if (tbClock) tbClock.textContent = '19:40';
    if (tbStatus) tbStatus.textContent = 'Ready';
    stage.classList.add('reading', 'armed');
    show(8);
  };

  /* NO fit() HERE, AND THAT IS THE POINT.
     invest.js has to measure its stage, subtract padding, read
     offsetHeight rather than a bounding rect because the camera above it
     is scaled, back-solve a scale factor, and only run while pinned —
     and every one of those steps was a bug at some point. viewBox plus
     preserveAspectRatio does the whole of that declaratively. Do not
     helpfully re-add a resize-measuring pass; there is nothing here for
     it to measure. */

  /* The pin runs at every width now — only reduced motion turns it off.
     Below 860px css/room.css repositions the chrome (intro, read panel,
     rail, skip) for a narrow viewport; it does not touch the pin or the
     drawing, which scales for free (viewBox + non-scaling-stroke). Kept
     as a function, and re-checked on resize, because reduced-motion can
     still change mid-session via the OS setting. */
  const pinned = () => !reduce;

  const onScrollRoom = () => {
    if (!pinned()) return;
    const r = section.getBoundingClientRect();
    const total = r.height - innerHeight;
    setScene(total > 0 ? clamp(-r.top / total, 0, 1) : 1);
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScrollRoom(); ticking = false; });
  };

  /* ── the nine hit targets ─────────────────────────────────────
     getBBox on a transformed <g> returns the UNTRANSFORMED box, which is
     what makes this measurable at all — but it is measured with every
     piece at --p:1, because mid-arrival the boxes are wherever the
     animation had got to and all nine buttons land somewhere wrong. They
     are invisible, so it would read as a mysterious offset rather than
     as a measurement bug. Measure once, restore, then never again. */
  let built = false;
  const buildHits = () => {
    if (built || !objLayer || !pinned()) return;
    built = true;
    const saved = new Map();
    for (const P of PIECES) {
      const g = objs.get(P.i);
      saved.set(P.i, g.style.getPropertyValue('--p'));
      g.style.setProperty('--p', '1');
    }
    const frag = document.createDocumentFragment();
    for (const P of PIECES) {
      const g = objs.get(P.i);
      let box;
      try { box = g.getBBox(); } catch (e) { continue; }
      if (!box || !box.width) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'obj-hit';
      b.dataset.i = String(P.i);
      b.style.left = (box.x / 1600 * 100).toFixed(2) + '%';
      b.style.top = (box.y / 1000 * 100).toFixed(2) + '%';
      b.style.width = (box.width / 1600 * 100).toFixed(2) + '%';
      b.style.height = (box.height / 1000 * 100).toFixed(2) + '%';
      b.setAttribute('aria-label', entries[P.i - 1] ? entries[P.i - 1].name : 'Piece ' + P.i);
      frag.appendChild(b);
    }
    objLayer.appendChild(frag);
    objLayer.hidden = false;
    for (const P of PIECES) objs.get(P.i).style.setProperty('--p', saved.get(P.i) || '0');

    let pinnedSel = -1;
    const pick = (n, hard) => {
      if (pinnedSel >= 0 && !hard) return;
      if (hard) pinnedSel = pinnedSel === n ? -1 : n;
      show(n);
    };
    const hits = [...objLayer.children];
    hits.forEach((b, n) => {
      b.addEventListener('pointerenter', () => { if (stage.classList.contains('armed')) pick(n, false); });
      b.addEventListener('focus', () => { if (stage.classList.contains('armed')) pick(n, false); });
      b.addEventListener('click', () => pick(n, true));
      b.addEventListener('keydown', e => {
        let next = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = n + 1;
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = n - 1;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = hits.length - 1;
        if (next === null) return;
        e.preventDefault();
        hits[clamp(next, 0, hits.length - 1)].focus();
      });
    });
  };

  const settle = () => {
    if (pinned()) { onScrollRoom(); buildHits(); }
    else flat();
  };

  if (reduce) flat();
  else {
    addEventListener('scroll', onScroll, { passive: true });
    settle();
  }

  let rTimer;
  addEventListener('resize', () => {
    clearTimeout(rTimer);
    rTimer = setTimeout(settle, 180);
  }, { passive: true });

  /* ── pointer parallax ─────────────────────────────────────────
     The one motion on this page that is not a function of p, on
     purpose: a pointer is not a scrollbar. A few px of eased camera
     drift toward the cursor is what turns a drawing you are looking AT
     into a room you are standing IN. It rides the same transform chain
     as the dolly (see #cam in the stylesheet), so the hit targets can
     never drift off the drawing. Its rAF only runs while the spring is
     actually moving — at rest this costs nothing. */
  if (!reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const AMP_X = 10, AMP_Y = 6;
    let tx = 0, ty = 0, px = 0, py = 0, parRaf = null;
    const settleSpring = () => {
      px += (tx - px) * 0.075;
      py += (ty - py) * 0.075;
      const sx = px.toFixed(2) + 'px', sy = py.toFixed(2) + 'px';
      set(cam, '--par-x', sx); set(cam, '--par-y', sy);
      if (objLayer) { set(objLayer, '--par-x', sx); set(objLayer, '--par-y', sy); }
      if (Math.abs(tx - px) > 0.04 || Math.abs(ty - py) > 0.04) {
        parRaf = requestAnimationFrame(settleSpring);
      } else parRaf = null;
    };
    const kick = () => { if (!parRaf) parRaf = requestAnimationFrame(settleSpring); };
    stage.addEventListener('pointermove', e => {
      if (!pinned()) return;
      const r = stage.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2 * AMP_X;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2 * AMP_Y;
      kick();
    }, { passive: true });
    stage.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); }, { passive: true });
  }

  /* ── the way out ──────────────────────────────────────────────
     A five-viewport pin you cannot escape is a trap. The button is the
     first tab stop inside the pin and Escape does the same thing. */
  const offer = document.getElementById('offer');
  const skip = document.getElementById('skip');
  const bail = () => offer && offer.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  if (skip) skip.addEventListener('click', bail);
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && section.getBoundingClientRect().top < 0) bail();
  });

  /* ── the enquiry ──────────────────────────────────────────────
     The anchor is a real wa.me link in the markup, so it works with the
     script blocked; this only composes the message into the href just
     before the browser follows it. */
  const send = document.getElementById('regSend');
  if (send) {
    const val = id => {
      const el = document.getElementById(id);
      return el ? String(el.value || '').trim() : '';
    };
    send.addEventListener('click', () => {
      const name = val('r-name');
      const msg =
        `Hello Lumina — ${name || 'enquiry'} here.\n` +
        `Looking for: ${val('r-size')} in ${val('r-where')}\n` +
        `Arriving: ${val('r-when')}\n\n` +
        `Could you send me what is available?`;
      send.href = 'https://wa.me/962771505250?text=' + encodeURIComponent(msg);
    });
    const form = document.getElementById('regForm');
    if (form) form.addEventListener('submit', e => { e.preventDefault(); send.click(); });
  }

  /* The stock count ships as a literal in the markup and is corrected
     from the data on load, failing silently. CLAUDE.md records that
     hardcoded counts go stale on re-import and start the pages lying. */
  const stock = document.getElementById('stockCount');
  if (stock) {
    fetch('data/lumina-demo-leads.json?v=2026-08-06')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d) && d.length) stock.textContent = String(d.length); })
      .catch(() => {});
  }
})();
