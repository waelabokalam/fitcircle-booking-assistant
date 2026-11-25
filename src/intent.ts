import {FIELDS} from './types.ts';
import type {RawIntent, Field, Language, Sport, Area, Extractor, ExtractionContext} from './types.ts';
import {normalizeText, resolveDuration, resolvePlayers, resolveTime, timePeriod} from './time.ts';
const SPORTS: [Sport,RegExp][]=[['padel',/\b(?:padel|padle|paddle)\b|بادل|باديل|بـادل/iu],['football',/\bfootball\b|\bsoccer\b|كرة\s*قدم|كورة\s*قدم|فوتبول|ملعب\s*قدم/iu],['basketball',/\bbasketball\b|كرة\s*سلة|كرة\s*السلة|باسكت|سلة/iu],['tennis',/\btennis\b|تنس/iu]];
const AREAS:[Area,RegExp][]=[['mezzeh',/\b(?:mezzeh|mazzeh|mezze|mazze|mezzeh)\b|(?:بال|ال)?مز[ةه]/iu],['malki',/\b(?:al[ -]?)?malki\b|(?:بال|ال)?مالكي/iu],['abu_rummaneh',/\b(?:abu|abo|abou)\s*r[ou]mm?an(?:eh|ah|a|e)\b|[اأإ]بو\s*رم[اأ]ن[ةه]/iu],['kafr_souseh',/\bkafr\s*s[ou]+s(?:eh|ah|a)\b|كفر\s*سوس[ةه]/iu],['dummar',/\b(?:dummar|damar|dummer)\b|دمر/iu],['baramkeh',/\b(?:baramkeh|baramke|baramika)\b|برامك[ةه]/iu],['adawi',/\b(?:adawi|aadawi|addawi)\b|(?:بال|ال)?عدوي/iu],['al_wahda',/\b(?:al[ -]?)?wahd[ae](?:\s+sports\s+club)?\b|(?:نادي\s*)?الوحدة/iu],['any',/\b(?:any area|anywhere|any neighborhood)\b|[اأ]ي\s*(?:منطقة|مكان)|وين\s*ما\s*كان/iu]];
export function sportOf(raw:string|null):Sport|null {return raw?SPORTS.find(([,r])=>r.test(raw))?.[0]??null:null;}
export function areaOf(raw:string|null):Area|null {
  if(!raw)return null;
  if(/^(?:any|اي)$/.test(normalizeText(raw)))return 'any';
  return AREAS.find(([,r])=>r.test(raw))?.[0]??null;
}
export function languageOf(message:string):Language {const ar=/[\u0621-\u064a]/.test(message);const en=/[a-z]/i.test(message);return ar&&en?'mixed':ar?'ar':'en';}
export function arabicReply(message:string):boolean {const ar=message.match(/[\u0621-\u064a]+/g)?.length??0;const en=message.match(/[a-z]+/gi)?.length??0;return ar>0&&ar>=en;}
export function emptyRaw():RawIntent {return Object.fromEntries(FIELDS.map(k=>[k,null])) as RawIntent;}
const NUMERALS='0-9٠-٩۰-۹';
const N=`[${NUMERALS}]`;
const CLOCK_EDGE=`[${NUMERALS}:]`;
const PERIOD='(?:a\\.?m\\.?|p\\.?m\\.?|in the morning|in the evening|tonight|بالمسا|المسا|مساء|مسا|بالصبح|الصبح|صباح|بالليل)(?![a-z])';
const patterns:Record<Exclude<Field,'sport'|'area'>,RegExp[]>={
  date:[new RegExp(`${N}{4}-${N}{2}-${N}{2}`,'u'), /day after (?:tomorrow|tmw|tmr|2moro)|بعد\s*(?:بكرا|بكره|بكرة|غد)/iu,new RegExp(`(?:in\\s+${N}+\\s+days?\\b|بعد\\s+${N}+\\s+(?:[اأإ]يام|يوم))`,'iu'),/\b(?:tomorrow|tmw|tmr|2moro|today|yesterday|tonight|(?:this |next )?weekend|next week)\b|بكرا|بكره|بكرة|غد[اً]?|اليوم|هالليلة|الليلة|مبارح|امبارح|[اأ]مس|البارحة|نهاية الأسبوع|الأسبوع الجاي/iu,/(?:\b(?:next|this)\s+)?\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|(?:ال[اأ]حد|ال[اإ]ثنين|الثلاثاء|التلاتا|ال[اأ]ربعاء|الخميس|الجمع[ةه]|السبت)(?:\s+(?:الجاي|القادم))?/iu],
  start_time:[
    new RegExp(`(?:\\bat\\s+|الساعة\\s*|الساعه\\s*|ع\\s*)${N}{1,2}(?::${N}{2})?(?:\\s*${PERIOD})?(?!${CLOCK_EDGE})`,'iu'),
    new RegExp(`(?<!${CLOCK_EDGE})${N}{1,2}:${N}{2}(?:\\s*${PERIOD})?(?!${CLOCK_EDGE})`,'iu'),
    new RegExp(`(?<!${CLOCK_EDGE})${N}{1,2}\\s*${PERIOD}`,'iu'),
    /\b(?:evening|morning|afternoon|tonight|noon|any time|anytime)\b|بعد الظهر|العصر|المسا|مساء|الصبح|صباح|بالليل|الظهر|[اأ]ي وقت/iu
  ],
  duration:[/ساعة ونص(?:ف)?|ساعه ونص|نص ساعة|نصف ساعة|an hour and a half|half an hour|ساعتين|ساعتان|\btwo hours\b/iu,new RegExp(`-?${N}+(?:[.]${N}+)?\\s*(?:hours?\\b|hrs?\\b|h\\b|minutes?\\b|mins?\\b|m\\b|ساع(?:ة|ه|ات)|دقيق(?:ة|ه)|دقائق|دقايق)`,'iu'),/\b(?:an|one) hour\b|(?:ل?مد[ةه]|مدتها)\s*ساع[ةه]|لساعة(?!\s*[0-9٠-٩۰-۹])/iu],
  number_of_players:[new RegExp(`(?:(?:نحنا|نحن|احنا|إحنا|عددنا|عدد اللاعبين|we are|we're)\\s*-?${N}+(?:\\.${N}+)?|(?<!${N})-?${N}+(?:\\.${N}+)?\\s*(?:people|players?|persons?|ppl|اشخاص|[اأ]شخاص|لاعب(?:ين|ون)?|شباب|أفراد|افراد))`,'iu'),/\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:people|players?)\b|(?:نحنا|نحن|احنا)\s*(?:اربعة|أربعة|اربع|اتنين|اثنين|تنين|ثلاثة|تلاتة|خمسة|ستة|سبعة|تمانية|تسعة|عشرة)/iu]
};
const FIELD_PATTERNS:Record<Field,RegExp[]> = {
  sport:SPORTS.map(([,pattern])=>pattern),
  area:AREAS.map(([,pattern])=>pattern),
  ...patterns
};
const CORRECTION = /\b(?:actually|instead(?!\s+of)|rather|make it|change|switch to|correction|sorry)\b|خلينا|خلّينا|خليني|غي[ّ]?ر|قصدي|بدل ما|(?:^|[\s،,])لا[،,\s]/giu;
const FRESH_BOOKING = /\b(?:(?:new|another) (?:booking|reservation)|book (?:another|again)|start (?:over|a new booking)|reset(?: chat)?)\b|حجز (?:جديد|تاني|ثاني)|[اأإ]?حجز (?:كمان|من جديد)|نبلش من جديد|نبدأ من جديد/iu;
export function isCorrection(message:string):boolean {return message.search(CORRECTION)>=0;}
export function startsNewBooking(message:string):boolean {return FRESH_BOOKING.test(message);}
export function opensBooking(message:string):boolean {
  return /\b(?:book|reserve|reservation|booking)\b|احجز|أحجز|حجز/iu.test(message);
}

function shortEvidence(field:Field, phrase:string):string|null {
  const clean=phrase.trim().replace(/[.!?؟]+$/u,'');
  const normalized=normalizeText(clean);
  if(field==='area' && /^(?:any|اي)$/.test(normalized))return clean;
  if(field==='number_of_players' && /^(?:\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|واحد|اتنين|اثنين|تنين|ثلاثة|تلاتة|اربعة|اربع|خمسة|ستة|سبعة|ثمانية|تمانية|تسعة|عشرة)$/.test(normalized))return clean;
  if(field==='duration' && /^(?:\d{1,3}|ساعة|ساعه)$/.test(normalized))return clean;
  if(field==='start_time' && /^\d{1,2}(?::\d{2})?$/.test(normalized))return clean;
  return null;
}

function valueKey(field:Field,value:string):string {
  const normalized=normalizeText(value);
  switch(field){
    case 'sport': return sportOf(value)??normalized;
    case 'area': return areaOf(value)??normalized;
    case 'date': return /^(?:tomorrow|tmw|tmr|2moro|بكرا|بكره|بكرة|غد[ا]?)$/.test(normalized)?'tomorrow':normalized;
    case 'start_time': return JSON.stringify(resolveTime(value)??normalized);
    case 'duration': return String(resolveDuration(value)??normalized);
    case 'number_of_players': return String(resolvePlayers(value)??normalized);
  }
}

export function recognizeTurn(message:string,context?:ExtractionContext) {
  const raw=emptyRaw();
  const ambiguous:Field[]=[];
  const revisions=[...message.matchAll(CORRECTION)];
  const lastRevision=revisions.at(-1);
  const correctionEnd=lastRevision ? lastRevision.index+lastRevision[0].length : 0;
  const choices=message.split(/\s+(?:or|أو|او|ولا)\s+/iu);
  const candidates:Record<Field,{value:string; start:number}[]> = {sport:[],area:[],date:[],start_time:[],duration:[],number_of_players:[]};
  for(const field of FIELDS){
    const spans:{value:string;start:number;end:number}[]=[];
    // More specific patterns come first, e.g. “day after tomorrow” before “tomorrow”.
    for(const pattern of FIELD_PATTERNS[field]){
      for(const match of message.matchAll(new RegExp(pattern.source,pattern.flags+'g'))){
        const start=match.index, end=start+match[0].length;
        if(match[0].length<=160 && !spans.some(span=>start<span.end && end>span.start))spans.push({value:match[0],start,end});
      }
    }
    candidates[field]=spans;
  }
  const numericFields=['start_time','duration','number_of_players'] as const;
  const numericHints=numericFields.filter(field=>candidates[field].length>0);
  const shortField=numericHints.length===1 ? numericHints[0] : context?.pendingField;
  if(shortField && (choices.length>1 || !candidates[shortField].length)){
    let offset=0;
    for(const choice of choices){
      const start=message.indexOf(choice,offset);
      offset=start+choice.length;
      const answer=shortEvidence(shortField,choice) ??
        (shortField==='start_time' && choices.length>1 && timePeriod(choice) ? choice.trim() : null);
      if(answer && answer.length<=160)candidates[shortField].push({value:answer,start});
    }
  }
  for(const field of FIELDS){
    const values=candidates[field];
    const revised=values.filter(({start})=>start>=correctionEnd);
    const current=revised.length ? revised : values;
    const supported=current.filter(({start})=>!/(?:\b(?:not|except|instead of|don't want)\s+|(?:مو|مش|بدون)\s+)(?:(?:at|in|on|for)\s+)?$/iu.test(message.slice(0,start)));
    if(current.length && (!supported.length || new Set(supported.map(({value})=>valueKey(field,value))).size>1)){
      ambiguous.push(field);
    }else if(supported.length){
      raw[field]=supported[0].value;
    }
  }
  return {raw,ambiguous};
}
export const localExtractor:Extractor=async (message,context)=>({raw:recognizeTurn(message,context).raw,source:'local'});
export function validateEvidence(input:unknown,message:string):RawIntent {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid extraction object');
  const obj=input as Record<string,unknown>;
  if(Object.keys(obj).length!==FIELDS.length||Object.keys(obj).some(k=>!FIELDS.includes(k as Field)))throw new Error('Unexpected extraction fields');
  const raw=emptyRaw();
  for(const key of FIELDS){const v=obj[key];if(v===null)continue;if(typeof v!=='string'||!v.trim()||v.length>160||!message.includes(v))throw new Error(`Unsupported evidence: ${key}`);raw[key]=v;}
  // Prevent the model from treating the Arabic clock marker as a duration.
  if(raw.duration && raw.start_time && normalizeText(raw.start_time).includes(normalizeText(raw.duration)))raw.duration=null;
  return raw;
}
