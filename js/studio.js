// LUMINA — studio.js
// The scroll-built brand-and-site on lumina-studio.html.
//
// Same engine as js/room.js and js/invest.js: one pinned section, one
// 0…1 progress, and every moving thing a pure function of it. Nothing
// holds a timer and nothing integrates a spring, so scrolling back up
// un-builds the site exactly as carefully as scrolling down built it —
// the posts fold back into the phone, the skin lifts off the wireframe,
// the type un-sets and the mark spins out.
//
// The difference from those two is the subject: they draw architecture,
// this drives DOM. A website mock made of real elements is the honest
// material for a studio that builds websites out of real elements.
//
// js/lumina.js owns the bar, the spine and its own rAF-gated scroll
// listener. This adds ONE more rather than reaching into it, because
// the two ship independently — same shape, same gating, and under
// reduced motion this one binds nothing at all.

(function () {
  'use strict';

  const stage = document.getElementById('stStage');
  const section = document.getElementById('build');
  if (!stage || !section) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const span = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const smooth = t => t * t * (3 - 2 * t);
  const easeOutQuart = t => 1 - Math.pow(1 - t, 4);
  const easeOutBack = t => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
  /* Decaying oscillation, exactly zero at both ends. Every settle in
     the piece is this with different n and d. NOTE it is 1 at t=0, not
     0 — it only ever belongs AFTER a landing, or the piece sits at its
     amplitude from the first frame. That bug cost an afternoon on
     room.js; do not repeat it here. */
  const osc = (t, n, d) => Math.cos(t * Math.PI * n) * Math.exp(-t * d) * (1 - t);

  const ARM = 0.94;
  const READING = 0.20;

  /* ── the write cache ──────────────────────────────────────────
     setProperty invalidates the element's subtree. Most of these are
     the same string they were last frame, and comparing is cheaper
     than the invalidation. */
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
    if (el && el.getAttribute(name) !== val) el.setAttribute(name, val);
  };

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  const cam = $('#stCam');
  const win = $('#stWin');
  const url = $('#stUrl');
  const guides = $('#stGuides');
  const brand = $('#stBrand');
  const ring = $('#stRing');
  const mono = $('#stMono');
  const spec1 = $('#stSpec1');
  const spec2 = $('#stSpec2');
  const chips = $$('.st-chip');
  const blocks = $$('.st-b');
  const phone = $('#stPhone');
  const posts = $$('.st-post');
  const flash = $('#stFlash');
  const intro = $('#stIntro');
  const svgRoot = $('#stStage');

  /* The intro's one instruction, in both of its truths. It is its own
     element (and its own text node, after the dot) precisely so this can
     swap without a script editing a sentence. Crossing the 861px
     breakpoint mid-session flips it back, which is why setScene sets it
     too rather than flat() setting it once. */
  const cue = $('#stCue');
  const cueNode = cue && cue.lastChild;
  const CUE_LIVE = cueNode ? cueNode.nodeValue : '';
  const CUE_FLAT = 'Brand, site and posts — as delivered';
  const setCue = live => {
    if (!cueNode) return;
    const v = live ? CUE_LIVE : CUE_FLAT;
    if (cueNode.nodeValue !== v) cueNode.nodeValue = v;
  };

  /* Blocks land in reading order — bar, hero, then the three cards left
     to right, then the footer. Each carries its own direction of travel
     in the markup (--dx/--dy) so no two arrive the same way. */
  const BLOCK_A = 0.300, BLOCK_B = 0.460;
  const SKIN_A = 0.440, SKIN_B = 0.560;
  const CONT_A = 0.540, CONT_B = 0.660;

  /* ── the reading panel ────────────────────────────────────────
     Copy is read out of the real <ol> in the document rather than held
     in an array here, so there is one copy of it: it survives JS being
     blocked and a crawler sees it. */
  const read = $('#stRead');
  const readTag = $('#stReadTag');
  const readName = $('#stReadName');
  const readNote = $('#stReadNote');
  const entries = $$('#stSchedule li').map(li => ({
    tag: li.dataset.tag, name: li.dataset.name, note: li.textContent.trim(),
  }));

  let shown = -2, swapTimer = null;
  const show = i => {
    if (i === shown) return;
    shown = i;
    const e = entries[i];
    if (!e) return;
    const paint = () => {
      readTag.textContent = e.tag;
      readName.textContent = e.name;
      readNote.textContent = e.note;
      read.classList.remove('out');
    };
    if (reduce) { paint(); return; }
    read.classList.add('out');
    /* 190ms against the stylesheet's .18s fade: the repaint lands the
       frame AFTER the fade has bottomed out. The two are one number. */
    clearTimeout(swapTimer);
    swapTimer = setTimeout(paint, 190);
  };

  /* ── the act rail ─────────────────────────────────────────────
     Four acts, not ten stages: the rail is the argument of the page
     restated as navigation, and a reader who has scrolled once can see
     the whole shape of what is coming. It renders along the FOOT of the
     frame — see the note on .st-rail in css/studio.css: this page also
     carries lumina.js's fixed #spine down the right edge, and two
     columns of dots is one column too many. */
  const ACTS = [
    { at: 0.13, label: 'Brand' },
    { at: 0.30, label: 'Site' },
    { at: 0.72, label: 'Social' },
    { at: 0.86, label: 'Yours' },
  ];
  const rail = $('#stRail');
  const ticks = [];

  const scrollToP = target => {
    const total = section.offsetHeight - innerHeight;
    scrollTo({ top: section.offsetTop + total * target, behavior: reduce ? 'auto' : 'smooth' });
  };

  if (rail) {
    const frag = document.createDocumentFragment();
    ACTS.forEach(a => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'st-tick';
      b.dataset.on = 'future';
      const s = document.createElement('span');
      s.textContent = a.label;
      b.appendChild(s);
      b.setAttribute('aria-label', 'Jump to ' + a.label);
      /* +0.02 so a click lands just INSIDE the act rather than on its
         first frame, where nothing has started moving yet and the jump
         reads as having done nothing. */
      b.addEventListener('click', () => scrollToP(Math.min(a.at + 0.02, 1)));
      ticks.push(b);
      frag.appendChild(b);
    });
    rail.appendChild(frag);
  }

  const stStatus = $('#stStatus');
  const stStep = $('#stStep');
  let lastStatus = '';

  /* ── the scene ────────────────────────────────────────────────
     Read the phase table at the top of css/studio.css alongside this. */
  const setScene = p => {

    /* ── the sheet ── */
    const winIn = easeOut(span(p, 0.05, 0.13));
    set(win, '--win-o', winIn.toFixed(3));
    set(guides, '--guides', (span(p, 0.09, 0.16) * (1 - span(p, 0.68, 0.74)) * 0.9).toFixed(3));

    /* ── ACT 1 · the brand ── */
    const brandIn = easeOut(span(p, 0.12, 0.20));
    set(brand, '--brand-o', brandIn.toFixed(3));
    set(brand, '--brand-x', ((1 - brandIn) * -24).toFixed(1) + 'px');
    set(ring, '--ring', easeOutQuart(span(p, 0.13, 0.20)).toFixed(3));
    set(mono, '--mono', easeOut(span(p, 0.17, 0.23)).toFixed(3));
    set(spec1, '--t1', easeOutQuart(span(p, 0.20, 0.245)).toFixed(3));
    set(spec2, '--t2', easeOutQuart(span(p, 0.228, 0.272)).toFixed(3));
    chips.forEach((c, i) => {
      const t = span(p, 0.24 + i * 0.022, 0.30 + i * 0.022);
      /* a drop with one settle — the chips are the only thing in the
         piece that bounces, which is what makes them read as objects */
      let v = easeOut(t);
      if (t > 0.75) v += osc((t - 0.75) / 0.25, 1, 8) * 0.07;
      set(c, '--c', v.toFixed(3));
    });

    /* ── ACT 2 · the site ── */
    const n = blocks.length;
    const step = (BLOCK_B - BLOCK_A) / n;
    blocks.forEach((b, i) => {
      /* OVERLAP 2.2: a block is still settling while the next starts to
         arrive. Without it the wireframe ticks like a metronome. */
      const t = span(p, BLOCK_A + i * step, BLOCK_A + (i + 2.2) * step);
      set(b, '--p', easeOutQuart(t).toFixed(3));
      /* the skin sweeps the same order, so the page dresses itself in
         the direction it was drawn */
      const s = span(p, SKIN_A + i * ((SKIN_B - SKIN_A) / n) * 0.8,
                        SKIN_A + (i + 2.4) * ((SKIN_B - SKIN_A) / n) * 0.8);
      set(b, '--skin', smooth(s).toFixed(3));
      const c = span(p, CONT_A + i * ((CONT_B - CONT_A) / n) * 0.8,
                        CONT_A + (i + 2.4) * ((CONT_B - CONT_A) / n) * 0.8);
      set(b, '--content', smooth(c).toFixed(3));
      setAttr(b, 'data-live', t > 0 && t < 1 ? '1' : '0');
    });

    /* the address bar types itself as the page becomes real */
    set(url, '--url', smooth(span(p, 0.66, 0.72)).toFixed(3));

    /* ── it ships ──
       One flash, capped well under white. This is the peak of the
       piece and it lands in the silence engineered at .64–.70. */
    const shipT = span(p, 0.68, 0.73);
    set(flash, '--flash', (Math.sin(shipT * Math.PI) * 0.55).toFixed(3));

    /* ── ACT 3 · the social ── */
    set(phone, '--phone', easeOut(span(p, 0.72, 0.80)).toFixed(3));
    posts.forEach((el, i) => {
      const t = span(p, 0.76 + i * 0.028, 0.84 + i * 0.028);
      set(el, '--o', easeOutBack(t).toFixed(3));
    });

    /* ── the camera ──
       Pulls back from the frame to the whole desk, and is DELIBERATELY
       STILL from .78. invest.js's camera runs to .86 and its ending is
       restless because of it; stillness at the end is what makes a
       finished thing feel finished.

       --cam-y rides `built`, the work's own progress, not p — the same
       correction invest.js documents as "the worst thing about the
       first cut". */
    setCue(true);
    const built = smooth(span(p, 0.10, 0.86));
    const z = smooth(span(p, 0.10, 0.78));
    set(cam, '--cam-z', (1.14 - z * 0.14).toFixed(4));
    set(cam, '--cam-y', ((1 - built) * 18).toFixed(1) + 'px');
    /* a slow drift right then back: the brand panel arrives on the left
       and the phone on the right, and the camera leans toward whichever
       is being made */
    const sx = smooth(span(p, 0.10, 0.45)), sx2 = smooth(span(p, 0.62, 0.90));
    set(cam, '--cam-x', (sx * 26 - sx2 * 38).toFixed(1) + 'px');

    /* ── the title ── invest.html's exact exit, deliberately. This
       should read as the same firm's next drawing. */
    const gone = span(p, 0.03, 0.19);
    set(intro, '--intro-o', (1 - gone).toFixed(3));
    set(intro, '--intro-y', (gone * -70).toFixed(1) + 'px');
    set(intro, '--intro-b', (gone * 12).toFixed(1) + 'px');
    set(intro, '--intro-pe', gone > 0.5 ? 'none' : 'auto');

    /* ── chrome ── */
    let now = 0;
    ACTS.forEach((a, i) => { if (p >= a.at) now = i; });
    ticks.forEach((b, i) => setAttr(b, 'data-on', i < now ? 'past' : i === now ? 'now' : 'future'));
    if (stStep) {
      const s = String(Math.min(now + 1, ACTS.length)).padStart(2, '0') + ' / 04';
      if (stStep.textContent !== s) stStep.textContent = s;
    }

    const st = p < 0.05 ? 'Brief'
      : p < 0.13 ? 'Setting out'
      : p < 0.30 ? 'Brand'
      : p < 0.66 ? 'Build ' + Math.round(span(p, 0.30, 0.66) * 100) + '%'
      : p < 0.73 ? 'Shipping'
      : p < 0.86 ? 'Social'
      : 'Yours';
    if (stStatus && st !== lastStatus) { lastStatus = st; stStatus.textContent = st; }

    stage.classList.toggle('reading', p >= READING);
    stage.classList.toggle('armed', p >= ARM);

    /* Before it arms the panel narrates whichever act is running; after,
       the pointer takes over and this stops fighting it. */
    if (p < ARM) show(now);
  };

  /* ── the finished frame, for phones and reduced motion ────────
     Every driver written to its end state, once. It must add BOTH
     .reading and .armed — CLAUDE.md names this, and it bit both
     previous set-pieces. */
  const flat = () => {
    set(win, '--win-o', '1');
    set(guides, '--guides', '0');
    set(brand, '--brand-o', '1'); set(brand, '--brand-x', '0px');
    set(ring, '--ring', '1'); set(mono, '--mono', '1');
    set(spec1, '--t1', '1'); set(spec2, '--t2', '1');
    chips.forEach(c => set(c, '--c', '1'));
    blocks.forEach(b => {
      set(b, '--p', '1'); set(b, '--skin', '1'); set(b, '--content', '1');
      setAttr(b, 'data-live', '0');
    });
    set(url, '--url', '1');
    set(flash, '--flash', '0');
    set(phone, '--phone', '1');
    posts.forEach(el => set(el, '--o', '1'));
    set(cam, '--cam-x', '0px'); set(cam, '--cam-y', '0px'); set(cam, '--cam-z', '1');
    set(intro, '--intro-o', '1'); set(intro, '--intro-y', '0px');
    set(intro, '--intro-b', '0px'); set(intro, '--intro-pe', 'auto');
    if (stStatus) stStatus.textContent = 'Yours';
    if (stStep) stStep.textContent = '04 / 04';
    /* "Scroll to build it" is a lie in the flat state — there is no
       build to scroll. The finished thing is simply below. */
    setCue(false);
    ticks.forEach(b => setAttr(b, 'data-on', 'past'));
    stage.classList.add('reading', 'armed');
    show(entries.length - 1);
  };

  /* The pin only exists on a wide viewport with motion allowed. Below
     861px — invest's breakpoint, not a new one — the stylesheet drops
     the pin entirely, and a static mock must not be driven by a scroll
     position that no longer means anything. Re-checked on resize
     because crossing that breakpoint mid-session is a real thing. */
  const pinned = () => !reduce && matchMedia('(min-width: 861px)').matches;

  const onScrollStudio = () => {
    if (!pinned()) return;
    const r = section.getBoundingClientRect();
    const total = r.height - innerHeight;
    setScene(total > 0 ? clamp(-r.top / total, 0, 1) : 1);
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScrollStudio(); ticking = false; });
  };

  const settle = () => { if (pinned()) onScrollStudio(); else flat(); };

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

  /* ── the way out ──────────────────────────────────────────────
     A four-viewport pin you cannot escape is a trap. The button is the
     first tab stop inside the pin and Escape does the same thing. */
  const skip = $('#stSkip');
  const target = $('#proof');
  const bail = () => target && target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  if (skip) skip.addEventListener('click', bail);
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && section.getBoundingClientRect().top < 0) bail();
  });
})();
