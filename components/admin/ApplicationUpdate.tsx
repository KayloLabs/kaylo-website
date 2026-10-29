'use client';
import {sitePath} from '../../lib/site-path';
import {Wordmark} from '../Logo';
import {useCallback,useEffect,useRef,useState} from 'react';
import {readCorrectionLink} from '../../lib/correction-link';
import {checkDocument,type DocumentType} from '../../lib/worker-application';
import {ArrowUpRight,CheckCircle2,FileText,LoaderCircle,LockKeyhole,RefreshCw,Upload} from 'lucide-react';
import {correctionRequest,documentNames,formatDate,loadPortalConfig,type Correction,type PortalConfig} from '../../lib/admin-api';
export default function ApplicationUpdate(){
 const token=useRef('');const [config,setConfig]=useState<PortalConfig|null>(null);const [application,setApplication]=useState<Correction|null>(null);
 const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [busy,setBusy]=useState('');const [notice,setNotice]=useState('');const [files,setFiles]=useState<Record<string,File>>({});
 const operation=useRef<AbortController|null>(null);
 const linkRead=useRef(false);
 const load=useCallback(async()=>{
  operation.current?.abort();
  const controller=new AbortController();operation.current=controller;
  setLoading(true);setError('');
  try{
   if(!token.current)throw new Error('Open the secure link in your Kaylo email to update your documents.');
   const c=await loadPortalConfig();
   if(controller.signal.aborted)return;
   setConfig(c);
   const r=await correctionRequest(c,{token:token.current},{signal:controller.signal});
   if(!controller.signal.aborted)setApplication(r.application);
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to load this application.');}
  finally{if(!controller.signal.aborted)setLoading(false);}
 },[]);
 useEffect(()=>{
  if(!linkRead.current){
   linkRead.current=true;
   const link=readCorrectionLink(window.location.hash);token.current=link.token;
   // No capability is persisted. Reloading requires reopening the original email.
   if(link.token)window.history.replaceState(window.history.state,'',`${window.location.pathname}${window.location.search}${link.replacementHash}`);
  }
  void load();
  return()=>operation.current?.abort();
 },[load]);
 async function upload(type:string){
  if(!config||!files[type]||busy)return;
  const file=files[type];setError('');setNotice('');
  setBusy(type);
  const controller=new AbortController();operation.current=controller;
  try{
   const checked=await checkDocument(type as DocumentType,file);
   if(controller.signal.aborted)return;
   if(!checked.ok){setError(checked.message);return;}
   const form=new FormData();form.set('token',token.current);form.set('doc_type',type);
   form.set('file',new File([file],file.name,{type:checked.mime}));
   const r=await correctionRequest(config,form,{signal:controller.signal});
   if(controller.signal.aborted)return;
   setApplication(r.application);
   setFiles(v=>{const next={...v};delete next[type];return next;});
   setNotice(`${documentNames[type]} received.`);
  }catch(e){
   if(controller.signal.aborted)return;
   const uploadError=e instanceof Error?e.message:'Upload failed. Your selected file is still here; please retry.';
   try{
    // The document may be saved even if its upload response was lost.
    const refreshed=await correctionRequest(config,{token:token.current},{signal:controller.signal});
    if(controller.signal.aborted)return;
    setApplication(refreshed.application);
    if(refreshed.application.requested_documents.some(d=>d.doc_type===type&&d.received)){
     setFiles(v=>{const next={...v};delete next[type];return next;});
     setNotice(`${documentNames[type]} received.`);return;
    }
   }catch{/* Keep the original error and selected file when confirmation fails. */}
   if(!controller.signal.aborted)setError(uploadError);
  }finally{if(!controller.signal.aborted)setBusy('');}
 }
 const completed=application&&(application.completed||['under_review','approved','rejected'].includes(application.status));
 const completionTitle=application?.status==='approved'?'Your application is approved.':application?.status==='rejected'?'Your application wasn’t approved.':'You’re back in review.';
 const completionMessage=application?.status==='approved'?'Kaylo has approved your application. Your partner sign-in details and certificate will be sent by email.':application?.status==='rejected'?'Kaylo could not approve this application. Contact us with your reference if you have questions.':'We’ve received the requested updates. Kaylo will email you after reviewing your application.';
 const received=application?.requested_documents.filter(d=>d.received).length||0;const count=application?.requested_documents.length||1;
 return <div className="ops"><header className="ops-header"><a href={sitePath('/')} className="ops-brand" aria-label="Kaylo home"><Wordmark/><span>Partner applications</span></a><span className="ops-secure"><LockKeyhole size={14}/> Private document upload</span></header><main id="main" tabIndex={-1} className="ops-correction"><span className="ops-eyebrow">YOUR NEXT STEP WITH KAYLO</span><h1>A little update.<br/>Then we’ll take another look.</h1><p>Replace the documents requested by the Kaylo team. Your other application details stay saved.</p>{loading&&<p role="status" className="ops-loading"><LoaderCircle size={18}/> Loading your request…</p>}{error&&<div className="ops-alert" role="alert">{error}{!application&&!!token.current&&!loading&&<button type="button" onClick={()=>void load()}><RefreshCw size={16}/> Retry</button>}</div>}{notice&&!completed&&<div className="ops-notice" role="status"><CheckCircle2 size={18}/>{notice}</div>}{application&&<><div className="ops-reference">{application.reference}</div>{completed?<section className="ops-complete" role="status"><CheckCircle2 size={34}/><h2>{completionTitle}</h2><p>{completionMessage}</p><a href={sitePath('/')} className="ops-text-button">Back to Kaylo <ArrowUpRight size={15}/></a></section>:<><div className="ops-list-meta"><span>{received} of {count} updates received</span><span>Link expires {formatDate(application.expires_at)}</span></div><div className="ops-correction-progress" role="progressbar" aria-label="Requested documents received" aria-valuenow={received} aria-valuemin={0} aria-valuemax={count}><div style={{width:`${received/count*100}%`}}/></div>{application.requested_documents.map(d=><section className="ops-panel" key={d.doc_type}><h2>{d.received?<CheckCircle2 size={20}/>:<FileText size={20}/>} {documentNames[d.doc_type]||d.doc_type}</h2><p className="ops-preserve">{d.note}</p>{d.received?<p className="ops-muted">Replacement received. Thank you.</p>:<><label>Choose a clear, complete document<input type="file" accept={['photo','selfie'].includes(d.doc_type)?'image/jpeg,image/png':'image/jpeg,image/png,application/pdf'} disabled={!!busy} onChange={e=>{const file=e.target.files?.[0];setFiles(v=>{const next={...v};if(file)next[d.doc_type]=file;else delete next[d.doc_type];return next;});}}/></label><p className="ops-muted">JPEG, PNG{!['photo','selfie'].includes(d.doc_type)&&' or PDF'} · Up to 10 MB</p><button className="ops-button primary" disabled={!files[d.doc_type]||!!busy} onClick={()=>upload(d.doc_type)}>{busy===d.doc_type?<><LoaderCircle className="ops-loading" size={17}/> Uploading…</>:<><Upload size={17}/> Submit replacement</>}</button></>}</section>)}</>}</>}<p style={{marginTop:30}}>Need help? <a href="mailto:kayloapp@gmail.com">kayloapp@gmail.com</a></p></main><footer className="ops-footer"><span>Kaylo Partner applications</span><span>Your documents stay private.</span></footer></div>;
}
