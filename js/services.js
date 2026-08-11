// LUMINA — services.js
// The orbiting bubble field on services.html, and the ask form's
// handoff to WhatsApp.
//
// THE CONTRACT WITH THE STYLESHEET
// The markup describes a grid of links and that grid is the base
// state — no JavaScript, a narrow screen, or reduced motion and the
// page is still a working services page. This file only ever *adds*
// behaviour: it puts .live on the field, which is the stylesheet's
// signal to drop the grid and let absolute positioning take over, and
// from then on it owns exactly one thing per bubble, the transform.
// Nothing here sets a colour, a radius or a shadow; nothing in the
// stylesheet positions a live bubble.
//
// WHY ONE rAF AND ONE TRANSFORM
// Six moving parts per bubble — orbit, two drift waves, depth scale,
// pointer repulsion and the hover spring — resolve to a single
// translate+scale written once per frame. Layering them as separate
// CSS animations would need six nested elements each and could not do
// the pointer at all.

(function () {
  'use strict';

  const field = document.getElementById('svcField');
  if (!field) return;

  const bubbles = [...field.querySelectorAll('.bub')];
  const hub = document.getElementById('hub');
  const hubTag = document.getElementById('hubTag');
  const hubName = document.getElementById('hubName');
  const hubNote = document.getElementById('hubNote');

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  /* 1200, not 901 — the same breakpoint the stylesheet uses to move the
     head beside the field. Below it the hub's reading line is
     display:none, so between 901 and 1199 the orbit ran with its whole
     payload muted: every data-note was unreachable and hovering bought
     you a rim and the word Open. The grid says the same things in
     words, so the grid is the better page in that band. */
  const wide = () => matchMedia('(min-width: 1200px)').matches;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
  const TAU = Math.PI * 2;

  /* ── the hub's reading line ────────────────────────────────
     Same fade-swap as the invest page's reading panel: fade out,
     change the text at the bottom of the fade, fade back. Swapping
     the text under a live opacity transition is what makes it read
     as one panel rather than three.

     The hub stays aria-hidden permanently. It used to be exposed the
     moment the field went live, which put a silently mutating block
     of text in the accessibility tree with no live region to announce
     it — and below the live breakpoint it is display:none anyway, so
     a keyboard user got nothing at all. The notes now ride on each
     bubble's own aria-label instead, where they are read as part of
     the link. This panel is the sighted mirror of that, not the
     source. */
  let shownKey = null, swapTimer = null;
  const readOut = b => {
    const key = b ? b.getAttribute('href') : null;
    if (key === shownKey) return;
    shownKey = key;
    /* Read from data-name, not from the bubble's own label. The label
       carries a <br> so it can break inside a round shape, and lifting
       its textContent gives "Propertymanagement" — and the hub should
       be adding a line, not echoing the one already on screen. */
    const tag = b ? b.dataset.tag : 'Lumina';
    const name = b ? b.dataset.name : 'Pick one to read it';
    const note = b ? b.dataset.note : 'Point at a bubble for what it is. Click to open the page.';
    const paint = () => {
      hubTag.textContent = tag;
      hubName.textContent = name;
      hubNote.textContent = note;
      field.classList.remove('swapping');
    };
    if (!hub || reduce) { if (hub) paint(); return; }
    field.classList.add('swapping');
    clearTimeout(swapTimer);
    swapTimer = setTimeout(paint, 170);
  };

  /* ── per-bubble state ──────────────────────────────────────
     a0/r come off the markup so the three current services can be
     composed by hand. Anything without them falls back to an even
     split of the circle with alternating radii, which is what a
     fourth or fifth service added later will get for free. */
  const n = bubbles.length;
  const state = bubbles.map((el, i) => {
    const a0 = num(el.dataset.a, (i * 360 / n) - 90) * Math.PI / 180;
    const r = num(el.dataset.r, i % 2 ? 0.62 : 0.76);
    return {
      el,
      a: a0,
      /* Speeds are deliberately not multiples of each other. Equal or
         harmonic speeds make the group snap back into its starting
         formation every few minutes, and the eye catches the loop. */
      w: (i % 2 ? 1 : -1) * (0.0079 + i * 0.0013),
      r,
      size: num(el.dataset.size, 1),
      /* two drift waves per axis at unrelated frequencies — the sum
         never repeats within a session, so the float reads as
         weather rather than as a cycle */
      f1: 0.11 + i * 0.037, p1: i * 2.1,
      f2: 0.077 + i * 0.029, p2: i * 3.7,
      /* its own drift clock, not a share of a global one. Slowing the
         chosen bubble has to slow its drift too or it keeps sliding
         out from under the cursor on the shared wave. */
      tt: 0,
      hov: 0,      // 0…1 spring toward the chosen size
      hovT: 0,     // its target
      press: 0,    // 0…1 spring toward the pressed size
      pressT: 0,   // its target
      /* the arrival: each bubble leaves the hub a beat after the one
         before it, so the ring assembles rather than switching on */
      introDelay: i * 0.16,
      rx: 0, ry: 0 // pointer repulsion, spring-damped
    };
  });

  /* ── geometry ──────────────────────────────────────────────
     Recomputed on resize only. The ellipse is squashed vertically so
     the ring reads as a plane seen from slightly above rather than a
     flat circle drawn on the screen. */
  let cx = 0, cy = 0, radX = 0, radY = 0, base = 0;
  const measure = () => {
    const r = field.getBoundingClientRect();
    cx = r.width / 2;
    cy = r.height / 2;
    base = clamp(Math.min(r.width, r.height) * 0.21, 132, 210);
    /* leave a bubble's worth of room at every edge, and a little more
       at the sides where the arm is longest */
    radX = Math.max(0, r.width / 2 - base * 0.86);
    radY = Math.max(0, r.height / 2 - base * 0.74);
    state.forEach(s => {
      const sz = Math.round(base * s.size);
      s.sz = sz;
      s.el.style.setProperty('--sz', sz + 'px');
    });
  };

  /* ── pointer ───────────────────────────────────────────────
     Bubbles inside PUSH are nudged away from the cursor, hardest at
     the centre of the radius — it is what makes them feel like
     objects with a skin rather than pictures.

     The listener stores raw client coordinates and reads nothing.
     Converting to field-local needs the field's rect, and taking it
     here meant a forced layout on every pointermove, landing between
     the loop's own transform writes on a subtree carrying three
     backdrop filters. The loop takes one rect per frame instead, at
     the top, before it writes anything — and only while a pointer is
     actually in the field. */
  let ptrC = null, ptr = null;
  const PUSH = 210;
  const onMove = e => { ptrC = { x: e.clientX, y: e.clientY }; };
  const onLeave = () => { ptrC = null; ptr = null; };

  /* ── the loop ──────────────────────────────────────────────
     One rAF for the whole field.

     Time is scaled PER BUBBLE, not globally. The one being pointed at
     comes to a genuine stop so it cannot slide out from under the
     cursor; the other two keep their orbit and their drift. A single
     global scale did the first job and broke the second — engaging
     with any one bubble dropped all three orbits and all six drift
     waves to a crawl, and a field that halts the moment you touch it
     reads as a paused video rather than as weather. `calm` is all
     that survives of it: a gentle scene-wide settle while something
     is chosen, enough to defer to the thing being read. */
  let raf = null, last = 0, calm = 1, running = false;

  /* The arrival clock, in real seconds, never scaled by `calm` —
     choosing a bubble mid-entrance must not stall the entrance. It
     does not start until the field has actually been on screen, so a
     reader who lands deep-linked further down still gets the arrival
     when they scroll back up to it. */
  let intro = 0, armed = false;
  const INTRO = 0.9;
  const easeOut = v => 1 - (1 - v) ** 3;

  const frame = now => {
    if (!running) return;
    const dt = last ? clamp((now - last) / 1000, 0, 0.05) : 0.016;
    last = now;
    if (armed) intro += dt;

    /* the one rect this file takes per frame — see the pointer block */
    if (ptrC) {
      const fr = field.getBoundingClientRect();
      ptr = { x: ptrC.x - fr.left, y: ptrC.y - fr.top };
    } else ptr = null;

    const anyOn = state.some(s => s.hovT > 0);
    calm += ((anyOn ? 0.62 : 1) - calm) * clamp(dt * 3.2, 0, 1);

    for (const s of state) {
      /* 0…1 arrival. It multiplies the orbit radius, so the bubble is
         flung out of the hub rather than fading in on the spot — the
         ring builds itself out of its own centre. */
      const g = easeOut(clamp((intro - s.introDelay) / INTRO, 0, 1));

      const rate = lerp(1, 0.05, s.hov) * calm;
      s.a += s.w * TAU * dt * rate;
      s.tt += dt * rate;

      const ox = Math.cos(s.a) * radX * s.r * g;
      const oy = Math.sin(s.a) * radY * s.r * g;
      const dx = Math.sin(s.tt * s.f1 * TAU + s.p1) * 15;
      const dy = Math.cos(s.tt * s.f2 * TAU + s.p2) * 13;

      /* depth: 0 at the back of the ellipse, 1 at the front. It
         drives scale and opacity, which is the whole illusion of a
         ring standing in space. No per-frame blur — filter() on a
         backdrop-blurred element is the one thing that would cost
         real frames here. */
      const depth = (Math.sin(s.a) + 1) / 2;

      /* Pointer repulsion, spring-damped so it eases back rather than
         snapping when the cursor leaves.

         Scaled by (1 - hov): the bubble you are actually pointing at
         must NOT run away from the cursor. Without this the thing
         being chosen slides out from under the pointer as it is
         chosen, which fights the hover it just triggered — the
         neighbours part, the target holds still. */
      let tx = 0, ty = 0;
      if (ptr && s.hov < 0.98) {
        const px = cx + ox + dx, py = cy + oy + dy;
        const vx = px - ptr.x, vy = py - ptr.y;
        const d = Math.hypot(vx, vy) || 1;
        if (d < PUSH) {
          const f = (1 - d / PUSH) ** 2 * 40 * (1 - s.hov);
          tx = (vx / d) * f; ty = (vy / d) * f;
        }
      }
      s.rx += (tx - s.rx) * clamp(dt * 5.5, 0, 1);
      s.ry += (ty - s.ry) * clamp(dt * 5.5, 0, 1);

      s.hov += (s.hovT - s.hov) * clamp(dt * 8, 0, 1);
      /* faster than the hover spring on purpose: a press has to be
         felt on the same beat as the click, not eased into */
      s.press += (s.pressT - s.press) * clamp(dt * 14, 0, 1);

      /* When one is chosen the rest step back — a little smaller and a
         lot dimmer. It is the difference between a menu where one item
         is highlighted and a room where one thing is being looked at. */
      const recede = anyOn ? (1 - s.hov) : 0;

      const sc = lerp(0.82, 1.05, depth) * lerp(1, 1.16, s.hov) * lerp(1, 0.93, recede)
        * lerp(0.55, 1, g) * lerp(1, 0.955, s.press);
      const x = cx + ox + dx + s.rx - s.sz / 2;
      const y = cy + oy + dy + s.ry - s.sz / 2;

      s.el.style.transform =
        'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + sc.toFixed(3) + ')';
      s.el.style.opacity = (lerp(0.62, 1, depth) * lerp(1, 0.42, recede) * g).toFixed(3);

      /* The specular, derived from what this loop already knows. It
         used to come from the bubble's own getBoundingClientRect on
         every pointermove — a second forced layout per event, and a
         frame stale by the time it was written. `sc` has to be divided
         back out because the element is scaled about its own centre
         and --sx/--sy are percentages of its unscaled box. Only the
         chosen bubble's sheen is visible, so only it is written. */
      if (ptr && s.hov > 0.002) {
        const h = s.sz / 2;
        s.el.style.setProperty('--sx', ((((ptr.x - (x + h)) / sc + h) / s.sz) * 100).toFixed(1) + '%');
        s.el.style.setProperty('--sy', ((((ptr.y - (y + h)) / sc + h) / s.sz) * 100).toFixed(1) + '%');
      }
      /* a chosen bubble comes to the front of the stack whatever the
         orbit says, or the thing being read can sit behind another */
      s.el.style.zIndex = String(s.hovT > 0 ? 60 : 10 + Math.round(depth * 20));
    }

    raf = requestAnimationFrame(frame);
  };

  const start = () => {
    if (running) return;
    running = true; last = 0;
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  };

  /* ── choosing ──────────────────────────────────────────────
     One code path for pointer, keyboard and touch. `.on` is the
     stylesheet's only hook, so a tab stop looks exactly like a
     hover — which is the point of doing it here rather than in
     :hover, where the keyboard would have got nothing. */
  const choose = (s, on) => {
    s.hovT = on ? 1 : 0;
    s.el.classList.toggle('on', on);
    if (on) readOut(s.el);
    else if (!state.some(o => o.hovT > 0)) readOut(null);
  };

  state.forEach(s => {
    const el = s.el;
    /* A press has to be acknowledged before the page turns, or the
       most interactive object on the site answers a click with
       nothing. Enter counts: the anchor fires on Enter, so the
       keyboard gets the same compression the pointer does. */
    const press = on => { s.pressT = on ? 1 : 0; };
    el.addEventListener('pointerenter', e => {
      if (e.pointerType === 'touch') return;   // touch gets it on focus
      choose(s, true);
    });
    el.addEventListener('pointerleave', () => { press(false); choose(s, false); });
    el.addEventListener('focus', () => choose(s, true));
    el.addEventListener('blur', () => { press(false); choose(s, false); });
    el.addEventListener('pointerdown', () => press(true));
    el.addEventListener('pointerup', () => press(false));
    el.addEventListener('pointercancel', () => press(false));
    el.addEventListener('keydown', e => { if (e.key === 'Enter') press(true); });
    el.addEventListener('keyup', e => { if (e.key === 'Enter') press(false); });
    /* the sheen tracks the cursor inside the shape. Written here and
       not by lumina.js's .tilt, because .tilt sets an inline
       transform and the loop above owns this element's transform.

       In the live state the loop derives it instead, from a position
       it has already computed — this path stays only for the grid,
       where nothing is moving and a rect read costs nothing. */
    el.addEventListener('pointermove', e => {
      if (live) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--sx', (((e.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
      el.style.setProperty('--sy', (((e.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
    }, { passive: true });
  });

  /* ── live or not ───────────────────────────────────────────
     The orbit is only worth having on a wide screen with motion
     allowed. Below that the stylesheet's grid is not a fallback, it
     is the layout — so going live is re-decided on every resize,
     because crossing that breakpoint mid-session is a real thing
     people do. */
  let live = false;
  const setLive = () => {
    /* `fine` as well: without a fine pointer there is no repulsion, no
       hover and no reading line, so a 1024 touch tablet was getting
       the pointer-driven version of the field with no pointer. */
    const want = !reduce && fine && wide();
    if (want === live) return;
    live = want;
    field.classList.toggle('live', live);
    if (live) {
      measure();
      if (fine) {
        field.addEventListener('pointermove', onMove, { passive: true });
        field.addEventListener('pointerleave', onLeave, { passive: true });
      }
      start();
    } else {
      stop();
      ptrC = null; ptr = null;
      field.removeEventListener('pointermove', onMove);
      field.removeEventListener('pointerleave', onLeave);
      /* hand every property back to the stylesheet — leaving a stale
         transform behind would strand the bubbles off-grid */
      state.forEach(s => {
        s.el.style.transform = '';
        s.el.style.opacity = '';
        s.el.style.zIndex = '';
        s.el.style.removeProperty('--sz');
      });
    }
  };

  /* Nothing to animate while the field is off screen, and a page left
     open on another tab should not hold a rAF for an hour.

     The rAF was never the whole cost. Six CSS rotations run under it —
     three shells and three halos — and one of those shells carries a
     backdrop blur above 1024px, which has to re-sample and re-blur
     what is behind it on every frame it turns. `.rest` parks all six,
     and it is toggled whether or not the field is live: below the live
     breakpoint those rotations are the only motion on the page, and
     they were running permanently on a phone. Paused, not cancelled —
     see the stylesheet for why. */
  let onScreen = true;
  const settle = () => field.classList.toggle('rest', document.hidden || !onScreen);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => {
      es.forEach(e => {
        onScreen = e.isIntersecting;
        if (onScreen) armed = true;   // the arrival waits to be seen
        settle();
        if (live) (onScreen ? start() : stop());
      });
    }, { rootMargin: '120px' }).observe(field);
  } else {
    armed = true;
  }
  /* The same safety net the card grid keeps: a bubble starts at
     opacity 0 now, so an observer that never delivers would leave an
     empty field rather than a still one. Safe to fire unconditionally —
     the arrival clock only advances while the loop is running, and the
     loop is only running while the field is on screen. */
  setTimeout(() => { armed = true; }, 1200);

  document.addEventListener('visibilitychange', () => {
    settle();
    if (document.hidden) stop(); else if (live && onScreen) start();
  });

  let rTimer;
  addEventListener('resize', () => {
    clearTimeout(rTimer);
    rTimer = setTimeout(() => { setLive(); if (live) measure(); }, 160);
  }, { passive: true });

  setLive();
  /* Fonts land after this file runs and the field's height can move
     with them, so take the measurement again once they have. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { if (live) measure(); });
  }

  /* ── ask → WhatsApp ────────────────────────────────────────
     The anchor is a real wa.me link in the markup, so it works with
     the script blocked; this only replaces the href with a composed
     one just before the browser follows it. */
  const send = document.getElementById('askSend');
  if (send) {
    const val = id => {
      const el = document.getElementById(id);
      return el ? String(el.value || '').trim() : '';
    };
    send.addEventListener('click', () => {
      const name = val('a-name');
      const msg =
        `Hello Lumina — ${name || 'enquiry'} here.\n` +
        `Interested in: ${val('a-svc')}` +
        (val('a-note') ? `\nNotes: ${val('a-note')}` : '') +
        `\n\nCould you tell me how this would work and what it would cost?`;
      send.href = 'https://wa.me/962771505250?text=' + encodeURIComponent(msg);
    });
    const form = document.getElementById('askForm');
    if (form) form.addEventListener('submit', e => { e.preventDefault(); send.click(); });
  }
})();
