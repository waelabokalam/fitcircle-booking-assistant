import {deepStrictEqual} from 'node:assert';
import {existsSync} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {book} from '../src/service.ts';
import {localExtractor} from '../src/intent.ts';
import {geminiExtractor} from '../src/provider.ts';
import {CASES,REFERENCE} from './cases.ts';
const live=process.argv.includes('--live');if(live&&existsSync('.env'))process.loadEnvFile('.env');
const extractor=live?geminiExtractor({apiKey:process.env.GEMINI_API_KEY??'',model:process.env.GEMINI_MODEL??'gemini-3.5-flash'}):localExtractor;
const results=[];
for(const c of CASES){const r=await book(c.message,extractor,()=>new Date(REFERENCE));const errors=[];
 for(const [k,v] of Object.entries(c.fields)){try{deepStrictEqual(r.request[k as keyof typeof r.request],v);}catch{errors.push(`${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(r.request[k as keyof typeof r.request])}`);}}
 if(r.status!==c.expected)errors.push(`status: ${r.status} != ${c.expected}`);if(r.clarification_field!==c.field)errors.push(`clarification: ${r.clarification_field} != ${c.field}`);
 if(c.venue&&r.match?.venue_id!==c.venue)errors.push('Wrong venue');if(c.start&&r.match?.start_time!==c.start)errors.push('Wrong start');if(c.expected==='ALTERNATIVES'&&r.alternatives.length===0)errors.push('No alternatives');
 results.push({id:c.id,expected:c.expected,actual:r.status,pass:!errors.length,message:c.message,errors,result:r});
}
const mode=live?'Provider-enabled pipeline with live Gemini':'Local rule-based baseline';const passed=results.filter(x=>x.pass).length;
console.table(results.map(x=>({id:x.id,expected:x.expected,actual:x.actual,pass:x.pass})));console.log(`${mode}: ${passed}/${results.length} passed; reference ${REFERENCE}`);
const escape=(x:string)=>x.replace(/\|/g,'\\|').replace(/\n/g,' ');
const md=`# Evaluation — ${mode}\n\nReference instant: ${REFERENCE} (15:00 Damascus). Availability is synthetic.\n\n**${passed}/${results.length} passed.** ${live?'This measures the full pipeline with real Gemini requests, local recognition, and deterministic checks.':'This benchmark uses the rule-based extractor and measures offline pipeline behavior.'}\n\n| # | Customer message | Expected | Observed | Decision / reply | Result |\n|---|---|---|---|---|---|\n${results.map(x=>`| ${x.id} | ${escape(x.message)} | ${x.expected} | ${x.actual} | ${escape(x.result.reply)} | ${x.pass?'PASS':'FAIL: '+escape(x.errors.join('; '))} |`).join('\n')}\n\nEvery expected extraction field is asserted, in addition to decision status and clarification field. Exact match venue and start are checked where specified.\n`;
const report=live?'RESULTS_LIVE.md':'RESULTS.md';
const existing=!live && existsSync(report)?await readFile(report,'utf8'):'';
const notesAt=existing.indexOf('\n## Phase 1 verification\n');
await writeFile(report,md+(notesAt>=0?existing.slice(notesAt):''));
await writeFile(live?'results-live.json':'results-local.json',JSON.stringify({mode,reference:REFERENCE,passed,total:results.length,results},null,2)+'\n');
if(passed!==results.length)process.exitCode=1;
