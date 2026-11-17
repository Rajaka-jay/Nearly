// Shared activity rooms use the existing authenticated, revision-checked RPC.
let activeRoom = null;
let roomBusy = false;
let roomSnapshot = '';
const localStart = start;
const baseToast = toast;
toast = function (message) {
  if (!dialog.open) return baseToast(message);
  let notice = document.getElementById('dialog-notice');
  if (!notice) {
    notice = document.createElement('p');
    notice.id = 'dialog-notice';
    notice.setAttribute('role', 'status');
    notice.style.cssText = 'padding:14px;background:#eee5f6;border-radius:9px;margin-top:16px;line-height:1.6';
    document.getElementById('modal').append(notice);
  }
  notice.textContent = message;
};
const extraActivities = [
  {id:'watch',name:'Watch night',icon:'🍿',color:'pink',mode:'Together',time:60},
  {id:'cook',name:'Cook together',icon:'🍝',color:'green',mode:'Together',time:30},
  {id:'book',name:'Our book club',icon:'📚',color:'',mode:'Async',time:20},
  {id:'questions',name:'A little deeper',icon:'💬',color:'pink',mode:'Together',time:10},
  {id:'playlist',name:'Our shared playlist',icon:'🎵',color:'',mode:'Async',time:10}
];
catalog.push(...extraActivities);
dialog.addEventListener('close', () => { activeRoom = null; });
function mySeat() { return spaceRecord.owner ? 'A' : 'B'; }
function newRoom(id) {
  return {id, version:crypto.randomUUID(), turn:'A', board:Array(9).fill(''),
    cards:['🌷','🌙','☕','💌','🌷','🌙','☕','💌'].map(v=>({v,r:Math.random()})).sort((a,b)=>a.r-b.r).map(x=>x.v),
    open:[],matched:[],answers:{},notes:[],title:'',url:'',end:0,started:0,image:'',result:'',round:1};
}
start = async function(id) {
  if (id==='letter') return localStart(id);
  if (!spaceRecord) return toast('Sign in and join your space first.');
  activeRoom=id;
  try {
    if(saving || pending) { await flush(); if(saving || pending) throw Error('Wait for your changes to finish saving.'); }
    const s=await rpc('get');
    acceptSpace(s);
    if(!state.rooms?.[id]) await roomChange(()=>newRoom(id));
    renderRoom();
  } catch(e) { activeRoom=null; toast(e.message); }
};
async function roomChange(change) {
  if(roomBusy || saving || pending) return toast('A save is in progress. Try again in a moment.');
  roomBusy=true;
  const id=activeRoom;
  try {
    const latest=await rpc('get');
    if(!latest) throw Error('Your space is no longer available.');
    const data=structuredClone(latest.data);
    data.rooms ||= {};
    const changed=change(structuredClone(data.rooms[id] || newRoom(id)));
    data.rooms[id]=changed;
    const saved=await rpc('save',{revision:latest.revision,data});
    acceptSpace(saved);
    if(activeRoom===id) renderRoom();
  } catch(e) { toast(e.message); }
  finally {roomBusy=false;}
}
function roomButton(text,action) { return `<button class="btn light" onclick="${action}">${text}</button>`; }
function renderRoom() {
  if(!activeRoom) return;
  const r=state.rooms?.[activeRoom];
  if(!r) return;
  roomSnapshot=JSON.stringify(r);
  const meta=catalog.find(a=>a.id===activeRoom);
  let body='';
  if(r.id==='ttt') body=`<p class="sub">${esc(r.result || (r.turn===mySeat()?'Your turn':'Your partner’s turn'))}</p><div class="board">${r.board.map((v,i)=>roomButton(v||'·',`sharedMove(${i})`)).join('')}</div>`;
  else if(r.id==='match') body=`<p class="sub">${r.turn===mySeat()?'Your turn':'Your partner’s turn'} · ${r.matched.length/2} of 4 pairs</p><div class="board match">${r.cards.map((v,i)=>roomButton(r.open.includes(i)||r.matched.includes(i)?v:'✧',`sharedFlip(${i})`)).join('')}</div>${r.open.length===2?roomButton('Next turn',"nextMatchTurn()"):''}`;
  else if(['guess','rather','questions'].includes(r.id)) {
    const prompts=r.id==='guess'?['What makes a perfect morning?','What is your ideal weekend?']:r.id==='rather'?['A cabin in the mountains or a cottage by the sea?','Travel into the past or into the future?']:['What made you smile today?','What would our perfect ordinary day look like?','What would you like us to learn together?','What is a small way I can support you this week?'];
    body=`<p class="sub">${prompts[(r.round-1)%prompts.length]}</p>${Object.entries(r.answers).map(([who,a])=>`<p style="padding:12px;background:#f4eef8">${who===mySeat()?'You':'Your partner'} · ${esc(a)}</p>`).join('')}<form id="room-answer">${area('Your answer','answer',r.answers[mySeat()]||'')}<button class="btn">Share answer</button></form><p class="sub">Answers are shared immediately.</p>${roomButton('Next question','nextQuestion()')}`;
  } else if(r.id==='truths') {
    body=r.statements?`<p class="sub">${r.author===mySeat()?'Your partner is guessing.':'Which statement is the lie?'}</p>${r.statements.map((v,i)=>roomButton(esc(v),`guessLie(${i})`)).join(' ')}<p class="sub">${esc(r.result)}</p>`:`<form id="truth-form">${field('First statement','one')+field('Second statement','two')+field('Third statement','three')}<label>Which is the lie?</label><select name="lie"><option value="0">First</option><option value="1">Second</option><option value="2">Third</option></select><button class="btn">Send for guessing</button></form><p class="sub">Use this as a casual game. The shared data contains the answer.</p>`;
  } else if(r.id==='roulette') body=`<p style="font-size:22px;margin:24px 0">${esc(r.idea||'Discover your next little date.')}</p>${roomButton('Choose a date','sharedRoulette()')} ${roomButton('Add to planner','plan(state.rooms.roulette.idea || "Date night")')}`;
  else if(r.id==='focus') body=`<p class="sub">A shared 25-minute study session.</p><div id="shared-clock" style="font-size:50px;margin:30px 0"></div>${roomButton('Start together','startFocus()')} ${roomButton('End session','stopFocus()')}`;
  else if(r.id==='draw') body=`<p class="sub">${r.turn===mySeat()?'Your drawing turn':'Your partner is drawing'} · Updates after each stroke</p><canvas id="shared-canvas" width="600" height="400" style="width:100%;background:#faf7fc;touch-action:none;border:1px solid #ddd;margin:20px 0"></canvas>${roomButton('Pass the pen','passPen()')}`;
  else {
    body=`<p class="sub">${r.id==='watch'?'Open your own legal viewing link, then use the shared start time to coordinate playback.':r.id==='cook'?'Share a recipe and check off each step together.':r.id==='book'?'Keep your book, chapter goals, and thoughts together.':'Add song links and listening ideas together.'}</p><h3>${esc(r.title)}</h3>${safeLink(r.url)}<button class="link" onclick="editActivity()">Edit title and link</button>${r.id==='watch'?roomButton('Start together in 10 seconds','startWatch()')+'<div id="shared-clock" style="font-size:30px;margin:15px 0"></div>':''}<div>${r.notes.map((n,i)=>`<div class="list-row"><input style="width:20px" type="checkbox" ${n.done?'checked':''} aria-label="Complete item" onchange="toggleRoomNote(${i})"><span>${esc(n.text)}</span></div>`).join('')}</div><form id="room-note">${field('Add a step, song, or thought','note')}<button class="btn">Add together</button></form>`;
  }
  modal(`<h2>${esc(meta.name)}</h2><p class="sub">${spaceRecord.paired?'Connected with your partner':'Invite your partner from Account & pairing'} · Updates about every 3 seconds</p>${body}<div style="display:flex;gap:8px;margin-top:22px">${roomButton('Start new round','resetRoom()')}${roomButton('Keep a memory','keepRoomMemory()')}</div>`);
  const answer=$('#room-answer');if(answer)answer.onsubmit=e=>{e.preventDefault();const text=new FormData(e.target).get('answer');roomChange(r=>{r.answers[mySeat()]=text;return r})};
  const truth=$('#truth-form');if(truth)truth.onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);roomChange(r=>{r.statements=['one','two','three'].map(k=>f.get(k));r.lie=Number(f.get('lie'));r.author=mySeat();return r})};
  const note=$('#room-note');if(note)note.onsubmit=e=>{e.preventDefault();const text=new FormData(e.target).get('note');roomChange(r=>{r.notes.push({text,done:false});return r})};
  if(r.id==='draw') setupSharedCanvas(r);
  sharedClock();
}
function safeLink(url){try{const u=new URL(url);if(u.protocol==='https:'||u.protocol==='http:')return `<p><a class="link" target="_blank" rel="noopener noreferrer" href="${esc(u.href)}">Open together ↗</a></p>`}catch{}return ''}
function sharedMove(i){roomChange(r=>{if(r.turn!==mySeat()||r.board[i]||r.result)throw Error('Wait for your turn.');const symbol=r.turn==='A'?'X':'O';r.board[i]=symbol;if([[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].some(a=>a.every(j=>r.board[j]===symbol)))r.result=symbol+' wins!';else if(r.board.every(Boolean))r.result='A lovely little draw.';r.turn=r.turn==='A'?'B':'A';return r})}
function sharedFlip(i){roomChange(r=>{if(r.turn!==mySeat()||r.open.length===2||r.open.includes(i)||r.matched.includes(i))throw Error('Wait for your next turn.');r.open.push(i);if(r.open.length===2&&r.cards[r.open[0]]===r.cards[r.open[1]]){r.matched.push(...r.open);r.open=[]}return r})}
function nextMatchTurn(){roomChange(r=>{if(r.turn!==mySeat())throw Error('Your partner finishes this turn.');r.open=[];r.turn=r.turn==='A'?'B':'A';return r})}
function nextQuestion(){roomChange(r=>{r.round++;r.answers={};return r})}
function guessLie(i){roomChange(r=>{if(r.author===mySeat())throw Error('Your partner guesses this round.');r.result=i===r.lie?'You found the lie!':'The lie was '+r.statements[r.lie];return r})}
function sharedRoulette(){roomChange(r=>{r.idea=dates[Math.floor(Math.random()*dates.length)];return r})}
function startFocus(){roomChange(r=>{r.end=Date.now()+25*60000;return r})}
function stopFocus(){roomChange(r=>{r.end=0;return r})}
function startWatch(){roomChange(r=>{r.started=Date.now()+10000;return r})}
function passPen(){roomChange(r=>{if(r.turn!==mySeat())throw Error('Wait for the pen.');r.turn=r.turn==='A'?'B':'A';return r})}
function toggleRoomNote(i){roomChange(r=>{r.notes[i].done=!r.notes[i].done;return r})}
function resetRoom(){if(!confirm('Start a new round for both of you?'))return;roomChange(r=>newRoom(r.id))}
function keepRoomMemory(){const r=state.rooms[activeRoom];activeRoom=null;addMemory(catalog.find(a=>a.id===r.id).name,r.result||r.idea||r.title||'A little time together.')}
function editActivity(){const id=activeRoom,r=state.rooms[id];activeRoom=null;form('Our activity',field('Title','title',r.title)+'<label>Link (optional)</label><input name="url" type="url" value="'+esc(r.url)+'">',async f=>{activeRoom=id;await roomChange(r=>{r.title=f.get('title');r.url=f.get('url');return r})})}
function setupSharedCanvas(r){const c=$('#shared-canvas'),ctx=c.getContext('2d');ctx.fillStyle='#faf7fc';ctx.fillRect(0,0,600,400);if(r.image){let img=new Image();img.onload=()=>ctx.drawImage(img,0,0);img.src=r.image}ctx.strokeStyle='#8972b4';ctx.lineWidth=5;ctx.lineCap='round';let painting=false;const point=e=>{let b=c.getBoundingClientRect();return[(e.clientX-b.left)*600/b.width,(e.clientY-b.top)*400/b.height]};c.onpointerdown=e=>{if(r.turn!==mySeat()||roomBusy)return;painting=true;c.setPointerCapture(e.pointerId);ctx.beginPath();ctx.moveTo(...point(e))};c.onpointermove=e=>{if(painting){ctx.lineTo(...point(e));ctx.stroke()}};c.onpointerup=c.onpointercancel=()=>{if(!painting)return;painting=false;const image=c.toDataURL();roomChange(latest=>{if(latest.turn!==mySeat())throw Error('The pen has changed hands.');latest.image=image;return latest})}}
function sharedClock(){const el=$('#shared-clock'),r=state.rooms?.[activeRoom];if(!el||!r)return;let seconds=r.id==='focus'?Math.max(0,Math.ceil((r.end-Date.now())/1000)):Math.floor((Date.now()-r.started)/1000);el.textContent=r.id==='focus'?(r.end?Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):'Ready when you are'):!r.started?'Ready for movie night':seconds<0?'Press play in '+(-seconds)+'s':'Playing together · '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')}
setInterval(sharedClock,1000);
setInterval(async()=>{if(!activeRoom||!dialog.open||roomBusy||saving||pending)return;const focused=document.activeElement;if(focused?.matches('input,textarea,select'))return;try{const s=await rpc('get');if(!s)return;const room=s.data.rooms?.[activeRoom];if(JSON.stringify(room)!==roomSnapshot){acceptSpace(s);renderRoom()}}catch{cloudStatus('Reconnecting…')}},3000);
