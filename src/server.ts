import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {configuredExtractor} from './provider.ts';
import {book} from './service.ts';
import {availabilitySnapshot} from './availability.ts';
import type {Extractor} from './types.ts';
const PUBLIC=new URL('../public/',import.meta.url);
export function createApp(extractor:Extractor,clock:()=>Date=()=>new Date()){
  return createServer(async(req,res)=>{
    const json=(status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
    const path=(req.url??'').split('?')[0];
    try{
      if(req.method==='POST'&&path==='/api/booking'){
        if(!req.headers['content-type']?.toLowerCase().startsWith('application/json'))return json(415,{error:'Expected application/json'});
        const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16384){json(413,{error:'Request too large'});return;}chunks.push(chunk);}
        let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return json(400,{error:'Invalid JSON'});}
        if(!body||typeof body.message!=='string'||!body.message.trim()||body.message.length>2000)return json(400,{error:'Message must contain 1–2000 characters'});
        const result=await book(body.message,extractor,clock);return json(result.status==='EXTRACTION_ERROR'?503:200,result);
      }
      if(req.method==='GET'&&path==='/api/availability')return json(200,{mock:true,timezone:'Asia/Damascus',days:availabilitySnapshot(clock())});
      if(req.method==='GET'&&path==='/api/health')return json(200,{status:'ok',mock:true});
      const assets:Record<string,[string,string]>={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8']};
      if(req.method==='GET'&&Object.hasOwn(assets,path)){const [file,type]=assets[path];res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'"});return res.end(await readFile(new URL(file,PUBLIC)));}
      return json(404,{error:'Not found'});
    }catch{if(!res.headersSent)json(500,{error:'Unexpected server error'});else res.end();}
  });
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  if(existsSync('.env'))process.loadEnvFile('.env');
  const extractor=configuredExtractor();const port=Number(process.env.PORT??3000);
  createApp(extractor).listen(port,'127.0.0.1',()=>console.log(`FitCircle mock demo: http://localhost:${port} (${process.env.EXTRACTION_MODE??'local'} extraction)`));
}
