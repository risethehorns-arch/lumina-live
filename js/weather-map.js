// LUMINA — weather-map.js
// "Amman, right now" — the hero weather panel's sheet.
//
// WHY THIS EXISTS AND WHY IT IS A MAP
// The hero panel gives one temperature for a city built on hills, which
// is the least interesting true thing you can say about Amman's weather.
// The interesting one is that the hills make their own: on a given
// afternoon the high western suburbs run two to three degrees cooler
// than the low ridges above the old centre. That is a real difference
// and it is one somebody choosing a district can actually use — so the
// sheet is a map of the districts we transact in, each with its own
// reading, ordered by nothing except where they sit.
//
// ONE REQUEST, TEN PLACES. Open-Meteo takes comma-separated coordinates
// and answers with an array in the same order, so the whole map costs a
// single call to the one third-party host already in the deploy's
// connect-src. If that endpoint is ever swapped, _headers changes too.
//
// THE READINGS ARE NOT COPIES OF EACH OTHER. Open-Meteo downscales
// temperature against a 90m elevation model, which is exactly the effect
// worth showing here — the spread tracks height above sea level, and the
// sheet says so rather than leaving ten near-identical numbers to look
// like a rounding artefact.
//
// LAZY. Nothing is fetched until the sheet is opened for the first time.
// The hero panel's own single-point request in hero-panels.js is
// untouched and still paints the card; this never blocks the landing
// page for a dialog most visitors will not open.
//
// NO STORAGE, no dependency, no inline script — the deploy CSP is
// script-src 'self'. Loaded only by index.html.

(function () {
  'use strict';

  const sheet = document.getElementById('wxs');
  const body = document.getElementById('wxsBody');
  const opener = document.getElementById('wx');
  if (!sheet || !body || !opener) return;

  const reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ==========================================================
     THE DISTRICTS

     Nine of these are the districts on areas.html, and the tenth is
     Khalda — not a district we hold stock in, but the highest ground in
     West Amman and therefore the one that makes the pattern legible.
     A weather map that stopped at our own inventory would be a stranger
     thing than one that shows the city.

     `x`/`y` are percentages of the map box, and they are the same
     arrangement areas.html draws: relative direction is true (Weibdeh
     east, Khalda north-west, Dair Ghbar south), spacing is opened up so
     ten labels can sit side by side. Indicative, not a survey — the
     caption says so, exactly as the areas plan does.
     ========================================================== */
  /* A node's footprint is its dot plus the label under it: roughly y-6 to
     y+10 at this box. Three pairs were inside that and the lower dot sat
     on the upper one's name — Weibdeh under 2nd Circle, 4th Circle under
     Abdoun, 5th Circle under Swefieh. Spacing below is checked against
     that footprint, not eyeballed; if you move one, re-check its
     neighbours in both axes. */
  const DISTRICTS = [
    { key: 'khalda',     name: 'Khalda',      lat: 31.9836, lon: 35.8286, x: 14, y: 13, ours: false },
    { key: 'shmeisani',  name: 'Shmeisani',   lat: 31.9631, lon: 35.9006, x: 60, y: 16 },
    { key: 'weibdeh',    name: 'Weibdeh',     lat: 31.9564, lon: 35.9203, x: 84, y: 27 },
    { key: 'umuthaina',  name: 'Um Uthaina',  lat: 31.9506, lon: 35.8697, x: 22, y: 40 },
    { key: 'c2',         name: '2nd Circle',  lat: 31.9508, lon: 35.9231, x: 70, y: 47 },
    { key: 'c4',         name: '4th Circle',  lat: 31.9508, lon: 35.8944, x: 46, y: 52 },
    { key: 'c5',         name: '5th Circle',  lat: 31.9497, lon: 35.8836, x: 30, y: 60 },
    { key: 'swefieh',    name: 'Swefieh',     lat: 31.9436, lon: 35.8681, x: 16, y: 76 },
    { key: 'abdoun',     name: 'Abdoun',      lat: 31.9394, lon: 35.8814, x: 62, y: 70 },
    { key: 'dairghbar',  name: 'Dair Ghbar',  lat: 31.9264, lon: 35.8747, x: 42, y: 88 }
  ];

  const ENDPOINT =
    'https://api.open-meteo.com/v1/forecast' +
    '?latitude=' + DISTRICTS.map(d => d.lat).join(',') +
    '&longitude=' + DISTRICTS.map(d => d.lon).join(',') +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,' +
    'wind_speed_10m,weather_code,is_day' +
    '&timezone=Asia%2FAmman';

  /* The same WMO groupings hero-panels.js uses, kept deliberately
     identical so the card and the sheet can never describe the same sky
     with two different words. */
  const CONDITIONS = [
    { codes: [0], icon: 'sun', label: 'Clear' },
    { codes: [1, 2], icon: 'partly', label: 'Partly cloudy' },
    { codes: [3], icon: 'cloud', label: 'Overcast' },
    { codes: [45, 48], icon: 'fog', label: 'Hazy' },
    { codes: [51, 53, 55, 56, 57], icon: 'drizzle', label: 'Drizzle' },
    { codes: [61, 63, 65, 66, 67, 80, 81, 82], icon: 'rain', label: 'Rain' },
    { codes: [71, 73, 75, 77, 85, 86], icon: 'snow', label: 'Snow' },
    { codes: [95, 96, 99], icon: 'thunder', label: 'Thunderstorm' }
  ];

  const ICONS = {
    sun: '<svg class="wx-i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.6" fill="var(--sun,#FFC64D)"/><g stroke="var(--sun,#FFC64D)" stroke-width="1.7" stroke-linecap="round"><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6"/></g></svg>',
    partly: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8.6" r="3.6" fill="var(--sun,#FFC64D)"/><path d="M17.4 19H8.2a3.6 3.6 0 0 1 0-7.2 4.9 4.9 0 0 1 9.2 1.3 2.95 2.95 0 0 1 0 5.9Z" fill="#C9D3E0"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.4 18.5H7.6a4 4 0 0 1 0-8 5.4 5.4 0 0 1 10.2 1.5 3.25 3.25 0 0 1-.4 6.5Z" fill="#AEB9C8"/></svg>',
    fog: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 14.5H7a3.7 3.7 0 0 1 0-7.4 5 5 0 0 1 9.4 1.4A3 3 0 0 1 17 14.5Z" fill="#AEB9C8"/><g stroke="#AEB9C8" stroke-width="1.7" stroke-linecap="round" opacity=".85"><path d="M4.5 18h15M7 21h10"/></g></svg>',
    drizzle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 13.6H7a3.6 3.6 0 0 1 0-7.2 4.9 4.9 0 0 1 9.2 1.3 2.95 2.95 0 0 1 .8 5.9Z" fill="#AEB9C8"/><g stroke="#7FC4E8" stroke-width="1.7" stroke-linecap="round"><path d="M9 17v1.6M13 17v1.6M11 20v1.4"/></g></svg>',
    rain: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 13.2H7a3.6 3.6 0 0 1 0-7.2 4.9 4.9 0 0 1 9.2 1.3 2.95 2.95 0 0 1 .8 5.9Z" fill="#AEB9C8"/><g stroke="#5FB3E4" stroke-width="1.8" stroke-linecap="round"><path d="M8.6 16.2l-1 3.4M12.4 16.2l-1 3.4M16.2 16.2l-1 3.4"/></g></svg>',
    snow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 13.2H7a3.6 3.6 0 0 1 0-7.2 4.9 4.9 0 0 1 9.2 1.3 2.95 2.95 0 0 1 .8 5.9Z" fill="#AEB9C8"/><g stroke="#CFE6F5" stroke-width="1.7" stroke-linecap="round"><path d="M8.4 17.2v2.6M7.2 18.5h2.4M14.4 17.2v2.6M13.2 18.5h2.4"/></g></svg>',
    thunder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 12.8H7a3.6 3.6 0 0 1 0-7.2 4.9 4.9 0 0 1 9.2 1.3 2.95 2.95 0 0 1 .8 5.9Z" fill="#8D99A9"/><path d="M12.6 14.2l-3.4 5h2.5l-.9 4 4.1-5.6h-2.6l1.4-3.4Z" fill="var(--sun,#FFC64D)"/></svg>'
  };

  const conditionFor = code => {
    for (let i = 0; i < CONDITIONS.length; i++) {
      if (CONDITIONS[i].codes.indexOf(code) !== -1) return CONDITIONS[i];
    }
    return null;
  };

  /* Cool -> warm across --plinth and --gold, the two accents this site
     already owns. No new hue enters the palette for a data ramp.
     The scale is RELATIVE to the spread on the day: two degrees between
     the coolest and the warmest is a real difference in Amman and an
     absolute scale would render all ten the same colour and say nothing.
     The legend is worded "cooler / warmer" for exactly that reason — it
     never claims to be an absolute temperature scale. */
  const COOL = [127, 217, 232];
  const WARM = [255, 178, 90];
  const ramp = t => {
    const k = Math.max(0, Math.min(1, t));
    return 'rgb(' + COOL.map((c, i) => Math.round(c + (WARM[i] - c) * k)).join(',') + ')';
  };

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  /* The bed the nodes sit on. Contour rings rather than streets: the
     story this sheet tells is elevation, so the decoration may as well
     be the explanation. They rise toward the north-west, which is where
     the ground actually rises. Indicative, and aria-hidden — nothing
     here carries meaning a screen reader needs. */
  const BED =
    '<svg class="wxm-bed" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">' +
    '<defs><radialGradient id="wxmHigh" cx="16%" cy="12%" r="82%">' +
    '<stop offset="0%" stop-color="rgba(127,217,232,.16)"/>' +
    '<stop offset="60%" stop-color="rgba(127,217,232,.04)"/>' +
    '<stop offset="100%" stop-color="rgba(127,217,232,0)"/>' +
    '</radialGradient></defs>' +
    '<rect width="1000" height="620" fill="url(#wxmHigh)"/>' +
    '<g fill="none" stroke="rgba(247,242,233,.10)" stroke-width="1">' +
    '<path d="M-40 250 Q 210 60 470 40 T 1040 -30"/>' +
    '<path d="M-40 360 Q 240 170 520 150 T 1040 90"/>' +
    '<path d="M-40 470 Q 270 290 560 265 T 1040 215"/>' +
    '<path d="M-40 580 Q 300 410 600 380 T 1040 340"/>' +
    '<path d="M-40 690 Q 330 530 640 495 T 1040 465"/>' +
    '</g></svg>';

  let painted = false;
  let selected = 'abdoun';

  const fail = message => {
    body.textContent = '';
    const p = el('p', 'wxm-dead');
    p.textContent = message;
    body.appendChild(p);
  };

  const render = rows => {
    const temps = rows.map(r => r.temp);
    const lo = Math.min.apply(null, temps);
    const hi = Math.max.apply(null, temps);
    const span = hi - lo;

    const coolest = rows[temps.indexOf(lo)];
    const warmest = rows[temps.indexOf(hi)];

    body.textContent = '';

    /* ── the reading of the day, in one sentence ─────────────────
       Written from the numbers, never hardcoded: if the spread
       collapses on a still, overcast day the sentence says that
       instead of insisting on a pattern that is not there. */
    const lede = el('p', 'wxm-lede');
    if (span >= 1) {
      lede.innerHTML =
        'Amman is built on hills, and they make their own weather. ' +
        '<b>' + span.toFixed(1) + '°</b> between ' +
        '<b>' + coolest.name + '</b> at ' + Math.round(coolest.elev) + ' m and ' +
        '<b>' + warmest.name + '</b> at ' + Math.round(warmest.elev) + ' m ' +
        'right now — the high western suburbs run cooler than the ridges above the centre.';
    } else {
      lede.textContent =
        'Amman is built on hills, and they usually make their own weather. ' +
        'Not this hour — every district below is within a degree of the others.';
    }
    body.appendChild(lede);

    /* ── the map ────────────────────────────────────────────── */
    /* Map and detail sit side by side above 900px. Stacked, the detail
       — which is where the wind and the humidity live — fell below the
       fold of an 88vh panel and the sheet read as a map and nothing
       else. */
    const stage = el('div', 'wxm-stage');
    const left = el('div', 'wxm-col');

    const map = el('div', 'wxm');
    map.insertAdjacentHTML('afterbegin', BED);

    const group = el('div', 'wxm-nodes');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Districts of West Amman');

    rows.forEach((r, i) => {
      const b = el('button', 'wxm-node');
      b.type = 'button';
      b.dataset.key = r.key;
      b.style.setProperty('--x', r.x + '%');
      b.style.setProperty('--y', r.y + '%');
      b.style.setProperty('--tint', ramp(span ? (r.temp - lo) / span : 0.5));
      /* the stagger is the only motion here; index rather than a random
         delay so it reads as the map drawing itself, west to east */
      b.style.setProperty('--i', String(i));
      if (r.ours === false) b.classList.add('wxm-node--near');
      b.setAttribute('aria-pressed', String(r.key === selected));
      b.setAttribute('aria-label',
        r.name + ', ' + Math.round(r.temp) + ' degrees, ' + r.cond.label.toLowerCase() +
        ', wind ' + Math.round(r.wind) + ' kilometres per hour');

      const dot = el('span', 'wxm-dot');
      dot.appendChild(el('b', null, String(Math.round(r.temp))));
      const deg = el('i', null, '°');
      dot.appendChild(deg);
      b.appendChild(dot);
      b.appendChild(el('span', 'wxm-name', r.name));
      group.appendChild(b);
    });

    map.appendChild(group);
    left.appendChild(map);

    /* ── the legend, and what the colours are not ───────────── */
    const key = el('div', 'wxm-key');
    /* Order in the markup, not CSS `order`: the scale is a <span> too,
       so `.mono:first-of-type` matched nothing and both labels sat on the
       same side of the bar they were meant to bracket. */
    key.innerHTML =
      '<span class="mono">cooler</span>' +
      '<span class="wxm-key-scale" aria-hidden="true"></span>' +
      '<span class="mono">warmer</span>';
    left.appendChild(key);
    stage.appendChild(left);

    /* ── the detail for whichever node is selected ──────────── */
    const detail = el('div', 'wxm-detail');
    detail.id = 'wxmDetail';
    detail.setAttribute('aria-live', 'polite');
    stage.appendChild(detail);
    body.appendChild(stage);

    const stamp = el('p', 'wxm-stamp mono');
    stamp.textContent = 'Reading taken ' + rows[0].time + ' Amman time · Open-Meteo · ' +
      'positions indicative, not a survey';
    body.appendChild(stamp);

    const paintDetail = () => {
      const r = rows.filter(x => x.key === selected)[0] || rows[0];
      detail.textContent = '';

      const head = el('div', 'wxm-d-head');
      const icon = el('span', 'wxm-d-icon');
      icon.innerHTML = ICONS[r.cond.icon] || '';
      icon.setAttribute('aria-hidden', 'true');
      head.appendChild(icon);

      const who = el('div', 'wxm-d-who');
      who.appendChild(el('b', null, r.name));
      who.appendChild(el('span', null, r.cond.label + ' · ' + Math.round(r.elev) + ' m above sea level'));
      head.appendChild(who);

      const read = el('div', 'wxm-d-read');
      read.appendChild(el('b', null, r.temp.toFixed(1)));
      read.appendChild(el('i', null, '°C'));
      head.appendChild(read);
      detail.appendChild(head);

      /* Three figures and no more. Pressure, dew point and cloud cover
         are all one request away and all of them would turn a thing you
         read in two seconds into a dashboard. */
      const facts = el('dl', 'wxm-d-facts');
      [['Feels like', r.feels.toFixed(1) + '°'],
       ['Wind', Math.round(r.wind) + ' km/h'],
       ['Humidity', Math.round(r.hum) + '%']].forEach(pair => {
        const wrap = el('div');
        wrap.appendChild(el('dt', null, pair[0]));
        wrap.appendChild(el('dd', null, pair[1]));
        facts.appendChild(wrap);
      });
      detail.appendChild(facts);
    };

    const select = k => {
      selected = k;
      group.querySelectorAll('.wxm-node').forEach(n => {
        const on = n.dataset.key === k;
        n.classList.toggle('is-on', on);
        n.setAttribute('aria-pressed', String(on));
      });
      paintDetail();
    };

    group.addEventListener('click', e => {
      const n = e.target.closest('.wxm-node');
      if (n) select(n.dataset.key);
    });
    /* Pointing at a district is the same intent as choosing it, and on a
       map it is the faster one. Focus does it too, so the keyboard walks
       the same path — no separate Enter step to discover. */
    group.addEventListener('pointerover', e => {
      const n = e.target.closest('.wxm-node');
      if (n && e.pointerType === 'mouse') select(n.dataset.key);
    });
    group.addEventListener('focusin', e => {
      const n = e.target.closest('.wxm-node');
      if (n) select(n.dataset.key);
    });

    select(rows.filter(x => x.key === selected).length ? selected : rows[0].key);

    if (!reduce) {
      void map.offsetWidth;
      map.classList.add('wxm-in');
    } else {
      map.classList.add('wxm-in', 'wxm-still');
    }
  };

  const load = () => {
    if (painted) return;
    painted = true;

    body.textContent = '';
    body.appendChild(el('p', 'wxm-wait mono', 'Reading ten districts…'));

    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => ctl && ctl.abort(), 9000);

    fetch(ENDPOINT, ctl ? { signal: ctl.signal } : undefined)
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(data => {
        const list = Array.isArray(data) ? data : [data];
        if (list.length !== DISTRICTS.length) throw new Error('expected ' + DISTRICTS.length + ' places');

        const rows = list.map((item, i) => {
          const c = item && item.current;
          if (!c || typeof c.temperature_2m !== 'number') throw new Error('no reading for ' + DISTRICTS[i].name);
          return {
            key: DISTRICTS[i].key,
            name: DISTRICTS[i].name,
            x: DISTRICTS[i].x,
            y: DISTRICTS[i].y,
            ours: DISTRICTS[i].ours,
            temp: c.temperature_2m,
            feels: typeof c.apparent_temperature === 'number' ? c.apparent_temperature : c.temperature_2m,
            wind: c.wind_speed_10m || 0,
            hum: c.relative_humidity_2m || 0,
            cond: conditionFor(c.weather_code) || { icon: 'cloud', label: 'Amman' },
            elev: typeof item.elevation === 'number' ? item.elevation : 0,
            /* the API's own local time, not the visitor's clock — a
               reader in another timezone is still being told when the
               reading was taken in Amman */
            time: String(c.time || '').slice(11, 16) || '—'
          };
        });
        render(rows);
      })
      .catch(err => {
        console.warn('Lumina: district weather unavailable —', err.message);
        /* Never invent a temperature, here or on the card. The sheet
           says plainly that it has nothing rather than drawing a map of
           made-up numbers, and offers the one thing that is still true. */
        painted = false;
        fail('The weather service is not answering right now. ' +
             'The districts themselves are on the areas page, and the reading will be here next time.');
      })
      .then(() => clearTimeout(timer));
  };

  /* hero-panels.js owns opening, closing, the scroll lock and the focus
     trap for all three sheets. This only fills the one. */
  opener.addEventListener('click', load);
})();
