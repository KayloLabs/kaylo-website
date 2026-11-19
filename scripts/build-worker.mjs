import {secureExport} from './secure-export.mjs';
import {mkdir,rm,cp,copyFile,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyPublicConfig} from './verify-pages.mjs';

export async function buildWorker(directory=process.cwd()){
 const root=path.resolve(directory);
 const local=name=>path.join(root,name);
 const config=JSON.parse(await readFile(local('server/kaylo-public-config.json'),'utf8'));
 verifyPublicConfig(config);
 const source=await readFile(local('server/worker.mjs'),'utf8');
 const configImport="import publicConfig from './kaylo-public-config.json' with {type:'json'};";
 if(!source.startsWith(configImport+'\n')&&!source.startsWith(configImport+'\r\n'))throw new Error('Worker public configuration import changed; review packaging before deployment.');
 // Sites uploads a Worker ESM module, so JSON import assertions are not portable.
 // Serialize only the validated public fields; never inline the environment.
 const publicConfig={firebaseApiKey:config.firebaseApiKey,supabaseUrl:config.supabaseUrl,supabaseAnonKey:config.supabaseAnonKey};
 if(!source.includes('const exportedPages={};')||!source.includes('const pageRedirects={};'))throw new Error('Worker page packaging markers changed; review packaging before deployment.');
 let worker=`const publicConfig=${JSON.stringify(publicConfig)};${source.slice(configImport.length)}`;
 // Validate inputs before replacing the previous build output.
 await rm(local('dist'),{recursive:true,force:true});
 await mkdir(local('dist/server'),{recursive:true});
 await mkdir(local('dist/.openai'),{recursive:true});
 await cp(local('out'),local('dist/client'),{recursive:true});
 await secureExport(local('dist/client'),config);
 const pages={},redirects={};
 async function bundlePages(folder){
  for(const entry of await readdir(folder,{withFileTypes:true})){
   const file=path.join(folder,entry.name);
   if(entry.isDirectory()){await bundlePages(file);continue;}
   if(!entry.name.endsWith('.html'))continue;
   const relative='/'+path.relative(local('dist/client'),file).split(path.sep).join('/');
   const route=relative.endsWith('/index.html')?relative.slice(0,-'index.html'.length):relative;
   const html=await readFile(file,'utf8');
   pages[route]={html,etag:'"'+createHash('sha256').update(html).digest('hex')+'"',status:['/404.html','/404/','/_not-found/'].includes(route)?404:200};
   if(route!==relative)redirects[relative]=route;
   if(route!=='/'&&route.endsWith('/'))redirects[route.slice(0,-1)]=route;
   // Sites can serve static files before invoking the Worker. Leaving any HTML
   // here would bypass host canonicalization, even with run_worker_first set.
   await rm(file);
  }
 }
 await bundlePages(local('dist/client'));
 if(!pages['/'])throw new Error('Export is missing the homepage.');
 if(!pages['/404/']&&pages['/404.html'])pages['/404/']=pages['/404.html'];
 if(!pages['/404/'])throw new Error('Export is missing the not-found page.');
 worker=worker.replace('const exportedPages={};',()=>`const exportedPages=${JSON.stringify(pages)};`).replace('const pageRedirects={};',()=>`const pageRedirects=${JSON.stringify(redirects)};`);
 await writeFile(local('dist/server/index.js'),worker);
 await copyFile(local('.openai/hosting.json'),local('dist/.openai/hosting.json'));
 await cp(local('drizzle'),local('dist/.openai/drizzle'),{recursive:true});
 await writeFile(local('dist/server/wrangler.json'),JSON.stringify({name:'kaylo-website',main:'index.js',compatibility_date:'2026-05-15',compatibility_flags:['assets_navigation_has_no_effect'],assets:{directory:'../client',binding:'ASSETS',not_found_handling:'none',run_worker_first:true},d1_databases:[{binding:'DB',database_name:'kaylo-professionals',database_id:'00000000-0000-4000-8000-000000000000'}]}));
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildWorker();
