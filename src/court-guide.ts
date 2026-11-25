import type {Area,CourtLink,Field,Request,Sport,Status} from './types.ts';

const origin='https://www.fitcircleapp.com';
const sports={padel:['Padel','بادل'],football:['Football','كرة قدم'],basketball:['Basketball','باسكت']} as const;
type DirectorySport=keyof typeof sports;
const neighborhoods={
  mezzeh:['Mezzeh','المزة'],dummar:['Dummar','دمر'],adawi:['Adawi','العدوي'],al_wahda:['Al Wahda Sports Club','نادي الوحدة']
} as const;
type Court={
  name:string;
  slug:string;
  sports:readonly DirectorySport[];
  area:keyof typeof neighborhoods;
  location:readonly [string,string];
};
// Public links from FitCircle's sport directories. Availability is read on the linked pages.
export const FITCIRCLE_COURTS:readonly Court[]=[
  {name:'Top Academy Courts',slug:'top-academy-courts',sports:['padel','football','basketball'],area:'mezzeh',location:['Madinat Al Shabab, Mezzeh','مدينة الشباب، المزة']},
  {name:'Trio Padel Arena',slug:'trio-padel-arena',sports:['padel'],area:'dummar',location:['Mashrou Dummar, Uptown Parking','مشروع دمر، موقف أبتاون']},
  {name:'G.M Padel',slug:'g-m-padel',sports:['padel'],area:'adawi',location:['Adawi, Military Sports Union','العدوي، الاتحاد الرياضي العسكري']},
  {name:"Let's Padel",slug:'let-s-padel',sports:['padel'],area:'adawi',location:['Adawi Highway','أوتوستراد العدوي']},
  {name:'Ace Padel',slug:'ace-padel',sports:['padel'],area:'al_wahda',location:['Al Wahda Sports Club','نادي الوحدة الرياضي']}
];

type Guide={status:Status;reply:string;field:Field|null;links:CourtLink[];suggestions?:string[]};

function supported(sport:Sport|null):sport is DirectorySport {
  return sport!==null&&Object.hasOwn(sports,sport);
}

function linksFor(sport:DirectorySport,area:Area|null,date:string|null,ar:boolean):CourtLink[] {
  return FITCIRCLE_COURTS.filter(court=>court.sports.includes(sport)&&(!area||area==='any'||court.area===area)).map(court=>{
    const url=new URL(`/padel/${court.slug}`,origin);
    if(date)url.searchParams.set('date',date);
    if(sport!=='padel')url.searchParams.set('sport',sport);
    return {name:court.name,location:court.location[ar?1:0],url:url.href};
  });
}

export function guideCourts(request:Request,today:string,ambiguous:Field[],ar:boolean):Guide {
  const {sport,area,date}=request;
  const language=ar?1:0;
  if(!supported(sport)){
    const suggestions=Object.values(sports).map(labels=>labels[language]);
    const links=[{name:ar?'دليل ملاعب FitCircle':'FitCircle court directory',url:`${origin}/courts`}];
    const question=ar?'شو الرياضة اللي بتحب تلعبها؟':'Which sport would you like to play?';
    const reply=sport===null?question:ar
      ? `دليل FitCircle فيه ملاعب بادل وكرة قدم وباسكت. ${question}`
      : `FitCircle’s court directory lists padel, football, and basketball. ${question}`;
    return {status:'NEEDS_INFO',reply,field:'sport',links,suggestions};
  }

  const past=date!==null&&date<today;
  const selectedDate=past?null:date;
  const venueLinks=linksFor(sport,area,selectedDate,ar);
  const directory={
    name:ar?`دليل ملاعب ${sports[sport][language]} على FitCircle`:`All FitCircle ${sports[sport][language].toLowerCase()} courts`,
    url:`${origin}/courts/${sport}`
  };
  const links=[...venueLinks,directory];
  if(!selectedDate){
    const question=ar?'لأي يوم بدك تشوف المواعيد؟':'Which day would you like to check?';
    const reply=past?(ar?`اختار اليوم أو يوم بعده. ${question}`:`Choose today or a later date. ${question}`):question;
    return {status:past?'OUT_OF_RANGE':'NEEDS_INFO',reply,field:'date',links};
  }

  if(!venueLinks.length){
    const reply=ar?'افتح دليل FitCircle لتشوف الملاعب والمواعيد المتاحة.':'Open the FitCircle directory to find courts and check live times.';
    return {status:'COURTS',reply,field:null,links};
  }

  const choices=(!area||area==='any')?FITCIRCLE_COURTS.filter(court=>court.sports.includes(sport)).map(court=>
    neighborhoods[court.area][language]):[];
  const unique=[...new Set(choices)];
  const suggestions=unique.length>1?unique:undefined;
  if(ambiguous.includes('area')){
    const reply=ar?'بأي منطقة بتحب تلعب؟':'Which area would you like to play in?';
    return {status:'NEEDS_INFO',reply,field:'area',links,suggestions};
  }

  const reply=ar?`افتح صفحة الملعب على FitCircle لتشوف مواعيد ${selectedDate}.`:
    `Open a court on FitCircle to check live times for ${selectedDate}.`;
  const filterHint=ar?' فيك كمان تختار منطقة.':' You can also choose a neighborhood to narrow the list.';
  return {status:'COURTS',reply:suggestions?reply+filterHint:reply,field:null,links,suggestions};
}
