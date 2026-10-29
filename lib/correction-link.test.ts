import test from 'node:test';
import assert from 'node:assert/strict';
import {readCorrectionLink} from './correction-link.ts';

test('correction capability is removed while unrelated fragment values are retained',()=>{
 assert.deepEqual(readCorrectionLink('#token=private.jwt.token&section=documents'),{token:'private.jwt.token',replacementHash:'#section=documents'});
 assert.deepEqual(readCorrectionLink('#token=one&token=two'),{token:'one',replacementHash:''});
});
test('missing and oversized capabilities are not used',()=>{
 assert.deepEqual(readCorrectionLink(''),{token:'',replacementHash:''});
 assert.deepEqual(readCorrectionLink(`#token=${'x'.repeat(8193)}`),{token:'',replacementHash:''});
});
