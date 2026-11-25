import type {Venue,Slot,Request,TimeRequest,Area} from './types.ts';
import {addDays,dayDistance,hhmm,localParts} from './time.ts';
export const VENUES:Venue[]=[
  {id:'mz-padel',name:'Mezzeh Padel Club',name_ar:'نادي المزة للبادل',area:'mezzeh',sport:'padel',capacity:4,intervals:[[540,720],[1080,1320]]},
  {id:'mk-football',name:'Malki Football Arena',name_ar:'ملعب المالكي لكرة القدم',area:'malki',sport:'football',capacity:12,intervals:[[960,1080],[1140,1380]]},
  {id:'ar-padel',name:'Abu Rummaneh Padel',name_ar:'بادل أبو رمانة',area:'abu_rummaneh',sport:'padel',capacity:4,intervals:[[600,840],[1020,1200]]},
  {id:'ks-football',name:'Kafr Souseh Sports Field',name_ar:'ملعب كفرسوسة الرياضي',area:'kafr_souseh',sport:'football',capacity:16,intervals:[[540,780],[1020,1320]]},
  {id:'dm-tennis',name:'Dummar Tennis Center',name_ar:'مركز دمر للتنس',area:'dummar',sport:'tennis',capacity:4,intervals:[[480,720],[900,1200]]},
  {id:'bk-basketball',name:'Baramkeh Basketball Court',name_ar:'ملعب البرامكة لكرة السلة',area:'baramkeh',sport:'basketball',capacity:10,intervals:[[600,780],[1020,1260]]}
];
// Synthetic neighborhood adjacency, not measured road distance.
const neighbors:Record<Exclude<Area,'any'>,Exclude<Area,'any'>[]>={mezzeh:['kafr_souseh','dummar','malki'],malki:['abu_rummaneh','mezzeh','baramkeh'],abu_rummaneh:['malki','baramkeh','mezzeh'],kafr_souseh:['mezzeh','baramkeh'],dummar:['mezzeh'],baramkeh:['abu_rummaneh','malki','kafr_souseh']};
export function areaDistance(a:Area,b:Exclude<Area,'any'>):number{return a==='any'||a===b?0:neighbors[a].includes(b)?1:2;}
export function freeIntervals(venue:Venue,date:string):[number,number][] {
  // A fixed weekly pattern ensures reproducibility without an external DB.
  // Tuesday evening maintenance at Mezzeh, Thursday football gap in Malki.
  const weekday=new Date(`${date}T00:00:00Z`).getUTCDay();
  if(venue.id==='mz-padel'&&weekday===2)return venue.intervals.filter(([s])=>s<720);
  if(venue.id==='mk-football'&&weekday===4)return [[960,1080],[1200,1380]];
  return venue.intervals.map(([s,e])=>[s,e]);
}
export function availabilitySnapshot(now:Date,venues=VENUES) {
  const p=localParts(now);const earliest=p.minute+(p.second>0||now.getMilliseconds()>0?1:0);
  return Array.from({length:7},(_,i)=>{const date=addDays(p.date,i);return {date,venues:venues.map(v=>({venue_id:v.id,venue:v.name,area:v.area,sport:v.sport,capacity:v.capacity,free:freeIntervals(v,date).map(([s,e])=>[i===0?Math.max(s,earliest):s,e]).filter(([s,e])=>s<e).map(([s,e])=>({start:hhmm(s),end:hhmm(e)}))}))};});
}
function isFuture(date:string,start:number,now:Date){const p=localParts(now);return date>p.date||date===p.date&&(start>p.minute||start===p.minute&&p.second===0&&now.getMilliseconds()===0);}
function timeDistance(t:TimeRequest,start:number,duration:number):number {if(t.kind==='exact')return Math.abs(start-t.minute);return Math.max(0,t.start-start,start+duration-t.end);}
export function findSlots(request:Request,time:TimeRequest,now:Date,venues=VENUES):{match:Slot|null;alternatives:Slot[]} {
  const {sport,area,date,duration_minutes:duration,number_of_players:players}=request;
  if(!sport||!area||!date||!duration||!players)return {match:null,alternatives:[]};
  const today=localParts(now).date;const candidates:{slot:Slot;score:number;exact:boolean;start:number}[]=[];
  for(let i=0;i<7;i++){
    const day=addDays(today,i);for(const v of venues){if(v.sport!==sport||v.capacity<players)continue;
      for(const [from,to] of freeIntervals(v,day)){
        // Include an off-grid requested start if it fits the whole interval.
        const starts=new Set<number>();for(let m=Math.ceil(from/30)*30;m+duration<=to;m+=30)starts.add(m);
        if(time.kind==='exact'&&day===date&&time.minute>=from&&time.minute+duration<=to)starts.add(time.minute);
        for(const start of starts){if(!isFuture(day,start,now))continue;const a=areaDistance(area,v.area);const d=Math.abs(dayDistance(day,date));const t=timeDistance(time,start,duration);
          candidates.push({slot:{venue_id:v.id,venue:v.name,venue_ar:v.name_ar,area:v.area,sport:v.sport,date:day,start_time:hhmm(start),end_time:hhmm(start+duration),capacity:v.capacity},score:d*1440+a*180+t,exact:d===0&&a===0&&t===0,start});}
      }
    }
  }
  candidates.sort((a,b)=>a.score-b.score||a.slot.date.localeCompare(b.slot.date)||a.start-b.start||a.slot.venue_id.localeCompare(b.slot.venue_id));
  const exact=candidates.find(x=>x.exact);if(exact)return {match:exact.slot,alternatives:[]};
  // Avoid filling the three recommendations with nearly identical times at one venue.
  const selected:typeof candidates=[];
  for(const c of candidates){if(selected.length===3)break;if(!selected.some(x=>x.slot.venue_id===c.slot.venue_id&&x.slot.date===c.slot.date))selected.push(c);}
  for(const c of candidates){if(selected.length===3)break;if(!selected.includes(c))selected.push(c);}
  return {match:null,alternatives:selected.map(x=>x.slot)};
}
