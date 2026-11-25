import {strictEqual} from 'node:assert';
import {findSlots} from '../src/availability.ts';
import type {Request,TimeRequest} from '../src/types.ts';
import {REFERENCE} from './cases.ts';

const now=new Date(REFERENCE);
const padel:Request={
  sport:'padel',area:'mezzeh',date:'2026-11-26',start_time:'19:00',
  duration_minutes:90,number_of_players:4,language:'en',time_window:null
};
const scenarios:{request:Request;time:TimeRequest}[]=[
  {request:padel,time:{kind:'exact',minute:19*60}},
  {
    request:{...padel,sport:'football',area:'malki',duration_minutes:60,number_of_players:10},
    time:{kind:'exact',minute:19*60}
  },
  {
    request:{...padel,area:'abu_rummaneh',date:'2026-11-27',start_time:'18:00',duration_minutes:60,language:'mixed'},
    time:{kind:'exact',minute:18*60}
  }
];

function run(rounds:number) {
  let matches=0;
  let alternatives=0;
  for(let i=0;i<rounds;i++){
    for(const {request,time} of scenarios){
      const result=findSlots(request,time,now);
      matches+=result.match?1:0;
      alternatives+=result.alternatives.length;
    }
  }
  strictEqual(matches,rounds);
  strictEqual(alternatives,rounds*6);
}

run(100);
const rounds=400;
const samples=Array.from({length:5},()=>{
  const started=performance.now();
  run(rounds);
  return performance.now()-started;
});
const median=samples.toSorted((a,b)=>a-b)[2];
console.log(`Node ${process.version}; ${rounds*scenarios.length} calls per sample; ${samples.length} samples`);
console.log(`Samples (ms): ${samples.map(value=>value.toFixed(1)).join(', ')}`);
console.log(`Median: ${median.toFixed(1)} ms`);
