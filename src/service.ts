import type {Extractor,Field,Request,Result,Slot} from './types.ts';
import {arabicReply,areaOf,languageOf,sportOf,validateEvidence} from './intent.ts';
import {addDays,hhmm,localParts,resolveDate,resolveDuration,resolvePlayers,resolveTime,ZONE} from './time.ts';
import {findSlots} from './availability.ts';
const questions:Record<Field,[string,string]>={sport:['شو الرياضة اللي بدك تحجز إلها؟','Which sport would you like to book?'],area:['بأي منطقة بدك تحجز؟','Which area would you prefer?'],date:['لأي يوم بدك الحجز؟','Which day would you like to book?'],start_time:['أي ساعة بدك الحجز، الصبح ولا المسا؟','What time would you like, including AM or PM?'],duration:['قديش بدك مدة الحجز؟','How long would you like to book for?'],number_of_players:['قديش عدد اللاعبين؟','How many players will be joining?']};
function describe(s:Slot,ar:boolean){return `${ar?s.venue_ar:s.venue} — ${s.date}, ${s.start_time}–${s.end_time}`;}
export async function book(message:string,extractor:Extractor,clock:()=>Date=()=>new Date()):Promise<Result> {
  if(typeof message!=='string'||!message.trim()||message.length>2000)throw new Error('Message must contain 1–2000 characters');
  const now=clock();const today=localParts(now).date;const ar=arabicReply(message);const language=languageOf(message);
  const request:Request={sport:null,area:null,date:null,start_time:null,duration_minutes:null,number_of_players:null,language,time_window:null};
  const trace:Result['trace']={source:'unavailable',timezone:ZONE,reference_date:today,checks:[],evidence:null};
  const result=(status:Result['status'],reply:string,match:Slot|null=null,alternatives:Slot[]=[],field:Field|null=null):Result=>({status,request,reply,match,alternatives,clarification_field:field,trace});
  let raw;
  try{const e=await extractor(message);raw=validateEvidence(e.raw,message);trace.source=e.source;trace.evidence=raw;trace.checks.push('Extraction evidence validated');}catch{trace.checks.push('Extraction unavailable or invalid; no booking decision');return result('EXTRACTION_ERROR',ar?'ما قدرت افهم الطلب هلأ، فيك تعيد صياغته؟':'I couldn’t read that request right now. Could you rephrase it?');}
  request.sport=sportOf(raw.sport);request.area=areaOf(raw.area);request.date=resolveDate(raw.date,now);const time=resolveTime(raw.start_time);
  request.start_time=time?.kind==='exact'?hhmm(time.minute):null;request.time_window=time?.kind==='window'?{start:hhmm(time.start),end:hhmm(time.end)}:null;
  request.duration_minutes=resolveDuration(raw.duration);request.number_of_players=resolvePlayers(raw.number_of_players);trace.checks.push('Date, time, duration and capacity normalized in code');
  if(request.date&&(request.date<today||request.date>addDays(today,6))){trace.checks.push('Date outside seven-day horizon');return result('OUT_OF_RANGE',ar?`الحجوزات التجريبية من ${today} لـ ${addDays(today,6)}. أي يوم بناسبك ضمن هالفترة؟`:`Mock availability covers ${today} through ${addDays(today,6)}. Which day in that range works for you?`,null,[],'date');}
  // Sport first; a missing duration remains missing even if the slot could fit a default.
  const missing: [Field,unknown][]=[['sport',request.sport],['date',request.date],['area',request.area],['start_time',time],['duration',request.duration_minutes],['number_of_players',request.number_of_players]];
  const field=missing.find(([,v])=>v===null)?.[0];if(field){trace.checks.push(`Clarification needed: ${field}`);return result('NEEDS_INFO',questions[field][ar?0:1],null,[],field);}
  const {match,alternatives}=findSlots(request,time!,now);trace.checks.push('Sport, capacity, full interval, horizon and past times checked');
  if(match){trace.checks.push('Exact area/date/time constraint satisfied');return result('MATCH',ar?`تمام! متوفر ${describe(match,true)} لـ ${request.number_of_players} لاعبين. هاد تأكيد توفر تجريبي، مو حجز فعلي.`:`Good news! ${describe(match,false)} is available for ${request.number_of_players} players. This confirms mock availability, not a real reservation.`,match);}
  if(alternatives.length){trace.checks.push('Alternatives ranked and diversified');return result('ALTERNATIVES',ar?`ما في موعد مطابق، بس في هالخيارات الأقرب: ${alternatives.map(s=>describe(s,true)).join('؛ ')}. أي واحد بناسبك؟`:`No exact match, but these are the closest available options: ${alternatives.map(s=>describe(s,false)).join('; ')}. Which works for you?`,null,alternatives);}
  trace.checks.push('No eligible venue/interval in seven days');return result('NO_AVAILABILITY',ar?'ما في موعد مناسب لهالرياضة والمدة وعدد اللاعبين خلال الأسبوع. فيك تغير عدد اللاعبين أو المدة؟':'No available slot fits that sport, duration and group size in the next seven days. Could you change the group size or duration?');
}
