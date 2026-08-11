// LUMINA — areas-index.js
// The districts page: the plan that follows what you are reading, and
// the counts that correct themselves from the live book.
//
// WHY THERE IS NO SCROLL LISTENER HERE
// invest.html and room.html both pin a section and scrub a 0…1 progress
// through it. This page does the other honest thing: the plan sticks in
// CSS, the districts scroll past it, and an IntersectionObserver hands
// the plan whichever district is in the reading band. The browser does
// the work it is already doing anyway, and this page adds nothing to the
// frame budget in between districts — which matters, because the sticky
// element carries a backdrop-filter.

(function () {
  'use strict';

  const list = document.getElementById('arList');
  const camera = document.getElementById('planCam');
  if (!list) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = [...list.querySelectorAll('.ar-item')];
  const nodes = [...document.querySelectorAll('.ar-node')];
  const label = document.getElementById('planLabel');
  const count = document.getElementById('planCount');
  if (!items.length) return;

  const byNode = new Map();
  nodes.forEach(n => byNode.set(n.dataset.node, n));

  /* ── the plan follows the reading ──────────────────────────
     One transform on one group, from the lit nodes' own coordinates —
     no lookup table, so moving a district on the drawing moves the
     camera with it and the two can never disagree.

     The pan is capped: a plan that recentres hard on every district
     reads as a slideshow of nine separate diagrams rather than as one
     city being looked at from different angles. */
  const CAP = 210;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  let current = null;
  const light = item => {
    if (!item || item === current) return;
    current = item;

    const keys = (item.dataset.node || '').split(',').map(s => s.trim()).filter(Boolean);
    const lit = keys.map(k => byNode.get(k)).filter(Boolean);
    nodes.forEach(n => { n.dataset.on = lit.indexOf(n) > -1 ? '1' : '0'; });
    items.forEach(i => { i.dataset.on = i === item ? '1' : '0'; });

    if (label) label.textContent = item.dataset.key || '';
    if (count) {
      /* read the figure off the item rather than keeping a second copy
         of it here — one number, one place */
      const b = item.querySelector('[data-count]');
      const n = b ? b.textContent.trim() : '';
      count.textContent = n ? n + (n === '1' ? ' residence' : ' residences') : '';
    }

    if (!camera || reduce) return;
    /* the centroid of whatever is lit — for the Circles that is the
       midpoint of three nodes, which is exactly where you would want
       to be standing to see all three */
    let cx = 0, cy = 0;
    lit.forEach(n => { cx += +n.dataset.cx; cy += +n.dataset.cy; });
    if (!lit.length) return;
    cx /= lit.length; cy /= lit.length;
    camera.style.setProperty('--px2', clamp(500 - cx, -CAP, CAP).toFixed(0) + 'px');
    camera.style.setProperty('--py2', clamp(400 - cy, -CAP, CAP).toFixed(0) + 'px');
    camera.style.setProperty('--pz', lit.length > 1 ? '1.1' : '1.25');
  };

  /* The reading band is the middle third of the viewport. rootMargin
     shrinks the observer's box to that band, so a district becomes
     current when it is actually being read rather than when its top
     edge grazes the fold. */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      /* several can be inside the band at once on a tall window; take
         the one nearest its centre, or the plan flickers between two */
      let best = null, bestD = Infinity;
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const r = e.target.getBoundingClientRect();
        const d = Math.abs((r.top + r.height / 2) - innerHeight / 2);
        if (d < bestD) { bestD = d; best = e.target; }
      });
      if (best) light(best);
    }, { rootMargin: '-34% 0px -34% 0px', threshold: 0 });
    items.forEach(i => io.observe(i));
  }

  /* Something has to be lit before the first district reaches the band,
     or the plan opens dead. */
  light(items[0]);

  /* ── the counts correct themselves ────────────────────────
     Every figure on this page ships as a literal so the page is right
     with the script blocked, and is then re-counted from the same data
     the listings page reads. CLAUDE.md records that hardcoded counts go
     stale on a re-import and start the pages lying; this is the cheap
     fix for that. Fails silently — a wrong-by-a-few count is much
     better than an empty one. */
  fetch('data/lumina-demo-leads.json?v=2026-08-06')
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!Array.isArray(data) || !data.length) return;
      const tally = new Map();
      data.forEach(d => {
        const k = String(d.location || '').trim();
        if (k) tally.set(k, (tally.get(k) || 0) + 1);
      });

      document.querySelectorAll('[data-count]').forEach(el => {
        /* the attribute is a comma list because "The Circles" is one
           district to a reader and three keys in the data */
        const n = el.dataset.count.split(',')
          .reduce((s, k) => s + (tally.get(k.trim()) || 0), 0);
        if (n) el.textContent = String(n);
      });

      const total = document.getElementById('tableTotal');
      if (total) total.textContent = String(data.length);
      /* the panel is showing one of them right now */
      if (current) { const c = current; current = null; light(c); }
    })
    .catch(() => {});

  /* ── the enquiry ──────────────────────────────────────────
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
        `Hello Lumina — ${name || 'enquiry'} here, about where to look.\n` +
        `Districts: ${val('r-area')}` +
        (val('r-note') ? `\nNotes: ${val('r-note')}` : '') +
        `\n\nWhich two would you point me at?`;
      send.href = 'https://wa.me/962771505250?text=' + encodeURIComponent(msg);
    });
    const form = document.getElementById('regForm');
    if (form) form.addEventListener('submit', e => { e.preventDefault(); send.click(); });
  }
})();
