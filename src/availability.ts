import type {Venue,Slot,Request,TimeRequest,Area} from './types.ts';
import {addDays,dayDistance,hhmm,localParts,MIN_DURATION_MINUTES} from './time.ts';
import {FITCIRCLE_COURTS} from './court-guide.ts';

function mockCourt(slug:string,sport:Exclude<Venue['sport'],'tennis'>,capacity:number,intervals:Venue['intervals']):Venue {
  const court=FITCIRCLE_COURTS.find(entry=>entry.slug===slug&&entry.sports.includes(sport));
  if(!court)throw new Error(`Missing FitCircle venue fixture reference: ${slug} (${sport})`);
  const id=sport==='padel'?slug:`${slug}-${sport}`;
  return {id,name:court.name,name_ar:court.name,area:court.area,sport,capacity,intervals};
}

// The catalog provides names and locations only. Every interval and capacity below is synthetic.
export const VENUES:Venue[]=[
  mockCourt('top-academy-courts','padel',4,[[540,720],[1080,1320]]),
  mockCourt('trio-padel-arena','padel',4,[[600,840],[1020,1200]]),
  mockCourt('g-m-padel','padel',4,[[600,840],[1020,1320]]),
  mockCourt('let-s-padel','padel',4,[[570,720],[840,1020]]),
  mockCourt('ace-padel','padel',4,[[600,720],[1050,1260]]),
  mockCourt('top-academy-courts','football',16,[[960,1080],[1140,1380]]),
  mockCourt('top-academy-courts','basketball',10,[[600,780],[1020,1260]])
];
// Synthetic neighborhood adjacency, not measured road distance.
const neighbors:Record<Exclude<Area,'any'>,Exclude<Area,'any'>[]>={mezzeh:['kafr_souseh','dummar','malki'],malki:['abu_rummaneh','mezzeh','baramkeh'],abu_rummaneh:['malki','baramkeh','mezzeh'],kafr_souseh:['mezzeh','baramkeh'],dummar:['mezzeh'],baramkeh:['abu_rummaneh','malki','kafr_souseh'],adawi:[],al_wahda:[]};
export function areaDistance(a:Area,b:Exclude<Area,'any'>):number{return a==='any'||a===b?0:neighbors[a].includes(b)?1:2;}
export function freeIntervals(venue:Venue,date:string):[number,number][] {
  // A fixed weekly pattern ensures reproducibility without an external DB.
  // Synthetic gaps on Tuesday evening for padel and Thursday evening for football.
  const weekday=new Date(`${date}T00:00:00Z`).getUTCDay();
  if(venue.id==='top-academy-courts'&&weekday===2)return venue.intervals.filter(([s])=>s<720);
  if(venue.id==='top-academy-courts-football'&&weekday===4)return [[960,1080],[1200,1380]];
  return venue.intervals.map(([s,e])=>[s,e]);
}
function nextStart(p:ReturnType<typeof localParts>,now:Date):number {
  return p.minute+(p.second>0||now.getMilliseconds()>0?1:0);
}
export function availabilitySnapshot(now:Date,venues=VENUES) {
  const p=localParts(now);const earliest=nextStart(p,now);
  return Array.from({length:7},(_,i)=>{const date=addDays(p.date,i);return {date,venues:venues.map(v=>({venue_id:v.id,venue:v.name,area:v.area,sport:v.sport,capacity:v.capacity,free:freeIntervals(v,date).map(([s,e])=>[i===0?Math.max(s,earliest):s,e]).filter(([s,e])=>s<e).map(([s,e])=>({start:hhmm(s),end:hhmm(e)}))}))};});
}

export function draftOpenings(request:Request,time:TimeRequest|null,now:Date) {
  const {sport,area,date,number_of_players:players}=request;
  const p=localParts(now);
  if(!date||date<p.date||date>addDays(p.date,6))return [];
  const duration=request.duration_minutes??MIN_DURATION_MINUTES;
  const firstFutureMinute=date===p.date?nextStart(p,now):0;
  const requestedStart=time?.kind==='window'?time.start:0;
  const requestedEnd=time?.kind==='window'?time.end:1440;

  return VENUES.filter(venue=>
    (!sport||venue.sport===sport) &&
    (!area||area==='any'||venue.area===area) &&
    (!players||venue.capacity>=players)
  ).flatMap(venue=>freeIntervals(venue,date).flatMap(([from,to])=>{
    const earliest=Math.max(from,firstFutureMinute,requestedStart);
    const start=time?.kind==='exact'?time.minute:earliest;
    const end=Math.min(to,requestedEnd);
    if(start<earliest||start+duration>end)return [];
    return [{sport:venue.sport,area:venue.area,start,end}];
  }));
}

function timeDistance(t:TimeRequest,start:number,duration:number):number {if(t.kind==='exact')return Math.abs(start-t.minute);return Math.max(0,t.start-start,start+duration-t.end);}

type Candidate = {venue:Venue; date:string; dayIndex:number; start:number; score:number};

function toSlot({venue,date,start}:Candidate,duration:number):Slot {
  return {
    venue_id:venue.id,venue:venue.name,venue_ar:venue.name_ar,area:venue.area,sport:venue.sport,
    date,start_time:hhmm(start),end_time:hhmm(start+duration),capacity:venue.capacity
  };
}

export function findSlots(request:Request,time:TimeRequest,now:Date,venues=VENUES):{match:Slot|null;alternatives:Slot[]} {
  const {sport,area,date,duration_minutes:duration,number_of_players:players}=request;
  if(!sport||!area||!date||!duration||!players)return {match:null,alternatives:[]};
  const local=localParts(now);
  const earliest=nextStart(local,now);
  const eligible=venues.filter(venue=>venue.sport===sport&&venue.capacity>=players)
    .map(venue=>({venue,areaPenalty:areaDistance(area,venue.area)*180}));
  const candidates:Candidate[]=[];

  for(let dayIndex=0;dayIndex<7;dayIndex++){
    const day=addDays(local.date,dayIndex);
    const dayPenalty=Math.abs(dayDistance(day,date))*1440;
    const firstFutureMinute=dayIndex===0?earliest:0;
    for(const {venue,areaPenalty} of eligible){
      const baseScore=dayPenalty+areaPenalty;
      for(const [opens,closes] of freeIntervals(venue,day)){
        const from=Math.max(opens,firstFutureMinute);
        const lastStart=closes-duration;
        for(let start=Math.ceil(from/30)*30;start<=lastStart;start+=30){
          candidates.push({venue,date:day,dayIndex,start,score:baseScore+timeDistance(time,start,duration)});
        }
        // A customer can still ask for an exact start between the suggested half-hour times.
        if(time.kind==='exact'&&day===date&&time.minute%30!==0&&time.minute>=from&&time.minute<=lastStart){
          candidates.push({venue,date:day,dayIndex,start:time.minute,score:baseScore});
        }
      }
    }
  }

  candidates.sort((a,b)=>a.score-b.score||a.dayIndex-b.dayIndex||a.start-b.start||a.venue.id.localeCompare(b.venue.id));
  if(candidates[0]?.score===0)return {match:toSlot(candidates[0],duration),alternatives:[]};

  // Avoid filling the three recommendations with nearly identical times at one venue.
  const selected:Candidate[]=[];
  for(const candidate of candidates){
    if(selected.length===3)break;
    if(!selected.some(other=>other.venue.id===candidate.venue.id&&other.dayIndex===candidate.dayIndex))selected.push(candidate);
  }
  for(const candidate of candidates){
    if(selected.length===3)break;
    if(!selected.includes(candidate))selected.push(candidate);
  }
  return {match:null,alternatives:selected.map(candidate=>toSlot(candidate,duration))};
}
