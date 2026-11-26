import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user',true),'')::uuid$$;`);
await db.exec(await fs.readFile(new URL('../supabase/setup.sql',import.meta.url),'utf8'));
await db.exec(await fs.readFile(new URL('../supabase/async_games.sql',import.meta.url),'utf8'));
const A='00000000-0000-0000-0000-000000000001',B='00000000-0000-0000-0000-000000000002',C='00000000-0000-0000-0000-000000000003',D='00000000-0000-0000-0000-000000000004';
await db.query('insert into auth.users values($1),($2),($3),($4)',[A,B,C,D]);
await db.query('insert into nearly_spaces(owner_id,partner_id) values($1,$2),($3,$4)',[A,B,C,D]);
async function user(id){await db.query("select set_config('app.user',$1,false)",[id]);}
async function rpc(action,payload={}){return(await db.query('select nearly_async($1,$2::jsonb) result',[action,JSON.stringify(payload)])).rows[0].result;}
async function get(kind){return rpc('get',{kind});}
async function move(g,index,count){return rpc('move',{kind:g.kind,index,count,version:g.version,request_id:crypto.randomUUID()});}
async function fixture(g,patch){await db.query('update nearly_async_games set state=state||$1::jsonb where id=$2',[JSON.stringify(patch),g.id]);return get(g.kind);}
await user('');await assert.rejects(get('four'),/Sign in/);
await user(A);await db.exec('set role authenticated');
let g=await get('four');assert.equal(g.version,0);assert.equal(g.state.board.length,42);assert.equal(g.seat,'A');
await assert.rejects(db.query('select * from nearly_async_games'),/permission denied/);
await assert.rejects(db.query("update nearly_async_games set version=99"),/permission denied/);
await assert.rejects(db.query('select * from nearly_async_receipts'),/permission denied/);
await db.exec('reset role');
const request=crypto.randomUUID();const payload={kind:'four',index:0,version:0,request_id:request};
g=await rpc('move',payload);assert.equal(g.state.board[35],'A');assert.equal(g.version,1);
assert.equal((await rpc('move',payload)).version,1);
await assert.rejects(move(g,1),/partner/);
await user(B);await assert.rejects(rpc('move',{...payload,request_id:crypto.randomUUID()}),/STALE/);
await assert.rejects(move(g,-1),/column/);await assert.rejects(move(g,7),/column/);
for(const [id,col]of [[B,0],[A,1],[B,1],[A,2],[B,2],[A,3]]){await user(id);g=await move(g,col);}
assert.equal(g.state.result,'A');
await user(B);await assert.rejects(move(g,4),/finished/);
let p={kind:'four',version:g.version,request_id:crypto.randomUUID()};g=await rpc('rematch',p);assert.deepEqual(g.state.rematch,['B']);
assert.equal((await rpc('rematch',p)).version,g.version);
await assert.rejects(rpc('rematch',{...p,version:g.version,request_id:crypto.randomUUID()}),/already/);
await user(A);p={kind:'four',version:g.version,request_id:crypto.randomUUID()};g=await rpc('rematch',p);assert.equal(g.state.round,2);assert.equal(g.state.turn,'B');
assert.equal((await rpc('rematch',p)).version,g.version);
await assert.rejects(rpc('rematch',{kind:'four',version:g.version,request_id:crypto.randomUUID()}),/Finish/);
// Vertical win, invalid full column, and diagonal win, each from a controlled persisted board.
let board=Array(42).fill('');for(const i of [35,28,21])board[i]='A';
g=await fixture(g,{board,turn:'A'});g=await move(g,0);assert.equal(g.state.result,'A');
board=Array(42).fill('');for(let r=0;r<6;r++)board[r*7]='B';
g=await fixture(g,{board,result:'',turn:'A'});await assert.rejects(move(g,0),/full/);
board=Array(42).fill('');for(const i of [35,29,23])board[i]='A';for(const i of [38,31,24])board[i]='B';
g=await fixture(g,{board,result:'',turn:'A'});g=await move(g,3);assert.equal(g.state.result,'A');
// A full board with no four-in-a-row is a draw.
board=Array.from({length:42},(_,i)=>['AABBAAB','BBAABBA'][Math.floor(i/7)%2][i%7]);board[0]='';g=await fixture(g,{board,result:'',turn:'A'});g=await move(g,0);assert.equal(g.state.result,'draw');
// Nim rules, negative/fractional/oversized moves, completion, and resume.
g=await get('pebbles');await assert.rejects(move(g,0,0),/Take/);await assert.rejects(move(g,0,-1),/Take/);await assert.rejects(move(g,0,4),/Take/);await assert.rejects(move(g,3,1),/Take/);
g=await move(g,2,7);await user(B);g=await move(g,1,5);await user(A);g=await move(g,0,3);assert.equal(g.state.result,'A');assert.deepEqual((await get('pebbles')).state.piles,[0,0,0]);
// An independent Reversi engine checks every board and legal move through a complete game.
function captures(b,i,s){if(b[i])return[];const out=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;let x=i%8+dx,y=Math.floor(i/8)+dy,line=[];while(x>=0&&x<8&&y>=0&&y<8&&b[y*8+x]&&b[y*8+x]!==s){line.push(y*8+x);x+=dx;y+=dy;}if(line.length&&x>=0&&x<8&&y>=0&&y<8&&b[y*8+x]===s)out.push(...line);}return out;}
function legal(b,s){return b.flatMap((_,i)=>captures(b,i,s).length?[i]:[]);}
g=await get('reversi');assert.deepEqual(g.legal,[19,26,37,44]);await assert.rejects(move(g,0),/capture/);await assert.rejects(move(g,27),/highlighted/);
let passed=false,turns=0;
while(!g.state.result){const s=g.state.turn;await user(s==='A'?A:B);assert.deepEqual(g.legal,legal(g.state.board,s));const i=g.legal[(turns*7)%g.legal.length];let expected=[...g.state.board];for(const j of captures(expected,i,s))expected[j]=s;expected[i]=s;
 const id=crypto.randomUUID(),args={kind:'reversi',index:i,version:g.version,request_id:id};g=await rpc('move',args);assert.deepEqual(g.state.board,expected);
 const replay=await rpc('move',args);assert.equal(replay.version,g.version);assert.deepEqual(replay.legal,g.legal);
 if(g.state.passed)passed=true;assert(++turns<=60);
}
const a=g.state.board.filter(x=>x==='A').length,b=g.state.board.filter(x=>x==='B').length;assert.equal(g.state.result,a>b?'A':b>a?'B':'draw');
// Force a no-move scenario: B must pass, A can capture the remaining empty square.
await user(A);board=Array(64).fill('A');board[0]='';board[1]='B';
g=await fixture(g,{board,turn:'B',result:''});assert.equal(g.state.turn,'A');assert.equal(g.state.passed,'B');assert.deepEqual(g.legal,[0]);g=await move(g,0);assert.equal(g.state.result,'A');assert(g.state.board.every(x=>x==='A'));
// A real move forces a pass, and retrying its request cannot replay the move.
board=Array(64).fill('A');board[0]='';board[7]='';board[1]='B';board[6]='B';g=await fixture(g,{board,turn:'A',result:''});const passArgs={kind:'reversi',index:0,version:g.version,request_id:crypto.randomUUID()};g=await rpc('move',passArgs);assert.equal(g.state.passed,'B');assert.equal(g.state.turn,'A');assert.deepEqual(g.legal,[7]);assert.equal((await rpc('move',passArgs)).version,g.version);
// Draw with no valid moves for either partner.
board=Array.from({length:64},(_,i)=>i%2?'A':'B');g=await fixture(g,{board,turn:'A',result:''});assert.equal(g.state.result,'draw');
// Outsiders cannot obtain another couple's board, even with forged identifiers.
await user(C);const outsiders=await rpc('list',{space_id:g.space_id,user_id:A});assert.deepEqual(outsiders,[]);const own=await rpc('get',{kind:'four',id:g.id,user_id:A});assert.notEqual(own.id,g.id);
await db.query('update nearly_spaces set partner_id=null where owner_id=$1',[A]);await user(B);await assert.rejects(get('four'),/Connect/);
await user(A);await assert.rejects(get('four'),/Connect/);
await db.query('update nearly_spaces set partner_id=$1 where owner_id=$2',[D,A]);const fresh=await get('four');assert.equal(fresh.version,0);assert(fresh.state.board.every(x=>!x));
await db.exec('set role anon');await assert.rejects(rpc('list'),/permission denied/);await db.exec('reset role');
console.log(`Async games passed: authenticated access, isolation, former-partner separation, durable resume, stale writes, retries, turn rules, Four in a Row wins, full columns, Nim validation, mutual rematches, alternating starters, and ${turns}-move Reversi simulation including automatic pass and draw.`);
await db.close();
