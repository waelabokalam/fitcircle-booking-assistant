import {FIELDS} from './types.ts';
import type {RawIntent, Field, Language, Sport, Area, Extractor} from './types.ts';
import {normalizeText} from './time.ts';
const SPORTS: [Sport,RegExp][]=[['padel',/\bpadel\b|\bpaddle\b|بادل|باديل|بـادل/iu],['football',/\bfootball\b|\bsoccer\b|كرة\s*قدم|كورة\s*قدم|فوتبول|ملعب\s*قدم/iu],['basketball',/\bbasketball\b|كرة\s*سلة|كرة\s*السلة|باسكت|سلة/iu],['tennis',/\btennis\b|تنس/iu]];
const AREAS:[Area,RegExp][]=[['mezzeh',/\b(?:mezzeh|mazzeh|mezze|mazze|mezzeh)\b|(?:بال|ال)?مز[ةه]/iu],['malki',/\b(?:al[ -]?)?malki\b|(?:بال|ال)?مالكي/iu],['abu_rummaneh',/\b(?:abu|abo|abou)\s*r[ou]mm?an(?:eh|ah|a|e)\b|[اأإ]بو\s*رم[اأ]ن[ةه]/iu],['kafr_souseh',/\bkafr\s*s[ou]+s(?:eh|ah|a)\b|كفر\s*سوس[ةه]/iu],['dummar',/\b(?:dummar|damar|dummer)\b|دمر/iu],['baramkeh',/\b(?:baramkeh|baramke|baramika)\b|برامك[ةه]/iu],['any',/\b(?:any area|anywhere|any neighborhood)\b|[اأ]ي\s*(?:منطقة|مكان)|وين\s*ما\s*كان/iu]];
export function sportOf(raw:string|null):Sport|null {return raw?SPORTS.find(([,r])=>r.test(raw))?.[0]??null:null;}
export function areaOf(raw:string|null):Area|null {return raw?AREAS.find(([,r])=>r.test(raw))?.[0]??null:null;}
export function languageOf(message:string):Language {const ar=/[\u0621-\u064a]/.test(message);const en=/[a-z]/i.test(message);return ar&&en?'mixed':ar?'ar':'en';}
export function arabicReply(message:string):boolean {const ar=message.match(/[\u0621-\u064a]+/g)?.length??0;const en=message.match(/[a-z]+/gi)?.length??0;return ar>0&&ar>=en;}
export function emptyRaw():RawIntent {return Object.fromEntries(FIELDS.map(k=>[k,null])) as RawIntent;}
const N='[0-9٠-٩۰-۹]';
const patterns:Record<Exclude<Field,'sport'|'area'>,RegExp[]>={
  date:[new RegExp(`${N}{4}-${N}{2}-${N}{2}`,'u'), /day after tomorrow|بعد\s*(?:بكرا|بكره|بكرة|غد)/iu,new RegExp(`(?:in\\s+${N}+\\s+days?\\b|بعد\\s+${N}+\\s+(?:[اأإ]يام|يوم))`,'iu'),/\b(?:tomorrow|today|yesterday|tonight)\b|بكرا|بكره|بكرة|غد[اً]?|اليوم|هالليلة|الليلة|مبارح|امبارح|[اأ]مس|البارحة/iu,/(?:\b(?:next|this)\s+)?\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|(?:ال[اأ]حد|ال[اإ]ثنين|الثلاثاء|التلاتا|ال[اأ]ربعاء|الخميس|الجمع[ةه]|السبت)(?:\s+(?:الجاي|القادم))?/iu],
  start_time:[new RegExp(`(?:\\bat\\s+|الساعة\\s*|الساعه\\s*|ع\\s*)${N}{1,2}(?::${N}{2})?(?:\\s*(?:a\\.?m\\.?|p\\.?m\\.?|المسا|مساء|مسا|الصبح|صباح|بالليل))?`,'iu'),new RegExp(`(?<!${N})${N}{1,2}:${N}{2}(?:\\s*(?:am|pm|المسا|مساء|الصبح))?(?!${N})`,'iu'),new RegExp(`(?<!${N})${N}{1,2}\\s*(?:a\\.?m\\.?|p\\.?m\\.?|المسا|مساء|الصبح)(?![a-z])`,'iu'),/\b(?:evening|morning|afternoon|tonight|noon|any time|anytime)\b|بعد الظهر|العصر|المسا|مساء|الصبح|صباح|بالليل|الظهر|[اأ]ي وقت/iu],
  duration:[/ساعة ونص(?:ف)?|ساعه ونص|نص ساعة|نصف ساعة|an hour and a half|half an hour|ساعتين|ساعتان|\btwo hours\b/iu,new RegExp(`${N}+(?:[.]${N}+)?\\s*(?:hours?\\b|hrs?\\b|h\\b|minutes?\\b|mins?\\b|m\\b|ساع(?:ة|ه|ات)|دقيق(?:ة|ه)|دقائق|دقايق)`,'iu'),/\b(?:an|one) hour\b|لمدة\s*ساعة|لمده\s*ساعه|(?:ل|مدتها\s*)ساعة(?!\s*[0-9٠-٩۰-۹])/iu],
  number_of_players:[new RegExp(`(?:(?:نحنا|نحن|احنا|إحنا|عددنا|عدد اللاعبين|we are|we're)\\s*${N}+|${N}+\\s*(?:people|players?|persons?|ppl|اشخاص|[اأ]شخاص|لاعب(?:ين|ون)?|شباب|أفراد|افراد))`,'iu'),/\b(?:two|three|four|five|six|eight|ten)\s+(?:people|players?)\b|(?:نحنا|نحن|احنا)\s*(?:اربعة|أربعة|اربع|اتنين|اثنين|ثلاثة|خمسة|عشرة)/iu]
};
function first(s:string,rs:RegExp[]):string|null{for(const r of rs){const m=s.match(r);if(m)return m[0];}return null;}
export const localExtractor:Extractor=async message=>{
  const raw=emptyRaw();raw.sport=first(message,SPORTS.map(([,r])=>r));raw.area=first(message,AREAS.map(([,r])=>r));
  for(const k of ['date','start_time','duration','number_of_players'] as const)raw[k]=first(message,patterns[k]);
  // A clock phrase such as الساعة 7 is not a one-hour duration.
  return {raw,source:'local'};
};
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
