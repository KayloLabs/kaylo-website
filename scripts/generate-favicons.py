#!/usr/bin/env python3
"""Render the official Kaylo mark into browser icons (no third-party Python deps).

Requires rsvg-convert (librsvg). The outputs are checked in, so this is not a
build dependency. Preserve previous versioned assets for cached pages. The ICO
uses classic 32-bit bitmap frames for browsers that do not decode PNG-in-ICO.
"""
from pathlib import Path
import shutil
import struct
import subprocess
import xml.etree.ElementTree as ET
import zlib

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
OUTPUT = PUBLIC / 'icons'
VERSION = 'v2'
GREEN = '#264d36'
CREAM = '#f8f7f1'
NS = '{http://www.w3.org/2000/svg}'


def brand_paths(name):
    source = ET.parse(PUBLIC / 'brand' / name).getroot()
    return [node.attrib['d'] for node in source.iter(NS + 'path')]


def icon_svg(*, square=False, mask=False):
    paths = brand_paths('logo-loop.svg') + brand_paths('logo-dot.svg')
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


def png_rgba(png):
    """Decode the small, non-interlaced RGB/RGBA PNGs emitted by librsvg."""
    if png[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('Expected PNG input')
    pos, compressed = 8, bytearray()
    while pos < len(png):
        length = struct.unpack_from('>I', png, pos)[0]
        kind, data = png[pos+4:pos+8], png[pos+8:pos+8+length]
        if kind == b'IHDR':
            width, height, depth, color, compression, filtering, interlace = struct.unpack('>IIBBBBB', data)
        elif kind == b'IDAT':
            compressed.extend(data)
        pos += length + 12
    if depth != 8 or color not in (2, 6) or compression or filtering or interlace:
        raise ValueError('Expected 8-bit, non-interlaced RGB/RGBA PNG')
    channels = 4 if color == 6 else 3
    stride = width * channels
    raw = zlib.decompress(compressed)
    if len(raw) != height * (stride + 1):
        raise ValueError('Unexpected PNG scanline length')
    rows, previous = [], bytearray(stride)
    for row_index in range(height):
        start = row_index * (stride + 1)
        mode, row = raw[start], bytearray(raw[start+1:start+1+stride])
        if mode not in range(5):
            raise ValueError('Invalid PNG filter')
        for i in range(stride):
            left = row[i-channels] if i >= channels else 0
            above = previous[i]
            upper_left = previous[i-channels] if i >= channels else 0
            if mode == 1: prediction = left
            elif mode == 2: prediction = above
            elif mode == 3: prediction = (left + above) // 2
            elif mode == 4:
                p = left + above - upper_left
                distances = (abs(p-left), abs(p-above), abs(p-upper_left))
                prediction = (left, above, upper_left)[distances.index(min(distances))]
            else: prediction = 0
            row[i] = (row[i] + prediction) & 255
        previous = row
        if channels == 3:
            row = bytearray(value for i in range(0, len(row), 3) for value in (*row[i:i+3], 255))
        rows.append(row)
    return width, height, rows


def bitmap_frame(png):
    width, height, rows = png_rgba(png)
    mask_stride = ((width + 31) // 32) * 4
    pixels, mask = bytearray(), bytearray()
    for row in reversed(rows):
        mask_row = bytearray(mask_stride)
        for x in range(width):
            r, g, b, a = row[x*4:x*4+4]
            pixels.extend((b, g, r, a))
            if a == 0:
                mask_row[x // 8] |= 1 << (7 - x % 8)
        mask.extend(mask_row)
    header = struct.pack('<IiiHHIIiiII', 40, width, height*2, 1, 32, 0,
                         len(pixels) + len(mask), 0, 0, 0, 0)
    return header + pixels + mask


def main():
    renderer = shutil.which('rsvg-convert')
    if not renderer:
        raise SystemExit('Install librsvg to provide rsvg-convert')
    OUTPUT.mkdir(exist_ok=True)
    svg = icon_svg()
    (OUTPUT / f'kaylo-mark-{VERSION}.svg').write_text(svg)
    (PUBLIC / 'favicon.svg').write_text(svg)
    (OUTPUT / f'kaylo-mask-{VERSION}.svg').write_text(icon_svg(mask=True))
    sizes = (16, 32, 48, 96, 192, 512)
    for size in sizes:
        render(renderer, svg, size, OUTPUT / f'kaylo-mark-{VERSION}-{size}.png')
    render(renderer, icon_svg(square=True), 180, OUTPUT / f'kaylo-apple-touch-{VERSION}.png')
    frames = [(size, bitmap_frame((OUTPUT / f'kaylo-mark-{VERSION}-{size}.png').read_bytes())) for size in (16, 32, 48)]
    header = struct.pack('<HHH', 0, 1, len(frames))
    offset = 6 + 16 * len(frames)
    entries = []
    for size, bitmap in frames:
        entries.append(struct.pack('<BBBBHHII', size, size, 0, 0, 1, 32, len(bitmap), offset))
        offset += len(bitmap)
    ico = header + b''.join(entries) + b''.join(bitmap for _, bitmap in frames)
    (OUTPUT / f'kaylo-mark-{VERSION}.ico').write_bytes(ico)
    (PUBLIC / 'favicon.ico').write_bytes(ico)
    print(f'Rendered Kaylo {VERSION}: SVG, 16–512px PNG, bitmap ICO, Apple touch and Safari mask.')


if __name__ == '__main__':
    main()
