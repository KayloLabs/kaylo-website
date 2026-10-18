import publicConfig from '../server/kaylo-public-config.json' with {type:'json'};

export async function submitProfessionalLead(input: Record<string, unknown>): Promise<{ok:true;reference:string}> {
  const response = await fetch(`${publicConfig.supabaseUrl}/rest/v1/rpc/submit_professional_lead`, {
    method: 'POST',
    headers: {'Content-Type':'application/json', apikey:publicConfig.supabaseAnonKey, Authorization:`Bearer ${publicConfig.supabaseAnonKey}`},
    body: JSON.stringify({input}),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true || result.reference !== input.id) {
    const message = response.status === 400 && result?.code === '22023' && typeof result.message === 'string'
      ? result.message
      : 'We couldn’t save your application. Your details are still here. Please try again.';
    throw new Error(message);
  }
  return result;
}
