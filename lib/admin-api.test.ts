import test from 'node:test';
import assert from 'node:assert/strict';
import {AdminSession,correctionRequest,PortalError,portalReply} from './admin-api.ts';
const config={firebaseApiKey:'public',supabaseUrl:'https://project.supabase.co',supabaseAnonKey:'anon'};
test('only authenticated admin session can make requests and signout clears access',async()=>{
 const previous=globalThis.fetch;const requests:string[]=[];
 globalThis.fetch=async(input,init)=>{requests.push(String(input));if(String(input).includes('signInWithPassword'))return Response.json({idToken:'signed-token',refreshToken:'refresh',expiresIn:3600});assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer signed-token');return Response.json({ok:true,admin:{email:'admin@example.com',role:'admin'}});};
 try{const session=new AdminSession(config);await assert.rejects(session.request('list'),/sign in/);await session.signIn('admin@example.com','password');session.signOut();await assert.rejects(session.request('list'),/sign in/);assert.equal(requests.length,2);}finally{globalThis.fetch=previous;}
});
test('denied admin lookup discards Firebase token even after valid password',async()=>{
 const previous=globalThis.fetch;let count=0;
 globalThis.fetch=async()=>++count===1?Response.json({idToken:'token',refreshToken:'refresh',expiresIn:3600}):Response.json({error:{code:'forbidden',message:'ADMIN_ONLY'}},{status:403});
 try{const session=new AdminSession(config);await assert.rejects(session.signIn('user@example.com','password'),/administrator access/);await assert.rejects(session.request('list'),/sign in/);assert.equal(count,2);}finally{globalThis.fetch=previous;}
});
test('correction capability is sent in POST body and errors use safe display text',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=async(input,init)=>{assert.equal(String(input),'https://project.supabase.co/functions/v1/application-corrections');assert.equal(JSON.parse(String(init?.body)).token,'secret-capability');return Response.json({error:{code:'invalid',message:'INVALID_CORRECTION_TOKEN'}},{status:403});};
 try{await assert.rejects(correctionRequest(config,{token:'secret-capability'}),(error:unknown)=>error instanceof PortalError&&/invalid or has expired/.test(error.message));}finally{globalThis.fetch=previous;}
});

test('concurrent identical reads share a request but later reads remain fresh',async()=>{
 const previous=globalThis.fetch;let reads=0;let finish!:(response:Response)=>void;
 globalThis.fetch=async(input,init)=>{
  if(String(input).includes('signInWithPassword'))return Response.json({idToken:'token',refreshToken:'refresh',expiresIn:3600});
  const action=JSON.parse(String(init?.body)).action;
  if(action==='session')return Response.json({admin:{email:'admin@example.com',role:'admin'}});
  reads++;return new Promise(resolve=>{finish=resolve;});
 };
 try{
  const session=new AdminSession(config);await session.signIn('admin@example.com','password');
  const first=session.request('detail',{application_id:'one'});const second=session.request('detail',{application_id:'one'});
  await Promise.resolve();assert.equal(reads,1);finish(Response.json({application:{version:1}}));
  assert.deepEqual(await first,await second);
  const fresh=session.request('detail',{application_id:'one'});await Promise.resolve();assert.equal(reads,2);
  finish(Response.json({application:{version:2}}));assert.deepEqual(await fresh,{application:{version:2}});
 }finally{globalThis.fetch=previous;}
});

test('a failed shared read can be retried and mutations are never coalesced',async()=>{
 const previous=globalThis.fetch;let reads=0,writes=0;
 globalThis.fetch=async(input,init)=>{
  if(String(input).includes('signInWithPassword'))return Response.json({idToken:'token',refreshToken:'refresh',expiresIn:3600});
  const action=JSON.parse(String(init?.body)).action;
  if(action==='session')return Response.json({admin:{email:'admin@example.com',role:'admin'}});
  if(action==='list'){reads++;return reads===1?Response.json({error:'UNAVAILABLE'},{status:503}):Response.json({applications:[]});}
  writes++;return Response.json({ok:true});
 };
 try{
  const session=new AdminSession(config);await session.signIn('admin@example.com','password');
  await assert.rejects(session.request('list'),/retry/);await session.request('list');assert.equal(reads,2);
  await Promise.all([session.request('review'),session.request('review')]);assert.equal(writes,2);
 }finally{globalThis.fetch=previous;}
});

test('an application response arriving after signout is rejected',async()=>{
 const previous=globalThis.fetch;let finish!:(response:Response)=>void;
 globalThis.fetch=async(input,init)=>{
  if(String(input).includes('signInWithPassword'))return Response.json({idToken:'token',refreshToken:'refresh',expiresIn:3600});
  if(JSON.parse(String(init?.body)).action==='session')return Response.json({admin:{email:'admin@example.com',role:'admin'}});
  return new Promise(resolve=>{finish=resolve;});
 };
 try{
  const session=new AdminSession(config);await session.signIn('admin@example.com','password');
  const pending=session.request('detail');await Promise.resolve();session.signOut();finish(Response.json({private:'application'}));
  await assert.rejects(pending,(error:unknown)=>error instanceof PortalError&&error.code==='SESSION_CHANGED');
 }finally{globalThis.fetch=previous;}
});

test('expired token refresh is shared across different reads',async()=>{
 const previous=globalThis.fetch;const originalNow=Date.now;let now=1000,refreshes=0;let finish!:(response:Response)=>void;
 Date.now=()=>now;
 globalThis.fetch=async(input,init)=>{
  if(String(input).includes('signInWithPassword'))return Response.json({idToken:'token',refreshToken:'refresh',expiresIn:3600});
  if(String(input).includes('securetoken')){refreshes++;return new Promise(resolve=>{finish=resolve;});}
  if(JSON.parse(String(init?.body)).action==='session')return Response.json({admin:{email:'admin@example.com',role:'admin'}});
  assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer renewed');return Response.json({ok:true});
 };
 try{
  const session=new AdminSession(config);await session.signIn('admin@example.com','password');now+=3590_000;
  const first=session.request('list'),second=session.request('detail',{application_id:'one'});
  assert.equal(refreshes,1);finish(Response.json({id_token:'renewed',refresh_token:'refresh2',expires_in:3600}));
  await Promise.all([first,second]);assert.equal(refreshes,1);
 }finally{globalThis.fetch=previous;Date.now=originalNow;}
});

test('an old token refresh cannot sign out a newly authenticated administrator',async()=>{
 const previous=globalThis.fetch;const originalNow=Date.now;let now=1000,signIns=0;let finish!:(response:Response)=>void;
 Date.now=()=>now;
 globalThis.fetch=async(input,init)=>{
  if(String(input).includes('signInWithPassword'))return Response.json({idToken:`token-${++signIns}`,refreshToken:`refresh-${signIns}`,expiresIn:3600});
  if(String(input).includes('securetoken'))return new Promise(resolve=>{finish=resolve;});
  return Response.json({admin:{email:'admin@example.com',role:'admin'},token:new Headers(init?.headers).get('Authorization')});
 };
 try{
  const session=new AdminSession(config);await session.signIn('admin@example.com','password');now+=3590_000;
  const pending=session.request('list');session.signOut();await session.signIn('admin@example.com','password2');
  finish(Response.json({error:'expired'},{status:401}));await assert.rejects(pending,/sign in/);
  assert.equal((await session.request<{token:string}>('list')).token,'Bearer token-2');
 }finally{globalThis.fetch=previous;Date.now=originalNow;}
});


test('an unresponsive JSON body times out instead of keeping the admin interface busy',async()=>{
 const previous=globalThis.fetch;let signal:AbortSignal|undefined;
 globalThis.fetch=async(_input,init)=>{signal=init?.signal as AbortSignal;return {json:()=>new Promise(()=>{})} as Response;};
 try{
  await assert.rejects(portalReply('https://project.supabase.co/test',{}, {timeoutMs:5}),(error:unknown)=>error instanceof PortalError&&error.code==='REQUEST_TIMEOUT'&&!error.outcomeUnknown);
  assert.equal(signal?.aborted,true);
 }finally{globalThis.fetch=previous;}
});

test('an uncertain review is read back once and never resubmitted',async()=>{
 const previous=globalThis.fetch;const actions:string[]=[];
 globalThis.fetch=async(input,init)=>{
  if(String(input).includes('signInWithPassword'))return Response.json({idToken:'token',refreshToken:'refresh',expiresIn:3600});
  const action=JSON.parse(String(init?.body)).action;actions.push(action);
  if(action==='session')return Response.json({admin:{email:'admin@example.com',role:'admin'}});
  if(action==='review')throw new TypeError('connection lost after commit');
  return Response.json({application:{application_id:'one',version:8,status:'approved'}});
 };
 try{
  const session=new AdminSession(config);await session.signIn('admin@example.com','password');
  assert.deepEqual(await session.request('review',{application_id:'one',expected_version:7,decision:'approve'}),{reconciled:true,status:'approved'});
  assert.deepEqual(actions,['session','review','detail']);
 }finally{globalThis.fetch=previous;}
});

test('unchanged or conflicting status never turns an uncertain decision into success',async()=>{
 const previous=globalThis.fetch;
 try{
  for(const application of [{application_id:'one',version:7,status:'under_review'},{application_id:'one',version:8,status:'rejected'},{application_id:'other',version:8,status:'approved'}]){
   let writes=0,reads=0;
   globalThis.fetch=async(input,init)=>{
    if(String(input).includes('signInWithPassword'))return Response.json({idToken:'token',refreshToken:'refresh',expiresIn:3600});
    const action=JSON.parse(String(init?.body)).action;
    if(action==='session')return Response.json({admin:{email:'admin@example.com',role:'admin'}});
    if(action==='review'){writes++;return Response.json({error:'ADMIN_REQUEST_UNAVAILABLE'},{status:503});}
    reads++;return Response.json({application});
   };
   const session=new AdminSession(config);await session.signIn('admin@example.com','password');
   await assert.rejects(session.request('review',{application_id:'one',expected_version:7,decision:'approve'}),(error:unknown)=>error instanceof PortalError&&error.outcomeUnknown);
   assert.equal(writes,1);assert.equal(reads,1);
  }
 }finally{globalThis.fetch=previous;}
});

test('signout aborts a hung private read without waiting for its response',async()=>{
 const previous=globalThis.fetch;let signal:AbortSignal|undefined;
 globalThis.fetch=async(input,init)=>{
  if(String(input).includes('signInWithPassword'))return Response.json({idToken:'token',refreshToken:'refresh',expiresIn:3600});
  if(JSON.parse(String(init?.body)).action==='session')return Response.json({admin:{email:'admin@example.com',role:'admin'}});
  signal=init?.signal as AbortSignal;return new Promise(()=>{});
 };
 try{
  const session=new AdminSession(config);await session.signIn('admin@example.com','password');
  const pending=assert.rejects(session.request('detail'),(error:unknown)=>error instanceof PortalError&&error.code==='SESSION_CHANGED');
  await Promise.resolve();session.signOut();await pending;assert.equal(signal?.aborted,true);
 }finally{globalThis.fetch=previous;}
});

test('an interrupted correction upload is marked uncertain and is never automatically retried',async()=>{
 const previous=globalThis.fetch;let requests=0;
 globalThis.fetch=async()=>{requests++;return new Promise(()=>{});};
 try{
  const form=new FormData();form.set('token','capability');
  await assert.rejects(correctionRequest(config,form,{timeoutMs:5}),(error:unknown)=>error instanceof PortalError&&error.outcomeUnknown&&error.code==='REQUEST_TIMEOUT');
  assert.equal(requests,1);
 }finally{globalThis.fetch=previous;}
});

test('a pre-cancelled operation never starts a request or leaves an unhandled rejection',async()=>{
 const previous=globalThis.fetch;let requests=0;
 globalThis.fetch=async()=>{requests++;return Response.json({});};
 try{
  const controller=new AbortController();controller.abort();
  await assert.rejects(portalReply('https://project.supabase.co/test',{}, {signal:controller.signal}),(error:unknown)=>error instanceof PortalError&&error.code==='REQUEST_CANCELLED');
  assert.equal(requests,0);
 }finally{globalThis.fetch=previous;}
});

test('correction upload admission feedback preserves the safe retry guidance',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({error:{message:'UPLOAD_RETRY_REQUIRED'},retry_after:90},{status:503,headers:{'Retry-After':'90'}});
 try{
  const form=new FormData();form.set('token','capability');
  await assert.rejects(correctionRequest(config,form),(error:unknown)=>error instanceof PortalError&&error.outcomeUnknown&&error.code==='UPLOAD_RETRY_REQUIRED'&&/90 seconds.*same file/.test(error.message));
 }finally{globalThis.fetch=previous;}
});
