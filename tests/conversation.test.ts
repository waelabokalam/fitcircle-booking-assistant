import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/server.ts';
import {emptyRaw, localExtractor} from '../src/intent.ts';
import {geminiExtractor} from '../src/provider.ts';
import {addDays, localParts} from '../src/time.ts';
import {REFERENCE} from '../scripts/cases.ts';
import type {ExtractionContext, Extractor, Result} from '../src/types.ts';

const clock=()=>new Date(REFERENCE);
type ChatResult=Result & {session_id:string};

async function withServer(
  run:(url:string)=>Promise<void>,
  extractor:Extractor=localExtractor,
  now:()=>Date=clock
){
  const server=createApp(extractor,now);
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  try{
    const address=server.address();
    assert.ok(address && typeof address==='object');
    await run(`http://127.0.0.1:${address.port}`);
  }finally{
    await new Promise<void>(resolve=>server.close(()=>resolve()));
  }
}

function post(url:string,body:object,path='/api/conversation'){
  return fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
}

async function send(url:string,message:string,session_id?:string):Promise<ChatResult>{
  const response=await post(url,{message,session_id});
  assert.equal(response.status,200);
  return response.json();
}

function chat(url:string){
  let id:string|undefined;
  return async (message:string)=>{
    const turn=await send(url,message,id);
    if(id)assert.equal(turn.session_id,id);
    id=turn.session_id;
    return turn;
  };
}

const fullPadel='Book padel tomorrow at 7 pm in Mezzeh for 60 minutes, 4 players.';

test('reported four-turn exchange retains tomorrow and accepts both padel spellings',()=>withServer(async url=>{
  const turn=chat(url);
  const first=await turn('i want to book tmw');
  assert.match(first.reply,/Mock openings tomorrow include padel at 09:00/);
  assert.match(first.reply,/Which sport would you like to book\?$/);
  assert.equal(first.request.date,'2026-11-26');
  for(const message of ['padle','paddle','tmw']){
    const result=await turn(message);
    assert.match(result.reply,/mock openings tomorrow in Mezzeh and Abu Rummaneh/);
    assert.match(result.reply,/Where would you like to play\?$/);
    assert.equal(result.clarification_field,'area');
    assert.equal(result.request.sport,'padel');
    assert.equal(result.request.date,'2026-11-26');
    assert.equal(result.match,null);
  }
}));

test('date-first chat suggests times, narrows to sport and area, and accepts a suggested start',()=>withServer(async url=>{
  const turn=chat(url);
  const first=await turn('i want to play tmw');
  assert.equal(first.clarification_field,'sport');
  assert.match(first.reply,/padel at 09:00/);
  assert.match(first.reply,/tennis at 08:00/);
  assert.ok(first.suggestions);
  assert.deepEqual(first.suggestions,['Padel','Football','Tennis','Basketball']);
  assert.equal(first.match,null);

  const area=await turn(first.suggestions[0]);
  assert.match(area.reply,/Mezzeh and Abu Rummaneh/);
  assert.match(area.reply,/Where would you like to play\?$/);
  assert.ok(area.suggestions);
  assert.deepEqual(area.suggestions,['Mezzeh','Abu Rummaneh']);
  const time=await turn(area.suggestions[0]);
  assert.equal(time.clarification_field,'start_time');
  assert.match(time.reply,/in Mezzeh include 09:00–12:00 and 18:00–22:00/);
  assert.doesNotMatch(time.reply,/Abu Rummaneh/);
  assert.match(time.reply,/What time would you like to start\?$/);
  assert.ok(time.suggestions);
  assert.deepEqual(time.suggestions,['09:00','18:00']);
  assert.equal(time.match,null);

  const picked=await turn(time.suggestions[1]);
  assert.equal(picked.request.start_time,'18:00');
  assert.equal(picked.clarification_field,'duration');
  assert.equal(picked.suggestions,undefined);
}));

test('clarification suggestions follow capacity, past-time, duration and maintenance constraints',()=>withServer(async url=>{
  const capacity=await send(url,'football tomorrow for 14 players');
  assert.equal(capacity.clarification_field,'area');
  assert.match(capacity.reply,/Kafr Souseh/);
  assert.doesNotMatch(capacity.reply,/Malki/);
  const gap=await send(url,'football tomorrow at 7 pm for an hour');
  assert.match(gap.reply,/Kafr Souseh/);
  assert.doesNotMatch(gap.reply,/Malki/);
  assert.deepEqual(gap.suggestions,['Kafr Souseh']);
  const today=await send(url,'padel in Mezzeh today');
  assert.match(today.reply,/18:00–22:00/);
  assert.doesNotMatch(today.reply,/09:00/);
  const maintenance=await send(url,'padel in Mazzeh on Tuesday');
  assert.match(maintenance.reply,/09:00–12:00/);
  assert.doesNotMatch(maintenance.reply,/18:00/);
  assert.deepEqual(maintenance.suggestions,['09:00']);
  const duration=await send(url,'padel tomorrow at 11:30 am for an hour');
  assert.match(duration.reply,/Abu Rummaneh/);
  assert.doesNotMatch(duration.reply,/Mezzeh/);
}));

test('Levantine chat uses short answers and offers only mock availability',()=>withServer(async url=>{
  const turn=chat(url);
  const area=await turn('بدي احجز بادل بكرا');
  assert.equal(area.clarification_field,'area');
  assert.match(area.reply,/المزة.*أبو رمانة/);
  assert.deepEqual(area.suggestions,['المزة','أبو رمانة']);
  const opening=await turn('بالمزة');
  assert.equal(opening.clarification_field,'start_time');
  assert.match(opening.reply,/18:00–22:00/);
  assert.match(opening.reply,/أي ساعة بتحب تبلّش؟$/);
  const ambiguous=await turn('٧');
  assert.equal(ambiguous.reply,'قصدك الساعة 7 الصبح ولا المسا؟');
  assert.equal(ambiguous.request.start_time,null);
  const time=await turn('بالمسا');
  assert.equal(time.request.start_time,'19:00');
  assert.equal(time.clarification_field,'duration');
  assert.match(time.reply,/بالدقايق/);
  assert.equal((await turn('ساعة')).clarification_field,'number_of_players');
  const result=await turn('٤');
  assert.equal(result.status,'MATCH');
  assert.equal(result.request.language,'ar');
  assert.equal(result.match?.venue_id,'mz-padel');
  assert.equal(result.match?.end_time,'20:00');
  assert.match(result.reply,/تأكيد توفر تجريبي، مو حجز فعلي/);
}));

test('mixed-language chat preserves context through aliases and bare numeric answers',()=>withServer(async url=>{
  const turn=chat(url);
  const first=await turn('بدي padle tmr بالمزة');
  assert.equal(first.request.language,'mixed');
  assert.equal(first.clarification_field,'start_time');
  assert.match(first.reply,/ساعة/);
  assert.equal((await turn('8 pm')).request.start_time,'20:00');
  assert.equal((await turn('60')).request.duration_minutes,60);
  const result=await turn('٤');
  assert.equal(result.request.language,'mixed');
  assert.equal(result.status,'MATCH');
  assert.match(result.reply,/متوفر/);
  assert.equal((await send(url,'2moro')).request.date,'2026-11-26');
}));

test('explicit English and Arabic corrections replace only the edited fields',()=>withServer(async url=>{
  const turn=chat(url);
  assert.equal((await turn(fullPadel)).status,'MATCH');
  const friday=await turn('actually make it Friday');
  assert.equal(friday.request.date,'2026-11-27');
  assert.equal(friday.request.start_time,'19:00');
  assert.equal(friday.match?.venue_id,'mz-padel');
  const ambiguous=await turn('لا خلينا الساعة ٨');
  assert.equal(ambiguous.clarification_field,'start_time');
  assert.equal(ambiguous.request.start_time,null);
  assert.equal(ambiguous.request.date,'2026-11-27');
  assert.equal(ambiguous.match,null);
  const corrected=await turn('المسا');
  assert.equal(corrected.match?.start_time,'20:00');
  assert.equal(corrected.request.sport,'padel');
  assert.equal(corrected.request.area,'mezzeh');
  assert.equal(corrected.request.duration_minutes,60);
  assert.equal(corrected.request.number_of_players,4);
  const unclearDate=await turn('actually make it this weekend');
  assert.equal(unclearDate.clarification_field,'date');
  assert.equal(unclearDate.request.date,null);
  assert.equal(unclearDate.match,null);
}));

test('a correction with old and new details uses the replacement',()=>withServer(async url=>{
  const result=await send(url,'Padel tomorrow, actually make it Friday at 7 pm in Mezzeh for 60 minutes, 4 players.');
  assert.equal(result.status,'MATCH');
  assert.equal(result.match?.date,'2026-11-27');
}));

test('sessions are isolated and reset invalidates the preceding session ID',()=>withServer(async url=>{
  const alice=await send(url,'padel tmw');
  const bob=await send(url,'tennis');
  assert.notEqual(alice.session_id,bob.session_id);
  assert.equal(bob.request.date,null);
  const aliceAgain=await send(url,'Mezzeh',alice.session_id);
  assert.equal(aliceAgain.request.sport,'padel');
  assert.equal(aliceAgain.request.date,'2026-11-26');
  const resetResponse=await post(url,{session_id:alice.session_id,reset:true});
  assert.equal(resetResponse.status,200);
  const reset=await resetResponse.json();
  assert.notEqual(reset.session_id,alice.session_id);
  assert.equal((await send(url,'Mezzeh',reset.session_id)).clarification_field,'sport');
  const reused=await send(url,'Mezzeh',alice.session_id);
  assert.notEqual(reused.session_id,alice.session_id);
  assert.equal(reused.request.date,null);
  assert.equal((await send(url,'Friday',bob.session_id)).request.sport,'tennis');
  const unknown=randomUUID();
  assert.notEqual((await send(url,'padel',unknown)).session_id,unknown);
  assert.equal((await post(url,{message:'padel',session_id:'bad'})).status,400);
  assert.equal((await post(url,{message:'padel',reset:'true'})).status,400);
}));

test('a new booking phrase or ordinary request after a match starts a clean draft',()=>withServer(async url=>{
  const turn=chat(url);
  await turn('Padel in Mezzeh tomorrow');
  const newSport=await turn('I want to book football Friday');
  assert.equal(newSport.request.sport,'football');
  assert.equal(newSport.request.area,null);
  const second=await turn('start over, tennis');
  assert.equal(second.request.sport,'tennis');
  assert.equal(second.request.date,null);
  assert.equal(second.request.area,null);
  assert.equal((await turn(fullPadel)).status,'MATCH');
  const third=await turn('football Friday');
  assert.equal(third.request.sport,'football');
  assert.equal(third.request.area,null);
  assert.equal(third.request.start_time,null);
  assert.equal(third.request.duration_minutes,null);
  assert.equal(third.request.number_of_players,null);
  const reset=await post(url,{session_id:third.session_id,reset:true,message:'basketball'});
  assert.equal(reset.status,200);
  const result=await reset.json();
  assert.notEqual(result.session_id,third.session_id);
  assert.equal(result.request.sport,'basketball');
  assert.equal(result.request.date,null);
}));

test('expiry removes stale drafts and a relative date stays pinned across Damascus midnight',()=> {
  let time=new Date('2026-11-25T20:55:00Z').getTime();
  const now=()=>new Date(time);
  return withServer(async url=>{
    const first=await send(url,'padel tmw');
    time+=10*60*1000;
    const followUp=await send(url,'Mezzeh',first.session_id);
    assert.equal(followUp.request.date,'2026-11-26');
    assert.equal(followUp.trace.reference_date,'2026-11-26');
    time+=30*60*1000;
    const expired=await send(url,'Mezzeh',first.session_id);
    assert.notEqual(expired.session_id,first.session_id);
    assert.equal(expired.request.sport,null);
    assert.equal(expired.request.date,null);
  },localExtractor,now);
});

test('competing sports, dates, hours and group sizes prompt for one field',()=>withServer(async url=>{
  const turn=chat(url);
  const sport=await turn('padel or tennis tomorrow');
  assert.equal(sport.clarification_field,'sport');
  assert.equal(sport.request.sport,null);
  const date=await turn('padel, Friday or Saturday');
  assert.equal(date.clarification_field,'date');
  assert.equal(date.request.sport,'padel');
  assert.equal(date.request.date,null);
  const start=await turn('Friday in Mezzeh at 7 or 8 pm for an hour');
  assert.equal(start.clarification_field,'start_time');
  assert.equal(start.request.start_time,null);
  assert.equal(start.request.time_window,null);
  const players=await turn('8 pm');
  assert.equal(players.clarification_field,'number_of_players');
  const ambiguous=await turn('4 or 5');
  assert.equal(ambiguous.clarification_field,'number_of_players');
  assert.equal(ambiguous.request.number_of_players,null);
  assert.equal(ambiguous.match,null);
  assert.equal((await turn('four')).status,'MATCH');
}));

test('a pending question can give a short answer meaning and never guesses a field',()=>withServer(async url=>{
  const turn=chat(url);
  const bare=await turn('4');
  assert.equal(bare.clarification_field,'sport');
  assert.equal(bare.request.number_of_players,null);
  assert.equal((await turn('tennis tmw')).clarification_field,'area');
  assert.equal((await turn('any')).request.area,'any');
}));

test('validated Gemini evidence contributes to a turn and receives only the pending question context',()=> {
  const requests:object[]=[];
  const extractor=geminiExtractor({
    apiKey:'fixture-key',
    model:'fixture-model',
    fetcher:async (_url,options)=>{
      const wire=JSON.parse(String(options?.body));
      const input=JSON.parse(wire.contents[0].parts[0].text);
      requests.push(input);
      const raw={...emptyRaw(),number_of_players:input.customer_message==='a party of four'?'party of four':null};
      return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(raw)}]}}]});
    }
  });
  return withServer(async url=>{
    const turn=chat(url);
    await turn('Padel tomorrow at 7 pm in Mezzeh for 60 minutes');
    const result=await turn('a party of four');
    assert.equal(result.status,'MATCH');
    assert.equal(result.trace.source,'gemini');
    assert.equal(result.trace.evidence?.number_of_players,'party of four');
    assert.deepEqual(requests[1],{customer_message:'a party of four',pending_field:'number_of_players',needs_time_period:false});
  },extractor);
});

test('provider errors and invented evidence fall back safely in chat and still fail closed on the stateless endpoint',()=> {
  const extractor:Extractor=async message=>{
    if(message==='Mezzeh')return {raw:{...emptyRaw(),area:'Invented venue'},source:'gemini'};
    throw new Error('fixture provider failure');
  };
  return withServer(async url=>{
    const turn=chat(url);
    const first=await turn('padle tmw');
    assert.equal(first.trace.source,'local-fallback');
    assert.equal(first.clarification_field,'area');
    const second=await turn('Mezzeh');
    assert.equal(second.trace.source,'local-fallback');
    assert.equal(second.request.sport,'padel');
    assert.equal(second.request.date,'2026-11-26');
    assert.equal(second.request.area,'mezzeh');
    assert.equal(second.clarification_field,'start_time');
    assert.ok(!JSON.stringify(second).includes('Invented venue'));
    const third=await turn('7 pm, 60 minutes, 4 players');
    assert.equal(third.match?.venue_id,'mz-padel');
    const stateless=await post(url,{message:fullPadel},'/api/booking');
    assert.equal(stateless.status,503);
    assert.equal((await stateless.json()).status,'EXTRACTION_ERROR');
  },extractor);
});

test('a provider cannot resolve conflicting local evidence or assign a bare quantity to a different pending field',()=> {
  const extractor:Extractor=async message=>({
    raw:{...emptyRaw(),sport:message.includes('tennis')?'tennis':null,number_of_players:message==='60'?'60':null},
    source:'gemini'
  });
  return withServer(async url=>{
    const turn=chat(url);
    assert.equal((await turn('padel or tennis tomorrow')).request.sport,null);
    await turn('padel at 7 pm in Mezzeh');
    const result=await turn('60');
    assert.equal(result.request.duration_minutes,60);
    assert.equal(result.request.number_of_players,null);
    assert.equal(result.clarification_field,'number_of_players');
  },extractor);
});

test('concurrent turns and resets cannot overwrite an in-flight turn',()=> {
  const {promise:started,resolve:start}=Promise.withResolvers<void>();
  const {promise:released,resolve:release}=Promise.withResolvers<void>();
  const extractor=async (message:string,context?:ExtractionContext)=>{
    if(message==='Mezzeh'){
      start();
      await released;
    }
    return localExtractor(message,context);
  };
  return withServer(async url=>{
    const first=await send(url,'padel tomorrow');
    const inFlight=send(url,'Mezzeh',first.session_id);
    await started;
    try{
      const reset=await post(url,{session_id:first.session_id,reset:true});
      assert.equal(reset.status,409);
      const simultaneous=await post(url,{session_id:first.session_id,message:'Friday'});
      assert.equal(simultaneous.status,409);
      assert.equal((await send(url,'tennis')).request.sport,'tennis');
    }finally{
      release();
    }
    assert.equal((await inFlight).request.area,'mezzeh');
    assert.equal((await send(url,'19:00',first.session_id)).request.date,'2026-11-26');
  },extractor);
});

test('stateful checks still enforce integer capacity, full intervals, the horizon and future alternatives',()=>withServer(async url=>{
  const turn=chat(url);
  const negativeDuration=await turn('padel in Mezzeh tomorrow at 9:30 pm for -90 minutes');
  assert.equal(negativeDuration.clarification_field,'duration');
  await turn('90 minutes');
  const fractional=await turn('4.5 players');
  assert.equal(fractional.clarification_field,'number_of_players');
  assert.equal(fractional.match,null);
  const capacity=await turn('5 players');
  assert.equal(capacity.status,'NO_AVAILABILITY');
  assert.deepEqual(capacity.alternatives,[]);
  const interval=await turn('4 players');
  assert.equal(interval.status,'ALTERNATIVES');
  assert.equal(interval.match,null);
  const latest=addDays(localParts(clock()).date,6);
  assert.ok(interval.alternatives.every(slot=>slot.sport==='padel' && slot.capacity>=4 && slot.date<=latest));
  const past=await turn('actually today at 10 am');
  assert.equal(past.status,'ALTERNATIVES');
  assert.ok(past.alternatives.every(slot=>slot.date>'2026-11-25' || slot.start_time>='15:00'));
  assert.deepEqual((await turn('actually today at 10 am')).alternatives,past.alternatives);
  const outOfRange=await turn('actually in 9 days');
  assert.equal(outOfRange.status,'OUT_OF_RANGE');
  assert.equal(outOfRange.clarification_field,'date');
  assert.equal(outOfRange.match,null);
}));

test('original booking endpoint ignores chat IDs and returns independent single-message results',()=>withServer(async url=>{
  const chat=await send(url,fullPadel);
  const response=await post(url,{message:'Friday',session_id:chat.session_id},'/api/booking');
  assert.equal(response.status,200);
  const single=await response.json();
  assert.equal(single.session_id,undefined);
  assert.equal(single.request.sport,null);
  assert.equal(single.request.date,'2026-11-27');
  assert.equal(single.clarification_field,'sport');
  assert.equal(single.suggestions,undefined);
}));
