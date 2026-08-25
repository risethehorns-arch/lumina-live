# -*- coding: utf-8 -*-
"""Every district figure on the site, against the data that should produce it.

The district pages carry their counts, medians, ranges and mixes as STATIC
literals and nothing rewrites them at runtime — only `areas.html`'s
`[data-count]` is corrected live. So a re-import silently makes them wrong,
which is exactly what happened on 2026-08-22 and was still wrong three days
later: Abdoun printed 68 residences against 75, the Circles 14 against 17.

Run this after ANY change to data/lumina-demo-leads.json:

    python scripts/check-area-figures.py

It reports; it does not edit. Exit code 1 if anything disagrees.
"""
import collections
import io
import json
import os
import re
import statistics
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data', 'lumina-demo-leads.json')

GROUPS = {
    'Abdoun':  (['Abdoun'], 'areas-abdoun.html'),
    'Circles': (['1st Circle', '2nd Circle', '3rd Circle', '4th Circle',
                 '5th Circle', 'The Circles', '4th-5th Circle'],
                'areas-circles.html'),
    'Swefieh': (['Swefieh'], 'areas-swefieh.html'),
}
bad = []


def money(v):
    return '{:,.0f}'.format(v)


def figures(recs):
    rent = [x for x in recs if x['transaction'] == 'Rent']
    sale = [x for x in recs if x['transaction'] != 'Rent']
    # a rent only counts toward a median or a range if it is a rent we would
    # print — flagged and per-m² records render "Price on request"
    pr = sorted(x['price_jod_raw'] for x in rent
                if x.get('price_jod_raw') and not x.get('needs_price_review')
                and x.get('price_unit') != 'per_sqm')
    sz = [x['size_sqm'] for x in recs if x.get('size_sqm')]
    mix = collections.Counter(x['property_type'] for x in recs)
    return {
        'Residences listed': str(len(recs)),
        'To rent / to buy': '%d / %d' % (len(rent), len(sale)),
        'Typical annual rent': money(statistics.median(pr)) + ' JOD',
        'Rental range': '%s – %s JOD' % (money(pr[0]), money(pr[-1])),
        'Typical size': '%.0f m²' % statistics.median(sz),
        '_apartments': mix.get('Apartment', 0),
        '_n': len(recs), '_rent': len(rent), '_sale': len(sale),
    }


def main():
    d = json.load(io.open(DATA, encoding='utf-8'))
    print('%d records' % len(d))

    for name, (keys, page) in GROUPS.items():
        recs = [x for x in d if x['location'] in keys]
        want = figures(recs)
        s = io.open(os.path.join(ROOT, page), encoding='utf-8').read()
        print()
        print('== %s  (%s) ==' % (name, page))
        for label in ('Residences listed', 'To rent / to buy',
                      'Typical annual rent', 'Rental range', 'Typical size'):
            m = re.search(r'<li><span>%s</span><b>([^<]*)</b></li>'
                          % re.escape(label), s)
            got = m.group(1).strip() if m else '(not found)'
            ok = got == want[label]
            if not ok:
                bad.append('%s / %s: page %r, data %r' % (page, label, got, want[label]))
            print('   %-20s %-24s %s' % (label, got,
                                         'OK' if ok else '<-- data says ' + want[label]))
        # the mix line and the prose repeat the same two numbers
        mm = re.search(r'<li><span>Mix</span><b>(\d+) apartments', s)
        if mm:
            got = int(mm.group(1))
            ok = got == want['_apartments']
            if not ok:
                bad.append('%s / mix: page %d apartments, data %d'
                           % (page, got, want['_apartments']))
            print('   %-20s %-24s %s' % ('Mix (apartments)', got,
                                         'OK' if ok else '<-- data says %d' % want['_apartments']))
        # any bare "N residences" in the prose
        for pm in re.finditer(r'(\d+) of the (\d+) residences', s):
            a, b = int(pm.group(1)), int(pm.group(2))
            ok = (a == want['_apartments'] and b == want['_n'])
            if not ok:
                bad.append('%s / prose: "%d of the %d", data "%d of the %d"'
                           % (page, a, b, want['_apartments'], want['_n']))
            print('   %-20s %-24s %s' % ('prose "N of the M"', '%d of the %d' % (a, b),
                                         'OK' if ok else '<-- data says %d of the %d'
                                         % (want['_apartments'], want['_n'])))
        for pm in re.finditer(r'hold (\d+) residences across (?:them|the Circles) — (\d+) to rent and (\d+) to buy', s):
            got = tuple(int(x) for x in pm.groups())
            exp = (want['_n'], want['_rent'], want['_sale'])
            ok = got == exp
            if not ok:
                bad.append('%s / prose: %s, data %s' % (page, got, exp))
            print('   %-20s %-24s %s' % ('prose "N — R rent / S buy"', str(got),
                                         'OK' if ok else '<-- data says ' + str(exp)))

    # ── the insights pages quote the same district counts ──────────────
    print()
    print('== insights ==')
    counts = collections.Counter(x['location'] for x in d)
    circles = sum(v for k, v in counts.items() if 'Circle' in k)
    CLAIMS = [
        ('insights/best-areas-in-amman.html',
         r'— (\d+) residences with us, the largest share', counts['Abdoun']),
        ('insights/best-areas-in-amman.html',
         r'— (\d+) residences, and the only part of the portfolio', circles),
        ('insights/best-areas-in-amman.html',
         r'\(4 of (\d+)\)', circles),
        ('insights/amman-circles-guide.html',
         r'hold (\d+) residences across them', circles),
    ]
    for page, pat, exp in CLAIMS:
        s = io.open(os.path.join(ROOT, page), encoding='utf-8').read()
        m = re.search(pat, s)
        got = int(m.group(1)) if m else None
        ok = got == exp
        if not ok:
            bad.append('%s: %r found %s, data %s' % (page, pat, got, exp))
        print('   %-42s %-6s %s' % (os.path.basename(page) + ' ' + pat[:22],
                                    got, 'OK' if ok else '<-- data says %d' % exp))

    print()
    if bad:
        print('%d figure(s) disagree with the data:' % len(bad))
        for b in bad:
            print('   ' + b)
        raise SystemExit(1)
    print('every district figure agrees with the data')


if __name__ == '__main__':
    main()
