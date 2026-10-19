'use client';
import {useCallback,useEffect,useRef,useState,type ChangeEvent,type FormEvent,type ReactNode} from 'react';
import {AnimatePresence,motion,useReducedMotion} from 'motion/react';
import {ArrowLeft,ArrowRight,Check,CheckCircle2,Clock3,Copy,FileText,LoaderCircle,RefreshCw,Search,Upload,X} from 'lucide-react';
import {loadPortalConfig,type PortalConfig} from '@/lib/admin-api';
import {sitePath} from '@/lib/site-path';
import {
  ApplicationError,applicationErrorMessage,canonicalPhone,checkApplicationStatus,checkDocument,clearStoredDraft,clearStoredSending,documentHints,documentLabels,
  documentTypes,emptyDraft,imageOnlyDocuments,keralaDistricts,listServices,loadStoredDraft,loadStoredReference,loadStoredSending,newRequestToken,receiptUsable,
  saveStoredDraft,saveStoredReference,saveStoredSending,statusCopy,stepCount,submitWorkerApplication,toDetails,uploadDocument,validateConsent,validateIdentity,
  validatePayout,validateWork,type ApplicationDraft,type ApplicationStatus,type DocumentMime,type DocumentType,type DraftErrors,type DraftField,type Receipt,type ServiceOption,
} from '@/lib/worker-application';

const steps=['About you','Your work & service area','Your documents','Payout & consent'];
const supportEmail='kayloapp@gmail.com';
type Picked={file:File;mime:DocumentMime;preview:string|null};
type Sending={receipt:Receipt;uploaded:DocumentType[];current:DocumentType|null;verifying:boolean;error:string;closed:boolean};
type Lookup={reference:string;result:ApplicationStatus|null;error:string;busy:boolean;auto:boolean};
type View='form'|'sending'|'status';
const errorText=(e:unknown)=>e instanceof Error?e.message:'Something went wrong. Please retry.';
const fileSize=(bytes:number)=>bytes<1024*1024?`${Math.max(1,Math.round(bytes/1024))} KB`:`${(bytes/1024/1024).toFixed(1)} MB`;
const supportLink=(reference:string)=>`mailto:${supportEmail}?subject=${encodeURIComponent(`Partner application help: ${reference}`)}`;

function Field({id,label,hint,error,full,children}:{id:string;label:string;hint?:string;error?:string;full?:boolean;children:ReactNode}){
  return <div className={`app-field${full?' full':''}${error?' has-error':''}`}>
    <label htmlFor={id}>{label}</label>
    {children}
    {hint&&<p className="app-hint" id={`${id}-hint`}>{hint}</p>}
    {error&&<p className="app-field-error" id={`${id}-error`} role="alert">{error}</p>}
  </div>;
}
function describedBy(id:string,hint?:string,error?:string){
  const ids=[hint?`${id}-hint`:'',error?`${id}-error`:''].filter(Boolean);
  return ids.length?ids.join(' '):undefined;
}
function CopyReference({reference}:{reference:string}){
  const [copied,setCopied]=useState(false);
  async function copy(){
    try{await navigator.clipboard.writeText(reference);setCopied(true);setTimeout(()=>setCopied(false),2000);}
    catch{/* Clipboard access can be refused; the reference stays selectable. */}
  }
  return <button type="button" className="app-copy" onClick={copy} aria-live="polite">{copied?<><Check size={15}/> Copied</>:<><Copy size={15}/> Copy reference</>}</button>;
}

export function WorkerApplication(){
  const reduced=useReducedMotion();
  const [config,setConfig]=useState<PortalConfig|null>(null);
  const [configError,setConfigError]=useState('');
  const [view,setView]=useState<View>('form');
  const [restored,setRestored]=useState(false);
  const [draft,setDraft]=useState<ApplicationDraft>(emptyDraft);
  const [step,setStep]=useState(0);
  const [direction,setDirection]=useState(1);
  const token=useRef('');
  const [errors,setErrors]=useState<DraftErrors>({});
  const [formError,setFormError]=useState('');
  const [services,setServices]=useState<ServiceOption[]|null>(null);
  const [servicesError,setServicesError]=useState('');
  const [picked,setPicked]=useState<Partial<Record<DocumentType,Picked>>>({});
  const [docErrors,setDocErrors]=useState<Partial<Record<DocumentType,string>>>({});
  const [busy,setBusy]=useState(false);
  const [sending,setSending]=useState<Sending|null>(null);
  const [lookup,setLookup]=useState<Lookup>({reference:'',result:null,error:'',busy:false,auto:false});
  const [justSubmitted,setJustSubmitted]=useState(false);
  const shell=useRef<HTMLDivElement>(null);
  const title=useRef<HTMLHeadingElement>(null);
  const pickedRef=useRef(picked);
  pickedRef.current=picked;
  const inputs=useRef<Partial<Record<DocumentType,HTMLInputElement|null>>>({});

  useEffect(()=>{
    loadPortalConfig().then(setConfig).catch(e=>setConfigError(errorText(e)));
    const storedDraft=loadStoredDraft();
    const storedSending=loadStoredSending();
    const reference=loadStoredReference();
    if(storedDraft){setDraft(storedDraft.draft);setStep(storedDraft.step);token.current=storedDraft.requestToken;}
    else token.current=newRequestToken();
    if(storedSending){
      setSending({receipt:storedSending.receipt,uploaded:storedSending.uploaded,current:null,verifying:false,error:'',closed:!receiptUsable(storedSending.receipt)});
      setView('sending');
    }else if(reference&&!storedDraft){
      setLookup({reference,result:null,error:'',busy:false,auto:true});
      setView('status');
    }
    setRestored(true);
  },[]);
  useEffect(()=>{if(restored&&view==='form')saveStoredDraft({draft,step,requestToken:token.current});},[draft,step,restored,view]);
  useEffect(()=>()=>{for(const doc of Object.values(pickedRef.current))if(doc?.preview)URL.revokeObjectURL(doc.preview);},[]);

  const loadServices=useCallback(async()=>{
    if(!config)return;
    setServicesError('');setServices(null);
    try{setServices(await listServices(config));}
    catch(e){setServicesError(errorText(e));}
  },[config]);
  useEffect(()=>{void loadServices();},[loadServices]);

  const runLookup=useCallback(async(reference:string)=>{
    if(!config)return;
    setLookup(s=>({...s,reference,busy:true,error:'',result:null,auto:false}));
    try{const result=await checkApplicationStatus(config,reference);setLookup(s=>({...s,result,busy:false}));}
    catch(e){setLookup(s=>({...s,error:errorText(e),busy:false}));}
  },[config]);
  useEffect(()=>{if(config&&view==='status'&&lookup.auto&&lookup.reference)void runLookup(lookup.reference);},[config,view,lookup.auto,lookup.reference,runLookup]);

  function update<K extends DraftField>(key:K,value:ApplicationDraft[K]){
    setDraft(d=>({...d,[key]:value}));
    setErrors(e=>e[key]?{...e,[key]:undefined}:e);
    setFormError('');
  }
  function toggleService(id:string){update('services',draft.services.includes(id)?draft.services.filter(s=>s!==id):[...draft.services,id]);}
  function stepErrors(current:number):DraftErrors{
    if(current===0)return validateIdentity(draft);
    if(current===1)return validateWork(draft,(services??[]).map(s=>s.service_id));
    if(current===3)return {...validatePayout(draft),...validateConsent(draft)};
    return {};
  }
  function go(to:number){
    setDirection(to>step?1:-1);setStep(to);setErrors({});setFormError('');
    requestAnimationFrame(()=>{title.current?.focus({preventScroll:true});shell.current?.scrollIntoView({block:'start',behavior:reduced?'auto':'smooth'});});
  }
  function next(){
    const found=stepErrors(step);
    const missing=step===2?documentTypes.filter(t=>!picked[t]):[];
    if(Object.keys(found).length||missing.length){
      setErrors(found);
      if(missing.length)setFormError('Add all five documents to continue.');
      const first=Object.keys(found)[0];
      if(first)document.getElementById(first)?.focus();
      else if(missing[0])inputs.current[missing[0]]?.parentElement?.querySelector<HTMLButtonElement>('button')?.focus();
      return;
    }
    if(step<stepCount-1){go(step+1);return;}
    void send();
  }
  async function pick(type:DocumentType,event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];
    event.target.value='';
    if(!file)return;
    const check=await checkDocument(type,file);
    if(!check.ok){setDocErrors(d=>({...d,[type]:check.message}));return;}
    setDocErrors(d=>({...d,[type]:undefined}));setFormError('');
    setPicked(p=>{
      if(p[type]?.preview)URL.revokeObjectURL(p[type].preview);
      return {...p,[type]:{file,mime:check.mime,preview:check.mime==='application/pdf'?null:URL.createObjectURL(file)}};
    });
  }
  function remove(type:DocumentType){
    setPicked(p=>{const next={...p};if(next[type]?.preview)URL.revokeObjectURL(next[type].preview);delete next[type];return next;});
  }
  async function send(){
    if(!config||busy)return;
    setBusy(true);setFormError('');
    try{
      const receipt=await submitWorkerApplication(config,toDetails(draft),token.current);
      const state:Sending={receipt,uploaded:[],current:null,verifying:false,error:'',closed:false};
      saveStoredSending({receipt,uploaded:[]});saveStoredReference(receipt.reference);clearStoredDraft();
      setSending(state);setView('sending');
      requestAnimationFrame(()=>shell.current?.scrollIntoView({block:'start',behavior:reduced?'auto':'smooth'}));
      await uploadAll(state);
    }catch(e){
      // A definite refusal means these details will never be accepted as sent: edit and try again with a new token.
      if(e instanceof ApplicationError&&e.isDefiniteRejection)token.current=newRequestToken();
      setFormError(errorText(e));
    }finally{setBusy(false);}
  }
  async function uploadAll(start:Sending){
    if(!config)return;
    let state:Sending={...start,error:'',closed:false,verifying:false};
    setSending(state);setBusy(true);
    try{
      for(const type of documentTypes){
        if(state.uploaded.includes(type))continue;
        const doc=pickedRef.current[type];
        if(!doc){state={...state,current:null,error:`Choose your ${documentLabels[type].toLowerCase()} again, then retry.`};setSending(state);return;}
        state={...state,current:type};setSending(state);
        try{await uploadDocument(config,state.receipt,type,doc.file,doc.mime);}
        catch(e){state={...state,current:null,error:errorText(e),closed:e instanceof ApplicationError&&e.isUploadClosed};setSending(state);return;}
        state={...state,uploaded:[...state.uploaded,type],current:null};setSending(state);
        saveStoredSending({receipt:state.receipt,uploaded:state.uploaded});
      }
      state={...state,verifying:true};setSending(state);
      const result=await checkApplicationStatus(config,state.receipt.reference);
      if(result.documents_received<documentTypes.length||result.status==='submitted'){state={...state,verifying:false,error:applicationErrorMessage('UPLOAD_INCOMPLETE')};setSending(state);return;}
      clearStoredSending();
      setPicked(p=>{for(const doc of Object.values(p))if(doc?.preview)URL.revokeObjectURL(doc.preview);return {};});
      setDraft(emptyDraft);setStep(0);token.current=newRequestToken();
      setSending(null);setJustSubmitted(true);
      setLookup({reference:result.reference,result,error:'',busy:false,auto:false});
      setView('status');
      requestAnimationFrame(()=>shell.current?.scrollIntoView({block:'start',behavior:reduced?'auto':'smooth'}));
    }catch(e){state={...state,verifying:false,error:errorText(e)};setSending(state);}
    finally{setBusy(false);}
  }
  function openStatus(reference:string){
    setJustSubmitted(false);
    setLookup({reference,result:null,error:'',busy:false,auto:false});
    setView('status');
  }
  function startNew(){
    saveStoredReference('');setJustSubmitted(false);
    setLookup({reference:'',result:null,error:'',busy:false,auto:false});
    setErrors({});setFormError('');setDirection(1);setStep(0);
    setView('form');
  }

  const variants={
    enter:(dir:number)=>({opacity:0,x:reduced?0:dir*28}),
    center:{opacity:1,x:0},
    exit:(dir:number)=>({opacity:0,x:reduced?0:dir*-28}),
  };
  const transition={duration:reduced?0:.32,ease:[.22,1,.36,1] as [number,number,number,number]};
  const chosenServices=(services??[]).filter(s=>draft.services.includes(s.service_id)).map(s=>s.service_name);
  const pickedCount=documentTypes.filter(t=>picked[t]).length;
  const input=(key:DraftField,hint=false)=>({
    id:key,value:String(draft[key]),onChange:(e:ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>update(key,e.target.value as ApplicationDraft[typeof key]),
    'aria-invalid':errors[key]?true:undefined,'aria-describedby':describedBy(key,hint?'hint':undefined,errors[key]),disabled:busy,
  });

  if(view==='sending'&&sending){
    const s=sending;
    return <div ref={shell} className="professional-form application app-sending" aria-busy={busy}>
      <div className="form-title"><p className="eyebrow">{s.closed?'UPLOAD PAUSED':'ALMOST THERE'}</p><h2>Finish sending<br/><em>your application.</em></h2>
        <p>Your application is only ready for review when all five documents are received. Retry continues the same application. If you close this page before finishing, contact Kaylo with your reference.</p></div>
      <div className="app-reference"><span>Application reference</span><strong>{s.receipt.reference}</strong><CopyReference reference={s.receipt.reference}/></div>
      <p className="app-progress-label" aria-live="polite">{s.verifying?'Confirming with Kaylo…':`${s.uploaded.length} of ${documentTypes.length} documents received`}</p>
      <div className="app-bar" role="progressbar" aria-label="Documents received" aria-valuemin={0} aria-valuemax={documentTypes.length} aria-valuenow={s.uploaded.length}><motion.div initial={false} animate={{width:`${s.uploaded.length/documentTypes.length*100}%`}} transition={{duration:reduced?0:.4}}/></div>
      <ul className="app-doc-list">{documentTypes.map(type=>{
        const received=s.uploaded.includes(type),uploading=s.current===type,missing=!received&&!picked[type];
        return <li key={type} className={received?'received':uploading?'uploading':''}>
          {received?<CheckCircle2 size={20}/>:uploading?<LoaderCircle size={20}/>:<Clock3 size={20}/>}
          <span className="app-doc-name">{documentLabels[type]}</span>
          {missing&&!s.closed?<>
            <input ref={el=>{inputs.current[type]=el;}} className="app-sr" type="file" tabIndex={-1} accept={imageOnlyDocuments.has(type)?'image/jpeg,image/png':'image/jpeg,image/png,application/pdf'} onChange={e=>void pick(type,e)} aria-label={`Choose ${documentLabels[type]}`}/>
            <button type="button" className="app-doc-button" disabled={busy} onClick={()=>inputs.current[type]?.click()}>Choose again</button>
          </>:<span>{received?'Received':uploading?'Uploading…':picked[type]?'Waiting':'Not sent'}</span>}
          {docErrors[type]&&<p className="app-field-error" role="alert">{docErrors[type]}</p>}
        </li>;})}</ul>
      {s.error&&<p className="form-error" role="alert">{s.error}</p>}
      {s.closed
        ?<a className="button form-submit" href={supportLink(s.receipt.reference)}>Email Kaylo with your reference</a>
        :<button type="button" className="button form-submit" disabled={busy} onClick={()=>void uploadAll(s)}>{busy?<><LoaderCircle className="form-spinner" size={17}/> Uploading…</>:<><RefreshCw size={17}/> Retry upload</>}</button>}
      <p className="form-note">Keep this page open until all documents finish uploading. The upload link lasts 24 hours; after that only Kaylo can request the missing documents.</p>
    </div>;
  }

  if(view==='status'){
    const result=lookup.result;
    const copy=result?statusCopy[result.status]??{title:result.status,body:''}:null;
    const showNext=justSubmitted||result?.status==='under_review';
    return <div ref={shell} className="application-success application app-status" role="status" aria-busy={lookup.busy}>
      {justSubmitted?<><CheckCircle2 size={44} strokeWidth={1.3}/><p className="eyebrow">APPLICATION RECEIVED</p><h2>Your skill.<br/>A new beginning.</h2>
        <p>Thank you. Your details and all five documents have reached Kaylo. Keep your reference; it is how you check progress and how support finds your application.</p></>
      :<><p className="eyebrow">YOUR APPLICATION</p><h2>Check your<br/><em>application status.</em></h2><p>Enter your application reference to see its status. Personal details and documents are never displayed here.</p></>}
      {justSubmitted
        ?<div className="app-reference"><span>Application reference</span><strong>{lookup.reference}</strong><CopyReference reference={lookup.reference}/></div>
        :<form className="app-status-form" noValidate onSubmit={(e:FormEvent)=>{e.preventDefault();void runLookup(lookup.reference);}}>
          <div className="app-field"><label htmlFor="reference">Application reference</label><input id="reference" value={lookup.reference} onChange={e=>setLookup(s=>({...s,reference:e.target.value,result:null,error:''}))} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={80} disabled={lookup.busy}/></div>
          <button className="button" disabled={lookup.busy||!config}>{lookup.busy?<><LoaderCircle className="form-spinner" size={17}/> Checking…</>:<><Search size={17}/> Check application status</>}</button>
        </form>}
      {configError&&<p className="form-error" role="alert">{configError}</p>}
      {lookup.error&&<p className="form-error" role="alert">{lookup.error}</p>}
      {result&&copy&&<section className="app-status-card" aria-live="polite"><h3>{copy.title}</h3><p>{copy.body}</p><p className="app-status-count">{result.documents_received} of {documentTypes.length} documents received</p>{justSubmitted&&<button type="button" className="app-link app-refresh" disabled={lookup.busy} onClick={()=>void runLookup(lookup.reference)}>{lookup.busy?<><LoaderCircle className="form-spinner" size={15}/> Checking…</>:<><RefreshCw size={15}/> Refresh status</>}</button>}</section>}
      {showNext&&<><h3 className="app-next-title">What happens next</h3><ol className="app-next">
        <li>Kaylo reviews your details and all five documents.</li>
        <li>If approved, your partner ID and a temporary password arrive at your delivery email, with your approval certificate.</li>
        <li>Sign in on the Kaylo Partner app with that partner ID and set a new password. Work opens after that.</li>
      </ol></>}
      <p className="form-privacy">If Kaylo needs a change, you will get an email with a secure link that works for seven days. Open it to replace only the documents requested; it opens the <a href={sitePath('/application/update/')}>document update page</a>.</p>
      <p className="form-note">Need help? Email <a href={supportLink(lookup.reference||'')}>{supportEmail}</a> with your reference.</p>
      <button type="button" className="app-link" onClick={startNew}>Start a new application</button>
    </div>;
  }

  return <div ref={shell} className="professional-form application" aria-busy={busy}>
    <div className="form-title"><p className="eyebrow">APPLY TO KAYLO</p><h2>Bring your skill.<br/><em>We’ll start there.</em></h2>
      <p>Apply without an account. Kaylo reviews your details and documents before issuing a partner login.</p></div>
    <div className="app-progress" aria-hidden="true">{steps.map((label,i)=><span key={label} className={i<=step?'done':''}/>)}</div>
    <p className="app-step-count">Step {step+1} of {stepCount}</p>
    <h3 className="app-step-title" ref={title} tabIndex={-1}>{steps[step]}</h3>
    {configError&&<p className="form-error" role="alert">{configError}</p>}
    {formError&&<p className="form-error" role="alert">{formError}</p>}
    <form noValidate onSubmit={e=>{e.preventDefault();next();}}>
      <div className="app-step">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div key={step} custom={direction} variants={variants} initial="enter" animate="center" exit="exit" transition={transition}>
            {step===0&&<div className="app-fields">
              <Field id="fullName" label="Full name" error={errors.fullName}><input {...input('fullName')} autoComplete="name" maxLength={120}/></Field>
              <Field id="phone" label="Phone number" hint="Include the country code, like +91." error={errors.phone}><input {...input('phone',true)} type="tel" inputMode="tel" autoComplete="tel" maxLength={24} placeholder="+91"/></Field>
              <Field id="email" label="Delivery email" full hint="Use an email you can access. Kaylo sends your partner ID and temporary password here after approval." error={errors.email}><input {...input('email',true)} type="email" inputMode="email" autoComplete="email" maxLength={254}/></Field>
            </div>}
            {step===1&&<div className="app-fields">
              <Field id="profession" label="Profession" full error={errors.profession}><input {...input('profession')} autoComplete="organization-title" maxLength={120}/></Field>
              <div className={`app-field full${errors.services?' has-error':''}`} role="group" aria-labelledby="services-label" aria-describedby={errors.services?'services-error':undefined}>
                <span className="app-label" id="services-label">Services you offer</span>
                {services===null&&!servicesError&&<p className="app-hint"><LoaderCircle className="form-spinner" size={15}/> Loading services…</p>}
                {servicesError&&<p className="app-field-error" role="alert">{servicesError} <button type="button" className="app-link" onClick={()=>void loadServices()}>Retry</button></p>}
                {services&&services.length===0&&<p className="app-hint">The service catalogue is not available yet. Please try again later.</p>}
                {services&&services.length>0&&<div className="app-chips">{services.map(s=>{const on=draft.services.includes(s.service_id);return <button type="button" key={s.service_id} className="app-chip" aria-pressed={on} disabled={busy} onClick={()=>toggleService(s.service_id)}>{on&&<Check size={15}/>}{s.service_name}</button>;})}</div>}
                {errors.services&&<p className="app-field-error" id="services-error" role="alert">{errors.services}</p>}
              </div>
              <Field id="experienceYears" label="Experience (years)" error={errors.experienceYears}><input {...input('experienceYears')} inputMode="numeric" maxLength={2}/></Field>
              <Field id="district" label="District" error={errors.district}><select {...input('district')}><option value="" disabled>Choose your district</option>{keralaDistricts.map(d=><option key={d} value={d}>{d}</option>)}</select></Field>
              <Field id="travelRadiusKm" label="Travel radius (km)" error={errors.travelRadiusKm}><input {...input('travelRadiusKm')} inputMode="numeric" maxLength={3}/></Field>
            </div>}
            {step===2&&<>
              <p className="app-intro">Add all five documents. Use JPG or PNG for photos; JPG, PNG or PDF for other documents. Maximum 10 MB per file.</p>
              <ul className="app-docs">{documentTypes.map(type=>{
                const doc=picked[type],error=docErrors[type],imageOnly=imageOnlyDocuments.has(type);
                return <li key={type} className={`app-doc${doc?' ready':''}`}>
                  <div className="app-doc-preview" aria-hidden="true">{doc?.preview?<img src={doc.preview} alt=""/>:doc?<FileText size={26}/>:<Upload size={22}/>}</div>
                  <div className="app-doc-body">
                    <strong id={`doc-${type}-label`}>{documentLabels[type]}</strong>
                    <p className="app-hint" id={`doc-${type}-hint`}>{doc?`${doc.file.name} · ${fileSize(doc.file.size)}`:`${documentHints[type]} ${imageOnly?'JPG or PNG.':'JPG, PNG or PDF.'}`}</p>
                    {error&&<p className="app-field-error" id={`doc-${type}-error`} role="alert">{error}</p>}
                  </div>
                  <div className="app-doc-actions">
                    <input ref={el=>{inputs.current[type]=el;}} className="app-sr" type="file" tabIndex={-1} accept={imageOnly?'image/jpeg,image/png':'image/jpeg,image/png,application/pdf'} onChange={e=>void pick(type,e)} aria-labelledby={`doc-${type}-label`} aria-describedby={describedBy(`doc-${type}`,'hint',error)}/>
                    <button type="button" className="app-doc-button" disabled={busy} onClick={()=>inputs.current[type]?.click()} aria-describedby={`doc-${type}-label`}>{doc?'Replace':'Choose a file'}</button>
                    {doc&&<button type="button" className="app-doc-remove" disabled={busy} onClick={()=>remove(type)} aria-label={`Remove ${documentLabels[type]}`}><X size={17}/></button>}
                  </div>
                </li>;})}</ul>
              <p className="form-privacy">Documents are uploaded privately for Kaylo’s application review. They are not shown in the public status lookup.</p>
            </>}
            {step===3&&<>
              <div className="app-segmented" role="radiogroup" aria-label="Payout method">
                <button type="button" role="radio" aria-checked={draft.payout==='upi'} disabled={busy} onClick={()=>update('payout','upi')}>UPI</button>
                <button type="button" role="radio" aria-checked={draft.payout==='bank'} disabled={busy} onClick={()=>update('payout','bank')}>Bank account</button>
              </div>
              <div className="app-fields">
                {draft.payout==='upi'
                  ?<Field id="upiId" label="UPI ID" full error={errors.upiId}><input {...input('upiId')} placeholder="name@bank" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={100}/></Field>
                  :<>
                    <Field id="accountHolder" label="Account holder name" error={errors.accountHolder}><input {...input('accountHolder')} autoComplete="name" maxLength={120}/></Field>
                    <Field id="bankName" label="Bank name" error={errors.bankName}><input {...input('bankName')} autoComplete="off" maxLength={120}/></Field>
                    <Field id="accountNumber" label="Account number" error={errors.accountNumber}><input {...input('accountNumber')} type="password" inputMode="numeric" autoComplete="off" maxLength={18}/></Field>
                    <Field id="confirmAccountNumber" label="Confirm account number" error={errors.confirmAccountNumber}><input {...input('confirmAccountNumber')} inputMode="numeric" autoComplete="off" maxLength={18}/></Field>
                    <Field id="ifsc" label="IFSC code" error={errors.ifsc}><input {...input('ifsc')} className="app-upper" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={11}/></Field>
                  </>}
              </div>
              <section className="app-review" aria-labelledby="review-title">
                <h4 id="review-title">Check your details before sending.</h4>
                <dl>
                  <div><dt>Name</dt><dd>{draft.fullName.trim()||'Not entered'}</dd></div>
                  <div><dt>Phone</dt><dd>{draft.phone.trim()?canonicalPhone(draft.phone):'Not entered'}</dd></div>
                  <div><dt>Delivery email</dt><dd>{draft.email.trim().toLowerCase()||'Not entered'}</dd></div>
                  <div><dt>Profession</dt><dd>{draft.profession.trim()||'Not entered'}</dd></div>
                  <div><dt>Services</dt><dd>{chosenServices.length?chosenServices.join(', '):'None chosen'}</dd></div>
                  <div><dt>Experience</dt><dd>{draft.experienceYears.trim()?`${draft.experienceYears.trim()} years`:'Not entered'}</dd></div>
                  <div><dt>Service area</dt><dd>{draft.district?`${draft.district} · ${draft.travelRadiusKm.trim()||'?'} km radius`:'Not chosen'}</dd></div>
                  <div><dt>Documents</dt><dd>{pickedCount} of {documentTypes.length} added</dd></div>
                  <div><dt>Payout</dt><dd>{draft.payout==='upi'?(draft.upiId.trim()?`UPI ${draft.upiId.trim()}`:'UPI, not entered'):(draft.accountNumber.trim().length>=4?`${draft.bankName.trim()||'Bank'} account ending ${draft.accountNumber.trim().slice(-4)}`:'Bank account, not entered')}</dd></div>
                </dl>
                <p>To change something, go back. Your answers stay filled in.</p>
              </section>
              <label className={`form-consent${errors.consent?' has-error':''}`}><input type="checkbox" id="consent" checked={draft.consent} disabled={busy} onChange={e=>update('consent',e.target.checked)} aria-invalid={errors.consent?true:undefined} aria-describedby={errors.consent?'consent-error':undefined}/><span>I confirm these details are mine and accurate, and consent to Kaylo storing and reviewing my details and documents for partner verification.</span></label>
              {errors.consent&&<p className="app-field-error" id="consent-error" role="alert">{errors.consent}</p>}
              <p className="form-note">Keep this page open until all documents finish uploading. If your connection drops, retry here without creating another application.</p>
            </>}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="app-actions">
        {step>0&&<button type="button" className="button light" disabled={busy} onClick={()=>go(step-1)}><ArrowLeft size={18}/> Back</button>}
        <button className="button" disabled={busy||(step===stepCount-1&&!config)}>{step<stepCount-1?<>Continue <ArrowRight size={18}/></>:busy?<><LoaderCircle className="form-spinner" size={17}/> Sending…</>:'Submit application'}</button>
      </div>
    </form>
    <p className="form-privacy">Your details are shared only with the Kaylo team to review your application. To update or delete them, contact <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.</p>
    <p className="form-note">Already applied? <button type="button" className="app-link" onClick={()=>openStatus('')}>Check your application status</button></p>
  </div>;
}
