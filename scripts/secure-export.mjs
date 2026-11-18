import {createHash} from 'node:crypto';
import {readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const digest = text => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;
export function contentPolicy(html, config) {
 const backend = new URL(config.supabaseUrl);
 if (backend.protocol !== 'https:' || backend.username || backend.password || backend.search || backend.hash) throw new Error('Invalid CSP backend origin');
 const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
  .filter(([, attributes]) => !/\bsrc\s*=/i.test(attributes)).map(([, , code]) => digest(code));
 return ["default-src 'none'", "base-uri 'none'", "object-src 'none'", "form-action 'self'",
  `script-src 'self' ${[...new Set(hashes)].join(' ')}`.trim(), "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'", "font-src 'self'", `img-src 'self' data: blob: ${backend.origin}`,
  "media-src 'self' blob:", `connect-src 'self' ${backend.origin} https://identitytoolkit.googleapis.com https://securetoken.googleapis.com`,
  `frame-src 'self' blob: ${backend.origin}`, "manifest-src 'self'", "worker-src 'self' blob:"
 ].join('; ');
}
export function secureHtml(html, config) {
 if (!/<head(?:\s[^>]*)?>/i.test(html)) throw new Error('Static page is missing its head');
 // Hash each page's actual Next bootstrap and JSON-LD, never unsafe-inline scripts.
 const without = html.replace(/<meta\b[^>]*\bdata-kaylo-csp[^>]*>/gi, '');
 const policy = contentPolicy(without, config).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
 return without.replace(/<head(?:\s[^>]*)?>/i, head => `${head}<meta data-kaylo-csp http-equiv="Content-Security-Policy" content="${policy}">`);
}
export function verifyHtmlSecurity(html, config) {
 const meta = html.match(/<meta\b[^>]*\bdata-kaylo-csp[^>]*>/i)?.[0];
 const actual = meta?.match(/\bcontent="([^"]*)"/i)?.[1]?.replaceAll('&quot;', '"').replaceAll('&amp;', '&');
 if (!meta || !/http-equiv="Content-Security-Policy"/i.test(meta) || actual !== contentPolicy(html, config)) throw new Error('Missing or stale static Content Security Policy');
 const head = html.search(/<head(?:\s[^>]*)?>/i), firstScript = html.search(/<script\b/i);
 if (head < 0 || (firstScript >= 0 && html.indexOf(meta) > firstScript)) throw new Error('CSP must precede all scripts');
}
export async function secureExport(directory, config) {
 let pages = 0;
 async function walk(folder) {
  for (const entry of await readdir(folder, {withFileTypes: true})) {
   const file = path.join(folder, entry.name);
   if (entry.isSymbolicLink()) throw new Error('Export must not contain symlinks');
   if (entry.isDirectory()) await walk(file);
   else if (entry.name.endsWith('.html')) {
    const secured = secureHtml(await readFile(file, 'utf8'), config);
    verifyHtmlSecurity(secured, config);
    await writeFile(file, secured); pages++;
   }
  }
 }
 await walk(directory);
 return pages;
}
