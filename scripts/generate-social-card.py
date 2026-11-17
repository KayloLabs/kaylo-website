#!/usr/bin/env python3
"""Render Kaylo's 1200x630 sharing card from official artwork and local fonts.

Requires librsvg and fontconfig, with no Python dependencies. Fontconfig uses
only the repository's licensed fonts and a temporary cache, never system state.
The checked-in SVG preserves the editable artwork; PNG is the sharing asset.
"""
from pathlib import Path
import os
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
NS = '{http://www.w3.org/2000/svg}'


def paths(filename):
    root = ET.parse(PUBLIC / 'brand' / filename).getroot()
    return ''.join(f'<path d="{element.attrib["d"]}"/>' for element in root.iter(NS + 'path'))


def card_svg():
    wordmark = paths('logo-text.svg')
    mark = paths('logo-loop.svg') + paths('logo-dot.svg')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<title>Kaylo — Skilled people. Right when you need them.</title>
<desc>Kaylo connects people with local professionals for Home, Farm and Care.</desc>
<rect width="1200" height="630" fill="#f8f7f1"/>
<svg x="67" y="46" width="172" height="58" viewBox="280 550 460 145" fill="#264d36">{wordmark}</svg>
<svg x="1032" y="50" width="90" height="57" viewBox="365 330 286 180" fill="#264d36">{mark}</svg>
<g font-family="Plus Jakarta Sans" font-size="76" font-weight="600" letter-spacing="-3.4" fill="#202b23">
<text x="80" y="232">Skilled people.</text>
<text x="80" y="326">Right when</text>
<text x="80" y="420" fill="#264d36">you need them.</text>
</g>
<path d="M80 494H1120" stroke="#cfd7c8" stroke-width="1"/>
<g font-family="Hanken Grotesk" font-weight="500" font-size="23" fill="#264d36">
<text x="80" y="554" letter-spacing="2.5">HOME</text>
<circle cx="182" cy="546" r="2.5" fill="#8d9f72"/>
<text x="210" y="554" letter-spacing="2.5">FARM</text>
<circle cx="313" cy="546" r="2.5" fill="#8d9f72"/>
<text x="341" y="554" letter-spacing="2.5">CARE</text>
<text x="1120" y="554" text-anchor="end">kaylo.in</text>
</g>
</svg>\n'''


def main():
    renderer = shutil.which('rsvg-convert')
    if not renderer:
        raise SystemExit('Install librsvg to provide rsvg-convert')
    svg = card_svg()
    destination = PUBLIC / 'images'
    (destination / 'kaylo-social.svg').write_text(svg)
    with tempfile.TemporaryDirectory(prefix='kaylo-social-fonts-') as temporary:
        directory = Path(temporary)
        config = directory / 'fonts.conf'
        config.write_text(f'''<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig><dir>{escape(str(PUBLIC / 'fonts'))}</dir><cachedir>{escape(str(directory / 'cache'))}</cachedir></fontconfig>''')
        env = os.environ.copy()
        env['FONTCONFIG_FILE'] = str(config)
        subprocess.run([renderer, '--width', '1200', '--height', '630', '--output',
                        str(destination / 'kaylo-social.png')], input=svg, text=True,
                       check=True, env=env)
    print('Rendered Kaylo social card: 1200x630 PNG and editable SVG.')


if __name__ == '__main__':
    main()
