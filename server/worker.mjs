import publicConfig from './kaylo-public-config.json' with {type:'json'};
const skills=['Electrician','Plumber','Painter','Cleaner','Mechanic','AC technician','Appliance repair','Carpenter','Gardener','Farm services','Caregiver','Other'];
const experienceOptions=['Less than 1 year','1–3 years','3–5 years','5+ years'];
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function validate(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return {error:'Please complete the application form.'};
 const clean=(key,max)=>typeof input[key]==='string'?input[key].trim().slice(0,max+1):'';
 const v={id:clean('id',36),name:clean('name',80),phone:clean('phone',24).replace(/[\s()-]/g,''),email:clean('email',150),city:clean('city',100),skill:clean('skill',40),experience:clean('experience',30),about:clean('about',1000)};
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.id))return {error:'Please refresh this page and try again.'};
 if(v.name.length<2||v.name.length>80)return {error:'Enter your full name (2–80 characters).'};
 if(!/^(?:\+91)?[6-9]\d{9}$/.test(v.phone))return {error:'Enter a valid 10-digit Indian mobile number.'};
 if(v.email&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)||v.email.length>150))return {error:'Enter a valid email address or leave it blank.'};
 if(v.city.length<2||v.city.length>100)return {error:'Enter your town or city.'};
 if(!skills.includes(v.skill)||!experienceOptions.includes(v.experience))return {error:'Choose your service and experience.'};
 if(v.about.length>1000)return {error:'Keep your introduction under 1,000 characters.'};
 if(input.consent!==true)return {error:'Please agree to be contacted about your application.'};
 if(input.website)return {error:'Unable to submit this application.'};
 return {value:{...v,phone:v.phone.startsWith('+91')?v.phone:'+91'+v.phone}};
}
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname==='/api/kaylo-config'){
  if(request.method!=='GET')return json({error:'Method not allowed.'},405);
  // Explicit allowlist: no service-role key, SMTP secret or signing key may be returned.
  return json({firebaseApiKey:env.KAYLO_FIREBASE_API_KEY||publicConfig.firebaseApiKey,supabaseUrl:env.KAYLO_SUPABASE_URL||publicConfig.supabaseUrl,supabaseAnonKey:env.KAYLO_SUPABASE_ANON_KEY||publicConfig.supabaseAnonKey});
 }
 if(url.pathname!=='/api/applications')return env.ASSETS.fetch(request);
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 const origin=request.headers.get('Origin');if(origin&&origin!==url.origin)return json({error:'Please submit from the Kaylo website.'},403);
 if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'Expected an application form.'},415);
 if(Number(request.headers.get('Content-Length')||0)>8192)return json({error:'Application is too large.'},413);
 let input;try{const raw=await request.text();if(raw.length>8192)return json({error:'Application is too large.'},413);input=JSON.parse(raw)}catch{return json({error:'Please check your application and try again.'},400)}
 const result=validate(input);if(result.error)return json({error:result.error},400);
 const v=result.value;
 try{
  await env.DB.prepare('INSERT INTO professional_applications (id,name,phone,email,city,skill,experience,about,consent_version,created_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(v.id,v.name,v.phone,v.email||null,v.city,v.skill,v.experience,v.about,'2026-10-02',Date.now()).run();
  return json({ok:true,reference:v.id},201);
 }catch(error){console.error('Application save failed',error instanceof Error?error.name:'StorageError');return json({error:'We couldn’t save your application. Your details are still here. Please try again.'},503)}
}};
