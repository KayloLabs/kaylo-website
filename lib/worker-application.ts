// Worker applications from the website: the same contract the Kaylo Partner app
// uses. Every rule here mirrors `submit_worker_application` (kaylo-app
// migration 0043) and the `worker-application-documents` function. The server
// remains authoritative. Public configuration is the admin
// portal's `loadPortalConfig()`; callers pass it in.
import type {PortalConfig,Status} from './admin-api';
import {retryAfterSeconds,uploadRetryMessage} from './retry-feedback.ts';
import {requiredDocuments,type ApplicationDocumentType} from './partner-documents.ts';
export type {PortalConfig,Status};

/** The 14 districts a worker can serve. Same list and order as the Partner app. */
export const keralaDistricts=['Alappuzha','Ernakulam','Idukki','Kannur','Kasaragod','Kollam','Kottayam','Kozhikode','Malappuram','Palakkad','Pathanamthitta','Thiruvananthapuram','Thrissur','Wayanad'] as const;
export type District=(typeof keralaDistricts)[number];

export const documentTypes=['photo','aadhaar_front','aadhaar_back','police_certificate','selfie'] as const;
export type DocumentType=ApplicationDocumentType;
export const documentLabels:Record<DocumentType,string>={photo:'Profile photo',aadhaar_front:'Aadhaar front',aadhaar_back:'Aadhaar back',police_certificate:'Police clearance certificate',selfie:'Selfie',medical_council_reg:'Medical council registration',medical_degree:'Medical qualification',clinic_proof:'Clinic / practice address proof',caregiver_cert:'Caregiver training certificate'};
export const documentHints:Record<DocumentType,string>={photo:'A clear, recent photo of your face.',aadhaar_front:'The front of your Aadhaar card, with your name and photo readable.',aadhaar_back:'The back of your Aadhaar card, with the address readable.',police_certificate:'Your police clearance certificate, as a photo, scan or PDF.',selfie:'A selfie taken now, showing your face clearly.',medical_council_reg:'Your medical council registration document.',medical_degree:'Your medical qualification document.',clinic_proof:'A document showing your clinic or practice address.',caregiver_cert:'Your caregiver training certificate. Supply the actual document for review.'};
export const imageOnlyDocuments:ReadonlySet<DocumentType>=new Set<DocumentType>(['photo','selfie']);
export const maxDocumentBytes=10*1024*1024;
export type DocumentMime='image/jpeg'|'image/png'|'application/pdf';

export type ServiceOption={service_id:string;service_name:string};
export type PayoutMethod='upi'|'bank';
export const applicationRoles=['worker','doctor','caregiver'] as const;
export type ApplicationRole=(typeof applicationRoles)[number];
export const roleLabels:Record<ApplicationRole,string>={worker:'Service professional',doctor:'Doctor',caregiver:'Caregiver'};
export const consultationModes=['clinic','homeVisit','teleconsult'] as const;
export type ConsultationMode=(typeof consultationModes)[number];
export const consultationLabels:Record<ConsultationMode,string>={clinic:'Clinic',homeVisit:'Home visit',teleconsult:'Remote consultation'};
// Existing Partner app choices; these describe offered services, not credentials.
export const caregiverServices=['Elderly Companion','Mobility & Bedridden Support','Post-Hospital Recovery','Dementia & Memory Care','Vital Signs & Medication Monitoring','Respite Care'] as const;
export const caregiverLanguages=['Malayalam','English','Hindi','Tamil'] as const;
export const requiredApplicationDocuments=(role:ApplicationRole):DocumentType[]=>requiredDocuments(role) as DocumentType[];
export const needsTravelRadius=(d:ApplicationDraft)=>d.role!=='doctor'||d.consultationModes.includes('homeVisit');
export type ApplicationDraft={
  role:ApplicationRole;
  fullName:string;phone:string;email:string;
  profession:string;services:string[];experienceYears:string;district:string;travelRadiusKm:string;
  medicalCouncilNumber:string;clinicAddress:string;consultationModes:ConsultationMode[];consultationFee:string;
  caregiverTraining:string;hourlyRate:string;languages:string[];
  payout:PayoutMethod;upiId:string;accountHolder:string;bankName:string;accountNumber:string;confirmAccountNumber:string;ifsc:string;
  consent:boolean;
};
export const emptyDraft:ApplicationDraft={role:'worker',fullName:'',phone:'',email:'',profession:'',services:[],experienceYears:'',district:'',travelRadiusKm:'15',medicalCouncilNumber:'',clinicAddress:'',consultationModes:[],consultationFee:'',caregiverTraining:'',hourlyRate:'',languages:[],payout:'upi',upiId:'',accountHolder:'',bankName:'',accountNumber:'',confirmAccountNumber:'',ifsc:'',consent:false};
/** Never carry one role's professional claims or address into another role. */
export function changeApplicationRole(d:ApplicationDraft,role:ApplicationRole):ApplicationDraft{
  if(d.role===role)return d;
  return {...d,role,profession:'',services:[],medicalCouncilNumber:'',clinicAddress:'',consultationModes:[],consultationFee:'',caregiverTraining:'',hourlyRate:'',languages:[],consent:false};
}
export type DraftField=keyof ApplicationDraft;
export type DraftErrors=Partial<Record<DraftField,string>>;

// Server: `^\+[1-9][0-9]{7,14}$` after canonical_partner_phone.
export const phonePattern=/^\+[1-9][0-9]{7,14}$/;
// Server: `^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$`, at most 254 characters, never the partner login domain.
export const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const reservedEmailDomain='@partners.kaylo.app';
// The Partner app's UPI shape. It sits inside the server's `^[A-Za-z0-9._-]{2,255}@[A-Za-z0-9.-]{2,64}$`.
export const upiPattern=/^[\w.\-]{2,}@[a-zA-Z]{2,}$/;
// Server: `^[A-Z]{4}0[A-Z0-9]{6}$` on the upper-cased code.
export const ifscPattern=/^[A-Z]{4}0[A-Z0-9]{6}$/;
// Indian account numbers run 9 to 18 digits, as in the app. The server accepts 6 to 20.
export const accountNumberPattern=/^[0-9]{9,18}$/;
export const requestTokenPattern=/^[0-9a-f]{64}$/;
export const referencePattern=/^[A-Z0-9-]{8,80}$/;
export const experienceRange={min:0,max:70} as const;
export const radiusRange={min:1,max:100} as const;
export const servicesRange={min:1,max:30} as const;
const digits=/^[0-9]+$/;

/** Mirrors canonical_partner_phone: keep the digits; ten digits become +91. */
export function canonicalPhone(value:string):string{
  const d=value.replace(/[^0-9]/g,'');
  return d.length===10?`+91${d}`:`+${d}`;
}
const trimmed=(value:string)=>value.trim().length;
const within=(n:number,min:number,max:number)=>Number.isInteger(n)&&n>=min&&n<=max;

export function validateIdentity(d:ApplicationDraft):DraftErrors{
  const errors:DraftErrors={};
  if(!(applicationRoles as readonly string[]).includes(d.role))errors.role='Choose your partner type.';
  if(trimmed(d.fullName)<2||trimmed(d.fullName)>120)errors.fullName='Enter your full name, 2 to 120 characters.';
  if(!phonePattern.test(canonicalPhone(d.phone)))errors.phone='Enter a valid phone number with country code.';
  const email=d.email.trim().toLowerCase();
  if(email.length>254||!emailPattern.test(email)||email.endsWith(reservedEmailDomain))errors.email='Enter a valid delivery email.';
  return errors;
}
export function validateWork(d:ApplicationDraft,activeServiceIds:Iterable<string>):DraftErrors{
  const errors:DraftErrors={};
  const active=new Set(activeServiceIds);
  if(d.role!=='caregiver'&&(trimmed(d.profession)<2||trimmed(d.profession)>120))errors.profession='Enter your profession or specialty, 2 to 120 characters.';
  const chosen=[...new Set(d.services)];
  if(d.role!=='doctor'){
    if(chosen.length<servicesRange.min)errors.services='Choose at least one service.';
    else if(chosen.length>servicesRange.max)errors.services='Choose up to 30 services.';
    else if(chosen.some(id=>d.role==='caregiver'?!(caregiverServices as readonly string[]).includes(id):!active.has(id)))errors.services='Choose services from the current list.';
  }
  if(d.role==='doctor'){
    if(trimmed(d.medicalCouncilNumber)<2||trimmed(d.medicalCouncilNumber)>120)errors.medicalCouncilNumber='Enter your medical council number, 2 to 120 characters.';
    if(trimmed(d.clinicAddress)<3||trimmed(d.clinicAddress)>500)errors.clinicAddress='Enter your clinic or practice address, 3 to 500 characters.';
    if(d.consultationModes.length<1||d.consultationModes.length>3||d.consultationModes.some(m=>!(consultationModes as readonly string[]).includes(m)))errors.consultationModes='Choose at least one consultation mode.';
    if(!/^[0-9]{1,5}(\.[0-9]{1,2})?$/.test(d.consultationFee.trim())||Number(d.consultationFee)<1||Number(d.consultationFee)>50000)errors.consultationFee='Enter a consultation fee from ₹1 to ₹50,000, with up to two decimals.';
  }
  if(d.role==='caregiver'){
    if(trimmed(d.caregiverTraining)<2||trimmed(d.caregiverTraining)>120)errors.caregiverTraining='Describe your training and experience, 2 to 120 characters.';
    if(!/^[0-9]{1,4}(\.[0-9]{1,2})?$/.test(d.hourlyRate.trim())||Number(d.hourlyRate)<1||Number(d.hourlyRate)>10000)errors.hourlyRate='Enter an hourly rate from ₹1 to ₹9,999.99, with up to two decimals.';
    if(d.languages.some(l=>!(caregiverLanguages as readonly string[]).includes(l)))errors.languages='Choose languages from the list.';
  }
  const years=d.experienceYears.trim();
  if(!digits.test(years)||years.length>2||!within(Number(years),experienceRange.min,experienceRange.max))errors.experienceYears='Enter experience from 0 to 70 years.';
  if(!(keralaDistricts as readonly string[]).includes(d.district))errors.district='Choose your district.';
  const radius=d.travelRadiusKm.trim();
  if(needsTravelRadius(d)&&(!digits.test(radius)||!within(Number(radius),radiusRange.min,radiusRange.max)))errors.travelRadiusKm='Enter a radius between 1 and 100 km.';
  return errors;
}
export function validatePayout(d:ApplicationDraft):DraftErrors{
  const errors:DraftErrors={};
  if(d.payout==='upi'){
    if(!upiPattern.test(d.upiId.trim()))errors.upiId='Enter a valid UPI ID, like name@bank.';
    return errors;
  }
  if(trimmed(d.accountHolder)<2||trimmed(d.accountHolder)>120)errors.accountHolder='Enter the account holder name.';
  if(trimmed(d.bankName)<2||trimmed(d.bankName)>120)errors.bankName='Enter the bank name.';
  if(!accountNumberPattern.test(d.accountNumber.trim()))errors.accountNumber='Enter a 9 to 18 digit account number.';
  else if(d.confirmAccountNumber.trim()!==d.accountNumber.trim())errors.confirmAccountNumber='The account numbers do not match.';
  if(!ifscPattern.test(d.ifsc.trim().toUpperCase()))errors.ifsc='Enter a valid 11-character IFSC code.';
  return errors;
}
export function validateConsent(d:ApplicationDraft):DraftErrors{
  return d.consent===true?{}:{consent:'Please give consent before submitting.'};
}
export function validateApplication(d:ApplicationDraft,activeServiceIds:Iterable<string>):DraftErrors{
  return {...validateIdentity(d),...validateWork(d,activeServiceIds),...validatePayout(d),...validateConsent(d)};
}

export type BankAccount={account_holder:string;bank_name:string;account_number:string;ifsc:string};
export type ApplicationDetails={
  role:ApplicationRole;
  full_name:string;phone:string;email:string;profession:string;services:string[];experience_years:number;district:string;travel_radius_km:number;
  upi_id?:string;bank_account?:BankAccount;consent:boolean;
  medical_council_number?:string;clinic_address?:string;consultation_modes?:ConsultationMode[];consultation_fee?:number;
  caregiver_training?:string;hourly_rate?:number;languages?:string[];
};
/** The `p_details` payload, in the field order the Partner app sends. Validate first. */
export function toDetails(d:ApplicationDraft):ApplicationDetails{
  const details:ApplicationDetails={
    role:d.role,full_name:d.fullName.trim(),phone:canonicalPhone(d.phone),email:d.email.trim().toLowerCase(),profession:d.role==='caregiver'?'Caregiver':d.profession.trim(),
    services:d.role==='doctor'?[]:[...new Set(d.services)],experience_years:Number(d.experienceYears.trim()),district:d.district,travel_radius_km:needsTravelRadius(d)?Number(d.travelRadiusKm.trim()):1,
    consent:d.consent===true,
  };
  if(d.role==='doctor')Object.assign(details,{medical_council_number:d.medicalCouncilNumber.trim(),clinic_address:d.clinicAddress.trim(),consultation_modes:[...new Set(d.consultationModes)],consultation_fee:Number(d.consultationFee.trim())});
  if(d.role==='caregiver')Object.assign(details,{caregiver_training:d.caregiverTraining.trim(),hourly_rate:Number(d.hourlyRate.trim()),languages:[...new Set(d.languages)]});
  if(d.payout==='upi')details.upi_id=d.upiId.trim();
  else details.bank_account={account_holder:d.accountHolder.trim(),bank_name:d.bankName.trim(),account_number:d.accountNumber.trim(),ifsc:d.ifsc.trim().toUpperCase()};
  return details;
}
/** 32 random bytes as hex. One per attempt; a retry after a lost reply reuses it. */
export function newRequestToken():string{
  const bytes=new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}

export type ErrorStage='services'|'submit'|'upload'|'status';
export const connectionCode='CONNECTION';
const definiteSubmitRejections=new Set(['INVALID_ROLE','INVALID_CARE_DETAILS','CARE_SERVICE_UNAVAILABLE','INVALID_APPLICATION','INVALID_NAME','INVALID_PHONE','INVALID_EMAIL','CONSENT_REQUIRED','INVALID_SERVICE_AREA','INVALID_EXPERIENCE','INVALID_RADIUS','INVALID_SERVICES','INVALID_PAYOUT','INVALID_REQUEST_TOKEN','APPLICATION_ALREADY_EXISTS','IDENTITY_ALREADY_IN_USE','23505']);
const messages:Record<string,string>={
  INVALID_ROLE:'Choose a partner type and submit again.',
  INVALID_CARE_DETAILS:'Check your Care details, consultation choices and fee or hourly rate.',
  APPLICATION_RATE_LIMITED:'New applications are temporarily limited. Please try again later using these same details. If you already have a reference, check that application instead of starting another.',
  CARE_SERVICE_UNAVAILABLE:'Care applications are unavailable right now. Please try again later.',
  CONNECTION:'Could not connect. Check your connection and retry.',
  UNREADABLE_RESPONSE:'Kaylo sent an unreadable reply. Please retry.',
  INVALID_APPLICATION:'The application could not be read. Check your details and try again.',
  INVALID_NAME:'Enter your full name, 2 to 120 characters.',
  INVALID_PHONE:'Enter a valid phone number with country code.',
  INVALID_EMAIL:'Enter a valid delivery email.',
  CONSENT_REQUIRED:'Please give consent before submitting.',
  INVALID_SERVICE_AREA:'Enter your profession and choose your district.',
  INVALID_EXPERIENCE:'Enter experience from 0 to 70 years.',
  INVALID_RADIUS:'Enter a radius between 1 and 100 km.',
  INVALID_SERVICES:'Choose at least one service from the current list.',
  INVALID_PAYOUT:'Enter a valid UPI ID, or complete bank account details with a valid IFSC code.',
  INVALID_REQUEST_TOKEN:'Please refresh this page and try again.',
  APPLICATION_ALREADY_EXISTS:'There is already an open application for this phone number. Check its status or contact Kaylo support.',
  '23505':'There is already an open application for this phone number. Check its status or contact Kaylo support.',
  IDENTITY_ALREADY_IN_USE:'This phone or email is already used by a Kaylo account. Contact support before applying with this identity.',
  POST_ONLY:'The upload was sent the wrong way. Please refresh this page and retry.',
  INVALID_DOCUMENT:'Choose a valid JPG, PNG or PDF file, up to 10 MB. Profile photos and selfies must be images.',
  FILE_TOO_LARGE:'Choose a file smaller than 10 MB.',
  INVALID_FILE_TYPE:'Use an original JPEG, PNG or PDF file. Profile photos and selfies must be images.',
  UPLOAD_NOT_ALLOWED:'The upload session is no longer available. Contact Kaylo with your reference to finish your application.',
  UPLOAD_FAILED:'The upload did not complete. Your file is still here. Please retry.',
  UPLOAD_INCOMPLETE:'Kaylo has not recorded all required documents yet. Please retry the upload.',
  INVALID_REFERENCE:'Enter the reference from your application.',
  APPLICATION_NOT_FOUND:'No application matches that reference. Check the reference and try again.',
};
/** Known codes become one plain sentence. Unknown codes are shown as they are. */
export function applicationErrorMessage(code:string,retryAfter?:number):string{
  return uploadRetryMessage(code,retryAfter)??messages[code]??`Kaylo could not complete this step (${code}). Try again, or email kayloapp@gmail.com with this code.`;
}
export class ApplicationError extends Error{
  code:string;status:number;stage:ErrorStage;retryAfter:number|undefined;
  constructor(stage:ErrorStage,code:string,status=0,retryAfter?:number){super(applicationErrorMessage(code,retryAfter));this.name='ApplicationError';this.code=code;this.status=status;this.stage=stage;this.retryAfter=retryAfter;}
  /** The server refused the details, so the same request will never succeed. Edit and resubmit with a new token. */
  get isDefiniteRejection(){return this.stage==='submit'&&definiteSubmitRejections.has(this.code);}
  /** The upload capability is gone; only Kaylo can ask for the missing documents now. */
  get isUploadClosed(){return this.stage==='upload'&&(this.code==='UPLOAD_NOT_ALLOWED'||this.status===401||this.status===403||this.status===409);}
}

const codeShape=/^[A-Z][A-Z0-9_]{2,}$/;
async function applicationFailure(stage:ErrorStage,response:Response):Promise<ApplicationError>{
  const body=await response.json().catch(()=>null);
  for(const candidate of [body?.error?.message,body?.message,body?.error,body?.code]){
    if(typeof candidate==='string'&&codeShape.test(candidate))return new ApplicationError(stage,candidate,response.status,retryAfterSeconds(response,body));
  }
  if(typeof body?.code==='string'&&body.code)return new ApplicationError(stage,body.code,response.status,retryAfterSeconds(response,body));
  return new ApplicationError(stage,`HTTP_${response.status}`,response.status,retryAfterSeconds(response,body));
}
function headers(config:PortalConfig,extra:Record<string,string>={}):Record<string,string>{
  return {apikey:config.supabaseAnonKey,Authorization:`Bearer ${config.supabaseAnonKey}`,...extra};
}
async function send(stage:ErrorStage,input:string,init:RequestInit):Promise<Response>{
  try{return await fetch(input,init);}
  catch{throw new ApplicationError(stage,connectionCode);}
}

export async function listServices(config:PortalConfig):Promise<ServiceOption[]>{
  const response=await send('services',`${config.supabaseUrl}/rest/v1/services?select=service_id,service_name&is_active=eq.true&order=service_name.asc`,{headers:headers(config,{Accept:'application/json'}),cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw await applicationFailure('services',response);
  const body:unknown=await response.json().catch(()=>null);
  if(!Array.isArray(body))throw new ApplicationError('services','UNREADABLE_RESPONSE',response.status);
  return body.filter((row):row is ServiceOption=>typeof row?.service_id==='string'&&typeof row?.service_name==='string').map(row=>({service_id:row.service_id,service_name:row.service_name}));
}

export type Receipt={application_id:string;reference:string;upload_token:string;upload_expires_at:string;status:Status};
export function receiptUsable(receipt:Receipt,now=Date.now()):boolean{
  const expires=new Date(receipt.upload_expires_at).getTime();
  return Number.isFinite(expires)&&expires>now;
}
export async function submitWorkerApplication(config:PortalConfig,details:ApplicationDetails,requestToken:string):Promise<Receipt>{
  if(!requestTokenPattern.test(requestToken))throw new ApplicationError('submit','INVALID_REQUEST_TOKEN');
  const response=await send('submit',`${config.supabaseUrl}/rest/v1/rpc/submit_worker_application`,{method:'POST',headers:headers(config,{'Content-Type':'application/json',Accept:'application/json'}),body:JSON.stringify({p_details:{...details,client_request_token:requestToken}}),cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw await applicationFailure('submit',response);
  const body=await response.json().catch(()=>null);
  if(!body||typeof body.application_id!=='string'||typeof body.reference!=='string'||!requestTokenPattern.test(String(body.upload_token))||typeof body.upload_expires_at!=='string')throw new ApplicationError('submit','UNREADABLE_RESPONSE',response.status);
  return {application_id:body.application_id,reference:body.reference,upload_token:body.upload_token,upload_expires_at:body.upload_expires_at,status:body.status};
}

/** The same signature checks the upload function runs on the stored bytes. */
export function sniffDocumentMime(bytes:Uint8Array):DocumentMime|null{
  if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
  if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(bytes.length>=5&&bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70&&bytes[4]===45)return 'application/pdf';
  return null;
}
export async function readDocumentMime(file:Blob):Promise<DocumentMime|null>{
  return sniffDocumentMime(new Uint8Array(await file.slice(0,8).arrayBuffer()));
}
export type DocumentCheck={ok:true;mime:DocumentMime}|{ok:false;code:'EMPTY_FILE'|'FILE_TOO_LARGE'|'INVALID_FILE_TYPE'|'IMAGE_REQUIRED';message:string};
export async function checkDocument(type:DocumentType,file:Blob):Promise<DocumentCheck>{
  if(file.size===0)return {ok:false,code:'EMPTY_FILE',message:'This file is empty. Choose another file.'};
  if(file.size>maxDocumentBytes)return {ok:false,code:'FILE_TOO_LARGE',message:messages.FILE_TOO_LARGE};
  const mime=await readDocumentMime(file);
  if(!mime)return {ok:false,code:'INVALID_FILE_TYPE',message:'Use an original JPEG, PNG or PDF file.'};
  if(mime==='application/pdf'&&imageOnlyDocuments.has(type))return {ok:false,code:'IMAGE_REQUIRED',message:`${documentLabels[type]} must be a JPEG or PNG image, not a PDF.`};
  return {ok:true,mime};
}
export function documentExtension(mime:DocumentMime):'jpg'|'png'|'pdf'{
  return mime==='image/jpeg'?'jpg':mime==='image/png'?'png':'pdf';
}
/** Multipart body for `worker-application-documents`: application_id, upload_token, doc_type, file. */
export function buildDocumentForm(receipt:Pick<Receipt,'application_id'|'upload_token'>,type:DocumentType,file:Blob,mime:DocumentMime):FormData{
  const form=new FormData();
  form.set('application_id',receipt.application_id);
  form.set('upload_token',receipt.upload_token);
  form.set('doc_type',type);
  // The part's content type must equal the signature the server detects, whatever the browser guessed.
  form.set('file',new File([file],`${type}.${documentExtension(mime)}`,{type:mime}));
  return form;
}
export async function uploadDocument(config:PortalConfig,receipt:Receipt,type:DocumentType,file:Blob,mime:DocumentMime):Promise<void>{
  const response=await send('upload',`${config.supabaseUrl}/functions/v1/worker-application-documents`,{method:'POST',headers:headers(config),body:buildDocumentForm(receipt,type,file,mime),cache:'no-store',signal:AbortSignal.timeout(60_000)});
  if(!response.ok)throw await applicationFailure('upload',response);
  const body=await response.json().catch(()=>null);
  if(body?.ok!==true)throw new ApplicationError('upload','UNREADABLE_RESPONSE',response.status);
}

export type ApplicationStatus={reference:string;status:Status;documents_received:number};
export const statusCopy:Record<Status,{title:string;body:string}>={
  submitted:{title:'Documents still needed',body:'Your details were received, but document upload is not complete. If this page is still open, retry the upload here. Otherwise contact Kaylo with your reference for help.'},
  under_review:{title:'Application under review',body:'Your details and required documents have been received. Kaylo will review them before deciding on your application. This reference is not a partner login.'},
  changes_requested:{title:'Changes requested',body:'Kaylo needs updated documents before reviewing your application again. Open the secure link sent to your email to see the instructions and submit replacements.'},
  approved:{title:'Application approved',body:'Kaylo sends your partner ID and temporary password to your delivery email after approval. If you have not received them, contact support. Your first sign-in requires a new password.'},
  rejected:{title:'Application not approved',body:'Kaylo has not approved this application. No partner login is available for it. Contact support with your reference for further help.'},
};
export function normalizeReference(value:string):string{return value.trim().toUpperCase();}
export async function checkApplicationStatus(config:PortalConfig,reference:string):Promise<ApplicationStatus>{
  const ref=normalizeReference(reference);
  if(!referencePattern.test(ref))throw new ApplicationError('status','INVALID_REFERENCE');
  const response=await send('status',`${config.supabaseUrl}/rest/v1/rpc/worker_application_status`,{method:'POST',headers:headers(config,{'Content-Type':'application/json',Accept:'application/json'}),body:JSON.stringify({p_reference:ref}),cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw await applicationFailure('status',response);
  const body=await response.json().catch(()=>undefined);
  if(body===null)throw new ApplicationError('status','APPLICATION_NOT_FOUND',response.status);
  if(!body||typeof body.reference!=='string'||typeof body.status!=='string')throw new ApplicationError('status','UNREADABLE_RESPONSE',response.status);
  return {reference:body.reference,status:body.status,documents_received:Number(body.documents_received)||0};
}

// Only safe choices survive a reload. Identity, free text and files stay in memory.
const legacyDraftKey='kaylo.application.draft.v1';
const draftKey='kaylo.application.draft.v2';
const sendingKey='kaylo.application.sending.v1';
const referenceKey='kaylo.application.reference.v1';
export const stepCount=4;
export type StoredDraft={draft:ApplicationDraft;step:number;requestToken:string};
export type StoredSending={receipt:Receipt;uploaded:DocumentType[];role:ApplicationRole};
function storage():Storage|null{
  try{return typeof window==='undefined'?null:window.sessionStorage;}
  catch{return null;}
}
function readJson(key:string):unknown{
  try{const raw=storage()?.getItem(key);return raw?JSON.parse(raw):null;}
  catch{return null;}
}
function writeJson(key:string,value:unknown){
  try{if(value===null)storage()?.removeItem(key);else storage()?.setItem(key,JSON.stringify(value));}
  catch{/* Private browsing can refuse storage; the form still works for this visit. */}
}
const text=(value:unknown,fallback:string)=>typeof value==='string'?value:fallback;
export function loadStoredDraft():StoredDraft|null{
  // Older drafts included identity and bank details. Delete them rather than
  // migrating private values back into the form or a new storage record.
  writeJson(legacyDraftKey,null);
  const stored=readJson(draftKey) as Partial<StoredDraft>|null;
  if(!stored||typeof stored!=='object'||!stored.draft||typeof stored.draft!=='object'){writeJson(draftKey,null);return null;}
  const d=stored.draft as Partial<Record<DraftField,unknown>>;
  const role=applicationRole(d.role);
  const draft:ApplicationDraft={...emptyDraft,role,services:role==='worker'?safeServiceChoices(d.services):[],payout:d.payout==='bank'?'bank':'upi'};
  writeJson(draftKey,{draft:{role,services:draft.services,payout:draft.payout}});
  // Identity, free text, consent, files and payout values must be supplied again.
  // A new attempt token prevents a changed form from resuming an earlier payload.
  return {draft,step:0,requestToken:newRequestToken()};
}
function safeServiceChoices(value:unknown):string[]{
  return Array.isArray(value)?value.filter((v):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)).slice(0,30):[];
}
export function saveStoredDraft(value:StoredDraft){
  writeJson(legacyDraftKey,null);
  const role=applicationRole(value.draft.role);
  writeJson(draftKey,{draft:{role,services:role==='worker'?safeServiceChoices(value.draft.services):[],payout:value.draft.payout==='bank'?'bank':'upi'}});
}
function applicationRole(value:unknown):ApplicationRole{return value==='doctor'||value==='caregiver'?value:'worker';}
export function clearStoredDraft(){writeJson(legacyDraftKey,null);writeJson(draftKey,null);}
export function loadStoredSending():StoredSending|null{
  const stored=readJson(sendingKey) as Partial<StoredSending>|null;
  const receipt=stored?.receipt;
  if(!receipt||typeof receipt.application_id!=='string'||typeof receipt.reference!=='string'||!requestTokenPattern.test(String(receipt.upload_token))||typeof receipt.upload_expires_at!=='string')return null;
  // Pre-Care receipts did not carry a role; they were worker applications.
  if(stored.role!==undefined&&!(applicationRoles as readonly unknown[]).includes(stored.role))return null;
  const role=applicationRole(stored.role),required=requiredApplicationDocuments(role);
  const uploaded=Array.isArray(stored.uploaded)?[...new Set(stored.uploaded.filter((v):v is DocumentType=>required.includes(v)))]:[];
  return {receipt:{application_id:receipt.application_id,reference:receipt.reference,upload_token:receipt.upload_token,upload_expires_at:receipt.upload_expires_at,status:receipt.status??'submitted'},uploaded,role};
}
export function saveStoredSending(value:StoredSending){writeJson(sendingKey,value);}
export function clearStoredSending(){writeJson(sendingKey,null);}
export function loadStoredReference():string{return text(readJson(referenceKey),'');}
export function saveStoredReference(reference:string){writeJson(referenceKey,reference||null);}
