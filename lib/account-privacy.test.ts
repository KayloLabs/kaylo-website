import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePrivacyRequest, PrivacyRequestError, requestPrivacyCode, submitPrivacyRequest} from './account-privacy.ts';

const requestId = '3f4aa91f-24b3-4dbc-abd6-aa42f5d9eaa4';
const request = {reference:'KD-20261106-AB1234',status:'requested',requested_at:'2026-11-06T10:00:00.000Z'};
const submission = {email:'person@example.com',accountType:'customer' as const,code:'123456',requestId,confirmation:'DELETE'};

test('code delivery uses a private POST, normalizes identity and reports only generic delivery details', async t => {
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.equal(new URL(url).search,'');
    assert.equal(init.method,'POST');
    assert.equal(init.cache,'no-store');
    assert.equal(init.credentials,'omit');
    assert.equal(init.referrerPolicy,'no-referrer');
    assert.deepEqual(JSON.parse(String(init.body)),{action:'request_code',email:'person@example.com',account_type:'partner'});
    return Response.json({ok:true,message:'Internal transport details must not reach the interface',expires_in_seconds:600,retry_after_seconds:60});
  });
  assert.deepEqual(await requestPrivacyCode(' Person@Example.com ','partner'),{expiresInSeconds:600,retryAfterSeconds:60});
});

test('invalid identity, code and confirmation never reach the service',async t=>{
  const fetch = t.mock.method(globalThis,'fetch',async()=>Response.json({ok:true}));
  await assert.rejects(requestPrivacyCode('not an email','customer'),PrivacyRequestError);
  for (const input of [{...submission,code:'12345'}, {...submission,requestId:'invalid'}, {...submission,confirmation:'yes'}]) {
    await assert.rejects(submitPrivacyRequest(input),PrivacyRequestError);
  }
  assert.equal(fetch.mock.callCount(),0);
});

test('verification preserves the idempotency identifier and returns a request, not assumed deletion',async t=>{
  t.mock.method(globalThis,'fetch',async(_url: string,init:RequestInit)=>{
    assert.deepEqual(JSON.parse(String(init.body)),{action:'verify_request',email:'person@example.com',account_type:'customer',code:'123456',request_id:requestId,confirmation:'DELETE'});
    return Response.json({ok:true,request:{...request,message:'Arbitrary server content'}});
  });
  assert.deepEqual(await submitPrivacyRequest(submission),request);
});

test('malformed and unconfirmed success responses cannot become a deletion receipt',async t=>{
  const responses: unknown[]=[null,{ok:false},{ok:true,request:{...request,status:'deleted'}},{ok:true,request:{...request,status:'completed'}},{ok:true,request:{...request,reference:'not-a-reference'}},{ok:true,request:{...request,requested_at:'invalid'}}];
  for (const response of responses) {
    const mock=t.mock.method(globalThis,'fetch',async()=>Response.json(response));
    await assert.rejects(submitPrivacyRequest(submission),PrivacyRequestError);
    mock.mock.restore();
  }
  assert.deepEqual(parsePrivacyRequest({...request,status:'completed',completed_at:'2026-11-06T11:00:00.000Z'}),{...request,status:'completed',completed_at:'2026-11-06T11:00:00.000Z'});
});

test('rate limits are bounded and backend internals stay out of displayed errors',async t=>{
  const mock=t.mock.method(globalThis,'fetch',async()=>Response.json({error:'postgres internal secret',retry_after_seconds:90},{status:429}));
  await assert.rejects(requestPrivacyCode('person@example.com','customer'),(error:unknown)=>error instanceof PrivacyRequestError && error.retryAfterSeconds===90 && !error.message.includes('postgres'));
  mock.mock.restore();
  t.mock.method(globalThis,'fetch',async()=>Response.json({error:'database path',retry_after_seconds:999999},{status:429}));
  await assert.rejects(requestPrivacyCode('person@example.com','customer'),(error:unknown)=>error instanceof PrivacyRequestError && error.retryAfterSeconds===60);
});

test('network loss never retries an irreversible submission automatically',async t=>{
  const fetch=t.mock.method(globalThis,'fetch',async()=>{throw new TypeError('network lost after request was accepted');});
  await assert.rejects(submitPrivacyRequest(submission),/retry with the same details/i);
  assert.equal(fetch.mock.callCount(),1);
});

test('leaving the page cancels requests without displaying a server failure',async t=>{
  const controller=new AbortController();
  const fetch=t.mock.method(globalThis,'fetch',async(_url:string,init:RequestInit)=>new Promise<Response>((_resolve,reject)=>{
    init.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
  }));
  const pending=requestPrivacyCode('person@example.com','customer',controller.signal);
  controller.abort();
  await assert.rejects(pending,(error:unknown)=>error instanceof DOMException && error.name==='AbortError');
  await assert.rejects(requestPrivacyCode('person@example.com','customer',controller.signal),(error:unknown)=>error instanceof DOMException && error.name==='AbortError');
  assert.equal(fetch.mock.callCount(),1);
});
