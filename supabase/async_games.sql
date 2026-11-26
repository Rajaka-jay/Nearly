-- Durable, partner-only asynchronous games. Existing games and space data are untouched.
begin;
create table public.nearly_async_games (
 id uuid primary key default gen_random_uuid(),
 space_id uuid not null references public.nearly_spaces(id) on delete cascade,
 member_a uuid not null references auth.users(id) on delete cascade,
 member_b uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('four','reversi','pebbles')),
 state jsonb not null, version integer not null default 0,
 updated_at timestamptz not null default now(),
 unique(space_id,member_a,member_b,kind), check(member_a<>member_b)
);
create table public.nearly_async_receipts (
 game_id uuid not null references public.nearly_async_games(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null, primary key(game_id,user_id,request_id)
);
alter table public.nearly_async_games enable row level security;
alter table public.nearly_async_receipts enable row level security;
-- Deliberate RPC-only access: no client can edit a board, winner, or seat directly.
revoke all on public.nearly_async_games,public.nearly_async_receipts from public,anon,authenticated;

create or replace function public.nearly_async(action text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); s public.nearly_spaces; g public.nearly_async_games;
 k text:=payload->>'kind'; seat text; other text; n jsonb; b jsonb; initial jsonb;
 idx integer; col integer; row_i integer; x integer; y integer; dx integer; dy integer;
 xx integer; yy integer; count_i integer; total integer; a_count integer; b_count integer;
 cells integer[]; captured integer[]; candidate integer; test_seat text; possible boolean;
 a_can boolean:=false; b_can boolean:=false; legal jsonb:='[]'; request uuid;
 votes jsonb; starter text; round_i integer;
begin
 if u is null then raise exception 'Sign in to play with your partner'; end if;
 if action is null or action not in ('list','get','move','rematch') then raise exception 'Unknown game action'; end if;
 select * into s from public.nearly_spaces where owner_id=u or partner_id=u for update;
 if s.id is null or s.partner_id is null then raise exception 'Connect with your partner before playing'; end if;
 seat:=case when s.owner_id=u then 'A' else 'B' end;
 other:=case when seat='A' then 'B' else 'A' end;
 if action='list' then
  return coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'version',version,'state',state,'updated_at',updated_at,'seat',seat)) from public.nearly_async_games where space_id=s.id and member_a=s.owner_id and member_b=s.partner_id),'[]'::jsonb);
 end if;
 if k is null or k not in ('four','reversi','pebbles') then raise exception 'Choose a supported game'; end if;
 select * into g from public.nearly_async_games where space_id=s.id and member_a=s.owner_id and member_b=s.partner_id and kind=k for update;
 if g.id is null and action<>'get' then raise exception 'Open this game first'; end if;
 if g.id is not null and action<>'get' then
  request:=(payload->>'request_id')::uuid;
  if request is null then raise exception 'A request ID is required'; end if;
  if exists(select 1 from public.nearly_async_receipts where game_id=g.id and user_id=u and request_id=request) then
   action:='get';
  end if;
  if action<>'get' and (payload->>'version' is null or (payload->>'version')::integer<>g.version) then raise exception 'STALE: the board changed. Your latest board has been loaded; choose your move again'; end if;
 end if;
 if g.id is null or (action='rematch' and (g.state->'rematch') ? other) then
  if action='rematch' and g.state->>'result'='' then raise exception 'Finish this round before starting another'; end if;
  round_i:=coalesce((g.state->>'round')::integer,0)+1;
  starter:=case when round_i%2=1 then 'A' else 'B' end;
  select jsonb_agg(''::text) into b from generate_series(1,case when k='four' then 42 else 64 end);
  if k='reversi' then
   b:=jsonb_set(jsonb_set(jsonb_set(jsonb_set(b,'{27}','"B"'),'{28}','"A"'),'{35}','"A"'),'{36}','"B"');
  end if;
  n:=jsonb_build_object('board',b,'piles','[3,5,7]'::jsonb,'turn',starter,'starter',starter,'round',round_i,'result','','rematch','[]'::jsonb,'last_move',null,'passed',null);
  if g.id is null then
   insert into public.nearly_async_games(space_id,member_a,member_b,kind,state) values(s.id,s.owner_id,s.partner_id,k,n) returning * into g;
  else
   update public.nearly_async_games set state=n,version=version+1,updated_at=now() where id=g.id returning * into g;
  end if;
 elsif action='rematch' then
  if g.state->>'result'='' then raise exception 'Finish this round before starting another'; end if;
  votes:=g.state->'rematch';
  if votes ? seat then raise exception 'You already asked for another round. Waiting for your partner'; end if;
  update public.nearly_async_games set state=jsonb_set(state,'{rematch}',votes||to_jsonb(seat)),version=version+1,updated_at=now() where id=g.id returning * into g;
 elsif action='move' then
  if g.state->>'result'<>'' then raise exception 'This round is finished'; end if;
  if g.state->>'turn'<>seat then raise exception 'It is your partner’s turn'; end if;
  idx:=(payload->>'index')::integer;
  n:=g.state; b:=n->'board';
  if k='four' then
   if idx is null or idx<0 or idx>6 then raise exception 'Choose a column from 1 to 7'; end if;
   row_i:=5;
   while row_i>=0 and b->>(row_i*7+idx)<>'' loop row_i:=row_i-1; end loop;
   if row_i<0 then raise exception 'That column is full'; end if;
   col:=idx; idx:=row_i*7+col; b:=jsonb_set(b,array[idx::text],to_jsonb(seat));
   for candidate in 1..4 loop
    dx:=case candidate when 1 then 1 when 2 then 0 else 1 end;
    dy:=case candidate when 1 then 0 when 4 then -1 else 1 end;
    count_i:=1;
    for test_seat in select unnest(array['1','-1']) loop
     xx:=col+dx*test_seat::integer; yy:=row_i+dy*test_seat::integer;
     while xx between 0 and 6 and yy between 0 and 5 loop
      exit when b->>(yy*7+xx)<>seat;
      count_i:=count_i+1; xx:=xx+dx*test_seat::integer; yy:=yy+dy*test_seat::integer;
     end loop;
    end loop;
    if count_i>=4 then n:=jsonb_set(n,'{result}',to_jsonb(seat)); end if;
   end loop;
   if n->>'result'='' and not exists(select 1 from jsonb_array_elements_text(b) v where v='') then n:=jsonb_set(n,'{result}','"draw"'); end if;
  elsif k='pebbles' then
   count_i:=(payload->>'count')::integer;
   if idx is null or idx<0 or idx>2 or count_i is null or count_i<1 or count_i>(n->'piles'->>idx)::integer then raise exception 'Take one or more pebbles from one nonempty pile'; end if;
   n:=jsonb_set(n,array['piles',idx::text],to_jsonb((n->'piles'->>idx)::integer-count_i));
   select sum(value::integer) into total from jsonb_array_elements_text(n->'piles');
   if total=0 then n:=jsonb_set(n,'{result}',to_jsonb(seat)); end if;
  elsif k='reversi' then
   if idx is null or idx<0 or idx>63 or b->>idx<>'' then raise exception 'Choose a highlighted empty square'; end if;
   x:=idx%8; y:=idx/8; captured:=array[]::integer[];
   for dx in -1..1 loop for dy in -1..1 loop
    if dx=0 and dy=0 then continue; end if;
    xx:=x+dx; yy:=y+dy; cells:=array[]::integer[];
    while xx between 0 and 7 and yy between 0 and 7 loop
     exit when b->>(yy*8+xx)<>other;
     cells:=array_append(cells,yy*8+xx); xx:=xx+dx; yy:=yy+dy;
    end loop;
    if cardinality(cells)>0 and xx between 0 and 7 and yy between 0 and 7 and b->>(yy*8+xx)=seat then captured:=captured||cells; end if;
   end loop; end loop;
   if cardinality(captured)=0 then raise exception 'That move does not capture a line'; end if;
   b:=jsonb_set(b,array[idx::text],to_jsonb(seat));
   foreach candidate in array captured loop b:=jsonb_set(b,array[candidate::text],to_jsonb(seat)); end loop;
  end if;
  n:=jsonb_set(jsonb_set(jsonb_set(n,'{board}',b),'{turn}',to_jsonb(other)),'{last_move}',to_jsonb(idx));
  n:=jsonb_set(n,'{passed}','null'::jsonb);
  update public.nearly_async_games set state=n,version=version+1,updated_at=now() where id=g.id returning * into g;
 end if;
 -- Reversi legal moves and automatic pass/end are computed on the server for both seats.
 if k='reversi' then
  b:=g.state->'board';
  for test_seat in select unnest(array['A','B']) loop
   possible:=false;
   for candidate in 0..63 loop
    if b->>candidate<>'' then continue; end if;
    x:=candidate%8; y:=candidate/8; captured:=array[]::integer[];
    for dx in -1..1 loop for dy in -1..1 loop
     if dx=0 and dy=0 then continue; end if;
     xx:=x+dx; yy:=y+dy; count_i:=0;
     while xx between 0 and 7 and yy between 0 and 7 loop
      exit when b->>(yy*8+xx)<>case when test_seat='A' then 'B' else 'A' end;
      count_i:=count_i+1; xx:=xx+dx; yy:=yy+dy;
     end loop;
     if count_i>0 and xx between 0 and 7 and yy between 0 and 7 and b->>(yy*8+xx)=test_seat then possible:=true; captured:=array_append(captured,candidate); end if;
    end loop; end loop;
    if cardinality(captured)>0 and test_seat=g.state->>'turn' then legal:=legal||to_jsonb(candidate); end if;
   end loop;
   if test_seat='A' then a_can:=possible; else b_can:=possible; end if;
  end loop;
  if g.state->>'result'='' and (not a_can and not b_can) then
   select count(*) filter(where value='A'),count(*) filter(where value='B') into a_count,b_count from jsonb_array_elements_text(b);
   update public.nearly_async_games set state=jsonb_set(state,'{result}',to_jsonb(case when a_count>b_count then 'A' when b_count>a_count then 'B' else 'draw' end)) where id=g.id returning * into g;
  elsif g.state->>'result'='' and ((g.state->>'turn'='A' and not a_can) or (g.state->>'turn'='B' and not b_can)) then
   -- Derive the passing seat; the caller is never trusted to pass a turn.
   n:=jsonb_set(jsonb_set(g.state,'{passed}',g.state->'turn'),'{turn}',to_jsonb(case when g.state->>'turn'='A' then 'B' else 'A' end));
   update public.nearly_async_games set state=n where id=g.id returning * into g;
   -- Re-enter the read-only board derivation after the forced pass.
   if action='move' then insert into public.nearly_async_receipts values(g.id,u,request); end if;
   return public.nearly_async('get',jsonb_build_object('kind',k));
  end if;
 end if;
 if action in ('move','rematch') then insert into public.nearly_async_receipts values(g.id,u,request); end if;
 return jsonb_build_object('id',g.id,'kind',g.kind,'state',g.state,'legal',legal,'version',g.version,'seat',seat,'updated_at',g.updated_at);
end $$;
revoke all on function public.nearly_async(text,jsonb) from public,anon;
grant execute on function public.nearly_async(text,jsonb) to authenticated;
commit;
