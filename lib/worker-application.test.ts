import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ApplicationError,applicationErrorMessage,buildDocumentForm,canonicalPhone,checkApplicationStatus,checkDocument,documentTypes,emptyDraft,keralaDistricts,
  listServices,loadStoredDraft,newRequestToken,requestTokenPattern,saveStoredDraft,sniffDocumentMime,submitWorkerApplication,toDetails,uploadDocument,
  validateApplication,validateIdentity,validatePayout,validateWork,type ApplicationDraft,
} from './worker-application.ts';

const config={firebaseApiKey:'public',supabaseUrl:'https://project.supabase.co',supabaseAnonKey:'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.signature'};
const serviceA='11111111-1111-4111-8111-111111111111',serviceB='22222222-2222-4222-8222-222222222222';
const active=[serviceA,serviceB];
const valid=():ApplicationDraft=>({...emptyDraft,fullName:'  Test Applicant ',phone:'98765 43210',email:'Applicant@Example.com',profession:'Electrician',services:[serviceA,serviceB,serviceA],experienceYears:'7',district:'Ernakulam',travelRadiusKm:'15',payout:'upi',upiId:'applicant@okbank',consent:true});
const bank=():ApplicationDraft=>({...valid(),payout:'bank',upiId:'',accountHolder:'Test Applicant',bankName:'State Bank',accountNumber:'123456789012',confirmAccountNumber:'123456789012',ifsc:'sbin0001234'});
const withFetch=async(handler:(input:string,init:RequestInit)=>Response|Promise<Response>,run:()=>Promise<void>)=>{
  const previous=globalThis.fetch;
  globalThis.fetch=(async(input:string|URL|Request,init?:RequestInit)=>handler(String(input),init??{})) as typeof fetch;
  try{await run();}finally{globalThis.fetch=previous;}
};

test('districts and document types match the Partner app exactly, in order',()=>{
  assert.deepEqual([...keralaDistricts],['Alappuzha','Ernakulam','Idukki','Kannur','Kasaragod','Kollam','Kottayam','Kozhikode','Malappuram','Palakkad','Pathanamthitta','Thiruvananthapuram','Thrissur','Wayanad']);
  assert.deepEqual([...documentTypes],['photo','aadhaar_front','aadhaar_back','police_certificate','selfie']);
});

test('phone canonicalisation mirrors canonical_partner_phone',()=>{
  assert.equal(canonicalPhone('9876543210'),'+919876543210');
  assert.equal(canonicalPhone('+91 98765-43210'),'+919876543210');
  assert.equal(canonicalPhone('(0091) 98765 43210'),'+00919876543210');
  assert.equal(canonicalPhone('+44 20 7946 0958'),'+442079460958');
  assert.equal(canonicalPhone(''),'+');
});

test('identity rules: name 2 to 120, E.164 phone, delivery email outside the partner domain',()=>{
  assert.deepEqual(validateIdentity(valid()),{});
  assert.ok(validateIdentity({...valid(),fullName:' A '}).fullName);
  assert.ok(validateIdentity({...valid(),fullName:'x'.repeat(121)}).fullName);
  assert.equal(validateIdentity({...valid(),fullName:'x'.repeat(120)}).fullName,undefined);
  for(const phone of ['12345','+0123456789012','0919876543210','+1234567890123456','']){assert.ok(validateIdentity({...valid(),phone}).phone,phone);}
  for(const phone of ['+919876543210','+12025550123','98765 43210']){assert.equal(validateIdentity({...valid(),phone}).phone,undefined,phone);}
  for(const email of ['','plain','a@b','a @b.com','worker@partners.kaylo.app','KP-000001@PARTNERS.KAYLO.APP',`${'a'.repeat(250)}@b.com`]){assert.ok(validateIdentity({...valid(),email}).email,email);}
  assert.equal(validateIdentity({...valid(),email:'a@b.co'}).email,undefined);
});

test('work rules: profession, active services 1 to 30, experience 0 to 70, listed district, radius 1 to 100',()=>{
  assert.deepEqual(validateWork(valid(),active),{});
  assert.ok(validateWork({...valid(),profession:'x'},active).profession);
  assert.ok(validateWork({...valid(),services:[]},active).services);
  assert.ok(validateWork({...valid(),services:['33333333-3333-4333-8333-333333333333']},active).services);
  assert.ok(validateWork({...valid(),services:Array.from({length:31},(_,i)=>`id-${i}`)},Array.from({length:31},(_,i)=>`id-${i}`)).services);
  assert.equal(validateWork({...valid(),services:Array.from({length:30},(_,i)=>`id-${i}`)},Array.from({length:30},(_,i)=>`id-${i}`)).services,undefined);
  for(const experienceYears of ['','-1','71','3.5','070','seven']){assert.ok(validateWork({...valid(),experienceYears},active).experienceYears,experienceYears);}
  for(const experienceYears of ['0','70','05']){assert.equal(validateWork({...valid(),experienceYears},active).experienceYears,undefined,experienceYears);}
  assert.ok(validateWork({...valid(),district:'Kochi'},active).district);
  assert.ok(validateWork({...valid(),district:''},active).district);
  for(const travelRadiusKm of ['0','101','2.5','','ten']){assert.ok(validateWork({...valid(),travelRadiusKm},active).travelRadiusKm,travelRadiusKm);}
  for(const travelRadiusKm of ['1','100']){assert.equal(validateWork({...valid(),travelRadiusKm},active).travelRadiusKm,undefined);}
});

test('payout rules: a UPI handle, or holder, bank, 9 to 18 digit account confirmed twice and an IFSC',()=>{
  assert.deepEqual(validatePayout(valid()),{});
  for(const upiId of ['','abc','name@','@bank','name@12','a@b']){assert.ok(validatePayout({...valid(),upiId}).upiId,upiId);}
  assert.equal(validatePayout({...valid(),upiId:' 9876543210@paytm '}).upiId,undefined);
  assert.deepEqual(validatePayout(bank()),{});
  assert.ok(validatePayout({...bank(),accountHolder:'A'}).accountHolder);
  assert.ok(validatePayout({...bank(),bankName:''}).bankName);
  for(const accountNumber of ['12345678','1234567890123456789','12ab56789']){assert.ok(validatePayout({...bank(),accountNumber,confirmAccountNumber:accountNumber}).accountNumber,accountNumber);}
  assert.ok(validatePayout({...bank(),confirmAccountNumber:'123456789013'}).confirmAccountNumber);
  for(const ifsc of ['SBIN1001234','SBI00012345','sbin000123','ABCDE001234']){assert.ok(validatePayout({...bank(),ifsc}).ifsc,ifsc);}
  assert.equal(validatePayout({...bank(),ifsc:'hdfc0ab1234'}).ifsc,undefined);
});

test('consent must be true and the whole application validates at once',()=>{
  assert.ok(validateApplication({...valid(),consent:false},active).consent);
  assert.deepEqual(validateApplication(valid(),active),{});
  const errors=validateApplication({...emptyDraft},active);
  assert.deepEqual(Object.keys(errors).sort(),['consent','district','email','experienceYears','fullName','phone','profession','services','upiId']);
});

test('p_details uses the server field names, trims, lowercases the email and uppercases the IFSC',()=>{
  assert.deepEqual(toDetails(valid()),{full_name:'Test Applicant',phone:'+919876543210',email:'applicant@example.com',profession:'Electrician',services:[serviceA,serviceB],experience_years:7,district:'Ernakulam',travel_radius_km:15,consent:true,upi_id:'applicant@okbank'});
  const details=toDetails(bank());
  assert.equal(details.upi_id,undefined);
  assert.deepEqual(details.bank_account,{account_holder:'Test Applicant',bank_name:'State Bank',account_number:'123456789012',ifsc:'SBIN0001234'});
  assert.equal('confirmAccountNumber' in details,false);
});

test('request tokens are 64 hex characters and differ per attempt',()=>{
  const a=newRequestToken(),b=newRequestToken();
  assert.match(a,requestTokenPattern);
  assert.notEqual(a,b);
});

test('every server code maps to a plain sentence and unknown codes are shown as they are',()=>{
  for(const code of ['INVALID_APPLICATION','INVALID_NAME','INVALID_PHONE','INVALID_EMAIL','CONSENT_REQUIRED','INVALID_SERVICE_AREA','INVALID_EXPERIENCE','INVALID_RADIUS','INVALID_SERVICES','INVALID_PAYOUT','INVALID_REQUEST_TOKEN','APPLICATION_ALREADY_EXISTS','IDENTITY_ALREADY_IN_USE','FILE_TOO_LARGE','INVALID_DOCUMENT','INVALID_FILE_TYPE','UPLOAD_NOT_ALLOWED','UPLOAD_FAILED','APPLICATION_NOT_FOUND','CONNECTION']){
    const message=applicationErrorMessage(code);
    assert.ok(message.length>20&&!message.includes(code)&&!message.includes('—'),code);
  }
  assert.match(applicationErrorMessage('SOMETHING_NEW'),/SOMETHING_NEW/);
  assert.match(applicationErrorMessage('PGRST202'),/PGRST202/);
  assert.equal(new ApplicationError('submit','INVALID_PHONE',400).isDefiniteRejection,true);
  assert.equal(new ApplicationError('submit','CONNECTION').isDefiniteRejection,false);
  assert.equal(new ApplicationError('upload','UPLOAD_NOT_ALLOWED',403).isUploadClosed,true);
  assert.equal(new ApplicationError('upload','UPLOAD_FAILED',503).isUploadClosed,false);
});

test('submission posts p_details with the anon key and returns the receipt',async()=>{
  const token=newRequestToken();
  await withFetch((url,init)=>{
    assert.equal(url,'https://project.supabase.co/rest/v1/rpc/submit_worker_application');
    const headers=new Headers(init.headers);
    assert.equal(headers.get('apikey'),config.supabaseAnonKey);
    assert.equal(headers.get('Authorization'),`Bearer ${config.supabaseAnonKey}`);
    const body=JSON.parse(String(init.body));
    assert.deepEqual(Object.keys(body),['p_details']);
    assert.equal(body.p_details.client_request_token,token);
    assert.equal(body.p_details.phone,'+919876543210');
    return Response.json({application_id:'app-1',reference:'KA-ABCDEF0123456789ABCDEF01',status:'submitted',upload_token:token,upload_expires_at:'2026-10-20T07:00:00Z'});
  },async()=>{
    const receipt=await submitWorkerApplication(config,toDetails(valid()),token);
    assert.equal(receipt.reference,'KA-ABCDEF0123456789ABCDEF01');
    assert.equal(receipt.upload_token,token);
  });
  await assert.rejects(submitWorkerApplication(config,toDetails(valid()),'short'),(e:unknown)=>e instanceof ApplicationError&&e.code==='INVALID_REQUEST_TOKEN');
});

test('a raised PostgreSQL exception becomes its code, a network failure a connection error, and a bad body never succeeds',async()=>{
  const token=newRequestToken();
  await withFetch(()=>Response.json({code:'P0001',details:null,hint:null,message:'APPLICATION_ALREADY_EXISTS'},{status:400}),async()=>{
    await assert.rejects(submitWorkerApplication(config,toDetails(valid()),token),(e:unknown)=>e instanceof ApplicationError&&e.code==='APPLICATION_ALREADY_EXISTS'&&e.isDefiniteRejection&&/open application/.test(e.message));
  });
  await withFetch(()=>Response.json({code:'42501',message:'permission denied for function submit_worker_application'},{status:401}),async()=>{
    await assert.rejects(submitWorkerApplication(config,toDetails(valid()),token),(e:unknown)=>e instanceof ApplicationError&&e.code==='42501'&&!e.isDefiniteRejection&&/42501/.test(e.message));
  });
  await withFetch(()=>{throw new TypeError('Failed to fetch');},async()=>{
    await assert.rejects(submitWorkerApplication(config,toDetails(valid()),token),(e:unknown)=>e instanceof ApplicationError&&e.code==='CONNECTION'&&!e.isDefiniteRejection);
  });
  await withFetch(()=>Response.json({application_id:'app-1'}),async()=>{
    await assert.rejects(submitWorkerApplication(config,toDetails(valid()),token),(e:unknown)=>e instanceof ApplicationError&&e.code==='UNREADABLE_RESPONSE');
  });
});

test('file signatures decide the type; photos and selfies refuse PDFs; size limits hold',async()=>{
  const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0]);
  const jpeg=new Uint8Array([255,216,255,224,0,16]);
  const pdf=new TextEncoder().encode('%PDF-1.4 content');
  assert.equal(sniffDocumentMime(png),'image/png');
  assert.equal(sniffDocumentMime(jpeg),'image/jpeg');
  assert.equal(sniffDocumentMime(pdf),'application/pdf');
  assert.equal(sniffDocumentMime(new TextEncoder().encode('GIF89a')),null);
  assert.deepEqual(await checkDocument('aadhaar_front',new Blob([pdf],{type:'application/pdf'})),{ok:true,mime:'application/pdf'});
  assert.deepEqual(await checkDocument('photo',new Blob([jpeg],{type:'image/jpeg'})),{ok:true,mime:'image/jpeg'});
  const code=async(type:'photo'|'selfie',file:Blob)=>((await checkDocument(type,file)) as {code:string}).code;
  assert.equal(await code('photo',new Blob([pdf])),'IMAGE_REQUIRED');
  assert.equal(await code('selfie',new Blob([pdf])),'IMAGE_REQUIRED');
  assert.equal(await code('photo',new Blob([new TextEncoder().encode('GIF89a')],{type:'image/jpeg'})),'INVALID_FILE_TYPE');
  assert.equal(await code('photo',new Blob([])),'EMPTY_FILE');
  assert.equal(await code('photo',new Blob([new Uint8Array(10*1024*1024+1)])),'FILE_TOO_LARGE');
});

test('the multipart body carries application_id, upload_token, doc_type and a file typed by its signature',async()=>{
  const receipt={application_id:'app-1',upload_token:'f'.repeat(64)};
  const form=buildDocumentForm(receipt,'aadhaar_back',new Blob([new Uint8Array([255,216,255,224])],{type:'application/octet-stream'}),'image/jpeg');
  assert.deepEqual([...form.keys()],['application_id','upload_token','doc_type','file']);
  assert.equal(form.get('application_id'),'app-1');
  assert.equal(form.get('upload_token'),'f'.repeat(64));
  assert.equal(form.get('doc_type'),'aadhaar_back');
  const file=form.get('file') as File;
  assert.equal(file.name,'aadhaar_back.jpg');
  assert.equal(file.type,'image/jpeg');
  assert.equal(file.size,4);
});

test('uploads post multipart to the documents function and surface its error codes',async()=>{
  const receipt={application_id:'app-1',reference:'KA-X',upload_token:'a'.repeat(64),upload_expires_at:'2026-10-20T07:00:00Z',status:'submitted' as const};
  await withFetch(async(url,init)=>{
    assert.equal(url,'https://project.supabase.co/functions/v1/worker-application-documents');
    assert.equal(new Headers(init.headers).get('apikey'),config.supabaseAnonKey);
    assert.equal(new Headers(init.headers).has('Content-Type'),false);
    assert.ok(init.body instanceof FormData);
    assert.equal((init.body as FormData).get('doc_type'),'selfie');
    return Response.json({ok:true,doc_type:'selfie',delivery:{state:'pending'}});
  },async()=>{await uploadDocument(config,receipt,'selfie',new Blob([new Uint8Array([137,80,78,71,13,10,26,10])]),'image/png');});
  await withFetch(()=>Response.json({error:{code:'upload-not-allowed',message:'UPLOAD_NOT_ALLOWED'}},{status:403}),async()=>{
    await assert.rejects(uploadDocument(config,receipt,'selfie',new Blob([1]),'image/png'),(e:unknown)=>e instanceof ApplicationError&&e.code==='UPLOAD_NOT_ALLOWED'&&e.isUploadClosed);
  });
  await withFetch(()=>Response.json({ok:false}),async()=>{
    await assert.rejects(uploadDocument(config,receipt,'selfie',new Blob([1]),'image/png'),(e:unknown)=>e instanceof ApplicationError&&e.code==='UNREADABLE_RESPONSE');
  });
});

test('services come from the active catalogue ordered by name, with the anon key',async()=>{
  await withFetch((url,init)=>{
    assert.equal(url,'https://project.supabase.co/rest/v1/services?select=service_id,service_name&is_active=eq.true&order=service_name.asc');
    assert.equal(new Headers(init.headers).get('apikey'),config.supabaseAnonKey);
    return Response.json([{service_id:serviceA,service_name:'Electrician',extra:1},{bad:true}]);
  },async()=>{assert.deepEqual(await listServices(config),[{service_id:serviceA,service_name:'Electrician'}]);});
  await withFetch(()=>Response.json({code:'42501',message:'permission denied for table services'},{status:401}),async()=>{
    await assert.rejects(listServices(config),(e:unknown)=>e instanceof ApplicationError&&e.code==='42501');
  });
});

test('status lookups upper-case the reference, map a null reply to not found and validate the shape',async()=>{
  await withFetch((url,init)=>{
    assert.equal(url,'https://project.supabase.co/rest/v1/rpc/worker_application_status');
    assert.deepEqual(JSON.parse(String(init.body)),{p_reference:'KA-ABCDEF0123456789ABCDEF01'});
    return Response.json({reference:'KA-ABCDEF0123456789ABCDEF01',status:'under_review',documents_received:5});
  },async()=>{assert.deepEqual(await checkApplicationStatus(config,' ka-abcdef0123456789abcdef01 '),{reference:'KA-ABCDEF0123456789ABCDEF01',status:'under_review',documents_received:5});});
  await withFetch(()=>Response.json(null),async()=>{
    await assert.rejects(checkApplicationStatus(config,'KA-ABCDEF0123456789ABCDEF01'),(e:unknown)=>e instanceof ApplicationError&&e.code==='APPLICATION_NOT_FOUND');
  });
  await assert.rejects(checkApplicationStatus(config,'short'),(e:unknown)=>e instanceof ApplicationError&&e.code==='INVALID_REFERENCE');
});

test('a stored draft keeps typed text and its token, never files, and tolerates damage',()=>{
  const store=new Map<string,string>();
  (globalThis as {window?:unknown}).window={sessionStorage:{getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{store.set(k,v);},removeItem:(k:string)=>{store.delete(k);}}};
  try{
    const token=newRequestToken();
    saveStoredDraft({draft:{...bank(),services:[serviceA]},step:3,requestToken:token});
    const restored=loadStoredDraft();
    assert.ok(restored);
    assert.equal(restored.step,3);
    assert.equal(restored.requestToken,token);
    assert.equal(restored.draft.accountNumber,'123456789012');
    assert.deepEqual(restored.draft.services,[serviceA]);
    assert.equal(JSON.stringify(store.get('kaylo.application.draft.v1')).includes('file'),false);
    store.set('kaylo.application.draft.v1',JSON.stringify({draft:{fullName:5,services:'x',payout:'cash',consent:'yes'},step:9,requestToken:'bad'}));
    const damaged=loadStoredDraft();
    assert.ok(damaged);
    assert.equal(damaged.draft.fullName,'');
    assert.deepEqual(damaged.draft.services,[]);
    assert.equal(damaged.draft.payout,'upi');
    assert.equal(damaged.draft.consent,false);
    assert.equal(damaged.step,0);
    assert.match(damaged.requestToken,requestTokenPattern);
    store.set('kaylo.application.draft.v1','{not json');
    assert.equal(loadStoredDraft(),null);
  }finally{delete (globalThis as {window?:unknown}).window;}
});
