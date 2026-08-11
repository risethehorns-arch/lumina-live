// LUMINA — site.js
// Nav scroll + mobile menu + smooth behaviors + contact configuration

(function () {
  'use strict';

  // --- Centralized Contact Details ---
  // Modify these values to update contact information across the entire website instantly.
  // 962791234567 / +962 7 9123 4567 sat here as a placeholder and was
  // rewriting every wa.me link on these pages to a number that is not
  // the business's. index.html has always used the real one directly.
  window.LuminaConfig = {
    whatsapp: '962771505250',      // Business WhatsApp number (numbers only, no spaces or '+' symbol)
    phone: '+962 77 150 5250',     // Customer-facing phone display format
    email: 'Lumina@lumina-jo.com'  // General enquiries. The mailbox must exist at the domain host.
  };

  /* Addresses this file is allowed to overwrite. Everything else in a
     mailto: is left alone — the substitution exists to fill in
     placeholders, and it used to rewrite every mailto on the page to
     config.email regardless. That silently redirected real addresses:
     the team page shows Saifnawaf@lumina-jo.com and the link went to
     info@qutaifan.com, with nothing on screen to say so. */
  const PLACEHOLDER_EMAILS = [
    'info@qutaifan.com',
    'lumina@qutaifan.com',
    'advisory@lumina-amman.com',
    'hello@example.com'
  ];

  // --- Dynamic Contact Placeholder Substitution ---
  function initContactDetails() {
    const config = window.LuminaConfig;
    if (!config) return;

    // 1. Update all WhatsApp links
    document.querySelectorAll('a[href*="wa.me/"]').forEach(a => {
      try {
        const hrefStr = a.getAttribute('href');
        // Handle full HTTP URLs or protocol-less links
        const url = new URL(hrefStr.startsWith('http') ? hrefStr : 'https://' + hrefStr.replace(/^\/+/, ''));
        const textParam = url.searchParams.get('text');
        
        // Build new WhatsApp URL, preserving query parameters like 'text'
        const newUrl = new URL(`https://wa.me/${config.whatsapp}`);
        if (textParam) {
          newUrl.searchParams.set('text', textParam);
        }
        a.href = newUrl.toString();
        
        // If link text is one of the placeholders, update it
        if (['9627XXXXXXXX', '962000000000'].includes(a.textContent.trim())) {
          a.textContent = config.phone;
        }
      } catch (err) {
        console.warn('Failed to parse WhatsApp link:', a.href, err);
      }
    });

    // 2. Fill in placeholder mailto links, and only those
    document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
      try {
        const raw = a.getAttribute('href').slice('mailto:'.length);
        const searchIndex = raw.indexOf('?');
        const address = (searchIndex !== -1 ? raw.slice(0, searchIndex) : raw).trim();
        const search = searchIndex !== -1 ? raw.slice(searchIndex) : '';

        if (!PLACEHOLDER_EMAILS.includes(address.toLowerCase())) return;

        a.href = `mailto:${config.email}${search}`;

        const trimmedText = a.textContent.trim().toLowerCase();
        if (PLACEHOLDER_EMAILS.includes(trimmedText)) {
          a.textContent = config.email;
        }
      } catch (err) {
        console.warn('Failed to parse mailto link:', a.getAttribute('href'), err);
      }
    });

    // 3. Scan leaf text nodes for text phone/email placeholders
    const placeholderRegexes = [
      { pattern: /\+962 7X XXX XXXX/g, replacement: config.phone },
      { pattern: /lumina@qutaifan\.com/g, replacement: config.email },
      { pattern: /info@qutaifan\.com/g, replacement: config.email },
      { pattern: /advisory@lumina-amman\.com/g, replacement: config.email },
      { pattern: /9627XXXXXXXX/g, replacement: config.whatsapp }
    ];

    document.querySelectorAll('span, p, a, li, div, button').forEach(el => {
      if (el.children.length === 0 && el.textContent) {
        let updatedText = el.textContent;
        let modified = false;

        placeholderRegexes.forEach(({ pattern, replacement }) => {
          if (pattern.test(updatedText)) {
            updatedText = updatedText.replace(pattern, replacement);
            modified = true;
          }
        });

        if (modified) {
          el.textContent = updatedText;
        }
      }
    });
  }

  // --- Sticky Nav ---
  const nav = document.querySelector('.nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 60);
    });
  }

  // --- Smooth anchor scroll ---
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // --- Intersection observer: fade-up on scroll ---
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

  // --- Run substitutions immediately or on DOM load ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContactDetails);
  } else {
    initContactDetails();
  }

  // --- Lightweight visibility signals (console only, no analytics) ---
  console.log('Lumina page load:', window.location.pathname);
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href*="wa.me"]');
    if (link) console.log('Lumina WhatsApp intent click:', window.location.pathname);
  });

})();
