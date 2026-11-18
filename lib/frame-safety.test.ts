import test from 'node:test';
import assert from 'node:assert/strict';
import {assertTopLevelInteraction,isTopLevelWindow} from './frame-safety.ts';
import {portalReply} from './admin-api.ts';
import {requestPrivacyCode} from './account-privacy.ts';
test('only top-level windows may render protected controls',()=>{
 const top={};
 assert.equal(isTopLevelWindow({self:top,top} as Pick<Window,'self'|'top'>),true);
 assert.equal(isTopLevelWindow({self:{},top:{}} as Pick<Window,'self'|'top'>),false);
 assert.equal(isTopLevelWindow(null),false);
 assert.equal(isTopLevelWindow({get self(){throw Error('inaccessible');}} as unknown as Window),false);
});
test('framed admin and deletion attempts fail before any network request',async()=>{
 const originalWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
 const originalFetch=globalThis.fetch;
 Object.defineProperty(globalThis,'window',{value:{self:{},top:{}},configurable:true});
 let requests=0;
 globalThis.fetch=async()=>{requests++;throw Error('must not send');};
 try{
  assert.throws(()=>assertTopLevelInteraction(),/directly in a browser tab/);
  await assert.rejects(portalReply('https://example.test/',{method:'POST'}),/directly in a browser tab/);
  await assert.rejects(requestPrivacyCode('test@example.test','customer'),/directly in a browser tab/);
  assert.equal(requests,0);
 }finally{
  globalThis.fetch=originalFetch;
  if(originalWindow)Object.defineProperty(globalThis,'window',originalWindow);
  else Reflect.deleteProperty(globalThis,'window');
 }
});
