import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

const publicRoutes=['','about','services','professionals','pricing','contact','download','privacy','account-deletion','terms','refund-policy'];
const origin='https://kaylo.in';
const decode=value=>value?.replaceAll('&amp;','&').replaceAll('&#x27;',"'").replaceAll('&quot;','"');
const attribute=(tag,name)=>decode(tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1]);
const meta=(html,name)=>[...html.matchAll(/<meta\b[^>]*>/g)].map(m=>m[0]).find(tag=>attribute(tag,'name')===name||attribute(tag,'property')===name);
const content=(html,name)=>attribute(meta(html,name)??'','content');

// Validate the actual exported HTML, including server-rendering and inherited metadata.
export async function verifySeo(directory){
 const read=file=>readFile(path.join(directory,file));
 const titles=new Set(),descriptions=new Set();
 for(const route of publicRoutes){
  const html=(await read(route?`${route}/index.html`:'index.html')).toString();
  const title=decode(html.match(/<title>([^<]+)<\/title>/)?.[1]);
  const description=content(html,'description');
  assert.ok(title&&title.length<=85,`Missing/overlong title: ${route}`);
  assert.ok(description&&description.length>=40&&description.length<=200,`Invalid description: ${route}`);
  assert.ok(!titles.has(title)&&!descriptions.has(description),`Duplicate title/description: ${route}`);
  titles.add(title);descriptions.add(description);
  assert.equal((html.match(/<h1\b/g)??[]).length,1,`One primary heading required: ${route}`);
  assert.equal(content(html,'og:title'),title,`Open Graph title: ${route}`);
  assert.equal(content(html,'og:description'),description,`Open Graph description: ${route}`);
  assert.equal(content(html,'og:url'),`${origin}/${route?route+'/':''}`,`Open Graph URL: ${route}`);
  assert.equal(content(html,'og:site_name'),'Kaylo');
  assert.equal(content(html,'og:image'),`${origin}/images/kaylo-social.png`);
  assert.equal(content(html,'twitter:card'),'summary_large_image');
  assert.ok(!/noindex/.test(content(html,'robots')??''),`Public page must be indexable: ${route}`);
  assert.match(html, /rel="icon"[^>]*kaylo-mark-v2[^>]*|kaylo-mark-v2[^>]*rel="icon"/,`Favicon missing: ${route}`);
 }
 const home=(await read('index.html')).toString();
 const schemas=[...home.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const value=JSON.parse(m[1]);return value['@graph']??[value]});
 for(const type of ['WebSite','Organization']){
  const schema=schemas.find(value=>value['@type']===type);
  assert.ok(schema,`${type} schema missing`);assert.equal(schema.name,'Kaylo');
  assert.equal(schema.url,`${origin}/`);
  assert.ok(!schema.aggregateRating&&!schema.review,'Do not publish unverified ratings');
 }
 const serviceHtml=(await read('services/index.html')).toString();
 for(const term of ['Electrician','Plumber','Farm support','Equipment help','Caregiver','Doctor appointments'])assert.ok(serviceHtml.includes(term),`Service missing from initial HTML: ${term}`);
 for(const route of ['admin','application/update']){
  const html=(await read(`${route}/index.html`)).toString();
  assert.match(content(html,'robots')??'',/noindex/);assert.equal(content(html,'referrer'),'no-referrer');
  assert.ok(!html.includes('rel="canonical"'),'Private pages must not inherit homepage canonical');
 }
 const card=await read('images/kaylo-social.png');
 assert.equal(card.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(card.readUInt32BE(16),1200);assert.equal(card.readUInt32BE(20),630);
 for(const size of [16,32,48,96,192,512]){
  const image=await read(`icons/kaylo-mark-v2-${size}.png`);
  assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(image.readUInt32BE(16),size);assert.equal(image.readUInt32BE(20),size);
 }
 const ico=await read('icons/kaylo-mark-v2.ico');assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),3);
 return {publicPages:publicRoutes.length,schemas:schemas.length};
}
