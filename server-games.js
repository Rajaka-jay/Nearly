// Uses the additive game-session migration when it is available.
let authoritativeSession = null;
let authoritativeRequest = false;
let authoritativeRefresh = false;
const startBeforeServerGames=start;
const renderBeforeServerGames=renderRoom;
const resetBeforeServerGames=resetRoom;
const memoryBeforeServerGames=keepRoomMemory;
async function gameRpc(action,payload){const {data,error}=await cloud.rpc('nearly_game',{action,payload});if(error)throw error;return data}
start=async function(id){
  if(!['ttt','match'].includes(id))return startBeforeServerGames(id);
  if(!spaceRecord?.paired)return toast('Invite your partner from Account & pairing to play together.');
  try {
    authoritativeSession=await gameRpc('get',{kind:id});activeRoom=id;renderRoom();
  }catch(error){
    if(error.code==='PGRST202'||error.message.includes('Could not find the function'))return startBeforeServerGames(id);
    toast(error.message);
  }
};
renderRoom=function(){
  if(!authoritativeSession||activeRoom!==authoritativeSession.kind)return renderBeforeServerGames();
  const r=authoritativeSession.state;
  const isMine=r.turn===mySeat();
  let board;
  if(r.id==='ttt')board=`<div class="board">${r.board.map((value,index)=>`<button aria-label="Square ${index+1}${value?', '+value:''}" ${value||!isMine||r.result||authoritativeRequest?'disabled':''} onclick="serverGameAction('move',${index})">${value||'·'}</button>`).join('')}</div>`;
  else board=`<div class="board match">${r.cards.map((value,index)=>{const visible=r.open.includes(index)||r.matched.includes(index);return `<button aria-label="${visible?value:'Hidden card '+(index+1)}" ${visible||!isMine||r.open.length===2||authoritativeRequest?'disabled':''} onclick="serverGameAction('flip',${index})">${visible?value:'✧'}</button>`}).join('')}</div>${r.open.length===2?`<button class="btn light" ${!isMine||authoritativeRequest?'disabled':''} onclick="serverGameAction('next')">Next turn</button>`:''}`;
  modal(`<h2>${r.id==='ttt'?'Tic-tac-together':'Memory match'}</h2><p class="game-meta">${r.result?esc(r.result):isMine?'Your turn':'Your partner’s turn'}</p><p class="sub">${r.id==='ttt'?'You play '+(mySeat()==='A'?'X':'O')+'. Place three in a row.':'Find matching pairs together. Reveal two cards, then pass the turn if they differ.'}</p>${board}<p class="sub">${authoritativeRequest?'Saving your move…':'Shared round · progress saved'}</p><div style="display:flex;gap:10px;margin-top:16px"><button class="btn light" onclick="resetRoom()">New round</button><button class="btn light" onclick="keepRoomMemory()">Keep a memory</button></div>`);
};
async function serverGameAction(action,index){
  if(authoritativeRequest||!authoritativeSession)return;
  authoritativeRequest=true;renderRoom();
  const snapshot=authoritativeSession;
  const requestId=crypto.randomUUID();
  try {
    const data=await gameRpc(action,{kind:snapshot.kind,index,version:snapshot.version,request_id:requestId});
    if(activeRoom===snapshot.kind){authoritativeSession=data;renderRoom();}
  }catch(error){
    try{authoritativeSession=await gameRpc('get',{kind:snapshot.kind})}catch{}
    if(activeRoom===snapshot.kind){renderRoom();toast(error.message)}
  }finally{authoritativeRequest=false;if(activeRoom===snapshot.kind)renderRoom()}
}
resetRoom=function(){
  if(!authoritativeSession||activeRoom!==authoritativeSession.kind)return resetBeforeServerGames();
  if(confirm('Start a new round for both of you?'))serverGameAction('reset');
};
keepRoomMemory=function(){
  if(!authoritativeSession||activeRoom!==authoritativeSession.kind)return memoryBeforeServerGames();
  const room=authoritativeSession;activeRoom=null;authoritativeSession=null;
  addMemory(room.kind==='ttt'?'Tic-tac-together':'Memory match',room.state.result||'A little time together.');
};
dialog.addEventListener('close',()=>{authoritativeSession=null});
setInterval(async()=>{
  if(!authoritativeSession||!activeRoom||authoritativeRequest||authoritativeRefresh)return;
  authoritativeRefresh=true;
  const id=authoritativeSession.id,kind=authoritativeSession.kind;
  try{const next=await gameRpc('get',{kind});if(authoritativeSession?.id===id&&activeRoom===kind&&next.version!==authoritativeSession.version){authoritativeSession=next;renderRoom()}}
  catch{cloudStatus('Reconnecting…')}
  finally{authoritativeRefresh=false}
},1500);
