import {mkdir, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

// Regenerate the checked-in responsive assets from the untouched originals.
// Run with the repository's installed Sharp version: node scripts/optimize-marketing-images.mjs
const root = fileURLToPath(new URL('../', import.meta.url));
const outputDirectory = path.join(root, 'public/optimized');
const icons = [
  'mode_home', 'mode_farm', 'mode_care', 'icon_electric', 'icon_plumb',
  'icon_carpentry', 'icon_coconut', 'icon_garden',
];
const artwork = [
  ...icons.map(name => ({name, widths: [128, 256, 384]})),
  {name: 'hero_coconut_climber_clay_v2', widths: [192, 384, 512]},
];
const photos = [
  {name: 'craftsman', widths: [640, 1024, 1448]},
  {name: 'neighbourhood', widths: [640, 1024, 1536]},
];

await mkdir(outputDirectory, {recursive: true});
const generated = [];
for (const [kind, sources] of [['art', artwork], ['photo', photos]]) {
  for (const {name, widths} of sources) {
    const input = path.join(root, 'public', kind === 'art' ? 'app-art' : 'images', `${name}.${kind === 'art' ? 'png' : 'jpg'}`);
    const metadata = await sharp(input).metadata();
    if (!metadata.width || widths.some(width => width > metadata.width)) {
      throw new Error(`Requested dimensions exceed the original image: ${input}`);
    }
    for (const width of widths) {
      const output = path.join(outputDirectory, `${name}-${width}.webp`);
      const info = await sharp(input)
        .resize({width, withoutEnlargement: true})
        .webp(kind === 'art' ? {lossless: true, effort: 6} : {quality: 90, effort: 6})
        .toFile(output);
      generated.push({name, width: info.width, height: info.height, bytes: info.size});
      console.log(`${path.relative(root, output)}: ${info.width}x${info.height}, ${info.size} bytes`);
    }
  }
}

// A conservative comparison: the largest variant for each initially visible
// Home-tab image. Browsers can select smaller files through srcset and sizes.
const initialHome = [
  'hero_coconut_climber_clay_v2', 'mode_home', 'mode_farm', 'mode_care',
  'icon_electric', 'icon_plumb', 'icon_carpentry',
];
let originalBytes = 0;
let optimizedBytes = 0;
for (const name of initialHome) {
  originalBytes += (await stat(path.join(root, 'public/app-art', `${name}.png`))).size;
  optimizedBytes += generated.filter(item => item.name === name).at(-1).bytes;
}
console.log(JSON.stringify({
  imagesGenerated: generated.length,
  initialHome: {originalBytes, largestVariantBytes: optimizedBytes, reductionPercent: Number(((1 - optimizedBytes / originalBytes) * 100).toFixed(1))},
}, null, 2));
