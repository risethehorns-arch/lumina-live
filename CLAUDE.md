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

### The hero panels — all four are interactive now (2026-08-22)

The four panels on the right of the hero used to be two readouts and two buttons. They are
four controls now, and the two that changed did so in the two different ways this site
already distinguishes between:

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

### `room.html` — the scroll-to-furnish room

The site's second and larger scroll set-piece: a 460vh pin in which an empty one-point
perspective interior furnishes itself over nine pieces while the sun crosses the floor and
hands the room over to a lamp. Reached from the `.fab` glass pill on `index.html` (bottom
left) and from the footers. Files: `room.html`, `css/room.css`, `js/room.js`.

**Nothing in it is placed by eye, and that is the point.** Two formulas at the top of
`css/room.css` generate every coordinate: a depth projection `x(x0,y) = 880 + (x0−880)·(y−470)/229`
and a height rule `top_y = yf − 1.8865·h·(yf−470)`. The back wall is the frame scaled by
k=0.432 about the vanishing point (880, 470), which is why the floor grid's two outermost
orthogonals land exactly on the frame's bottom corners — the construction checking itself.
**Every receding edge points at (880, 470). One that does not is a bug, not a style choice.**

Five things that will go wrong the same way again:

1. **`.ln` is taken.** It is `elevated.css`'s per-line headline reveal and ships with
   `opacity:0`. Used for the room's line-work it made every line in the drawing invisible and
   the room rendered as flat silhouettes — the same class of bug as `.win` on `invest.html`.
   The room's line class is `.rln`. **Check any new class on this page against the shared
   sheets before using it.**
2. **`osc(t,n,d)` is 1 at t=0, not 0.** It is a *decaying* oscillator and only ever belongs
   after a landing. Applied across a whole span it parks the piece at its amplitude from the
   first frame — which is exactly what left the plant pot faintly visible over an empty plot.
3. **The reading panel takes the LATEST-started live piece** — the inverse of `invest.js`,
   which takes the first because the top slab is the interesting one when a building goes up.
   When a room fills, the newest and nearest thing is. Copy invest's line verbatim and the
   panel talks about the rug while the picture is visibly swinging.
4. **`getBBox()` on a transformed group returns the untransformed box**, which is what makes
   the nine hit targets measurable — but they are measured once with every piece at `--p:1`
   and then restored. Measured mid-arrival all nine land somewhere wrong, and because they
   are invisible it reads as a mysterious offset rather than a measurement bug.
5. **There is deliberately no `fit()`.** `viewBox` + `preserveAspectRatio` does declaratively
   everything `invest.js`'s resize-measuring pass does imperatively. Do not helpfully re-add
   one; there is nothing here for it to measure, and a comment in `room.js` says so.

**No `filter` anywhere on the page** — not animated, not static, not on the shadows. A static
filter inside a scaling camera re-rasters its whole region every frame the camera moves.
Every glow, bloom, pool and shadow is a gradient on a rect or an ellipse. (`clipPath` is
fine and is used once, to keep the sun and the skyline inside the window aperture.)

Three deliberate exceptions and placements, decided once:

- **The pointer parallax is the one motion that is NOT a function of p, on purpose** — a
  pointer is not a scrollbar. `room.js` springs `--par-x/--par-y` a few px toward the cursor
  on its own small rAF (gated `hover:fine`, dead under reduced motion, stops when settled),
  and the term rides the same transform chain as the dolly so the hit targets can never
  drift off the drawing.
- **The vignette (`#vig`) is screen-space, outside `#cam`.** Scaled with the dolly it would
  read as the room darkening at its own edges rather than the frame having depth.
- **The dust (`.dm`) and the fab's idle animations are CSS keyframes, not p-driven** — they
  are ambience, not choreography, and both die under reduced motion.

The window's mullion/sky group also carries curtains, a skirting/cornice pair (`#trims`,
both derived from the height rule at h=.04 and h=.96), a clipped skyline + travelling sun,
and the floor pool translates with `--pool-x` so the patch of light crosses the room with
the sun that casts it.

**Honesty.** The room is a drawing and the page says so three times — the title block, the
note under `#offer`, and the line the page exists to earn: *the room is a drawing, the
properties are real, we do not sell the sofa — we find the room.* Lumina does not supply,
sell or specify furniture. If a rewrite ever softens that into "Lumina furnishes homes" it is
a regression, because it is not true and it is not the business.

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
