// LUMINA — team.js
//
// Two jobs: reveal the page on scroll, and land a scanned business card
// somewhere sensible.
//
// This file used to call Lumina.activateCards from property-card.js,
// because the roster was built from the same .prop-float shell as a
// property card. The named cards were removed on 2026-08-13, so tilt,
// levitation, cursor parallax and the lightbox have nothing to act on —
// and pulling property-card.js plus property-viewer.js for one
// IntersectionObserver was 31KB to do about twenty lines of work. The
// observer lives here now, and the page loads neither.
//
// It is the same observer property-card.js installs, deliberately: same
// rootMargin, same threshold, same reduced-motion behaviour, same
// safety net. If the two ever need to differ, that is a bug.

(function () {
  'use strict';

  const REVEAL = '.rv:not(.in)';

  const reveal = () => {
    const pending = [...document.querySelectorAll(REVEAL)];
    if (!pending.length) return;

    /* Reduced motion: no staged arrival at all. .tm-rv and .tm-line both
       collapse to their finished state in the stylesheet, so adding .in
       here simply agrees with it. */
    const reduce = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce || !('IntersectionObserver' in window)) {
      pending.forEach(el => el.classList.add('in'));
      return;
    }

    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: .12 });

    pending.forEach(el => io.observe(el));

    /* Safety net, carried over from property-card.js. Everything on this
       page starts at opacity 0, so an observer that never fires leaves a
       blank page rather than a slightly flat one. A partial reveal means
       the observer works and the rest are simply below the fold, so that
       case is left alone. */
    setTimeout(() => {
      if (document.querySelector('.rv.in')) return;
      pending.forEach(el => { el.classList.add('in'); io.unobserve(el); });
    }, 1500);
  };

  /* Business cards in circulation carry a QR encoding team.html#<slug>,
     one slug per person. Those anchors went with the named cards, so the
     browser has nothing to scroll to and a scanned card lands at the top
     of the page as if the QR were broken.

     Anything unrecognised is sent to the desk instead — the section that
     answers the question a scanned card is asking. The slugs themselves
     are not listed here on purpose: they are people's names, and this
     file is served. */
  const rescueDeepLink = () => {
    const hash = (window.location.hash || '').replace('#', '');
    if (!hash || document.getElementById(hash)) return;

    const desk = document.getElementById('desk');
    if (!desk) return;

    const reduce = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Let the reveal settle first, or the section moves out from under
       the scroll position while it is still 16px out of place. */
    setTimeout(() => {
      desk.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }, reduce ? 0 : 260);
  };

  const start = () => { reveal(); rescueDeepLink(); };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
