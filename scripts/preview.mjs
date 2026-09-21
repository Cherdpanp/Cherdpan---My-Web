// Local preview only. Production uses the Vercel function in api/travel.mjs.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {createTravelService} from '../lib/travel-service.mjs';
const root=resolve(new URL('../public/',import.meta.url).pathname);
const travel=createTravelService();
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/travel'){
  const response=await travel(new Request(url,{method:req.method}));
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
 }
 let path=url.pathname==='/'?'/index.html':url.pathname;
 if(!extname(path))path+='.html';
 const file=resolve(root,'.'+path);
 if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 try{const body=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(body);}
 catch{res.writeHead(404);res.end('Not found');}
}).listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:4173'));
