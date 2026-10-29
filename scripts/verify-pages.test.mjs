import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {verifyPagesExport,verifyPublicConfig} from './verify-pages.mjs';
const routes=['index.html','admin/index.html','application/update/index.html','professionals/index.html','services/index.html','download/index.html'];
const html='<meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer"><main id="main"></main><a href="/kaylo-website/services/">Services</a><img src="/kaylo-website/image.svg">';
async function fixture(run){
 const root=await mkdtemp(path.join(tmpdir(),'kaylo-pages-test-'));
 try{
  for(const route of routes){await mkdir(path.dirname(path.join(root,route)),{recursive:true});await writeFile(path.join(root,route),html);}
  await writeFile(path.join(root,'.nojekyll'),'');await writeFile(path.join(root,'image.svg'),'<svg/>');
  await run(root);
 }finally{await rm(root,{recursive:true,force:true});}
}
test('valid project-path export passes without remote requests',()=>fixture(async root=>assert.equal((await verifyPagesExport(root)).routes,6)));
test('missing marker and broken project-root asset fail',async()=>{
 await fixture(async root=>{await rm(path.join(root,'.nojekyll'));await assert.rejects(verifyPagesExport(root),/marker/);});
 await fixture(async root=>{await writeFile(path.join(root,'index.html'),html+'<img src="/image.svg">');await assert.rejects(verifyPagesExport(root),/project path/);});
 await fixture(async root=>{await writeFile(path.join(root,'index.html'),html+'<img src="/kaylo-website/missing.png">');await assert.rejects(verifyPagesExport(root),/Broken local/);});
});
test('private source, symlinks and privileged tokens cannot enter a publish artifact',async()=>{
 await fixture(async root=>{await writeFile(path.join(root,'secret.ts'),'');await assert.rejects(verifyPagesExport(root),/Private source/);});
 await fixture(async root=>{await symlink('/tmp',path.join(root,'elsewhere'));await assert.rejects(verifyPagesExport(root),/Symlinks/);});
 await fixture(async root=>{const token=`eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.signature`;await writeFile(path.join(root,'bundle.js'),`const key="${token}"`);await assert.rejects(verifyPagesExport(root),/Privileged/);});
});
test('private routes require no-index and no-referrer metadata',()=>fixture(async root=>{await writeFile(path.join(root,'admin/index.html'),'<main id="main"></main>');await assert.rejects(verifyPagesExport(root),/private-page metadata/);}));
test('only minimal public configuration and an anon role are accepted',()=>{
 const config={firebaseApiKey:'public-firebase-key',supabaseUrl:'https://example.supabase.co',supabaseAnonKey:`header.${Buffer.from(JSON.stringify({role:'anon'})).toString('base64url')}.signature`};
 assert.doesNotThrow(()=>verifyPublicConfig(config));
 assert.throws(()=>verifyPublicConfig({...config,serviceKey:'private'}),/approved/);
 assert.throws(()=>verifyPublicConfig({...config,supabaseAnonKey:`header.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.signature`}),/anon/);
});
