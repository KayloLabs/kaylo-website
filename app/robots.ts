import type { MetadataRoute } from 'next';
import { canonicalSiteOrigin } from '../lib/site-metadata';
import { sitePath } from '../lib/site-path';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: sitePath('/'),
      disallow: [sitePath('/admin/'), sitePath('/application/update/')],
    },
    sitemap: `${canonicalSiteOrigin}/sitemap.xml`,
  };
}
