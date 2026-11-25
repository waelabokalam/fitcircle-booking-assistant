const $=id=>document.getElementById(id);
const copy={
  en:{
    pageTitle:'FitCircle — Court guide',
    courtGuide:'Court guide',
    environment:'COURTS · DAMASCUS',
    heading:'Find a court in Damascus.',
    intro:'Tell the chat what you want to play, then open a court on FitCircle to see its live times.',
    workspace:'Booking workspace',
    assistant:'FitCircle assistant',
    reset:'New booking',
    welcome:'Hi! Tell me what you’d like to play in Arabic or English.',
    message:'Customer message',
    placeholder:'e.g. Padel in Mezzeh tomorrow',
    send:'Send',
    inspector:'Decision inspector',
    inspectorCaption:'Interpreted request and evidence',
    waiting:'Waiting for a request',
    waitingCaption:'Send a message to see how it was interpreted.',
    examples:'Example requests',
    examplesCaption:'Click to fill the message.',
    footer:'Live times and booking on',
    clarification:'Clarification field',
    field_sport:'Sport',
    field_area:'Area',
    field_date:'Date',
    field_start_time:'Start time',
    field_duration:'Duration',
    field_number_of_players:'Number of players',
    request:'Normalized request',
    extraction:'Extraction: {value}',
    checks:'Decision checks · {value}',
    evidence:'Raw evidence',
    status_READY:'READY',
    status_CHECKING:'CHECKING',
    status_ERROR:'ERROR',
    status_COURTS:'COURTS',
    status_NEEDS_INFO:'NEEDS INFO',
    status_OUT_OF_RANGE:'OUT OF RANGE',
    status_MATCH:'MATCH',
    status_ALTERNATIVES:'ALTERNATIVES',
    status_NO_AVAILABILITY:'NO AVAILABILITY',
    status_EXTRACTION_ERROR:'EXTRACTION ERROR',
    sendError:'Could not complete the request. Please try again.',
    resetError:'Could not start a new booking. Please try again.',
    noDecision:'No decision was produced.'
  },
  ar:{
    pageTitle:'FitCircle — دليل الملاعب',
    courtGuide:'دليل الملاعب',
    environment:'ملاعب · دمشق',
    heading:'لقّي ملعب بدمشق.',
    intro:'قلّي شو بتحب تلعب، وافتح صفحة الملعب على FitCircle لتشوف المواعيد المتاحة.',
    workspace:'واجهة الحجز',
    assistant:'مساعد FitCircle',
    reset:'حجز جديد',
    welcome:'أهلا! قلّي شو بتحب تلعب ووين.',
    message:'رسالتك',
    placeholder:'مثلاً: بدي ألعب بادل بكرا بالمزة',
    send:'إرسال',
    inspector:'تفاصيل الطلب',
    inspectorCaption:'المعلومات اللي فهمها المساعد من رسالتك',
    waiting:'بانتظار رسالتك',
    waitingCaption:'ابعت رسالة لتشوف كيف فهم المساعد طلبك.',
    examples:'أمثلة للطلبات',
    examplesCaption:'اضغط على مثال لتعبئة الرسالة.',
    footer:'المواعيد المتاحة والحجز على',
    clarification:'المعلومة المطلوبة',
    field_sport:'الرياضة',
    field_area:'المنطقة',
    field_date:'التاريخ',
    field_start_time:'وقت البداية',
    field_duration:'المدة',
    field_number_of_players:'عدد اللاعبين',
    request:'الطلب بعد التفسير',
    extraction:'الاستخراج · {value}',
    checks:'خطوات التحقق · {value}',
    evidence:'النص المستخرج',
    status_READY:'جاهز',
    status_CHECKING:'عم راجع طلبك',
    status_ERROR:'صار خطأ',
    status_COURTS:'ملاعب',
    status_NEEDS_INFO:'بحاجة لتفاصيل',
    status_OUT_OF_RANGE:'التاريخ غير مناسب',
    status_MATCH:'موعد مطابق',
    status_ALTERNATIVES:'خيارات بديلة',
    status_NO_AVAILABILITY:'لا توجد مواعيد',
    status_EXTRACTION_ERROR:'تعذّر فهم الطلب',
    sendError:'ما قدرت كمّل الطلب. فيك تجرّب مرة تانية؟',
    resetError:'ما قدرت بلّش حجز جديد. فيك تجرّب مرة تانية؟',
    noDecision:'ما قدرنا نعرض نتيجة للطلب.',
    'Extraction evidence validated':'تم التحقق من النص المستخرج',
    'Extraction unavailable or invalid':'تعذّر التحقق من الاستخراج',
    'Used bounded local recognition':'تم تفسير الرسالة محلياً',
    'Prepared official FitCircle court links':'تم تجهيز روابط الملاعب الرسمية'
  }
};
const examples={
  en:[
    ['Padel · Mezzeh','Padel in Mezzeh tomorrow'],
    ['Padel · Dummar','Show padel courts in Dummar on Friday'],
    ['Football','Where can I play football tomorrow?'],
    ['Arabic · Basketball','بدي ألعب باسكت بكرا بالمزة']
  ],
  ar:[
    ['بادل · المزة','بدي ألعب بادل بكرا بالمزة'],
    ['بادل · دمر','فرجيني ملاعب بادل بدمر يوم الجمعة'],
    ['كرة قدم','وين فيني ألعب كرة قدم بكرا؟'],
    ['باسكت · المزة','بدي ألعب باسكت بكرا بالمزة']
  ]
};
let locale='en';
const containsArabic=text=>/[\u0621-\u064a]/.test(text);
function t(key,value){
  const template=copy[locale][key]??key;
  return value===undefined?template:template.replace('{value}',value);
}
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
function setCopy(node,key,value){
  node.dataset.i18n=key;
  if(value===undefined)delete node.dataset.i18nValue;
  else node.dataset.i18nValue=value;
  node.textContent=t(key,value);
}
function localized(tag,cls,key,value){
  const node=el(tag,cls);
  setCopy(node,key,value);
  return node;
}
function translatePage(){
  for(const node of document.querySelectorAll('[data-i18n]')){
    node.textContent=t(node.dataset.i18n,node.dataset.i18nValue);
  }
  for(const node of document.querySelectorAll('[data-i18n-aria]')){
    node.setAttribute('aria-label',t(node.dataset.i18nAria));
  }
  const composer=$('message');
  composer.placeholder=t(composer.dataset.i18nPlaceholder);
}
function setLocale(next){
  if(next===locale)return;
  locale=next;
  document.documentElement.lang=next;
  document.documentElement.dir=next==='ar'?'rtl':'ltr';
  translatePage();
  renderExamples();
}
function count(){$('counter').textContent=`${$('message').value.length} / 2000`;}
function composerChanged(){
  const value=$('message').value;
  if(containsArabic(value))setLocale('ar');
  else if(/[a-z]/i.test(value))setLocale('en');
  count();
}
function renderExamples(){
  const container=$('examples');
  container.replaceChildren();
  for(const [label,message] of examples[locale]){
    const button=el('button','example');
    button.type='button';
    const text=el('span','',message);
    text.dir='auto';
    text.lang=containsArabic(message)?'ar':'en';
    button.append(el('strong','',label),text);
    button.addEventListener('click',()=>{
      $('message').value=message;
      composerChanged();
      $('message').focus();
    });
    container.append(button);
  }
}
function appendBubble(text,cls){
  const bubble=el('div','bubble '+cls,text);
  bubble.dir='auto';
  if(containsArabic(text))bubble.lang='ar';
  else if(/[a-z]/i.test(text))bubble.lang='en';
  $('conversation').append(bubble);
  $('conversation').scrollTop=$('conversation').scrollHeight;
  return bubble;
}
function setStatus(key,status){
  const badge=$('status');
  setCopy(badge,`status_${key}`);
  if(status)badge.dataset.status=status;
  else badge.removeAttribute('data-status');
}
function jsonPreview(value){
  const preview=el('pre','json',JSON.stringify(value,null,2));
  preview.dir='ltr';
  return preview;
}
function inspect(r){
  const area=$('inspect');
  area.replaceChildren();
  setStatus(r.status,r.status);
  if(r.clarification_field){
    const card=el('div','decision-card');
    card.append(localized('strong','','clarification'),localized('small','',`field_${r.clarification_field}`));
    area.append(card);
  }
  const top=el('div','trace-head');
  top.append(localized('p','metric-label','request'),localized('span','source','extraction',r.trace.source));
  const checks=el('ul','checks');
  for(const check of r.trace.checks)checks.append(localized('li','',check));
  const details=el('details','evidence');
  details.append(localized('summary','','evidence'),jsonPreview(r.trace.evidence));
  area.append(top,jsonPreview(r.request),localized('p','metric-label','checks',r.trace.reference_date),checks,details);
}
$('message').addEventListener('input',composerChanged);
renderExamples();
let sessionId;
const welcome=$('conversation').firstElementChild.cloneNode(true);
const emptyInspector=$('inspect').firstElementChild.cloneNode(true);
function setBusy(busy){
  $('send').disabled=busy;
  $('reset').disabled=busy;
  for(const button of $('conversation').querySelectorAll('.quick-replies button'))button.disabled=busy;
}
function showSuggestions(pending,suggestions){
  $('conversation').querySelector('.quick-replies')?.remove();
  if(!suggestions?.length)return;

  const arabic=containsArabic(pending.textContent);
  const group=el('div','quick-replies');
  group.dir=arabic?'rtl':'ltr';
  group.lang=arabic?'ar':'en';
  group.setAttribute('role','group');
  group.setAttribute('aria-label',arabic?'ردود مقترحة':'Suggested replies');
  for(const suggestion of suggestions){
    const button=el('button','quick-reply',suggestion);
    button.type='button';
    button.addEventListener('click',()=>run(suggestion));
    group.append(button);
  }
  pending.after(group);
  return group.firstElementChild;
}
function showCourtLinks(pending,links){
  $('conversation').querySelector('.court-links')?.remove();
  if(!links?.length)return;
  const group=el('div','court-links');
  const arabic=containsArabic(pending.textContent);
  group.dir=arabic?'rtl':'ltr';
  group.lang=arabic?'ar':'en';
  group.setAttribute('role','group');
  group.setAttribute('aria-label',arabic?'ملاعب على FitCircle':'Courts on FitCircle');
  for(const {name,location,url} of links){
    const link=el('a',location?'court-link':'court-directory-link');
    link.href=url;
    link.target='_blank';
    link.rel='noopener noreferrer';
    const title=el('strong','',name);
    title.dir='auto';
    link.append(title);
    if(location)link.append(el('span','',location));
    group.append(link);
  }
  pending.after(group);
  return group.firstElementChild;
}
async function chat(body){
  const response=await fetch('/api/conversation',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...body,session_id:sessionId})
  });
  if(!response.ok)throw new Error('Conversation request failed');
  const result=await response.json();
  sessionId=result.session_id;
  return result;
}
async function run(suggestion){
  const composer=$('message');
  const message=(suggestion??composer.value).trim();
  if(!message||$('send').disabled)return;
  setBusy(true);
  if(suggestion===undefined){
    composer.value='';
    count();
  }
  setStatus('CHECKING');
  appendBubble(message,'customer');
  const pending=appendBubble('…','assistant');
  let nextChoice;
  try{
    const result=await chat({message});
    pending.textContent=result.reply;
    pending.lang=containsArabic(result.reply)?'ar':'en';
    inspect(result);
    const firstCourt=showCourtLinks(pending,result.court_links);
    nextChoice=showSuggestions(pending,result.suggestions)??firstCourt;
  }catch{
    setCopy(pending,'sendError');
    if(suggestion===undefined&&!composer.value)composer.value=message;
    count();
    setStatus('ERROR','EXTRACTION_ERROR');
    $('inspect').replaceChildren(localized('p','sub','noDecision'));
  }finally{
    setBusy(false);
    if(suggestion!==undefined&&document.activeElement===document.body)(nextChoice??composer).focus({preventScroll:true});
    $('conversation').scrollTop=$('conversation').scrollHeight;
  }
}
async function reset(){
  if($('reset').disabled)return;
  setBusy(true);
  try{
    await chat({reset:true});
    $('conversation').replaceChildren(welcome.cloneNode(true));
    $('inspect').replaceChildren(emptyInspector.cloneNode(true));
    setStatus('READY');
    translatePage();
    $('message').value='';
    count();
    $('message').focus();
  }catch{
    const error=appendBubble('','assistant');
    setCopy(error,'resetError');
  }finally{
    setBusy(false);
  }
}
$('reset').addEventListener('click',reset);
$('send').addEventListener('click',()=>run());$('message').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();run();}});
