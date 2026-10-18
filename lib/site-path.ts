/** Prefix plain HTML links and public assets. Next Link already adds basePath. */
export function sitePath(path: string, configuredBase = process.env.NEXT_PUBLIC_BASE_PATH ?? ''): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  const base = configuredBase.trim().replace(/\/+$/, '');
  if (!base) return path;
  if (!/^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(base)) {
    throw new Error('NEXT_PUBLIC_BASE_PATH must be a path such as /kaylo-website.');
  }
  if (path === base || path.startsWith(`${base}/`) || path.startsWith(`${base}?`) || path.startsWith(`${base}#`)) return path;
  return `${base}${path}`;
}
