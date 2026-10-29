import test from 'node:test';
import assert from 'node:assert/strict';
import {retryAfterSeconds,uploadRetryMessage} from './retry-feedback.ts';

test('only a bounded numeric retry delay is accepted from server metadata',()=>{
 assert.equal(retryAfterSeconds(new Response('',{headers:{'Retry-After':'45'}}),{retry_after:30}),45);
 assert.equal(retryAfterSeconds(new Response(''),{retry_after:300}),300);
 for(const value of [-1,0,0.5,86401,NaN,'30','private backend error'])assert.equal(retryAfterSeconds(new Response(''),{retry_after:value}),undefined);
});
test('upload feedback keeps retries attached to the same saved application',()=>{
 assert.match(uploadRetryMessage('UPLOAD_RATE_LIMITED',300)!,/5 minutes.*same file/);
 assert.match(uploadRetryMessage('UPLOAD_IN_PROGRESS',30)!,/30 seconds/);
 assert.match(uploadRetryMessage('UPLOAD_RETRY_REQUIRED')!,/90 seconds.*same file/);
 assert.equal(uploadRetryMessage('UNKNOWN_CODE'),undefined);
});
