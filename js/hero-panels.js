// LUMINA — hero-panels.js
// Amman's current weather on the hero panel, and the sheet machinery the
// three dialogs share: commission, the district quiz, and the weather
// map. js/quiz.js and js/weather-map.js render their own interiors and
// nothing else.
//
// Loaded only by index.html. No storage (see CLAUDE.md), no dependency,
// no inline script — the deploy CSP is script-src 'self'.

(function () {
  'use strict';

  const reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ==========================================================
     WEATHER
     Open-Meteo: no key, no signup, CORS open, and the only
     third-party host in the site's connect-src. If it is ever
     swapped out, _headers has to change with it.
     ========================================================== */

  const AMMAN = { lat: 31.9539, lon: 35.9106 };
  const ENDPOINT =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${AMMAN.lat}&longitude=${AMMAN.lon}` +
    '&current=temperature_2m,weather_code' +
    '&timezone=Asia%2FAmman';

  /* WMO weather codes, grouped to the handful of states worth drawing.
     https://open-meteo.com/en/docs — the code table is at the bottom. */
  const CONDITIONS = [
    { codes: [0],                    icon: 'sun',     label: 'Clear' },
    { codes: [1, 2],                 icon: 'partly',  label: 'Partly cloudy' },
    { codes: [3],                    icon: 'cloud',   label: 'Overcast' },
    { codes: [45, 48],               icon: 'fog',     label: 'Fog' },
    { codes: [51, 53, 55, 56, 57],   icon: 'drizzle', label: 'Drizzle' },
    { codes: [61, 63, 65, 66, 67, 80, 81, 82], icon: 'rain', label: 'Rain' },
    { codes: [71, 73, 75, 77, 85, 86], icon: 'snow',  label: 'Snow' },
    { codes: [95, 96, 99],           icon: 'thunder', label: 'Thunderstorm' }
  ];

  /* Yellow sun, grey cloud, blue rain, amber bolt — drawn rather than
     an emoji, per the no-emoji rule. */
  const ICONS = {
    sun:
      '<svg class="wx-i-sun" viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="4.6" fill="var(--sun,#FFC64D)"/>' +
      '<g stroke="var(--sun,#FFC64D)" stroke-width="1.7" stroke-linecap="round">' +
      '<path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2' +
      'M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6"/></g></svg>',
    partly:
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle cx="9" cy="8.6" r="3.6" fill="var(--sun,#FFC64D)"/>' +
      '<path d="M17.4 19H8.2a3.6 3.6 0 0 1 0-7.2 4.9 4.9 0 0 1 9.2 1.3 2.95 2.95 0 0 1 0 5.9Z" fill="#C9D3E0"/></svg>',
    cloud:
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M17.4 18.5H7.6a4 4 0 0 1 0-8 5.4 5.4 0 0 1 10.2 1.5 3.25 3.25 0 0 1-.4 6.5Z" fill="#AEB9C8"/></svg>',
    fog:
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M17 14.5H7a3.7 3.7 0 0 1 0-7.4 5 5 0 0 1 9.4 1.4A3 3 0 0 1 17 14.5Z" fill="#AEB9C8"/>' +
      '<g stroke="#AEB9C8" stroke-width="1.7" stroke-linecap="round" opacity=".85">' +
      '<path d="M4.5 18h15M7 21h10"/></g></svg>',
    drizzle:
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M17 13.6H7a3.6 3.6 0 0 1 0-7.2 4.9 4.9 0 0 1 9.2 1.3 2.95 2.95 0 0 1 .8 5.9Z" fill="#AEB9C8"/>' +
      '<g stroke="#7FC4E8" stroke-width="1.7" stroke-linecap="round">' +
      '<path d="M9 17v1.6M13 17v1.6M11 20v1.4"/></g></svg>',
    rain:
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M17 13.2H7a3.6 3.6 0 0 1 0-7.2 4.9 4.9 0 0 1 9.2 1.3 2.95 2.95 0 0 1 .8 5.9Z" fill="#AEB9C8"/>' +
      '<g stroke="#5FB3E4" stroke-width="1.8" stroke-linecap="round">' +
      '<path d="M8.6 16.2l-1 3.4M12.4 16.2l-1 3.4M16.2 16.2l-1 3.4"/></g></svg>',
    snow:
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M17 13.2H7a3.6 3.6 0 0 1 0-7.2 4.9 4.9 0 0 1 9.2 1.3 2.95 2.95 0 0 1 .8 5.9Z" fill="#AEB9C8"/>' +
      '<g stroke="#CFE6F5" stroke-width="1.7" stroke-linecap="round">' +
      '<path d="M8.4 17.2v2.6M7.2 18.5h2.4M14.4 17.2v2.6M13.2 18.5h2.4"/></g></svg>',
    thunder:
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M17 12.8H7a3.6 3.6 0 0 1 0-7.2 4.9 4.9 0 0 1 9.2 1.3 2.95 2.95 0 0 1 .8 5.9Z" fill="#8D99A9"/>' +
      '<path d="M12.6 14.2l-3.4 5h2.5l-.9 4 4.1-5.6h-2.6l1.4-3.4Z" fill="var(--sun,#FFC64D)"/></svg>'
  };

  const conditionFor = code => {
    for (const c of CONDITIONS) if (c.codes.indexOf(code) !== -1) return c;
    return null;
  };

  const paintWeather = () => {
    const panel = document.getElementById('wx');
    if (!panel) return;

    const tempEl = panel.querySelector('[data-wx-temp]');
    const iconEl = panel.querySelector('[data-wx-icon]');
    const descEl = panel.querySelector('[data-wx-desc]');

    /* Nine seconds, then give up. A hero panel must never be the reason
       the page feels slow. */
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => ctl && ctl.abort(), 9000);

    fetch(ENDPOINT, ctl ? { signal: ctl.signal } : undefined)
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(data => {
        const cur = data && data.current;
        const t = cur && cur.temperature_2m;
        if (typeof t !== 'number' || !isFinite(t)) throw new Error('no temperature in response');

        const cond = conditionFor(cur.weather_code);
        tempEl.textContent = String(Math.round(t));

        if (cond) {
          iconEl.innerHTML = ICONS[cond.icon] || '';
          descEl.textContent = cond.label + ' in Amman';
        } else {
          descEl.textContent = 'Amman';
        }

        /* Values first, then the class. .wx-live is what fades the
           reading and the icon up (see .wx .wx-read in index.html), and
           the forced reflow is what gives that transition a start value
           — the icon in particular only exists as of the line above, so
           without it the whole panel would still arrive in one frame.
           Same reason the commission sheet reads offsetWidth below, and
           not a rAF pair: rAF is throttled to a standstill in a
           backgrounded tab. */
        void panel.offsetWidth;
        panel.classList.add('wx-live');
      })
      .catch(err => {
        /* Never invent a temperature. The panel falls back to naming the
           city and nothing else, which is true whatever the weather. */
        console.warn('Lumina: weather unavailable —', err.message);
        panel.classList.add('wx-dead');
        descEl.textContent = 'Amman, Jordan';
      })
      .then(() => clearTimeout(timer));
  };

  /* ==========================================================
     COMMISSION SHEET
     ========================================================== */

  /* Takes the pair by id so a second sheet costs one more call rather
     than a second copy of the focus trap, the scroll lock and the
     Escape handler. The quiz sheet reuses the whole of it — which is
     also why it reuses the .cmx-panel / .cmx-veil / .cmx-x shell: one
     implementation, and the two dialogs cannot drift apart. */
  const initSheet = (openerId, sheetId) => {
    const opener = document.getElementById(openerId);
    const sheet = document.getElementById(sheetId);
    if (!opener || !sheet) return;

    const panel = sheet.querySelector('.cmx-panel');
    let lastFocus = null;

    const open = () => {
      lastFocus = document.activeElement;
      sheet.hidden = false;
      /* Force layout so the transition has a real start value. A rAF
         pair reads better but is throttled to a standstill in a
         backgrounded tab, which leaves the sheet mounted and invisible —
         the same trap property-viewer.js hit. */
      void sheet.offsetWidth;
      sheet.classList.add('open');
      document.documentElement.classList.add('cmx-locked');
      /* The veil also carries data-cmx-close and comes first in the
         document, so querying that attribute hands back a div, and a div
         does not take focus. Ask for the button. */
      const close = panel.querySelector('.cmx-x');
      if (close) close.focus({ preventScroll: true });
    };

    const shut = () => {
      sheet.classList.remove('open');
      document.documentElement.classList.remove('cmx-locked');
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });

      const done = e => {
        if (e.target !== panel || e.propertyName !== 'opacity') return;
        panel.removeEventListener('transitionend', done);
        if (!sheet.classList.contains('open')) sheet.hidden = true;
      };
      panel.addEventListener('transitionend', done);
      /* Reduced motion collapses the transition and some browsers then
         skip the event entirely. */
      setTimeout(() => {
        if (!sheet.classList.contains('open')) sheet.hidden = true;
      }, reduce ? 30 : 620);
    };

    opener.addEventListener('click', open);
    sheet.querySelectorAll('[data-cmx-close]').forEach(el =>
      el.addEventListener('click', shut));

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && sheet.classList.contains('open')) shut();
    });

    /* Keep tab inside the dialog while it is open. */
    sheet.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const focusable = panel.querySelectorAll('a[href], button:not([disabled])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  };

  /* Exposed so js/quiz.js can render into the sheet without owning the
     open/close/trap machinery — same reason lumina.js exposes bindTilt
     for cards that arrive after it has run. */
  window.Lumina = window.Lumina || {};
  window.Lumina.initSheet = initSheet;

  const boot = () => {
    paintWeather();
    initSheet('cmOpen', 'cmx');
    initSheet('qzOpen', 'qz');
    /* The weather panel is its own opener — it already carries id="wx"
       for paintWeather above, so it does not need a second one. */
    initSheet('wx', 'wxs');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
