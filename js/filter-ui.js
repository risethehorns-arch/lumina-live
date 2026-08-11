// LUMINA — filter-ui.js
// The checkbox dropdown used by the listings filter bar.
//
// A native <select multiple> is the obvious answer and the wrong one: it
// renders as a scrolling list box that is always open, takes ctrl-click to
// add a second value, and cannot be styled. This is a button, a panel and
// real checkboxes, so multiple selection is discoverable by looking at it.
//
// Exposes Lumina.multiSelect(). No storage, no dependencies.

(function () {
  'use strict';

  const L = (window.Lumina = window.Lumina || {});

  /* Every widget on the page, so opening one can close the rest. */
  const registry = [];

  const CARET = '<svg class="fx-caret" viewBox="0 0 10 6" aria-hidden="true">' +
                '<path d="M1 1l4 4 4-4"/></svg>';
  const TICK  = '<svg viewBox="0 0 12 12" aria-hidden="true">' +
                '<path d="M2 6.3l2.6 2.6L10 3.4"/></svg>';

  let seq = 0;

  /* Options past this point open together. Twelve areas at 26ms each is
     312ms of stagger, which is already at the edge of feeling slow. */
  const STAGGER_CAP = 9;

  /**
   * @param {Object}   cfg
   * @param {Element}  cfg.mount        element to build inside
   * @param {string}   cfg.placeholder  label when nothing is selected
   * @param {string}   cfg.noun         plural noun, e.g. "areas"
   * @param {string}   cfg.aria         accessible name for the trigger
   * @param {Array}    cfg.options      [{ value, label, count }]
   * @param {Function} cfg.onChange     called with the array of values
   */
  L.multiSelect = function multiSelect(cfg) {
    const mount = cfg.mount;
    if (!mount) return null;

    const id = 'fx' + (++seq);
    const selected = new Set();
    let isOpen = false;

    /* The mount is the flex child of .fx-row, not .fx-ms, so the narrow
       layout has to be able to address it. Marking it here keeps the
       markup in listings.html down to an empty div. */
    mount.classList.add('fx-mount');

    const root = document.createElement('div');
    root.className = 'fx-ms';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'fx-trigger';
    trigger.id = id + '-btn';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-label', cfg.aria || cfg.placeholder || 'Filter');
    trigger.innerHTML =
      '<span class="fx-trigger-label"></span>' +
      '<span class="fx-badge" hidden></span>' +
      CARET;

    const panel = document.createElement('div');
    panel.className = 'fx-panel';
    panel.id = id + '-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-labelledby', trigger.id);

    const scroll = document.createElement('div');
    scroll.className = 'fx-scroll';

    const foot = document.createElement('div');
    foot.className = 'fx-foot';
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'fx-none';
    clearBtn.textContent = 'Clear';
    const doneBtn = document.createElement('button');
    doneBtn.type = 'button';
    doneBtn.className = 'fx-done';
    doneBtn.textContent = 'Done';
    foot.append(clearBtn, doneBtn);

    panel.append(scroll, foot);
    root.append(trigger, panel);
    mount.replaceChildren(root);

    const labelEl = trigger.querySelector('.fx-trigger-label');
    const badgeEl = trigger.querySelector('.fx-badge');

    const inputs = () => [...scroll.querySelectorAll('input[type="checkbox"]')];

    const syncTrigger = () => {
      const n = selected.size;
      if (n === 0) {
        labelEl.textContent = cfg.placeholder || 'Any';
      } else if (n === 1) {
        const only = [...selected][0];
        const opt = (cfg.options || []).find(o => o.value === only);
        labelEl.textContent = opt ? opt.label : only;
      } else {
        labelEl.textContent = n + ' ' + (cfg.noun || 'selected');
      }
      badgeEl.textContent = String(n);
      badgeEl.hidden = n === 0;
      /* Set on the next tick so the scale transition has a start value —
         an element unhidden and given its end state in the same frame
         does not animate. */
      if (n === 0) badgeEl.classList.remove('on');
      else requestAnimationFrame(() => badgeEl.classList.add('on'));
      trigger.classList.toggle('on', n > 0);
    };

    const emit = () => {
      syncTrigger();
      if (typeof cfg.onChange === 'function') cfg.onChange([...selected]);
    };

    const render = () => {
      const rows = (cfg.options || []).map((o, i) => {
        const label = document.createElement('label');
        label.className = 'fx-opt';
        label.style.setProperty('--i', String(Math.min(i, STAGGER_CAP)));

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = o.value;
        input.checked = selected.has(o.value);

        const box = document.createElement('span');
        box.className = 'fx-box';
        box.innerHTML = TICK;

        const text = document.createElement('span');
        text.className = 'fx-opt-l';
        text.textContent = o.label;

        label.append(input, box, text);

        if (o.count != null) {
          const n = document.createElement('span');
          n.className = 'fx-opt-n';
          n.textContent = String(o.count);
          label.append(n);
        }

        input.addEventListener('change', () => {
          if (input.checked) selected.add(o.value);
          else selected.delete(o.value);
          emit();
        });

        return label;
      });
      scroll.replaceChildren(...rows);
    };

    const setOpen = state => {
      if (state === isOpen) return;
      isOpen = state;
      trigger.setAttribute('aria-expanded', String(state));

      if (state) {
        registry.forEach(w => { if (w !== api) w.close(); });
        panel.hidden = false;
        /* Force layout so the transition has a real start value. A rAF
           pair reads better but is throttled to a standstill in a
           backgrounded tab, which leaves the panel mounted and invisible
           — the same trap property-viewer.js hit. */
        void panel.offsetWidth;
        root.classList.add('open');
        const first = inputs()[0];
        if (first) first.focus({ preventScroll: true });
      } else {
        root.classList.remove('open');
        /* Unmount only once the fade has finished, so it does not vanish
           mid-transition. */
        const done = e => {
          if (e.target !== panel || e.propertyName !== 'opacity') return;
          panel.removeEventListener('transitionend', done);
          if (!isOpen) panel.hidden = true;
        };
        panel.addEventListener('transitionend', done);
        /* Reduced motion collapses the transition to ~0ms and some
           browsers then skip the event entirely. */
        setTimeout(() => { if (!isOpen) panel.hidden = true; }, 420);
      }
    };

    trigger.addEventListener('click', e => {
      e.stopPropagation();
      setOpen(!isOpen);
    });

    clearBtn.addEventListener('click', () => {
      if (!selected.size) return;
      selected.clear();
      inputs().forEach(i => { i.checked = false; });
      emit();
    });

    doneBtn.addEventListener('click', () => {
      setOpen(false);
      trigger.focus({ preventScroll: true });
    });

    /* Arrow keys walk the list; Escape gives focus back to the trigger,
       which is where a keyboard user expects to land. */
    panel.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        trigger.focus({ preventScroll: true });
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const list = inputs();
      const at = list.indexOf(document.activeElement);
      if (at === -1) return;
      e.preventDefault();
      const next = e.key === 'ArrowDown'
        ? Math.min(at + 1, list.length - 1)
        : Math.max(at - 1, 0);
      list[next].focus({ preventScroll: true });
    });

    root.addEventListener('click', e => e.stopPropagation());

    const api = {
      root,
      get: () => [...selected],
      set(values) {
        selected.clear();
        (values || []).forEach(v => selected.add(v));
        inputs().forEach(i => { i.checked = selected.has(i.value); });
        syncTrigger();
      },
      setOptions(options) {
        cfg.options = options || [];
        /* Drop anything the new option set no longer offers, or the
           trigger claims a filter the panel cannot show or undo. */
        [...selected].forEach(v => {
          if (!cfg.options.some(o => o.value === v)) selected.delete(v);
        });
        render();
        syncTrigger();
      },
      clear() {
        if (!selected.size) return false;
        selected.clear();
        inputs().forEach(i => { i.checked = false; });
        syncTrigger();
        return true;
      },
      close() { setOpen(false); },
    };

    registry.push(api);
    render();
    syncTrigger();
    return api;
  };

  /* One document listener for every widget, not one each. */
  document.addEventListener('click', () => registry.forEach(w => w.close()));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') registry.forEach(w => w.close());
  });
})();
