(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine   = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  document.getElementById('yr').textContent = new Date().getFullYear();

  /* ── boot ─────────────────────────────────────────────── */
  const boot = $('#boot');
  const lift = () => setTimeout(() => boot.classList.add('done'), 240);
  window.addEventListener('load', lift);
  setTimeout(lift, 2200);              // never hold the page hostage

  /* ── cursor parallax + light follower ─────────────────── */
  const glow = $('#glow');
  let tx = 0, ty = 0, cx = 0, cy = 0, gx = 0, gy = 0, moved = false;

  if (fine && !reduce) {
    addEventListener('pointermove', e => {
      tx = (e.clientX / innerWidth  - .5) * 2;
      ty = (e.clientY / innerHeight - .5) * 2;
      gx = e.clientX; gy = e.clientY;
      if (!moved) { moved = true; glow.classList.add('on'); }
    }, { passive: true });

    let glowX = 0, glowY = 0;
    (function loop() {
      cx += (tx - cx) * .06;  cy += (ty - cy) * .06;
      glowX += (gx - glowX) * .1; glowY += (gy - glowY) * .1;
      document.documentElement.style.setProperty('--px', cx.toFixed(4));
      document.documentElement.style.setProperty('--py', cy.toFixed(4));
      glow.style.transform = `translate3d(${glowX.toFixed(1)}px,${glowY.toFixed(1)}px,0)`;
      requestAnimationFrame(loop);
    })();
  }

  /* ── reveal on scroll ─────────────────────────────────── */
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: .12 });
  $$('.rv').forEach(el => io.observe(el));

  /* ── per-line headline reveal ──────────────────────────── */
  /* Splits h1.display/h2.display into per-line spans so each line can
     rise from 110% with a dissolving blur, staggered by --lnd. Line
     breaks are layout-dependent, so this re-runs (debounced) on resize;
     an already-revealed headline is marked 'in' immediately, with no
     replay, since the DOM swap happens before the next paint. */
  const headlines = $$('h1.display, h2.display, .hero-title');
  if (!reduce && headlines.length) {
    /* Observe the (untransformed) .ln-wrap, not the .ln itself — the line
       span is deliberately transformed outside its wrapper's clipped box
       pre-reveal, so its own clipped intersection area is always zero and
       it would never be seen as intersecting. */
    const lineIO = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.querySelector('.ln').classList.add('in');
          lineIO.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: .12 });

    const splitLines = h => {
      const text = h.dataset.lnText || (h.dataset.lnText = h.textContent.trim());
      const measure = document.createElement('span');
      const words = text.split(/\s+/);
      words.forEach((w, i) => {
        const wd = document.createElement('span');
        wd.style.display = 'inline-block';
        wd.textContent = w;
        measure.appendChild(wd);
        if (i < words.length - 1) measure.appendChild(document.createTextNode(' '));
      });
      h.innerHTML = '';
      h.appendChild(measure);

      const lines = [];
      let lastTop = null;
      $$('span', measure).forEach(wd => {
        const top = wd.offsetTop;
        if (top !== lastTop) { lines.push([]); lastTop = top; }
        lines[lines.length - 1].push(wd.textContent);
      });

      h.innerHTML = '';
      lines.forEach((words, i) => {
        const wrap = document.createElement('span');
        wrap.className = 'ln-wrap';
        const ln = document.createElement('span');
        ln.className = 'ln';
        ln.style.setProperty('--lnd', (i * 90) + 'ms');
        ln.textContent = words.join(' ');
        wrap.appendChild(ln);
        h.appendChild(wrap);
        if (i < lines.length - 1) h.appendChild(document.createTextNode(' '));
        lineIO.observe(wrap);
      });
    };

    headlines.forEach(splitLines);

    let rTimer;
    addEventListener('resize', () => {
      clearTimeout(rTimer);
      rTimer = setTimeout(() => {
        headlines.forEach(h => {
          const wasRevealed = h.querySelector('.ln')?.classList.contains('in') ?? false;
          splitLines(h);
          if (wasRevealed) $$('.ln', h).forEach(l => l.classList.add('in'));
        });
      }, 200);
    }, { passive: true });
  }

  /* ── brand bar condense ───────────────────────────────── */
  const bar = $('#bar');
  const onScrollBar = () => bar.classList.toggle('stuck', scrollY > 40);
  onScrollBar();

  /* ── spine: progress + active section ─────────────────── */
  const fill  = $('#fill');
  const dots  = $$('#spine button');
  const secs  = dots.map(b => document.getElementById(b.dataset.to)).filter(Boolean);

  dots.forEach(b => b.addEventListener('click', () => {
    document.getElementById(b.dataset.to)
      ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }));

  const onScrollSpine = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    fill.style.setProperty('--prog', (max > 0 ? clamp(scrollY / max, 0, 1) * 100 : 0) + '%');
    const mid = scrollY + innerHeight * .42;
    let active = 0;
    secs.forEach((s, i) => { if (s.offsetTop <= mid) active = i; });
    dots.forEach((d, i) => d.setAttribute('aria-current', i === active ? 'true' : 'false'));
  };

  /* ── background parallax on the villa band ────────────── */
  /* The image is CSS-scaled to 1.18, leaving 9% overflow top and bottom, so a
     ±7% translate can never expose an edge. It drifts down as the page scrolls
     up, which reads as the background moving slower than the foreground. */
  const plx = $$('[data-plx]');
  const onScrollPlx = () => {
    if (reduce) return;
    plx.forEach(img => {
      const host = img.closest('section');
      if (!host) return;
      const r = host.getBoundingClientRect();
      if (r.bottom < -120 || r.top > innerHeight + 120) return;
      const p = clamp((innerHeight / 2 - (r.top + r.height / 2)) / ((innerHeight + r.height) / 2), -1, 1);
      img.style.transform = `translate3d(0,${(p * 7).toFixed(2)}%,0) scale(1.18)`;
    });
  };

  /* ── aperture bridge: clip-path reveal across the pinned scroll range ──
     0% at the top and bottom of the pin, 0% (fully open) at the midpoint —
     a triangle wave over progress, scaled by the section's own --ap-max. */
  const aperture = $('#film');
  const apMax = aperture ? parseFloat(getComputedStyle(aperture).getPropertyValue('--ap-max')) || 42 : 42;
  const onScrollAperture = () => {
    if (!aperture || reduce) return;
    const r = aperture.getBoundingClientRect();
    const total = r.height - innerHeight;
    const p = total > 0 ? clamp(-r.top / total, 0, 1) : 0;
    aperture.style.setProperty('--ap', (apMax * Math.abs(2 * p - 1)).toFixed(2) + '%');
  };

  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScrollBar(); onScrollSpine(); onScrollPlx(); onScrollAperture(); ticking = false; });
  }, { passive: true });
  onScrollSpine(); onScrollPlx(); onScrollAperture();

  /* ── card tilt + tracking specular ────────────────────── */
  if (fine && !reduce) {
    $$('.tilt').forEach(card => {
      let raf = null, rx = 0, ry = 0;
      const apply = () => {
        card.style.transform = `perspective(1000px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-6px)`;
        raf = null;
      };
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        ry = (px - .5) * 7; rx = (.5 - py) * 5;
        card.style.setProperty('--sx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--sy', (py * 100).toFixed(1) + '%');
        if (!raf) raf = requestAnimationFrame(apply);
      }, { passive: true });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });

    /* ── magnetic buttons ───────────────────────────────── */
    $$('.mag').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        el.style.transform = `translate(${(dx * 7).toFixed(1)}px,${(dy * 5 - 2).toFixed(1)}px)`;
      }, { passive: true });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ── film band: play only while visible, draw loop progress ── */
  const band = $('#bandFilm'), prog = $('#filmProg');
  if (band) {
    const vis = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { band.preload = 'auto'; band.play?.().catch(() => {}); }
      else band.pause?.();
    }), { threshold: .18 });
    vis.observe(band);

    let pRaf = null;
    const draw = () => {
      if (band.duration) prog.style.width = (band.currentTime / band.duration * 100) + '%';
      pRaf = requestAnimationFrame(draw);
    };
    band.addEventListener('play',  () => { if (!pRaf) draw(); });
    band.addEventListener('pause', () => { cancelAnimationFrame(pRaf); pRaf = null; });
  }

  /* ── contact form → prefilled WhatsApp ────────────────── */
  $('#send')?.addEventListener('click', () => {
    const name   = $('#f-name').value.trim();
    const hood   = $('#f-hood').value;
    const budget = $('#f-budget').value;
    const note   = $('#f-note').value.trim();
    const msg =
      `Hello Lumina — ${name || 'enquiry'} here.\n` +
      `District: ${hood}\nBudget: ${budget}` +
      (note ? `\nNotes: ${note}` : '') +
      `\n\nCould you send the current collection?`;
    open('https://wa.me/962771505250?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  });
})();