-- Additive migration. Existing nearly_spaces records and activities are retained.
begin;
create table if not exists public.nearly_game_sessions (
 id uuid primary key default gen_random_uuid(),
 space_id uuid not null references public.nearly_spaces(id) on delete cascade,
 kind text not null check (kind in ('ttt','match')),
 state jsonb not null,
 version integer not null default 0,
 updated_at timestamptz not null default now(),
 unique(space_id,kind)
);
create table if not exists public.nearly_game_receipts (
 user_id uuid not null references auth.users(id),
 request_id uuid not null,
 session_id uuid not null references public.nearly_game_sessions(id) on delete cascade,
 primary key(user_id,request_id)
);
alter table public.nearly_game_sessions enable row level security;
alter table public.nearly_game_receipts enable row level security;
revoke all on public.nearly_game_sessions,public.nearly_game_receipts from anon,authenticated;

create or replace function public.nearly_game(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); s public.nearly_spaces; g public.nearly_game_sessions;
 game_kind text:=payload->>'kind'; seat text; next_state jsonb;
 move_index integer; open_cards jsonb; matched_cards jsonb; symbol text;
 pair integer[]; wins integer[][]:=array[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
 request uuid; cards jsonb; visible_state jsonb;
begin
 if u is null then raise exception 'Sign in first'; end if;
 if game_kind is null or game_kind not in ('ttt','match') then raise exception 'Unsupported game'; end if;
 select * into s from public.nearly_spaces where owner_id=u or partner_id=u for update;
 if s.id is null then raise exception 'Join a space first'; end if;
 if s.partner_id is null then raise exception 'Invite your partner before starting a shared game'; end if;
 seat:=case when s.owner_id=u then 'A' else 'B' end;
 select * into g from public.nearly_game_sessions where space_id=s.id and kind=game_kind for update;
 if g.id is null or action='reset' then
  if action not in ('get','reset') then raise exception 'Open the game first'; end if;
  select jsonb_agg(value order by random()) into cards from jsonb_array_elements('["🌷","🌙","☕","💌","🌷","🌙","☕","💌"]'::jsonb);
  next_state:=jsonb_build_object('id',game_kind,'turn','A','board','["","","","","","","","",""]'::jsonb,'cards',cards,'open','[]'::jsonb,'matched','[]'::jsonb,'result','');
  if g.id is null then
   insert into public.nearly_game_sessions(space_id,kind,state) values(s.id,game_kind,next_state) returning * into g;
  else
   if payload->>'version' is null or (payload->>'version')::integer<>g.version then raise exception 'STALE: refresh before starting another round'; end if;
   update public.nearly_game_sessions set state=next_state,version=version+1,updated_at=now() where id=g.id returning * into g;
  end if;
 elsif action<>'get' then
  request:=(payload->>'request_id')::uuid;
  if request is null then raise exception 'Request ID required'; end if;
  if exists(select 1 from public.nearly_game_receipts where user_id=u and request_id=request and session_id=g.id) then
   visible_state:=g.state;
   if game_kind='match' then
    select jsonb_agg(case when (g.state->'open') @> to_jsonb(array[(ordinality-1)::integer]) or (g.state->'matched') @> to_jsonb(array[(ordinality-1)::integer]) then value else '"?"'::jsonb end order by ordinality) into cards from jsonb_array_elements(g.state->'cards') with ordinality;
    visible_state:=jsonb_set(visible_state,'{cards}',cards);
   end if;
   return jsonb_build_object('id',g.id,'kind',g.kind,'state',visible_state,'version',g.version);
  end if;
  if payload->>'version' is null or (payload->>'version')::integer<>g.version then raise exception 'STALE: the game changed. Refresh and retry your move'; end if;
  if g.state->>'turn'<>seat then raise exception 'Wait for your turn'; end if;
  if g.state->>'result'<>'' then raise exception 'This round has finished'; end if;
  next_state:=g.state;
  if game_kind='ttt' and action='move' then
   move_index:=(payload->>'index')::integer;
   if move_index is null or move_index<0 or move_index>8 or g.state->'board'->>move_index<>'' then raise exception 'Choose an empty square'; end if;
   symbol:=case when seat='A' then 'X' else 'O' end;
   next_state:=jsonb_set(next_state,array['board',move_index::text],to_jsonb(symbol));
   foreach pair slice 1 in array wins loop
    if next_state->'board'->>pair[1]=symbol and next_state->'board'->>pair[2]=symbol and next_state->'board'->>pair[3]=symbol then
     next_state:=jsonb_set(next_state,'{result}',to_jsonb(symbol||' wins!'));
    end if;
   end loop;
   if next_state->>'result'='' and not exists(select 1 from jsonb_array_elements_text(next_state->'board') v where v='') then next_state:=jsonb_set(next_state,'{result}','"A lovely little draw."'); end if;
   next_state:=jsonb_set(next_state,'{turn}',to_jsonb(case when seat='A' then 'B' else 'A' end));
  elsif game_kind='match' and action='flip' then
   move_index:=(payload->>'index')::integer;open_cards:=next_state->'open';matched_cards:=next_state->'matched';
   if move_index is null or move_index<0 or move_index>7 or jsonb_array_length(open_cards)=2 or open_cards @> to_jsonb(array[move_index]) or matched_cards @> to_jsonb(array[move_index]) then raise exception 'Choose a hidden card'; end if;
   open_cards:=open_cards||to_jsonb(move_index);
   if jsonb_array_length(open_cards)=2 and next_state->'cards'->>((open_cards->>0)::integer)=next_state->'cards'->>((open_cards->>1)::integer) then
    matched_cards:=matched_cards||open_cards;open_cards:='[]'::jsonb;
    if jsonb_array_length(matched_cards)=8 then next_state:=jsonb_set(next_state,'{result}','"Every pair found together."'); end if;
   end if;
   next_state:=jsonb_set(jsonb_set(next_state,'{open}',open_cards),'{matched}',matched_cards);
  elsif game_kind='match' and action='next' then
   if jsonb_array_length(next_state->'open')<>2 then raise exception 'Finish revealing two cards first'; end if;
   next_state:=jsonb_set(jsonb_set(next_state,'{open}','[]'::jsonb),'{turn}',to_jsonb(case when seat='A' then 'B' else 'A' end));
  else raise exception 'Unsupported game action'; end if;
  update public.nearly_game_sessions set state=next_state,version=version+1,updated_at=now() where id=g.id returning * into g;
  insert into public.nearly_game_receipts(user_id,request_id,session_id) values(u,request,g.id);
 end if;
 visible_state:=g.state;
   if game_kind='match' then
    select jsonb_agg(case when (g.state->'open') @> to_jsonb(array[(ordinality-1)::integer]) or (g.state->'matched') @> to_jsonb(array[(ordinality-1)::integer]) then value else '"?"'::jsonb end order by ordinality) into cards from jsonb_array_elements(g.state->'cards') with ordinality;
    visible_state:=jsonb_set(visible_state,'{cards}',cards);
   end if;
   return jsonb_build_object('id',g.id,'kind',g.kind,'state',visible_state,'version',g.version);
end $$;
revoke all on function public.nearly_game(text,jsonb) from public,anon;
grant execute on function public.nearly_game(text,jsonb) to authenticated;
commit;
