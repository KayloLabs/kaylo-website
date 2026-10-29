/** Keep an applicant capability in memory, not the address bar or browser history. */
export function readCorrectionLink(hash:string):{token:string;replacementHash:string}{
  const parameters=new URLSearchParams(hash.replace(/^#/,''));
  const token=parameters.get('token')?.trim()??'';
  parameters.delete('token');
  const remaining=parameters.toString();
  return {token:token.length<=8192?token:'',replacementHash:remaining?`#${remaining}`:''};
}
