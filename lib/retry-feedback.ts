/** Only bounded server delays are shown; no backend text or credentials are reflected. */
export function retryAfterSeconds(response:Response,body:unknown):number|undefined{
 const header=response.headers.get('Retry-After');
 const fromHeader=header&&/^\d+$/.test(header)?Number(header):undefined;
 const fromBody=body&&typeof body==='object'&&'retry_after' in body?body.retry_after:undefined;
 for(const value of [fromHeader,fromBody]){
  if(typeof value==='number'&&Number.isSafeInteger(value)&&value>=1&&value<=86_400)return value;
 }
 return undefined;
}
export function uploadRetryMessage(code:string,delay?:number):string|undefined{
 const seconds=delay??(code==='UPLOAD_RATE_LIMITED'?300:code==='UPLOAD_RETRY_REQUIRED'?90:30);
 const time=seconds%60===0?`${seconds/60} minute${seconds===60?'':'s'}`:`${seconds} seconds`;
 switch(code){
  case 'UPLOAD_RATE_LIMITED':return `Uploads are temporarily limited. Wait ${time}, then retry the same file. Your application remains saved.`;
  case 'UPLOAD_IN_PROGRESS':return `This document is still being processed. Wait ${time}, then retry the same file if it is not confirmed. Keep this application open.`;
  case 'UPLOAD_RETRY_REQUIRED':return `The upload could not be confirmed. Wait ${time}, then retry the same file in this application.`;
  default:return undefined;
 }
}
