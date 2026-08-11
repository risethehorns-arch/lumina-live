// LUMINA — quiz.js
// "Where should you live?" — five questions, no typing, one answer.
//
// WHY THESE FIVE AND NOT ANY OTHER FIVE
// Amman's west is nine districts that a newcomer cannot tell apart from
// a map, and the things that actually separate them are not the things
// people ask about. Price barely discriminates: within a band you can
// find the same money in six of the nine. What discriminates is:
//
//   1  where you will be on a working day  — commute is the daily tax,
//                                          and in a city with no metro it
//                                          is the biggest quality-of-life
//                                          variable there is
//   2  how close the shops should be     — Swefieh and Shmeisani have a
//                                          city downstairs; Abdoun and
//                                          Dair Ghbar have a wall
//   3  walking or driving                — THE Amman question. Almost all
//                                          of West Amman is car-only, and
//                                          exactly two of our nine are
//                                          genuinely walkable. Newcomers
//                                          from walkable cities are the
//                                          ones most often housed wrong
//   4  who is coming                     — a family needs space, gardens
//                                          and the school-run corridor; a
//                                          single posting needs none of it
//   5  biggest / best area / character   — the tiebreak, and the question
//                                          that reveals what someone is
//                                          actually buying
//
// EVERY OPTION HAS TO BE UNDERSTOOD WITHOUT DECODING IT. An earlier cut
// offered "the address" and "old stone" — both perfectly clear to an
// estate agent and to nobody else. If a label needs the hint underneath
// it to make sense, it is the wrong label. Plain words, one parallel
// construction per question, and no more than four words.
//
// Deliberately NOT asked: budget (we have stock across the range in most
// of these and a number here would just anchor them), and anything that
// needs typing. Every answer is one tap.
//
// THE SCORING IS AN OPINION AND THE RESULT SAYS SO. It is a starting
// point for a conversation, not advice — the panel ends on a route to a
// person, and the reasons shown are the reader's own answers played back
// so they can disagree with the reasoning rather than just the answer.

(function () {
  'use strict';

  const sheet = document.getElementById('qz');
  if (!sheet) return;
  const body = document.getElementById('qzBody');
  const bar = document.getElementById('qzBar');
  const step = document.getElementById('qzStep');
  if (!body) return;

  /* ── the districts ────────────────────────────────────────
     The same seven groups areas.html uses — the Circles are one
     district to a reader and three entries in the data. Counts ship as
     literals and are corrected from the live book below. */
  const D = {
    abdoun: { name: 'Abdoun', n: 68, keys: ['Abdoun'], href: 'areas-abdoun.html',
      line: 'The embassy quarter. Wide, quiet streets, walled villas and low-rise blocks, and almost every diplomatic residence in the city within ten minutes.' },
    circles: { name: 'The Circles', n: 14, keys: ['2nd Circle', '4th Circle', '5th Circle'], href: 'areas-circles.html',
      line: 'The oldest part of the west, strung along Zahran Street. Thicker walls, better proportions, and the part of Amman you can live in without a car.' },
    swefieh: { name: 'Swefieh', n: 10, keys: ['Swefieh'], href: 'areas-swefieh.html',
      line: 'The commercial west. Shops, restaurants and everything you need downstairs — and the same money buys a noticeably larger flat than Abdoun.' },
    shmeisani: { name: 'Shmeisani', n: 9, keys: ['Shmesani'], href: 'areas.html#districts',
      line: 'The business district. The shortest commute to most office work in the city, and it empties at the weekend — which people either like very much or not at all.' },
    weibdeh: { name: 'Jabal Al Weibdeh', n: 7, keys: ['Jabal Al Weibdeh'], href: 'areas.html#districts',
      line: 'The oldest residential hill: 1940s stone, stairs, galleries and small cafés. The only part of Amman that rewards walking without a destination.' },
    umuthaina: { name: 'Um Uthaina', n: 6, keys: ['Um Uthaina'], href: 'areas.html#districts',
      line: 'Between Swefieh and the upper Circles, and quieter than either. Overlooked because it has no landmark — which is usually reflected in the price.' },
    dairghbar: { name: 'Dair Ghbar', n: 4, keys: ['Dair Ghbar'], href: 'areas.html#districts',
      line: "Abdoun's quieter southern neighbour. Larger plots, more garden, fewer people — and almost nothing to walk to." },
  };

  /* ── the five ─────────────────────────────────────────────
     Every option is at most three words, because a question you have to
     read twice is a question people abandon. `why` is played back to
     the reader as the reason for the answer they got, so it has to be
     true of the CHOICE, not of the district. */
  const Q = [
    {
      q: 'Where will you be on a working day?',
      hint: 'The office, the meetings, the school run — wherever you actually go.',
      opts: [
        { t: 'Abdoun', why: 'you will be in Abdoun on a working day', p: { abdoun: 3, dairghbar: 2, umuthaina: 1 } },
        { t: '4th & 5th Circles', why: 'you will be around the 4th and 5th Circles', p: { circles: 3, weibdeh: 2, abdoun: 1 } },
        { t: 'Shmeisani', why: 'you will be in Shmeisani on a working day', p: { shmeisani: 3, weibdeh: 2, circles: 1 } },
        { t: 'Swefieh, west', why: 'you will be out west on a working day', p: { swefieh: 3, umuthaina: 3, abdoun: 1 } },
        { t: 'I work from home', why: 'you are not tied to a commute', p: { abdoun: 1, circles: 1, swefieh: 1, shmeisani: 1, weibdeh: 1, umuthaina: 1, dairghbar: 1 } },
      ],
    },
    {
      q: 'How close should the shops be?',
      hint: 'West Amman goes from a city downstairs to a walled street in about four hundred metres.',
      opts: [
        { t: 'Shops downstairs', why: 'you want the shops downstairs', p: { swefieh: 3, shmeisani: 2, circles: 1 } },
        { t: 'Short walk to shops', why: 'you want the shops a short walk away', p: { circles: 2, weibdeh: 2, umuthaina: 2, abdoun: 1 } },
        { t: 'Quiet — I will drive', why: 'you would rather have the quiet and drive to the shops', p: { abdoun: 3, dairghbar: 3, umuthaina: 1 } },
      ],
    },
    {
      q: 'How will you get around day to day?',
      hint: 'There is no metro in Amman. Two of these nine districts are genuinely walkable; the rest are not.',
      opts: [
        { t: 'Mostly walking', why: 'you would rather walk than drive', p: { weibdeh: 3, circles: 3, swefieh: 1 } },
        { t: 'Mostly driving', why: 'you will be driving', p: { abdoun: 2, dairghbar: 2, umuthaina: 2 } },
        { t: 'A bit of both', why: 'you are happy either way', p: { abdoun: 1, circles: 1, swefieh: 1, shmeisani: 1, weibdeh: 1, umuthaina: 1, dairghbar: 1 } },
      ],
    },
    {
      q: 'Who is moving with you?',
      hint: 'Children change the answer more than anything else on this list.',
      opts: [
        { t: 'Just me', why: 'you are moving on your own', p: { weibdeh: 3, circles: 2, shmeisani: 2, swefieh: 1 } },
        { t: 'Two of us', why: 'there are two of you', p: { circles: 2, umuthaina: 2, swefieh: 2, abdoun: 1, weibdeh: 1 } },
        { t: 'With children', why: 'you are moving with children', p: { abdoun: 3, dairghbar: 3, umuthaina: 1 } },
      ],
    },
    {
      /* The tiebreak, and it used to be the worst question here: "you
         would trade up for… the address / old stone" asked people to
         decode two pieces of estate-agent shorthand. Same three
         discriminators, but framed as a choice anyone can make in a
         second and phrased in one parallel construction. */
      q: 'Same rent, three flats. Which do you take?',
      hint: 'Every district here trades one of these for the others. Nobody gets all three.',
      opts: [
        { t: 'The biggest one', why: 'you would take the space', p: { dairghbar: 3, swefieh: 2, umuthaina: 2, abdoun: 1 } },
        { t: 'The best neighbourhood', why: 'you would take the neighbourhood', p: { abdoun: 3, circles: 1, dairghbar: 1 } },
        { t: 'The one with character', why: 'you would take the character', p: { weibdeh: 3, circles: 3 } },
      ],
    },
  ];

  const answers = [];
  let at = 0;

  const esc = s => String(s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const progress = () => {
    const total = Q.length;
    const done = at >= total ? total : at;
    if (bar) bar.style.setProperty('--qp', (done / total).toFixed(3));
    if (step) step.textContent = at >= total
      ? 'Your answer'
      : String(at + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
  };

  /* ── a question ───────────────────────────────────────────── */
  const paint = () => {
    if (at >= Q.length) return result();
    const s = Q[at];
    body.innerHTML =
      '<div class="qz-card">' +
        '<p class="qz-q">' + esc(s.q) + '</p>' +
        '<p class="qz-hint">' + esc(s.hint) + '</p>' +
        '<div class="qz-opts">' +
          s.opts.map((o, i) =>
            '<button type="button" class="qz-opt" data-i="' + i + '">' +
              '<span class="qz-opt-t">' + esc(o.t) + '</span>' +
              '<span class="qz-tick" aria-hidden="true">' +
                '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.4l3.2 3.2L13 4.8"/></svg>' +
              '</span>' +
            '</button>').join('') +
        '</div>' +
        (at > 0 ? '<button type="button" class="qz-back" data-back>' +
          '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3L5 8l5 5"/></svg>' +
          'Back</button>' : '') +
      '</div>';
    progress();
    const first = body.querySelector('.qz-opt');
    if (first) first.focus({ preventScroll: true });
  };

  /* ── the answer ───────────────────────────────────────────── */
  const result = () => {
    const score = {};
    Object.keys(D).forEach(k => { score[k] = 0; });
    answers.forEach((ai, qi) => {
      const p = Q[qi].opts[ai].p;
      Object.keys(p).forEach(k => { if (k in score) score[k] += p[k]; });
    });

    const rank = Object.keys(score).sort((a, b) => score[b] - score[a]);
    const win = rank[0], second = rank[1];

    /* Play their own answers back as the reasoning, strongest first —
       so a reader who disagrees can see WHICH answer did it rather than
       being handed a verdict. Only answers that actually moved the
       winner are shown; "Either" and "No fixed office" score everything
       equally and so are correctly silent here. */
    const reasons = answers
      .map((ai, qi) => ({ w: Q[qi].opts[ai].why, s: Q[qi].opts[ai].p[win] || 0 }))
      .filter(r => r.s >= 2)
      .sort((a, b) => b.s - a.s)
      .slice(0, 3);

    const d = D[win], d2 = D[second];
    const msg =
      'Hello Lumina — I took the district quiz.\n' +
      Q.map((s, i) => s.q.replace(/…$/, '') + ' ' + s.opts[answers[i]].t).join('\n') +
      '\n\nIt suggested ' + d.name + '. Does that sound right?';

    body.innerHTML =
      '<div class="qz-card qz-res">' +
        '<p class="qz-res-kick mono">Start with</p>' +
        '<h3 class="qz-res-name">' + esc(d.name) + '</h3>' +
        '<p class="qz-res-n"><b class="qz-count" data-keys="' + esc(d.keys.join(',')) + '">' + d.n + '</b> on the book here now</p>' +
        '<p class="qz-res-line">' + esc(d.line) + '</p>' +
        (reasons.length
          ? '<ul class="qz-why">' + reasons.map(r =>
              '<li>' + esc(r.w.charAt(0).toUpperCase() + r.w.slice(1)) + '</li>').join('') + '</ul>'
          : '') +
        '<p class="qz-alt">Worth seeing too — <a href="' + esc(d2.href) + '"><b>' + esc(d2.name) + '</b></a>. ' +
          'Two districts is the honest answer to five questions.</p>' +
        '<div class="qz-acts">' +
          '<a class="btn qz-wa" href="https://wa.me/962771505250?text=' + encodeURIComponent(msg) + '" target="_blank" rel="noopener">' +
            'Send this to Lumina' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true" style="width:16px;height:16px"><path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3.5 20.5l1.7-5A8.4 8.4 0 1 1 21 11.5Z"/></svg>' +
          '</a>' +
          '<a class="btn-line" href="' + esc(d.href) + '">Read about ' + esc(d.name) +
            '<i aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4.8 11.2 11.2 4.8M6.1 4.8h5.1v5.1"/></svg></i></a>' +
          '<button type="button" class="qz-back" data-restart>' +
            '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8a5 5 0 1 1 1.6 3.7M3 5v3h3"/></svg>' +
            'Start again</button>' +
        '</div>' +
        '<p class="qz-fine">Five questions is a starting point, not advice. What actually decides it is usually a conversation — and if none of the nine fits, we will say so.</p>' +
      '</div>';
    progress();
    liveCount();
    const a = body.querySelector('.qz-wa');
    if (a) a.focus({ preventScroll: true });
  };

  /* The count ships as a literal so the panel is right if the fetch
     fails, and is corrected from the same data the listings page reads.
     CLAUDE.md records that hardcoded counts go stale on a re-import. */
  let tally = null;
  const liveCount = () => {
    const el = body.querySelector('.qz-count');
    if (!el || !tally) return;
    const n = el.dataset.keys.split(',').reduce((s, k) => s + (tally.get(k.trim()) || 0), 0);
    if (n) el.textContent = String(n);
  };
  fetch('data/lumina-demo-leads.json?v=2026-08-06')
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!Array.isArray(data)) return;
      tally = new Map();
      data.forEach(x => {
        const k = String(x.location || '').trim();
        if (k) tally.set(k, (tally.get(k) || 0) + 1);
      });
      liveCount();
    })
    .catch(() => {});

  /* ── one delegated listener for the whole panel ───────────── */
  body.addEventListener('click', e => {
    const opt = e.target.closest('.qz-opt');
    if (opt) {
      answers[at] = +opt.dataset.i;
      /* mark it, then advance a beat later so the tick is seen — the
         answer registering is the only feedback this interaction has */
      opt.dataset.on = '1';
      setTimeout(() => { at++; paint(); }, 260);
      return;
    }
    if (e.target.closest('[data-back]')) { at = Math.max(0, at - 1); paint(); return; }
    if (e.target.closest('[data-restart]')) { at = 0; answers.length = 0; paint(); }
  });

  /* Arrow keys walk the options, because a five-tap flow should not
     need a mouse. */
  body.addEventListener('keydown', e => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const opts = [...body.querySelectorAll('.qz-opt')];
    const i = opts.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const n = e.key === 'ArrowDown' ? i + 1 : i - 1;
    opts[Math.min(opts.length - 1, Math.max(0, n))].focus();
  });

  /* Reopening should start clean rather than on somebody's old answer. */
  const opener = document.getElementById('qzOpen');
  if (opener) opener.addEventListener('click', () => { at = 0; answers.length = 0; paint(); });

  paint();
})();
