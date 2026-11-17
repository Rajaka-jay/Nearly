import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.user',true),'')::uuid $$;`);
await db.exec(await fs.readFile(new URL('../supabase/setup.sql',import.meta.url),'utf8'));
await db.exec(await fs.readFile(new URL('../supabase/migrations/20261118_game_sessions.sql',import.meta.url),'utf8'));
const A='00000000-0000-0000-0000-000000000001',B='00000000-0000-0000-0000-000000000002',C='00000000-0000-0000-0000-000000000003';
await db.query('insert into auth.users(id) values($1),($2),($3)',[A,B,C]);
await db.query('insert into public.nearly_spaces(owner_id,partner_id) values($1,$2)',[A,B]);
async function user(id){await db.query("select set_config('app.user',$1,false)",[id]);}
async function game(action,payload){return (await db.query('select public.nearly_game($1,$2::jsonb) as result',[action,JSON.stringify(payload)])).rows[0].result;}
await user(A);let g=await game('get',{kind:'ttt'});assert.equal(g.state.turn,'A');
let request=crypto.randomUUID();g=await game('move',{kind:'ttt',version:g.version,index:0,request_id:request});assert.equal(g.state.board[0],'X');
const version=g.version;g=await game('move',{kind:'ttt',version:0,index:0,request_id:request});assert.equal(g.version,version);
await assert.rejects(game('move',{kind:'ttt',version:g.version,index:1,request_id:crypto.randomUUID()}),/Wait for your turn/);
await user(B);await assert.rejects(game('move',{kind:'ttt',version:0,index:1,request_id:crypto.randomUUID()}),/STALE/);
for(const [id,index] of [[B,3],[A,1],[B,4],[A,2]]){await user(id);g=await game('move',{kind:'ttt',version:g.version,index,request_id:crypto.randomUUID()});}
assert.equal(g.state.result,'X wins!');
await user(B);await assert.rejects(game('move',{kind:'ttt',version:g.version,index:8,request_id:crypto.randomUUID()}),/finished/);
await user(C);await assert.rejects(game('get',{kind:'ttt'}),/Join a space/);
await user(A);g=await game('get',{kind:'match'});assert.equal(g.state.cards.length,8);assert(g.state.cards.every(v=>v==='?'));const stored=(await db.query("select state from public.nearly_game_sessions where kind='match'")).rows[0].state;const first=stored.cards[0],pair=stored.cards.findIndex((v,i)=>i>0&&v===first);
g=await game('flip',{kind:'match',version:g.version,index:0,request_id:crypto.randomUUID()});
await assert.rejects(game('flip',{kind:'match',version:g.version,index:0,request_id:crypto.randomUUID()}),/hidden card/);
g=await game('flip',{kind:'match',version:g.version,index:pair,request_id:crypto.randomUUID()});assert.equal(g.state.matched.length,2);assert.equal(g.state.open.length,0);
await db.exec('set role authenticated');
await assert.rejects(db.query('select * from public.nearly_game_sessions'),/permission denied/);
await db.exec('reset role');
console.log('SQL migration applied. Verified win detection, turn enforcement, stale versions, duplicate request idempotency, completed game lock, third-account rejection, matching pairs, and direct table access denial.');
await db.close();
