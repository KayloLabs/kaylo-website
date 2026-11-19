import type { MetadataRoute } from 'next';
import { canonicalSiteOrigin, publicPagePaths, sitemapImages } from '../lib/site-metadata';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPagePaths.map(path => {
    const images = sitemapImages[path]?.map(image => new URL(image, canonicalSiteOrigin).toString());
    return { url: new URL(path, canonicalSiteOrigin).toString(), ...(images ? { images } : {}) };
  });
}
