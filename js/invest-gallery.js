/* invest.html — the swipeable photograph plate beside #engineer.
 *
 * The swipe is NOT in here. The track is a real overflow-x scroll
 * container with scroll-snap, so touch, trackpad, the scrollbar
 * gesture, the keyboard and the accessibility tree all work before a
 * single line of this file runs — and, more to the point, the thing on
 * screen and the thing the script believes is on screen cannot drift
 * apart, which is the failure mode of every transform-driven track.
 *
 * So this file only ever READS scrollLeft. It writes it in exactly
 * three places, all of them a direct response to a click, a key or the
 * end of a drag. If you find yourself adding a fourth, check first
 * whether CSS can do it.
 *
 * Three further things are deliberate:
 *
 *  - No .tilt on this plate. js/lumina.js's tilt handler writes an
 *    inline transform on every pointermove; a card that leans away
 *    while you are dragging it sideways reads as the drag having
 *    missed. The specular sheen is therefore driven from here, which
 *    is the same trade js/services.js makes for its bubbles.
 *  - scrollTo() is called WITHOUT a behavior, so it inherits the
 *    element's computed scroll-behavior. That is smooth in the
 *    stylesheet and auto under the reduced-motion block, which means
 *    the preference is honoured without this file testing for it.
 *  - The arrows wrap around rather than disabling at the ends. Six
 *    photographs is short enough that a dead arrow is a worse answer
 *    than a loop, and a disabled control that the hover rule then
 *    lights back up to full opacity is worse than both.
 */
(() => {
  'use strict';

  const roots = document.querySelectorAll('[data-gal]');
  if (!roots.length) return;

  const fine = window.matchMedia &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const pad = n => String(n).padStart(2, '0');

  roots.forEach(root => {
    const track = root.querySelector('[data-gal-track]');
    const slides = track ? [...track.querySelectorAll('.gal-slide')] : [];
    if (!track || slides.length < 2) return;

    const count = root.querySelector('[data-gal-count]');
    const dotBox = root.querySelector('[data-gal-dots]');
    const prev = root.querySelector('.gal-prev');
    const next = root.querySelector('.gal-next');
    const n = slides.length;

    let i = 0;
    let raf = null;
    let quiet = false;   /* set while we are the ones moving the track */

    /* ── dots ─────────────────────────────────────────────── */
    const dots = [];
    if (dotBox) {
      slides.forEach((_, k) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'gal-dot';
        b.setAttribute('aria-label', 'Photograph ' + (k + 1) + ' of ' + n);
        b.addEventListener('click', () => go(k));
        dotBox.appendChild(b);
        dots.push(b);
      });
    }

    /* loading="lazy" inside a horizontal scroller is measured against
       the TRACK's scroll port, not the viewport — so with six slides
       at 100% width the browser fetches the first and leaves the rest
       until they are three or four screens of horizontal scroll away
       from being needed, which is to say until they are already being
       swiped onto. Promoting a slide to eager starts its fetch
       immediately, so each one is warmed a step before it is asked
       for. The first slide and its neighbour are warmed at start-up;
       everything else still costs nothing until the reader swipes,
       which is the whole point of keeping them lazy in the markup. */
    const warm = k => {
      for (let d = -1; d <= 1; d++) {
        const s = slides[((k + d) % n + n) % n];
        const img = s && s.querySelector('img[loading="lazy"]');
        if (img) img.loading = 'eager';
      }
    };

    const paint = () => {
      if (count) count.textContent = pad(i + 1) + ' / ' + pad(n);
      dots.forEach((d, k) => {
        d.classList.toggle('on', k === i);
        d.setAttribute('aria-current', k === i ? 'true' : 'false');
      });
      warm(i);
    };

    /* Which slide is showing, measured rather than remembered. Every
       slide is flex:0 0 100%, so the step is the track's own width —
       reading it each time is what makes this survive a resize, an
       orientation change and the 1080px stack without a listener. */
    const at = () => {
      const w = track.clientWidth || 1;
      return Math.max(0, Math.min(n - 1, Math.round(track.scrollLeft / w)));
    };

    const go = k => {
      i = ((k % n) + n) % n;
      quiet = true;
      track.scrollTo({ left: i * track.clientWidth });
      paint();
      /* scroll events keep arriving through a smooth scroll; the flag
         is dropped on a timer rather than on the first of them, or the
         reads below would fight the animation they are watching. */
      clearTimeout(go._t);
      go._t = setTimeout(() => { quiet = false; }, reduce ? 60 : 620);
    };

    track.addEventListener('scroll', () => {
      if (quiet || raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const k = at();
        if (k !== i) { i = k; paint(); }
      });
    }, { passive: true });

    if (prev) prev.addEventListener('click', () => go(i - 1));
    if (next) next.addEventListener('click', () => go(i + 1));

    /* Arrow keys. The container scrolls on its own when focused, but
       by a fraction of a slide, which snap then has to clean up — one
       photograph per press is what a reader expects from a gallery. */
    track.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); }
      else if (e.key === 'Home') { e.preventDefault(); go(0); }
      else if (e.key === 'End') { e.preventDefault(); go(n - 1); }
    });

    /* ── mouse drag ───────────────────────────────────────────
       Touch already has this from the scroll container; a mouse does
       not, and a gallery captioned "swipe" that cannot be dragged with
       a cursor is a broken promise on the desktop the page is mostly
       read on. Snap has to come off for the duration or the browser
       pulls toward the nearest slide on every frame of the drag. */
    if (fine) {
      let down = false, x0 = 0, s0 = 0, moved = 0;

      track.addEventListener('pointerdown', e => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        down = true; moved = 0;
        x0 = e.clientX; s0 = track.scrollLeft;
        track.classList.add('is-drag');
        track.setPointerCapture(e.pointerId);
      });

      track.addEventListener('pointermove', e => {
        if (!down) return;
        const dx = e.clientX - x0;
        if (Math.abs(dx) > moved) moved = Math.abs(dx);
        track.scrollLeft = s0 - dx;
      });

      const release = e => {
        if (!down) return;
        down = false;
        track.classList.remove('is-drag');
        try { track.releasePointerCapture(e.pointerId); } catch (_) {}
        /* A drag shorter than a quarter of a slide is a slip, not a
           swipe, and should land back where it started. */
        const w = track.clientWidth || 1;
        const raw = track.scrollLeft / w;
        go(moved > w * 0.25 ? Math.round(raw) : i);
      };
      track.addEventListener('pointerup', release);
      track.addEventListener('pointercancel', release);
      track.addEventListener('dragstart', e => e.preventDefault());
    }

    /* ── the sheen ────────────────────────────────────────────
       .spec reads --sx/--sy off its card. On every other card on this
       page .tilt writes them; this one has no .tilt, so it writes
       them itself. Dead on touch and under reduced motion, like every
       other pointer effect on the site. */
    if (fine && !reduce) {
      root.addEventListener('pointermove', e => {
        const r = root.getBoundingClientRect();
        root.style.setProperty('--sx', (((e.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
        root.style.setProperty('--sy', (((e.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
      }, { passive: true });
    }

    paint();
  });
})();
