/* Private-consultation form — the hero CTA opens this instead of jumping
   straight into WhatsApp with an empty chat.

   WHERE THE REQUEST GOES — email, and only email
   This button was asked (2026-08-12) to deliver to info@lumina-jo.com and to
   show nothing else. It previously handed off through navigator.share, which
   put the PDF into WhatsApp properly on a phone but on desktop opened the OS
   share sheet — the whole Nearby-Share / Discord / Teams list — and let the
   client send a consultation request anywhere at all. That route is gone from
   this form. WhatsApp is still one tap away in the header and throughout the
   page; it is simply not what Send does.

   There is no server, and a browser cannot speak SMTP, so there are two ways
   out and they are tried in this order:

     MAIL_KEY set    fetch POST to Web3Forms, which relays the PDF to MAIL_TO
                     as a real attachment. Nothing opens, nothing is asked of
                     the client. This is the route Send promises.
     no key, or the
     POST failed     the client's own mail app, already addressed to MAIL_TO
                     with every detail written out, and the PDF saved beside
                     it to attach. No mail URL scheme can carry an attachment,
                     which is why the PDF travels separately.

   Either way the details also go as text, because the PDF is written with the
   standard PDF fonts (Latin-1) and an Arabic name would not survive that
   encoding. The text is Unicode.

   The PDF itself is built here, in the page, by hand — see buildPdf — because
   `script-src 'self'` rules out a CDN PDF library.

   The confirmation is #cfSeal in index.html, NOT a stage in this panel: the
   panel closes as the request leaves, so a confirmation inside it left too.
   Its wording is chosen per route and must keep matching what actually
   happened — "On its way" is only ever said for a send that really left. */
(() => {
  'use strict';

  const WHATSAPP = '962771505250';
  const DATA_URL = 'data/lumina-demo-leads.json?v=2026-08-06';
  const MAX_REFS = 3;

  /* ── where the request actually goes ──────────────────────────
     A static site cannot send email. There is no server here and there is
     not going to be one, so the PDF is relayed by Web3Forms: the browser
     POSTs it, they forward it to MAIL_TO as a real attachment.

     PASTE THE ACCESS KEY BELOW. Get it free at https://web3forms.com —
     enter info@lumina-jo.com, they email a key, it goes here. It is a
     PUBLIC key by design (it only says "deliver to the address this key
     was issued for"), so it is safe in client-side source; it is not a
     secret and must not be treated as one.

     Left empty, nothing breaks and nothing goes to WhatsApp: Send falls
     through to viaMailApp(), which opens the client's own mail app already
     addressed to MAIL_TO. The seal then says the email is OPEN rather than
     sent — "On its way" is reserved for the POST actually succeeding, so the
     page never claims a delivery that has not happened.

     Filling this in is the whole difference between "your mail app opens" and
     "it is already in the inbox".

     Free tier carries ONE attachment up to 5MB. These PDFs are a few KB.
     `https://api.web3forms.com` must stay in connect-src in _headers, or
     the site's own CSP blocks the POST. */
  const MAIL_ENDPOINT = 'https://api.web3forms.com/submit';
  const MAIL_KEY = '54fac48f-824a-4728-bca5-a61b73bfa911';
  const MAIL_TO = 'info@lumina-jo.com';
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

  const seal = document.getElementById('cfSeal');
  const sealTitle = document.getElementById('cfSealTitle');
  const sealMsg = document.getElementById('cfSealMsg');
  const sealDone = document.getElementById('cfSealDone');

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

  /* TWO stages in one panel now: fill it in, then read it back. The third
     used to be the confirmation, and it moved out to #cfSeal on 2026-08-12 —
     the panel closes when the request leaves, so a confirmation living inside
     it left with it. There is no 'done' state here any more; asking for one
     just hides both stages. */
  const show = which => {
    stage.hidden = which !== 'form';
    review.hidden = which !== 'review';
    form.classList.toggle('cf-reviewing', which === 'review');
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

    /* Say what Send will do before they commit. This used to describe two
       WhatsApp routes and could surprise a desktop client with the OS share
       sheet; there is one destination now and it is named. */
    rvHand.textContent = MAIL_KEY
      ? `Send delivers this straight to ${MAIL_TO}. Nothing else opens.`
      : `Send opens your email app addressed to ${MAIL_TO}, with these details written out and the PDF saved to attach.`;

    show('review');
    const go = review.querySelector('.cf-go');
    if (go) go.focus({ preventScroll: true });
  };

  /* ---- the sent seal ----
     Floating glass over the whole page, deliberately not a stage inside the
     panel: the panel closes when the request leaves, and a confirmation that
     lives inside it would leave with it. */
  let sealPrev = null;
  const openSeal = (title, msg) => {
    if (!seal) return;
    sealPrev = document.activeElement;
    sealTitle.textContent = title;
    sealMsg.textContent = msg;
    seal.hidden = false;
    /* Force a reflow before adding .in, so the transition has a real start
       value. rAF is throttled to nothing in a backgrounded tab, which is the
       same reason property-viewer.js reads offsetWidth rather than waiting on
       a frame pair — a seal that never animates in also never becomes
       visible, because it starts at opacity 0. */
    void seal.offsetWidth;
    seal.classList.add('in');
    if (sealDone) sealDone.focus({ preventScroll: true });
  };

  const closeSeal = () => {
    if (!seal || seal.hidden) return;
    seal.classList.remove('in');
    const finish = () => {
      seal.hidden = true;
      /* Re-arm the draw animations. They are `forwards` fills, so without
         removing and re-adding .in the ring and tick would already be at
         dashoffset 0 the next time the seal opens and would simply appear. */
      if (sealPrev && document.contains(sealPrev)) {
        try { sealPrev.focus({ preventScroll: true }); } catch (e) {}
      }
      sealPrev = null;
    };
    if (reduce) { finish(); return; }
    setTimeout(finish, 520);
  };

  /* ---- STEP TWO: send it ----
     Email first, WhatsApp as the route that has always worked. Whichever
     runs, the client is told what actually happened — the seal never says
     "on its way" for a send that has not left the device. */
  const dispatch = () => {
    const data = pending;
    if (!data) return;

    const blob = buildPdf(data);
    const fileName = `Lumina-consultation-${data.name.replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '').toLowerCase() || 'request'}.pdf`;
    const file = new File([blob], fileName, { type: 'application/pdf' });

    /* Close the panel and seal it. shut() runs its own exit transition, so
       the two overlap: the form leaves as the confirmation arrives. */
    const sealIt = (title, msg) => {
      shut();
      setTimeout(() => openSeal(title, msg), reduce ? 0 : 180);
    };

    const savePdf = () => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    };

    /* The route when there is no MAIL_KEY, and the safety net when the POST
       fails. It opens the client's own mail app already addressed to MAIL_TO
       with every detail written out, and saves the PDF beside it to attach.

       Deliberately NOT navigator.share and NOT wa.me. Web Share put the PDF
       into WhatsApp properly, but it hands the OS share sheet to the client
       and lets them send it anywhere — on Windows that sheet is the whole
       Nearby-Share/Discord/Teams list, which is not what a consultation
       request should offer. This button is email only, by instruction.
       WhatsApp is still one tap away in the header and all over the page.

       mailto cannot carry an attachment either — no mail URL scheme can — so
       the PDF downloads and the body carries the same content in Unicode,
       which the Latin-1 PDF fonts could not hold anyway. */
    const viaMailApp = () => {
      savePdf();
      const href = 'mailto:' + MAIL_TO +
        '?subject=' + encodeURIComponent('Consultation request — ' + data.name) +
        '&body=' + encodeURIComponent(messageText(data) +
          '\n\n(The PDF of this request has been saved to my device — attaching it now.)');
      location.href = href;
      sealIt('Nearly there',
             `Your email app is open and addressed to ${MAIL_TO} with these details ` +
             'written out — press send there. The PDF has saved to your device to attach.');
    };

    /* Web3Forms relays the PDF to MAIL_TO as a real attachment. FormData and
       no explicit Content-Type: the browser has to set the multipart boundary
       itself, and setting the header by hand omits it and the upload fails. */
    const viaEmail = () => {
      const fd = new FormData();
      fd.append('access_key', MAIL_KEY);
      fd.append('subject', `Consultation request — ${data.name}`);
      fd.append('from_name', 'Lumina website');
      fd.append('Name', data.name);
      fd.append('Properties', data.refs.length
        ? data.refs.map(r => (r.title ? `${r.ref} — ${r.title}` : r.ref)).join('\n')
        : 'None given');
      fd.append('Comments', data.comment || '—');
      fd.append('Sent', data.stamp);
      fd.append('attachment', file, fileName);

      return fetch(MAIL_ENDPOINT, { method: 'POST', body: fd })
        .then(r => {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(() => {
          sealIt('On its way',
                 `Your request has been sent to ${MAIL_TO} with the PDF attached. ` +
                 'We answer the same working day.');
        });
    };

    if (MAIL_KEY) {
      /* A blocked POST, a dead network or a rejected key must never strand the
         client on a spinner, so failure falls through to the mail-app route —
         which needs nothing to be reachable and is still addressed to the same
         inbox. It is never WhatsApp: this button was asked to be email only. */
      viaEmail().catch(() => viaMailApp());
      return;
    }
    viaMailApp();
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

  /* Seal dismissal. Escape and the backdrop close it as well as the button —
     it is a confirmation, not a decision, so every exit is the same exit. The
     form is reset behind it so the next enquiry starts clean. */
  if (sealDone) sealDone.addEventListener('click', () => { closeSeal(); reset(); });
  if (seal) seal.addEventListener('click', e => {
    if (e.target === seal) { closeSeal(); reset(); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && seal && !seal.hidden) { closeSeal(); reset(); }
  });

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
