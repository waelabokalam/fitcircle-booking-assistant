import assert from 'node:assert/strict';
import {test} from 'node:test';
import {emptyRaw} from '../src/intent.ts';
import {geminiExtractor} from '../src/provider.ts';

const message='padel tomorrow';
const raw={...emptyRaw(),sport:'padel',date:'tomorrow'};
const success=()=>Response.json({
  candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(raw)}]}}]
});

test('Gemini recovers from a 503 followed by a response body timeout',async()=>{
  const calls: {signal:AbortSignal; body:BodyInit|null|undefined; started:number}[]=[];
  const extractor=geminiExtractor({apiKey:'fixture',model:'test-model',fetcher:async (_url,request)=>{
    assert.ok(request?.signal);
    assert.equal(request.signal.aborted,false);
    calls.push({signal:request.signal,body:request.body,started:performance.now()});
    if(calls.length===1)return new Response('',{status:503,headers:{'Retry-After':'2'}});
    if(calls.length===2)return new Response(new ReadableStream({
      start(controller){controller.error(new DOMException('body deadline','TimeoutError'));}
    }));
    return success();
  }});

  assert.deepEqual(await extractor(message),{raw,source:'gemini'});
  assert.equal(calls.length,3);
  assert.equal(new Set(calls.map(call=>call.signal)).size,3);
  assert.equal(new Set(calls.map(call=>call.body)).size,1);
  assert.ok(calls[1].started-calls[0].started>=1900);
});

test('Gemini stops after three temporary HTTP failures',async()=>{
  let attempts=0;
  const extractor=geminiExtractor({apiKey:'fixture',model:'test-model',fetcher:async()=>{
    attempts++;
    return new Response('',{status:503});
  }});
  await assert.rejects(extractor(message),/Provider HTTP 503/);
  assert.equal(attempts,3);
});

test('Gemini skips a retry when Retry-After exceeds the remaining deadline',async()=>{
  let attempts=0;
  const extractor=geminiExtractor({apiKey:'fixture',model:'test-model',fetcher:async()=>{
    attempts++;
    return new Response('',{status:503,headers:{'Retry-After':'120'}});
  }});
  await assert.rejects(extractor(message),/Provider HTTP 503/);
  assert.equal(attempts,1);
});

test('Gemini does not retry authentication, quota or evidence failures',async()=>{
  for(const status of [401,429,200]){
    let attempts=0;
    const extractor=geminiExtractor({apiKey:'fixture',model:'test-model',fetcher:async()=>{
      attempts++;
      if(status!==200)return new Response('',{status});
      const invalid={...raw,date:'not in the message'};
      return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(invalid)}]}}]});
    }});
    await assert.rejects(extractor(message),status===200?/Unsupported evidence/:new RegExp(`Provider HTTP ${status}`));
    assert.equal(attempts,1);
  }
});
