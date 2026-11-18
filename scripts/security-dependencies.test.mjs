import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const manifest=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url),'utf8'));
const atLeast=(version,minimum)=>{
 const actual=version.split('.').map(Number),floor=minimum.split('.').map(Number);
 for(let index=0;index<3;index++){if(actual[index]!==floor[index])return actual[index]>floor[index];}
 return true;
};
test('known security floors apply across the complete resolved dependency graph',()=>{
 const floors={next:'16.4.5',sharp:'0.35.5',esbuild:'0.25.0','source-map-js':'1.2.2',undici:'7.30.1','baseline-browser-mapping':'2.11.0'};
 for(const [location,pkg] of Object.entries(lock.packages)){
  const name=location.split('node_modules/').at(-1);
  if(floors[name])assert.equal(atLeast(pkg.version,floors[name]),true,`${location} must include the reviewed security patch`);
 }
 assert.equal(manifest.dependencies.next,lock.packages['node_modules/next'].version);
 assert.equal(manifest.devDependencies.wrangler,lock.packages['node_modules/wrangler'].version);
 assert.equal(manifest.overrides.sharp,'0.35.5');
});
