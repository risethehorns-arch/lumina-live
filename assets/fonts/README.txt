Fonts used on this site. All three are self-hosted rather than linked from a
CDN, because _headers sets `font-src 'self' data:` — a Google Fonts request is
refused by the live origin and the page falls back silently.

InstrumentSerif.woff2   Instrument Serif, 400        SIL Open Font License 1.1
InstrumentSans.woff2    Instrument Sans, 400-700     SIL Open Font License 1.1
SpaceGrotesk-500.woff2  Space Grotesk, 500           SIL Open Font License 1.1

Instrument Serif and Instrument Sans are the brand faces. See CLAUDE.md.

Space Grotesk is NOT a Lumina face. It is here for exactly one thing: the ZYRN
wordmark in the footer, which is another firm's mark and is set in that firm's
own type. css/zyrn-credit.css pins its unicode-range to U+004E, U+0052, U+0059
and U+005A — N, R, Y, Z — so it can never render Lumina copy. Do not widen that
range, and do not reach for this face for anything else.

The Space Grotesk file is Google Fonts' latin subset (v22), 13 KB. OFL-1.1
permits redistribution; the licence travels with the font and is published at
https://fonts.google.com/specimen/Space+Grotesk/license
