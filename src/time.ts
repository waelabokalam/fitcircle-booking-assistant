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
  if(/day after tomorrow|بعد\s*بكرا|بعد\s*بكره|بعد غد/.test(t))return addDays(today,2);
  if(/\btomorrow\b|بكرا|بكره|بكرة|غدا/.test(t))return addDays(today,1);
  if(/\byesterday\b|امبارح|مبارح|البارحة|امس/.test(t))return addDays(today,-1);
  if(/\btoday\b|\btonight\b|اليوم|هالليلة|الليلة/.test(t))return today;
  const m=t.match(/(?:\bin\s+(\d+)\s+days?\b|بعد\s+(\d+)\s+(?:ايام|يوم))/); if(m){const n=Number(m[1]??m[2]);return n<=365?addDays(today,n):null;}
  const weekday=DAYS.findIndex(x=>x.test(t));
  if(weekday>=0){const current=new Date(`${today}T00:00:00Z`).getUTCDay();let offset=(weekday-current+7)%7;if(/\bnext\b|الجاي|القادم/.test(t)&&offset===0)offset=7;return addDays(today,offset);}
  return null;
}
export function resolveTime(raw:string|null):TimeRequest|null {
  if(!raw)return null;const t=normalizeText(raw);
  const pm=/(?:\bp\.?m\.?\b|المسا|مساء|مسا|عشية|بالليل|الليل)/.test(t);
  const am=/(?:\ba\.?m\.?\b|الصبح|صباح|صبح)/.test(t);
  const m=t.match(/(?:^|[^\d])(\d{1,2})(?::(\d{2}))?(?![\d:])/);
  if(m){let h=Number(m[1]);const min=Number(m[2]??0);if(h>23||min>59||pm&&am)return null;
    if(pm||am){if(h<1||h>12)return null;h=h%12+(pm?12:0);}
    else if(h>=1&&h<=12&&!(m[1].length===2&&m[1][0]==='0')&&!(m[2]!==undefined&&m[1].length===2))return null;
    return {kind:'exact',minute:h*60+min};}
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
  else {const m=t.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h\b|ساع(?:ة|ه|ات)|minutes?|mins?|m\b|دقيق(?:ة|ه)|دقائق|دقايق)/);if(m)v=Number(m[1])*(/^(h|ساع)/.test(m[2])?60:1);else if(/an hour|one hour|لمدة ساعة|لمده ساعه|ساعة|ساعه/.test(t))v=60;}
  return v!==null&&Number.isInteger(v)&&v>=15&&v<=240?v:null;
}
export function resolvePlayers(raw:string|null):number|null {
  if(!raw)return null;const t=normalizeText(raw);const n=t.match(/\d+/);const words:Record<string,number>={'two':2,'three':3,'four':4,'five':5,'six':6,'eight':8,'ten':10,'اربعة':4,'اربع':4,'اتنين':2,'اثنين':2,'ثلاثة':3,'خمسة':5,'عشرة':10};
  const value=n?Number(n[0]):Object.entries(words).find(([k])=>t.includes(k))?.[1];return value!==undefined&&Number.isInteger(value)&&value>=1&&value<=100?value:null;
}
