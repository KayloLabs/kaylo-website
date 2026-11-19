import type { Metadata } from 'next';

// Canonical URLs stay on the public domain in both root and Pages exports.
// Asset/link routing remains independent through NEXT_PUBLIC_BASE_PATH.
export const canonicalSiteOrigin = 'https://kaylo.in';
// Official profiles supplied by Kaylo. Use canonical URLs without share tracking.
export const officialProfiles = [
  { name: 'LinkedIn', url: 'https://www.linkedin.com/company/kayloapp/' },
  { name: 'Instagram', url: 'https://www.instagram.com/kaylo_app/' },
] as const;
export const publicPagePaths = [
  '/', '/about/', '/services/', '/professionals/', '/pricing/', '/contact/',
  '/download/', '/privacy/', '/account-deletion/', '/terms/', '/refund-policy/',
] as const;

// Meaningful images on each page, listed in the sitemap so Google Images can
// find them. Decorative icons with empty alt text are left out on purpose.
export const sitemapImages: Partial<Record<(typeof publicPagePaths)[number], readonly string[]>> = {
  '/': [
    '/images/kaylo-social.png',
    '/app-art/hero_coconut_climber_clay_v2.png',
    '/images/craftsman.jpg',
    '/images/neighbourhood.jpg',
  ],
  '/professionals/': ['/images/craftsman.jpg'],
};

export type PublicPagePath = typeof publicPagePaths[number];

export const publicPages: Record<PublicPagePath, { title: string; description: string }> = {
  "/": {
    title: "Kaylo | Local Services for Home, Farm & Care in Kerala",
    description: "Find and book local professionals for home repairs, farm work and care with Kaylo, a Kerala-rooted service marketplace. Availability varies by area.",
  },
  "/about/": {
    title: "About Kaylo | Home, Farm and Care",
    description: "Kaylo is a Kerala-rooted local services platform connecting customers with professionals for home, farm and care needs.",
  },
  "/services/": {
    title: "Home, Farm & Care services | Kaylo",
    description: "Explore local electricians, plumbers, cleaners, farm support and care services on Kaylo.",
  },
  "/professionals/": {
    title: "Join as a professional | Kaylo",
    description: "Bring your skill to Kaylo. Apply to connect with local customers for home, farm and care services.",
  },
  "/pricing/": {
    title: "Pricing and payment information | Kaylo",
    description: "How Kaylo shows service prices, booking totals, offers and payment options before you request a professional.",
  },
  "/contact/": {
    title: "Contact and support | Kaylo",
    description: "Contact Kaylo about a booking, payment, professional application, account or privacy request.",
  },
  "/download/": {
    title: "Download Kaylo & Kaylo Partner | Kaylo",
    description: "Download the Kaylo customer and partner Android apps with your download password.",
  },
  "/privacy/": {
    title: "Privacy policy | Kaylo and Kaylo Partner",
    description: "How Kaylo and Kaylo Partner use, share and retain your information, and how to request account deletion.",
  },
  "/account-deletion/": {
    title: "Request account deletion | Kaylo and Kaylo Partner",
    description: "Request deletion of your Kaylo or Kaylo Partner account and associated data without reinstalling the app.",
  },
  "/terms/": {
    title: "Terms of service | Kaylo",
    description: "Terms for using Kaylo and Kaylo Partner, including booking acceptance, payments, cancellations, professional responsibilities and support.",
  },
  "/refund-policy/": {
    title: "Cancellation and refund policy | Kaylo",
    description: "When Kaylo bookings can be cancelled, how online refunds are processed, and how to get help with cash payments or service disputes.",
  },
};

export const socialImage = {
  url: `${canonicalSiteOrigin}/images/kaylo-social.png`,
  width: 1200,
  height: 630,
  alt: 'Kaylo. Skilled people. Right when you need them. Home, Farm and Care.',
  type: 'image/png',
};

export function canonicalMetadata(path: PublicPagePath) {
  const { title, description } = publicPages[path];
  const url = new URL(path, canonicalSiteOrigin).toString();
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website' as const,
      locale: 'en_IN',
      siteName: 'Kaylo',
      url, title, description,
      images: [socialImage],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title, description,
      images: [{ url: socialImage.url, alt: socialImage.alt }],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' as const },
    },
  } satisfies Metadata;
}

export const homeStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${canonicalSiteOrigin}/#organization`,
      name: 'Kaylo',
      url: `${canonicalSiteOrigin}/`,
      email: 'kayloapp@gmail.com',
      logo: {
        '@type': 'ImageObject',
        url: `${canonicalSiteOrigin}/icons/kaylo-mark-v2-512.png`,
        width: 512,
        height: 512,
      },
      description: 'A Kerala-rooted local services platform connecting customers with professionals for home, farm and care needs.',
      sameAs: officialProfiles.map(profile => profile.url),
    },
    {
      '@type': 'WebSite',
      '@id': `${canonicalSiteOrigin}/#website`,
      name: 'Kaylo',
      url: `${canonicalSiteOrigin}/`,
      inLanguage: 'en-IN',
      publisher: { '@id': `${canonicalSiteOrigin}/#organization` },
    },
  ],
};

// Only emit this where the same two-level breadcrumb is visible on the page.
export function breadcrumbStructuredData(path: '/services/' | '/download/') {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Kaylo', item: `${canonicalSiteOrigin}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: path === '/services/' ? 'Services' : 'Download',
        item: new URL(path, canonicalSiteOrigin).toString(),
      },
    ],
  };
}

export function serializeStructuredData(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}
