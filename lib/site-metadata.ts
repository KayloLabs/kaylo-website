// Canonical URLs stay on the public domain in both the root and Pages exports.
// Asset/link routing remains independent through NEXT_PUBLIC_BASE_PATH.
export const canonicalSiteOrigin = 'https://kaylo.in';
export const publicPagePaths = [
  '/', '/about/', '/services/', '/professionals/', '/pricing/', '/contact/',
  '/download/', '/privacy/', '/account-deletion/', '/terms/', '/refund-policy/',
] as const;

export function canonicalMetadata(path: typeof publicPagePaths[number]) {
  return { alternates: { canonical: new URL(path, canonicalSiteOrigin).toString() } };
}
