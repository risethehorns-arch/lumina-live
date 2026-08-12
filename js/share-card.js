/* Share-card redirect — the human half of p/<id>.html.
   ────────────────────────────────────────────────────────────────
   The card pages exist for link-preview crawlers, which read Open Graph tags
   out of static html and never execute JavaScript. So this file is exactly the
   part a crawler will not see, and that asymmetry is the whole mechanism: the
   crawler stops on the card and reads that property's tags, while a real
   browser is moved on to the real page.

   Why the redirect is here and not an inline <script> or an http-equiv refresh:

     - Inline would violate the site's own CSP (`script-src 'self'`, no
       'unsafe-inline' — see _headers). GitHub Pages ignores _headers today, but
       shipping something the declared policy forbids is how a future move back
       to Netlify turns into 118 broken pages.
     - A <meta http-equiv="refresh"> in <head> fires for crawlers too. Several
       follow it and preview the DESTINATION, which is listings.html — whose own
       og:image is the generic villa. That is the exact bug this replaces. The
       refresh survives only inside <noscript>, where no crawler looks.

   replace(), not assign(): the card must not sit in history, or Back from the
   gallery lands on it and bounces the reader straight forward again.

   ?to=details switches the destination. Both share buttons are deliberately
   different (see CLAUDE.md): the gallery's hands out a gallery link so the
   recipient sees the thing the sender was looking at, and the particulars
   page's hands out the particulars. One card file serves both. */
(function () {
  'use strict';

  var body = document.body;
  if (!body) return;

  var to = '';
  try {
    to = (new URLSearchParams(location.search)).get('to') || '';
  } catch (e) {
    /* Very old browsers have no URLSearchParams. They get the gallery, which is
       the default anyway — not worth a polyfill for a page nobody dwells on. */
  }

  var target = to === 'details'
    ? body.getAttribute('data-details')
    : body.getAttribute('data-gallery');

  /* The attributes are written by the generator. If one is missing the page is
     malformed, and the visible card underneath is a perfectly good fallback —
     it names the property and links to it. Better a page than a blank tab. */
  if (target) location.replace(target);
})();
