import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
test('portal configuration exposes public connection fields only',async()=>{
 const response=await worker.fetch(new Request('https://kaylo.example/api/kaylo-config'),{SUPABASE_SERVICE_ROLE_KEY:'private',GMAIL_APP_PASSWORD:'private',APPLICATION_CORRECTION_SECRET:'private'});
 const body=await response.json();
 assert.deepEqual(Object.keys(body).sort(),['firebaseApiKey','supabaseAnonKey','supabaseUrl']);
 assert.equal(response.headers.get('Cache-Control'),'no-store');
 assert.equal(JSON.stringify(body).includes('private'),false);
});
test('retired applications endpoint never reads request data or reaches storage',async()=>{
 for(const method of ['GET','POST','PUT','OPTIONS'])for(const suffix of ['', '/']){
  const request={url:`https://kaylo.example/api/applications${suffix}`,method,text(){throw Error('Body must not be buffered');},get body(){throw Error('Body must not be streamed');}};
  const response=await worker.fetch(request,{get DB(){throw Error('D1 must not be accessed');}});
  assert.equal(response.status,410);
  assert.equal(response.headers.get('Cache-Control'),'no-store');
 }
});
test('static assets receive real anti-framing and content-type headers',async()=>{
 const response=await worker.fetch(new Request('https://kaylo.example/admin/'),{ASSETS:{fetch:()=>new Response('<html>test</html>',{headers:{'Content-Type':'text/html','Cache-Control':'public, max-age=60'}})}});
 assert.equal(await response.text(),'<html>test</html>');
 assert.equal(response.headers.get('X-Frame-Options'),'DENY');
 assert.equal(response.headers.get('Content-Security-Policy'),"frame-ancestors 'none'; base-uri 'none'; object-src 'none'");
 assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
 assert.equal(response.headers.get('Cache-Control'),'public, max-age=60');
});
test('unknown API and unsupported asset methods never fall through',async()=>{
 assert.equal((await worker.fetch(new Request('https://kaylo.example/api/unknown'),{})).status,404);
 assert.equal((await worker.fetch(new Request('https://kaylo.example/admin/',{method:'POST',body:'x'.repeat(20000)}),{})).status,405);
 assert.equal((await worker.fetch(new Request('https://kaylo.example/api/kaylo-config',{method:'POST',body:'bad'}),{})).status,405);
});
test('www requests move permanently to the apex domain with path and query intact',async()=>{
 for(const method of ['GET','HEAD','POST']){
  const response=await worker.fetch(new Request('http://www.kaylo.in/services/?ref=card',{method}),{ASSETS:{fetch:()=>{throw Error('Assets must not be served on www');}}});
  assert.equal(response.status,301);
  assert.equal(response.headers.get('Location'),'https://kaylo.in/services/?ref=card');
 }
 const apex=await worker.fetch(new Request('https://kaylo.in/'),{ASSETS:{fetch:()=>new Response('home')}});
 assert.equal(await apex.text(),'home');
});
