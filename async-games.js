/* Persistent async games. Board state and legal moves come only from the authenticated RPC. */
(function(){
 'use strict';
 const games=[
  {id:'four',name:'Four in a Row',icon:'🌸',color:'pink',mode:'Async',time:2,description:'Drop a blossom. Make a line of four.'},
  {id:'reversi',name:'Reversi',icon:'🌿',color:'green',mode:'Async',time:3,description:'Turn the board your way, one thoughtful move at a time.'},
  {id:'pebbles',name:'Pebble Paths',icon:'🪨',color:'',mode:'Async',time:1,description:'Take from one pile. The final pebble wins.'}
 ];
 catalog.push(...games);
 let current=null,busy=false,refreshing=false,opening=false,epoch=0,error='',lobby=[],poll=null;
 let sessionUser=null;
 cloud?.auth?.onAuthStateChange((_event,session)=>{const next=session?.user?.id||null;if(!next||(sessionUser&&sessionUser!==next)){epoch++;current=null;error='';lobby=[];if(document.querySelector('#modal .ag'))dialog.close();}sessionUser=next;});
 const beforeStart=start,beforePlay=play;
 const mine=()=>current?.state.turn===current?.seat;
 const player=s=>s===current?.seat?'You':'Your partner';
 async function rpc(action,payload={}){
  if(!cloud)throw Error('Sign in to play with your partner.');
  let timer;
  try{const {data,error:e}=await Promise.race([cloud.rpc('nearly_async',{action,payload}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('The connection is taking too long. Refresh the board before trying another move.')),15000);})]);if(e)throw e;return data;}finally{clearTimeout(timer);}
 }
 function message(e){return e.code==='PGRST202'?'The new games are not available yet. Please try again shortly.':e.message||'Could not connect. Your last saved move is safe; try refreshing.';}
 start=async function(kind){
  if(!games.some(g=>g.id===kind))return beforeStart(kind);
  if(opening||busy)return;
  const token=++epoch;opening=true;current=null;activeRoom=null;
  modal('<section class="ag"><h2>Opening your game…</h2><p role="status">Loading your saved board.</p></section>');
  try{const data=await rpc('get',{kind});if(token!==epoch)return;current=data;error='';render();}
  catch(e){if(token===epoch){error=message(e);modal(`<section class="ag"><h2>Couldn’t open the game</h2><p role="alert">${esc(error)}</p><button class="btn" onclick="NearlyAsync.open('${kind}')">Try again</button><p class="sub">Both accounts must be signed in and connected to the same couple space.</p></section>`);}}
  finally{opening=false;}
 };
 function status(){const s=current.state;return s.result?(s.result==='draw'?'A lovely draw.':player(s.result)+' won this round.'):(mine()?'Your turn, whenever you’re ready.':'Your partner’s turn. Come back whenever you like.');}
 function render(){
  if(!current)return;
  const focused=document.activeElement?.dataset.agFocus;
  const rulesOpen=document.querySelector('#modal .ag details')?.open;
  const g=games.find(g=>g.id===current.kind),s=current.state,disabled=busy||!mine()||!!s.result;
  let board='';
  if(g.id==='four'){
   board=`<div class="ag-columns" aria-label="Choose a column">${Array.from({length:7},(_,c)=>`<button data-ag-focus="column-${c}" aria-label="Drop blossom in column ${c+1}" ${disabled||s.board[c]?'disabled':''} onclick="NearlyAsync.move(${c})">${c+1}</button>`).join('')}</div><div class="ag-board ag-four" role="img" aria-label="Four in a Row board. ${esc(status())} ${esc(Array.from({length:6},(_,r)=>'Row '+(r+1)+': '+s.board.slice(r*7,r*7+7).map(v=>v?player(v):'empty').join(', ')).join('. '))}">${s.board.map((v,i)=>`<span class="ag-cell ${v?'ag-'+v:''} ${s.last_move===i?'ag-last':''}" aria-label="Row ${Math.floor(i/7)+1}, column ${i%7+1}: ${v?player(v):'empty'}">${v?(v==='A'?'✿':'✦'):''}</span>`).join('')}</div>`;
  }else if(g.id==='reversi'){
   const legal=new Set(current.legal||[]);
   board=`<div class="ag-score"><span>${current.seat==='A'?'✿':'✦'} You: ${s.board.filter(v=>v===current.seat).length}</span><span>${current.seat==='A'?'✦':'✿'} Partner: ${s.board.filter(v=>v&&v!==current.seat).length}</span></div><div class="ag-board ag-reversi" aria-label="Reversi board">${s.board.map((v,i)=>`<button data-ag-focus="cell-${i}" class="ag-cell ${v?'ag-'+v:''} ${legal.has(i)&&!disabled?'ag-legal':''} ${s.last_move===i?'ag-last':''}" aria-label="${String.fromCharCode(65+i%8)}${Math.floor(i/8)+1}, ${v?player(v):legal.has(i)?'available move':'empty'}" ${disabled||!legal.has(i)?'disabled':''} onclick="NearlyAsync.move(${i})">${v?(v==='A'?'✿':'✦'):legal.has(i)&&!disabled?'·':''}</button>`).join('')}</div>${s.passed?`<p class="sub">${player(s.passed)} had no legal move, so the turn passed automatically.</p>`:''}`;
  }else{
   board=`<div class="ag-piles">${s.piles.map((n,i)=>`<section><h3>Pile ${i+1} <span>· ${n} left</span></h3><div class="ag-stones" aria-hidden="true">${'● '.repeat(n)||'All gathered'}</div><div class="ag-take">${Array.from({length:n},(_,j)=>`<button data-ag-focus="pile-${i}-${j}" aria-label="Take ${j+1} pebble${j?'s':''} from pile ${i+1}" ${disabled?'disabled':''} onclick="NearlyAsync.move(${i},${j+1})">Take ${j+1}</button>`).join('')}</div></section>`).join('')}</div>`;
  }
  const rules={four:'Choose a numbered column to drop your blossom into its lowest empty space. Four in a row horizontally, vertically, or diagonally wins. A full board without a winner is a draw.',reversi:'Place a blossom on a highlighted square to trap a straight line of your partner’s blossoms between yours. Trapped blossoms change to your side. If a player cannot move, their turn passes automatically. When neither player can move, the player with more blossoms wins.',pebbles:'Take any number of pebbles from exactly one pile each turn. You must take at least one. Whoever takes the final pebble wins.'};
  modal(`<section class="ag"><div class="ag-eyebrow">A LITTLE PLAY, AT YOUR OWN PACE</div><h2>${g.name}</h2><p class="ag-status" role="status" aria-live="polite">${esc(status())}</p><div class="ag-chips"><span>Round ${s.round}</span><span>You: ${current.seat==='A'?'✿ Rose':'✦ Sage'}</span><span>${busy?'Saving…':'Saved across both accounts'}</span></div>${error?`<p class="ag-error" role="alert">${esc(error)}</p>`:''}${board}<div class="ag-footer"><button data-ag-focus="refresh" class="btn light" ${busy?'disabled':''} onclick="NearlyAsync.refresh()">Refresh board</button>${s.result?`<button data-ag-focus="rematch" class="btn" ${busy||(s.rematch||[]).includes(current.seat)?'disabled':''} onclick="NearlyAsync.rematch()">${(s.rematch||[]).includes(current.seat)?'Waiting for your partner':(s.rematch||[]).length?'Accept another round':'Play another round'}</button>`:''}</div><details ${rulesOpen?'open':''}><summary data-ag-focus="rules">How to play</summary><p>${rules[g.id]}</p><p>You don’t need to be online together. Close this window and return through Play together to resume. Another round begins only after both partners agree, with the starting player alternating.</p></details><p class="ag-caption">${s.result?'Your finished board stays here until you both start again.':'No timer. No rush. Your next move will be here.'}</p></section>`);
  if(focused)document.querySelector(`[data-ag-focus="${focused}"]`)?.focus();
 }
 async function refresh(manual=false){
  if(!current||busy||refreshing)return;
  const token=epoch,id=current.id;refreshing=true;
  try{const next=await rpc('get',{kind:current.kind});if(token!==epoch||current?.id!==id)return;const changed=next.version!==current.version;current=next;if(changed||error||manual){error='';render();}}
  catch(e){if(token===epoch&&current?.id===id){error=message(e);render();}}
  finally{refreshing=false;}
 }
 async function act(action,index,count){
  if(!current||busy)return;
  const token=epoch,snapshot=current;busy=true;error='';render();
  try{const next=await rpc(action,{kind:snapshot.kind,index,count,version:snapshot.version,request_id:crypto.randomUUID()});if(token===epoch&&current?.id===snapshot.id){current=next;render();}}
  catch(e){if(token===epoch&&current?.id===snapshot.id){error=message(e);try{const latest=await rpc('get',{kind:snapshot.kind});if(token===epoch&&current?.id===snapshot.id)current=latest;}catch{/* Keep the last confirmed board. */}}}
  finally{busy=false;if(token===epoch&&current?.id===snapshot.id)render();}
 }
 play=function(){beforePlay();const grid=document.getElementById('activities');if(grid&&!document.getElementById('ag-resume')){const section=document.createElement('section');section.id='ag-resume';section.className='ag-resume';section.innerHTML='<h2>Pick up where you left off</h2><p class="sub" role="status">Loading your saved games…</p>';grid.before(section);void refreshLobby();}const p=grid?.previousElementSibling?.previousElementSibling;if(p?.textContent.includes('Play on this device'))p.textContent='Async games save each turn for both partners. Play whenever it suits you.';};
 async function refreshLobby(){
  if(page!=='play')return;
  const target=document.getElementById('ag-resume');if(!target)return;const token=epoch;
  try{const result=await rpc('list');if(!target.isConnected||token!==epoch)return;lobby=result;const signature=JSON.stringify(lobby.map(g=>[g.kind,g.version,g.seat]));if(target.dataset.signature===signature)return;target.dataset.signature=signature;const focused=document.activeElement?.dataset.agKind;target.innerHTML='<h2>Pick up where you left off</h2>'+ (lobby.length?`<div class="ag-resume-list">${lobby.map(g=>{const name=games.find(x=>x.id===g.kind)?.name||g.kind;return `<button data-ag-kind="${g.kind}" onclick="NearlyAsync.open('${g.kind}')"><strong>${esc(name)}</strong><span>${g.state.result?'Round finished':g.state.turn===g.seat?'Your turn':'Waiting for your partner'}</span></button>`;}).join('')}</div>`:'<p class="sub">Start one of the new async games below. Your board will wait here for both of you.</p>');if(focused)target.querySelector(`[data-ag-kind="${focused}"]`)?.focus();}
  catch(e){if(token!==epoch||!target.isConnected)return;const signature='error:'+message(e);if(target.dataset.signature===signature)return;target.dataset.signature=signature;target.innerHTML=`<h2>Your saved games</h2><p class="sub">${esc(message(e))}</p><button class="btn light" onclick="NearlyAsync.lobby()">Try again</button>`;}
 }
 dialog.addEventListener('close',()=>{epoch++;current=null;error='';});
 window.addEventListener('online',()=>{void refresh(true);void refreshLobby();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){void refresh(true);void refreshLobby();}});
 poll=setInterval(()=>{if(!document.hidden){void refresh();if(!current&&!dialog.open)void refreshLobby();}},4000);
 window.NearlyAsync={open:kind=>start(kind),move:(i,n)=>act('move',i,n),rematch:()=>act('rematch'),refresh:()=>refresh(true),lobby:refreshLobby};
if(page==='play')play();
})();
