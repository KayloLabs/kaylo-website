import type { MetadataRoute } from 'next';
import { canonicalSiteOrigin, publicPagePaths } from '../lib/site-metadata';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPagePaths.map(path => ({ url: new URL(path, canonicalSiteOrigin).toString() }));
}
