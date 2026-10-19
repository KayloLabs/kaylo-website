import {writeFile, readFile, access} from 'node:fs/promises';
// Publish only the static export, never the private source tree or server credentials.
for (const route of ['index.html','admin/index.html','application/update/index.html','professionals/index.html','services/index.html','download/index.html']) {
  await access(`out/${route}`);
}
const config=JSON.parse(await readFile('server/kaylo-public-config.json','utf8'));
const claims=JSON.parse(Buffer.from(config.supabaseAnonKey.split('.')[1],'base64url').toString());
if (claims.role !== 'anon') throw new Error('Only the public Supabase anon key may be exported.');
await writeFile('out/.nojekyll','');
console.log('GitHub Pages export ready in out/.');
