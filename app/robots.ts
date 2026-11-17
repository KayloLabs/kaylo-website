import type { MetadataRoute } from 'next';
import { canonicalSiteOrigin } from '../lib/site-metadata';
import { sitePath } from '../lib/site-path';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: sitePath('/'),
      // Let crawlers read the private pages’ noindex metadata. Authentication
      // protects data; robots.txt is not an access-control mechanism.
      disallow: [sitePath('/api/')],
    },
    sitemap: `${canonicalSiteOrigin}/sitemap.xml`,
  };
}
