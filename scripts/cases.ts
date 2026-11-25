import type {Status,Field,Request} from '../src/types.ts';
export const REFERENCE='2026-11-25T12:00:00.000Z'; // 15:00 in Damascus
export type Case={id:string;message:string;expected:Status;field:Field|null;fields:Partial<Request>;venue?:string;start?:string};
export const CASES:Case[]=[
 {id:'01',message:'بدي احجز ملعب بادل بكرا الساعة 7 المسا بالمزة، نحنا 4',expected:'NEEDS_INFO',field:'duration',fields:{sport:'padel',area:'mezzeh',date:'2026-11-26',start_time:'19:00',duration_minutes:null,number_of_players:4,language:'ar'}},
 {id:'02',message:'Any football pitch free Friday evening near Malki for 10 people?',expected:'NEEDS_INFO',field:'duration',fields:{sport:'football',area:'malki',date:'2026-11-27',start_time:null,time_window:{start:'17:00',end:'23:00'},duration_minutes:null,number_of_players:10,language:'en'}},
 {id:'03',message:'في شي ملعب فاضي اليوم؟',expected:'NEEDS_INFO',field:'sport',fields:{sport:null,area:null,date:'2026-11-25',start_time:null,duration_minutes:null,number_of_players:null,language:'ar'}},
 {id:'04',message:'Book padel tomorrow at 7 pm in Mezzeh for 90 minutes, 4 players.',expected:'MATCH',field:null,fields:{sport:'padel',area:'mezzeh',date:'2026-11-26',start_time:'19:00',duration_minutes:90,number_of_players:4,language:'en'},venue:'top-academy-courts',start:'19:00'},
 {id:'05',message:'Football in Malki tomorrow at 7 pm for 60 minutes, 10 players.',expected:'ALTERNATIVES',field:null,fields:{sport:'football',area:'malki',date:'2026-11-26',start_time:'19:00',duration_minutes:60,number_of_players:10,language:'en'}},
 {id:'06',message:'بدي padel بأبو رمانة بعد بكرا الساعة ٦ المسا لمدة ساعة، نحنا ٤',expected:'ALTERNATIVES',field:null,fields:{sport:'padel',area:'abu_rummaneh',date:'2026-11-27',start_time:'18:00',duration_minutes:60,number_of_players:4,language:'mixed'}},
 {id:'07',message:'بدي تنس بدمر مبارح الساعة ١٠ الصبح لمدة ساعة، نحنا ٢',expected:'OUT_OF_RANGE',field:'date',fields:{sport:'tennis',area:'dummar',date:'2026-11-24',start_time:'10:00',duration_minutes:60,number_of_players:2,language:'ar'}},
 {id:'08',message:'Basketball in Baramkeh tomorrow at 6 pm for 60 minutes, 14 players.',expected:'NO_AVAILABILITY',field:null,fields:{sport:'basketball',area:'baramkeh',date:'2026-11-26',start_time:'18:00',duration_minutes:60,number_of_players:14,language:'en'}},
 {id:'09',message:'بدي بادل بكرا بالمزة الساعة ٧ لمدة ساعة، نحنا ٤',expected:'NEEDS_INFO',field:'start_time',fields:{sport:'padel',area:'mezzeh',date:'2026-11-26',start_time:null,duration_minutes:60,number_of_players:4,language:'ar'}},
 {id:'10',message:'Tennis in Dummar in 9 days at 10 am for an hour, 2 players.',expected:'OUT_OF_RANGE',field:'date',fields:{sport:'tennis',area:'dummar',date:'2026-12-04',start_time:'10:00',duration_minutes:60,number_of_players:2,language:'en'}}
];
