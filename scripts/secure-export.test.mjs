import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {contentPolicy,secureHtml,verifyHtmlSecurity} from './secure-export.mjs';
const config={supabaseUrl:'https://example.supabase.co'};
const inline='self.__next_f.push([1,"bootstrap"]);';
const source=`<html><head><script src="/_next/bundle.js"></script></head><body><script>${inline}</script><script type="application/ld+json">{"name":"Kaylo"}</script></body></html>`;
test('static CSP precedes execution and hashes each exact inline bootstrap',()=>{
 const output=secureHtml(source,config);
 verifyHtmlSecurity(output,config);
 assert.ok(output.indexOf('data-kaylo-csp')<output.indexOf('<script'));
 assert.ok(output.includes(createHash('sha256').update(inline).digest('base64')));
 assert.match(contentPolicy(output,config),/script-src 'self' 'sha256-/);
 assert.doesNotMatch(contentPolicy(output,config),/unsafe-eval|script-src[^;]*unsafe-inline|\*\.supabase/);
 assert.match(contentPolicy(output,config),/connect-src 'self' https:\/\/example.supabase.co https:\/\/identitytoolkit.googleapis.com https:\/\/securetoken.googleapis.com/);
 assert.equal(secureHtml(output,config),output);
});
test('missing and stale CSPs cannot pass export verification',()=>{
 assert.throws(()=>verifyHtmlSecurity(source,config),/Missing or stale/);
 assert.throws(()=>verifyHtmlSecurity(secureHtml(source,config).replace(inline,'alert(1)'),config),/Missing or stale/);
 assert.throws(()=>secureHtml('no head',config),/missing its head/);
 assert.throws(()=>secureHtml(source,{supabaseUrl:'http://example.test'}),/Invalid CSP/);
});
test('meta policy never claims unsupported anti-framing protection',()=>{
 assert.doesNotMatch(contentPolicy(source,config),/frame-ancestors/);
 assert.match(contentPolicy(source,config),/object-src 'none'/);
 assert.match(contentPolicy(source,config),/script-src-attr 'none'/);
});
