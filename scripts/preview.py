#!/usr/bin/env python3
"""Local preview server. Use this instead of `python -m http.server`.

WHY THIS EXISTS. Python's `mimetypes` has no entry for `.webp` or `.woff2` on
Windows, so `python -m http.server` hands both out as
`application/octet-stream`. Chrome sniffs past that and renders them anyway,
which is exactly what makes it dangerous: the site looks perfect on the machine
it is being built on, and every strict client sees something else. The hero
descent is 434 WebP frames, so on a client that will not sniff, the entire
landing page is a dark rectangle.

The live origin does not have this problem — Cloudflare types WebP correctly —
so this is a preview-only trap, and it only bites when testing on a real
device over the LAN, which is the one time you cannot see the console.

Bound to 0.0.0.0 so a phone on the same Wi-Fi can reach it:

    python scripts/preview.py            # port 8010
    python scripts/preview.py 8020       # or any other

It prints the LAN URL to open on the phone.
"""

import functools
import http.server
import mimetypes
import os
import socket
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The whole point of the file.
mimetypes.add_type('image/webp', '.webp')
mimetypes.add_type('font/woff2', '.woff2')
mimetypes.add_type('image/avif', '.avif')
mimetypes.add_type('image/svg+xml', '.svg')
mimetypes.add_type('application/json', '.json')
mimetypes.add_type('text/javascript', '.js')


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Mirror the live origin's own policy: html always revalidates, assets
        # cache. Without the first, a phone shows you the previous edit while
        # you wonder why nothing changed; without the second, every reload
        # re-pulls 434 frames over Wi-Fi and the slowness reads as a hang.
        path = self.path.split('?')[0]
        if path.endswith('.html') or path.endswith('/'):
            self.send_header('Cache-Control', 'no-store')
        else:
            self.send_header('Cache-Control', 'public, max-age=3600')
        super().end_headers()

    def log_message(self, fmt, *args):
        # Every request, with the client address. When testing on a real
        # device the single most useful question is "did the phone reach the
        # server at all", and a silent log cannot answer it: a hang caused by
        # iOS withholding Local Network permission looks identical, from the
        # phone, to a hang caused by the page.
        code = args[1] if len(args) > 1 else ''
        sys.stdout.write('  %-15s %s %s\n'
                         % (self.client_address[0], code, args[0]))
        sys.stdout.flush()


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        s.close()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8010
    handler = functools.partial(Handler, directory=ROOT)
    srv = http.server.ThreadingHTTPServer(('0.0.0.0', port), handler)
    ip = lan_ip()
    print('serving %s' % ROOT)
    print('  this machine : http://localhost:%d/' % port)
    print('  same Wi-Fi   : http://%s:%d/' % (ip, port))
    print('  webp -> %s   woff2 -> %s'
          % (mimetypes.guess_type('x.webp')[0], mimetypes.guess_type('x.woff2')[0]))
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
