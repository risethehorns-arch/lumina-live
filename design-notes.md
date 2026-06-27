# Lumina Website — Design Notes

## Design System

File: website/css/style.css
Approach: Single shared CSS file — all pages use it. Page-specific styles are
          in <style> blocks within each HTML file.

---

## Color Palette

--navy:       #0D1B2A   (primary background, nav, panels)
--navy-mid:   #142236   (secondary dark areas)
--navy-light: #1E3451   (card backgrounds, placeholders)
--gold:       #C9A84C   (accent, CTAs, labels, highlights)
--gold-light: #E2C97E   (hover state)
--white:      #F9F7F4   (page background)
--off-white:  #EDE9E3   (section alternates, card areas)
--gray:       #9A9590   (body text, meta info)

---

## Typography

Headlines: Playfair Display (Google Fonts) — serif, italic for elegance
Body:      Inter (Google Fonts) — clean, readable
Arabic (future): Noto Naskh Arabic

---

## Layout Principles

- Max width: 1280px, centered
- Section padding: 100px top/bottom
- Container: 40px horizontal padding (24px mobile)
- Grid: 3-column for cards, 2-column for detail pages
- Images: aspect-ratio locked, never distorted

---

## Components Built

nav             — Fixed, transparent → navy on scroll
.btn-gold       — Primary CTA (gold background, navy text)
.btn-outline-gold — Secondary CTA
.btn-outline-white — On dark backgrounds
.property-card  — Listing card with hover lift effect
.label          — Uppercase gold eyebrow text
.gold-line      — 60px gold horizontal rule
.whatsapp-float — Fixed bottom-right WhatsApp button
.footer         — 4-column, navy background
.fade-up        — Scroll-triggered fade-in animation

---

## Page Structures

### index.html (Homepage)
1. Nav (fixed, transparent → scrolled)
2. Hero (full-viewport, image bg + overlay)
3. Stats Bar (4-col, navy)
4. Property Search (filters row)
5. Featured Properties (3-col grid)
6. Prime Locations (4-col image cards)
7. Why Lumina (2-col: image left, points right)
8. CTA / Inquiry Section (centered, navy bg)
9. Footer (4-col)
10. WhatsApp Float Button

### listings.html (Properties Page)
1. Nav (scrolled state, always dark)
2. Page Header (navy, large title)
3. Filter Bar (sticky, type pills + selects)
4. Listings Grid (3-col, featured card spans 2)
5. Load More / Off-market CTA
6. Footer
7. WhatsApp Float

### property-details.html (Property Detail)
1. Nav (scrolled state)
2. Gallery (full-width main + 4 thumbs)
3. Breadcrumb
4. Detail Grid:
   Left (2/3):  price, title, specs strip, description,
                highlights, location + map
   Right (1/3): sticky inquiry panel (form + WhatsApp)
5. Similar Properties (3-col)
6. Footer
7. WhatsApp Float

---

## Conversion Architecture

Every page has:
- Floating WhatsApp button (always visible)
- At least 1 primary CTA above the fold
- Secondary CTAs throughout scroll

Primary conversion: WhatsApp direct message
Secondary conversion: Inquiry form → manual follow-up
Tertiary: Email

---

## Image Placeholders

All images reference assets/images/*.jpg
Replace with real photos when available.
Recommended: professional photography, minimum 8 photos per listing.
Image sizes:
- Hero: 1920x1080 minimum
- Gallery main: 1600x900 minimum
- Thumbnails: 800x600
- Property cards: 800x600
- Location cards: 600x800 (portrait)

---

## Demo Test Run Notes

Current demo listing data lives in:
- assets/data/demo-properties.json
- assets/data/demo-leads.csv

Demo price disclaimer:
“Demo price includes a test margin for workflow simulation only. Final pricing requires owner approval and live market verification.”

The demo listings are not confirmed Lumina inventory. They are public-source workflow test leads only. Do not claim ownership, exclusivity, verified availability, or final pricing until owner approval and live verification are complete.

Demo images use licensed/free stock imagery for visual testing. They are not copied from property portals and are not represented as source listing photography.

---

## Next Steps (Website)

1. Replace all placeholder images with real photos
2. WhatsApp configured: https://wa.me/9627XXXXXXXX
3. Email configured: lumina@qutaifan.com
4. Add Google Maps embed to property detail page
5. Build /about.html page
6. Build /contact.html page
7. Build /valuation.html (lead magnet)
8. Register domain + deploy (Netlify recommended — free, fast)
9. Set up Google Analytics
10. Set up Google My Business
