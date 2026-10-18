import test from 'node:test';
import assert from 'node:assert/strict';
import {submitProfessionalLead} from './professional-leads.ts';
const id='12345678-1234-4234-8234-123456789abc';
test('submission sends anonymous public credentials and the same retry receipt',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  assert.match(String(url),/^https:\/\/[^/]+\.supabase\.co\/rest\/v1\/rpc\/submit_professional_lead$/);
  assert.equal(JSON.parse(String(options?.body)).input.id,id);
  const header=new Headers(options?.headers).get('Authorization')||'';
  assert.equal(JSON.parse(Buffer.from(header.split('.')[1],'base64url').toString()).role,'anon');
  return Response.json({ok:true,reference:id});
 };
 try{assert.deepEqual(await submitProfessionalLead({id}),{ok:true,reference:id});}finally{globalThis.fetch=previous;}
});
test('server failures and a mismatched receipt cannot display success',async()=>{
 const previous=globalThis.fetch;
 try{
  for(const response of [Response.json({message:'private database detail'},{status:503}),Response.json({ok:true,reference:'other'}),new Response('unreadable')]){
   globalThis.fetch=async()=>response;
   await assert.rejects(submitProfessionalLead({id}),/couldn’t save your application/);
  }
 }finally{globalThis.fetch=previous;}
});
test('only deliberate validation messages reach applicants',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({code:'22023',message:'Enter your town or city.'},{status:400});
 try{await assert.rejects(submitProfessionalLead({id}),/Enter your town or city/);}finally{globalThis.fetch=previous;}
});
