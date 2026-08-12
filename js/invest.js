// LUMINA — invest.js
// Everything invest.html does that js/lumina.js does not: the scroll-
// assembled building section, the programme rail, and the register
// form's handoff to WhatsApp.
//
// lumina.js already owns the reveal observer, the headline split, the
// cursor light, .tilt and .mag, and the single throttled scroll
// listener for the bar and the spine. This file adds ONE more scroll
// listener rather than reaching into that one, because the two files
// ship independently — but it is rAF-gated the same way, and both
// bail immediately under reduced motion.

(function () {
  'use strict';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* Map v from [a,b] onto [0,1], clamped. Every phase on this page is
     one of these, which is what keeps them all in step: nothing here
     holds its own timer, so scrubbing backwards is exact and there is
     no state to get out of sync with the scroll position. */
  const span = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
  /* Cubic ease-out — fast arrival, long settle. Slabs land under it. */
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  /* Smoothstep — eased at both ends. The camera moves under this, so
     it never starts or stops abruptly against the scroll. */
  const smooth = t => t * t * (3 - 2 * t);

  /* ─────────────────────────────────────────────────────────
     The schedule of accommodation.

     THIS IS SCHEMATIC AND THE PAGE SAYS SO. It describes how a
     building of this kind is put together, not the schedule of any
     particular one — there is no real building's data on this site
     yet. When the client supplies one, this table is the only thing
     that needs to change: the drawing, the level tags, the reading
     panel and the keyboard order all come from it.

     Listed top-down, the way a section is read and labelled. The DOM
     is column-reverse, so index 0 ends up at the top.

       h     slab height in px
       w     plate width as a fraction of the footprint — the roof and
             top floor step back, the basement runs out to the raft.
             Without this the section is a bar chart, not a building.
       wins  panes across the elevation
       dark  which of those stay unlit — a building with every
             window on reads as a render, not a building
     ───────────────────────────────────────────────────────── */
  const LEVELS = [
    { tag: 'Roof', h: 30, w: 0.56, wins: 0, name: 'Roof terrace',
      note: 'Communal terrace and plant. Tanks, lift overrun and condensers are boxed and screened — the roof is a room, not a machine deck.' },
    { tag: 'L5', h: 74, w: 0.84, wins: 4, dark: [3], name: 'Upper floor',
      note: 'The plate steps back and the terrace comes with it. Usually taken as a single residence, and usually the first to go.' },
    { tag: 'L4', h: 70, w: 0.96, wins: 5, dark: [1], name: 'Typical floor',
      note: 'A typical plate: dual aspect both sides, and no living room sharing a party wall with a neighbour’s. Divisible while the blockwork is still open.' },
    { tag: 'L3', h: 70, w: 0.96, wins: 5, dark: [4], name: 'Typical floor',
      note: 'Identical to the floor below it — which is the point. A repeated plate is what makes a building quick to put up and quick to price.' },
    { tag: 'L2', h: 70, w: 0.96, wins: 5, dark: [0, 3], name: 'Typical floor',
      note: 'Risers, drainage and the lift core run through the same position on every plate, so services never cross a room they should not.' },
    { tag: 'L1', h: 70, w: 0.96, wins: 5, dark: [2], name: 'First floor',
      note: 'The first plate off the ground. High enough to be private from the street, low enough to keep the garden in view.' },
    { tag: 'G', h: 80, w: 0.96, wins: 4, dark: [0], name: 'Ground',
      note: 'Entrance lobby and the ground residence with its own terrace. The lobby is the one part of a building every owner uses and nobody owns.' },
    { tag: 'B1', h: 56, w: 1, wins: 0, name: 'Basement',
      note: 'Parking, stores, pumps, generator and the water tanks. Waterproofing and drainage are inspected here before anything is closed up.' },
  ];

  const bld = document.getElementById('bld');
  const stage = document.getElementById('stage');
  if (!bld || !stage) return;

  /* ── build the section ─────────────────────────────────── */
  const dim = document.getElementById('dim');
  const levels = LEVELS.map((L, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'lvl';
    el.dataset.i = String(i);
    el.style.setProperty('--p', '0');
    el.setAttribute('aria-label', `${L.tag} — ${L.name}`);
    /* Out of the tab order until the stage arms — see arm() below. A
       level starts at opacity:0 and ignores every event until then, so
       shipped as-is these were eight invisible tab stops at the very top
       of <main> that swallowed focus, showed no ring (opacity composites
       the focus outline away with everything else) and did nothing. */
    el.tabIndex = -1;

    const tag = document.createElement('span');
    tag.className = 'lvl-tag';
    tag.textContent = L.tag;

    const slab = document.createElement('span');
    slab.className = 'lvl-slab';
    slab.style.setProperty('--h', L.h + 'px');
    slab.style.setProperty('--w', String(L.w == null ? 1 : L.w));
    for (let w = 0; w < L.wins; w++) {
      const pane = document.createElement('i');
      pane.className = 'win';
      pane.style.setProperty('--w', String(w));
      if (L.dark && L.dark.indexOf(w) > -1) pane.dataset.dark = '1';
      slab.appendChild(pane);
    }

    el.append(tag, slab);
    return el;
  });

  /* Top-down in LEVELS, and .bld is column-reverse, so appending in
     reverse puts the roof at the top and the basement at the bottom. */
  const frag = document.createDocumentFragment();
  for (let i = levels.length - 1; i >= 0; i--) frag.appendChild(levels[i]);
  const ground = document.createElement('span');
  ground.className = 'bld-ground';
  ground.setAttribute('aria-hidden', 'true');
  /* The ground line belongs between L?G and B1 — in a column-reverse
     flow that means inserting it before the basement, which is the
     first child appended above. */
  frag.insertBefore(ground, frag.children[1]);
  bld.insertBefore(frag, dim);

  /* ── the reading panel ─────────────────────────────────── */
  const read = document.getElementById('read');
  const readTag = document.getElementById('readTag');
  const readName = document.getElementById('readName');
  const readNote = document.getElementById('readNote');
  let shown = -1, swapTimer = null;

  const show = i => {
    if (i === shown) return;
    shown = i;
    const L = LEVELS[i];
    const paint = () => {
      readTag.textContent = L.tag === 'Roof' || L.tag === 'G' || L.tag === 'B1'
        ? L.tag.toUpperCase() : 'Level ' + L.tag.slice(1);
      readName.textContent = L.name;
      readNote.textContent = L.note;
      read.classList.remove('out');
    };
    levels.forEach((el, n) => el.classList.toggle('on', n === i));
    if (reduce) { paint(); return; }
    read.classList.add('out');
    clearTimeout(swapTimer);
    /* 190ms against a .18s fade in the stylesheet: the repaint lands the
       frame AFTER the fade has bottomed out. The two are one number —
       change either and change both, or the copy swaps under a fade that
       is still running and the new note rises out of the old one. */
    swapTimer = setTimeout(paint, 190);
  };

  /* ── the note's height reservation ──────────────────────────
     The panel is anchored on its own centre, so a note two lines longer
     than the one before it grows the panel upwards and downwards at the
     same time — under the crossfade, which is exactly what the crossfade
     was written to hide. Reserve the tallest note in the table instead of
     a guessed line count, measured at the width the panel is actually at.

     A hidden probe rather than readNote itself: #read is aria-live, and
     writing eight notes through the live paragraph to measure them would
     announce all eight. The probe is aria-hidden and visibility:hidden,
     which is silent and still has a layout box to measure. */
  const probe = document.createElement('p');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;visibility:hidden;top:0;margin:0;min-height:0';
  const measureRead = () => {
    if (!read || !readNote) return;
    const w = readNote.clientWidth;
    if (!w) return;
    probe.style.width = w + 'px';
    read.appendChild(probe);
    let max = 0;
    for (const L of LEVELS) {
      probe.textContent = L.note;
      if (probe.offsetHeight > max) max = probe.offsetHeight;
    }
    read.removeChild(probe);
    read.style.setProperty('--read-min', max + 'px');
  };

  /* ── arming ────────────────────────────────────────────────
     The one place `armed` is turned on or off, because it is two
     things at once: the class the stylesheet reads, and whether the
     levels are keyboard-reachable. They must not drift apart — a
     control that cannot respond has no business holding a tab stop,
     and one that can must hold one. Guarded on the current state
     because setScene runs on every scrolled frame and this writes
     eight elements. */
  let armed = null;
  const arm = on => {
    if (on === armed) return;
    armed = on;
    stage.classList.toggle('armed', on);
    levels.forEach(el => { el.tabIndex = on ? 0 : -1; });
  };

  levels.forEach((el, i) => {
    /* pointerenter, not mouseover: it does not bubble from the panes
       and it fires once per level rather than once per child. */
    el.addEventListener('pointerenter', () => { if (armed) show(i); });
    el.addEventListener('focus', () => { if (armed) show(i); });
    /* Gated like the other two. A level at p=0 is a transparent box
       that still takes a click, and an ungated one made the panel
       narrate a floor that had not been built yet. */
    el.addEventListener('click', () => { if (armed) show(i); });
    el.addEventListener('keydown', e => {
      /* The section reads bottom-up on screen but the array is
         top-down, so Down moves to the next index and Up to the
         previous — which is what the arrows look like they do. */
      let next = null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = i + 1;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = i - 1;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = levels.length - 1;
      if (next === null) return;
      e.preventDefault();
      levels[clamp(next, 0, levels.length - 1)].focus();
    });
  });

  /* ── the scene ─────────────────────────────────────────────
     One progress value drives everything. The phase constants are
     the whole score; move one and the others still line up, because
     nothing is expressed in seconds.

     Levels are given OVERLAP more range than their own slice, so a
     slab is still settling while the next one starts to arrive.
     Without it the assembly ticks like a metronome; with it, it
     flows. */
  const buildSec = document.getElementById('build');
  const cam = document.getElementById('cam');
  const env = document.getElementById('env');
  const cur = document.getElementById('cur');
  const intro = document.getElementById('intro');
  const tbStatus = document.getElementById('tbStatus');
  const stackFrame = document.querySelector('.stack-frame');

  const START = 0.06;     // ground broken
  const ASSEMBLE = 0.76;  // last slab lands
  const ARM = 0.86;       // levels become controls
  const OVERLAP = 1.7;    // each level's travel, in slice-widths

  const n = levels.length;
  const step = (ASSEMBLE - START) / n;

  let lastStatus = '';
  const status = s => {
    if (!tbStatus || s === lastStatus) return;
    lastStatus = s;
    tbStatus.textContent = s;
  };

  const setScene = p => {
    /* ── levels ── */
    let front = -1;
    for (let i = 0; i < n; i++) {
      /* index 0 in LEVELS is the roof, so invert — the basement is
         built first. */
      const order = n - 1 - i;
      const t = span(p, START + order * step, START + (order + OVERLAP) * step);
      const lp = easeOut(t);
      levels[i].style.setProperty('--p', lp.toFixed(4));
      levels[i].dataset.lit = lp > 0.9 ? '1' : '0';
      /* The construction line belongs on the HIGHEST level still
         moving, and the loop runs top-down, so it is the first match
         and not the last. Taking the last pinned the line to the
         basement for the whole of the first quarter, because the levels
         overlap and the one below is always still settling. */
      if (front < 0 && t > 0 && t < 1) front = i;
    }

    /* ── camera ──
       The building's box is a fixed height and bottom-anchored, so the
       part that actually exists is always at the BOTTOM of it. Left
       alone, the first half of the scroll frames an empty rectangle
       with the ground line hanging off the bottom edge — measured, and
       it was the worst thing about the first cut.

       So the camera rides the work: it sits low over the plot, and
       rises as the building rises, keeping the slab being placed near
       the middle of the screen. `built` is the assembly's own progress,
       which is what makes the rise feel driven by the building rather
       than by the scrollbar.

       One element, one transform, so the whole scene moves as a scene. */
    const built = smooth(span(p, START, ASSEMBLE));
    const c = smooth(span(p, 0, ARM));
    const cx = smooth(span(p, 0, 0.42));
    /* Sideways it does not just return to centre — it overshoots left,
       because the reading panel is floating over the right of the stage
       by the time the building is up. Centred, the plates ran under it.
       Right of centre at the start also keeps the empty plot out from
       behind the title. */
    cam.style.setProperty('--cam-x', ((1 - cx) * 15 - cx * 12).toFixed(2) + '%');
    cam.style.setProperty('--cam-y', ((1 - built) * -28).toFixed(2) + '%');
    cam.style.setProperty('--cam-s', (1.22 - c * 0.22).toFixed(4));

    /* ── the title ──
       Leaves early: it has said its piece by the time the second
       slab is in the air, and it must not compete with the thing it
       introduced. pointer-events go with it, or it eats clicks on
       levels underneath. */
    const gone = span(p, 0.03, 0.19);
    intro.style.setProperty('--intro-o', (1 - gone).toFixed(3));
    intro.style.setProperty('--intro-y', (gone * -70).toFixed(1) + 'px');
    intro.style.setProperty('--intro-b', (gone * 12).toFixed(1) + 'px');
    intro.style.setProperty('--intro-pe', gone > 0.5 ? 'none' : 'auto');

    /* ── setting-out envelope ──
       In before anything is built, out once the building has filled
       it. It contracts onto the building rather than just fading, so
       it reads as the volume being taken up. */
    if (env) {
      const inn = span(p, 0, 0.05);
      const out = span(p, ASSEMBLE - 0.06, ARM);
      /* It carries a base 0.34 rather than starting at nothing: at
         p exactly 0 the plot is empty, and an empty plot with no
         envelope on it is just an empty screen. The dashed volume is
         what the title state is standing in front of. */
      env.style.setProperty('--env-o', ((0.34 + inn * 0.56) * (1 - out)).toFixed(3));
      env.style.setProperty('--env-s', (1.06 - smooth(inn) * 0.06 + out * 0.012).toFixed(4));
    }

    /* ── construction line ──
       Rides the top of whatever is being placed. offsetTop is layout
       position, so it is unaffected by the level's own transform —
       the line sits where the slab is going, not where it is. */
    if (cur) {
      if (front >= 0) {
        cur.style.setProperty('--cur-y', levels[front].offsetTop + 'px');
        cur.style.setProperty('--cur-o', '1');
      } else {
        cur.style.setProperty('--cur-o', '0');
      }
    }

    if (dim) dim.style.setProperty('--d', smooth(span(p, START, ASSEMBLE)).toFixed(3));
    /* Two states, deliberately apart: the panel starts narrating the
       assembly as soon as the title has cleared, and only becomes a
       control surface once there is a finished building to point at. */
    stage.classList.toggle('reading', p >= 0.22);
    arm(p >= ARM);

    /* ── the sheet's status cell ── */
    if (p < START) status('Setting out');
    else if (p < ASSEMBLE) status('Structure ' + Math.round(span(p, START, ASSEMBLE) * 100) + '%');
    else if (p < ARM) status('Topped out');
    else status('Ready');
  };

  const flat = () => {
    levels.forEach(el => { el.style.setProperty('--p', '1'); el.dataset.lit = '1'; });
    if (dim) dim.style.setProperty('--d', '1');
    if (env) env.style.setProperty('--env-o', '0');
    if (cur) cur.style.setProperty('--cur-o', '0');
    if (cam) { cam.style.removeProperty('--cam-x'); cam.style.removeProperty('--cam-y'); cam.style.removeProperty('--cam-s'); }
    if (intro) { intro.style.setProperty('--intro-o', '1'); intro.style.setProperty('--intro-y', '0px');
                 intro.style.setProperty('--intro-b', '0px'); intro.style.setProperty('--intro-pe', 'auto'); }
    status('Ready');
    stage.classList.add('reading');
    /* through arm(), not classList.add, so the levels pick up their tab
       stops here too — on a phone and under reduced motion they are the
       only state there is */
    arm(true);
  };

  /* ── fit ───────────────────────────────────────────────────
     The building is measured against the stage rather than given a
     fixed height, so it fills a 13-inch laptop and a 27-inch display
     equally. --k scales every slab; --bld-w widens the footprint to
     match, or a tall building on a short screen ends up a tower. */
  /* Only the slab heights scale with --k. Borders, the 3px floor-slab
     margins and the ground line do not, and guessing at them was what
     made the first version overshoot the stage by 60px and hang the
     basement below the fold. So measure instead of guess: set --k to 1,
     read the real height, and everything above the sum of the slab
     heights is the fixed part. */
  const SLABS = LEVELS.reduce((s, L) => s + L.h, 0);
  const fit = () => {
    /* Only while the section is pinned. Below 861px and under reduced
       motion .stack-frame is height:auto, so its clientHeight is the
       building's own height — measuring it there would feed the scale
       back into itself and the building would grow on every resize. */
    if (!stackFrame || !pinned()) return;
    /* Before the early returns below: the panel's width is settled by
       now and the reservation does not depend on anything the building
       measurement produces, so a stage too short to fit a building must
       not also cost the panel its reservation. */
    measureRead();
    /* clientHeight includes padding, and the frame reserves room at the
       foot for the title block — measure the content box, or the
       building is sized to a space that is not the one it sits in. */
    const cs = getComputedStyle(stackFrame);
    const avail = stackFrame.clientHeight
      - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 34;
    if (avail <= 0) return;
    bld.style.setProperty('--k', '1');
    /* offsetHeight, not getBoundingClientRect: the camera above this
       element is scaled, and a bounding rect would come back multiplied
       by whatever the camera happened to be doing at the time. */
    const fixed = bld.offsetHeight - SLABS;
    const k = clamp((avail - fixed) / SLABS, 0.62, 2.1);
    bld.style.setProperty('--k', k.toFixed(3));
    bld.style.setProperty('--bld-w', Math.round(clamp(430 * k, 300, 640)) + 'px');
  };

  /* The pin runs at every width now — only reduced motion turns it off.
     invest.html's ≤1180px CSS tier already stacks the reading panel
     under the building instead of beside it (built for tablet widths,
     turns out to hold up fine down to a phone too); ≤860px only adds a
     few phone-specific trims on top of it. Re-checked on resize because
     reduced-motion can still change mid-session via the OS setting. */
  const pinned = () => !reduce;

  const onScrollStack = () => {
    if (!pinned()) return;
    const r = buildSec.getBoundingClientRect();
    const total = r.height - innerHeight;
    const p = total > 0 ? clamp(-r.top / total, 0, 1) : 1;
    setScene(p);
    /* Before the stage arms, the panel tracks whatever is being
       placed, so scrolling reads as narration. After it arms the
       pointer takes over and this stops fighting it. */
    if (p < ARM) {
      const placing = clamp(Math.floor((p - START) / step), 0, n - 1);
      show(n - 1 - placing);
    }
  };

  /* ── programme rail ───────────────────────────────────────
     Draws across as the block crosses the middle of the viewport,
     lighting each stage as the line reaches it. */
  const prog = document.getElementById('prog');
  const progFill = document.getElementById('progFill');
  const steps = prog ? [...prog.querySelectorAll('.prog-step')] : [];
  /* The three phases inside stage 03. They are NOT stages and must not
     be counted as such — they light inside their parent's own slice of
     the rail, so the sequence reads as one stage with three things
     happening in it rather than as seven stages in a row. The index of
     the group is read off the DOM so re-ordering the stages cannot
     leave the phases lighting under the wrong one. */
  const subs = prog ? [...prog.querySelectorAll('.prog-sub-step')] : [];
  const groupAt = steps.findIndex(s => s.classList.contains('is-group'));

  const onScrollProg = () => {
    if (!prog || !progFill) return;
    if (reduce) {
      progFill.style.setProperty('--pl', '1');
      steps.forEach(s => { s.dataset.on = '1'; });
      subs.forEach(s => { s.dataset.on = '1'; });
      return;
    }
    const r = prog.getBoundingClientRect();
    /* Measured off the block's TOP only, so the range is the same
       whatever the block's height turns out to be: 0 as the top
       crosses 88% of the viewport, 1 by the time it reaches 34%. An
       earlier version divided by the block height too, which meant a
       tall block was still only a third drawn when it sat dead centre
       of the screen. */
    const startY = innerHeight * 0.88;
    const endY = innerHeight * 0.34;
    const p = clamp((startY - r.top) / Math.max(1, startY - endY), 0, 1);
    progFill.style.setProperty('--pl', p.toFixed(3));
    steps.forEach((s, i) => {
      s.dataset.on = p >= (i + 0.55) / steps.length ? '1' : '0';
    });
    if (groupAt >= 0 && subs.length) {
      /* the parent's window is [groupAt, groupAt+1] of the rail; the
         phases divide it between them */
      subs.forEach((s, i) => {
        const at = (groupAt + (i + 0.5) / subs.length) / steps.length;
        s.dataset.on = p >= at ? '1' : '0';
      });
    }
  };

  /* ── one rAF-gated listener for both ──────────────────── */
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScrollStack(); onScrollProg(); ticking = false; });
  };

  /* fit() first: it changes every slab's height, so the construction
     line's offsetTop reads inside setScene are only right afterwards.
     When the pin is off, the runtime scale is removed rather than left
     at whatever the last wide-viewport measurement was — the stylesheet
     has its own sizes for that case. */
  const settle = () => {
    if (pinned()) {
      fit();
      onScrollStack();
    } else {
      bld.style.removeProperty('--k');
      bld.style.removeProperty('--bld-w');
      /* and the note's reservation with them — a measurement taken at
         1400px is meaningless once the panel is full-width under the
         building, and stale it would leave a block of empty panel */
      if (read) read.style.removeProperty('--read-min');
      flat();
      show(0);
    }
    onScrollProg();
  };

  if (reduce) { flat(); show(0); onScrollProg(); }
  else {
    addEventListener('scroll', onScroll, { passive: true });
    settle();
  }

  let rTimer;
  addEventListener('resize', () => {
    clearTimeout(rTimer);
    rTimer = setTimeout(settle, 180);
  }, { passive: true });

  /* ── register → WhatsApp ───────────────────────────────────
     The anchor is a real wa.me link in the markup, so it works with
     the script blocked; this only replaces the href with a composed
     one just before the browser follows it. */
  const send = document.getElementById('regSend');
  if (send) {
    const val = id => {
      const el = document.getElementById(id);
      return el ? String(el.value || '').trim() : '';
    };
    send.addEventListener('click', () => {
      const name = val('r-name');
      const msg =
        `Hello Lumina — ${name || 'enquiry'} here, about the new builds.\n` +
        `Interested in: ${val('r-scale')}\n` +
        `Stage: ${val('r-stage')}` +
        (val('r-note') ? `\nNotes: ${val('r-note')}` : '') +
        `\n\nCould you send the particulars for what is currently available?`;
      send.href = 'https://wa.me/962771505250?text=' + encodeURIComponent(msg);
    });
    /* Enter inside a field should send, not reload — the form has no
       action and no backend. */
    const form = document.getElementById('regForm');
    if (form) form.addEventListener('submit', e => { e.preventDefault(); send.click(); });
  }
})();
