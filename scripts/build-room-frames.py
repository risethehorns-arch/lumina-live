# -*- coding: utf-8 -*-
"""Build the furnishing ladder for room.html.

Same shape as scripts/build-hero-frames.py — a WebP ladder rather than a
video, because a <video> cannot be scrubbed frame-accurately and a seek on a
long-GOP h264 is not something you can do sixty times a second. Read the note
in that file before changing anything here.

ONE ladder, numbered continuously, because it is one canvas and one paint
function. The split lives in the JS, not on disk.

    ladder 1 .. SCRUB     the scrub, source 0..240. Ends with the room
                          complete and the cove lighting still off.
    ladder SCRUB .. end   the lights coming up, source 244..300. Played on a
                          button press, not scrubbed.

Those numbers are measured. roomanalyse.py (job tmp) reads a ceiling strip
clear of the window on every frame: it sits flat at ~86 from frame 199 to 245
while the room finishes, then climbs to 119 by 300 as the cove lights come on,
steepest at 256. 240 is the last frame of the flat part; past 300 nothing
changes.

SAMPLING IS NOT UNIFORM, and that is the whole size story. A quality sweep
(roomq.py) found the curve almost flat — the worst 8x8 block error moves from
6 to 8 between q=80 and q=64, for 32% of the bytes — so quality is not the
lever here. Frame COUNT is, and a third of the source is frames where nothing
moves:

    source   0..198  step 2   the arrivals. Everything that flies in.
    source 200..240  step 5   the settle. Measured change per frame < 1.0;
                              this is the room standing still.
    source 244..300  step 4   the lights. A pure luminance ramp with no
                              geometry, and js/room-scrub.js blends adjacent
                              frames while it plays, so few frames here cost
                              nothing in smoothness.

161 uniform frames at q=80 was 8.9MB. This is 124 at q=76.
"""
import base64
import os
import shutil
import subprocess
import sys

SRC = (r'C:\Users\Yazan\.claude\uploads\a8040161-c9b4-40ae-b359-7e1325a79fe5'
       r'\64b7dabb-imagine027a7f6454734a838a94032958028fcb.mp4')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'room')

PLAN = [(0, 198, 2), (200, 240, 5), (244, 300, 4)]
LAST_SCRUB_SRC = 240

# (width, quality, crop) — crop is an ffmpeg expression or '' for the full
# frame. MEASURED 2026-08-25, and both rungs changed.
#
# The source is 1280x720, so the wide rung is already native and there is no
# resolution left to win there — only quality. Presented at 3200x1800 and
# compared against the master through the same crop, q76 measured rms 2.42
# and q86 rms 1.70, for 62% more bytes. q84 is where that curve flattens.
#
# THE PHONE RUNG IS A PORTRAIT CROP, which is the real win. A 16:9 frame
# cover-cropped into a 390x844 pin shows only the middle 26% of its width, so
# of a 720px frame just 188 pixels were being stretched across 1170 device
# pixels — a 6.2x upscale of a quarter of the file. 406x720 is a NATIVE centre
# crop at exactly the slice a phone shows: the same pixel count as the old
# rung, no resampling at any stage, and about 2.2x the effective resolution.
#
# 406 is 9:16 of 720. The rung is chosen at innerWidth < 760, so tablets and
# landscape phones take the wide one and never see this crop.
LADDERS = [(1280, 84, ''), (406, 78, 'crop=406:720:(iw-406)/2:0')]

# A GRADE, BAKED IN — see the same note in scripts/build-hero-frames.py.
# Measured on the rendered page at mid-furnishing against the master through
# the same crop: chroma 11% low and contrast 41% low. Attribution, by knocking
# out one layer at a time: the grade overlays own 14 of those contrast points
# (gold 6.5, dusk 4.7, vignette 1.5) and the remaining 10 are the encode and
# the cover-upscale, which no overlay can give back.
#
# So this pays back what the overlays take, in the pixels, for free. It does
# NOT try to undo the dusk — that choreography is the point of the page.
GRADE = 'eq=contrast=1.08:saturation=1.16'



def run(args):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode:
        sys.stderr.write(r.stderr[-2000:])
        raise SystemExit('ffmpeg failed: ' + ' '.join(args[:8]))


def sample():
    want = []
    for a, b, step in PLAN:
        want += list(range(a, b + 1, step))
    return sorted(set(want))


def main():
    want = sample()
    scrub = sum(1 for n in want if n <= LAST_SCRUB_SRC)
    print('%d frames; scrub is 1..%d, lights %d..%d'
          % (len(want), scrub, scrub, len(want)))

    for width, q, crop in LADDERS:
        d = os.path.join(OUT, str(width))
        if os.path.isdir(d):
            shutil.rmtree(d)
        os.makedirs(d)
        tmp = d + '_raw'
        if os.path.isdir(tmp):
            shutil.rmtree(tmp)
        os.makedirs(tmp)
        # Every source frame once, then keep the ones the plan asks for. A
        # 124-term select filter is the alternative and it is unreadable.
        # A crop rung takes the master's own pixels; the wide rung is
        # already the master's width. Neither resamples any more.
        run(['ffmpeg', '-v', 'error', '-y', '-i', SRC,
             '-vf', (crop if crop else 'scale=%d:-2' % width) + ',' + GRADE,
             '-vsync', '0', '-c:v', 'libwebp', '-q:v', str(q),
             '-compression_level', '6', '-preset', 'picture',
             os.path.join(tmp, '%05d.webp')])
        for i, n in enumerate(want, 1):
            # ffmpeg's %05d counts from 1; source frame n is file n+1
            shutil.move(os.path.join(tmp, '%05d.webp' % (n + 1)),
                        os.path.join(d, '%d.webp' % i))
        shutil.rmtree(tmp)
        size = sum(os.path.getsize(os.path.join(d, f)) for f in os.listdir(d))
        n = len(os.listdir(d))
        print('%4dpx  %3d frames  %6.2f MB  (%.0f KB a frame, q=%d)'
              % (width, n, size / 1e6, size / n / 1e3, q))
        assert n == len(want), '%d files, wanted %d' % (n, len(want))

    # Posters: what a phone, reduced motion and a blocked script land on.
    for name, n in (('poster-dark.jpg', LAST_SCRUB_SRC), ('poster-lit.jpg', 300)):
        # the SAME grade as the ladder — a reduced-motion reader and a
        # blocked script must not get a visibly different picture
        run(['ffmpeg', '-v', 'error', '-y', '-i', SRC,
             '-vf', (r"select='eq(n\,%d)',scale=1280:-2" % n) + ',' + GRADE,
             '-frames:v', '1', '-q:v', '3', os.path.join(OUT, name)])
        print('%-16s %6.0f KB' % (name, os.path.getsize(os.path.join(OUT, name)) / 1e3))

    # a 24px LQIP of the empty room, inlined so the stage is never a blank box
    tmp = os.path.join(OUT, '_lqip.webp')
    run(['ffmpeg', '-v', 'error', '-y', '-i', SRC,
         '-vf', r"select='eq(n\,0)',scale=24:-2", '-frames:v', '1',
         '-c:v', 'libwebp', '-q:v', '42', tmp])
    with open(tmp, 'rb') as fh:
        b64 = base64.b64encode(fh.read()).decode()
    os.remove(tmp)
    with open(os.path.join(OUT, 'lqip.txt'), 'w') as fh:
        fh.write('data:image/webp;base64,' + b64)
    print('lqip.txt         %6.0f B' % (len(b64) + 23))

    print()
    print('js/room-scrub.js must carry: TOTAL = %d, SCRUB = %d'
          % (len(want), scrub))


if __name__ == '__main__':
    main()
