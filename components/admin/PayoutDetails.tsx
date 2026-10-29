import {useEffect,useState} from 'react';
import {PortalError} from '../../lib/admin-api';

export type Payout = {upi_id?:string;bank_account?:{account_holder?:string;bank_name?:string;account_number?:string;ifsc?:string}};
export type PayoutSummary = {method:'upi'|'bank'|'unavailable';account_last4?:string};

export function PayoutDetails({canReveal,summary,load,onError}:{canReveal:boolean;summary?:PayoutSummary;load:()=>Promise<Payout>;onError:(error:unknown)=>void}){
  const [payout,setPayout]=useState<Payout|null>(null);
  const [busy,setBusy]=useState(false);
  const [unavailable,setUnavailable]=useState(false);
  useEffect(()=>{if(!payout)return;const timer=setTimeout(()=>setPayout(null),60_000);return()=>clearTimeout(timer);},[payout]);
  async function reveal(){
    if(busy)return;
    setBusy(true);
    try{setPayout(await load());}catch(error){
      if(error instanceof PortalError&&error.code==='INVALID_ACTION')setUnavailable(true);
      else onError(error);
    }finally{setBusy(false);}
  }
  return <section className="ops-sensitive" aria-label="Payout details">
    <h3>Payout details</h3>
    {!payout&&<p>{summary?.method==='bank'?`Bank account${summary.account_last4?` ending ${summary.account_last4}`:''}`:summary?.method==='upi'?'UPI account':'Payout information is private.'}</p>}
    {payout&&(payout.upi_id?<p>UPI: {payout.upi_id}</p>:<dl className="ops-details">
      <div><dt>Account holder</dt><dd>{payout.bank_account?.account_holder||'Not provided'}</dd></div>
      <div><dt>Bank</dt><dd>{payout.bank_account?.bank_name||'Not provided'}</dd></div>
      <div><dt>Account</dt><dd>{payout.bank_account?.account_number||'Not provided'}</dd></div>
      <div><dt>IFSC</dt><dd>{payout.bank_account?.ifsc||'Not provided'}</dd></div>
    </dl>)}
    {unavailable?<p className="ops-muted" role="status">Secure payout viewing is not available on this server yet. These details remain private.</p>:canReveal?<><button type="button" className="ops-button" disabled={busy} onClick={()=>payout?setPayout(null):void reveal()}>{busy?'Opening…':payout?'Hide payout details':'View payout details'}</button><p className="ops-muted">Access is recorded in the review history. Details hide after one minute.</p></>:<p className="ops-muted">Only administrators can view full payout details.</p>}
  </section>;
}
