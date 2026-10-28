import publicConfig from '../server/kaylo-public-config.json' with {type:'json'};
export type PortalConfig = { firebaseApiKey: string; supabaseUrl: string; supabaseAnonKey: string };
export type Admin = { email: string; role: 'admin' | 'reviewer' };
export type Status = 'submitted' | 'under_review' | 'changes_requested' | 'approved' | 'rejected';
export const statuses: Record<Status, string> = { submitted: 'Documents pending', under_review: 'Ready for review', changes_requested: 'Changes requested', approved: 'Approved', rejected: 'Rejected' };
export {documentNames, requiredDocuments} from './partner-documents.ts';
export type Application = { application_id: string; reference: string; status: Status; version: number; submitted_at: string; reviewed_at?: string; review_note?: string; worker_id?: string; details: { role?: 'worker'|'doctor'|'caregiver'; medical_council_number?: string; consultation_modes?: string[]; consultation_fee?: number; clinic_address?: string; caregiver_training?: string; hourly_rate?: number; care_services?: string[]; languages?: string[]; full_name: string; email: string; phone: string; profession: string; district: string; experience_years: number; travel_radius_km: number; services?: string[]; upi_id?: string; bank_account?: {account_holder?:string;bank_name?:string;account_number?:string;ifsc?:string} } };
export type ApplicationSummary = Pick<Application,'application_id'|'reference'|'status'|'version'|'submitted_at'> & {full_name:string;profession:string;district:string};
export type ApplicationDocument = { doc_type: string; content_type: string; submitted_at: string; byte_size: number; history?:{history_id:string;uploaded_at:string;storage_path:string}[];storage_path?:string };
export type Delivery = { mail_id:string; kind?:string; event_type?:string; status:string;is_current:boolean; attempts:number; last_error?:string; sent_at?:string; created_at?:string };
export type AuditEvent = { event_id?:string; action:string; actor_uid?:string; actor_email?:string; created_at:string; data?:Record<string,unknown> };
export type Certificate = { certificate_id:string; issued_at:string; reference?:string; storage_path?:string; snapshot?:Record<string,unknown> };
export type Detail = { application:Application; documents:ApplicationDocument[]; audit:AuditEvent[]; deliveries:Delivery[]; certificate:Certificate|null };
export type Correction = { reference:string; status:Status; version:number; application_version?:number; expires_at?:string; completed?:boolean; requested_documents:{doc_type:string;note:string;received:boolean}[] };

export class PortalError extends Error { status:number;code:string;constructor(message:string,status=0,code='') { super(message);this.status=status;this.code=code; } }
const messages:Record<string,string> = {
  ADMIN_ONLY:'This account does not have Kaylo administrator access.', FORBIDDEN:'You do not have permission for this action.',
  INVALID_TOKEN:'Your session has expired. Please sign in again.', UNAUTHORIZED:'Please sign in again.',
  VERSION_CONFLICT:'This application changed while you were reviewing it. Refresh it and check the latest documents.',
  APPLICATION_VERSION_CONFLICT:'This application changed while you were reviewing it. Refresh it and check the latest documents.',
  ALL_DOCUMENTS_REQUIRED:'All required documents must be received and reviewed before approval.',
  CORRECTION_NOT_ALLOWED:'This correction link has expired or the application has already been updated.',
  CORRECTION_LINK_EXPIRED:'This link has expired. Contact Kaylo to request a new document-update link.',
  CORRECTION_LINK_INVALID:'This link has been replaced by a newer request. Open the latest Kaylo email.',
  MISSING_DOCUMENT_MUST_BE_REQUESTED:'Include every missing document in the change request.',
  INVALID_CORRECTION_TOKEN:'This correction link is invalid or has expired. Ask Kaylo for a new link.',
  FILE_TOO_LARGE:'Choose a file smaller than 10 MB.', INVALID_FILE_TYPE:'Use an original JPEG, PNG or PDF file.',
  PORTAL_NOT_CONFIGURED:'The review portal is awaiting its backend configuration. Please try again later.',
};
async function readResponse(response:Response) {
  const body = await response.json().catch(()=>null);
  if(!response.ok || body?.ok===false) {
    const code=typeof body?.error?.message==='string'?body.error.message:typeof body?.code==='string'?body.code:typeof body?.error==='string'?body.error:'';
    throw new PortalError(messages[code] || (response.status===401?'Your session has expired. Please sign in again.':response.status===403?'This account does not have permission for this action.':response.status===409?'The application has changed. Refresh and review it again.':'We could not complete that request. Your saved application is safe. Please retry.'),response.status,code);
  }
  if(!body) throw new PortalError('The server returned an unreadable response. Please retry.');
  return body;
}
export async function loadPortalConfig():Promise<PortalConfig> {
  const config:PortalConfig={firebaseApiKey:publicConfig.firebaseApiKey,supabaseUrl:publicConfig.supabaseUrl,supabaseAnonKey:publicConfig.supabaseAnonKey};
  if(!config.firebaseApiKey||!config.supabaseUrl||!config.supabaseAnonKey) throw new PortalError(messages.PORTAL_NOT_CONFIGURED);
  return config;
}
// Tokens stay in memory. Signing out or closing/reloading the tab clears them.
export class AdminSession {
  private token=''; private refresh=''; private expires=0; private refreshing:Promise<void>|null=null;
  private generation=0;
  private reads=new Map<string,Promise<unknown>>();
  private config:PortalConfig;
  constructor(config:PortalConfig){this.config=config;}
  async signIn(email:string,password:string):Promise<Admin> {
    this.signOut();
    const generation=this.generation;
    const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(this.config.firebaseApiKey)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.trim(),password,returnSecureToken:true})});
    const b=await r.json();
    if(generation!==this.generation) throw new PortalError('Please sign in again.',401,'SESSION_CHANGED');
    if(!r.ok) throw new PortalError(b.error?.message==='TOO_MANY_ATTEMPTS_TRY_LATER'?'Too many attempts. Please wait before trying again.':'Unable to sign in. Check your administrator email and password.');
    this.token=b.idToken;this.refresh=b.refreshToken;this.expires=Date.now()+Number(b.expiresIn)*1000;
    try { const result=await this.request<{admin:Admin}>('session'); return result.admin; }
    catch(error){if(generation===this.generation)this.signOut();throw error;}
  }
  signOut(){this.generation++;this.token='';this.refresh='';this.expires=0;this.refreshing=null;this.reads.clear();}
  private async renewToken(){
      const generation=this.generation;
      const currentRefresh=this.refresh;
      const r=await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(this.config.firebaseApiKey)}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:currentRefresh})});
      const b=await r.json();
      if(generation!==this.generation) throw new PortalError('Please sign in again.',401,'SESSION_CHANGED');
      if(!r.ok||this.refresh!==currentRefresh){this.signOut();throw new PortalError('Please sign in again.',401);}
      this.token=b.id_token;this.refresh=b.refresh_token;this.expires=Date.now()+Number(b.expires_in)*1000;
  }
  private async accessToken(){
    if(!this.token) throw new PortalError('Please sign in again.',401);
    if(this.expires-Date.now()<60000){
      if(!this.refreshing){
        const pending=this.renewToken().finally(()=>{if(this.refreshing===pending)this.refreshing=null;});
        this.refreshing=pending;
      }
      await this.refreshing;
    }
    return this.token;
  }
  request<T>(action:string,params:Record<string,unknown>={}):Promise<T>{
    // Share only identical reads already in flight. Every later request still
    // checks the live backend role/session; writes and signed document links
    // are never cached or coalesced.
    const key=['session','list','detail'].includes(action)?JSON.stringify({action,...params}):null;
    if(key){const pending=this.reads.get(key);if(pending)return pending as Promise<T>;}
    else this.reads.clear();
    const pending=this.send<T>(action,params).finally(()=>{if(key&&this.reads.get(key)===pending)this.reads.delete(key);});
    if(key)this.reads.set(key,pending);
    return pending;
  }
  private async send<T>(action:string,params:Record<string,unknown>):Promise<T>{
    const generation=this.generation;
    const token=await this.accessToken();
    if(generation!==this.generation) throw new PortalError('Please sign in again.',401,'SESSION_CHANGED');
    const result=await readResponse(await fetch(`${this.config.supabaseUrl}/functions/v1/admin-applications`,{method:'POST',headers:{'Content-Type':'application/json',apikey:this.config.supabaseAnonKey,Authorization:`Bearer ${token}`},body:JSON.stringify({action,...params}),cache:'no-store'}));
    if(generation!==this.generation) throw new PortalError('Please sign in again.',401,'SESSION_CHANGED');
    return result as T;
  }
}
export async function correctionRequest(config:PortalConfig,body:FormData|{token:string}):Promise<{application:Correction}>{
  const form=body instanceof FormData;
  return readResponse(await fetch(`${config.supabaseUrl}/functions/v1/application-corrections`,{method:'POST',headers:{apikey:config.supabaseAnonKey,...(!form?{'Content-Type':'application/json'}:{})},body:form?body:JSON.stringify({action:'info',...body}),cache:'no-store'}));
}
export function formatDate(value?:string){return value?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(value)):'Not yet';}
