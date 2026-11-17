import {writeFile,readFile} from 'node:fs/promises';
import {verifySeo} from './verify-seo.mjs';
import {verifyPagesExport,verifyPublicConfig} from './verify-pages.mjs';
// Publish only the verified static export, never source, server credentials or APKs.
verifyPublicConfig(JSON.parse(await readFile('server/kaylo-public-config.json','utf8')));
await writeFile('out/.nojekyll','');
const result=await verifyPagesExport('out',{basePath:(process.env.NEXT_PUBLIC_BASE_PATH??'').replace(/\/+$/,'')});
console.log(`GitHub Pages export ready: ${result.routes} routes, ${result.files} files in out/.`);

const seo=await verifySeo('out');
console.log(`SEO export verified: ${seo.publicPages} public pages, brand schemas, social previews and browser icons.`);
