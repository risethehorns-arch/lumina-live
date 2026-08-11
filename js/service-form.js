// LUMINA — service-form.js
// The behaviour shared by property-management.html and
// property-evaluation.html: the WhatsApp handoff, and the method rail
// on the evaluation page. Both pages load this one file, and each
// block below no-ops on the page that does not have its markup —
// which is cheaper than a second file and a second request, and keeps
// the scroll work in one rAF-gated listener rather than one per effect.
//
// ── the WhatsApp handoff ──────────────────────────────────────
//
// Same contract as everywhere else on this site: there is no backend
// and none is needed. #regSend is already a real wa.me link in the
// markup, so with the script blocked the button still works and still
// reaches the right number — this only replaces the href with a
// composed message just before the browser follows it.
//
// The two pages have different fields, so rather than hard-coding a
// list this reads every labelled control inside the form and uses the
// label's own text. Add a field to either page and it appears in the
// message with no change here.

(function () {
  'use strict';

  const form = document.getElementById('regForm');
  const send = document.getElementById('regSend');
  if (!form || !send) return;

  const subject = document.body.dataset.subject || 'an enquiry';

  const compose = () => {
    let name = '';
    const lines = [];

    form.querySelectorAll('.field').forEach(field => {
      const control = field.querySelector('input,select,textarea');
      const label = field.querySelector('span');
      if (!control || !label) return;
      const value = String(control.value || '').trim();
      if (!value) return;
      /* The name is the greeting, not a line item */
      if (control.id === 'r-name') { name = value; return; }
      lines.push(label.textContent.trim() + ': ' + value);
    });

    return `Hello Lumina — ${name || 'enquiry'} here, about ${subject}.\n` +
           lines.join('\n') +
           `\n\nCould you tell me how this would work and what it would cost?`;
  };

  send.addEventListener('click', () => {
    send.href = 'https://wa.me/962771505250?text=' + encodeURIComponent(compose());
  });

  /* Enter inside a field should send, not reload — the form has no
     action and no backend. */
  form.addEventListener('submit', e => { e.preventDefault(); send.click(); });
})();

// ── the method rail, property-evaluation.html ─────────────────
// The same mechanism as .prog on invest.html, turned on its side: the
// line draws down as the block crosses the middle of the viewport and
// each step lights as the line reaches it. That section's own argument
// is that the order matters, and five dots lit before you arrive says
// there is no order.
//
// The stylesheet's resting state is the LIT one and this writes
// data-on="0" to take it away, so with the script blocked the rail is
// what it always was rather than five permanently dead steps.

(function () {
  'use strict';

  const meth = document.querySelector('.meth');
  const fill = document.getElementById('methFill');
  if (!meth || !fill) return;

  const steps = [...meth.querySelectorAll('.meth-step')];
  if (!steps.length) return;

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    fill.style.setProperty('--ml', '1');
    steps.forEach(s => { s.dataset.on = '1'; });
    return;
  }

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const draw = () => {
    /* Measured off the block's TOP only, so the range is the same
       whatever the block's height turns out to be: 0 as the top
       crosses 88% of the viewport, 1 by the time it reaches 34%.
       Dividing by the block height too would leave a tall block only
       part drawn while it sits dead centre of the screen. */
    const startY = innerHeight * 0.88;
    const endY = innerHeight * 0.34;
    const p = clamp((startY - meth.getBoundingClientRect().top) /
                    Math.max(1, startY - endY), 0, 1);
    fill.style.setProperty('--ml', p.toFixed(3));
    steps.forEach((s, i) => {
      s.dataset.on = p >= (i + 0.55) / steps.length ? '1' : '0';
    });
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { draw(); ticking = false; });
  };

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  draw();
})();
