import type {ExtractionContext, Extractor, Field, RawIntent, Request, Result, Slot, TimeRequest} from './types.ts';
import {FIELDS} from './types.ts';
import {arabicReply, areaOf, isCorrection, languageOf, localExtractor, opensBooking, recognizeTurn, sportOf, startsNewBooking, validateEvidence} from './intent.ts';
import {addDays, ambiguousClock, hhmm, localParts, normalizeText, resolveDate, resolveDuration, resolvePlayers, resolveTime, timePeriod, ZONE} from './time.ts';
import {findSlots} from './availability.ts';

const questions:Record<Field,[string,string]>={
  sport:['شو الرياضة اللي بدك تحجز إلها؟','Which sport would you like to book?'],
  area:['بأي منطقة بدك تحجز؟','Which area would you prefer?'],
  date:['لأي يوم بدك الحجز؟','Which day would you like to book?'],
  start_time:['أي ساعة بدك الحجز، الصبح ولا المسا؟','What time would you like, including AM or PM?'],
  duration:['قديش بدك مدة الحجز؟','How long would you like to book for?'],
  number_of_players:['قديش عدد اللاعبين؟','How many players will be joining?']
};

export type BookingDraft = {
  request:Request;
  time:TimeRequest|null;
  ambiguousTime:ReturnType<typeof ambiguousClock>;
  arabic:boolean;
  pendingField:Field|null;
  lastStatus:Result['status']|null;
};

function emptyDraft(message:string):BookingDraft {
  return {
    request:{sport:null,area:null,date:null,start_time:null,duration_minutes:null,number_of_players:null,language:languageOf(message),time_window:null},
    time:null,ambiguousTime:null,arabic:arabicReply(message),pendingField:null,lastStatus:null
  };
}

function describe(slot:Slot,ar:boolean){
  return `${ar?slot.venue_ar:slot.venue} — ${slot.date}, ${slot.start_time}–${slot.end_time}`;
}

function neutralReply(message:string):boolean {
  return /^(?:[\d\s:.,]+(?:\s*(?:am|pm))?|a\.?m\.?|p\.?m\.?|padel|padle|paddle|tmw|tmr|2moro)[.!?؟]*$/.test(normalizeText(message));
}

function mergeEvidence(draft:BookingDraft, raw:RawIntent, ambiguous:Field[], now:Date) {
  const {request,pendingField}=draft;
  const has=(field:Field)=>raw[field]!==null || ambiguous.includes(field);
  if(has('sport'))request.sport=sportOf(raw.sport);
  if(has('area'))request.area=areaOf(raw.area);
  if(has('date'))request.date=resolveDate(raw.date,now);
  if(has('duration')){
    const duration=normalizeText(raw.duration??'');
    const evidence=pendingField==='duration' && /^\d+$/.test(duration)?`${duration} minutes`:raw.duration;
    request.duration_minutes=resolveDuration(evidence);
  }
  if(has('number_of_players'))request.number_of_players=resolvePlayers(raw.number_of_players);
  if(has('start_time')){
    const period=raw.start_time?timePeriod(raw.start_time):null;
    if(pendingField==='start_time' && draft.ambiguousTime && period){
      const {hour,minute}=draft.ambiguousTime;
      draft.time=resolveTime(`${hhmm(hour*60+minute)} ${period}`);
      draft.ambiguousTime=null;
    }else{
      draft.time=resolveTime(raw.start_time);
      draft.ambiguousTime=ambiguousClock(raw.start_time);
    }
    request.start_time=draft.time?.kind==='exact'?hhmm(draft.time.minute):null;
    request.time_window=draft.time?.kind==='window'?{start:hhmm(draft.time.start),end:hhmm(draft.time.end)}:null;
  }
}

function modelEvidence(field:Field,value:string|null,context?:ExtractionContext):string|null {
  // A bare quantity can only answer the question that gives it a unit or meaning.
  if(value && /^\d+(?:[.:]\d+)?$/.test(normalizeText(value))){
    if(field==='duration' || field==='number_of_players')return context?.pendingField===field?value:null;
    if(field==='start_time' && !normalizeText(value).includes(':'))return context?.pendingField===field?value:null;
  }
  return value;
}

async function processTurn(message:string,extractor:Extractor,now:Date,conversational:boolean,previous?:BookingDraft) {
  if(typeof message!=='string'||!message.trim()||message.length>2000)throw new Error('Message must contain 1–2000 characters');
  const today=localParts(now).date;
  const correction=isCorrection(message);
  const ended=previous?.lastStatus==='MATCH'||previous?.lastStatus==='ALTERNATIVES'||previous?.lastStatus==='NO_AVAILABILITY';
  const mentionedSport=sportOf(message);
  const changedSport=Boolean(previous?.request.sport && mentionedSport && mentionedSport!==previous.request.sport);
  const opens=opensBooking(message);
  const newRequest=(opens && changedSport) || (ended && (previous?.lastStatus==='MATCH' || opens || changedSport));
  const fresh=startsNewBooking(message) || (!correction && newRequest);
  const draft=previous && !fresh?{...previous,request:{...previous.request}}:emptyDraft(message);
  if(conversational && !neutralReply(message)){
    draft.arabic=arabicReply(message);
    draft.request.language=languageOf(message);
  }
  const {request,arabic:ar}=draft;
  const context=conversational?{pendingField:draft.pendingField,needsTimePeriod:draft.ambiguousTime!==null}:undefined;
  const trace:Result['trace']={source:'unavailable',timezone:ZONE,reference_date:today,checks:[],evidence:null};
  const finish=(status:Result['status'],reply:string,match:Slot|null=null,alternatives:Slot[]=[],field:Field|null=null)=>{
    draft.pendingField=field;
    draft.lastStatus=status;
    const result:Result={status,request,reply,match,alternatives,clarification_field:field,trace};
    return {result,draft};
  };

  const local=recognizeTurn(message,context);
  const raw=local.raw;
  try{
    if(extractor===localExtractor){
      trace.source='local';
    }else{
      const extracted=await extractor(message,context);
      if(extracted.source!=='local' && extracted.source!=='gemini')throw new Error('Invalid extraction source');
      const model=validateEvidence(extracted.raw,message);
      for(const field of FIELDS)raw[field]??=modelEvidence(field,model[field],context);
      trace.source=extracted.source;
    }
    trace.checks.push('Extraction evidence validated');
  }catch{
    trace.checks.push('Extraction unavailable or invalid');
    if(!conversational){
      return finish('EXTRACTION_ERROR',ar?'ما قدرت افهم الطلب هلأ، فيك تعيد صياغته؟':'I couldn’t read that request right now. Could you rephrase it?');
    }
    trace.source='local-fallback';
    trace.checks.push('Used bounded local recognition');
  }
  for(const field of local.ambiguous)raw[field]=null;
  if(context?.pendingField==='start_time' && context.needsTimePeriod && message.trim().length<=160 && timePeriod(message)){
    raw.start_time=message.trim();
  }
  trace.evidence=validateEvidence(raw,message);
  const updated=FIELDS.some(field=>raw[field]!==null) || local.ambiguous.length>0;
  mergeEvidence(draft,trace.evidence,local.ambiguous,now);
  trace.checks.push('Date, time, duration and capacity normalized in code');

  const lastDay=addDays(today,6);
  if(request.date && (request.date<today || request.date>lastDay)){
    trace.checks.push('Date outside seven-day horizon');
    return finish('OUT_OF_RANGE',ar?`الحجوزات التجريبية من ${today} لـ ${lastDay}. أي يوم بناسبك ضمن هالفترة؟`:`Mock availability covers ${today} through ${lastDay}. Which day in that range works for you?`,null,[],'date');
  }

  const missing:[Field,unknown][]=[['sport',request.sport],['date',request.date],['area',request.area],['start_time',draft.time],['duration',request.duration_minutes],['number_of_players',request.number_of_players]];
  const field=local.ambiguous[0]??missing.find(([,value])=>value===null)?.[0];
  if(field){
    trace.checks.push(`Clarification needed: ${field}`);
    let reply=questions[field][ar?0:1];
    if(conversational && field==='duration')reply=ar?'قديش بدك مدة الحجز بالدقايق؟':'How many minutes would you like to book for?';
    if(conversational && field==='start_time' && draft.ambiguousTime){
      const {hour,minute}=draft.ambiguousTime;
      const time=minute?`${hour}:${String(minute).padStart(2,'0')}`:String(hour);
      reply=ar?`قصدك الساعة ${time} الصبح ولا المسا؟`:`Did you mean ${time} AM or ${time} PM?`;
    }
    return finish('NEEDS_INFO',reply,null,[],field);
  }
  if(conversational && !updated){
    trace.checks.push('No clear update to the draft');
    return finish('NEEDS_INFO',ar?'شو حابب تغيّر بالحجز؟':'What would you like to change about the booking?');
  }

  const {match,alternatives}=findSlots(request,draft.time!,now);
  trace.checks.push('Sport, capacity, full interval, horizon and past times checked');
  if(match){
    trace.checks.push('Exact area/date/time constraint satisfied');
    return finish('MATCH',ar?`تمام! متوفر ${describe(match,true)} لـ ${request.number_of_players} لاعبين. هاد تأكيد توفر تجريبي، مو حجز فعلي.`:`Good news! ${describe(match,false)} is available for ${request.number_of_players} players. This confirms mock availability, not a real reservation.`,match);
  }
  if(alternatives.length){
    trace.checks.push('Alternatives ranked and diversified');
    const options=alternatives.map(slot=>describe(slot,ar)).join(ar?'؛ ':'; ');
    if(conversational){
      return finish('ALTERNATIVES',ar?`ما في موعد مطابق بالتوفر التجريبي. أقرب الخيارات هي ${options}. شو اليوم أو الساعة أو المنطقة اللي بتحب تغيّرها؟`:`The mock inventory has no exact match. The closest options are ${options}. Which date, time or area would you like to change?`,null,alternatives);
    }
    return finish('ALTERNATIVES',ar?`ما في موعد مطابق، بس في هالخيارات الأقرب: ${options}. أي واحد بناسبك؟`:`No exact match, but these are the closest available options: ${options}. Which works for you?`,null,alternatives);
  }
  trace.checks.push('No eligible venue/interval in seven days');
  return finish('NO_AVAILABILITY',ar?'ما في موعد مناسب لهالرياضة والمدة وعدد اللاعبين خلال الأسبوع. فيك تغير عدد اللاعبين أو المدة؟':'No available slot fits that sport, duration and group size in the next seven days. Could you change the group size or duration?');
}

export async function book(message:string,extractor:Extractor,clock:()=>Date=()=>new Date()):Promise<Result> {
  return (await processTurn(message,extractor,clock(),false)).result;
}

export function bookingTurn(message:string,extractor:Extractor,now:Date,previous?:BookingDraft) {
  return processTurn(message,extractor,now,true,previous);
}
