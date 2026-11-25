import {draftOpenings} from './availability.ts';
import {addDays,hhmm,localParts} from './time.ts';
import type {Area,Field,Request,Sport,TimeRequest} from './types.ts';

const sports:Record<Sport,[string,string]>={
  padel:['بادل','padel'],
  football:['كرة قدم','football'],
  basketball:['باسكت','basketball'],
  tennis:['تنس','tennis']
};
const areas:Record<Exclude<Area,'any'>,[string,string]>={
  mezzeh:['المزة','Mezzeh'],
  malki:['المالكي','Malki'],
  abu_rummaneh:['أبو رمانة','Abu Rummaneh'],
  kafr_souseh:['كفر سوسة','Kafr Souseh'],
  dummar:['دمر','Dummar'],
  baramkeh:['البرامكة','Baramkeh']
};
const englishList=new Intl.ListFormat('en');
const arabicList=new Intl.ListFormat('ar');

export function availabilityHint(field:Field,request:Request,time:TimeRequest|null,now:Date,ar:boolean):string|null {
  const {date,sport,area}=request;
  if(!date||!['sport','area','start_time'].includes(field))return null;
  const openings=draftOpenings(request,time,now);
  if(!openings.length)return null;

  const language=ar?0:1;
  const list=ar?arabicList:englishList;
  const today=localParts(now).date;
  const when=date===today?(ar?'اليوم':'today'):
    date===addDays(today,1)?(ar?'بكرا':'tomorrow'):(ar?`بيوم ${date}`:`on ${date}`);

  if(field==='sport'){
    const starts=new Map<Sport,number>();
    for(const opening of openings){
      starts.set(opening.sport,Math.min(starts.get(opening.sport)??opening.start,opening.start));
    }
    const examples=list.format([...starts].map(([name,start])=>
      ar?`${sports[name][language]} الساعة ${hhmm(start)}`:`${sports[name][language]} at ${hhmm(start)}`));
    return ar?`من المواعيد التجريبية المتاحة ${when}: ${examples}.`:`Mock openings ${when} include ${examples}.`;
  }

  if(field==='area' && sport){
    const names=list.format([...new Set(openings.map(opening=>areas[opening.area][language]))]);
    const label=sports[sport][language];
    return ar?`في مواعيد تجريبية للعب ${label} ${when} بـ${names}.`:`For ${label}, there are mock openings ${when} in ${names}.`;
  }

  if(field==='start_time'){
    const location=area && area!=='any'?areas[area][language]:null;
    const windows=openings.map(opening=>{
      const hours=`${hhmm(opening.start)}–${hhmm(opening.end)}`;
      return location?hours:`${areas[opening.area][language]} ${hours}`;
    });
    const examples=list.format([...new Set(windows)].slice(0,4));
    return ar
      ? `المواعيد التجريبية ${when}${location?` بـ${location}`:''}: ${examples}.`
      : `Mock openings ${when}${location?` in ${location}`:''} include ${examples}.`;
  }
  return null;
}
