import assert from 'node:assert/strict';
import {test} from 'node:test';
import {emptyRaw} from '../src/intent.ts';
import {configuredExtractor,DEFAULT_GEMINI_MODEL,geminiExtractor} from '../src/provider.ts';

const message='padel tomorrow';
const raw={...emptyRaw(),sport:'padel',date:'tomorrow'};
const success=()=>Response.json({
  candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(raw)}]}}]
});

test('the configured provider defaults chat to 3.1 Flash-Lite and uses 3.5 Flash-Lite for stateless requests',async()=>{
  const models:string[]=[];
  const extractor=configuredExtractor({
    env:{EXTRACTION_MODE:'gemini',GEMINI_API_KEY:'fixture'},
    fetcher:async (url,request)=>{
      const config=JSON.parse(String(request?.body)).generationConfig;
      assert.deepEqual(config.thinkingConfig,{thinkingLevel:'MINIMAL'});
      models.push(String(url).split('/').at(-1)!.split(':')[0]);
      return success();
    }
  });
  await extractor(message);
  await extractor(message,{pendingField:null,needsTimePeriod:false});
  assert.deepEqual(models,['gemini-3.5-flash-lite','gemini-3.1-flash-lite']);
});

test('an explicit chat model wins and a custom shared model remains available',async()=>{
  const base={EXTRACTION_MODE:'gemini',GEMINI_API_KEY:'fixture',GEMINI_MODEL:'custom-booking'};
  const models:string[]=[];
  const fetcher:typeof fetch=async (url)=>{
    models.push(String(url).split('/').at(-1)!.split(':')[0]);
    return success();
  };
  const context={pendingField:null,needsTimePeriod:false};
  const custom=configuredExtractor({env:base,fetcher});
  await custom(message,context);
  const override=configuredExtractor({env:{...base,GEMINI_CHAT_MODEL:'custom-chat'},fetcher});
  await override(message,context);
  await override(message);
  assert.deepEqual(models,['custom-booking','custom-chat','custom-booking']);
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

test('chat retries one quick 503 with minimal thinking and a shared deadline',async()=>{
  const signals:AbortSignal[]=[];
  const extractor=geminiExtractor({apiKey:'fixture',model:DEFAULT_GEMINI_MODEL,fetcher:async (_url,request)=>{
    assert.ok(request?.signal);
    signals.push(request.signal);
    const config=JSON.parse(String(request.body)).generationConfig;
    assert.deepEqual(config.thinkingConfig,{thinkingLevel:'MINIMAL'});
    return signals.length===1?new Response('',{status:503}):success();
  }});
  assert.deepEqual(await extractor(message,{pendingField:null,needsTimePeriod:false}),{raw,source:'gemini'});
  assert.equal(signals.length,2);
  assert.equal(signals[0],signals[1]);
});

test('chat skips a retry that fits the longer booking budget but misses the chat deadline',async()=>{
  let attempts=0;
  const extractor=geminiExtractor({apiKey:'fixture',model:'test-model',fetcher:async()=>{
    attempts++;
    return new Response('',{status:503,headers:{'Retry-After':'3'}});
  }});
  await assert.rejects(extractor(message,{pendingField:null,needsTimePeriod:false}),/Provider HTTP 503/);
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

test('Gemini receives a source-grounded neighborhood constraint for a Levantine request',async()=>{
  const fixture='بدي تنس بدمر مبارح الساعة ١٠ الصبح لمدة ساعة، نحنا ٢';
  const evidence={...emptyRaw(),sport:'تنس',area:'دمر',date:'مبارح'};
  const extractor=geminiExtractor({apiKey:'fixture',model:'test-model',fetcher:async (_url,request)=>{
    const schema=JSON.parse(String(request?.body)).generationConfig.responseJsonSchema;
    assert.deepEqual(schema.properties.area.anyOf,[{type:'string',enum:['دمر']},{type:'null'}]);
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(evidence)}]}}]});
  }});
  assert.deepEqual(await extractor(fixture),{raw:evidence,source:'gemini'});
});

test('Gemini can still quote an unrecognized neighborhood from the original message',async()=>{
  const phrase='ساروجة';
  const evidence={...emptyRaw(),sport:'تنس',area:phrase};
  const extractor=geminiExtractor({apiKey:'fixture',model:'test-model',fetcher:async (_url,request)=>{
    const schema=JSON.parse(String(request?.body)).generationConfig.responseJsonSchema;
    assert.deepEqual(schema.properties.area.type,['string','null']);
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(evidence)}]}}]});
  }});
  assert.deepEqual(await extractor(`بدي تنس في ${phrase}`),{raw:evidence,source:'gemini'});
});
