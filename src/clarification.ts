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
  baramkeh:['البرامكة','Baramkeh'],
  adawi:['العدوي','Adawi']
};
const englishList=new Intl.ListFormat('en');
const arabicList=new Intl.ListFormat('ar');

export function availabilityGuidance(field:Field,request:Request,time:TimeRequest|null,now:Date,ar:boolean):{hint:string;suggestions:string[]}|null {
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
    const suggestions=[...starts.keys()].map(name=>{
      const label=sports[name][language];
      return ar?label:label[0].toUpperCase()+label.slice(1);
    });
    const hint=ar?`من المواعيد التجريبية المتاحة ${when}: ${examples}.`:`Mock openings ${when} include ${examples}.`;
    return {hint,suggestions};
  }

  if(field==='area' && sport){
    const suggestions=[...new Set(openings.map(opening=>areas[opening.area][language]))];
    const names=list.format(suggestions);
    const label=sports[sport][language];
    const hint=ar?`في مواعيد تجريبية للعب ${label} ${when} بـ${names}.`:`For ${label}, there are mock openings ${when} in ${names}.`;
    return {hint,suggestions};
  }

  if(field==='start_time'){
    const location=area && area!=='any'?areas[area][language]:null;
    const windows=new Map(openings.map(opening=>{
      const start=hhmm(opening.start);
      const hours=`${start}–${hhmm(opening.end)}`;
      const label=location?hours:`${areas[opening.area][language]} ${hours}`;
      return [label,start] as const;
    }));
    const shown=[...windows].slice(0,4);
    const examples=list.format(shown.map(([label])=>label));
    const suggestions=[...new Set(shown.map(([,start])=>start))].sort();
    const hint=ar
      ? `المواعيد التجريبية ${when}${location?` بـ${location}`:''}: ${examples}.`
      : `Mock openings ${when}${location?` in ${location}`:''} include ${examples}.`;
    return {hint,suggestions};
  }
  return null;
}
