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
  await writeFile(path.join(root,'out/index.html'),'<html><head></head><body><main>Kaylo</main></body></html>');
  await writeFile(path.join(root,'out/404.html'),'<html><head></head><body>Page not found</body></html>');
  await mkdir(path.join(root,'out/services'));
  await writeFile(path.join(root,'out/services/index.html'),'<html><head></head><body>Kaylo services</body></html>');
  await writeFile(path.join(root,'out/services/index.txt'),'Next navigation data');
  await writeFile(path.join(root,'out/style.css'),'body{color:green}');
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
 const home=await worker.fetch(new Request('https://kaylo.in/'),{});
 assert.match(await home.text(),/data-kaylo-csp/);
 assert.equal(home.headers.get('X-Frame-Options'),'DENY');
 await assert.rejects(readFile(path.join(root,'dist/client/index.html')),/ENOENT/);
 await assert.rejects(readFile(path.join(root,'dist/client/services/index.html')),/ENOENT/);
 await assert.rejects(readFile(path.join(root,'dist/client/404.html')),/ENOENT/);
 assert.equal(await readFile(path.join(root,'dist/client/services/index.txt'),'utf8'),'Next navigation data');
 assert.equal(await readFile(path.join(root,'dist/client/style.css'),'utf8'),'body{color:green}');
 assert.equal(JSON.parse(await readFile(path.join(root,'dist/server/wrangler.json'),'utf8')).assets.run_worker_first,true);
 assert.equal(JSON.parse(await readFile(path.join(root,'dist/.openai/hosting.json'),'utf8')).d1,'DB');
 assert.equal(JSON.parse(await readFile(path.join(root,'dist/server/wrangler.json'),'utf8')).d1_databases[0].binding,'DB');
 // Missing pages get the designed 404.html with a 404 status, not an empty body.
 assert.equal(JSON.parse(await readFile(path.join(root,'dist/server/wrangler.json'),'utf8')).assets.not_found_handling,'none');
 assert.deepEqual(JSON.parse(await readFile(path.join(root,'dist/server/wrangler.json'),'utf8')).compatibility_flags,['assets_navigation_has_no_effect']);
 assert.equal(await readFile(path.join(root,'dist/.openai/drizzle/0000.sql'),'utf8'),'-- Existing D1 migration');
}));

test('asset-first hosting cannot bypass www redirects for exported pages or browser navigations',()=>fixture(async root=>{
 await buildWorker(root);
 const source=await readFile(path.join(root,'dist/server/index.js'),'utf8');
 const {default:worker}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
 const assetFetch=async request=>{
  const pathname=new URL(request.url).pathname;
  try{return new Response(await readFile(path.join(root,'dist/client',pathname,pathname.endsWith('/')?'index.html':'')));}
  catch{return new Response(null,{status:404});}
 };
 // Model the production bug: a matching file is returned before the Worker.
 const dispatch=async request=>{
  const asset=await assetFetch(request);
  return asset.status===404?worker.fetch(request,{ASSETS:{fetch:assetFetch}}):asset;
 };
 for(const protocol of ['http:','https:'])for(const method of ['GET','HEAD'])for(const pathname of ['/','/services','/services/','/services/index.html','/404.html','/missing/']){
  const suffix='?utm_source=redirect-test&next=%2Fdownload%2F';
  const response=await dispatch(new Request(`${protocol}//www.kaylo.in${pathname}${suffix}`,{method,headers:{'Sec-Fetch-Mode':'navigate'}}));
  assert.equal(response.status,301,`${method} ${protocol} ${pathname}`);
  assert.equal(response.headers.get('Location'),`https://kaylo.in${pathname}${suffix}`);
 }
 const page=await dispatch(new Request('https://kaylo.in/services/'));
 assert.equal(page.status,200);
 assert.match(await page.text(),/Kaylo services/);
 for(const path of ['/services','/services/index.html']){
  const response=await dispatch(new Request(`https://kaylo.in${path}?ref=card`));
  assert.equal(response.status,308);
  assert.equal(response.headers.get('Location'),'https://kaylo.in/services/?ref=card');
 }
 for(const pathname of ['/missing/','/404/','/404.html']){
  const response=await dispatch(new Request(`https://kaylo.in${pathname}`));
  assert.equal(response.status,404);
  assert.match(await response.text(),/Page not found/);
 }
 const head=await dispatch(new Request('https://kaylo.in/services/',{method:'HEAD'}));
 assert.equal(head.status,200);
 assert.equal(await head.text(),'');
 const cached=await dispatch(new Request('https://kaylo.in/services/',{headers:{'If-None-Match':`"old", W/${page.headers.get('ETag')}`}}));
 assert.equal(cached.status,304);
 assert.equal(await cached.text(),'');
 assert.equal(cached.headers.get('ETag'),page.headers.get('ETag'));
 const updated=await dispatch(new Request('https://kaylo.in/services/',{headers:{'If-None-Match':'"old"'}}));
 assert.equal(updated.status,200);
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
