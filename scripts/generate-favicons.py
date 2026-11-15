#!/usr/bin/env python3
"""Render the unchanged official Kaylo mark into browser icons.

Requires rsvg-convert (librsvg). Run from any directory. The checked-in output
is consumed by the static Pages build; this tool is not a build dependency.
Bump VERSION and layout metadata together when changing the artwork.
"""
from pathlib import Path
import shutil
import struct
import subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
OUTPUT = PUBLIC / 'icons'
VERSION = 'v1'
GREEN = '#264d36'
CREAM = '#f8f7f1'
NS = '{http://www.w3.org/2000/svg}'


def icon_svg(*, square=False, mask=False):
    # Preserve every path command/coordinate from the approved two-layer mark.
    paths = []
    for name in ('logo-loop.svg', 'logo-dot.svg'):
        source = ET.parse(PUBLIC / 'brand' / name).getroot()
        paths.extend(node.attrib['d'] for node in source.iter(NS + 'path'))
    if len(paths) != 2:
        raise ValueError('Expected the official loop and dot paths')
    background = '' if mask else (
        f'<rect width="64" height="64" rx="{0 if square else 12}" fill="{GREEN}"/>'
    )
    shapes = ''.join(f'<path d="{path}"/>' for path in paths)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">'
        '<title>Kaylo</title>' + background +
        '<svg x="4" y="14" width="56" height="36" viewBox="365 330 286 180">'
        f'<g fill="{"#000000" if mask else CREAM}">{shapes}</g></svg></svg>\n'
    )


def render(renderer, svg, size, output):
    subprocess.run([renderer, '--width', str(size), '--height', str(size),
                    '--output', str(output)], input=svg, text=True, check=True)


def main():
    renderer = shutil.which('rsvg-convert')
    if not renderer:
        raise SystemExit('Install librsvg to provide rsvg-convert')
    OUTPUT.mkdir(exist_ok=True)
    svg = icon_svg()
    (OUTPUT / f'kaylo-mark-{VERSION}.svg').write_text(svg)
    (PUBLIC / 'favicon.svg').write_text(svg)
    (OUTPUT / f'kaylo-mask-{VERSION}.svg').write_text(icon_svg(mask=True))
    sizes = (16, 32, 48)
    for size in sizes:
        render(renderer, svg, size, OUTPUT / f'kaylo-mark-{VERSION}-{size}.png')
    render(renderer, icon_svg(square=True), 180, OUTPUT / f'kaylo-apple-touch-{VERSION}.png')
    # ICO supports PNG image payloads. Include native-size frames instead of
    # asking a browser to shrink one large image into every tab/favicon slot.
    frames = [(size, (OUTPUT / f'kaylo-mark-{VERSION}-{size}.png').read_bytes()) for size in sizes]
    header = struct.pack('<HHH', 0, 1, len(frames))
    offset = 6 + 16 * len(frames)
    entries = []
    for size, png in frames:
        entries.append(struct.pack('<BBBBHHII', size, size, 0, 0, 1, 32, len(png), offset))
        offset += len(png)
    ico = header + b''.join(entries) + b''.join(png for _, png in frames)
    (OUTPUT / f'kaylo-mark-{VERSION}.ico').write_bytes(ico)
    (PUBLIC / 'favicon.ico').write_bytes(ico)
    print(f'Rendered official Kaylo {VERSION} icons: SVG, 16/32/48px PNG/ICO, 180px Apple touch, Safari mask.')


if __name__ == '__main__':
    main()
