// chess.js is BSD-2-Clause. See THIRD_PARTY_NOTICES.md.
let ChessEngine;
let selectedSquare = null;
const renderActivityRoom = renderRoom;
catalog.push({id:'chess',name:'Chess for two',icon:'♟',color:'green',mode:'Together',time:30});
const openActivity = start;
start = async function(id) {
  if (id === 'chess' && !ChessEngine) {
    try { ({Chess:ChessEngine} = await import('https://cdn.jsdelivr.net/npm/chess.js@1.4.0/dist/esm/chess.js')); }
    catch { toast('Chess could not load. Please check your connection and try again.'); return; }
  }
  selectedSquare = null;
  return openActivity(id);
};
renderRoom = function() {
  if(activeRoom !== 'chess') return renderActivityRoom();
  const room = state.rooms?.chess;
  if(!room || !ChessEngine) return;
  const game = new ChessEngine(room.fen);
  roomSnapshot = JSON.stringify(room);
  const pieces={p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'};
  const white = mySeat()==='A';
  let board=game.board();
  if(!white) board=board.slice().reverse().map(row=>row.slice().reverse());
  const result=game.isCheckmate()?'Checkmate':game.isDraw()?'Draw':(game.turn()==='w'?'White':'Black')+' to move'+(game.isCheck()?' · Check':'');
  modal(`<h2>Chess for two</h2><p class="game-meta">You play ${white?'White':'Black'} · ${result}</p><div class="chessboard">${board.flatMap((row,ri)=>row.map((piece,ci)=>{const rank=white?8-ri:ri+1,file=white?ci:7-ci,square='abcdefgh'[file]+rank;return `<button aria-label="${square}${piece?' '+piece.color+' '+piece.type:''}" class="${(ri+ci)%2?'dark':''} ${piece?.color==='w'?'white-piece':''} ${selectedSquare===square?'selected':''}" onclick="selectChessSquare('${square}')">${piece?pieces[piece.type]:''}</button>`})).join('')}</div><p class="sub">Select a piece, then its destination. Pawns promote to queens.</p><div style="display:flex;gap:12px;margin-top:20px"><button class="btn light" onclick="resetRoom()">New game</button><button class="btn light" onclick="keepRoomMemory()">Keep a memory</button></div>`);
};
function selectChessSquare(square) {
  const game=new ChessEngine(state.rooms.chess.fen);
  const color=mySeat()==='A'?'w':'b';
  if(game.turn()!==color || game.isGameOver()) return toast('Wait for your turn, or start a new game.');
  if(game.get(square)?.color===color){selectedSquare=square;renderRoom();return}
  if(!selectedSquare)return;
  const from=selectedSquare;selectedSquare=null;
  roomChange(room=>{const current=new ChessEngine(room.fen);if(current.turn()!==color)throw Error('The turn has changed.');try{current.move({from,to:square,promotion:'q'})}catch{throw Error('That move is not legal.')}room.fen=current.fen();room.result=current.isCheckmate()?'Checkmate':current.isDraw()?'Draw':'';return room});
}
