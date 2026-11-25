const $=id=>document.getElementById(id);
const examples=[
 ['Arabic · missing duration','بدي احجز ملعب بادل بكرا الساعة 7 المسا بالمزة، نحنا 4'],
 ['English · flexible time','Any football pitch free Friday evening near Malki for 10 people?'],
 ['Arabic · clarification','في شي ملعب فاضي اليوم؟'],
 ['English · exact match','Book padel tomorrow at 7 pm in Mezzeh for 90 minutes, 4 players.'],
 ['Mixed · Arabic numerals','بدي padel بأبو رمانة بعد بكرا الساعة ٦ المسا لمدة ساعة، نحنا ٤'],
 ['English · no exact slot','Football in Malki tomorrow at 3 pm for 60 minutes, 10 players.']
];
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
function appendBubble(text,cls){const b=el('div','bubble '+cls,text);b.dir='auto';$('conversation').append(b);$('conversation').scrollTop=$('conversation').scrollHeight;return b;}
function count(){$('counter').textContent=`${$('message').value.length} / 2000`;}
$('message').addEventListener('input',count);
for(const [label,message] of examples){const btn=el('button','example');btn.type='button';btn.append(el('strong','',label));const span=el('span','',message);span.dir='auto';btn.append(span);btn.addEventListener('click',()=>{$('message').value=message;count();$('message').focus();});$('examples').append(btn);}
function inspect(r){const area=$('inspect');area.replaceChildren();const status=$('status');status.textContent=r.status.replaceAll('_',' ');status.dataset.status=r.status;const slots=r.match?[r.match]:r.alternatives??[];
 if(slots.length){area.append(el('p','metric-label',r.match?'Matched slot':'Ranked alternatives'));for(const s of slots){const card=el('div','decision-card');card.append(el('strong','',s.venue),el('p','',`${s.date} · ${s.start_time}–${s.end_time}`),el('small','',`${s.sport} · capacity ${s.capacity}`));area.append(card);}}
 if(r.clarification_field){const card=el('div','decision-card');card.append(el('strong','','Clarification field'),el('small','',r.clarification_field));area.append(card);}
 const top=el('div','trace-head');top.append(el('p','metric-label','Normalized request'),el('span','source',`Extraction: ${r.trace.source}`));area.append(top,el('pre','json',JSON.stringify(r.request,null,2)),el('p','metric-label',`Decision checks · ${r.trace.reference_date}`));const checks=el('ul','checks');for(const c of r.trace.checks)checks.append(el('li','',c));area.append(checks);const details=el('details','evidence');details.append(el('summary','','Raw evidence'),el('pre','json',JSON.stringify(r.trace.evidence,null,2)));area.append(details);
}
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

  const arabic=/[\u0621-\u064a]/.test(pending.textContent);
  const group=el('div','quick-replies');
  group.dir=arabic?'rtl':'ltr';
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
  $('status').textContent='CHECKING';
  $('status').removeAttribute('data-status');
  appendBubble(message,'customer');
  const pending=appendBubble('…','assistant');
  let nextChoice;
  try{
    const result=await chat({message});
    pending.textContent=result.reply;
    inspect(result);
    nextChoice=showSuggestions(pending,result.suggestions);
  }catch{
    pending.textContent=/[\u0621-\u064a]/.test(message)
      ? 'ما قدرت كمّل الطلب. فيك تجرّب مرة تانية؟'
      : 'Could not complete the request. Please try again.';
    if(suggestion===undefined&&!composer.value)composer.value=message;
    count();
    $('status').textContent='ERROR';
    $('status').dataset.status='EXTRACTION_ERROR';
    $('inspect').replaceChildren(el('p','sub','No decision was produced.'));
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
    $('status').textContent='READY';
    $('status').removeAttribute('data-status');
    $('message').value='';
    count();
    $('message').focus();
  }catch{
    appendBubble('Could not start a new booking. Please try again.','assistant');
  }finally{
    setBusy(false);
  }
}
$('reset').addEventListener('click',reset);
$('send').addEventListener('click',()=>run());$('message').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();run();}});
try{const r=await fetch('/api/availability');if(!r.ok)throw new Error();const data=await r.json();$('inventory').replaceChildren();for(const day of data.days){const block=el('div','inventory-day');block.append(el('h3','',day.date));for(const v of day.venues){block.append(el('p','',`${v.venue} · ${v.free.length?v.free.map(x=>`${x.start}–${x.end}`).join(', '):'No free slots'}`));}$('inventory').append(block);}}catch{$('inventory').textContent='Inventory could not be loaded.';}
