import publicConfig from './kaylo-public-config.json' with {type:'json'};
// Populated by build-worker. HTML is served here, not by the asset-first router,
// so canonical-host redirects and security headers also apply to real pages.
const exportedPages={};
const pageRedirects={};
// These HTTP protections complement the build-time hashed CSP in every HTML page.
// frame-ancestors and X-Frame-Options cannot be enforced by HTML meta tags.
const securityHeaders={
 'Content-Security-Policy':"frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
 'X-Frame-Options':'DENY',
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer',
};
const json=(body,status=200)=>Response.json(body,{status,headers:{...securityHeaders,'Cache-Control':'no-store'}});
function pageResponse(request,page,status=page.status){
 const headers={...securityHeaders,'Content-Type':'text/html; charset=utf-8','Cache-Control':status===404?'no-store':'public, max-age=0, must-revalidate'};
 if(status===200){
  headers.ETag=page.etag;
  const matches=request.headers.get('If-None-Match')?.split(',').map(value=>value.trim().replace(/^W\//,''));
  if(matches?.some(value=>value==='*'||value===page.etag))return new Response(null,{status:304,headers});
 }
 return new Response(request.method==='HEAD'?null:page.html,{status,headers});
}
export default {async fetch(request,env){
 const url=new URL(request.url);
 // One public address for search engines: www permanently moves to the apex.
 if(url.hostname==='www.kaylo.in'){url.hostname='kaylo.in';url.protocol='https:';return new Response(null,{status:301,headers:{...securityHeaders,Location:url.toString()}});}
 if(url.pathname.replace(/\/$/,'')==='/api/applications'){
  // Retired: do not parse an untrusted body, touch D1 or issue a receipt.
  // The supported application flow uses the protected Supabase contract.
  return json({error:'This application endpoint has been retired. Open the current Kaylo professional registration page.'},410);
 }
 if(url.pathname==='/api/kaylo-config'){
  if(request.method!=='GET')return json({error:'Method not allowed.'},405);
  return json({firebaseApiKey:env.KAYLO_FIREBASE_API_KEY||publicConfig.firebaseApiKey,supabaseUrl:env.KAYLO_SUPABASE_URL||publicConfig.supabaseUrl,supabaseAnonKey:env.KAYLO_SUPABASE_ANON_KEY||publicConfig.supabaseAnonKey});
 }
 if(url.pathname.startsWith('/api/'))return json({error:'Not found.'},404);
 if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed.'},405);
 if(Object.hasOwn(pageRedirects,url.pathname)){
  url.pathname=pageRedirects[url.pathname];
  return new Response(null,{status:308,headers:{...securityHeaders,Location:url.toString()}});
 }
 if(Object.hasOwn(exportedPages,url.pathname))return pageResponse(request,exportedPages[url.pathname]);
 const asset=await env.ASSETS.fetch(request);
 if(asset.status===404&&Object.hasOwn(exportedPages,'/404/'))return pageResponse(request,exportedPages['/404/'],404);
 const headers=new Headers(asset.headers);
 for(const [name,value]of Object.entries(securityHeaders))headers.set(name,value);
 return new Response(asset.body,{status:asset.status,statusText:asset.statusText,headers});
}};
