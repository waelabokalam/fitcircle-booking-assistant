import type {TimeRequest} from './types.ts';
export const ZONE = 'Asia/Damascus';
const formatter = new Intl.DateTimeFormat('en-GB',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export function localParts(now:Date) {
  const p = Object.fromEntries(formatter.formatToParts(now).map(x=>[x.type,x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`, minute:Number(p.hour)*60+Number(p.minute), second:Number(p.second)};
}
export function addDays(date:string,n:number):string {
  const d=new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10);
}
export function dayDistance(a:string,b:string):number {return (Date.parse(`${a}T00:00:00Z`)-Date.parse(`${b}T00:00:00Z`))/86400000;}
export function hhmm(m:number):string {return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;}
export function digits(s:string):string {return s.replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c.charCodeAt(0)>=1776?1776:1632)));}
export function normalizeText(s:string):string {return digits(s).normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').trim();}
const DAYS = [ /\bsunday\b|الاحد/, /\bmonday\b|الاثنين|الاثنين/, /\btuesday\b|الثلاثاء|التلاتا/, /\bwednesday\b|الاربعاء/, /\bthursday\b|الخميس/, /\bfriday\b|الجمعة|الجمعه/, /\bsaturday\b|السبت/ ];
export function resolveDate(raw:string|null,now:Date):string|null {
  if(!raw) return null;
  const t=normalizeText(raw), today=localParts(now).date;
  if(/^\d{4}-\d{2}-\d{2}$/.test(t)){const d=new Date(`${t}T00:00:00Z`);return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===t?t:null;}
  if(/day after (?:tomorrow|tmw|tmr|2moro)|بعد\s*(?:بكرا|بكره|بكرة|غد)/.test(t))return addDays(today,2);
  if(/\b(?:tomorrow|tmw|tmr|2moro)\b|بكرا|بكره|بكرة|غد/.test(t))return addDays(today,1);
  if(/\byesterday\b|امبارح|مبارح|البارحة|امس/.test(t))return addDays(today,-1);
  if(/\btoday\b|\btonight\b|اليوم|هالليلة|الليلة/.test(t))return today;
  const m=t.match(/(?:\bin\s+(\d+)\s+days?\b|بعد\s+(\d+)\s+(?:ايام|يوم))/); if(m){const n=Number(m[1]??m[2]);return n<=365?addDays(today,n):null;}
  const weekday=DAYS.findIndex(x=>x.test(t));
  if(weekday>=0){const current=new Date(`${today}T00:00:00Z`).getUTCDay();let offset=(weekday-current+7)%7;if(/\bnext\b|الجاي|القادم/.test(t)&&offset===0)offset=7;return addDays(today,offset);}
  return null;
}
const AM = /\ba\.?m\.?\b|in the morning|الصبح|صباح|صبح/;
const PM = /\bp\.?m\.?\b|in the evening|tonight|المسا|مساء|مسا|عشية|بالليل|الليل/;
function clockReading(text:string) {
  // An ISO date is not a clock reading, even when a model quotes a whole clause.
  const m=text.replace(/\b\d{4}-\d{2}-\d{2}\b/g,'').match(/(?:^|[^\d:])(\d{1,2})(?::(\d{2}))?(?![\d:])/);
  if(!m)return null;
  const hour=Number(m[1]), minute=Number(m[2]??0);
  return {hour,minute,uses24HourForm:m[1].startsWith('0')||m[1].length===2&&m[2]!==undefined};
}
export function ambiguousClock(raw:string|null):{hour:number;minute:number}|null {
  if(!raw)return null;
  const t=normalizeText(raw), reading=clockReading(t);
  if(!reading||reading.hour<1||reading.hour>12||reading.minute>59||reading.uses24HourForm||AM.test(t)||PM.test(t))return null;
  return {hour:reading.hour,minute:reading.minute};
}
export function timePeriod(raw:string):'am'|'pm'|null {
  const t=normalizeText(raw).replace(/[.!?؟]+$/,'');
  if(/^(?:a\.?m|الصبح|صباحا?|صبح|بالصبح)$/.test(t))return 'am';
  if(/^(?:p\.?m|المسا|مساء|مسا|بالليل|الليل|بالمسا)$/.test(t))return 'pm';
  return null;
}
export function resolveTime(raw:string|null):TimeRequest|null {
  if(!raw)return null;const t=normalizeText(raw);
  const pm=PM.test(t), am=AM.test(t), reading=clockReading(t);
  if(pm&&am)return null;
  if(reading){
    const {hour,minute}=reading;
    if(hour>23||minute>59)return null;
    if(pm||am){
      if(hour<1||hour>12)return null;
      return {kind:'exact',minute:(hour%12+(pm?12:0))*60+minute};
    }
    if(ambiguousClock(t))return null;
    return {kind:'exact',minute:hour*60+minute};
  }
  if(/evening|tonight|المسا|مساء|بالليل|الليل/.test(t))return {kind:'window',start:17*60,end:23*60};
  if(/morning|الصبح|صباح/.test(t))return {kind:'window',start:8*60,end:12*60};
  if(/afternoon|بعد الظهر|العصر/.test(t))return {kind:'window',start:12*60,end:17*60};
  if(/any time|anytime|اي وقت/.test(t))return {kind:'window',start:0,end:1440};
  if(/\bnoon\b|الظهر/.test(t))return {kind:'exact',minute:720};
  return null;
}
export function resolveDuration(raw:string|null):number|null {
  if(!raw)return null;const t=normalizeText(raw);let v:number|null=null;
  if(/ساعة ونص|ساعه ونص|ساعة ونصف|an hour and a half/.test(t))v=90;
  else if(/نص ساعة|نصف ساعة|half an hour/.test(t))v=30;
  else if(/ساعتين|ساعتان|two hours/.test(t))v=120;
  else {const m=t.match(/(-?\d+(?:\.\d+)?)\s*(hours?|hrs?|h\b|ساع(?:ة|ه|ات)|minutes?|mins?|m\b|دقيق(?:ة|ه)|دقائق|دقايق)/);if(m)v=Number(m[1])*(/^(h|ساع)/.test(m[2])?60:1);else if(/an hour|one hour|لمدة ساعة|لمده ساعه|ساعة|ساعه/.test(t))v=60;}
  return v!==null&&Number.isInteger(v)&&v>=15&&v<=240?v:null;
}
export function resolvePlayers(raw:string|null):number|null {
  if(!raw)return null;
  const t=normalizeText(raw), n=t.match(/-?\d+(?:\.\d+)?/);
  const words:Record<string,number>={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,واحد:1,اتنين:2,اثنين:2,تنين:2,ثلاثة:3,تلاتة:3,اربعة:4,اربع:4,خمسة:5,ستة:6,سبعة:7,ثمانية:8,تمانية:8,تسعة:9,عشرة:10};
  const word=t.split(/[^\p{L}]+/u).find(token=>Object.hasOwn(words,token));
  const value=n?Number(n[0]):word===undefined?undefined:words[word];
  return value!==undefined&&Number.isInteger(value)&&value>=1&&value<=100?value:null;
}
