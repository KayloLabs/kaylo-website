import {mkdir,rm,cp,copyFile,readFile,writeFile} from 'node:fs/promises';
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
 const worker=`const publicConfig=${JSON.stringify(publicConfig)};${source.slice(configImport.length)}`;
 // Validate inputs before replacing the previous build output.
 await rm(local('dist'),{recursive:true,force:true});
 await mkdir(local('dist/server'),{recursive:true});
 await mkdir(local('dist/.openai'),{recursive:true});
 await cp(local('out'),local('dist/client'),{recursive:true});
 await writeFile(local('dist/server/index.js'),worker);
 await copyFile(local('.openai/hosting.json'),local('dist/.openai/hosting.json'));
 await cp(local('drizzle'),local('dist/.openai/drizzle'),{recursive:true});
 await writeFile(local('dist/server/wrangler.json'),JSON.stringify({name:'kaylo-website',main:'index.js',compatibility_date:'2026-05-15',assets:{directory:'../client',binding:'ASSETS',not_found_handling:'404-page',run_worker_first:['/api/*']},d1_databases:[{binding:'DB',database_name:'kaylo-professionals',database_id:'00000000-0000-4000-8000-000000000000'}]}));
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildWorker();
