// Local-only preview of the static site and its public runtime configuration.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import worker from '../server/worker.mjs';
const root=resolve('out');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.ttf':'font/ttf','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:3100');
  if(url.pathname==='/api/kaylo-config'){
   const response=await worker.fetch(new Request(url),{});
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
  }
  const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '');
  let path=resolve(root,relative||'index.html');
  if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  if((await stat(path)).isDirectory())path=resolve(path,'index.html');
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(path));
 }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(3100,'127.0.0.1',()=>process.stdout.write('Kaylo admin preview: http://127.0.0.1:3100/admin/\n'));
