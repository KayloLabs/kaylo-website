// Serve the same static export used on GitHub Pages, without a development watcher.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('out');
const base=(process.env.NEXT_PUBLIC_BASE_PATH||'').replace(/\/$/,'');
const port=Number(process.env.PORT||3100);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.ttf':'font/ttf','.woff2':'font/woff2','.txt':'text/plain'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,`http://127.0.0.1:${port}`);
  if(base && !url.pathname.startsWith(base+'/')){
   res.writeHead(302,{Location:url.pathname===base?base+'/':base+url.pathname+url.search});res.end();return;
  }
  const relative=decodeURIComponent(url.pathname.slice(base.length)).replace(/^\/+/, '');
  let path=resolve(root,relative||'index.html');
  if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  if((await stat(path)).isDirectory())path=resolve(path,'index.html');
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(path));
 }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Kaylo local preview: http://127.0.0.1:${port}${base}/`));
