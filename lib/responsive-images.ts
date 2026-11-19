import { sitePath } from './site-path';

// Pre-generated files work on both static GitHub Pages and Sites, without an
// image server. The original src stays available as the fallback and SEO URL.
function candidates(name: string, widths: readonly number[]) {
  return widths.map(width => `${sitePath(`/optimized/${name}-${width}.webp`)} ${width}w`).join(', ');
}

export function previewArt(name: string, displayWidth = 100) {
  const widths = name === 'hero_coconut_climber_clay_v2' ? [192, 384, 512] : [128, 256, 384];
  return {
    src: sitePath(`/app-art/${name}.png`),
    srcSet: candidates(name, widths),
    sizes: `${displayWidth}px`,
    loading: 'lazy' as const,
    decoding: 'async' as const,
  };
}

export function photoSources(name: 'craftsman' | 'neighbourhood', sizes: string) {
  return {
    src: sitePath(`/images/${name}.jpg`),
    srcSet: candidates(name, [640, 1024, name === 'craftsman' ? 1448 : 1536]),
    sizes,
    decoding: 'async' as const,
  };
}
