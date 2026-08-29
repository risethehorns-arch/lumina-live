# Lumina — brokerage landing page

Single-page marketing site for **Lumina**, a private real-estate advisory in Amman, Jordan.
Audience: diplomats and foreign buyers arriving with a serious budget and a short timeline.
The page's one job is to get a qualified enquiry into WhatsApp.

## Stack

Static. **No build step, no framework, no package.json.** One HTML file with inline CSS and
one inline IIFE of vanilla JS. Deployed by dragging the folder to Netlify.

Do not introduce a bundler, React, Tailwind, or a CSS framework. If a change seems to need
one, say so and stop rather than adding it.

```
index.html          everything — styles in <style>, script in <script> at the end of <body>
assets/             all media (see provenance below)
README.md           deploy + asset-swap notes for the client
```

## Verify changes with

There is no test suite. Verification is visual:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Check at 1920px, 1024px and 390px widths, and once with reduced motion enabled
(Chrome DevTools → Rendering → Emulate `prefers-reduced-motion`).

## Design tokens — do not substitute

**Re-based 2026-07-28** on the client's "Landing page with elevated effects"
concept. The previous navy/soft-gold set was replaced wholesale at their
request; hardcoded `rgba()` literals throughout the file were swept to match, so
do not reintroduce the old values piecemeal.

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#05070B` | page base |
| `--navy` | `#0B1018` | brand base, panels |
| `--navy-2` / `--navy-3` | `#121A24` / `#1A2431` | raised surfaces |
| `--cream` | `#F7F2E9` | text |
| `--gold` | `#FFB25A` | amber accent — CTA border/fill, kickers, numerals |
| `--gold-lt` | `#FFE0B0` | glow highlights |
| `--gold-dp` | `#C07F3E` | hairlines |
| `--plinth` | `#7FD9E8` | cyan plinth glow (hero only) |

Six of these were transcribed a shade off when this table was written and were corrected against the stylesheets on 2026-08-18. The shipped values are the ones in `index.html`, `invest.html` and `css/elevated.css`; those three agree with each other exactly, and with `<meta name="theme-color">`. If this table and the CSS ever disagree again, the CSS is right.

Previous set, for reference if a revert is ever wanted: ink `#060C18`, navy
`#0E1729`, navy-2/3 `#16223A`/`#1E2C48`, cream `#F6F1E7`, gold `#D6BF9E`,
gold-lt `#FAE5C8`, gold-dp `#9C8259`.

Type: **Instrument Serif** (display, 400 only) + **Instrument Sans** (body/UI), Google Fonts.
Display type is always `.display`. Never set headlines in the sans.

## Architecture notes that are easy to break

**1. The float system uses two nested elements on purpose.**
`.lev` (CSS keyframe levitation) and `.depth` (cursor parallax) both animate `transform`.
They are deliberately on *separate* elements — `.depth` wrapper outside, `.lev` inside:

```html
<div class="depth" style="--d:22px"><div class="glass fact lev" style="--dur:12s">…</div></div>
```

Putting both classes on one element silently kills the levitation. Every floating panel
follows this pattern. Randomised `--dur`, `--amp`, `--delay`, `--rot` per element is what
stops the group pulsing in unison — keep them uncorrelated when adding panels.

**The collection cards need a third level.** They also carry `.tilt`, whose handler writes
an inline `transform` — and a CSS animation outranks an inline declaration, so `.lev` can
never sit on the card itself. `js/property-card.js` builds them as:

```html
<div class="prop-float rv"><div class="depth"><div class="lev"><article class="card tilt">…
```

`wide` belongs on `.prop-float` now, not `.card` — the grid item is the shell. The six
`--dur/--amp/--delay/--rot` sets live in the `FLOAT` table at the top of that file; they are
hand-picked rather than random so a grid never drifts into sync.

**2a. There is exactly one property card, shared by four pages.**
`js/property-card.js` (`Lumina.buildPropertyCard`) + `css/property-ui.css` are the single
source. `home-collection.js`, `listings.js` and `areas.js` all call it; anything
page-specific goes through `opts` (`wide`, `stagger`, `actions`). Do not fork it — the
listings page previously had its own flat `.listing-card`, and the two drifted immediately.

`css/property-ui.css` scopes **everything**, tokens included, under
`.grid-props`/`.prop-float`/`.pv`, using `--lum-*` names. That is deliberate: `index.html`
and `css/style.css` disagree on `--gold` (`#FFB25A` vs `#C2A35A`) and on type (Instrument
vs Inter), so unscoped tokens would either be overwritten by whichever page loaded them or
leak into that page's own components. It also re-declares the two `@font-face` rules, since
`style.css` never loaded them — re-declaring a face is a no-op, the browser dedupes on URL.

On `listings.html` and the `areas-*` pages, `<link href="css/property-ui.css">` sits **after**
the inline `<style>`. `.grid-props` and `.listings-grid`/`.preview-grid` are the same
specificity, so source order is what decides.

**2b. Cards injected after load need re-binding.** `lumina.js` exposes
`Lumina.refreshReveals()` and `Lumina.bindTilt(scope)`; `property-card.js` exposes
`Lumina.activateCards(scope)`, which calls those when present and installs equivalents
when not (only `index.html` loads `lumina.js`). Call it after every render — the listings
filters replace the whole grid, so first paint is not enough. `bindTilt` marks what it has
bound with `data-tilt`, so a re-scan can't stack duplicate listeners.

`activateCards` also starts a `--px/--py` pointer loop on pages that have no `lumina.js`.
`lumina.js` sets `Lumina.parallax = true` when it installs its own; that flag is the only
thing stopping two loops fighting over the same custom properties.

Its local reveal has a **1500 ms safety net**: if *nothing* has revealed by then it marks
everything `.in`. Cards start at `opacity: 0`, so an observer that never fires means a
blank page — survivable for six cards, not for the portfolio's 124. A partial reveal means
the observer is working and the rest are below the fold, so that case is left alone.

**2c. The property viewer hides with `hidden`, not `visibility`.**
`js/property-viewer.js` opens a semi-fullscreen gallery over the page (`window
.Lumina.openViewer(listing)`). Two things there are load-bearing and look wrong if you
"tidy" them:
- `.pv{display:grid}` outranks the UA `[hidden]` rule, so `.pv[hidden]{display:none}` has
  to be restated. It must be the attribute doing the hiding: `visibility` transitions
  discretely, so it still computes `hidden` on the frame the dialog opens and the
  `focus()` that runs on that frame silently does nothing.
- The open sequence forces a reflow (`void root.offsetWidth`) rather than waiting on a
  `requestAnimationFrame` pair. rAF is throttled to a standstill in a backgrounded tab,
  which left the window mounted but permanently invisible.

Both the stage layers and the thumbnail rail are windowed around the active index — there
are no separate thumbnail files, so every 60×44 thumb is one of the full-size photos and an
unwindowed rail pulls the whole gallery on open.

`listing.__askUrl`, if set, surfaces an extra WhatsApp link in the viewer footer.
`listings.js` sets it so a gallery opened from the portfolio still has an enquiry route;
the landing page and the area previews leave it undefined and the link stays hidden.

**2d. `css/style.css` and `css/property-ui.css` both define `.card-badge`.**
Every page except `index.html` loads the old system first, and its badge is
pinned `left:16px`. `property-ui.css` set only `right`, so both offsets
applied and the badge stretched the full width of every card — the word RENT
printed on a gold bar across the photograph, hiding the location tag
underneath it. The component now resets the opposite edge on all three media
chips (`left:auto` / `right:auto` / `top:auto` / `bottom:auto`). When adding
another absolutely-positioned chip to the card, set all four.

**2e. The filter bar sticks below the brand bar, not at zero.**
`.bar` is `position:fixed`, so `.filter-bar { top: 0 }` parked its first row
underneath it and the type pills were invisible the moment the page scrolled.
`js/listings.js` measures the header and publishes `--bar-h`; `filter-ui.css`
sticks to `var(--bar-h, 64px)`. The height is a `clamp()`, so it is measured
rather than assumed, and re-measured on resize. Below 680px the bar is not
sticky at all — stacked it is 240px tall, which is a third of a phone screen
spent on controls.

**2f. Levitation is paused off screen.** A hundred-odd cards each running a
`transform` keyframe is a hundred-odd compositor animations ticking whether
or not anyone can see them. `property-card.js` observes every `.prop-float`
and toggles `.rest`, which sets `animation-play-state: paused`. Paused, not
cancelled: a cancelled animation restarts at phase 0 and the grid pulses in
unison, which is the one failure mode the whole `FLOAT` table exists to avoid.

**7. Paths in `data/lumina-demo-leads.json` are root-absolute and must be stripped.**
Every `image_url` / `images[]` entry starts with `/`, which resolves fine on a domain root
and 404s under a GitHub Pages project path (`/lumina/`). `Lumina.relPath` does the strip;
`property-card.js`, `property-viewer.js` and `property-details.js` all use it or an inline
equivalent. `fetch()` calls for the JSON itself are relative for the same reason —
`listings.js`, `areas.js` and `property-details.js` each had `/data/...` and each was
broken under a sub-path deploy.

**2. Watch CSS specificity on the section-scoped rules.**
Several bugs were already fixed here: `.hood p` was overriding `.hood .stat`, and `.form>p`
was overriding `.form .fine`. When adding a rule scoped like `.section element`, check it
does not outrank a `.section .class` rule that comes later. Prefer class selectors.

**The header WhatsApp button is the worst case of this and is worth reading before you
touch the bar.** `.nav a{padding:6px 0}` is 0-1-1. `.chip{padding:9px 17px}` and
`.chip-icon{padding:14px}` are both 0-1-0, so *neither ever applied* — every chip in the
elevated cluster rendered with **zero horizontal padding**, and the icon variant came out a
23×35 lozenge rather than the circle it was written to be. Source order cannot save you
here; only specificity can. Fixed 2026-08-12 by scoping to `.nav a.chip-icon` (and
`.bar .nav a.chip-icon` in `css/nav.css`, which already scopes everything that way — which
is exactly why the old cluster was never affected).

**The button is now identical on all 19 pages: icon only, no label, 47px circle at desktop
and 45px on phones, amber halo, `aria-label="WhatsApp"`.** The rule block is duplicated in
`index.html`, `invest.html`, `css/elevated.css` and `css/nav.css` — the same trade the
tokens make — plus a phone override in `css/mobile.css` that must stay in step, because
`.bar .nav a.chip{padding:0 15px}` there would otherwise stretch the circle back into a
pill. Change one, change all five. `js/nav-menu.js` filters the sheet on the `.chip` class,
so the label can go without touching the phone menu, but the class cannot.

**3. Parallax band bounds.**
`.band-media img` is `scale(1.18)`, giving 9% overflow top and bottom. The scroll handler
translates it ±7%. If you increase the translate, increase the scale first or an edge
will show.

**4. One throttled scroll handler.**
`onScrollBar`, `onScrollSpine` and `onScrollPlx` all run inside a single rAF-gated scroll
listener. Add new scroll work to that loop — do not add another `scroll` listener.

**5. Spine dots map to section ids** via `data-to`. Adding a section means adding a dot,
or scroll progress tracking goes stale through it.

**6. No browser storage.** No `localStorage` or `sessionStorage` anywhere.

**8. The home collection is eight cards, and eight is load-bearing.**
The first card carries `.wide` (`grid-column:span 2`), so the grid holds nine cells, and
nine only divides cleanly by three. The shared `.grid-props` is `auto-fill minmax(300px,1fr)`,
which is right for the full portfolio but yields **four** columns past ~1300px and **three**
around 1100px — either leaves the last card alone in a row of gaps. `index.html` therefore
pins `#home-collection-grid` to three columns above 1180px (where `.wide` still spans two)
and two below it (where `property-ui.css` collapses `.wide` to one). Under 760px the shared
rules already give one or two columns and eight divides into both. Change `FEATURED` in
`home-collection.js` and you must re-check every one of those bands.

**10. The phone menu is generated from the bar, so editing the bar edits both.**
`js/nav-menu.js` builds the sheet from `.bar .nav a` (minus the WhatsApp chip). Removing a
link from the bar removes it from the phone menu too — that is the intent, but it means a
bar link is never "desktop only". `index.html`'s bar deliberately has **no Team link**: on
that page the bar is in-page anchors plus Properties, and the team card in `#advisory` is
the route to `team.html`. The footer keeps a text link so the destination is never one
hover away from unreachable. Every other page still carries Team in its own bar.

**11. The team card follows the same two-element transform rule as the property cards.**
`.team-cta` owns the `.rv` reveal transform; `.team-card` inside it owns `.tilt`, whose
handler writes an inline transform. On one element the first pointer crossing kills a
reveal still in flight. The card's pointer sheen reuses the `--sx`/`--sy` custom properties
`bindTilt` already writes — adding `.tilt` is the entire wiring, no new listener. Under
reduced motion `bindTilt` never binds, so the sheen simply stays off.

**9. `quality_score` is record completeness, not photo quality.**
It comes from the Excel import and 97 of 129 records score 5. It is fine as a "did this row
arrive whole" filter and useless as a ranking signal for how good a listing looks. Nothing
in the data describes the photographs — that is why the shop-window covers are curated by
eye in the JSON rather than scored.

## Asset provenance and constraints

All media is the client's own. There is no stock photography and none should be added.

| File | Origin | Constraint |
|---|---|---|
| `lumina-film.mp4` | re-cut 2026-07-27 (see below), video-only h264, faststart, 7.92s @ 1280×600, ~3.3MB | do not re-encode again; quality is already spent. Only used in `#film` now — the hero no longer autoplays it, see below |
| `film-poster.jpg` | frame 0 of that video | must match the video's first frame; used as the `#bandFilm` poster only |
| `assets/hero/1440/*.webp`, `assets/hero/960/*.webp` | **226** frames each — every SECOND frame of the 452-frame master — by `scripts/build-hero-frames.py` | **generated, not hand-edited** — regenerate rather than touching a frame. 7.57MB + 4.25MB. The master is NOT in this repo; it is at `../hero-source/Lumina_Hero_Master_1080p.mp4`, alongside the previous pod master, a golden-hour cloud loop and the supplied poster |
| `assets/og/home.jpg` | frame 217, cropped to 1200x630 by the same script | the landing page's share card. 1200x630 is not a preference — see the share-card rules below |
| `hero-lumina.jpg` | added 2026-07-28 from a client-supplied concept render, cropped free of baked-in UI then upscaled 2× to 2088×1280 | **the current hero background**; already upscaled, do not upscale further. See "hero render" below |
| `hero-still.jpg` | added 2026-07-27, frame 0 of the re-cut film, Lanczos-upscaled 2× to 2560×1200 | **no longer used** — superseded by `hero-lumina.jpg` on 2026-07-28. Kept only as a revert path; safe to delete once the new hero is signed off |
| `villa-dabouq.jpg` | crop from the client's mockup, 935×876 | this is the **maximum** clean width — beyond x=935 the mockup's own UI intrudes |
| `villa-band.jpg` | the above, Lanczos-upscaled 2× to 1870×1752 | already upscaled; do not upscale further |
| `advisory.jpg`, `still-01..03.jpg` | re-grabbed 2026-07-27 from the re-cut film at varied timestamps/crops | more frames can be pulled from `lumina-film.mp4` with ffmpeg |
| `villa-detail.jpg` | glazing crop, low-res | only used blurred behind an off-market seal |
| `assets/invest/*.jpg` | client drop `Lumina Invest/` (2026-08-17), eight photographs of the contractor's completed buildings — `SHOW/` gave the two single plates, `Swipe/` the six in the gallery. Imported at max side 1280, JPEG q80, EXIF applied then stripped | the **only** assets on the site that do not depict the Dabouq villa (see the hero render note for the other deliberate exception). They are the contractor's work, not Lumina's, and no caption may name an address — see the plate rules under `invest.html` below. The originals are outside the deploy, at `C:\Users\Yazan\Desktop\Lumina Invest\` |

**`lumina-film.mp4` was re-cut on 2026-07-27 — read this before touching it again.** The
original 15.04s / 1280×720 file was not clean b-roll: it was a screen recording of an
*earlier* version of this same mockup, with a nav bar ("Lumina." + Properties/
Neighborhoods/About/Contact) baked into every single frame for the full 15s, plus a
fading hero headline/button/panel overlay baked in for the first ~10.3s. That baked-in
chrome visually duplicated our real nav and hero card — it read as broken/ghosted UI,
not a design bug in this repo's own code. Only ~t=11.0–14.95s of the original was fully
clean. The fix: trim to that clean window, crop off the top 120px (removes the nav
strip), and loop it forward+reverse (boomerang) into a seamless 7.92s clip, since 4s
alone was too short/abrupt to loop on its own. `film-poster.jpg` and the four stills were
re-grabbed from this new clean file. The original raw files are preserved outside the
deployable folder, at `../lumina-site-original-assets-backup/`, in case the client wants
the source footage — do not restore them into `assets/` without redoing this crop/trim.

**The hero background was changed from autoplay video to a still image on 2026-07-27,
per client request for a "nicer, higher quality, minimal" look.** `#heroFilm` is gone;
`.hero-media` now holds a plain `<img src="assets/hero-still.jpg">`. Reasoning: the hero
was playing the identical loop as the dedicated `#film` section immediately below it —
redundant, and a compressed/cropped video is inherently softer than a still frame from
the same source. The film section keeps its real video, since showing actual film footage
is that section's whole reason for existing; the hero is now photography-led instead.
`.hero-media video,.hero-media img` share the same scale/parallax/drift treatment, so no
CSS changed. If a future request wants motion back in the hero, prefer reusing
`hero-still.jpg` with a slow CSS Ken Burns drift over reintroducing the video — cheaper,
sharper, and avoids the redundancy this change fixed.

**Hero render + composition, 2026-07-28 — several standing rules were knowingly relaxed
here at the client's direction. Read before "correcting" any of it.**

The client supplied a finished landing-page concept render and asked for it to become the
live hero. Like the original film, *every UI element in it was baked into the pixels*
(wordmark, nav, headline, two stat cards, CTA pill). It is cropped to `x 360–1404,
y 165–805` of the 1792×1008 source — the one window containing none of that chrome — then
upscaled 2×. Re-cropping wider on any side reintroduces baked text that will ghost behind
the real markup. The source render is kept at
`../lumina-site-original-assets-backup/` alongside the film originals.

Everything in the render is now live DOM instead: `.hero-lede` (kicker + headline + sub),
`.hero-stats` (two `.glass` cards), `.hero-cta` (`.btn-pill`). Deviations from this file's
own rules, all deliberate:

- **The render is a different property** from every other asset (which all depict the
  Dabouq villa). This breaks "every asset depicts the same property" — flagged to the
  client, who chose it anyway. The band and Cedar House card still show the real villa.
- **Palette stayed locked.** The render's amber/cyan light is photographic only; no new
  colour tokens were introduced. `.btn-pill` and the stat cards use `--gold`/`--gold-lt`.
- **The headline is `.display` in caps**, not the render's sans — "never set headlines in
  the sans" still holds. `text-transform:uppercase` bridges the two.
- **The `Lumina.` wordmark was kept**, not the render's letterspaced `LUMINA`. Changing the
  brand mark is a bigger decision than a hero swap; ask before doing it.
- **No "Agents" nav item** (the render has one) — there is no agents section, so it would
  be a dead link. Nav is Home / Properties / Neighbourhoods / About / Contact + WhatsApp.
- **Stat copy is the site's own**, not the render's "180+ Exclusive Listings" — that would
  contradict "Six residences, quietly available" in the collection section.

**Hero replaced again 2026-07-28 (pod render, "elevated effects" concept).**
The client supplied a DesignCode artboard (`Lumina Landing.dc.html` + a 67KB
`support.js`). It was **not** deployed as-is and must not be: it pulls React,
ReactDOM and Babel from `unpkg.com` and transpiles its logic with `eval`, all
of which the deploy target's CSP (`script-src 'self'`, no `unsafe-eval`) blocks
outright — it would have shipped a blank page. It is also a fixed
`aspect-ratio:1792/1008` artboard with `href="#"` nav and no WhatsApp path.
The design was instead **ported to plain HTML/CSS** here: staggered per-line
headline, amber gradient on the final line, glass stat cards, glowing pill with
a looping light sweep, warm interior bloom, cyan plinth glow, cursor parallax.
No React, no runtime, no eval, no CDN. Source artboard kept out of the deploy at
`../Landing page with elevated effects/`.

`pod-hero.png` (1.6MB) was re-encoded to `pod-hero.jpg` (148KB) plus a 2KB
blurred companion. Unlike the previous plate it has **generous margins around
the structure**, so landscape can safely use `object-fit:cover` again; portrait
still switches to `contain` so the pod is never sliced.

The hero headline is the one place set in `--sans` (700, uppercase) rather than
`.display` — that is the concept's own type choice. Section headings below stay
serif. The rendered wordmark (`assets/lumina-logo.png`) replaces the CSS-drawn
`.mark` in the bar via `.mark-img`; `.mark` is still used by the boot screen and
footer.

**Superseded: hero fit notes below apply to the previous plate.**
Because the render is cropped tight to the building (baked-in UI occupied the
surrounding margins), `cover` clipped the silhouette at both wide and tall
aspects. The hero now uses a *fit-with-margin* instead:

- `.hero-fg` is sized with `max-width/max-height:100%` — the same result as
  `contain`, but the element box equals the plate, so edge effects land on the
  photo boundary rather than an oversized box.
- `--fit` is the reciprocal of a margin multiplier: `.847` = 1.18 margin in
  landscape, `.893` = 1.12 in portrait (`max-aspect-ratio:1/1`).
- `.hero-bg` is a 1.1KB pre-blurred copy of the same plate at `cover`, so the
  frame still reads full-bleed with no letterbox bars and no colour mismatch.
  It is pre-blurred at build time, not via `filter: blur()`, to stay off the
  compositor budget.
- **All hero motion is scoped inside the margin** — `heroBreathe` peaks at 1.04
  and cursor parallax is ±9px, so `--fit × 1.04` still clears the viewport at
  every aspect. Anything new added here must respect that budget or the crop
  comes straight back. Verified whole-structure-visible at 1920/1440/1280/1024/
  768/430/390.

Layout note: `.hero` is `align-items:stretch` (not `flex-end`) so `.hero-grid` fills it and
the `minmax(0,1fr)` first row floats the stat cards to the vertical centre while the
headline and CTA stay at the foot. A `(min-width:981px) and (max-height:820px)` query
trims type and padding so the CTA clears the fold on shorter laptop screens. In
`.hero-stats` the flex children are the `.depth` wrappers, **not** `.stat-card` — size
those with `.hero-stats>.depth`.

Every asset depicts the same property. When adding imagery, vary the **crop and
`object-position`** rather than repeating an identical framing — the villa already appears
in the band and the wide Cedar House card, and a third identical use reads as a slideshow.

## The listing data — repaired 2026-07-28, re-imported 2026-08-04

`data/lumina-demo-leads.json` came out of a spreadsheet with no validation and
went through six repair passes. **If the source is ever re-imported, every one of
these will come back.** The scripts that did the work are disposable, but the
rules are not.

**They did come back.** The 2026-08-04 re-import from `Lumina 2026.xlsx` hit the
same Excel date serials in `Beds` (refs 127, 132), the same `!st floor`, the same
per-m² rates sitting in the price column, and the same five sub-2,000 rents — and
reproduced exactly the same `needs_price_review` set, **108, 114, 116, 127, 132**,
without being told to look for them. Every rule in the table below was reapplied.
Two things are worth carrying forward:

- **Identical specs are not a duplicate.** The first dedup pass collapsed seven
  pairs (035/071, 048/084, 072/085, 083/082, 111/109, 123/112, 143/142) that are
  simply two 2-bed Abdoun flats at the same rent. A row that brought its own
  photo folder is its own property; only collapse rows that brought no photos.
- **The area and insight pages hardcode counts.** The prose and the at-a-glance
  tables quote per-district counts, mixes and medians as literal text. They are
  generated once, not at runtime, so a re-import silently makes them wrong —
  Abdoun went 61 → 78, the Circles 18 → 25, Swefieh 9 → 10. Recompute and edit
  them in the same pass, or the pages start lying.

| Problem | What it looked like | Fix |
|---|---|---|
| Duplicate records | 10 records identical on every substantive field; refs and image folders differed because each import pass minted its own | Removed, keeping the richest (most photos → highest `quality_score` → lowest ref) |
| Empty shells | Refs 138, 139: no price, size, bedrooms, transaction or photos | Removed |
| Location spellings | 23 spellings for 12 districts — `Swefieh`/`Sweifeih`, `Um uthaina`/`Um Uthainah`, `4th-5ht Circle` | Normalised; `location_area` rebuilt as `<location> — Amman` |
| Excel date serials | `bedrooms: 46024` in two records — a date that landed in the wrong column | Cleared to unknown |
| Impossible sizes | `size_sqm: 21570` for an apartment | Cleared to unknown |
| Per-m² rates as prices | `885 JOD` for a 260 m² 4th Circle apartment is a rate | `price_unit: 'per_sqm'`, rendered `885 JOD/m²` |
| Monthly rents among annual | Five at 500–1,200 JOD where everything else is 6,000–120,000 | `needs_price_review: true`, rendered "Price on request" |
| Floor values | 25 spellings including `!st floor`, and `Villa`/`Building` (not floors) | Normalised to 15; non-floors cleared |
| Attribute noise | kitchen 4 distinct → 1, living_room 14 → 5, cooling 25 → 14 | Typos and casing repaired, separators unified to commas, ordering fixed so permutations collapse |
| Titles | 23 distinct across 112 records; 50 read "Abdoun Apartment for Rent" | Rebuilt as "Three-bedroom apartment with a terrace, 120 m²" → 85 distinct |

**Deduplicate *after* normalising, not before.** The first dedup pass ran on raw
values and missed refs 067/068, which were identical apart from `"New"` vs
`"new"`. They only became detectable once the fields were cleaned.

**Descriptions are generated, never hand-written.** They are composed from the
fields, so a bad field appears twice — once in the spec row and once in prose.
Repair the field and regenerate; do not edit the sentence.

**Nothing was invented.** Where a figure could not be trusted it is relabelled or
withheld, never replaced with a guess. `price_unit` and `needs_price_review` exist
so the UI can say what it does not know.

**Owner and guard phone numbers are columns 15 and 16 of the sheet and never
enter the JSON.** That file is fetched by the browser, so anything in it is
published. Keep the import's column allow-list explicit.

### The 2026-08-05 clean-up — 141 records became 118

The portfolio was cut to what can be shown honestly. Everything removed is
archived, with its photographs, at `../_removed-listings-2026-08-05/`
(`removed.json` plus the four orphaned image folders) — nothing was deleted.

| Removed | Why |
|---|---|
| 19 records: 017–021, 031, 038, 080, 117, 118, 151, 153–156, 158–161 | no photographs at all. They rendered as "Photography on request" placeholders, and because the grid is ref-ordered they landed together at the top of the page — the first screen of the portfolio was a wall of empty frames |
| 094, 096, 131 | every file in the gallery also sits in another property's folder. A listing showing another property's rooms is worse than one showing none |
| 093 | same, and its whole gallery was assembled out of 090's and 091's folders |

**The rule, if this is ever re-run:** a record survives if it has at least one
photograph that is *its own*. The one exception is a clone group — several
rows off a single shoot, where the files belong to nobody outside the group
(130/131 came from one folder named `2026-130-131`). There the lowest ref
survives, because dropping the whole group would lose a real property.
`093/094/096` did **not** qualify: their shared gallery belonged to 090 and
091, so there was no property behind it to keep.

After the cut: 118 residences, 1,179 photographs, no record without photos,
no two records sharing a file, no duplicate cover images.

**`data/lumina-demo-leads.json` now carries `?v=` like every other asset.**
It did not, so a returning visitor kept the copy their browser had cached —
which after a clean-up means they keep the records that were removed. All
**eight** fetches of it (`listings.js`, `areas.js`, `areas-index.js`,
`home-collection.js`, `property-details.js`, `consult-form.js`, `quiz.js`,
`room.js`) carry the marker; bump all eight together whenever the data
changes — and bump each of those scripts' own `?v=` in the HTML at the same
time, or the browser keeps the old script and with it the old data URL.

### The 2026-08-22 drop — 118 records became 129

Eleven listings added from a new sheet and a new photo drop. Sources, and
neither answers an anonymous request — both were read through the
signed-in browser session:

- **Sheet** — Google Sheets, *Saif's Updated data*, tab `Listings Log 26`.
  186 rows, refs 015–200. Same column order as `Lumina 2026.xlsx`.
- **Photos** — OneDrive, `Lumina/Listing Updates/Listing V.02/Rent`,
  13 folders named `2026-<ref>`.

**The method is a ref diff, not a re-import.** Compare the refs already in
`data/lumina-demo-leads.json` against the sheet; take only refs that are new
*and* have a photo folder. The existing 118 records were not touched — the
writer uses `indent=2` with no trailing newline, which round-trips them
byte-for-byte, so the diff shows only what actually changed.

**Five of the eleven are records the 2026-08-05 clean-up removed** (151, 154,
155, 156, 158). They were cut for having no photographs; this drop supplies
them, so they now satisfy the rule above — "a record survives if it has at
least one photograph that is its own". `../_removed-listings-2026-08-05/`
still holds the archive.

**Not one row in this drop carries a price.** Every one of the eleven is
`price_jod_raw: null` with `needs_price_review: true`, which renders "Price
on request" on the card, the details page and the share card, and keeps the
record off the landing page (`js/home-collection.js`). This is the same path
the five monthly-rent records already use. Setting a real price later is a
one-field edit per record.

**The photo folders cannot be globbed.** Three of the thirteen would have
shipped the wrong thing:

| ref | what the folder holds |
|---|---|
| 151 | numbered `00–09` plus 15 WhatsApp files that re-shoot the same rooms — took the numbered set |
| 163 | numbered `1–12` plus 7 WhatsApp files **of a different apartment** — dark modern kitchen and marble bathroom against this listing's chandeliers and blue velvet. Globbing would have published two properties as one |
| 165 | `3.jpeg` is byte-identical to `2.jpeg` |
| 166 | `4.jpeg` carries a *"free version of Watermarkly"* promo bar; `5.jpeg` is the same shot without it |

The rule from the 2026-08-04 import still holds and still matters: **root
level only, the `New folder` subdirectories are the raw unsorted dump.**
Look at the photographs before publishing them — a contact sheet per folder
takes a minute and is the only thing that catches a mixed folder.

**Two refs were held back**, and both need the sender, not a guess:

- **157** is the same apartment as **155** — identical sheet row (Abdoun,
  1st, 162 m², 3 bed, 3 bath) and the photographs show the same rooms from
  different angles: same zebra armchair, same horse print, same dining set
  and clock, same green kitchen. Two shoots of one unit. The 2026-08-04
  import reached the same conclusion independently.
- **167**'s 23 photographs cover more than one apartment — four to five
  distinct living rooms and two different white kitchens. Nothing in the
  folder says which set is 167.

**Also in the drop and still unusable:** `Sale/` holds three folders named by
area (`Shmesani`, `Um uthaina`, `Um uthaina 01`) with no ref number, so they
cannot be matched to a sheet row. Refs 162, 164 and 171–200 are ref numbers
with nothing behind them yet — 30 empty placeholder rows.

Full record at `data/import-report-2026-08-22.json`.


### Ten rents landed on 2026-08-25 — and what that touched

The client supplied eleven figures. **Ten were applied.** Refs 154, 155, 156,
158, 163, 165, 166, 168, 169, 170 now carry a real `price_jod_raw`, its mirror
in `price_jod_test_margin`, and **no `needs_price_review` key at all** — not
`false`. No priced record in the file carries that key, and one that says
`false` where 118 others say nothing is a record that looks hand-edited.

**157 was not applied, and that is not an oversight.** It is not in the book:
the 2026-08-22 import held it back because it is the same apartment as 155 —
identical sheet row (Abdoun, 1st, 162 m², 3 bed, 3 bath) and the photographs
show the same rooms from different angles. The client's own list corroborates
it, giving 155 and 157 the **same rent, 26,000**, for the same type in the
same district.

Still without a price after this: **103, 148, 151.** Still flagged for review:
**108, 114, 116, 127, 132** (the possible monthly rents) **and 151.**

The description does **not** embed the price — it is composed from location,
size, beds, baths, furnishing and floor — so nothing needed regenerating.
Checked, not assumed.

**The writer proves itself before it writes.** `prices.py` (job tmp) dumps the
UNMODIFIED data and requires it back byte-for-byte before touching anything;
otherwise the format is wrong and all 129 records show up in the diff instead
of ten. The diff came out at exactly 70 lines — 7 per record, none elsewhere.

#### scripts/build-share-cards.py deleted the landing page's share card

Its stale sweep globbed `assets/og/*.jpg` and unlinked anything whose stem was
not a listing id. `home.jpg` is not a listing id. **It is the landing page's
own share card**, written by `scripts/build-hero-frames.py` and named in
`index.html`'s `og:image` and `twitter:image` — so regenerating the cards
after a data change silently broke the landing page's rich preview, with the
deploy still green and nothing to see until somebody shared a link.

The sweep is scoped to `lumina-*` now, which is the only shape this script
writes. Anything else in `p/` or `assets/og/` belongs to something else. If a
second non-listing file is ever added to either directory, this is the rule
that protects it.

`assets/og/home.jpg` was regenerated with the exact transform in
build-hero-frames.py — ladder frame 152, cover-scaled to 1200x630, cropped at
0.56 of the vertical — rather than by re-running that script, which would have
re-encoded all 152 frames to reproduce one JPEG.

#### The area pages quote figures that nothing recomputes

Confirmed again here: the district pages carry their counts, medians and
ranges as **static literals**, and no script rewrites them. Only
`areas.html`'s `[data-count]` is corrected at runtime.

Ten new rents moved exactly one printed figure, and it was corrected in the
same pass: the Circles' **typical annual rent, 17,000 → 14,000 JOD**, in the
prose and in the stat list. Abdoun's median stayed at 15,000 and every printed
range still holds, because all ten fall inside the existing bands.

**What did NOT change here, and is still wrong from the 2026-08-22 import:**

| page says | data says |
|---|---|
| Abdoun: 68 residences | **75** |
| Abdoun: 57 apartments | **64** |
| Abdoun: to rent / to buy 66 / 2 | **73 / 2** |
| Circles: 14 residences | **17** |
| Circles: 11 to rent / 4 to buy | **13 / 4** |
| Circles: mix 13 apartments | **16** |

Swefieh is correct on every figure. These are the drift the import note
predicted and did not fix; they are prose as well as list items, so they were
left for a ruling rather than rewritten alongside a price change.

### Photos

Each property folder in the client's drop holds its photos numbered from `1`, and
**`1` is the cover** — it becomes `01.jpg` and is what the card shows. Two traps:

- **Only the root level of a property folder is its photo set.** The `New folder`
  subdirectories are the raw camera/WhatsApp dump, sometimes nested twice, and
  several hold another property's files outright (`Rent/2026-102/New folder`
  contains ref 031's spreadsheet; `Rent/2026-133/New folder` contains ref 105's
  documents). Pulling them in mixes properties together.
- **A stray `00.jpeg` will steal the cover** from `1.jpeg` under any plain numeric
  sort. The convention starts at 1; sort anything below it to the back.

Import is max side 1920 px, JPEG q82, capped at 12 per listing, EXIF orientation
applied and then stripped.

**Six covers are curated, not imported (2026-08-06).** The client's `1` is whatever
the photographer shot first, which for several records is a bedroom, a parasol from
underneath, or a console table against a bare wall. Where a record's own gallery held
an obviously stronger opening shot, that photo was moved to the front of `images` and
`image_url` repointed at it:

| Ref | Now leads with | Instead of |
|---|---|---|
| 042 | `11.jpg` sunlit garden | a lawn strip in shadow |
| 070 | `11.jpg` the garden the title promises | a bedroom |
| 040 | `03.jpg` the daylit angle | the darkest of three shots of one room |
| 133 | `02.jpg` the view over Amman | a console against a bare wall |
| 079 | `04.jpg` the main reception | the underside of a parasol |
| 052 | `02.jpg` wider, better lit | the same room, tighter |

Move the photo to the **front of `images`**, never just repoint `image_url` — the
viewer opens at `images[0]`, so repointing alone makes the gallery open on a different
room than the card showed. No record ever takes a photo that is not its own, so covers
stay unique across all 129.

## The consultation form — and why it hands off the way it does

The hero CTA opens `#cf` (`js/consult-form.js`) instead of jumping into an
empty WhatsApp chat. Three fields: name, up to three property references,
comments.

**wa.me cannot carry an attachment.** WhatsApp's click-to-chat API prefills
message text and nothing else — there is no file parameter, and no amount of
URL work will add one. Combined with `script-src 'self'` (no CDN PDF library)
and `connect-src 'self'` (no upload endpoint), that leaves exactly one route:

- **Phones** — `navigator.share({files})` opens the system share sheet with the
  PDF attached; the client picks WhatsApp and it goes as a real document.
- **Desktop** — most desktop browsers refuse file shares, so the PDF downloads
  and wa.me opens with the same details as text. The confirmation says so
  rather than implying the file went by itself.

A cancelled share sheet throws `AbortError` and is **not** treated as a
failure — the form is left as it was so nothing has to be retyped.

The PDF is written by hand in `buildPdf()`: a six-object PDF 1.4 using the two
standard Helvetica faces, which need no embedding. That keeps the no-dependency
rule intact, but the standard fonts are **Latin-1** — an Arabic name will not
survive the encoding and comes out as `?`. This is why the full details always
also travel as message text, which is Unicode. Do not "fix" the PDF by dropping
the text payload.

Reference chips are validated against `data/lumina-demo-leads.json` so the
client sees the property title as they type, but **a failed lookup never blocks
a submission** — an unrecognised ref goes through unverified rather than being
refused. Three is a hard cap.

`#cfOpen` is still a real `wa.me` anchor. Without JS it opens the chat exactly
as it always did; the form is the enhancement, not the baseline. The panel
takes its `--cf-dx/--cf-dy` from the button's position so it grows out of the
CTA — recomputed on resize, and disabled under reduced motion.

## Content that is still placeholder

Flag these rather than building on them as if true:

- `advisory@lumina-amman.com` and `info@qutaifan.com` — neither is a real address
- `js/site.js` held `962791234567` / `+962 7 9123 4567` as `LuminaConfig` defaults, and it
  rewrites every `wa.me` link on the pages that load it. That sent the whole listings page
  to a number that is not the business's. Corrected to the real `962771505250`
- Five listings show "Price on request" because their rent may be monthly rather than
  annual — refs **108, 114, 116, 127, 132**. Confirm the period and clear
  `needs_price_review` on each

### `invest.html` — what is real and what is not

The page was written with **no data at all** about the buildings. What is real is only what
the client stated: there is one contractor building to a high specification, one lead
engineer on that contractor's side, **Mohannad Altall**, their newly completed buildings
reach Lumina before they are listed, **the contractor owns them**, and Lumina markets them
for a commission. Everything on the page is built to be true of that and nothing more.

**Lumina is the agent, not the owner. This is not a tone choice — it is the commercial
fact, and every section says it.** The contractor owns the land and the building and is the
vendor; Lumina introduces, advises and negotiates, and is paid on completion. Do not write
copy anywhere on this page that implies Lumina holds the title, sets the price, or carries
the warranty — "our buildings", "we are selling", "our development" are all wrong. The
`#role` section exists specifically to state this, and the credentials band, `#terms`, the
register list and the footer each carry a line of it. If a rewrite makes one of them vaguer,
it is a regression.

**The commission rate is not on the page and must not be invented.** "Competitive" is a
description; the number is a real figure the client has not supplied. It goes in the
`.role-fee` line and the `Our commission` cell of `#terms`, and nowhere else — and the note
under `#terms` already says out loud that competitive is not a rate. Ask before putting a
percentage anywhere.

Deliberately **not** on the page, because inventing any of it on an investment page would be
worse than inventing a listing: any address, any building count, any unit mix, any floor
area, any price, any yield or return, any completion date. Every one of those renders as
"on application", which is also how the rest of the firm behaves.

- **The section drawing is schematic and says so** — in the title block (`INDICATIVE
  SECTION / NTS / ON APPLICATION`) and again in the note under `#terms`. It shows how a
  building of this kind is put together, not the schedule of any one of them. The whole
  thing comes from the `LEVELS` table at the top of `js/invest.js`: replace that table with
  a real schedule and the drawing, the level tags, the reading panel and the keyboard order
  all follow. If it ever describes a *specific* building, delete the "schematic" note in the
  same commit — the disclaimer is what makes the invented level names honest.
- **The programme is FOUR stages, not six, and stage 03 holds three phases.** Envelope,
  services and finishes were stages 03/04/05 — which is how a programme of works is drawn and
  not how anybody in Amman talks or pays. Locally the whole of it is *tashteeb*: a flat sells
  on the shell or finished, the three phases are quoted, sequenced and paid for together, and
  a buyer choosing a stage is choosing between shell and finished. So they are one stage with
  three phases nested under a bracket, `.prog-step.is-group` spans three of the six grid
  columns because it really is three times as long, and `js/invest.js` lights the phases
  inside their parent's own slice of the rail rather than counting them as stages. **Do not
  flatten them back.** The stages themselves are generic and true of any build; no timings.
- **Mohannad Altall has no portrait** — the card uses the `MA` monogram in the same language
  as `team.html`, because there is no photograph of him on file. Ask before adding one.
- If the client supplies real particulars, the honest order is: real data into `LEVELS`
  first, then remove the schematic note, then add figures. Not the other way round.

### The section plates — the page's only photographs (added 2026-08-17)

`#why`, `#role` and `#engineer` each open with a photograph beside the heading. `.sec-head`
is capped at 760px inside a 1440px `.sec`, so above about 1150px every one of those sections
used to open on a sentence with 400–500px of empty ink next to it. The client's photographs
of the contractor's finished buildings fill exactly that column; nothing else moved.

**The captions are governed by the same rule as the rest of the page.** These are the
contractor's buildings, photographed after completion, and they are **not** of a named
address. No caption, alt text or filename here may acquire a location, a floor area, a
price, a unit mix or a completion date — the drawing above them says `INDICATIVE / NTS /
ON APPLICATION` and the photographs say "indicative of the specification, not of any one
address" for the same reason. If the client ever supplies particulars for a specific
building, that is a new component with a real address on it, not a re-caption of these.

Each plate is the page's ordinary four-element float stack (`.float > .depth > .lev >` the
card), with one deliberate difference: the three wrappers are `height:auto` here. Everywhere
else they pass `height:100%` through so a card can fill its grid row; the plate is centred
against a taller head, so 100% would resolve against a box it is not stretched to.

Three things about the photographs themselves:

- **They do not depict the Dabouq villa.** "Every asset depicts the same property" no longer
  holds site-wide — this is the second knowing exception after the hero render, and it is
  the right one here, because the whole page is about buildings that are *not* the villa.
- **They carry a wash, and it is not decoration.** Shot in full Amman daylight, white stone
  under a saturated sky, they were the brightest thing on a page whose base is `#06080C` and
  read as photographs pasted over the design. `.plate-shot::after` / `.gal-shot::after` bank
  the top and foot into the ink and lay the page's own warm/cool pair over the middle — the
  same thing `body::before` does to the page — and the images carry a static
  `saturate(.9) contrast(1.02)`. The filter rasters once because nothing beneath it changes;
  the only animation on a plate is `transform`, which is composited. **Do not make either of
  them animate**, and do not add a filter that has to re-raster.
- **`.plate` joins the 1024px-gated `backdrop-filter` list.** Three more panels, at desktop
  only, and they are what makes the frame read as glass rather than as a border.

**The gallery on `#engineer` swipes because it is a scroll container, not because of the
script.** `.gal-track` is `overflow-x:auto` + `scroll-snap-type:x mandatory`, so touch, the
trackpad, the keyboard and the accessibility tree all work before `js/invest-gallery.js`
runs — and what is on screen cannot desynchronise from what the script believes is on
screen, which is the failure mode of every transform-driven track. The script owns only the
counter, the dots and the two arrows: it *reads* `scrollLeft` and writes it in exactly three
places, each a direct response to a click, a key or the end of a drag. Four further points:

1. **That plate has no `.tilt`**, alone among the cards on this page. The tilt handler in
   `js/lumina.js` writes an inline transform on every `pointermove`, and a card that leans
   away while you are dragging it sideways reads as the drag having missed. The `.spec` sheen
   is driven from `invest-gallery.js` instead — the same trade `js/services.js` makes for its
   bubbles — which is why `.plate-gal:hover .spec` is named separately from `.tilt:hover
   .spec` in the stylesheet.
2. **`loading="lazy"` inside a horizontal scroller is measured against the track's scroll
   port, not the viewport.** Six slides at 100% width means the browser leaves slides 4–6
   unfetched until they are already being swiped onto. `warm()` promotes the current slide's
   neighbours to `eager`, which starts the fetch a step before it is needed. Slide 6 is
   warmed at start-up too, because the arrows wrap.
3. **The arrows wrap rather than disabling at the ends.** Six photographs is short enough
   that a dead arrow is the worse answer, and a `[disabled]` rule would in any case lose to
   `.plate-gal:hover .gal-nav{opacity:1}` on specificity and light back up.
4. **The hint under the gallery exists twice** — `.gal-hint-touch` and `.gal-hint-fine`. The
   arrows are revealed only to `(hover:hover) and (pointer:fine)`, so a single line reading
   "or use the arrows" was promising a control that is not on a phone.

`scrollTo()` is deliberately called with no `behavior`, so it inherits the element's computed
`scroll-behavior` — smooth in the stylesheet, `auto` under the reduced-motion block. The
preference is honoured without the file testing for it.

### `#build` — the scroll-assembled section, and the four traps in it

It is the **first** section on the page: the page opens on an empty plot and the building
goes up as you scroll. `js/invest.js` turns the pinned section into one `0…1` progress and
every moving thing is a pure function of it — nothing holds a timer, so scrubbing backwards
is exact. The phase constants are documented above the `.build` rules in `invest.html`.

Four things here were broken once and will break again the same way:

1. **The camera has to ride the work.** `.bld` is a fixed-height, bottom-anchored column, so
   the part that has been built is always at the *bottom* of a box that never changes size.
   Left at a fixed offset, the first half of the scroll frames an empty rectangle with the
   ground line hanging off the bottom edge. `--cam-y` is driven from the assembly's own
   progress (`built`), not from `p`, so the rise is the building's and not the scrollbar's.
2. **The construction line takes the FIRST match, not the last.** The levels overlap by
   design (`OVERLAP = 1.7`), so at any moment several are still moving and the one below is
   always the last to settle. Taking the last in-progress index pinned the line to the
   basement for the whole first quarter.
3. **`fit()` measures, it does not calculate.** Only the slab heights scale with `--k`;
   borders, the 3px floor-slab margins and the ground line do not. It sets `--k:1`, reads
   `offsetHeight` (**not** `getBoundingClientRect` — the camera above it is scaled), and
   treats everything above the sum of the slab heights as fixed. It also has to subtract the
   frame's own padding, because `.stack-frame` reserves room at the foot for the title block.
   And it only runs while the pin is on: below 861px and under reduced motion the frame is
   `height:auto`, so measuring it there feeds the scale back into itself.
4. **`.build-pin` needs an explicit `grid-template-rows`.** With `place-items:center` and an
   auto row, the row is content-sized, `.stack-stage { height:100% }` has nothing definite to
   resolve against, and the stage quietly grows past a pin that clips — at 1024 that put the
   scroll cue and the entire reading panel below the fold. `grid-template-rows:minmax(0,1fr)`
   with `align-items:stretch` is what makes every measurement below it mean anything.

The reading panel has **two** states and they are not the same moment: `.reading` (p ≥ 0.22,
once the title has cleared) narrates whichever slab is being placed, and `.armed` (p ≥ 0.86)
is when the levels become controls. Both must be added by `flat()` too, or the panel is
invisible on phones and under reduced motion.

### The float stack and the glass, on invest.html

Every card below the build section is **four nested elements**, and each one owns a transform
— transforms do not compose on a single element, the last declaration simply wins:

```html
<div class="float rv">                 <!-- the reveal -->
  <div class="depth" style="--d:20px"> <!-- cursor parallax -->
    <div class="lev" style="--dur:12.5s;--amp:7px;--rot:.2deg;--delay:-1.2s">  <!-- levitation -->
      <article class="why-card tilt"><span class="spec"></span>…</article>     <!-- .tilt -->
```

The card itself must stay free of the other three, because `js/lumina.js`'s `.tilt` handler
writes an **inline** transform on hover (`perspective … rotateX … translateY(-6px)`) and
would silently erase whichever of them shared its element. `.float` and its two wrappers pass
`height:100%` through so a card can still stretch to its grid row. Keep `--dur`, `--amp`,
`--rot` and `--delay` uncorrelated per card — identical values make the row pulse in unison,
which reads as a loading state.

`.spec` is the shared tracking sheen: `.tilt` writes `--sx`/`--sy` as the pointer crosses the
card, so one rule serves `.why-card`, `.role-card` and `.eng-card`. Any new card gets a
`<span class="spec">` as its first child and `position:relative; z-index:2` on its siblings.

`backdrop-filter` is gated at `min-width:1024px` for every one of these surfaces. Three
panels in the pinned build stage already use it; below 1024 the cards fall back to their
translucent gradient, which is most of the look. Do not remove the gate to "fix" a phone.

`.terms` uses **explicit** column counts (3 / 2 / 1), not `auto-fit`. Its 1px gaps are the
container's own background showing through, so a row that does not fill leaves a lit band
across the empty half — with six cells, `auto-fit` landed on five-plus-one at 1440.

## Services, and the three pages under it

`services.html` is the parent of `invest.html`, `property-management.html` and
`property-evaluation.html`. **The bar link is Services on every page** — Invest lost its own
slot when it became a child — and the home page carries a `.svc-btn` beside the existing
Invest button. `js/nav-menu.js` builds the phone sheet from `.bar .nav a`, so editing the bar
edits both; keep the six links identical across pages or the phone menu differs per page.

### The bubble field on `services.html`

**Two states, and the grid is not a fallback.** The markup is a list of links in a
`repeat(auto-fit, minmax(230px,1fr))` grid, and that is what renders with no JS, under
reduced motion, and below 901px — on a phone it is the real layout. `js/services.js` adds
`.live`, which drops the grid and switches the links to absolute positioning; from then on
the script owns exactly one property per bubble, the transform, and the stylesheet owns
everything else. Neither reaches into the other's half. Going live is re-decided on every
resize, and leaving live hands `transform`, `opacity`, `z-index` and `--sz` back or the
bubbles strand off-grid.

**The shape moves without animating a shape.** Site rule is transform and opacity only, so
there is no morphing `border-radius` anywhere. Each shell has a *static* irregular radius and
rotates very slowly — rotating an irregular outline genuinely changes the silhouette, on the
compositor — and the halo behind it counter-rotates at an unrelated period so the two never
visibly repeat. Content sits in its own upright layer.

**Bubbles must not use `.tilt`.** `js/lumina.js`'s tilt handler writes an inline transform,
which is the one thing the rAF loop owns. `services.js` writes `--sx`/`--sy` itself.

Four things that were wrong once and will go wrong the same way again:

1. **Repulsion is scaled by `(1 - hov)`.** Without it the bubble you point at runs away from
   the cursor as it is chosen, fighting the hover it just triggered.
2. **The chosen rim lives on the shell, not on `.bub-ring`.** The ring does not turn, so when
   it carried the rim too the two outlines sat out of phase and the bubble grew a second
   edge. `.bub-ring` is now the focus indicator only, where an offset outline is correct.
3. **`align-items: stretch` on the two-column stage.** Centring the items stops the field
   stretching to its row, so it falls back to its own `min-height` — 340px inside a 720px
   row. The head is centred on its own instead. Same trap as `.build-pin` on invest.html.
4. **The field has no tall `min-height`.** It is the `1fr` row of a `100svh` section; a floor
   taller than that row pushed the whole ring below the fold.

The hub reads from `data-name`, not from the bubble's label — the label carries a `<br>` so it
can break inside a round shape, and its `textContent` comes out as `Propertymanagement`.
`data-a` / `data-r` place each bubble by hand (+90 is the front of the ellipse, biggest and
brightest); leave them off and a fourth service is spaced evenly for free.

### The district quiz (`#qz`, `js/quiz.js`, `css/quiz.css`)

Five questions, every answer a tap, and it names two districts. **Two doors, one quiz:** the
fourth hero panel on `index.html` (`#qzOpen`, a `.stat-card--act` matching the commission
card) and a `.qz-cta` glass card under the hero on `areas.html` — the page where a reader who
has scrolled nine districts and still cannot choose actually is.

**The wording rule, and it is the one that matters.** Every option has to be understood
without decoding it. An earlier cut offered *"the address"* and *"old stone"* — both perfectly
clear to an estate agent and to nobody else — and a question phrased *"you would trade up
for…"*. If a label needs the hint underneath it to make sense, it is the wrong label. Plain
words, one parallel construction per question, four words maximum. Q5 in particular is a
concrete choice (*"Same rent, three flats. Which do you take?"* → biggest / best
neighbourhood / most character) rather than an abstraction, because it is the tiebreak and an
abstract tiebreak gets answered at random.

`css/quiz.css` carries the sheet shell **and** the quiz interior for every page except
`index.html`, which has the whole elevated shell inline already. That is two copies of the
`.cmx` block — the same trade the tokens make. The quiz's **content** is not duplicated: the
questions, options, scoring and wording live only in `js/quiz.js`, for both doors.

**It reuses the commission sheet's entire shell.** `hero-panels.js`'s `initSheet` now takes
`(openerId, sheetId)` and is called twice, so the veil, panel, close button, focus trap,
Escape and scroll lock have ONE implementation and the two dialogs cannot drift apart.
`quiz.js` renders into `#qzBody` and owns nothing else. If you add a third sheet, call
`initSheet` again — do not copy it.

**Why these five questions.** Price barely discriminates between these districts — within a
band you can find the same money in six of the nine. What actually separates them is the
commute, what is under the window, whether you walk or drive (the defining Amman question —
exactly two of the nine are walkable and newcomers from walkable cities are the ones most
often housed wrong), who is coming, and what you would trade up for. Budget is deliberately
**not** asked: a number there would anchor the answer and we have stock across the range.

**The scoring is an opinion and the panel says so.** Each option carries a district→points
map and a `why` string; the result plays the reader's own answers back as the reasoning, so
someone who disagrees can see which answer did it. Options that score every district equally
("Either", "No fixed office") correctly contribute no reason. It always names a **second**
district — two is the honest answer to five questions — and ends on a route to a person.

Counts ship as literals and are corrected from `data/lumina-demo-leads.json`, same as
`areas.html`. Keep the seven district groups and their `keys` in step with that page.

**`.cmx-panel` gets a real background below 1024px**, because `backdrop-filter` is gated off
there and the glass had nothing to blur — the hero headline read straight through both
sheets on a phone. The top highlight and border are what make it read as glass; the blur was
only ever making it legible.

## The hero descent (2026-08-24) — Act I of the scroll brief

The landing page opens on a 217-frame fall through cloud into a valley, ending
on the pod villa lit on its plinth. It replaces the static `pod-hero.jpg`
plate. Files: `js/hero-descent.js`, `scripts/build-hero-frames.py`,
`assets/hero/`, plus the hero block in `index.html`.

Built to a supplied brief (`../hero-source/lumina-scroll-brief.md`). **The
brief describes a repo that is not this one** — it assumes Vite, an existing
Three.js hero, GSAP and Lenis, and an EN/AR bilingual layer. None of those
exist here. Where it conflicts with what is actually on disk, what is actually
on disk won. The deviations are listed at the end of this section, each with
the measurement behind it.

### The sheets are glass ON the landing, not a modal in front of it

Opening a card used to black the page out: the veil was `rgba(3,5,9,.72)`
(.86 on phones) and below 1024px the panel was effectively opaque, because
`backdrop-filter` was gated off there for the hero's compositor budget. The
sheet read as a separate screen that had replaced the page.

**The veil carries its own copy of the landing frame.** This is the part that
looks like a workaround and is not. The scroll lock is `overflow` on `<html>`,
and **either `hidden` or `clip` unpins the hero** — both establish a clip
context, `position:sticky` loses its scrollport, and the held frame lands
1350px above the viewport the moment a sheet opens. Measured, both. So the
sheet cannot show the hero through itself.

It does not need to. These four cards **only exist at the landing**, so the
frame behind them is always 152 — already decoded and cached by the descent,
so the backdrop costs nothing. `.cmx-veil` paints it with a darkening
gradient over it, and the panel's `backdrop-filter` frosts *that*. If the
landing frame ever moves, this URL moves with it — it is a third place that
names the last frame explicitly.

**The panel frosts at every width now.** The old 1024px gate is lifted for
this one case and the exception is earned: a sheet is open on demand with the
scroll locked, so it rasterises once and never re-rasterises while it is up —
unlike the hero glass, which composites on every frame of a scroll. That
reasoning does **not** generalise; the gate stays everywhere else.

Measured with the type hidden and the composite sampled where the glyphs sit,
all three sheets at both widths: **5.2:1 to 10.1:1**, against floors of 3.0
and 4.5. `sheetglass.py` (job tmp) re-runs it.

`css/quiz.css` keeps its own plain veil, so the quiz sheet on `areas.html`
is unaffected — there is no pod frame on that page to show.

#### Nothing is blurred *around* the card

The card is frosted glass; everything outside its edge is the landing frame,
sharp. That is a deliberate line and it has consequences in both directions:

* **No outer shadow, on any sheet.** The panels carried `0 40px 90px
  rgba(0,0,0,.62)` plus a `0 0 70px -18px` gold bloom. Those were a halo of
  blur around the card and they are what made it read as a modal dropped over
  the page rather than glass laid on it. A 1px hairline and the inset top
  highlight carry the edge instead — the way vibrancy panels do it — and the
  frosted-against-sharp boundary does the rest. The consultation sheet
  (`.cf-panel`) lost the same halo: it opens one button away on the same
  landing and would otherwise have been the only one left with one.
* **The veil is a step, not a curtain.** .52 → .66 dimmed the landing to a
  backdrop; at **.30 → .42** the frame is simply still there, a shade
  quieter. Re-measured after: 4.5:1 to 10.6:1, floors 3.0 and 4.5.
* `saturate()` came down 155% → **124%**. Over a warm interior 155% tipped
  the whole panel brown. Glass does not add colour, it removes detail.

The `.cf` sheet keeps its own darker veil and near-solid ground. It holds text
inputs, and a field over a photograph is a different problem from a paragraph.

#### The phone layout: three measured defects

Not taste — each one reproduces and each one has a number.

1. **`.cmx-rows dd{max-width:none}` below 720.** `dd` is `flex:none`, so with
   no ceiling the widest qualifier in the sheet — *"2% standard, unless agreed
   otherwise"* — sized the column and squeezed *"Property sales"* onto two
   lines with its note broken over four. Now 50% at ≤720, and under 600 the
   row stops being a row: label above, figure and qualifier on one baseline
   below.
2. **The quiz's step counter overlapped the close button at every width**,
   not just on a phone. `.qz-step` was `position:absolute; right:0` inside a
   head inset by the panel padding — 26px on a phone, 34.8px at 1024, 44px at
   1440 — while `.cmx-x` reaches 54px in. At 1440 the boxes overlap by ~10px
   and it only *looks* fine because the button is round. It is out of the
   corner now and sits above the progress bar it counts. Same fix in
   `areas.html` and `css/quiz.css`, which carry the same head.
3. **`max-height:88vh` is the LARGE viewport on iOS**, so the sheet ran on
   under the address bar. `86dvh`, and `height:100dvh` on the `.cmx` shell.

And the type. `.3em` of tracking on a 9.9px cap is what reads as a wrong font
at 390px — the letters stop being a word. Three tracked labels were not
`.mono`, so `css/mobile.css` was not raising them, and one (`.wxm-key .mono`)
*was* a `.mono` but matched here by a two-class selector that outranks the
one-class rule in that sheet. All three are handled in a single
`@media (max-width:860px)` block — **860 because that is where mobile.css's
own mobile treatment starts**, not a second opinion about the boundary.

Two of my first attempts at this made labels *smaller*, because mobile.css
loads after this page's inline `<style>`: an equal-specificity override here
is dead on arrival, and a more-specific one wins and then has to get the size
right by itself. Check which of the two you are writing.

**`sheetphone.py`** (job tmp) is the regression: five handset widths plus a
tablet, asserting no overlap, nothing wider than the panel, the panel inside
the viewport, no text under 10.8px, and a real tap target. Two notes on it —
SVG path geometry routinely exceeds its own viewport, so the map bed's
contour lines read 21px wider than the panel and are clipped to it; measuring
those as overflow is measuring the wrong box. And the floor is 10.8, not 11,
because mobile.css deliberately standardises tracked micro-caps at .68rem
(10.88px) across six pages.

#### The weather sheet still scrolls on a phone, and that is correct

124px of overflow at 390 (155 at 360, 37 at 430): lede, map, key, reading
card, provenance stamp. Shrinking the map to fit would put ten 40px dots in a
190px box, and they would collide. The stamp is the least important thing on
the sheet and it is the thing below the fold. Measured by `wxfold.py`.

## Image quality in the two scroll experiences  (2026-08-25)

The client asked for the pictures to look high quality and vibrant and for
noise to come down. Four things were measured before anything changed, and
only one of them was what it looked like.

### The dominant loss was RESOLUTION, and the phone was far worse than desktop

`rendered_sharp.py` (job tmp) asks the browser how many SOURCE pixels actually
land across the screen — the ladder width, the cover crop and the device pixel
ratio together:

| | source px used | upscale |
|---|---|---|
| landing, desktop @2x | 1282 of 1440 | 2.25x |
| **landing, phone @3x** | **250 of 960** | **4.7x** |
| room, desktop @2x | 1140 of 1280 | 2.53x |
| **room, phone @3x** | **188 of 720** | **6.2x** |

**A 16:9 frame cover-cropped into a portrait pin shows only the middle 26% of
its width.** So on a phone three quarters of every frame was downloaded and
thrown away, and the quarter that survived was stretched five or six times.
That is the softness, and no encoder setting can touch it.

Both phone rungs are **native portrait centre crops** now — 608x1080 for the
hero, 406x720 for the room — cut at exactly the slice the phone displays. Same
pixel count as the rungs they replace, no resampling at any stage, and roughly
**twice the effective resolution**. The hero's phone rung actually got
*smaller*: 2.50MB against 2.9MB.

**The hero's wide rung was a downscale of its own master.** 1920x1080 in,
1440 shipped, then upscaled again by CSS and the DPR. Presented at 3200x1800
and compared against the master through the same crop, **1920 at q52 measured
the same bytes as 1440 at q78 with 12% more edge energy** — resolution beat
quality outright. It ships at q64.

    hero   1440 q78 + 960 q76   7.30 MB  ->  1920 q64 + 608 q68   7.80 MB
    room   1280 q76 + 720 q74   7.34 MB  ->  1280 q84 + 406 q78  10.07 MB

The room's wide rung is already native, so quality was the only lever there:
q76 measured rms 2.42 against the master, q86 rms 1.70. q84 is where that
curve flattens, and it is why the room grew.

### The page was taking the colour out, so the ladder puts it back

Measured in Lab on the rendered page against the master through the same crop:
the landing composition showed **16% less chroma** than the footage, the
furnished room **11% less**. Attribution on the room, by knocking out one
overlay at a time: the grade owns 14 of the 24 missing contrast points (gold
6.5, dusk 4.7, vignette 1.5) and the remaining 10 are the encode and the
cover-upscale, which no overlay can give back.

So a modest grade is **baked into both ladders** — `eq=contrast=1.06:
saturation=1.20` on the hero, `1.08:1.16` on the room. It costs nothing at
runtime; a CSS filter on the canvas would be a second full-frame pass on every
painted frame. **The target is the master, not maximum saturation:**

| | before | after |
|---|---|---|
| landing composition | −16% chroma | **−4%** |
| furnished room | −11% chroma | **+1%** |
| mid-descent, behind the scrim | −37% | −34% |
| the unlit room at dusk | −74% | −74% |

The last two are meant to be that way. The descent's scrim is what makes the
headline legible over a sunlit cloud deck, and the dusk is the whole point of
the room's dark beat.

### .grain was not the noise, and the measurement says so

CLAUDE.md's standing warning is not to remove it without re-measuring the
banding it was added to dither. Both ladders changed encode and resolution, so
the measurement was due. With grain ON and OFF, on the rendered page, at five
moments across both experiences: banding **1.041 vs 1.042, 1.049 vs 1.065,
0.987 vs 0.993, 0.975 vs 0.972, 0.871 vs 0.875.** No blocking either way, and
grain contributes about **0.5 levels of sigma** — it is not what a reader is
seeing. It stays, unchanged, because it is the film texture the design wants
and it is not costing anything.

### The reading panel had to close as the room opens

A brighter, more saturated lit state broke the one thing sitting on top of it.
On a phone, every line of the room's reading panel measured **1.19 to 3.39:1**
against a 4.5 floor once the lights were on — its ground is glass, and its top
stop is `rgba(255,255,255,.07)` over what is now a bright ceiling.

Fading the diagonal's stops with `--lit` moved the worst line from 1.19 to
1.29. **A 150deg gradient is weakest at its top-left corner, which is exactly
where `#readTag` sits.** What works is a *uniform* sheet under the existing
glass, rising with `--lit`, which does not care where the type is. Same for
the switch's label. Panel and button now measure **8.5 to 15.8:1 lit** and
keep their unlit look.

> And one probe correction: `.rm-switch-cue` is faded to zero by
> `.rm-switch.on` the moment the lights go up. Measuring it there reported
> 1.20:1 on type nobody can see. Skip anything whose effective opacity —
> walked up the ancestors — is near zero.

### verify_descent.py went stale on a literal, for the third time

It asserted `ladder == 1440`. It has previously asserted a 220vh fall and a
last frame of 217, and in both cases the thing it named still existed, so it
failed quietly rather than loudly. It reads the rung off `assets/hero` now.

## The bar is a scrim, not a box  (2026-08-25)

Scrolled down, `.bar::after` faded in a full-width panel with a hard bottom
edge and the page looked like it had a black bar stuck on top of it. The
darkness was never the problem — the EDGE was, and three things drew it:

1. `border-bottom:1px solid rgba(255,178,90,.1)`
2. `box-shadow:0 12px 40px -20px`
3. and the big one, **backdrop-filter's hard cutoff at the element's own
   box**, which puts sharp page against blurred page along a straight line.

Measured at 1440 on the landing: a **13-level luminance step in a single row**
at y=71, in a region whose ambient level is 15. That is a doubling, and it is
what the eye reads as an edge.

So the panel became a scrim: `inset:0 0 -44px`, a ground that fades to nothing
over that distance, and **the same fade applied as a `mask-image`** — which
takes the blur with it, because masking an element that carries a
backdrop-filter cross-fades the blurred backdrop back into the sharp one.
There is no other way to end a blur without drawing a line. The border and the
shadow are gone. `pointer-events:none`, because the scrim now overhangs the
bar's own box by 44px and would otherwise eat clicks in that strip.

Same step, after: **4.0 levels**. `barlook.py` (job tmp) re-measures it.

Three copies of this rule exist — `index.html` inline, `css/nav.css`,
`css/elevated.css` — because the landing carries its own shell. All three
changed together; if you change one, change three.

## Desktop motion: stop paying for frames nobody asked for

Absolute frame times from this harness are software-rendered and have moved
±50% between identical builds, so **none of this was tuned against them**.
Every item below removes work that is provably happening and provably unused,
and those facts hold on any machine. Measured by `whoreads.py` and
`scrollcost.py` (job tmp).

| | before | after |
|---|---|---|
| style writes, idle at the top | 122 over 61 frames | **0** |
| forced relayouts per scroll frame | ~1.25 | **0.19** |
| infinite animations running | 29 | 13 |
| of those, off screen | 19 | 3 |

**The cursor loop never stopped.** `--px`/`--py` were written to
documentElement every frame for the life of the page, whether or not the
pointer had moved. A custom property on the root invalidates style for every
element that reads it, and on this page that is every `.depth` — five of which
are 221k px each in the middle of the document. With the mouse resting on the
desk that was 60 root-style invalidations a second, forever. It parks when
both interpolations converge and `pointermove` restarts it; the thresholds sit
below what either output can express (`--px` is written to 4dp, the glow's
transform to 0.1px).

**The spine read layout eight times a frame** — `scrollHeight` plus an
`offsetTop` for each of seven sections — to compare against numbers that only
change when the document reflows. Cached, refreshed on resize and by a
`ResizeObserver` on the body, which is what covers the collection cards
arriving after load and changing the document's height.

**Three handlers read a rect per frame wherever you were.** `onScrollPlx`,
`onScrollAperture` and `hero-descent`'s `measure()` all early-returned when
their subject was off screen — but only *after* reading the rect that told
them so. They are gated on an IntersectionObserver now. All three default to
"near" where there is no IntersectionObserver, so nothing changes on a browser
without one, and the descent's gate calls `kick()` once on the way out so the
scrub settles on its clamped end value instead of freezing mid-scrub.

**Nineteen infinite animations ran off screen** — 14 `.lev`, 3 `lum-lev`, and
the CTA pill's breathe and sweep. One observer parks them, the same way
`css/property-ui.css` already parked `.prop-float.rest .lev`. Two traps: the
`.off-view` rule has to sit at the END of the sheet and carry two classes,
because `animation:` is a shorthand that resets `animation-play-state` to
running and the rule must beat `.btn-pill` (same specificity, declared later)
and `.prop-float .lev` (0,2,0); and the pill's sweep is on `::before`, which a
class on the host does not reach. And `Lumina.refreshPark` exists for the same
reason `refreshReveals` does — a one-shot query at script time sees 11 of the
page's 22 `.lev` and misses every injected card.

**`#glow`'s `filter:blur(.5px)` did nothing.** A 650k-px fixed, screen-blended
layer that follows the pointer, forced onto its own render surface by a
half-pixel blur. Rendered with and against it on a frozen page at 1x and 2x:
**zero pixels differ**, banding count identical (89 and 198). Removed from
`index.html` and `css/elevated.css`.

> The first A/B of this reported a 174/255 difference over 20% of the screen,
> which is impossible for a half-pixel blur — the page was simply still moving
> between the two captures. Freeze every animation and prove the freeze with a
> control pair before trusting any visual diff on this page.

## Colour: three real findings, and how many were not

`desksweep.py` (job tmp) samples every visible text run against what is
actually rendered behind it, at six desktop widths. Its first run reported
eleven failures. **Eight were the probe.** The corrections are in the script
and worth knowing:

* **Sample per LINE, not the union box.** The union of a three-line quote
  includes the gaps between lines and, for anything near the top, the strip
  under the fixed bar — where the bar's cream wordmark reads as the backdrop
  for cream type. All eleven of the first run's worst readings were that.
* **Skip anything a fixed overlay sits on.** Text under the bar is being read
  through the bar; that is a fact about the bar.
* **Sample the element's OWN text nodes.** `selectNodeContents` covers child
  elements too — on `#cfOpen` that is the cream-filled arrow disc, which reads
  as a cream backdrop under cream type and scores a flat 1.00:1 on a button
  that is in fact perfectly legible.
* **An envelope means the number is about the fade.** The film caption read
  3.62:1 mid-ramp and **9.22:1** at full strength. Not a defect.

The three that survived, all fixed:

1. **The landing cards.** `150+` at **1.87:1** against a 3.0 floor,
   "Commission Structure" at 3.06:1 against 4.5. The cause was additive: the
   card's ground started at `rgba(255,255,255,.16)` — white at the top, where
   the titles are — and `.stat-card::before` laid another warm radial over the
   same corner, both over the pod's lit interior, under white type. Glass over
   a lit scene darkens it; the top highlight is what reads as the edge of the
   pane, not a white body. Now **3.05 / 5.80 / 7.58 / 10.57**, all clear.
2. **The film band's small copy.** The headline carries `0 4px 40px` of
   near-black; the kicker and the meta line carried nothing, over a video with
   a bright streak straight across them. A scrim on `.film-inner::before`
   rather than another text-shadow, because a shadow helps a reader but cannot
   be measured as backdrop contrast — and on a video the backdrop is whatever
   the frame happens to be.
3. **`--fi` was written by JS and consumed by nothing.** `js/lumina.js` has
   set it on `#film` since the aperture was built, and its own comment says
   "`.film-inner` is what consumes it" — no rule anywhere did. So the copy
   stayed at full opacity while the shutter closed around it and
   `clip-path:inset(var(--ap))` **sliced the headline down both sides**. Plain
   on a phone, where `--ap-max` is 26% of 390px. Wired to
   `.film-inner{opacity:var(--fi,1)}`, default 1 so the copy is readable with
   the script blocked and under reduced motion, which drops the clip entirely.

   The two envelopes still do not coincide — `--ap` bites at p=.39, `--fi`
   does not reach 0 until p=.28 — so on a phone the copy is narrowed to
   `min(100%,82vw)` to sit inside the shutter's whole travel, rather than
   re-timing a choreography that is right.

## The four hero cards on a phone — and the disc that was never absolute

The client's screenshot: four cards at four different heights, titles on three
lines, and a small arrow in the **bottom-left** corner of every one. Measured
at 390 before touching anything:

| card | size | title | note | disc |
|---|---|---|---|---|
| 150+ | 171x139 | 33.6px | 13.1px, 2 lines | bottom left |
| 30°C | 172x116 | 33.6px | 13.1px | bottom left |
| Commission Structure | 172x154 | 24px, 2 lines | 13.1px, 2 lines | bottom left |
| Where should you live? | 172x178 | 24px, 3 lines | 13.1px, 2 lines | bottom left |

Three separate faults, and only one of them was about size.

**1. `.cm-go` was never `position:absolute`, at any width.** The rule is
`.cm-go{position:absolute; top:16px; right:16px}` at (0,1,0), and
`.stat-card span{position:relative}` forty lines above it is (0,1,1). The
span rule wins, the disc stays in flow at the END of the card, and `top`/
`right` then shift it down and LEFT from there. That is the arrow in the
bottom-left corner — **and 26px of height every card did not need.** Scoped to
`.stat-card .cm-go` (0,2,0) now. `css/quiz.css` already scopes its own copy
`.qz-cta .cm-go`, which is why that one was always right.

This is the third time this exact shape of bug has been found in this file's
history — `.nav a{padding:6px 0}` beating `.chip`, `.hood p` beating
`.hood .stat`. **A bare single-class rule loses to any two-part selector that
reaches the same element, and source order cannot save you.**

**2. Nothing passed the row height down.** The grid item stretches, but there
are five wrappers between it and the card — `.arv > .depth > .rv > .lev >
.stat-card` — every one `height:auto`, so the card sat at its own content
height inside a stretched item. Measured spread across the four: **62px**. All
five now carry `height:100%`, and the grid carries `grid-auto-rows:1fr`,
because `align-items:stretch` equalises *within* a row and the two rows still
sized to their own content (70 and 97).

**3. The phone type rule never reached the two readings.** It was
`.stat-card b{font-size:1.5rem}` at (0,1,1), and `.stat-card--nav .num` and
`.stat-card--act .wx-read` are (0,2,0) — so **2.1rem survived on a 171px
card**. Everything in the phone block is scoped `.hero-stats …` now.

**And the levitation comes off in the grid.** Each card floats on its own
phase with `--amp` of 7-9px and its own `--rot`, which is the whole point of
the float stack when they are a loose column beside a desktop hero. Two-up at
390 with an 8px gutter it is four boxes that will not line up — up to 18px of
relative offset between neighbours, which is precisely what reads as
*weirdly placed*. The arrival and the reveal stay; only the idle drift goes.

Result: the block is **200px instead of 324**, all four cards within 1px of
each other, every note on one line at 390, and the headline, the sub, the
cards and the CTA all fit one screen.

### The card ground was darkened to fix a number that was not about colour

Worth keeping as a caution. `150+` measured **1.87:1** against a 3.0 floor and
the ground was darkened in three steps to get it over — from
`rgba(255,255,255,.16)` at the top to `rgba(11,16,25,.54)`, which is most of
the way to a slab.

Part of that 1.87 was the disc bug. With `.cm-go` actually absolute the card
is 26px shorter and the reading no longer sits in the brightest band of the
landing frame: **the same type over the same ground measured 8.66:1.** So the
ground came back up two steps to `.40/.58` — still **5.20 / 7.36 / 10.20 /
7.22** across the four, and it is glass again rather than a slab.

**Darkening to fix a legibility number is the right move only once you know
the number is about the colour.** Check the geometry first.

### And the scroll cue's label had drifted under its floor

`"Scroll down"` measured **4.35:1** against 4.5, where this file records 4.7:1
when the cue was built. The footage was swapped since, and the cue's pool was
centred on the ring while the label sits underneath it — so the words were
already in the falloff. 330px instead of 290, biased 14px down, and a touch
deeper: clear now. Cheaper than lightening type that shares its amber with the
WhatsApp chip.

## Team is out of the bar

Removed from the `<nav class="nav">` block of all nineteen pages that had it,
at the client's request, to be added back later. **Out of the BAR only** — the
footer still links `team.html` on every one of them, so the page keeps its
internal links and is not orphaned. `js/nav-menu.js` builds the phone sheet
from these same anchors, so the tab leaves the phone sheet with it; that is
the same bar, not a second decision. `team.html`'s own entry went too,
`aria-current` and all — a page whose bar advertises a tab no other page has
looks like it lost its way there.

## Two probe bugs worth not repeating

**"Idle" windows that scroll.** `whoreads.py` decided whether to send wheel
events with `if ticks > 1` and then passed 24 for its idle windows, so every
window scrolled and the "six layout reads a frame while nothing is moving"
finding was the probe scrolling the page it claimed was still.

**`scrollBy` then reading `scrollY`.** This site runs Lenis, which animates
window scroll — `scrollY` is unchanged in the same turn whether the page is
locked or not. Two probes concluded the scroll lock was never released.
`deskscroll.py` had the same bug in reverse and covered 21% of the document in
5.5s while believing it had scrolled the lot; it drives real wheel events now.
Ask the lock class, not the scroll position.

#### a11y.py's `.ways` focus check was measuring something unreachable

It reported the pin failing to trap focus, on this build *and* on the one
before it. Both wrong. The cards live inside the sticky pin now, and the
check waited 300ms for a scrubber whose time constant is 85ms and which the
steps above it had left landed, then called `focus()` on a control that at
rest is `visibility:hidden`. A hidden control cannot take focus — measured:
focus not taken, scrollY stays 0, **0 of 4 cards in the tab order**. What it
actually measured was a landed page being asked to scroll to a sticky
element's *unstuck* document position, which no keyboard user can reach.

Replaced with the two assertions worth making: at rest the cards are out of
the tab order, and once the descent has landed, focusing one leaves it on
screen. Both pass.

This is the same failure mode as the earlier settle-time bugs in this build:
**a probe that does not wait for the scrubber measures the previous step.**

### The descent lands on frame 152, and the page assembles around it

The master runs to 452 source frames, pushing the camera into the living room
until the pod fills the screen. **The site does not go that far.** The client
chose to land on the whole structure on its plinth, lake and mountain still
behind it — ladder frame 152 of 226, source frame 302 — and the ladder is
built only that far. The 74 dropped frames were the most expensive in the
sequence, because a close interior is all detail: trimming took the ladder
from 11.82MB to **6.88MB**.

**Moving the landing frame is one constant**, `TOTAL` in
`scripts/build-hero-frames.py`. Change it, rebuild, then update `TOTAL` in
`js/hero-descent.js` and the two `<picture>` sources in `index.html`, which
name the last frame explicitly. That last one has failed silently once: it
pointed at 217 while the ladder held 226, and 217 still existed.

**The fall is silent, and the arrival does all the talking.** Nothing is on
screen from the moment the cue dissolves until the descent lands. Then the
page assembles around the held frame in the landing page's own arrangement:

| `--dp` | what happens |
|---|---|
| .00 | the cue alone, dead centre |
| .00–.045 | the cue dissolves |
| .045–.74 | **nothing.** The fall is the whole of it |
| .74–.92 | the context arrives from the LEFT, 44px, and stays |
| .76–.99 | the four cards arrive from the RIGHT, staggered by `--i` |
| .88–1.0 | the invitation, last |

There is no release any more — `--hout` is gone. This is the composition the
page rests in, and scrubbing back up un-does all of it exactly.

**The cards are back inside the pin, and this time they fit.** They were moved
out because a pinned 100dvh clipped them at seven of nine viewports. What
actually fixed it was not the tightened padding: it was `grid-row:1/-1`. They
were in row 1, which is `minmax(0,1fr)`, and the lede's row is 456px tall at
1440x900 — so row 1 was squeezed to 166px and a 490px stack centred itself in
that and poked 40px out through the top of the pin. Spanning the whole column
costs nothing, because the lede and the CTA live in column 1. Measured after:
nothing clipped at any of nine viewports.

`.arv` is the arrival wrapper — a fifth nesting level, because `.depth` owns
the cursor parallax, `.rv` the reveal, `.lev` the levitation and
`.stat-card:hover` its own transform. `--d` and `--i` sit on `.arv` and
inherit down, so one attribute drives both the parallax depth and the stagger
order.

**--dp is written only where something reads it.** The cue reads it below
.08 and the arrival above .70; between those the lede, the cards and the CTA
are invisible and static, and the canvas never reads it at all — it is driven
by the frame index. `READS_DP` in `js/hero-descent.js` skips the write
through that band. This matters because the cards are back inside the pin and
carry `backdrop-filter`: a custom property written on the pin invalidates
their subtree every frame. The note above `.hero-pin` warned about exactly
this, and moving the cards back in re-created it.

**A caution about the numbers here.** Chasing that cost further was abandoned
deliberately: the same build measured 27.8, 34.7, 34.8, 41.6 and 41.7ms per
frame across runs — a spread of ±50%, in a headless browser with no GPU at 4x
CPU. Patch-out attribution still works there (removing a whole element moves
the number well outside the noise) but nothing finer does. What holds across
every run: **zero long tasks, zero stalls, and the picture always advancing.**
If this needs settling, measure on hardware.

### The footage was replaced on 2026-08-25 — read this before touching the hero

The pod-descent master was swapped for a longer, brighter, better one. The
mechanism did not change; almost everything tuned *around* it did, and the
reasons are worth keeping because a third swap will hit the same things.

| | old master | new master |
|---|---|---|
| file | `lumina-descent-master.mp4` | `Lumina_Hero_Master_1080p.mp4` |
| codec | HEVC 10-bit | H.264 8-bit |
| source frames | 217 | **452** |
| shipped frames | 217 | **152** (every second one, stopping at the chosen landing frame) |
| ladder | 5.53 MB | **6.88 MB** |
| opens on | dark flat cloud, luma 59–70 | **a sunlit deck, luma 106, sun in frame** |
| ends on | the villa on a lake | **the whole pod on its plinth** — the master goes further, the site does not |

Both masters, the golden-hour cloud loop and the supplied poster live in
`../hero-source/`, outside the deployable folder.

**The arc, which the score is timed to:** above the cloud deck to `--dp` .18,
descending through it to .27, the valley opens at .27, the pod is the subject
from .44, and from .62 the camera pushes into the interior. The old master's
villa entered at .44 and simply grew; this one arrives somewhere.

**Every second source frame ships, and that is not a quality compromise.** The
runway is 220vh — 1980px of scroll on a 900px viewport. All 452 frames is 4.4px
of scroll per frame, twice what the eye can use, for twice the bytes; 226 gives
8.8px, against the 9.1px of the previous hero that measured smooth at 48fps.
The brief says this outright: reduce the frame count before the resolution.
`STEP` in the build script is the control.

**The reduced-motion `<picture>` points at frame 226.** It was 217, and 217
still *exists* in the new ladder — so this failed silently, serving a
near-final frame as the resting composition. If the frame count changes again,
grep for the last frame number.

### The type has to carry its own ground now

The old master was dark for its whole first half and one global scrim on
`.hero-media::after` was enough. This one opens on a sunlit deck. Measured on
the rendered composite, over the text runs only, with the scrims disabled:

| | SCROLL DOWN | headline | kicker | sub |
|---|---|---|---|---|
| desktop, no scrim | 2.4:1 ✗ | 2.2:1 ✗ | 1.4:1 ✗ | 12.6:1 |
| **desktop, shipped** | **5.1:1** | **3.5:1** | **5.5:1** | **14.2:1** |
| mobile, shipped | 7.9:1 | 12.0:1 | 9.2:1 | 16.7:1 |

Three of four fail without them. A global scrim cannot fix this, because what
sits behind the type is a different picture on every frame of the fall — so
`.hero-lede::before` and `.hero-cue::before` are feathered pools that travel
with their own text. They are offset well past the block and biased *up*,
because the kicker sits at the top and a pool centred on the headline left it
short while the headline below was already clear. The kicker also gained a
tight dark edge under its amber glow: a glow is the right look on a dark plate
and actively unhelpful on a bright one, since it lightens the very edge that
has to hold.

**Do not remove these to "clean up" the scrim stack.** They are the reason the
headline is legible over cloud, and the numbers above are what happens without
them.

### Four contaminated contrast readings, and what each looked like

This measurement was wrong four separate times, each time confidently, and each
failure mode is easy to repeat:

1. **Element opacity, when the fade lives on an ancestor.** `.hero-lede` holds
   the fade; grading `.hero-title`'s own opacity graded type that was not on
   screen yet. Walk the ancestor chain and multiply.
2. **`background-clip:text`.** The headline's last line is painted by a
   gradient with `-webkit-text-fill-color:transparent`, so `color:transparent`
   hid nothing and the gold was sampled *as backdrop* — producing impossible
   1.0:1 readings. `background:none` is what actually kills it.
3. **A decorative pseudo-element sharing the box.** `.kicker::after` is a
   bright amber flex rule taking half the element's width. Sampled as ground
   under the type it reported 3.9:1; the actual text run measured **7.8:1**.
4. **Bounding boxes.** They include the gaps between glyphs and, for the
   kicker, half a line of pure decoration. A `Range` over the text nodes is
   the honest box.

`contrast_final.py` (job tmp) does all four correctly and compares scrim
on/off. If the footage is ever swapped again, run it before and after.

### First paint: the frames must yield to it

Blocking the hero frames entirely moved first paint from **2980ms to 2020ms**
on 4x CPU + Fast 3G. 808KB of them were in flight during the first second,
competing with render-blocking CSS, for content nobody can see until they
scroll — and the inlined LQIP is already on screen by then.

Frame loading now waits for `requestIdleCallback` with a 2000ms timeout. On a
fast connection idle arrives immediately, so it costs nothing where there is
nothing to save; on a slow one the page paints first. Measured after: 2184ms
as shipped against 2072ms with frames blocked — the hero's contribution fell
from 960ms to about 110ms.

Related, and also mine: the frame-1 `<link rel=preload>` no longer carries
`fetchpriority="high"`. At high it outranks the render-blocking CSS, and the
canvas cannot draw that frame until the deferred script runs anyway. Early
discovery is worth having; priority is not.

**What is left is the page itself, not the hero.** `LCP == FCP == first-paint`
on this profile, at 2104–2124ms against a 2000ms budget, and with every frame
blocked it is still 2072ms. The floor is 170KB of inline-everything HTML
(~1700ms to arrive on Fast 3G) plus three render-blocking stylesheets. Fixing
that means changing how this page delivers CSS, which is a different job and
touches the whole cluster — do not attack it from the hero.

### Frames, not a video — and the numbers that decided it

The brief specified a dual path: seek a `<video>` on desktop, fall back to a
canvas frame sequence on iOS. Both were built and measured against this
footage:

| | size |
|---|---|
| frames 1440w, 217 x 16.1KB | **3.58 MB** (shipped) |
| frames 960w, 217 x 8.8KB | **1.95 MB** (shipped) |
| video 1280w, all-keyframe | 4.2 MB |
| video 1920w, all-keyframe | 8.6 MB |

The descent is dark, soft and low-detail, so it compresses far better than the
brief's 45KB/frame estimate — and the consequence is that the *higher
resolution* frame ladder costs less than the *lower resolution* seekable
video. Once that was true the video path had nothing left to offer, so there is
one path. It is deterministic, it needs no CSP change (`img-src` already allows
`'self'`), and dropping it also dropped the calibration scrub and the
`sessionStorage` decision the brief wanted — which this repo forbids anyway.

**The master is HEVC 10-bit** and is not in the repo; nothing serves it. It
lives with the brief at `../hero-source/lumina-descent-master.mp4`, one level
above the deployable folder so it can never be swept into a sync. Regenerate
with `python scripts/build-hero-frames.py`. That script also emits
`assets/og/home.jpg` (1200x630) and the inlined LQIP.

### The pin, and the one thing that silently kills it

`.hero` holds three children in flow — the sticky pin, a 220vh spacer that is
the descent's scroll distance, and the arrival. `.hero-pin` is a
`position:sticky` child at `100dvh` that holds everything the hero used to.
Progress is one `getBoundingClientRect` against the spacer. See the Act II
section below for why the arrival is inside this section and not after it.

- **The section must never carry `overflow`.** An overflow on an ancestor of a
  sticky child is the classic silent way to kill the stick — no error, it just
  scrolls away. The pin clips its own contents instead.
- **Runway in `vh`, pin in `dvh`, deliberately.** A runway in `dvh` changes
  *length* as a phone's URL bar collapses, which moves the scroll position
  under the reader. The pin in `dvh` merely re-covers, and the canvas is
  absolutely positioned so nothing reflows when it does.
- **The canvas backing store is the ladder's own size and CSS does the
  covering.** `<canvas>` is a replaced element, so `object-fit:cover` applies
  to it exactly as to an `<img>`. A resize therefore costs no re-measure, no
  redraw and no reallocation — which is the usual reason a canvas scrubber
  jumps on a URL-bar collapse. Measured CLS is 0.0000.

### Pinning made 100dvh a hard ceiling, and the panels did not fit

This is the change most likely to be "corrected" by someone who did not measure
it. **The four hero panels moved out of the hero into `.ways`, directly below
it.** The hero was previously free to grow past the fold — this file records
the CTA sitting 1178px down a 900px viewport — and a reader simply scrolled to
it. A pin removes that freedom. Measured at nine common viewports, the hero's
own content overflowed the pin at **seven of them**; at 360x740 two whole
panels and the CTA were cut, the fourth panel by 189px. Shrinking does not
reach — the shortfall on a phone is over 300px.

Nothing about the panels changed: same four controls, same four-element float
stack, same ids, so `hero-panels.js`, `quiz.js` and `weather-map.js` all still
find them. `.ways` is a `<div>`, not an id'd `<section>`, because every id'd
section on this page owes the spine a dot — and it is a cluster of controls,
not a passage of the document. `js/lumina.js`'s phone-pill tuck now measures
against `.ways` rather than `#hero`, or the pill lands on the quiz card exactly
as it used to.

### The score — everything is a pure function of `--dp`

`js/hero-descent.js` writes `--dp` (0 to 1) on `.hero`, plus `.dp-past` and
`.dp-arrived`. Nothing latches, so scrolling back up un-does all of it exactly.

| `--dp` | what happens |
|---|---|
| .00 | **the page lands on cloud and the scroll cue alone.** No kicker, no headline, no sub |
| .00–.045 | the cue dissolves the moment the reader engages |
| .05–.15 | the wording arrives, rising 26px into place |
| .15–.30 | it holds at full strength |
| .30–.50 | it releases and keeps rising, as the valley opens |
| .55–.72 | the pod is the subject; the CTA arrives with the approach |
| past .62 | the camera pushes into the interior and the frame is the render alone |

**The client asked for the empty landing deliberately** — see the cue section
below. The brief's 5.4 argued the opposite and that reasoning is preserved in
the deviations table; the cue is what answers it.

**The CTA is driven from `--dp`, not from a scroll threshold.** `onScrollCta`
in `lumina.js` stands down on any page carrying `[data-descent-runway]` —
left to it, the CTA fired 110px into a 320vh fall, i.e. in the first inch of
cloud.

### The scroll cue, and the `.dp-live` gate that must not be lost

The page lands on cloud with one mark in the middle of the screen: a 54px
circle carrying a downward chevron, **SCROLL DOWN** set beneath it, the pair
hovering together on a 3.6s float and dissolving by `--dp` .045. It is the only
thing on screen at rest, and it is what makes an empty opening read as
deliberate instead of broken.

**The chevron never fully leaves the ring, and that is not a taste call.** The
first cut faded it to opacity 0 at both ends of its loop, which left the mark
rendering as an empty circle for a slice of every cycle — a single screenshot
has about a one-in-five chance of catching it, and one did. It now travels down
and returns *dimmed* rather than absent, floor .28, so the reset reads as a
recovery instead of a jump. `chevron.py` samples the whole cycle rather than
looking once; if the keyframe is ever retuned, re-run it.

**The label is three elements deep for the usual reason.** The wrapper owns the
centring transform, `.hero-cue-in` owns the hover so the mark and its label
float as one thing, and the mark owns the ring. One transform per element. The
label is the site's small-label idiom one step below `.kicker` — `.58rem`, the
smallest size already on the page, `.24em` tracking, uppercase, `--gold` — with
`padding-left:.24em` to offset the trailing gap letter-spacing leaves after the
final letter, which otherwise pushes a centred string half a letterspace left.
Measured 4.7:1 against the cloud behind it. The whole cue is `aria-hidden`, so
"scroll down" is never announced — it is reinforcement for the eye, and a
screen reader does not need telling.

**It borrows the WhatsApp chip's treatment exactly rather than approximating
it** — same 1px `rgba(255,178,90,.55)` rim, same `.1` fill, same
`0 0 26px -2px` cast, same 999px radius, and it **reuses that button's own
`chipGlow` keyframe** for the halo at the same `inset:-10px`. Change the chip
and the cue follows. All of that is asserted against the chip's *computed*
style in `verify_cue.py`, not against the source, because two sets of numbers
typed twice drift.

**`.dp-live` is load-bearing and is not tidiness.** The lede's choreography is
written as `min(var(--hin),var(--hout))`, and `--hin` reads `var(--dp,0)`.
Wherever nothing sets `--dp` that falls back to 0, `--hin` computes to 0, and
**the headline resolves to `opacity:0`** — so with JavaScript blocked the page
would ship with no copy visible on it at all. `js/hero-descent.js` adds
`.dp-live` to `#hero` only on the motion path, *after* the reduced-motion
early return. No JS and reduced motion therefore both keep the lede exactly as
the markup writes it, and the cue never appears in either — there is no scrub
to cue and nothing would ever dissolve it. This is checked with script
execution genuinely disabled, not by reading the CSS.

The cue is `aria-hidden`, `pointer-events:none`, and two nested elements: the
wrapper owns the centring transform, the mark owns the hover. One transform per
element, the same rule as the float stack.

**A frame is "ready" only once it has DECODED, not once it has arrived.**
Marking it ready on load let the scrub reach a frame whose decode had not run,
and `drawImage` then decoded it synchronously — one 59ms long task on a
4x-throttled CPU against a budget of zero over 50ms. Holding it back makes
`nearest()` draw the closest decoded frame for a beat, which is invisible.

**`<img>`, never `createImageBitmap`.** The brief asks for the latter so decode
leaves the main thread. It does — but a decoded 1440x810 bitmap is 4.7MB and
217 of them is 1.01GB of *non-evictable* memory. `HTMLImageElement` keeps the
compressed bytes and lets the browser evict under pressure.

### One scroll listener, still

`js/lumina.js` now exposes `Lumina.onScroll(fn)`; the descent subscribes rather
than opening a second listener. It falls back to its own rAF-gated listener
when `lumina.js` is absent, so it still runs on a bare page — which is how it
was profiled before being put in this one.

### Reduced motion is a different path, not a degraded one

Nothing in `hero-descent.js` runs. The runway collapses to one screen, the pin
unsticks, the canvas never mounts, and `<picture>` serves the **final** frame —
the resting composition, villa lit, not the empty cloud the motion path opens
on. **A media query decides this, not a script**, so it is right with JS
blocked too:

```html
<source media="(prefers-reduced-motion: reduce) and (min-width:760px)" ...>
```

That is one 29KB request instead of 217. The `<img>` fallback is a 122-byte
inlined blur of frame 1, so the motion path pays nothing for it and the hero is
never an empty rectangle.

### Removed, and why

- **`.hero-aura` and `.hero-plinth`.** They put a warm bloom and a cyan plinth
  glow onto a still plate that had neither. The descent has both, in the
  render, in the right place, moving with the camera that shot them — and for
  the first half of the fall there is no building on screen at all, so a fixed
  glow was a lit villa hanging in empty cloud. Two infinite keyframes came off
  the hero's budget with them.
- **`heroBreathe` and `drift`.** A CSS Ken Burns over footage that has its own
  camera move is a second, slower camera fighting the first, and an animated
  `filter` over a canvas re-rasters the whole surface every frame it runs.
- **`<link rel=preload as=image href=pod-hero.jpg>`** — 148KB warmed for an
  image the page no longer shows. Replaced by a media-split preload of frame
  001 of whichever ladder will be chosen (6KB / 4KB).
- `pod-hero.jpg` / `pod-hero-bg.jpg` are kept on disk as a revert path, exactly
  like `hero-still.jpg` before them, and are no longer referenced anywhere.

### Act II — the arrival, and why .ways lives INSIDE the hero section

The descent used to end and then the pin released, so the render slid away at
the exact moment the reader arrived. The final frame now persists behind the
band that follows, which is what the brief asks for and what makes the fall pay
off.

**The structure is the whole trick, and it is easy to undo by tidying:**

```
<section class="hero" id="hero" data-descent-runway>
  <div class="hero-pin">      sticky, 100dvh — canvas, headline, CTA, cue
  <div class="hero-fall">     220vh spacer — the descent's scroll distance
  <div class="ways">          100dvh — scrolls OVER a pin that is still stuck
</section>
```

**`position:sticky` persists to the bottom of its PARENT.** That is the only
reason this works: `.ways` is a sibling inside the same section, so the pin is
still stuck while the arrival scrolls over it. There is one villa because there
is one canvas. Move `.ways` back outside the section and the render slides away
again.

The obvious alternative — give `.ways` its own sticky copy of frame 217 — does
not work, and the geometry says so before any code is written. Between the end
of the fall and the end of the section the hero's pin would be scrolling *up*
while `.ways` scrolls *in*, and a sticky bed inside `.ways` sits at `.ways`'
own top until it reaches 0. Through that whole transition you would see **two
copies of the villa, offset from one another.**

**The section is no longer the runway.** It is pin + fall + arrival, so the
descent's scroll distance comes from `.hero-fall` (`[data-descent-span]`), not
from the section's own height. Without a span element `hero-descent.js` falls
back to `sec.offsetHeight - innerHeight`, which is the shape the bare isolation
page still uses.

**The arrival is a full screen, and that is not a style choice.** At 1440 the
four cards are only ~150px tall, so the band first came out at 311px: the villa
was behind it for a third of a screen, and — because the band never covered the
viewport — `--dc` topped out at 0.41, which left the CTA underneath it lit at
0.59 opacity and still in the tab order. `min-height:100dvh` fixes the beat and
the hand-over together.

**`--dc` is how far the arrival has covered the pin**, 0 below the fold to 1
when it fills the screen. The CTA lives in the pin, so without it the button
would sit behind the panels, progressively hidden but still tabbable — a
control a keyboard can reach and an eye cannot find. `.dp-covered` (dc > 0.92)
takes it out of the tab order with `visibility:hidden`, and takes the canvas
out of the compositor the same way. **`visibility`, not `display`** — display
would drop the backing store and force a re-upload on the way back up.

`--dc` has to be republished from `kick()` as well as from the lerp, because
past `--dp` of 1 the frame index stops changing, the lerp settles and the rAF
stops — but the arrival is still moving.

**The scrim on `.ways` does two jobs.** It carries the band from the villa's own
darkness down to solid ink, so the four glass panels always have ground to read
against wherever the frame happens to be behind them; and by the band's foot the
page IS ink, so `#ethos` below continues with no seam and needs no treatment of
its own.

### The budget line that used to fail, and how it was closed

Act II introduced 3–5 long tasks of 52–54ms in the arrival, against a budget of
zero over 50ms, and the first attempt to attribute them failed — every element
patched out moved the count around inside the noise, and an *unchanged*
configuration measured 8 then 16 in the same run. That was recorded here as
unresolvable in this harness.

It was resolvable. The instrument was wrong, not the page: the probe averaged
frames across a window that was mostly idle. Measuring only the frames whose
`scrollY` falls inside the fall made the difference obvious immediately, and
the cause was the custom-property write invalidating the arrival's subtree —
see item 1 of the next section. **Long tasks are now zero on every profile.** If a
measurement ever refuses to discriminate, suspect the window before concluding
the thing is immeasurable.

### The per-frame budget, and the four things that were spending it

The descent shipped correct and then was profiled properly. At 4x CPU the fall
was running at **29fps**; it now runs at **48fps**, and long tasks went from
2-5 to **zero on every profile**. Nothing about how it looks changed. Four
fixes, each with the measurement that justified it — and none of them were the
thing that looked most expensive.

**1. Write on the pin, not the section.** Every rule that reads `--dp`, `--dc`
or the `dp-*` classes targets something inside `.hero-pin`. The SECTION also
contains the arrival, so a custom property written there invalidated style for
four backdrop-filtered glass cards on every frame of the fall. Attribution:
patching the write out and **deleting the arrival outright produced the same
number** — 20.9ms against 27.8ms — because the write's cost simply *was* the
arrival's recalc. If a rule ever needs `--dp` from outside the pin, move the
write back up and accept the budget, or give that rule its own variable.

**2. Read, then write — never interleaved.** `publish()` wrote `--dp` and then
called `cover()`, which reads `getBoundingClientRect`. That forces a
synchronous layout: the browser has to flush the style it was just handed
before it can answer the read. Once per frame, for the whole descent. Reads
now happen in `measure()` and writes in `commit()`. This is the
no-layout-thrash rule, and it was being broken by the file that quotes it.

**3. The lerp was frame-rate dependent.** `held += d * 0.18` is per *frame*, so
it converged twice as fast on a 120Hz display as on a 60Hz one — the scrub
genuinely felt different depending on the monitor, and faster is not better
here, it is just inconsistent. It is now `1 - exp(-dt / 85)`, which is the same
curve at any refresh rate and reproduces the old 60Hz feel exactly.

**4. The cue kept animating after it dissolved.** Three infinite animations and
a `backdrop-filter`, ticking invisibly for the remaining 95% of the descent.
`.dp-moved` takes it out of the box tree past `--dp` .05: 41.7ms -> 34.8ms
desktop, 34.8 -> 27.8 mobile, for a thing nobody can see.

Also: `.hero-canvas` gets `translateZ(0)`. Measured 34.8 -> 27.8ms per frame on
a 390px viewport and neutral on desktop — the scrim and the type above it stop
being repainted every time the frame index moves. A mobile win taken for free.

**What was NOT the cost, having been checked:** `backdrop-filter` on the glass,
the four-gradient scrim, the LQIP picture, and `drawImage` itself. Each was
patched out and re-measured; none moved the number materially. The instinct
that a full-screen `drawImage` must dominate is wrong here.

**A note on the instrument.** The first attribution pass stopped discriminating
the moment the descent got faster — it averaged every frame in a 1.4s window,
most of which are idle at 13.9ms once the gesture ends, so every variant read
identically. Filtering to frames whose `scrollY` is inside the fall is what
makes the numbers mean anything. `compare.py` does that; `attribute.py` did
not, and its later readings should be ignored.

### Encode quality: measured, and deliberately left alone

WebP quantises in 16x16 macroblocks, so its artefact is block structure in
smooth fields, and this descent opens on nothing but a smooth field. Measured
on the FILES as the step across block edges over the step within blocks
(1.00 = none; the lossless master scores 1.22):

| frame | blockiness | size |
|---|---|---|
| 13 | **22.7** | 4.4 KB |
| 37 | 12.4 | 4.3 KB |
| 97 | 5.8 | 10.9 KB |
| 217 | 1.6 | 29.1 KB |

Blocking is *inversely* correlated with size — the frames that band are flat
cloud, and flat cloud is nearly free to store. So a quality ramp was built (96
over the cloud tapering to 80 over the villa) and on the files it worked:
22.7 -> 4.5 on the worst frame, for +47% of the ladder, 5.53MB -> 8.14MB.

**Then the rendered page was measured, and it buys nothing:**

| | grain on | grain off |
|---|---|---|
| flat q78 | **1.13** | 1.23 |
| ramped | **1.13** | 1.23 |

Identical. Two things destroy the block structure before it reaches an eye:
the page's own `.grain` overlay — a fixed fractal-noise layer at opacity .045,
which is real dither applied *after* the frame — and the canvas being
CSS-upscaled to cover, so the 16px grid never lands on a 16px screen boundary.
The flat encode already renders at the master's own score.

**Do not raise the quality to fix banding without re-measuring the rendered
page.** The files look bad and the page does not, and 2.6MB is the price of
trusting the files. If `.grain` is ever removed from `index.html`, this becomes
live again. Note also that mean absolute error is the WRONG metric here and was
tried first: it moves 9.6% between q78 and q94 and would have talked you out of
investigating at all, because it averages over the frame and the artefact is
low-amplitude but spatially structured — which is exactly what an eye picks up
and an average cannot see.

### Smooth scroll (Lenis) — considered, not added

The backlog lists it and the brief specifies it. It is not here, and the reason
is that the scrub is already continuous: measured unthrottled, the frame index
advances **1-2 frames per rendered frame, p95 of 2**, and the 85ms exponential
already smooths the step a wheel notch produces. Lenis would be smoothing an
already-smoothed signal, at the cost of a dependency, a whole-page scroll
change and real risk to a `position:sticky` pin. Worth revisiting only if the
page ever needs smoothing somewhere the descent is not.

### Deviations from the brief, all deliberate

| Brief | Here | Why |
|---|---|---|
| Vite, GSAP, Lenis | none | no build step exists and CLAUDE.md permits no dependency but Lenis. Sticky + one rAF does the job in 3.3KB gzip |
| retire the Three.js hero | nothing to retire | there is no Three.js in this repo |
| persist path choice in `sessionStorage` | no storage | the repo forbids browser storage, and with one path there is nothing to persist |
| `--ember #FFA43C`, `--ice #7FD4E8`, Bodoni Moda, Space Grotesk | `--gold #FFB25A`, `--plinth #7FD9E8`, Instrument Serif/Sans | the brief's palette is a near-miss of the shipped one, which was sampled from this very render. Changing tokens on index.html alone would break the three-way agreement with `invest.html` and `css/elevated.css`. **Raise before adopting the brief's palette — it is a rebrand, not a hero swap** |
| preserve EN/AR | nothing to preserve | the site is monolingual English. Its section 10 does not apply |
| Act III horizontal portfolio | not built | this file explicitly rejects a horizontal-scroll collection. Needs a ruling before it is built |
| start the scrub at frame 6 | starts at frame 1 | measured: frame 1 to 2 has the LARGEST luma delta in the opening (2.06). The cloud is already moving |
| scroll cue disappears permanently | scrubbed with `--dp` | a cue that is missing when you are back at the start is just a missing cue, and a latch breaks the brief's own law 3 |
| a thin 1px `--ice` hairline in the lower centre | a 54px amber mark, dead centre, in the WhatsApp chip's treatment | client direction. The chip's amber is the site's existing "this is a control" signal, and dead centre is where the frame is emptiest at rest |
| headline present and legible at frame 0 (5.4, mitigation 1) | **the page lands on cloud and the cue alone; the wording arrives on the first inch of the fall** | client direction, and the same risk answered a different way. 5.4 keeps type on screen so the emptiness reads as intentional; a lit, moving mark says *scroll* outright where type only implies it. If this is ever reverted, restore the `.dp-live` gate reasoning with it |
| `100dvh` everywhere | `dvh` on the pin, `vh` on the runway | see the pin note above |

### Measured

Budget from the brief's section 8, on its own 4x-CPU + Fast-3G profile:

| | budget | desktop | mid-tier android |
|---|---|---|---|
| LCP | <= 2.0s | ~110ms | **2104–2124ms** — over; see the first-paint note above |
| CLS | <= 0.02 | 0.0000 | **0.0000** |
| long tasks in a full scrub | zero | **0** | **0** |
| JS, gzip, all of index.html | <= 160KB | **54KB** | |
| frames before interactive | <= 41 | **1** (the rest wait for idle) | |

Scrub frame times, isolated, 4x throttled: p50 7.0ms, p95 20.8ms, max 27.7ms,
zero long tasks. Reversibility exact — the same scroll position gives the same
frame scrubbing down and back up, to within the lerp's own epsilon. Nothing
clipped and no horizontal overflow at 1920/1440/1366/1280/1024/834/430/390/360.
Keyboard: the skip link is the first focusable element, focus is never left off
screen, and focusing a `.ways` control from the top of the page scrolls to it —
the pin does not trap it.

The probes live in the job tmp: `lab_profile.py` (isolation), `verify_descent.py`
(in-page), `fit.py` (clipping at nine sizes), `perf.py` (budget), `a11y.py`
(keyboard). **Four separate false failures in this work were bugs in those
probes, not in the page** — a settle time shorter than the scrubber's own
smoothing, a measurement taken before `scrollTo` had applied, elements measured
against a box they are deliberately outside of, and an entrance offset measured
at the moment it is invisible. Measure at the moment the thing is meant to be
on screen.

### The hero panels — all four are interactive now (2026-08-22)

**They no longer live in the hero.** Pinning the hero for the descent (see the
section above) made 100dvh a hard ceiling and they did not fit at seven of nine
measured viewports, so they moved to `.ways` directly below it. Everything in
this section still holds — same controls, same affordances, same ids — only the
container changed. `.hero-stats` is now `.ways-grid`, a four-column grid that
goes two-up below 980px and one-up below 720px.

The four panels used to be two readouts and two buttons. They are four controls
now, and the two that changed did so in the two different ways this site already
distinguishes between:

| Panel | What it does | Affordance |
|---|---|---|
| `150+ · Listings in prime locations` | **navigates** to `listings.html` | `.stat-card--nav`, disc **translates** |
| `25°C · Clear in Amman` | **opens** the weather map sheet | `.stat-card--act`, disc **rotates** |
| `Commission Structure` | opens the commission sheet | unchanged |
| `Where should you live?` | opens the district quiz | unchanged |

**That distinction is not decoration.** `.cm-go` rotates 90° because those panels unfold in
place; `.ib-go`/`.fab-go` translate because those buttons go somewhere. The listings panel
goes somewhere, so `.stat-card--nav` replaces the rotation with the travel. Keep it if you
add a fifth panel.

**Two rules the two changed panels needed putting back.** `.stat-card--act b` is a *title*
scale (1.3rem) and both of these lead with a *reading* — a temperature and a count — so
`.wx-read` and `.stat-card--nav .num` restore the panel scale (2.1rem) their neighbours use.
And `a.stat-card--act` needs `text-decoration:none; color:inherit`, because the shell was
written for a `<button>`.

**`150+` is the client's figure and stays.** The portfolio holds 129, and the panel is now a
link that lands on a page announcing 129 — so the click makes the gap visible. That was
raised and the client kept `150+`; it is their number, and it belongs on the placeholder-stats
list above rather than being quietly corrected. It was briefly wired to count from the data
(`js/home-collection.js` already has the JSON open); if that is ever wanted back it is four
lines writing `data.length` into a `[data-live-count]` attribute.

**The `+` is set in `--sun`, not `--gold`.** It answers the sun on the panel directly below it,
and both carry a small halo — a `text-shadow` on the `+`, a second `drop-shadow` on the sun.
The halo is scoped to `svg.wx-i-sun`, a class on the sun icon's own root, and deliberately not
to `.wx-icon`: a warm glow around an overcast cloud or a rain shower is a claim about the
weather that is not true. `--sun` is `#FFC64D`, and **both icon sets draw from it** —
`fill="var(--sun,#FFC64D)"` in `hero-panels.js` and `weather-map.js` — so the token and the
artwork cannot drift. The fallback in the `var()` is what keeps the icons right on any page
that does not define the token.

### The temperature card retries, remembers, and heals (2026-08-29)

**Reported:** the card showed `—°C` "from time to time, not constantly", on desktop *and*
phone; a refresh or two fixed it; and **the sheet behind it always had the temperature even
when the card did not.** That last clause is the whole diagnosis, and it was in the report
before any code was read.

**It is not the API and it is not us. It is the route.** Ten connections per host from this
machine, `curl -w`:

| host | ok | failed |
|---|---|---|
| `www.lumina-jo.com` | 10 | 0 |
| `cloudflare.com` | 10 | 0 |
| `api.github.com` | 5 | **5** |
| `api.open-meteo.com` | 5 | **5** |

The failures are not HTTP errors and not DNS: `time_namelookup` stays at 3ms while
`time_connect` never gets off `0.000000`, and the socket then hangs for **12–21 seconds**
before anything gives up. `api.open-meteo.com` is a single A record on Hetzner, so it is not
an IPv6 fallback either — `curl -4` fails at the same rate. **This is the same signature the
git pushes in this project hit against `github.com:443`** ("~3 in 5 connections fail to
establish; throughput fine once connected"). Everything served through Cloudflare is
untouched, which is why the site itself never shows a symptom and only the third-party call
does.

**So the defect on our side was the shape of the request, not the request.** `paintWeather`
fired **one** fetch with a nine-second abort and **no retry**. One dropped SYN killed the card
for the entire visit. Meanwhile `weather-map.js` sets `painted = false` in its `catch`, so
every click on the sheet is another attempt — **the sheet was retrying by accident and the
card never did.** That asymmetry is exactly what was reported.

**Three things changed, in `js/hero-panels.js`:**

1. **Three attempts at 4.5s, not one at 9s.** Aborting a stalled connect early and redialling
   beats waiting on a socket that is not coming back — a fresh connection lands in ~340ms when
   it lands. At the measured 50% this moves the card from failing 1-in-2 to **1-in-8**.
2. **A 90-minute `localStorage` cache** (`lumina.wx`), painted only when all three attempts
   fail. **This does not break the never-invent rule** — a real reading taken forty minutes ago
   is not an invented one, and *the TTL is where that line sits*: past ninety minutes the cache
   is dropped and the panel goes back to naming the city. The time the reading was taken goes
   into the `aria-label`, **not onto the face of the card** — it is narrow and was deliberately
   cut back on phones.
3. **It heals without a reload.** `visibilitychange` and `online` retry a card that is not
   live, behind a **20s** floor so a burst of tab-switching is not a burst of requests. Both
   stand down permanently once a live reading lands. And `weather-map.js` calls
   `Lumina.weather.retry()` after a successful render: **a sheet that just answered is proof
   the route is open this second**, which is the best moment to redial. It refetches the
   card's own central-Amman point rather than borrowing a district's — the entire premise of
   the sheet is that the districts differ, so substituting one would contradict it.

   **The sheet's retry deliberately forces past the floor** (`wxRetry(true)`). A visitor who
   loads the page, sees a dash and opens the sheet is almost certainly inside 20 seconds, and
   that click is the exact case in the bug report. It cannot become a request storm because a
   person has to click it. Everything else passes no argument — and note that
   `addEventListener('online', wxRetry)` would hand the **Event** in as `force`, which is
   truthy; the listener wraps it (`() => wxRetry()`) for that reason.

**Four harness lessons from `wxprobe.py`, all of which first read as site bugs:**

- **Do not `await` the CDP `Fetch.requestPaused` handler inside the socket read loop.** The
  handler sends a command and waits for a reply only that loop can deliver, so awaiting it
  parks the reader inside the thing that needs the reader. `asyncio.ensure_future` it.
- **Scope `Fetch.enable` to the endpoint.** `urlPattern: '*'` round-trips every hero frame
  through the handler and turns a 90-second probe into a ten-minute one.
- **Reset `stall` between cases.** It was left set after the stall case, so every heal case
  after it ran against an interceptor that answered nothing.
- **Fulfil the success case with a canned body rather than letting it hit the wire.** Testing
  the retry ladder against the very flakiness it exists to survive means all three attempts
  genuinely fail about 1 run in 8, and the probe reports a correct card as broken.
- And `sys.stdout = TextIOWrapper(...)` **re-buffers stdout and defeats `-u`** — pass
  `line_buffering=True` or the probe looks hung for its whole run.

**The intermittency is why this was tested with CDP `Fetch` interception rather than by
reloading and hoping** (`wxprobe.py`, job tmp). Failing the Open-Meteo request a chosen number
of times makes each path deterministic: healthy, one drop, two drops, route-down-with-cache,
route-down-without-cache, a socket that never answers, and dead-then-recovered. **Assert on the
text in the card, not on internal state** — the bug was always about what the visitor sees.

**Do not "fix" this by widening the timeout again.** Nine seconds of nothing was strictly worse
than 4.5 and a redial; the connection that is going to work, works immediately.

### The weather map (`#wxs`, `js/weather-map.js`)

**Why it is a map.** One temperature for a city built on hills is the least interesting true
thing you can say about Amman's weather. The interesting one is that the hills make their own:
Khalda at 990 m runs two to three degrees cooler than the ridges above the old centre at
840 m, and that is a difference somebody choosing a district can actually use. So the sheet is
ten districts, each with its own reading, and the lede states the day's spread.

**It is the third sheet and it reuses the whole shell** — `initSheet('wx', 'wxs')` in
`hero-panels.js`, so veil, panel, close, Escape, scroll lock and focus trap have one
implementation across three dialogs. The weather panel already carried `id="wx"` for
`paintWeather`, so it is its own opener and needs no second id. `weather-map.js` renders into
`#wxsBody` and owns nothing else — same contract as `quiz.js`.

**One request, ten places.** Open-Meteo takes comma-separated coordinates and answers with an
array in the same order, so the map costs a single call to the host already in `connect-src`.
It fires **lazily, on first open** — the hero card keeps its own single-point request and the
landing page does not pay for a dialog most visitors never open. Reopening does not refetch.

**Five things here are load-bearing:**

1. **The nodes are real `<button>`s over an SVG bed, not SVG `<g tabindex>`.** The shared focus
   trap collects `a[href], button:not([disabled])` — anything else is skipped when tabbing and
   the map becomes unreachable from a keyboard. This is why the map is HTML positioned in
   percentages rather than one SVG.
2. **The colour ramp is relative to the day's spread**, running `--plinth` → `--gold` so no new
   hue enters the palette. Two degrees is a real difference in Amman and an absolute scale
   would render all ten the same colour. The legend therefore says *cooler / warmer* and never
   claims to be an absolute scale — do not relabel it with numbers.
3. **Label visibility is a `@container` query on the map, not a media query on the window.**
   At 768px the two-column layout leaves the map 394px and four pairs of labels collide; at
   700px the stacked layout gives it 582px and none do. The viewport rule below it stays as
   the fallback for browsers without container queries.
4. **Node spacing is measured, not eyeballed.** A node's box is its dot *plus* the name under
   it — roughly `y-6` to `y+10`. Three pairs were inside that and looked fine in a screenshot
   until the boxes were measured. `wxoverlap.py` (job tmp) checks all 45 pairs at eight widths;
   re-run it if you move a district.
5. **Nothing is ever invented.** A failed request replaces the map with a sentence saying the
   service is not answering, exactly as the hero card falls back to naming the city rather than
   showing a made-up number.

**Khalda is on the map and is not in the portfolio.** It is the highest ground in West Amman
and the pattern is hard to read without it, so it is drawn a shade quieter (`.wxm-node--near`)
rather than dressed up as inventory. A weather map that stopped at our own stock would be the
stranger object.

**The areas plan had the same class of bug and now cannot repeat it.** `areas.html`'s map
printed its per-district counts as plain `<text>` that nothing ever updated — `areas-index.js`
only rewrites `[data-count]` — so after the 2026-08-22 import it still read 68/10/4 against
75/13/5. Each node's count now carries `data-count`, which puts it under that same rule. All
25 literals on the page are checked against the data.

### Sharing a property from the gallery — the main route

`.pv-share` sits in the viewer footer beside **Ask about this**, as a paper-plane outline. It
is the same `.pv-more` class as the links next to it, so the two take their colour from one
rule and can never drift apart — do not give it its own colour.

**The link it hands out is `listings.html?property=<id>`, deliberately NOT
`property-details.html?id=<id>`.** Whoever opens it lands in the same gallery the sender was
looking at, so the thing they were sent is the thing they see. `listings.html` is the target
because it is the only page carrying the full book *and* the viewer — the home grid holds
eight properties and each area page holds one district, so a link built from either would
break for anything outside them. Sharing from the home page or an area page still produces a
portfolio link, which is the point.

The receiving half is `openSharedProperty()` in `js/listings.js`. **The two move together.**
It runs *after* `applyFilters()` so the grid is painted behind the gallery — closing the
viewer leaves the reader in the portfolio rather than on a blank page — and it opens on the
next frame so the viewer's own `focus()` lands on something rendered. An id that is no longer
in the book leaves the page as the portfolio: a property that has gone is not an error state.

`shareFor()` assigns `els.share.onclick` rather than `addEventListener`, because `openViewer`
runs again for every property and stacking listeners would fire the previous property's share
alongside the current one.

`.pv-foot` is `minmax(0,1fr) auto auto`. It used to be `1fr auto 1fr`, which gave the photo
counter a 310px column to hold "1 / 9" in and took it from the links — leaving 310px for a
row that needs 320, so the share mark wrapped onto its own line at 1440 and *Ask about this*
wrapped as well at 1024. Both measured.

Note `team.html` reuses `.prop-float` for its people. Those cards do not open the viewer and
correctly have no share button.

### Sharing from the particulars page

**Every property has always had its own address:** `property-details.html?id=lumina-070`.
That is how the collection cards navigate, `js/property-details.js` reads `?id` from the
query string, and an unknown id renders a real "Property not found" panel rather than a blank
page. Nothing had to be built for the link itself.

What was missing was a way to *get* the link without going to the URL bar, which nobody on a
phone is going to do. The **Share button** in the sticky CTA bar (`#pdShare`, between Back
and WhatsApp) is a paper-plane mark in a circle and carries **no label** — a circle between
two pills reads as a different kind of action rather than a third equal choice on a bar whose
job is the enquiry. It therefore needs `aria-label` and `title`, and the confirmation cannot
live inside it: `say()` raises a `.pd-toast` above the bar instead. It splits by capability,
not by width:

- `navigator.share` → the OS sheet. On a phone that is WhatsApp, Messages and AirDrop in one
  tap, which is how these actually get passed around.
- `navigator.clipboard` → desktop. Copies and says **Link copied** for two seconds; a copy
  that reports nothing reads as a copy that failed.
- Neither (old Safari, insecure origin) → a temporary input with the URL selected, so the
  reader can copy by hand rather than being told nothing happened.

The share button is `flex: 0 1 auto` and must be selected as **`.pd-cta button.pd-share`** —
`.pd-cta button` is 0-1-1 and a bare `.pd-share` is 0-1-0, so it loses and the button takes
an equal third of the bar (482px at 1440, measured).

### Rich link previews — the share cards (`p/`, added 2026-08-12)

This used to say previews were impossible without a change of approach. The change of
approach was taken. **The reasoning below is still exactly why it had to be, so read it
before touching any of it.**

WhatsApp, iMessage, Slack and Facebook build a preview from Open Graph tags in the
**static** HTML at the URL they are handed, and **never run JavaScript**. Every property
here is fetched client-side from `data/lumina-demo-leads.json`, so a link to
`listings.html?property=lumina-016` gave the crawler *listings.html's own* tags — every
one of the 129 properties previewed as the same generic villa. A query string cannot
change static HTML and there is no server to change it on. **Do not try to fix this by
writing OG tags at runtime; no crawler will ever see them.**

So each property gets a real file: `p/<id>.html`, plus a 1200×630 crop of its own cover
at `assets/og/<id>.jpg`. Generated by `scripts/build-share-cards.py`.

**Regenerate whenever `data/lumina-demo-leads.json` changes** — `python
scripts/build-share-cards.py`. It is idempotent and deletes cards for records that are
gone, which matters: a card that outlives its property is a link to a photograph of
something no longer for sale.

Five things here are load-bearing:

1. **The redirect must be in `js/share-card.js`, an external file — never inline and
   never `<meta http-equiv="refresh">` in `<head>`.** Inline breaks the site's own CSP
   (`script-src 'self'`). A head refresh fires for crawlers too, several of which then
   preview the *destination* — `listings.html`, generic villa, the original bug back
   again. The refresh survives only inside `<noscript>`, where no crawler looks.
2. **`?to=details` is what keeps both share buttons behaving as documented above.** The
   gallery's button omits it and the reader lands in the gallery; the particulars page's
   button adds it and the reader lands back on the particulars. One card file, both
   destinations — the two buttons were *deliberately* different and still are.
3. **1200×630 is not a preference.** WhatsApp downgrades anything roughly square or
   portrait to a small thumbnail card, and gives up entirely on large files — 54 of the
   129 covers are over 300KB as shot. The generated crops run 61–250KB.
4. **`p/` must stay ALLOWED in `robots.txt`.** The cards carry `noindex` so 118
   near-identical redirect pages stay out of search results, but preview crawlers do not
   consult the meta — a `Disallow` would stop them fetching the card at all.
5. **`format_price()` in the generator mirrors `Lumina.formatPrice`.** If they drift, a
   preview promises a price the page does not show. `needs_price_review` and
   `price_unit` withhold rather than guess in both — do not simplify either away.

Links shared **before** this existed still point at `listings.html?property=…` and will
keep previewing as the generic villa. Nothing can retro-fix them; they still open the
right property.

`property-details.html` carries `noindex` — direct links work, but Google will not list
them.

### `areas.html` — the districts, and the third scroll mechanism

The destination of the **Areas** link in every bar (it used to go straight to
`areas-abdoun.html`, which named one district and hid eight). Files: `areas.html`,
`js/areas-index.js`, no new CSS file — it uses `css/elevated.css` plus its own block.

**It is deliberately NOT another pinned scrub.** `invest.html`, `room.html` and
`lumina-studio.html` all pin a section and scrub a 0…1 progress through it, and each earns it
by having a different *subject* — a building going up, a room furnishing itself, a website
assembling out of real DOM. `areas.html` has no such subject: it is nine districts and a map,
and pinning it would have been the mechanism repeating itself with nothing new to say. That is
the test for a fifth one. Here the plan is `position:sticky`, the districts scroll past it, and an
`IntersectionObserver` with a `-34%` rootMargin hands the plan whichever district is in the
middle third of the viewport. **There is no scroll listener on this page at all.** The plan
then pans and scales to the centroid of that district's node(s) — one transform, read off the
nodes' own `data-cx`/`data-cy`, so moving a district on the drawing moves the camera with it
and the two cannot disagree.

`data-node` is a comma list because **the Circles are one district to a reader and three
nodes on a map**; lighting all three and centring on their midpoint is the case that rule
exists for.

**Every number on the page is counted, not estimated.** Nine districts, 129 records, from
`data/lumina-demo-leads.json`. Each figure ships as a literal so the page is right with the
script blocked, and `areas-index.js` re-counts from the data on load and corrects it — the
`[data-count]` attribute holds the data's own location strings (note `Shmesani`, which is how
it is spelled in the data, against `Shmeisani` in the prose). **There are no price figures
here and there must not be:** the neighbourhood JOD/m² numbers elsewhere on this site are
flagged as placeholder above, and a district page is exactly where a placeholder price gets
quoted back as fact for years.

**The plan is indicative and says so, in the caption.** Relative positions and the Zahran
spine through the Circles are the whole of the claim. Node radius scales with stock, so
Abdoun is visibly two thirds of the book.

### `room.html` — the scroll-to-furnish room  (rebuilt 2026-08-25)

An empty bedroom furnishes itself as you scroll, the sun leaves the window,
and then the room stands finished **and unlit** until you press a switch.
Reached from the `.fab` glass pill on `index.html` and from the footers.
Files: `room.html`, `css/room.css`, `js/room-scrub.js`,
`scripts/build-room-frames.py`, `assets/room/`.

**It was a drawing until this date and is now a render**, and the whole page
turned over with it: `js/room.js` is deleted, 390 lines of SVG came out of the
markup, and 73 of the stylesheet's 141 rules matched nothing afterwards and
went too. What follows replaces the old section entirely — none of the
one-point-perspective construction, the nine SVG objects or the `getBBox`
trap applies any more.

#### The ladder is one sequence with two halves that behave nothing alike

    ladder   1 .. 109    the furnishing. A pure function of scroll.
    ladder 109 .. 124    the cove lighting coming up. NOT a function of
                         scroll — it is PLAYED, once, on a button.

Between them the pin holds a beat of darkness with nothing moving. The runway
is split at `FURN = 0.78` in `js/room-scrub.js`, and `.room{height:560vh}` is
the other half of that one decision — 22% of a 460vh pin is very nearly one
viewport of scrolling in the dark. **Change either and check the other.**

**Those two frame numbers are measured, not chosen.** `roomanalyse.py` (job
tmp) reads a ceiling strip clear of the window on all 361 source frames: it
sits flat at ~86 from frame 199 to 245 while the room finishes, then climbs to
119 by 300 as the cove lights come on, steepest at 256. 240 is the last frame
of the flat part — the room complete with the lighting still off — and past
300 nothing changes. The source does the lighting; this page does not fake it
with a yellow filter.

**Sampling is not uniform, and that is the whole size story.** A quality sweep
(`roomq.py`) found the curve almost flat — the worst 8x8 block error moves from
6 to 8 between q=80 and q=64, for 32% of the bytes — so quality is not the
lever. Frame count is, and a third of the source is frames where nothing moves:

    source   0..198  step 2   the arrivals
    source 200..240  step 5   the settle (measured change per frame < 1.0)
    source 244..300  step 4   the lights — a pure luminance ramp, and
                              room-scrub.js blends adjacent frames as it
                              plays, so few frames here cost no smoothness

161 uniform frames at q=80 was 8.9MB. This is **124 at q=76: 5.3MB at 1280 and
2.0MB at 720.**

#### The sun goes down in CSS, and the lights come on in the footage

Five overlay layers, driven by three custom properties this file writes —
`--rp` (the furnishing), `--dk` (the dark beat), `--lit` (the switch). Every
layer is a pure function of those, which is what makes the whole thing
reversible. A `filter` on the canvas would be a second full-frame pass on
every painted frame; five alpha-composited layers are one composite each and
can each move on their own curve.

`.rm-open` is the one that is easy to think is decoration. **The render opens
on an empty room in full afternoon light** — mean luma 172, the wall behind
the headline nearer 200 — and the intro's white type measured **1.41:1**
against a 3.0 floor. A local pool on `.room-intro` was tried first and was not
enough: at `rgba(4,6,11,.80)` it only reaches that alpha at its centre, and a
headline is wide, so most of the type sits in the falloff. Measured after the
local pool: still 1.41:1. `.rm-open` is a full-frame, left-biased scrim that
lifts as the first plank lands. **5.74 / 6.20 / 9.46 / 12.54:1** after.

The dusk layer was `rgba(96,116,168)` at .72 and turned the whole room violet
over walnut and brass. Dusk takes the colour out of a warm interior before it
takes the light out, so it is most of the way to neutral now and the
*darkening* is the night layer's job.

#### The switch

A real `<button>` in the document from the start — in the accessibility tree
before it is visible, and **out of the tab order until it is**, because a
control you cannot see is a trap for anyone tabbing. It arms at `--dk > 0.42`,
not at the end of the furnishing: an interaction offered while the page is
still settling gets pressed by accident and then it was not a decision.

Measured on the pixels, not on a class: pressing it lifts the ceiling strip
from **36 to 112** and the room from 40 to 108.

Three things in it are load-bearing:

1. **The fade is asymmetric — 340ms on, 110ms off.** Coming on is the moment
   the page exists for. Going off happens because the reader scrolled back
   into the furnishing, and while `lit > 0` the canvas is painting the LIT end
   of the ladder — so a slow fade means watching a finished, lit room while
   scrubbing backwards through a half-built one. At 340ms both ways it was
   still 0.126 a second after the scroll had settled.
2. **The lights-out test is on `p` against `FURN` with a margin, not on `rp`
   against 1.** `rp` is `p/FURN` clamped, so `rp < 0.995` is `p < 0.776` —
   three thousandths of the runway from the boundary, which the lerp's own
   settling can sit inside. And because `litTick` calls `setScene`, that made
   a loop: throw the switch with the scroll settled a hair short and the next
   lit frame reset it.
3. **`setScene` is called from the switch's own loop.** It otherwise only runs
   off the scroll loop, and throwing a switch is not a scroll — the title
   block read UNLIT with the room lit.

#### The phone gets the pin back, and that reverses a considered decision

Below 861px this page had **no pin, no scroll drive and no scroll listener at
all**. That was a deliberate revert on 2026-08-12, because a scrubbed mobile
version "ran laggy on a real phone even though CDP touch-emulation testing
showed nothing wrong".

**That reasoning does not carry to this implementation, and the difference is
not an opinion.** What was laggy was an SVG scene graph — dozens of animated
groups inside a scaling camera, all re-rastering as the camera moved. What
runs now is one `drawImage` of a decoded WebP into a canvas that never
resizes, which is what `js/hero-descent.js` already does on a phone across 152
frames. The phone ladder is 720px and 2.0MB.

So the pin is back on a **420vh** runway, with the reading panel moved to the
top (below the skip pill, which it landed under at 390) and the rail dropped —
ten ticks down the side of a 390px screen is a column nobody can read.

**Still worth saying out loud: this is verified under CDP touch emulation, and
the last time that was the evidence it was not enough.** Look at it on a real
handset before calling it done.

#### The copy had to change with the noun

The drawing was a living room — rug, sofa, table, chair, credenza, picture,
arc lamp, plant, side table. The render is a bedroom. A reading panel naming a
sofa while a bed lands is worse than no reading panel, so the `<ol>` was
rewritten and its order is **read off the ladder**, not invented: planks at 8,
fluting at 36, pendants hung by 43, niches lit at 50, mirror at 57, bed at 64,
bench at 78, rug at 85, and nothing but the sun going down after 92. `STAGES`
in `js/room-scrub.js` is those frames as a fraction of the scrub, and the list
is indexed by stage — **reorder one and you must reorder both.**

**And the page called itself a drawing in seven places.** Every one now says
render. The undertaking underneath did not change and must not: Lumina is an
advisory, does not supply, sell or specify furniture, and nothing in that room
is for sale. Getting this wrong in the other direction would be worse — a
render passed off as a photograph of a property is exactly what the note under
`#offer` exists to prevent, which is why it says **not a photograph of a
property** in bold and the reading panel's spec line reads `RENDER · NOT A
LISTING`.

#### Deleting 73 rules safely

`deadcss.py` (job tmp) asks the browser which selectors match nothing, at both
widths, **with every runtime class forced on** — `.rm-live`, `.room-static`,
`.reading`, `.armed`, `.on`, the rail's `data-on` states — because a rule that
only applies mid-sequence is not dead. Three of its 76 were false positives:
`.rm-btn:active` and `.rm-btn:focus-visible` are pseudo-CLASSES, and
`querySelector(':active')` is null unless something is being pressed at that
instant.

A rule matching nothing is a claim. The evidence is `roomshots.py`: ten frames
before the deletion and ten after, every animation paused and the freeze
proved with a control pair. **14,464 pixels of 13 million differ, worst
channel delta 8/255** — noise, not structure.

#### Two probe bugs in this work, both of which read as page defects

- **`Input.dispatchKeyEvent` without `text`.** CDP delivers a keydown the
  browser does not treat as an activation, so Enter on a focused `<button>`
  fires no click at all. It read as the page ignoring the keyboard. Count the
  click events, do not infer from the resulting state.
- **A visual A/B on a page that is still moving.** The first glow-filter diff
  reported 174/255 over 20% of the screen for a half-pixel blur. Freeze every
  animation and prove the freeze with a control pair.

### `lumina-studio.html` — the fourth service, and the only B2B one

Websites, social-media blueprints and brand identities for **other real-estate firms**.
Everything else on this site sells a property; this sells a capability, so it is the one
service page whose reader is a competitor's marketing lead rather than a buyer.

**It argues from this website and from nothing else.** There are no client names, no project
counts, no "50+ sites delivered", no prices and no testimonials — a studio page is exactly
where invented credentials get believed. The proof strip is four tiles linking to real pages
of this build (`room.html`, `invest.html`, `listings.html`, `areas.html`), so the claim is
checkable in one click while the reader is inside the sample. **If real named client work
ever arrives it REPLACES that strip — it does not get added beside a number.**

**The conflict is stated on the page, twice.** Lumina is a brokerage offering to build for
firms that also sell property. That is at the top of the hero and again in the `#terms`
ledger ("Competing firms — said out loud"), with the undertaking that studio-side information
stays away from the brokerage side. Do not let a rewrite quietly drop it: a reader who finds
it out later has been handled, and a reader who is told up front has been respected.

**Services page counts.** Adding it made three services four — the bubble field, the written
list, the lede, the spine tips, the fees note and the enquiry dropdown all say four now.
Search `services.html` for "three" before adding a fifth.

**The bubble angles are a diamond and they are measured, not reasoned.** 90 front, 2 right,
182 left, 270 back. The first attempt put Studio at 150, which collided with Evaluation at
216 — their x is `cos(a)`, and those two angles differ by only 0.1 there despite being 66
degrees apart. Rest-frame separation is verified at 1280, 1440 and 1600. **Move one and
re-measure all four.** Bubbles passing each other mid-orbit is intended, not a fault: the
z-index is depth-ordered so they cross in front of and behind one another.

**Studio is footer-only in navigation.** The bar keeps its six links on every page — see the
`js/nav-menu.js` rule above — so Studio is reached from `services.html`, from the footers, and
from the bubble field. A regex that adds it after `<a href="services.html">Services</a>` will
hit the header bar too; scope it to `<nav class="foot-nav">`.

### `#build` on the studio page — the fourth scroll mechanism, and the desk that collides

The page **opens** on it, the same way `invest.html` opens on its empty plot: a 420vh pin in
which a brand is struck, a website is wireframed, skinned, filled and shipped, and three posts
fan out of the phone — then it is handed over. Files: `css/studio.css`, `js/studio.js`, the
`.st` section of `lumina-studio.html`. It is the argument of the page performed instead of
described, which is the only reason a studio page is allowed a four-viewport pin.

Same engine as `invest.js` and `room.js` — one pinned section, one `0…1` progress, every value
a pure function of it, no timers, no integrated springs, so scrubbing back un-builds it exactly.
The phase table at the top of `css/studio.css` is the score; `ACTS` in `js/studio.js` is its
table of contents. Two rules carried straight over and worth restating because they are the two
that have bitten every set-piece here: **`osc()` is 1 at t=0** so it only ever belongs after a
landing, and **`.st-pin` needs an explicit `grid-template-rows:minmax(0,1fr)`**, not
`place-items:center`.

**What is genuinely different: it drives DOM, not a drawing.** Both other set-pieces are
line-work — SVG for the room, divs styled as slabs for the building. This one is a real
browser frame full of real elements, because a studio that builds websites out of elements
should build one out of elements while you watch. Which brings the rule that shapes the whole
stylesheet: **never animate colour from the scroll handler.** Each of the six blocks is three
stacked static layers — `.st-wire` (hatched wireframe), `.st-skin` (brand colour), `.st-content`
(type and prices) — and the build crossfades their opacities. Same reason room.css stacks four
skies. And there is **no `filter` on anything inside the camera**, for room.css's reason: a
filter inside a scaling ancestor re-rasters its region every frame.

**The real work was the collisions, and instrumentation could not see any of them.** The
drivers scrubbed perfectly — six blocks, four acts, correct sequencing, zero overflow at seven
widths, clean under reduced motion — while five pairs of boxes were sitting on top of each
other in the screenshots. Every one is now a declared clearance token on `.st-pin` rather than
a number restated in five rules:

| Was | Because |
|---|---|
| **Skip button printed over the bar's WhatsApp chip** | `.st-skip` is absolute in `.st-pin` and **abspos resolves against the padding box** — `top:0` is the border edge, i.e. under the fixed header, not the top of the padded stage. `--pin-top` now feeds both the padding and the button. |
| **Two columns of dots down the right** | The act rail was vertical at `right:0`, immediately beside `js/lumina.js`'s fixed `#spine`. **Every elevated page carries that spine** — a vertical rail here can never be anything but a second one. The rail now runs along the **foot**. |
| **Notes panel sitting on the title block** | Both bottom-left. `--sheet-h` is now *enforced* on `.st-sheet` (a real `height`, cells flex-centred so the dividers still run full height) and `.st-read` stacks on top of it by reading the same token. |
| **Notes panel covering the first of three cards** | The frame is centred in `.st-cam`'s **content** box, so `padding-left:var(--flank-l)` is what moves it clear, and `--flank-l` is derived from `--read-w` so they cannot drift. |
| **Phone covering the third card, and the rail's labels** | `--flank-r` must be **wider than the phone**, or the phone's right edge lands exactly on the frame's right edge and it overlaps inward by its full width. It is `--phone-w + 28…40px`, and `.st-phone` offsets by `--flank-r - --phone-w + 18px` so it *leans on* the frame's edge by 18px. Both are inside the camera, so the lean survives the zoom. |

A sixth appeared as soon as the flanking was in: **`.st-brand` at `top:50%` reached down into
the notes panel** by up to 54px at 1280. The left column is a stack of three — board, notes,
title block — so the board is anchored `top:0`. Anything new on the left goes into that stack.

**`.st-pin::after` is `z-index:1`, behind the stage.** It fades the blueprint grid into the ink;
at 8 it was a scrim over the whole stage and dimmed the title block and the act rail, which are
the two things at the foot that have to stay readable.

**The probe for this page measures overlaps, not drivers** — twelve element pairs at seven
scroll positions across six widths. A driver read cannot see two boxes sharing pixels, and on
this page that was the entire defect set. If you change any position here, re-run it.

**The intro's instruction is its own element (`#stCue`) with its own text node**, because below
861px and under reduced motion there is no scroll build and `flat()` rewrites it to *"Brand,
site and posts — as delivered"*. `setScene()` sets it back, so crossing the breakpoint
mid-session is correct in both directions. The lede above it deliberately does **not** end in
"Scroll." — that sentence could not be rewritten without a script editing prose.

### The shared section vocabulary — do not diverge from it

The three service pages deliberately use **the same kickers, in the same order**, so a reader
who has scanned one already knows where things are on the next. The `.tip` on each spine dot
matches its section's kicker word for word — they are the page's table of contents and they
must not drift apart.

| Order | Kicker | What belongs in it |
|---|---|---|
| 1 | `Services · <name>` | the hero: what the service is, in a plain descriptive headline |
| 2 | *(inside the hero)* | `.whofor` — "Right for you if", three qualifying lines |
| 3 | `Why it matters` / `Why this route` | the argument, and the one diagram |
| 4 | `What is included` / `What you get` | the scannable list |
| 5 | `How it works` | the process |
| 6 | `Fees and terms` | the ledger, and the no-figures note |
| 7 | `Get started` | the WhatsApp form |
| 8 | `Also from Lumina` | `.more-card` links to the other two |

Two rules that are easy to lose:

- **Headings name their content; ledes carry the voice.** The house style is aphoristic
  ("A number is easy. A number you can defend is the work.") and that is an asset — but an
  aphorism as an `h2` tells a scanning reader nothing. Put the plain statement in the
  heading and the sharp line in the lede underneath. Every heading on these pages was
  rewritten once for exactly this reason.
- **`.whofor` and the `#more` strip appear on all three pages, in the same position.** They
  are the navigation, not decoration: `.whofor` answers "am I in the right place" before the
  reader has scrolled, and `#more` stops each page being a dead end. `#more` also needs its
  own spine dot — see the spine rule above.

`invest.html` carries **its own copy** of the `.whofor` and `.more-*` CSS, because it does
not load `css/elevated.css`. Change one, change both. Its `.creds` rules are scoped
`.creds>ul>li` and must stay that way: as plain `.creds li` they reached into the `.whofor`
list that sits in the same band and drew every qualifying line as a bordered tile.

### What is real on the two new service pages

Same rule as `invest.html`. **There is no fee, no percentage, no turnaround in days and no
JOD/m² figure on either page, and none may be invented.** Both say out loud why: a management
fee quoted before anyone has seen the property is padded or about to be revised, and a
per-metre rate quoted without the property attached is the thing an evaluation exists to
replace. The neighbourhood per-metre numbers elsewhere on this site are flagged as
placeholder above — do not repeat them on `property-evaluation.html` as if they were
evidence. What is real: the service, West Amman, the WhatsApp number, and that fees are
quoted per instruction.

`js/service-form.js` is shared by both. It reads every `.field` in `#regForm` and uses the
label's own text, so adding a field to either page appears in the WhatsApp message with no
change to the script. `<body data-subject="…">` is what the greeting says it is about.

## Pages, and which cluster they belong to

`index.html`, `invest.html`, `services.html`, `property-management.html` and
`property-evaluation.html` are the "elevated" design (`--gold: #FFB25A`, Instrument type).
Every other page is the older system (`css/style.css`, `--gold: #C2A35A`, Inter). They share
`css/property-ui.css` and the property card, and nothing else. Do not assume a token defined
on one is available on the other.

**The elevated cluster now has two ways of getting its shell, and that is deliberate.**
`index.html` and `invest.html` each carry their own inline copy. The three newer pages link
`css/elevated.css`, which holds the same tokens plus the shared type, bar, spine, buttons,
`.card-g`, `.terms`, `.points`, `.ticks`, the form and the footer. Three pages landed at once
and pasting four hundred identical lines into each was indefensible; extracting index.html
into it still is not worth it. **So the tokens live in three places — index.html,
invest.html, and css/elevated.css. Change one, change all three.** Never load
`css/elevated.css` on a page that loads `css/style.css`: the two disagree about `--gold` and
about the body font.

What none of them duplicate is *behaviour*: every elevated page reuses `js/lumina.js`
wholesale, which is why each carries `#boot`, `#glow`, `#bar`, `#spine`, `#fill` and `#yr` —
that file reaches for them by id and throws without them. In exchange each page gets the
reveal observer, the per-line headline split, the cursor light, the `.tilt` specular and
`.mag` magnetics for free. They all load `css/mobile.css` + `js/nav-menu.js` for the phone
bar and menu sheet; without them a six-link bar pushes the document 60px sideways at 390px.

**The area and insight pages were repointed on 2026-07-28.** They used to be Abdoun /
Dabouq / Dead Sea, and the site has never held a single listing in Dabouq, the Dead Sea,
Abdali, Khalda or Al Kursi — so two of the three area pages were showing three random
Amman apartments under the wrong heading, via the fallback in `areas.js`. They are now
Abdoun (61) / Swefieh (9) / The Circles (18), matched by `data-area` against `location`.

Both sets are generated, not hand-edited — the copy quotes counts and price ranges
computed from the JSON, so it cannot drift away from the inventory the way the old pages
did. Regenerate rather than editing in place if the data changes materially.

**The landing page still says Dabouq and Khalda** (`#hoods`, the footer). That is
deliberate — the client asked for the landing copy to be left alone — but it is now the
only place on the site naming districts with no stock. Worth raising.

**Navigation is unified everywhere except `index.html`**: Properties / Areas / Insights /
Sell With Us / Enquire. There were four different navs calling the same thing three names.

**Assets carry `?v=<date>`.** No cache headers, no build step, so a returning visitor keeps
whatever JS their browser cached — this is not theoretical, it is how the landing page kept
running an old picker after the file had changed. Bump the version in the HTML when
shipping JS or CSS changes.

**Bump it on EVERY change, not once per working session.** The version is a cache key, not
a datestamp. On 2026-08-12 `consult-form.js` was bumped to `?v=2026-08-12a` on the first of
three edits and left alone for the other two; Cloudflare, which fronts the live domain and
serves `/js/*` with `max-age=86400`, had already cached the first version against that key
and went on serving it. The deploy was green, the file on the origin was correct, and the
live site ran the old script for hours — the seal still offered WhatsApp after the WhatsApp
route had been deleted. `curl` with a *fresh* query string returns the new file and hides
this completely, so it is not a check worth trusting.

The check that actually catches it: fetch the versioned URL the HTML requests and a
throwaway `?cb=<random>` URL, and compare. Same bytes means the CDN is current; different
bytes means the version needs bumping. Do not compare against the local working copy —
git normalises to LF while the checkout carries CRLF, so every file looks stale.

**The live origin is Cloudflare Pages, not GitHub Pages, and it soft-404s.** Established
2026-08-17. `www.lumina-jo.com` resolves to Cloudflare proxy IPs; `curl --resolve` to
GitHub's Pages IPs with that Host header does not connect at all, and the origin strips
`.html` (308 `/invest.html` → `/invest`) and honours `_headers`, which GitHub Pages ignores
entirely. GitHub's own `pages` Action going green therefore says nothing about the live
site — it took **20 minutes** after that Action completed for the Cloudflare build to
appear. Two traps follow:

1. **`risethehorns-arch.github.io/lumina-live` is not a second, independent host.** The repo
   carries a CNAME, so GitHub 301s it to the custom domain and any fetcher that follows
   redirects — `urllib` does, by default — checks the same origin twice and reports
   agreement as corroboration. It is not.
2. **A missing file returns `200` with the site's own HTML, not a 404 — and Cloudflare
   caches that for `max-age=86400`.** So probing a canonical asset URL before the deploy
   lands *poisons the real key for a day*. It happened: `assets/invest/building-01.jpg` and
   `js/invest-gallery.js?v=2026-08-17a` served HTML from the Amman colo after the correct
   files had shipped, `cf-cache-status: HIT`. `nosniff` makes the failure clean rather than
   dangerous — the browser refuses to run HTML as script or draw it as an image — but the
   asset is simply broken until the TTL expires. **While waiting on a deploy, only ever
   fetch with a throwaway `?cb=<random>`**, and never `curl` the canonical URL. Recovery
   without the Cloudflare account is a new cache key, which is why those eight photographs
   carry `?v=` when no other image on the site does.

Purging the edge needs the Cloudflare dashboard, which is in a third party's account — that
is a request to the user, not something to work around.
- All six listings, their prices and specs
- Neighbourhood JOD/m² figures (1,450 / 1,250 / 1,100 / 1,300)
- Hero stats: 14 mandates, 61% off-market, 9 years
- The band caption's "sold in eleven days" claim
- The hero's `150+` listings panel — the portfolio holds 129, and that panel now links
  straight to the page that says so. Raised 2026-08-22; the client kept `150+`

WhatsApp `+962 77 150 5250` **is** real and is wired throughout, including the contact form,
which composes the enquiry text and opens `wa.me` — there is no backend and none is needed.

## The Zyrn credit in the footer (added 2026-08-18)

Every one of the 19 pages carries `Powered by: ZYRN` in its footer's brand column — directly
under the advisory line, beneath Lumina's own mark — linking out to https://zyrn.org/. It is the mirror of the Lumina credit that sits in Zyrn's own footer
bar (`assets/css/footer.css`, rule `.lum`, in the Zyrn repo), and the reasoning is the
same in both directions:

> another firm's mark is not recoloured to fit ours.

So this is Zyrn's wordmark under **Zyrn's** treatment — Space Grotesk 500, the sheared
halves, the Pulse seam at `#6E56F8`, and the glitch burst — printed on Lumina's ground
with no amber on it. The violet is the only foreign hue on this site and it is correct.
The `Powered by:` lead-in is ours and stays in `--c-38`.

Three files, and none of them touch anything that already existed:

| File | What it is |
|---|---|
| `css/zyrn-credit.css` | the face, the shear, the four glitch layers, and the two footer placements |
| `js/zyrn-credit.js` | the shear latch and the irregular glitch schedule |
| `assets/fonts/SpaceGrotesk-500.woff2` | Google's latin subset, 13 KB, OFL-1.1 |

### What will break silently if you touch it

**The face is self-hosted, and it has to be.** `_headers` sets `font-src 'self' data:`,
so a Google Fonts `@import` is refused by the live origin and the mark falls back to
Instrument Sans — which looks like a design choice rather than a failure. Same trap on the
JS: `script-src 'self'` means an inline `<script>` is refused and the mark simply never
shears. Both are external files for that reason.

**The `unicode-range` is pinned to `U+004E,U+0052,U+0059,U+005A`** — N, R, Y, Z. The woff2
carries the whole latin set, and without the range any later `font-family:'Space Grotesk'`
would set real Lumina copy in another brand's face.

**The glitch animates the wrapper and the clones, never the halves.** The halves carry the
shear latch, and a keyframe transform on them erases it. Same rule as the float stack on
`invest.html`: one transform per element, because the last declaration wins with no error.

**The clones are built at fire time, not at init** — they snapshot the current shear state.
Built once at start-up they would snapshot an un-sheared wordmark and every burst after the
latch would throw a straight ghost across a sheared original.

**The schedule is deliberately irregular.** 1.8–5.2 s quiet, then a double or a triple at
110–350 ms apart, and 42% of firings are a 130 ms micro-twitch with no slices. A fixed
`setInterval` reads as a metronome, which is the opposite of a glitch. It also never fires
while the mark is off screen — which, in a footer, is nearly the whole visit.

### The two footers, and the size

The site has two footer shapes and the credit sits in the brand column of both:

- elevated cluster — after `<p class="fine">Private real estate advisory · Amman, Jordan</p>`
- older cluster — after `<p class="footer-desc">`

Both columns are plain block flow, so a top margin is the whole placement. It reads as a
second, smaller signature under Lumina's own mark.

**The size is set against the Lumina mark, not chosen in the abstract.** That mark measures
34px in the elevated footer and 36px in the older one at 1440, and 26–28px at 390. The shear
is `20px` desktop / `17px` mobile, which lands at **56–65%** of it — near enough to belong to
the same stack, far enough that the hierarchy is never in question. If either logo rule
changes, re-measure: `smoke_zyrn.py` fails the page if the ratio leaves 45–70%.

The seam's overhang is `-.55em`, not a pixel value, so it tracks the size instead of
shrinking in proportion as the mark grows.

**Moving this block is not a copy-paste job.** The credit is six nested `<span>`s, so a lazy
`<span class="zc">.*?</span>` match cuts it in half and leaves the tail behind — which is
exactly what happened on the first attempt at the relocation, on all 19 pages at once.
Balance the tags, and count `<span>` against `</span>` before and after as a guard.

### Verified

`cdp_zyrn.py` and `smoke_zyrn.py` (job tmp): 19 pages x 1440/390 all clean — credit in the
footer's brand column at 56–65% of the Lumina mark, face resolving to real Space Grotesk (measured against a forced serif, because a
silent fallback renders identically to a typo), shear latched, seam still `rgb(110,86,248)`,
no horizontal overflow, no console errors. Glitch observed firing with ghosts; under
`prefers-reduced-motion` zero bursts and every animation-name resolves to `none`, while the
shear stays latched — it is the mark's resting state, not an animation.

## Non-negotiables

- `prefers-reduced-motion` must disable levitation, parallax, tilt, grain and smooth scroll.
- Tilt, magnetic buttons, cursor glow and any blur-by-depth effect are gated behind
  `(hover: hover) and (pointer: fine)` — never ship them to touch devices.
- `backdrop-filter` is already on ~12 glass panels. That is the performance ceiling.
  New compositor-heavy effects need a `min-width: 1024px` gate.
- Animate `transform` and `opacity` only. Never animate `backdrop-filter`, `width`,
  `height`, `top` or `left`.
- Keyboard focus stays visible. Contrast on text over media stays ≥ 4.5:1.
- No emoji in the UI. Icons are inline SVG.

## Enhancement backlog, in build order

Agreed priority from the last design review:

1. **Aperture bridge** — reveal the film section through an expanding `clip-path: inset()`
   driven by a sticky scroll range (42% → 0% → 42%). Highest impact.
2. **Per-line headline reveal** — split `.display` headlines into line spans, translate each
   from 110% with a stagger and dissolving blur.
3. **Overlap seams** — sections pull up ~8vh over the previous with a soft top mask, so no
   two sections meet on a hard horizontal line.
4. **Pinned collection head** — `position: sticky` on `.sec-head` while the card grid scrolls.
5. **Hero exit choreography** — reuse each panel's existing `--d` depth value so panels
   drift apart at different rates as the hero leaves.
6. **Lenis smooth scroll** (`lerp: 0.085`) — the only permitted dependency, and only if it is
   fully disabled under reduced motion.
7. Optional, desktop-gated: depth-of-field blur by distance from viewport centre (cap 3px),
   scroll-velocity `skewY` (cap 1.5°).

Explicitly rejected: ambient audio, horizontal-scroll collection, additional parallax layers.

## Working style for this repo

Small, reviewable diffs. One backlog item per commit. After each visual change, state what
to look at and at which viewport — the human verifies by eye, so a diff without a
"check this at 390px" note is incomplete.
