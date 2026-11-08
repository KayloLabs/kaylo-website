import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAdminPrivacyList,parseAdminPrivacyRequest,privacyBlockerDescription} from './admin-privacy.ts';
const request={request_id:'3f4aa91f-24b3-4dbc-abd6-aa42f5d9eaa4',reference:'KD-20261106-AB1234',status:'review_required',requested_at:'2026-11-06T10:00:00.000Z',account_type:'partner',email:'person@example.com',blockers:['active_bookings'],last_error:null};

test('privacy queue accepts validated requests including completed records with erased identity',()=>{
  assert.deepEqual(parseAdminPrivacyList({ok:true,requests:[request]}),[request]);
  const completed={...request,status:'completed',completed_at:'2026-11-06T11:00:00.000Z',email:null,blockers:[]};
  assert.deepEqual(parseAdminPrivacyRequest(completed),completed);
});

test('invalid and duplicate queue records are rejected before showing actionable controls',()=>{
  for(const item of [{...request,request_id:'------------------------------------'},{...request,account_type:'admin'},{...request,blockers:'active_bookings'},{...request,blockers:[{unsafe:'value'}]},{...request,email:42},{...request,status:'completed'}]){
    assert.throws(()=>parseAdminPrivacyList({ok:true,requests:[item]}));
  }
  assert.throws(()=>parseAdminPrivacyList({ok:true,requests:[request,request]}));
  assert.throws(()=>parseAdminPrivacyList({ok:false,requests:[request]}));
});

test('blocker explanations never expose raw database or storage details',()=>{
  assert.match(privacyBlockerDescription('ACTIVE_BOOKINGS'),/booking/);
  assert.equal(privacyBlockerDescription('postgres /private/application/id'), 'An account obligation needs review before deletion can finish.');
});
