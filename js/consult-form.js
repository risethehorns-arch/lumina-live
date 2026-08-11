/* Private-consultation form — the hero CTA opens this instead of jumping
   straight into WhatsApp with an empty chat.

   WHY THE HANDOFF LOOKS THE WAY IT DOES
   wa.me cannot carry an attachment. WhatsApp's click-to-chat API prefills
   text and nothing else, and `script-src 'self'` plus `connect-src 'self'`
   rule out both a CDN PDF library and an upload endpoint. So the PDF is
   built here, in the page, and handed over one of two ways:

     phones   navigator.share({files}) opens the system share sheet with the
              PDF attached; the client picks WhatsApp and it goes as a file.
     desktop  most desktop browsers refuse file shares, so the PDF downloads
              and wa.me opens with the same details as text. The panel says
              so rather than pretending the file went on its own.

   Either way the full details also travel as message text, which matters
   because the PDF is written with the standard PDF fonts (Latin-1) and an
   Arabic name would not survive the encoding. The text is Unicode. */
(() => {
  'use strict';

  const WHATSAPP = '962771505250';
  const DATA_URL = 'data/lumina-demo-leads.json?v=2026-08-06';
  const MAX_REFS = 3;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const form = document.getElementById('cf');
  const opener = document.getElementById('cfOpen');
  if (!form || !opener) return;

  const panel = form.querySelector('.cf-panel');
  const nameIn = document.getElementById('cf-name');
  const refIn = document.getElementById('cf-ref');
  const chipBox = document.getElementById('cf-chips');
  const refNote = document.getElementById('cf-ref-note');
  const commentIn = document.getElementById('cf-comment');
  const thread = form.querySelector('.cf-thread i');
  const submit = document.getElementById('cf-send');
  const stage = form.querySelector('.cf-stage');
  const review = form.querySelector('.cf-review');
  const done = form.querySelector('.cf-done');
  const doneMsg = document.getElementById('cf-done-msg');

  const rvName = document.getElementById('rv-name');
  const rvRefs = document.getElementById('rv-refs');
  const rvComment = document.getElementById('rv-comment');
  const rvStamp = document.getElementById('rv-stamp');
  const rvHand = document.getElementById('cf-hand');

  let refs = [];            // [{ref, title}]
  let listings = null;      // ref -> title, once fetched
  let lastFocus = null;
  let pending = null;       // the data being reviewed

  /* ==========================================================
     A MINIMAL PDF WRITER
     Enough of PDF 1.4 to lay out one A4 page of text: catalog,
     pages, page, one content stream and the two standard
     Helvetica faces, which need no embedding.
     ========================================================== */

  /* The wordmark, turned into JPEG bytes a PDF can embed directly as a
     /DCTDecode XObject. PNG cannot go in raw without a zlib re-encode, and
     JPEG has no alpha — so it is composited onto the navy header band
     first, which is exactly what it sits on in the document anyway.
     Same-origin, so the canvas is never tainted. Cached after the first
     call; `false` means it failed and the header falls back to type. */
  const NAVY = '#0E1729';
  let logo;

  const loadLogo = () => new Promise(resolve => {
    if (logo !== undefined) { resolve(logo); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const w = 660;
        const h = Math.round((img.naturalHeight / img.naturalWidth) * w);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        g.fillStyle = NAVY;
        g.fillRect(0, 0, w, h);
        g.drawImage(img, 0, 0, w, h);
        const bin = atob(c.toDataURL('image/jpeg', 0.92).split(',')[1]);
        logo = { data: bin, w: w, h: h, ratio: img.naturalWidth / img.naturalHeight };
      } catch (e) {
        logo = false;
      }
      resolve(logo);
    };
    img.onerror = () => { logo = false; resolve(logo); };
    img.src = 'assets/lumina-logo.png';
  });

  const latin1 = s => String(s).replace(/[^\x20-\xFF]/g, '?');
  const esc = s => latin1(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  /* Helvetica advance widths, /1000 em, for the ASCII range. Enough to
     wrap a line without shipping a metrics table for a font nobody sees. */
  const WIDTH = (ch, bold) => {
    const c = ch.charCodeAt(0);
    if (c === 32) return 278;
    if (ch >= '0' && ch <= '9') return 556;
    if (ch >= 'A' && ch <= 'Z') return bold ? 722 : 667;
    if ('ijltIJ'.includes(ch)) return bold ? 278 : 222;
    if ('mwMW'.includes(ch)) return bold ? 889 : 833;
    if (ch >= 'a' && ch <= 'z') return bold ? 556 : 500;
    if ('.,:;\'`'.includes(ch)) return 278;
    return 500;
  };

  const textWidth = (s, size, bold) => {
    let w = 0;
    for (const ch of latin1(s)) w += WIDTH(ch, bold);
    return (w / 1000) * size;
  };

  const wrap = (s, size, bold, maxW) => {
    const out = [];
    for (const para of String(s).split(/\r?\n/)) {
      if (!para.trim()) { out.push(''); continue; }
      let line = '';
      for (const word of para.split(/\s+/)) {
        const next = line ? line + ' ' + word : word;
        if (textWidth(next, size, bold) > maxW && line) {
          out.push(line);
          line = word;
        } else {
          line = next;
        }
      }
      if (line) out.push(line);
    }
    return out;
  };

  const buildPdf = data => {
    const W = 595.28, H = 841.89;          // A4 points
    const M = 56;                          // margin
    const COL = W - M * 2;
    const ops = [];
    const rgb = (r, g, b) => `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)}`;

    // header band, brand navy
    ops.push(`${rgb(14, 23, 41)} rg`, `0 ${H - 132} ${W} 132 re f`);
    // gold hairline under it
    ops.push(`${rgb(255, 178, 90)} rg`, `0 ${H - 134} ${W} 2 re f`);

    const put = (t, x, y, size, bold, colour) => {
      ops.push('BT', `${colour} rg`, `/${bold ? 'FB' : 'FR'} ${size} Tf`,
               `1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm`, `(${esc(t)}) Tj`, 'ET');
    };

    /* the wordmark itself when it loaded, set type when it did not */
    if (logo) {
      const lh = 30, lw = lh * logo.ratio;
      ops.push('q', `${lw.toFixed(2)} 0 0 ${lh} ${M} ${(H - 78).toFixed(2)} cm`, '/Im0 Do', 'Q');
    } else {
      put('LUMINA', M, H - 66, 22, true, rgb(246, 241, 231));
    }
    put('Private property advisory  ·  Amman, Jordan', M, H - 96, 9, false, rgb(255, 178, 90));
    put('CONSULTATION REQUEST', M, H - 118, 9, true, rgb(200, 190, 175));

    let y = H - 178;
    const ink = rgb(20, 26, 36);
    const soft = rgb(110, 120, 134);
    const gold = rgb(150, 105, 40);

    const label = t => {
      put(t.toUpperCase(), M, y, 8, true, gold);
      y -= 17;
    };
    const body = (t, size = 11) => {
      for (const line of wrap(t, size, false, COL)) {
        put(line, M, y, size, false, ink);
        y -= size * 1.55;
      }
    };
    const rule = () => {
      y -= 6;
      ops.push(`${rgb(214, 208, 198)} rg`, `${M} ${y} ${COL} 0.7 re f`);
      y -= 22;
    };

    label('Submitted');
    body(data.stamp, 10);
    rule();

    label('Full name');
    body(data.name, 13);
    rule();

    label(`Property reference${data.refs.length === 1 ? '' : 's'}`);
    if (data.refs.length) {
      for (const r of data.refs) {
        put(`Ref ${r.ref}`, M, y, 12, true, ink);
        if (r.title) put(r.title, M + 62, y, 10, false, soft);
        y -= 20;
      }
    } else {
      body('None given — general consultation.', 11);
    }
    rule();

    label('Comments');
    body(data.comment || 'None.', 11);

    // footer
    ops.push(`${rgb(214, 208, 198)} rg`, `${M} 92 ${COL} 0.7 re f`);
    put('Sent from lumina-jo.com — the client filled this in on the site.', M, 74, 8.5, false, soft);
    put(`WhatsApp +${WHATSAPP}`, M, 60, 8.5, false, soft);

    const stream = ops.join('\n');

    const xobj = logo ? ' /XObject << /Im0 7 0 R >>' : '';
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] ` +
        `/Resources << /Font << /FR 5 0 R /FB 6 0 R >>${xobj} >> /Contents 4 0 R >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    ];
    if (logo) {
      objects.push(
        `<< /Type /XObject /Subtype /Image /Width ${logo.w} /Height ${logo.h} ` +
        '/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ' +
        `/Length ${logo.data.length} >>\nstream\n${logo.data}\nendstream`);
    }

    let pdf = '%PDF-1.4\n';
    const offsets = [];
    objects.forEach((o, i) => {
      offsets.push(pdf.length);
      pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
           `startxref\n${xref}\n%%EOF`;

    const bytes = new Uint8Array(pdf.length);
    for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
    return new Blob([bytes], { type: 'application/pdf' });
  };

  /* ==========================================================
     REFERENCE CHIPS
     ========================================================== */

  const loadListings = () => {
    if (listings) return Promise.resolve(listings);
    return fetch(DATA_URL)
      .then(r => (r.ok ? r.json() : []))
      .then(rows => {
        listings = new Map();
        (Array.isArray(rows) ? rows : []).forEach(l => {
          if (l && l.ref) listings.set(String(l.ref), String(l.title || ''));
        });
        return listings;
      })
      /* A failed lookup must not stop someone sending an enquiry. The ref
         goes through unverified rather than being refused. */
      .catch(() => (listings = new Map()));
  };

  const paintRefs = () => {
    chipBox.replaceChildren();
    refs.forEach((r, i) => {
      const chip = document.createElement('span');
      chip.className = 'cf-chip';
      chip.style.setProperty('--i', String(i));
      if (!r.title) chip.classList.add('unknown');

      const num = document.createElement('b');
      num.textContent = r.ref;
      chip.appendChild(num);

      if (r.title) {
        const t = document.createElement('em');
        t.textContent = r.title;
        chip.appendChild(t);
      }

      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'cf-chip-x';
      x.setAttribute('aria-label', `Remove reference ${r.ref}`);
      x.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
        '<path d="M6 6l12 12M18 6L6 18"/></svg>';
      x.addEventListener('click', () => {
        refs = refs.filter(o => o.ref !== r.ref);
        paintRefs();
        refIn.focus();
      });
      chip.appendChild(x);
      chipBox.appendChild(chip);
    });

    const full = refs.length >= MAX_REFS;
    refIn.disabled = full;
    refIn.placeholder = full ? 'Three is the limit' : 'e.g. 015 — press Enter';
    form.classList.toggle('cf-full', full);
    refNote.textContent = full
      ? `Three references is the most we can arrange in one visit. Remove one to swap it.`
      : `${refs.length} of ${MAX_REFS} added. Press Enter after each.`;
    syncThread();
  };

  const addRef = raw => {
    const ref = String(raw).trim().replace(/[^0-9]/g, '');
    if (!ref) return;
    if (refs.length >= MAX_REFS) return;
    const padded = ref.padStart(3, '0');
    if (refs.some(r => r.ref === padded)) {
      refIn.value = '';
      flash(refIn);
      return;
    }
    loadListings().then(map => {
      if (refs.length >= MAX_REFS) return;
      refs.push({ ref: padded, title: map.get(padded) || '' });
      refIn.value = '';
      paintRefs();
    });
  };

  const flash = el => {
    el.classList.remove('cf-nudge');
    void el.offsetWidth;
    el.classList.add('cf-nudge');
  };

  /* ==========================================================
     PROGRESS THREAD
     ========================================================== */

  const syncThread = () => {
    let filled = 0;
    if (nameIn.value.trim()) filled++;
    if (refs.length) filled++;
    if (commentIn.value.trim()) filled++;
    if (thread) thread.style.transform = `scaleX(${filled / 3})`;
    submit.disabled = !nameIn.value.trim();
  };

  /* ==========================================================
     OPEN / CLOSE — the panel grows out of the button it was
     opened from, so it reads as that control expanding rather
     than a dialog arriving from nowhere.
     ========================================================== */

  const originFromButton = () => {
    const r = opener.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    if (!p.width) return;
    const dx = (r.left + r.width / 2) - (p.left + p.width / 2);
    const dy = (r.top + r.height / 2) - (p.top + p.height / 2);
    panel.style.setProperty('--cf-dx', `${dx.toFixed(1)}px`);
    panel.style.setProperty('--cf-dy', `${dy.toFixed(1)}px`);
  };

  const open = e => {
    if (e) e.preventDefault();
    lastFocus = document.activeElement;
    form.hidden = false;
    /* Measure with the panel laid out but still closed, then force layout
       so the transition has a real start value. rAF is throttled to a
       standstill in a backgrounded tab, which would leave the panel
       mounted and invisible. */
    originFromButton();
    void form.offsetWidth;
    form.classList.add('open');
    document.documentElement.classList.add('cmx-locked');
    loadListings();
    /* warmed here so the wordmark is already bytes by the time Send is
       pressed — buildPdf is synchronous and will not wait for it */
    loadLogo();
    setTimeout(() => nameIn.focus({ preventScroll: true }), reduce ? 0 : 420);
  };

  const shut = () => {
    form.classList.remove('open');
    document.documentElement.classList.remove('cmx-locked');
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    const finish = () => { if (!form.classList.contains('open')) form.hidden = true; };
    const onEnd = ev => {
      if (ev.target !== panel || ev.propertyName !== 'opacity') return;
      panel.removeEventListener('transitionend', onEnd);
      finish();
    };
    panel.addEventListener('transitionend', onEnd);
    setTimeout(finish, reduce ? 30 : 700);
  };

  /* Three stages in one panel: fill it in, read it back, confirmation. */
  const show = which => {
    stage.hidden = which !== 'form';
    review.hidden = which !== 'review';
    done.hidden = which !== 'done';
    form.classList.toggle('cf-reviewing', which === 'review');
    form.classList.toggle('cf-sent', which === 'done');
  };

  const reset = () => {
    refs = [];
    pending = null;
    nameIn.value = '';
    commentIn.value = '';
    refIn.value = '';
    show('form');
    paintRefs();
  };

  /* ==========================================================
     SEND
     ========================================================== */

  const messageText = data => {
    const lines = ['Consultation request — Lumina', '', `Name: ${data.name}`];
    lines.push(data.refs.length
      ? `References: ${data.refs.map(r => r.ref).join(', ')}`
      : 'References: none given');
    data.refs.forEach(r => { if (r.title) lines.push(`  ${r.ref} — ${r.title}`); });
    if (data.comment) lines.push('', `Comments: ${data.comment}`);
    lines.push('', `Sent ${data.stamp}`);
    return lines.join('\n');
  };

  /* ---- STEP ONE: read it back ----
     Nothing leaves the page here. The preview is a scaled sheet of paper
     laid out like the PDF itself, so what is on screen is what arrives. */
  const canShareFile = () => {
    try {
      const probe = new File([new Blob(['x'])], 'x.pdf', { type: 'application/pdf' });
      return !!(navigator.canShare && navigator.canShare({ files: [probe] }) && navigator.share);
    } catch (e) {
      return false;
    }
  };

  const toReview = () => {
    const name = nameIn.value.trim();
    if (!name) { flash(nameIn); nameIn.focus(); return; }

    pending = {
      name,
      refs: refs.slice(),
      comment: commentIn.value.trim(),
      stamp: new Date().toLocaleString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }),
    };

    rvName.textContent = pending.name;
    rvStamp.textContent = pending.stamp;
    rvComment.textContent = pending.comment || 'None.';
    rvComment.classList.toggle('cf-empty', !pending.comment);

    rvRefs.replaceChildren();
    if (pending.refs.length) {
      pending.refs.forEach((r, i) => {
        const row = document.createElement('span');
        row.className = 'cf-rv-ref';
        row.style.setProperty('--i', String(i));
        const b = document.createElement('b');
        b.textContent = r.ref;
        row.appendChild(b);
        if (r.title) {
          const em = document.createElement('em');
          em.textContent = r.title;
          row.appendChild(em);
        }
        rvRefs.appendChild(row);
      });
    } else {
      const none = document.createElement('span');
      none.className = 'cf-rv-ref cf-empty';
      none.textContent = 'None — general consultation.';
      rvRefs.appendChild(none);
    }

    /* Say which of the two routes this device will take, before they
       commit, rather than surprising them with a share sheet. */
    rvHand.textContent = canShareFile()
      ? 'Send opens WhatsApp with the PDF attached — choose Lumina in the list to deliver it.'
      : 'Send opens the Lumina chat with these details, and saves the PDF to your device to attach.';

    show('review');
    const go = review.querySelector('.cf-go');
    if (go) go.focus({ preventScroll: true });
  };

  /* ---- STEP TWO: hand it to WhatsApp ---- */
  const dispatch = () => {
    const data = pending;
    if (!data) return;

    const blob = buildPdf(data);
    const fileName = `Lumina-consultation-${data.name.replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '').toLowerCase() || 'request'}.pdf`;
    const file = new File([blob], fileName, { type: 'application/pdf' });
    const chat = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(messageText(data))}`;

    const showDone = msg => {
      doneMsg.textContent = msg;
      show('done');
      const back = done.querySelector('.cf-again');
      if (back) back.focus({ preventScroll: true });
    };

    const fallback = () => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      /* This route is addressed: wa.me carries the number, so the enquiry
         lands on the Lumina line whatever the client does next. */
      window.open(chat, '_blank', 'noopener');
      showDone('WhatsApp is open on the Lumina line with your details already written out — ' +
               'press send there. The PDF has saved to your device if you would like to attach it too.');
    };

    /* Web Share is the only route that puts the PDF itself into WhatsApp;
       no API can hand a file to one particular chat, so the client picks
       Lumina from the list. Phones support this, most desktops do not. */
    if (canShareFile()) {
      navigator.share({
        files: [file],
        title: 'Lumina consultation request',
        text: messageText(data),
      })
        .then(() => showDone('Sent. If WhatsApp is still asking, choose Lumina — ' +
                             'the PDF goes across as an attachment.'))
        .catch(err => {
          /* A cancelled share sheet is not a failure. Go back to the review
             so Send can be pressed again without retyping anything. */
          if (err && err.name === 'AbortError') { show('review'); return; }
          fallback();
        });
      return;
    }
    fallback();
  };

  /* ==========================================================
     WIRING
     ========================================================== */

  opener.addEventListener('click', open);

  form.querySelectorAll('[data-cf-close]').forEach(el =>
    el.addEventListener('click', shut));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && form.classList.contains('open')) shut();
  });

  /* Keep tab inside the dialog while it is open. */
  form.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const f = [...panel.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled])')]
      .filter(el => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  refIn.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      addRef(refIn.value);
    } else if (e.key === 'Backspace' && !refIn.value && refs.length) {
      refs.pop();
      paintRefs();
    }
  });
  refIn.addEventListener('blur', () => addRef(refIn.value));
  refIn.addEventListener('paste', e => {
    const txt = (e.clipboardData || window.clipboardData).getData('text') || '';
    if (!/[,\s]/.test(txt)) return;
    e.preventDefault();
    txt.split(/[,\s]+/).forEach(addRef);
  });

  nameIn.addEventListener('input', syncThread);
  commentIn.addEventListener('input', syncThread);
  submit.addEventListener('click', toReview);

  review.querySelector('.cf-go').addEventListener('click', dispatch);
  /* Edit keeps everything typed; Cancel is the one that throws it away. */
  review.querySelector('.cf-edit').addEventListener('click', () => {
    show('form');
    nameIn.focus({ preventScroll: true });
  });
  review.querySelector('.cf-cancel').addEventListener('click', () => {
    shut();
    setTimeout(reset, reduce ? 40 : 720);
  });

  const again = done.querySelector('.cf-again');
  if (again) again.addEventListener('click', () => { reset(); nameIn.focus(); });

  /* The panel is centred by the grid, so its offset from the button has to
     be recomputed when the viewport changes under an open dialog. */
  addEventListener('resize', () => {
    if (form.classList.contains('open')) originFromButton();
  });

  paintRefs();
  /* Decoded up front, not on submit: buildPdf is synchronous, and dispatch
     has to stay in the same task as the click or Safari rejects the share
     as gestureless. The bar already renders this file, so it is cached. */
  loadLogo();
})();
