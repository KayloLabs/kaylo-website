import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const requiredRoutes=['index.html','admin/index.html','application/update/index.html','professionals/index.html','services/index.html','download/index.html'];
const forbiddenParts=new Set(['.git','.next','node_modules','server','supabase','lib','components','.openai','.sites-runtime']);
const textExtensions=new Set(['.html','.css','.js','.json','.txt','.svg']);

export function verifyPublicConfig(config){
 const expected=['firebaseApiKey','supabaseAnonKey','supabaseUrl'];
 if(!config||Object.keys(config).sort().join()!==expected.sort().join())throw new Error('Public configuration must contain only approved public connection fields.');
 if(expected.some(key=>typeof config[key]!=='string'||!config[key]))throw new Error('Public connection configuration is incomplete.');
 const url=new URL(config.supabaseUrl);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('Supabase must use a credential-free HTTPS URL.');
 let claims;
 try{claims=JSON.parse(Buffer.from(config.supabaseAnonKey.split('.')[1],'base64url').toString());}catch{throw new Error('The public Supabase key is not readable.');}
 if(claims?.role!=='anon')throw new Error('Only the public Supabase anon key may be exported.');
}

export async function verifyPagesExport(directory,{basePath='/kaylo-website',requireNoJekyll=true}={}){
 const root=path.resolve(directory);
 if(basePath&&!/^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(basePath))throw new Error('Invalid Pages base path.');
 const files=[];
 async function walk(relative=''){
  for(const entry of await readdir(path.join(root,relative),{withFileTypes:true})){
   const name=path.posix.join(relative,entry.name);
   if(entry.isSymbolicLink())throw new Error(`Symlinks must not be published: ${name}`);
   if((!relative&&forbiddenParts.has(entry.name))||['.git','node_modules'].includes(entry.name)||entry.name.startsWith('.env')||/\.(?:tsx?|map|pem|key|sql|toml|apk|aab)$/i.test(entry.name))throw new Error(`Private source or release artifact in Pages output: ${name}`);
   if(entry.isDirectory())await walk(name);else files.push(name);
  }
 }
 await walk();
 const known=new Set(files);
 for(const file of [...requiredRoutes,...(requireNoJekyll?['.nojekyll']:[])]){
  if(!known.has(file))throw new Error(`Missing Pages route or marker: ${file}`);
 }
 const cache=new Map();
 const text=async name=>{if(!cache.has(name))cache.set(name,await readFile(path.join(root,name),'utf8'));return cache.get(name);};
 for(const file of files){
  if(!textExtensions.has(path.extname(file)))continue;
  const source=await text(file);
  if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(source)||/\b(?:sk_live_|sb_secret_)[A-Za-z0-9_-]{16,}/.test(source))throw new Error(`Private credential material in Pages output: ${file}`);
  for(const token of source.matchAll(/\beyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)){
   let claims;try{claims=JSON.parse(Buffer.from(token[1],'base64url').toString());}catch{continue;}
   if(claims?.role==='service_role')throw new Error(`Privileged Supabase key in Pages output: ${file}`);
  }
  if(!['.html','.css'].includes(path.extname(file)))continue;
  const references=path.extname(file)==='.html'?[...source.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)].map(match=>match[1]):[...source.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)].map(match=>match[1]);
  for(let reference of references){
   reference=reference.replaceAll('&amp;','&');
   if(!reference||reference.startsWith('#')||reference.startsWith('//')||/^[a-z][a-z\d+.-]*:/i.test(reference))continue;
   const value=decodeURIComponent(reference.split(/[?#]/,1)[0]);
   let target;
   if(value.startsWith('/')){
    if(basePath&&value!==basePath&&!value.startsWith(`${basePath}/`))throw new Error(`Link escapes the Pages project path in ${file}`);
    target=value.slice(basePath.length).replace(/^\//,'');
   }else target=path.posix.normalize(path.posix.join(path.posix.dirname(file),value));
   if(target.startsWith('../'))throw new Error(`Link escapes the export in ${file}`);
   const found=known.has(target)||known.has(path.posix.join(target,'index.html'));
   if(!found)throw new Error(`Broken local asset or link: ${file} -> ${target}`);
  }
 }
 for(const file of requiredRoutes){
  const source=await text(file);
  if(!/<main\b[^>]*\bid="main"/.test(source))throw new Error(`Missing accessible main landmark: ${file}`);
 }
 for(const file of ['admin/index.html','application/update/index.html']){
  const source=await text(file);
  if(!/<meta\s+name="robots"\s+content="[^"]*noindex/.test(source)||!/<meta\s+name="referrer"\s+content="no-referrer"/.test(source))throw new Error(`Missing private-page metadata: ${file}`);
 }
 return {files:files.length,routes:requiredRoutes.length};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await verifyPagesExport(process.argv[2]??'out',{basePath:(process.env.NEXT_PUBLIC_BASE_PATH??'/kaylo-website').replace(/\/+$/,'')});
 console.log(`Pages export verified: ${result.routes} routes, ${result.files} files.`);
}
