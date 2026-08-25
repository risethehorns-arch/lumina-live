#!/usr/bin/env python3
"""Extract the hero descent into two WebP frame ladders under assets/hero/.

WHY A FRAME SEQUENCE AND NOT A <video>
--------------------------------------
The brief specified a dual path: seek a <video> on desktop, fall back to a
canvas frame sequence on iOS. Both paths were built and measured against this
particular footage, and the fallback won outright:

    frames  1440w  217 x 16.1KB = 3.58 MB    <- shipped
    frames   960w  217 x  8.8KB = 1.95 MB    <- shipped
    video   1280w  all-keyframe = 4.2 MB
    video   1920w  all-keyframe = 8.6 MB

The descent is dark, soft and low-detail, so it compresses far better than the
brief's 45KB/frame estimate. The consequence is that the *higher resolution*
frame ladder costs less than the *lower resolution* seekable video. Once that
is true the video path has nothing left to offer: it is bigger, it decodes
differently on every platform, iOS throttles currentTime seeking regardless of
encoding, and keeping it means shipping a calibration scrub, a sessionStorage
decision and two code paths to maintain forever.

So there is one path. It is deterministic — the same 217 images on every
device — and it needs no CSP change, because img-src already allows 'self'.

The master is NOT in this repo. It is HEVC 10-bit, 7.2MB, and nothing serves
it. It lives one level above the deployable folder, alongside the brief:

    Desktop/Claude final/hero-source/lumina-descent-master.mp4

REGENERATE with:

    python scripts/build-hero-frames.py

Idempotent. Rewrites both ladders and reprints the numbers below. Not a build
step in the CI sense — the output is committed, exactly like the share cards.
Nothing on the site runs this at request time.

FRAME NUMBERING: 001.webp is video frame 0. The ladder is 1-based because
ffmpeg's image2 muxer is, and renumbering it would be one more thing that can
silently go off by one.
"""

import base64
import io
import os
import shutil
import subprocess
import sys

from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(os.path.dirname(ROOT)), 'hero-source',
                   'Lumina_Hero_Master_1080p.mp4')
OUT = os.path.join(ROOT, 'assets', 'hero')

# (css width, quality OFFSET applied to the ramp below). 1440 covers desktop
# up to a 2x 720px column; 960 covers every phone at 2x. A third rung buys
# nothing: the frames are already smaller than the JPEGs the rest of the site
# serves.
# (width, quality, crop) — crop is an ffmpeg expression or '' for the full
# frame. MEASURED 2026-08-25; both rungs changed and both for the same reason.
#
# THE WIDE RUNG IS NATIVE NOW. The master is 1920x1080 and the ladder was
# 1440 — a downscale, then CSS-upscaled again to cover a 1440 viewport, then
# doubled by a 2x display. Presented at 3200x1800 and compared against the
# master put through the same crop: 1920 at q52 measured the SAME bytes as
# 1440 at q78 with 12% more edge energy, and q64 costs 14% more bytes for
# noticeably closer colour. Resolution beat quality outright here.
#
# THE PHONE RUNG IS A PORTRAIT CROP, and this is the bigger win. A 16:9 frame
# cover-cropped into a 390x844 pin shows only the middle 26% of its width —
# so of a 960px frame, 250 pixels were being stretched across 1170 device
# pixels. A 4.7x upscale of a quarter of the file, with the other three
# quarters downloaded and thrown away. 608x1080 is a NATIVE centre crop of
# the master at exactly the slice a phone displays: same pixel count as the
# old rung, no scaling at any stage, and about 2.2x the effective resolution.
#
# 608 is 9:16 of 1080. Phones run 0.46 aspect and need 26% of the master's
# width; a 9:16 crop carries 31.6%, so cover still has room to work. The rung
# is chosen at innerWidth < 760, so tablets and landscape phones take the
# wide one and never see this crop.
LADDERS = [(1920, 64, ''), (608, 68, 'crop=608:1080:(iw-608)/2:0')]

# A GRADE, BAKED IN. Measured on the rendered page against the master through
# the same cover crop: at the landing frame the page shows 16% less chroma
# than the footage, and mid-descent 37% less. That is the scrims doing their
# job — .hero-lede::before and .hero-media::after are what make the headline
# legible over a sunlit cloud deck, and they are documented as load-bearing —
# but the consequence is that the picture reaches the eye greyer than it was
# shot.
#
# Correcting it in the ladder costs NOTHING at runtime. A CSS filter on the
# canvas would be a second full-frame pass on every painted frame; this is
# already in the pixels. The target is the master, not "as saturated as
# possible": saturation 1.20 puts the landing frame back at parity and lifts
# the scrimmed middle without trying to undo a scrim that has to be there.
GRADE = 'eq=contrast=1.06:saturation=1.20'


# EVERY SECOND SOURCE FRAME. The master is 452 frames at 24fps; the runway is
# 220vh, which on a 900px viewport is 1980px of scroll:
#
#     452 frames -> 4.4 px of scroll per frame
#     226 frames -> 8.8 px            <- shipped
#     217 frames -> 9.1 px            <- the previous hero, verified smooth
#
# So the full sequence is twice as dense as the eye can use, and the second
# half of that density costs 12MB for nothing. Halving lands on the same
# scroll-to-frame ratio that measured smooth at 48fps on a throttled profile.
# The brief says this outright: reduce the frame count before the resolution.
STEP = 2

# THE DESCENT STOPS HERE. The master runs on for another 74 shipped frames,
# pushing the camera into the living room until the pod fills the screen — but
# the composition the client chose to land on is the whole structure on its
# plinth, lake and mountain still behind it: ladder frame 152 of the decimated
# sequence, source frame 302 of 452.
#
# Those 74 frames are not merely unused, they are the most expensive in the
# sequence, because a close interior is all detail. Trimming is worth ~4MB.
#
# TO MOVE THE LANDING FRAME: change this number and rebuild. Then update TOTAL
# in js/hero-descent.js and the two <picture> sources in index.html, which name
# the last frame explicitly.
TOTAL = 152        # of 226 available; 452 source frames, every second one

# QUALITY IS A CONSTANT, AND THAT WAS TESTED PROPERLY BEFORE IT WAS KEPT.
#
# WebP quantises in 16x16 macroblocks, so its artefact is block structure in
# smooth fields — and this descent opens on nothing but a smooth field. On the
# FILES that is exactly what happens, measured as the step across block edges
# over the step within blocks (1.00 = no structure; the lossless master scores
# 1.22):
#
#     frame  13   blockiness 22.7   at  4.4 KB
#     frame  37   blockiness 12.4   at  4.3 KB
#     frame 217   blockiness  1.6   at 29.1 KB
#
# Blocking is inversely correlated with size — the frames that band are flat
# cloud, and flat cloud is nearly free to store. So a quality ramp was built
# (96 over the cloud, tapering to 80 over the villa), and on the files it
# worked: 22.7 -> 4.5 on the worst frame. It cost +47% of the ladder, 5.53MB
# -> 8.14MB.
#
# Then the RENDERED PAGE was measured, which is the only version anyone sees:
#
#     flat q78,  grain on   1.13        ramped, grain on   1.13
#     flat q78,  grain off  1.23        ramped, grain off  1.23
#
# Identical. Two things destroy the block structure before it reaches the eye:
# the page's own fixed fractal-noise overlay (.grain, opacity .045) is real
# dither applied after the frame, and the canvas is CSS-upscaled to cover, so
# the 16px grid never lands on a 16px screen boundary. The flat encode already
# renders at the lossless master's own score.
#
# DO NOT RAISE THIS to fix banding without re-measuring the rendered page. The
# files look bad and the page does not, and 2.6MB is the price of trusting the
# files. If .grain is ever removed from index.html, this becomes live again.
QUALITY = 78


def run(*args):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode:
        sys.stderr.write(r.stderr[-2000:])
        raise SystemExit('ffmpeg failed: %s' % ' '.join(args[:6]))


def lqip(frame_path, width=32):
    """A blurred 32px placeholder, inlined as a data: URI.

    This paints before a single sequence frame lands, so the hero is never a
    blank rectangle. It is deliberately tiny — at 32px wide the descent reads
    as a colour field, which is all it needs to be for the ~100ms it shows.
    """
    im = Image.open(frame_path).convert('RGB')
    im = im.resize((width, max(1, round(width * im.height / im.width))),
                   Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.2))
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=62)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()


def opening_motion(ladder_dir):
    """How much does the picture actually change over the first 16 frames?

    The brief flags this: frame 0 is featureless cloud, and if the opening
    reads as static a visitor calls it broken rather than atmospheric. The fix
    it proposes is to start the scrub a few frames in. That is only worth doing
    if the opening really is dead, so this measures it instead of guessing.
    """
    prev, out = None, []
    for i in range(1, 17):
        im = Image.open(os.path.join(ladder_dir, '%03d.webp' % i)) \
                  .convert('L').resize((160, 90), Image.BOX)
        px = im.tobytes()
        if prev is not None:
            out.append(sum(abs(a - b) for a, b in zip(px, prev)) / len(px))
        prev = px
    return out


def main():
    if not os.path.exists(SRC):
        raise SystemExit('master not found: %s' % SRC)

    print('source: %s (%.1f MB)' % (SRC, os.path.getsize(SRC) / 1e6))
    grand = 0
    for width, q, crop in LADDERS:
        d = os.path.join(OUT, str(width))
        if os.path.isdir(d):
            shutil.rmtree(d)
        os.makedirs(d)
        # One ffmpeg pass per ramp band rather than per frame: 217 separate
        # invocations would take minutes for no different result.
        # A crop rung takes the master's own pixels and never scales; the
        # wide rung is already the master's width, so it does not scale
        # either. Neither rung resamples any more.
        chain = "select='not(mod(n\,%d))*lte(n\,%d)'" % (STEP, (TOTAL - 1) * STEP)
        chain += ',' + crop if crop else ',scale=%d:-2' % width
        chain += ',' + GRADE
        run('ffmpeg', '-v', 'error', '-i', SRC,
            '-vf', chain,
            '-c:v', 'libwebp', '-q:v', str(q), '-vsync', '0', '-f', 'image2',
            os.path.join(d, '%03d.webp'), '-y')

        files = sorted(f for f in os.listdir(d) if f.endswith('.webp'))
        if len(files) != TOTAL:
            raise SystemExit('expected %d frames at %dw, got %d'
                             % (TOTAL, width, len(files)))
        tot = sum(os.path.getsize(os.path.join(d, f)) for f in files)
        grand += tot
        print('  %4dw q%d  %3d frames  %6.2f MB  avg %5.1f KB  peak %5.1f KB'
              % (width, q, len(files), tot / 1e6, tot / len(files) / 1024,
                 max(os.path.getsize(os.path.join(d, f)) for f in files) / 1024))

    print('  total shipped: %.2f MB' % (grand / 1e6))

    ref = os.path.join(OUT, str(LADDERS[0][0]))   # the wide rung, whatever it is
    deltas = opening_motion(ref)
    print('\nopening motion (mean abs luma delta, frame N -> N+1):')
    print('  ' + '  '.join('%d:%.2f' % (i + 1, v) for i, v in enumerate(deltas)))
    print('  first frame with delta > 1.0: %s'
          % next((i + 1 for i, v in enumerate(deltas) if v > 1.0), 'none'))

    # The share card. Crawlers do not run JS and several of them handle WebP
    # badly, so the social image stays a real 1200x630 JPEG — the same size
    # rule scripts/build-share-cards.py follows, and for the same reason:
    # WhatsApp downgrades anything near-square to a thumbnail. Frame 217 is
    # the resting composition, which is what the page settles on.
    og = Image.open(os.path.join(ref, '%03d.webp' % TOTAL)).convert('RGB')
    tw, th = 1200, 630
    sc = max(tw / og.width, th / og.height)
    og = og.resize((round(og.width * sc), round(og.height * sc)), Image.LANCZOS)
    left, top = (og.width - tw) // 2, int((og.height - th) * 0.56)
    og = og.crop((left, top, left + tw, top + th))
    ogdir = os.path.join(ROOT, 'assets', 'og')
    if not os.path.isdir(ogdir):
        os.makedirs(ogdir)
    og.save(os.path.join(ogdir, 'home.jpg'), 'JPEG', quality=84, optimize=True)
    print('')
    print('assets/og/home.jpg  1200x630  %.0f KB'
          % (os.path.getsize(os.path.join(ogdir, 'home.jpg')) / 1024))

    first = lqip(os.path.join(ref, '001.webp'))
    last = lqip(os.path.join(ref, '%03d.webp' % TOTAL))
    with open(os.path.join(OUT, 'lqip.txt'), 'w', encoding='utf-8') as fh:
        fh.write('first %s\n\nlast %s\n' % (first, last))
    print('\nLQIP written to assets/hero/lqip.txt'
          '  (first %d B, last %d B)' % (len(first), len(last)))


if __name__ == '__main__':
    main()
