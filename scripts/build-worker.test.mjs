import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildWorker} from './build-worker.mjs';

const token=role=>`header.${Buffer.from(JSON.stringify({role})).toString('base64url')}.signature`;
const publicConfig={firebaseApiKey:'public-test-key',supabaseUrl:'https://example.supabase.co',supabaseAnonKey:token('anon')};
async function fixture(run){
 const root=await mkdtemp(path.join(tmpdir(),'kaylo-worker-build-'));
 try{
  for(const name of ['server','out','.openai','drizzle','dist'])await mkdir(path.join(root,name));
  await writeFile(path.join(root,'server/worker.mjs'),await readFile(new URL('../server/worker.mjs',import.meta.url)));
  await writeFile(path.join(root,'server/kaylo-public-config.json'),JSON.stringify(publicConfig));
  await writeFile(path.join(root,'out/index.html'),'<main>Kaylo</main>');
  await writeFile(path.join(root,'.openai/hosting.json'),JSON.stringify({project_id:'test-site',d1:'DB',r2:null}));
  await writeFile(path.join(root,'drizzle/0000.sql'),'-- Existing D1 migration');
  await writeFile(path.join(root,'dist/previous-build.txt'),'keep until inputs validate');
  await run(root);
 }finally{await rm(root,{recursive:true,force:true});}
}

test('built Worker is standalone ESM with validated public config and preserved assets/D1 binding',()=>fixture(async root=>{
 await buildWorker(root);
 const source=await readFile(path.join(root,'dist/server/index.js'),'utf8');
 assert.doesNotMatch(source,/\bimport\s/);
 assert.doesNotMatch(source,/kaylo-public-config\.json/);
 assert.deepEqual((await readdir(path.join(root,'dist/server'))).sort(),['index.js','wrangler.json']);
 // A data URL has no filesystem imports: successful import verifies standalone ESM.
 const {default:worker}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
 const response=await worker.fetch(new Request('https://kaylo.in/api/kaylo-config'),{SUPABASE_SERVICE_ROLE_KEY:'private-sentinel',APPLICATION_CORRECTION_SECRET:'private-sentinel'});
 assert.deepEqual(await response.json(),publicConfig);
 const asset=await worker.fetch(new Request('https://kaylo.in/professionals/'),{ASSETS:{fetch:()=>new Response('static-page')}});
 assert.equal(await asset.text(),'static-page');
 assert.equal(await readFile(path.join(root,'dist/client/index.html'),'utf8'),'<main>Kaylo</main>');
 assert.equal(JSON.parse(await readFile(path.join(root,'dist/.openai/hosting.json'),'utf8')).d1,'DB');
 assert.equal(JSON.parse(await readFile(path.join(root,'dist/server/wrangler.json'),'utf8')).d1_databases[0].binding,'DB');
 // Missing pages get the designed 404.html with a 404 status, not an empty body.
 assert.equal(JSON.parse(await readFile(path.join(root,'dist/server/wrangler.json'),'utf8')).assets.not_found_handling,'404-page');
 assert.equal(await readFile(path.join(root,'dist/.openai/drizzle/0000.sql'),'utf8'),'-- Existing D1 migration');
}));

test('extra fields and privileged keys fail before replacing a previous build',async()=>{
 for(const config of [{...publicConfig,serviceRoleKey:'private-sentinel'},{...publicConfig,supabaseAnonKey:token('service_role')}]){
  await fixture(async root=>{
   await writeFile(path.join(root,'server/kaylo-public-config.json'),JSON.stringify(config));
   await assert.rejects(buildWorker(root),/approved public connection fields|public Supabase anon key/);
   assert.equal(await readFile(path.join(root,'dist/previous-build.txt'),'utf8'),'keep until inputs validate');
  });
 }
});

test('changed configuration imports cannot silently ship an unresolved JSON module',()=>fixture(async root=>{
 await writeFile(path.join(root,'server/worker.mjs'),"import publicConfig from './other-config.json' with {type:'json'};\nexport default {};\n");
 await assert.rejects(buildWorker(root),/configuration import changed/);
 assert.equal(await readFile(path.join(root,'dist/previous-build.txt'),'utf8'),'keep until inputs validate');
}));
