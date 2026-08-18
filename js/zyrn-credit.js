/* ══════════════════════════════════════════════════════════════════════
   LUMINA — the Zyrn credit's shear latch and glitch schedule

   Ported from Zyrn's assets/js/ui.js. Two jobs, and nothing else:

     1. latch the shear open shortly after load
     2. fire the glitch at irregular intervals

   WHY THIS IS A FILE AND NOT AN INLINE SCRIPT
   -------------------------------------------
   `_headers` sets script-src 'self'. An inline <script> is refused by the
   live origin without a nonce, and refused silently as far as the reader
   is concerned — the mark would simply never shear. Every script on this
   site is external for the same reason.

   WHY THE SCHEDULE IS RANDOM
   --------------------------
   A fixed setInterval reads as a metronome, which is the opposite of a
   glitch. Real signal artefacts cluster: long quiet stretches, then two
   or three in quick succession. Each mark keeps its own schedule, so two
   credits on one page never sync up.

   WHY THE CLONES ARE BUILT AT FIRE TIME
   -------------------------------------
   They snapshot the mark's CURRENT shear state. Built at init they would
   snapshot an un-sheared wordmark and, once the latch opened, every burst
   would throw a straight ghost across a sheared original.
   ══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var roots = document.querySelectorAll('.zc .glitch');
  if (!roots.length) return;

  var reduced = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── the latch ──────────────────────────────────────────────────
     Two frames, not one: the transition has to be applied to an
     element that has already been laid out, or the browser folds the
     start and end states into a single style resolution and the shear
     appears open with no travel. */
  var marks = document.querySelectorAll('.zc .shear--auto');
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      setTimeout(function () {
        for (var i = 0; i < marks.length; i++) marks[i].classList.add('is-sheared');
      }, 300);
    });
  });

  if (reduced) return;

  var GHOSTS = 2;

  function makeGhosts(el) {
    var src = el.querySelector('.shear');
    if (!src) return [];
    var out = [];
    for (var i = 0; i < GHOSTS; i++) {
      var g = document.createElement('span');
      g.className = 'glitch__ghost glitch__ghost--' + (i === 0 ? 'a' : 'b');
      g.setAttribute('aria-hidden', 'true');
      var clone = src.cloneNode(true);
      clone.removeAttribute('id');
      // an absolutely-positioned clone does not land where an inline-block
      // original sits on the baseline — measure rather than assume, or every
      // slice arrives with a vertical offset the keyframes never asked for
      g.style.left = src.offsetLeft + 'px';
      g.style.top = src.offsetTop + 'px';
      g.appendChild(clone);
      el.appendChild(g);
      out.push(g);
    }
    return out;
  }

  function isVisible(el) {
    var r = el.getBoundingClientRect();
    if (!r.width && !r.height) return false;
    return r.bottom > 0 && r.top < (window.innerHeight || 0);
  }

  function schedule(el) {
    var burstLeft = 0;

    function fire() {
      // never glitch a mark that is not on screen — an effect nobody sees
      // that still costs a composite. The credit lives in the footer, so
      // this is off for almost the whole visit.
      if (!document.hidden && isVisible(el)) {
        var micro = Math.random() < 0.42;
        var cls = micro ? 'is-glitching--micro' : 'is-glitching';
        var ghosts = micro ? [] : makeGhosts(el);
        el.classList.add(cls);
        setTimeout(function () {
          el.classList.remove(cls);
          for (var i = 0; i < ghosts.length; i++) {
            if (ghosts[i].parentNode) ghosts[i].parentNode.removeChild(ghosts[i]);
          }
        }, micro ? 150 : 320);
      }
      next();
    }

    function next() {
      var delay;
      if (burstLeft > 0) {
        burstLeft--;
        delay = 110 + Math.random() * 240;          // stutter inside a burst
      } else {
        delay = 1800 + Math.random() * 3400;        // quiet stretch
        var r = Math.random();
        if (r < 0.22) burstLeft = 2;                // occasional triple
        else if (r < 0.62) burstLeft = 1;           // frequent double
      }
      setTimeout(fire, delay);
    }

    next();
  }

  for (var i = 0; i < roots.length; i++) schedule(roots[i]);
})();
