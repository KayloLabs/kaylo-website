import test from 'node:test';
import assert from 'node:assert/strict';
import {AdminSession, PortalError} from './admin-api.ts';
const config={firebaseApiKey:'public',supabaseUrl:'https://project.supabase.co',supabaseAnonKey:'anon'};

test('privacy operations require an authenticated administrator and retain MFA enforcement',async t=>{
  let operations=0;
  t.mock.method(globalThis,'fetch',async(input:string,init:RequestInit)=>{
    if(String(input).includes('signInWithPassword'))return Response.json({idToken:'token',refreshToken:'refresh',expiresIn:3600});
    const action=JSON.parse(String(init.body)).action;
    if(action==='session')return Response.json({admin:{email:'admin@example.com',role:'admin'}});
    operations++;
    assert.equal(String(input),'https://project.supabase.co/functions/v1/privacy-operations');
    assert.equal(new Headers(init.headers).get('Authorization'),'Bearer token');
    return Response.json({code:'ADMIN_MFA_REQUIRED'},{status:403});
  });
  const session=new AdminSession(config);
  await assert.rejects(session.privacyRequest('list'),(error:unknown)=>error instanceof PortalError&&error.code==='SIGN_IN_REQUIRED');
  await session.signIn('admin@example.com','password');
  await assert.rejects(session.privacyRequest('list'),(error:unknown)=>error instanceof PortalError&&error.code==='ADMIN_MFA_REQUIRED');
  assert.equal(operations,1);
  session.signOut();
  await assert.rejects(session.privacyRequest('process',{request_id:'request'}),/sign in/i);
});

test('a review-only operator cannot submit a privacy operation',async t=>{
  let operations=0;
  t.mock.method(globalThis,'fetch',async(input:string,init:RequestInit)=>{
    if(String(input).includes('signInWithPassword'))return Response.json({idToken:'token',refreshToken:'refresh',expiresIn:3600});
    if(JSON.parse(String(init.body)).action==='session')return Response.json({admin:{email:'reviewer@example.com',role:'reviewer'}});
    operations++;return Response.json({ok:true});
  });
  const session=new AdminSession(config);await session.signIn('reviewer@example.com','password');
  await assert.rejects(session.privacyRequest('process'),(error:unknown)=>error instanceof PortalError&&error.code==='ADMIN_ROLE_REQUIRED');
  assert.equal(operations,0);
});

test('interrupted deletion writes have an unknown outcome and are never automatically replayed',async t=>{
  let operations=0;
  t.mock.method(globalThis,'fetch',async(input:string,init:RequestInit)=>{
    if(String(input).includes('signInWithPassword'))return Response.json({idToken:'token',refreshToken:'refresh',expiresIn:3600});
    if(JSON.parse(String(init.body)).action==='session')return Response.json({admin:{email:'admin@example.com',role:'admin'}});
    operations++;throw new TypeError('Connection lost after mutation');
  });
  const session=new AdminSession(config);await session.signIn('admin@example.com','password');
  await assert.rejects(session.privacyRequest('process',{request_id:'request'}),(error:unknown)=>error instanceof PortalError&&error.outcomeUnknown);
  assert.equal(operations,1);
});

test('private queue results arriving after sign-out are discarded',async t=>{
  let finish!:(response:Response)=>void;
  t.mock.method(globalThis,'fetch',async(input:string,init:RequestInit)=>{
    if(String(input).includes('signInWithPassword'))return Response.json({idToken:'token',refreshToken:'refresh',expiresIn:3600});
    if(JSON.parse(String(init.body)).action==='session')return Response.json({admin:{email:'admin@example.com',role:'admin'}});
    return new Promise<Response>(resolve=>{finish=resolve;});
  });
  const session=new AdminSession(config);await session.signIn('admin@example.com','password');
  const pending=session.privacyRequest('list');await Promise.resolve();session.signOut();finish(Response.json({ok:true,requests:[{email:'private@example.com'}]}));
  await assert.rejects(pending,(error:unknown)=>error instanceof PortalError&&error.code==='SESSION_CHANGED');
});
