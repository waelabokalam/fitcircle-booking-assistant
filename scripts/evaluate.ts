import {deepStrictEqual} from 'node:assert';
import {existsSync} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {book} from '../src/service.ts';
import {localExtractor} from '../src/intent.ts';
import {DEFAULT_GEMINI_MODEL,geminiExtractor} from '../src/provider.ts';
import type {Request} from '../src/types.ts';
import {CASES,REFERENCE} from './cases.ts';

const live=process.argv.includes('--live');
const checkOnly=process.argv.includes('--check');
if(live&&existsSync('.env'))process.loadEnvFile('.env');
const model=process.env.GEMINI_MODEL??DEFAULT_GEMINI_MODEL;

let httpStatuses:(number|null)[]=[];
const observedFetch:typeof fetch=async (...args)=>{
  try{
    const response=await fetch(...args);
    httpStatuses.push(response.status);
    return response;
  }catch(error){
    httpStatuses.push(null);
    throw error;
  }
};

const extractor=live
  ? geminiExtractor({apiKey:process.env.GEMINI_API_KEY??'',model,fetcher:observedFetch})
  : localExtractor;
const results=[];

for(const scenario of CASES){
  httpStatuses=[];
  const start=performance.now();
  const result=await book(scenario.message,extractor,()=>new Date(REFERENCE));
  const elapsedMs=Math.round(performance.now()-start);
  const errors:string[]=[];

  for(const [key,expected] of Object.entries(scenario.fields)){
    const actual=result.request[key as keyof Request];
    try{deepStrictEqual(actual,expected);}
    catch{errors.push(`${key}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);}
  }
  if(result.status!==scenario.expected)errors.push(`status: ${result.status} != ${scenario.expected}`);
  if(result.clarification_field!==scenario.field)errors.push(`clarification: ${result.clarification_field} != ${scenario.field}`);
  if(scenario.venue&&result.match?.venue_id!==scenario.venue)errors.push('Wrong venue');
  if(scenario.start&&result.match?.start_time!==scenario.start)errors.push('Wrong start');
  if(scenario.expected==='ALTERNATIVES'&&!result.alternatives.length)errors.push('No alternatives');
  if(live&&result.trace.source!=='gemini')errors.push('No validated Gemini response');

  results.push({
    id:scenario.id,expected:scenario.expected,actual:result.status,pass:errors.length===0,message:scenario.message,
    errors,result,...(live?{runtime:{elapsedMs,httpStatuses}}:{})
  });
}

const mode=live?'Provider-enabled pipeline with live Gemini':'Local rule-based baseline';
const passed=results.filter(row=>row.pass).length;
const geminiResponses=results.filter(row=>row.result.trace.source==='gemini').length;
const runtimes=results.flatMap(row=>row.runtime?[row.runtime]:[]);
const times=runtimes.map(row=>row.elapsedMs).sort((a,b)=>a-b);
const middle=Math.floor(times.length/2);
const medianMs=times.length%2?times[middle]:Math.round((times[middle-1]+times[middle])/2);
const p95Ms=times[Math.ceil(times.length*.95)-1];
const attempts=runtimes.reduce((total,row)=>total+row.httpStatuses.length,0);
const liveDetails=live?{model,geminiResponses,latencyMs:{median:medianMs,p95:p95Ms},providerAttempts:attempts}:{};

console.table(results.map(row=>({
  id:row.id,expected:row.expected,actual:row.actual,pass:row.pass,
  ...(row.runtime?{source:row.result.trace.source,ms:row.runtime.elapsedMs,attempts:row.runtime.httpStatuses.length}:{})
})));
console.log(`${mode}: ${passed}/${results.length} passed; reference ${REFERENCE}`);
if(live){
  console.log(`${model}: ${geminiResponses}/${results.length} validated responses across ${attempts} provider attempts`);
  console.log(`End-to-end latency: ${medianMs} ms median, ${p95Ms} ms p95 (n=${results.length})`);
}

if(!checkOnly){
  const escape=(value:string)=>value.replace(/\|/g,'\\|').replace(/\n/g,' ');
  const metrics=live
    ? `Model \`${model}\` returned validated responses for ${geminiResponses} of ${results.length} cases across ${attempts} provider attempts. End-to-end latency was ${medianMs} ms median and ${p95Ms} ms p95 (n=${results.length}).\n\n`
    : '';
  const details=live?'This measures the full pipeline with real Gemini requests, local recognition, and deterministic checks.':'This benchmark uses the rule-based extractor and measures offline pipeline behavior.';
  const liveHeader=live?' Extraction | Time (ms) |':'';
  const liveSeparator=live?'---|---|':'';
  const rows=results.map(row=>{
    const decision=row.pass?'PASS':'FAIL: '+escape(row.errors.join('; '));
    const runtime=row.runtime?` ${row.result.trace.source} | ${row.runtime.elapsedMs} |`:'';
    return `| ${row.id} | ${escape(row.message)} | ${row.expected} | ${row.actual} | ${escape(row.result.reply)} | ${decision} |${runtime}`;
  }).join('\n');
  const markdown=`# Evaluation — ${mode}\n\n${metrics}Reference instant: ${REFERENCE} (15:00 Damascus). Availability is synthetic.\n\n**${passed}/${results.length} passed.** ${details}\n\n| # | Customer message | Expected | Observed | Decision / reply | Result |${liveHeader}\n|---|---|---|---|---|---|${liveSeparator}\n${rows}\n\nEvery expected extraction field is asserted, in addition to decision status and clarification field. Exact match venue and start are checked where specified.\n`;
  const report=live?'RESULTS_LIVE.md':'RESULTS.md';
  const existing=!live&&existsSync(report)?await readFile(report,'utf8'):'';
  const notesAt=existing.indexOf('\n## Phase 1 verification\n');
  await writeFile(report,markdown+(notesAt>=0?existing.slice(notesAt):''));
  await writeFile(live?'results-live.json':'results-local.json',
    JSON.stringify({mode,...liveDetails,reference:REFERENCE,passed,total:results.length,results},null,2)+'\n');
}

if(passed!==results.length)process.exitCode=1;
