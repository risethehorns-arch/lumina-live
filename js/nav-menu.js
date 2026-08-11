// LUMINA — nav-menu.js
// The phone menu.
//
// At 390px every page was showing exactly two reachable links,
// Properties and WhatsApp; the other five were display:none. This builds
// a menu button and a sheet from the links already in the bar, so the
// markup stays in one place and index.html — whose bar lists different
// destinations — gets a correct menu without a second copy of anything.
//
// Styles live in css/mobile.css, inside the same max-width query.

(function () {
  'use strict';

  const bar = document.querySelector('.bar');
  const nav = bar && bar.querySelector('.nav');
  if (!nav) return;

  /* The WhatsApp chip stays in the bar; it is the primary action and is
     wanted within thumb reach, not two taps deep. */
  const links = [...nav.querySelectorAll('a')].filter(a => !a.classList.contains('chip'));
  if (!links.length) return;

  const pad = n => (n < 10 ? '0' : '') + n;

  /* ---- button ---- */
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-toggle';
  toggle.setAttribute('aria-label', 'Menu');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'navSheet');
  toggle.innerHTML = '<span></span><span></span><span></span>';
  nav.appendChild(toggle);

  /* ---- sheet ---- */
  const sheet = document.createElement('nav');
  sheet.className = 'nav-sheet';
  sheet.id = 'navSheet';
  sheet.hidden = true;
  sheet.setAttribute('aria-label', 'Menu');

  links.forEach((src, i) => {
    const a = document.createElement('a');
    a.href = src.getAttribute('href');
    a.style.setProperty('--i', String(i));
    if (src.hasAttribute('aria-current')) a.setAttribute('aria-current', 'page');
    if (src.target) { a.target = src.target; a.rel = src.rel || 'noopener'; }
    a.append(src.textContent.trim());
    const n = document.createElement('i');
    n.textContent = pad(i + 1);
    a.append(n);
    sheet.appendChild(a);
  });

  const foot = document.createElement('p');
  foot.className = 'nav-sheet-foot';
  foot.textContent = '+962 77 150 5250 · Amman';
  sheet.appendChild(foot);

  document.body.appendChild(sheet);

  /* ---- behaviour ---- */
  /* Declared up here rather than beside the change listener because show()
     tests it: css/mobile.css only styles the sheet inside this same query,
     so opening it above the breakpoint would dump seven unstyled links at
     the foot of the document with no way back. The toggle is display:none
     there, but a click can still be dispatched — and was, by tab+Enter,
     before the toggle was hidden at all. */
  const mq = window.matchMedia('(max-width: 860px)');

  let open = false;
  let lastFocus = null;

  const show = () => {
    if (!mq.matches) return;
    lastFocus = document.activeElement;
    open = true;
    sheet.hidden = false;
    /* Force layout so the fade has a real start value. A rAF pair reads
       better but is throttled to a standstill in a backgrounded tab,
       which leaves the sheet mounted and invisible. */
    void sheet.offsetWidth;
    sheet.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('nav-locked');
    const first = sheet.querySelector('a');
    if (first) first.focus({ preventScroll: true });
  };

  const hide = () => {
    open = false;
    sheet.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('nav-locked');

    const done = e => {
      if (e.target !== sheet || e.propertyName !== 'opacity') return;
      sheet.removeEventListener('transitionend', done);
      if (!open) sheet.hidden = true;
    };
    sheet.addEventListener('transitionend', done);
    /* Reduced motion collapses the transition and some browsers then
       skip the event entirely. */
    setTimeout(() => { if (!open) sheet.hidden = true; }, 480);
  };

  toggle.addEventListener('click', () => {
    if (open) { hide(); toggle.focus({ preventScroll: true }); }
    else show();
  });

  /* A link that goes to the current page never fires a navigation, so
     the sheet would stay open over the thing it just scrolled to. */
  sheet.addEventListener('click', e => {
    if (e.target.closest('a')) hide();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && open) { hide(); toggle.focus({ preventScroll: true }); }
  });

  /* Keep tab inside the sheet while it is open. */
  sheet.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const items = sheet.querySelectorAll('a');
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* Rotating a phone to landscape can cross the breakpoint with the
     sheet still open, leaving a full-screen overlay on a desktop-width
     layout where the button that closes it is hidden. */
  const onChange = e => { if (!e.matches && open) hide(); };
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);
})();
