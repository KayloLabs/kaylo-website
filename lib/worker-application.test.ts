import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ApplicationError,applicationErrorMessage,buildDocumentForm,canonicalPhone,checkApplicationStatus,checkDocument,documentTypes,emptyDraft,keralaDistricts,
  listServices,loadStoredDraft,loadStoredSending,newRequestToken,requestTokenPattern,saveStoredDraft,saveStoredSending,sniffDocumentMime,submitWorkerApplication,toDetails,uploadDocument,
  changeApplicationRole,requiredApplicationDocuments,caregiverServices,needsTravelRadius,
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
  assert.deepEqual(toDetails(valid()),{role:'worker',full_name:'Test Applicant',phone:'+919876543210',email:'applicant@example.com',profession:'Electrician',services:[serviceA,serviceB],experience_years:7,district:'Ernakulam',travel_radius_km:15,consent:true,upi_id:'applicant@okbank'});
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

test('draft storage remembers only service IDs and payout method, never personal values or consent',()=>{
  const store=new Map<string,string>();
  (globalThis as {window?:unknown}).window={sessionStorage:{getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{store.set(k,v);},removeItem:(k:string)=>{store.delete(k);}}};
  try{
    const token=newRequestToken();
    const draft={...bank(),services:[serviceA]};
    saveStoredDraft({draft,step:3,requestToken:token});
    assert.deepEqual(JSON.parse(store.get('kaylo.application.draft.v2')!),{draft:{role:'worker',services:[serviceA],payout:'bank'}});
    const restored=loadStoredDraft();
    assert.ok(restored);
    assert.equal(restored.step,0);
    assert.notEqual(restored.requestToken,token);
    assert.match(restored.requestToken,requestTokenPattern);
    for(const field of ['fullName','phone','email','profession','accountNumber','confirmAccountNumber','accountHolder','bankName','ifsc','upiId'] as const){
      assert.equal(restored.draft[field],'',field);
    }
    assert.equal(restored.draft.consent,false);
    assert.deepEqual(restored.draft.services,[serviceA]);
    store.set('kaylo.application.draft.v1',JSON.stringify({draft,step:3,requestToken:token}));
    loadStoredDraft();
    assert.equal(store.has('kaylo.application.draft.v1'),false);
    store.set('kaylo.application.draft.v2',JSON.stringify({draft:{...draft,services:['private@example.test',serviceA]},step:3,requestToken:token}));
    const injected=loadStoredDraft();
    assert.ok(injected);
    assert.equal(injected.draft.accountNumber,'');
    assert.equal(injected.draft.fullName,'');
    assert.deepEqual(injected.draft.services,[serviceA]);
    store.set('kaylo.application.draft.v2','{not json');
    assert.equal(loadStoredDraft(),null);
  }finally{delete (globalThis as {window?:unknown}).window;}
});

const doctor=():ApplicationDraft=>({...valid(),role:'doctor',profession:'General medicine',services:[],medicalCouncilNumber:' REG-123 ',clinicAddress:' Test Clinic, Kochi ',consultationModes:['clinic','teleconsult'],consultationFee:'500.25',travelRadiusKm:''});
const caregiver=():ApplicationDraft=>({...valid(),role:'caregiver',profession:'',services:[caregiverServices[0]],caregiverTraining:' First aid training ',hourlyRate:'250.50',languages:['Malayalam','English']});

test('doctor serialization uses 0043 Care fields and leaves catalog assignment to the server',()=>{
  const draft=doctor();
  assert.deepEqual(validateApplication(draft,[]),{});
  assert.equal(needsTravelRadius(draft),false);
  const payload=toDetails(draft);
  assert.deepEqual(payload,{role:'doctor',full_name:'Test Applicant',phone:'+919876543210',email:'applicant@example.com',profession:'General medicine',services:[],experience_years:7,district:'Ernakulam',travel_radius_km:1,consent:true,medical_council_number:'REG-123',clinic_address:'Test Clinic, Kochi',consultation_modes:['clinic','teleconsult'],consultation_fee:500.25,upi_id:'applicant@okbank'});
  assert.equal(payload.hourly_rate,undefined);
  assert.equal(payload.caregiver_training,undefined);
});

test('doctor validation bounds registration, practice address, fee, consultation modes and home visit radius',()=>{
  for(const consultationFee of ['','0','50000.01','1.234','1e3','-1','Infinity'])assert.ok(validateWork({...doctor(),consultationFee},[]).consultationFee,consultationFee);
  for(const consultationFee of ['1','50000','12.50'])assert.equal(validateWork({...doctor(),consultationFee},[]).consultationFee,undefined,consultationFee);
  assert.ok(validateWork({...doctor(),medicalCouncilNumber:'x'},[]).medicalCouncilNumber);
  assert.ok(validateWork({...doctor(),clinicAddress:'xy'},[]).clinicAddress);
  assert.ok(validateWork({...doctor(),clinicAddress:'x'.repeat(501)},[]).clinicAddress);
  assert.ok(validateWork({...doctor(),consultationModes:[]},[]).consultationModes);
  assert.ok(validateWork({...doctor(),consultationModes:['unknown'] as never},[]).consultationModes);
  assert.ok(validateWork({...doctor(),consultationModes:['homeVisit'],travelRadiusKm:'0'},[]).travelRadiusKm);
  assert.equal(validateWork({...doctor(),consultationModes:['homeVisit'],travelRadiusKm:'15'},[]).travelRadiusKm,undefined);
  assert.equal(toDetails({...doctor(),consultationModes:['homeVisit'],travelRadiusKm:'15'}).travel_radius_km,15);
});

test('caregiver serialization sends offered scope strings for server mapping and only supplied training',()=>{
  assert.deepEqual(validateApplication(caregiver(),[]),{});
  const payload=toDetails(caregiver());
  assert.deepEqual(payload,{role:'caregiver',full_name:'Test Applicant',phone:'+919876543210',email:'applicant@example.com',profession:'Caregiver',services:['Elderly Companion'],experience_years:7,district:'Ernakulam',travel_radius_km:15,consent:true,caregiver_training:'First aid training',hourly_rate:250.5,languages:['Malayalam','English'],upi_id:'applicant@okbank'});
  assert.equal(payload.medical_council_number,undefined);
  assert.equal(payload.clinic_address,undefined);
  assert.equal('is_verified' in payload,false);
  for(const hourlyRate of ['0','10000','12.345','1e3','Infinity'])assert.ok(validateWork({...caregiver(),hourlyRate},[]).hourlyRate,hourlyRate);
  for(const hourlyRate of ['1','9999.99'])assert.equal(validateWork({...caregiver(),hourlyRate},[]).hourlyRate,undefined,hourlyRate);
  assert.ok(validateWork({...caregiver(),services:[serviceA]},active).services);
  assert.ok(validateWork({...caregiver(),services:[]},active).services);
  assert.ok(validateWork({...caregiver(),caregiverTraining:''},[]).caregiverTraining);
  assert.ok(validateWork({...caregiver(),languages:['Injected language']},[]).languages);
});

test('changing role clears previous role claims and requires fresh consent; payloads omit all irrelevant fields',()=>{
  for(const source of [doctor(),caregiver()])for(const target of ['worker','doctor','caregiver'] as const){
    if(source.role===target)continue;
    const changed=changeApplicationRole(source,target);
    assert.equal(changed.role,target);
    for(const field of ['profession','medicalCouncilNumber','clinicAddress','consultationFee','caregiverTraining','hourlyRate'] as const)assert.equal(changed[field],'',field);
    for(const field of ['services','consultationModes','languages'] as const)assert.deepEqual(changed[field],[],field);
    assert.equal(changed.consent,false);
    assert.equal(changed.fullName,source.fullName);
  }
  const worker=toDetails({...valid(),medicalCouncilNumber:'stale secret',clinicAddress:'stale address',caregiverTraining:'stale training',consultationFee:'123',hourlyRate:'45'});
  assert.equal(JSON.stringify(worker).includes('stale'),false);
  const doc=toDetails({...doctor(),caregiverTraining:'stale training',hourlyRate:'45',languages:['Hindi']});
  assert.equal(doc.caregiver_training,undefined);
  assert.equal(doc.hourly_rate,undefined);
  assert.equal(doc.languages,undefined);
});

test('role documents match the actual server evidence and Care document uploads accept PDF evidence',async()=>{
  assert.deepEqual(requiredApplicationDocuments('doctor'),['clinic_proof','medical_council_reg','medical_degree','photo','selfie']);
  assert.deepEqual(requiredApplicationDocuments('caregiver'),['aadhaar_back','aadhaar_front','caregiver_cert','photo','selfie']);
  const pdf=new Blob(['%PDF-1.4 test'],{type:'application/pdf'});
  for(const doc of ['clinic_proof','medical_council_reg','medical_degree','caregiver_cert'] as const){
    assert.deepEqual(await checkDocument(doc,pdf),{ok:true,mime:'application/pdf'});
    assert.equal(buildDocumentForm({application_id:'test',upload_token:'a'.repeat(64)},doc,pdf,'application/pdf').get('doc_type'),doc);
  }
  assert.ok(!requiredApplicationDocuments('doctor').includes('aadhaar_front'));
  assert.ok(!requiredApplicationDocuments('caregiver').includes('police_certificate'));
});

test('Care drafts never persist council numbers, addresses, training, languages or fees; retries retain role-specific document progress',()=>{
  const store=new Map<string,string>();
  (globalThis as {window?:unknown}).window={sessionStorage:{getItem:(key:string)=>store.get(key)??null,setItem:(key:string,value:string)=>store.set(key,value),removeItem:(key:string)=>store.delete(key)}};
  try{
    for(const draft of [doctor(),caregiver()]){
      saveStoredDraft({draft,step:3,requestToken:'a'.repeat(64)});
      assert.deepEqual(JSON.parse(store.get('kaylo.application.draft.v2')!),{draft:{role:draft.role,services:[],payout:'upi'}});
      const restored=loadStoredDraft()!;
      assert.equal(restored.draft.role,draft.role);
      assert.equal(restored.draft.medicalCouncilNumber,'');
      assert.equal(restored.draft.clinicAddress,'');
      assert.equal(restored.draft.caregiverTraining,'');
      assert.equal(restored.draft.consent,false);
    }
    const receipt={application_id:'a',reference:'KA-TEST12345',upload_token:'a'.repeat(64),upload_expires_at:'2099-01-01T00:00:00Z',status:'submitted' as const};
    saveStoredSending({role:'doctor',receipt,uploaded:['medical_degree','photo','photo','aadhaar_front']});
    assert.deepEqual(loadStoredSending(),{role:'doctor',receipt,uploaded:['medical_degree','photo']});
    saveStoredSending({role:'caregiver',receipt,uploaded:['caregiver_cert','medical_degree']});
    assert.deepEqual(loadStoredSending(),{role:'caregiver',receipt,uploaded:['caregiver_cert']});
    store.set('kaylo.application.sending.v1',JSON.stringify({receipt,uploaded:['police_certificate']}));
    assert.equal(loadStoredSending()?.role,'worker');
    store.set('kaylo.application.sending.v1',JSON.stringify({role:'administrator',receipt,uploaded:[]}));
    assert.equal(loadStoredSending(),null);
  }finally{delete (globalThis as {window?:unknown}).window;}
});

test('application budget refusal preserves the existing request for a later retry',async()=>{
 const token='a'.repeat(64);
 await withFetch(()=>Response.json({code:'P0001',message:'APPLICATION_RATE_LIMITED',details:'New applications are temporarily limited.'},{status:400}),async()=>{
  await assert.rejects(submitWorkerApplication(config,toDetails(valid()),token),(error:unknown)=>error instanceof ApplicationError&&error.code==='APPLICATION_RATE_LIMITED'&&!error.isDefiniteRejection&&error.retryAfter===undefined&&/same details/.test(error.message));
 });
});
test('upload admission limits keep the saved upload open and use the server retry delay',async()=>{
 const receipt={application_id:'app-1',reference:'KA-X',upload_token:'a'.repeat(64),upload_expires_at:'2099-01-01T00:00:00Z',status:'submitted' as const};
 for(const [code,status,delay] of [['UPLOAD_RATE_LIMITED',429,300],['UPLOAD_IN_PROGRESS',429,30],['UPLOAD_RETRY_REQUIRED',503,90]] as const){
  await withFetch(()=>Response.json({error:{message:code},retry_after:delay},{status,headers:{'Retry-After':String(delay)}}),async()=>{
   await assert.rejects(uploadDocument(config,receipt,'selfie',new Blob([1]),'image/png'),(error:unknown)=>error instanceof ApplicationError&&error.code===code&&!error.isUploadClosed&&error.retryAfter===delay&&/same file/.test(error.message));
  });
 }
});
