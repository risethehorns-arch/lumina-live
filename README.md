# Lumina — brokerage site

Single-file build. No dependencies, no build step. Netlify-ready.

```
index.html
assets/
  hero-lumina.jpg     the hero background, cropped from your concept render
  hero-still.jpg      previous hero background — no longer used, kept to revert to
  lumina-film.mp4     your video, trimmed to a clean 8s loop, plays in the film section only
  film-poster.jpg     frame 1, painted before the film-section video loads
  villa-dabouq.jpg    the villa photograph cropped out of your mockup (no UI in it)
  villa-detail.jpg    glazing detail from the same crop
  still-01/02/03.jpg  stills pulled from your film, used as card imagery
  villa-band.jpg      the villa crop upscaled 2x for the full-bleed parallax band
  advisory.jpg        a further film frame, cropped for the advisory section
```

## Deploy

Drag the whole folder onto **app.netlify.com/drop**. That's it. Or:

```bash
netlify deploy --prod --dir=.
```

## Swapping in real photography

Each listing card is one `<article class="card tilt rv">` block in `index.html`. Replace
the `src` and `alt`, keep the classes. Card media boxes are `4/3` (`16/9` for the wide one),
so crop to those ratios and export at ~1600px wide, 80% JPEG.

To turn a live listing into an off-market one, add `sealed` to the card's class list and
swap the price for `<em>Particulars on request</em>`. The blur, lock and label are automatic.

## Things to change before this goes live

- `advisory@lumina-amman.com` — placeholder, set your real address (2 places).
- Neighbourhood JOD/m² figures and the six listings are plausible placeholders, not data.
- `14 active mandates`, `61% off-market`, `9 years` in the hero and advisory sections.
- WhatsApp is wired to `962771505250` throughout, including the contact form, which
  composes the enquiry and opens WhatsApp with it pre-written. No backend needed.

## The parallax band

`<section class="band" id="house">` sits between the approach statement and the listings.
Its background is CSS-scaled to `1.18` and the script translates it +/-7% on scroll, so the
image can never expose an edge. To swap the photograph, replace `assets/villa-band.jpg` and
keep it at least 1800px wide. `object-position: 50% 26%` controls which part of the frame
survives the crop at wide viewports — raise the second value to show more foreground.

## Notes

- Motion respects `prefers-reduced-motion` — levitation, parallax, tilt and grain all stop.
- Tilt, magnetic buttons and the cursor light only initialise on fine-pointer devices.
- The film band video only plays while it's on screen, and is `preload="none"` until then.
- Fonts come from Google Fonts. To self-host, download Instrument Serif + Instrument Sans
  into `assets/fonts/` and swap the `<link>` for `@font-face` rules.
