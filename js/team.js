// LUMINA — team.js
//
// Almost nothing, on purpose. The roster is built from the same
// .prop-float shell as every property card, so reveal, levitation, tilt
// and the pointer-tracked specular highlight all come from
// js/property-card.js — the same code the listings grid and the landing
// page run. This file only starts it, and handles the deep link a
// scanned QR arrives on.

(function () {
  'use strict';

  const start = () => {
    const L = window.Lumina;
    if (!L || typeof L.activateCards !== 'function') {
      console.error('Lumina: property-card.js did not load — the roster will not animate');
      /* Cards start at opacity 0 under .rv. If the shared code is
         missing, show them rather than leaving a blank page. */
      document.querySelectorAll('.prop-float.rv').forEach(el => el.classList.add('in'));
      return;
    }
    L.activateCards(document);
    focusDeepLink();
  };

  /* Every business card's QR encodes team.html#<slug>. Arriving that way
     should land on that person, and say so — the reveal animation means
     the browser's own scroll-to-anchor fires against an element that is
     still transparent and 26px out of place. */
  const focusDeepLink = () => {
    const id = (window.location.hash || '').replace('#', '');
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;

    target.classList.add('in', 'tm-arrived');

    const reduce = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Wait for the reveal to settle before scrolling, or the card moves
       out from under the scroll position. */
    setTimeout(() => {
      target.scrollIntoView({
        behavior: reduce ? 'auto' : 'smooth',
        block: 'center'
      });
    }, reduce ? 0 : 260);

    /* The ring is a hint, not a state — drop it once it has been seen. */
    setTimeout(() => target.classList.remove('tm-arrived'), 4200);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
