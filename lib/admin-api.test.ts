import test from 'node:test';
import assert from 'node:assert/strict';
import {AdminSession,correctionRequest,PortalError} from './admin-api.ts';
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
