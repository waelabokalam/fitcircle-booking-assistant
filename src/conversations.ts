import {randomUUID} from 'node:crypto';
import {bookingTurn} from './service.ts';
import type {BookingDraft} from './service.ts';
import type {ConversationMode,Extractor} from './types.ts';

const IDLE_MS=30*60*1000;
const MAX_SESSIONS=1000;
type Session={draft?:BookingDraft; touchedAt:number; busy:boolean};

export function createConversations(extractor:Extractor,clock:()=>Date,mode:ConversationMode) {
  const sessions=new Map<string,Session>();

  return async (id:string|undefined,message:string|undefined,reset:boolean)=>{
    const now=clock();
    for(const [key,session] of sessions){
      if(!session.busy && now.getTime()-session.touchedAt>=IDLE_MS)sessions.delete(key);
    }
    let session=id===undefined?undefined:sessions.get(id);
    // A slow provider must not overwrite a later turn or a reset.
    if(session?.busy)return {code:409,body:{error:'A message is already being processed for this session'}};
    if(reset && session && id!==undefined){
      sessions.delete(id);
      session=undefined;
    }
    if(!session){
      if(sessions.size>=MAX_SESSIONS)return {code:503,body:{error:'Too many active conversations. Please try again later.'}};
      id=randomUUID();
      session={touchedAt:now.getTime(),busy:false};
      sessions.set(id,session);
    }

    if(message===undefined)return {code:200,body:{session_id:id}};
    session.busy=true;
    try{
      const {result,draft}=await bookingTurn(message,extractor,now,session.draft,mode);
      session.draft=draft;
      session.touchedAt=clock().getTime();
      return {code:200,body:{...result,session_id:id}};
    }finally{
      session.busy=false;
    }
  };
}
