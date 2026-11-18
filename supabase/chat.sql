-- Nearly's authenticated two-person chat. No client-supplied author or space IDs.
create schema if not exists nearly_private;
revoke all on schema nearly_private from public,anon;
grant usage on schema nearly_private to authenticated;
create table public.nearly_chat_messages(
 id uuid primary key default gen_random_uuid(), seq bigint generated always as identity unique,
 space_id uuid not null references public.nearly_spaces(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null, body text not null check(length(body)<=4000),
 reply_to uuid references public.nearly_chat_messages(id),
 created_at timestamptz not null default now(), deleted_at timestamptz,
 check(sender_id<>recipient_id), unique(sender_id,request_id)
);
create index nearly_chat_space_seq on public.nearly_chat_messages(space_id,seq desc);
create index nearly_chat_sender on public.nearly_chat_messages(sender_id);
create index nearly_chat_recipient on public.nearly_chat_messages(recipient_id);
create index nearly_chat_reply on public.nearly_chat_messages(reply_to);
create table public.nearly_chat_preferences(
 space_id uuid not null references public.nearly_spaces(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 peer_id uuid not null references auth.users(id) on delete cascade,
 cleared_seq bigint not null default 0, previous_clear_seq bigint not null default 0,
 hide_legacy boolean not null default false, read_seq bigint not null default 0,
 typing_until timestamptz, primary key(space_id,user_id,peer_id)
);
create index nearly_chat_preferences_user on public.nearly_chat_preferences(user_id);
create index nearly_chat_preferences_peer on public.nearly_chat_preferences(peer_id);
create table public.nearly_chat_hidden(
 message_id uuid not null references public.nearly_chat_messages(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 primary key(message_id,user_id)
);
create index nearly_chat_hidden_user on public.nearly_chat_hidden(user_id);
create function nearly_private.chat_member(room uuid,a uuid,b uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and auth.uid() in (a,b) and exists(
  select 1 from public.nearly_spaces s where s.id=room and s.partner_id is not null
   and ((s.owner_id=a and s.partner_id=b) or (s.owner_id=b and s.partner_id=a))
 );
$$;
revoke all on function nearly_private.chat_member(uuid,uuid,uuid) from public,anon;
grant execute on function nearly_private.chat_member(uuid,uuid,uuid) to authenticated;
alter table public.nearly_chat_messages enable row level security;
alter table public.nearly_chat_preferences enable row level security;
alter table public.nearly_chat_hidden enable row level security;
revoke all on public.nearly_chat_messages,public.nearly_chat_preferences,public.nearly_chat_hidden from public,anon,authenticated;
grant select on public.nearly_chat_messages,public.nearly_chat_preferences,public.nearly_chat_hidden to authenticated;
create policy chat_pair_read on public.nearly_chat_messages for select to authenticated using(nearly_private.chat_member(space_id,sender_id,recipient_id));
create policy chat_preferences_read on public.nearly_chat_preferences for select to authenticated using(user_id=(select auth.uid()) and nearly_private.chat_member(space_id,user_id,peer_id));
create policy chat_hidden_read on public.nearly_chat_hidden for select to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.nearly_chat_messages m where m.id=message_id));

create function public.nearly_chat(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); s public.nearly_spaces; peer uuid; pref public.nearly_chat_preferences;
 m public.nearly_chat_messages; target uuid; body_text text; before_seq bigint; upto bigint;
 rows_json jsonb; hidden_json jsonb; peer_read bigint; typing boolean; ids uuid[];
begin
 if u is null then raise exception 'Sign in to chat'; end if;
 select * into s from public.nearly_spaces where owner_id=u or partner_id=u for share;
 if s.id is null or s.partner_id is null then
  if action='get' then return jsonb_build_object('paired',false,'user_id',u,'messages','[]'::jsonb);end if;
  raise exception 'Connect your accounts before chatting';
 end if;
 peer:=case when s.owner_id=u then s.partner_id else s.owner_id end;
 perform pg_advisory_xact_lock(hashtextextended('nearly-chat:'||s.id::text,0));
 insert into public.nearly_chat_preferences(space_id,user_id,peer_id) values(s.id,u,peer) on conflict do nothing;
 select * into pref from public.nearly_chat_preferences where space_id=s.id and user_id=u and peer_id=peer for update;
 if action='send' then
  body_text:=btrim(payload->>'body',E' \t\n\r');
  if body_text is null or length(body_text) not between 1 and 4000 then raise exception 'Write a message between 1 and 4000 characters'; end if;
  if payload->>'request_id' is null then raise exception 'Message request ID is required'; end if;
  select * into m from public.nearly_chat_messages where sender_id=u and request_id=(payload->>'request_id')::uuid;
  if m.id is not null then
   if m.space_id<>s.id or m.recipient_id<>peer then raise exception 'Message belongs to another conversation'; end if;
   return to_jsonb(m);
  end if;
  target:=nullif(payload->>'reply_to','')::uuid;
  if target is not null and not exists(select 1 from public.nearly_chat_messages x where x.id=target and x.space_id=s.id and x.seq>pref.cleared_seq and x.deleted_at is null and ((x.sender_id=u and x.recipient_id=peer) or (x.sender_id=peer and x.recipient_id=u)) and not exists(select 1 from public.nearly_chat_hidden h where h.message_id=x.id and h.user_id=u)) then raise exception 'This reply is no longer available'; end if;
  insert into public.nearly_chat_messages(space_id,sender_id,recipient_id,request_id,body,reply_to)
   values(s.id,u,peer,(payload->>'request_id')::uuid,body_text,target) returning * into m;
  update public.nearly_chat_preferences set typing_until=null where space_id=s.id and user_id=u and peer_id=peer;
  return to_jsonb(m);
 elsif action in ('hide','unhide','delete_everyone') then
  select * into m from public.nearly_chat_messages where id=(payload->>'id')::uuid and space_id=s.id
   and ((sender_id=u and recipient_id=peer) or (sender_id=peer and recipient_id=u)) for update;
  if m.id is null then raise exception 'Message is unavailable'; end if;
  if action='delete_everyone' then
   if m.sender_id<>u then raise exception 'You can only delete your own messages for everyone'; end if;
   update public.nearly_chat_messages set body='',deleted_at=coalesce(deleted_at,now()) where id=m.id returning * into m;
  elsif action='hide' then insert into public.nearly_chat_hidden(message_id,user_id) values(m.id,u) on conflict do nothing;
  else delete from public.nearly_chat_hidden where message_id=m.id and user_id=u; end if;
  return to_jsonb(m);
 elsif action='clear' then
  -- The cutoff is the last message actually shown by the browser. Concurrent/new
  -- messages above it remain visible, even if they arrive during confirmation.
  select coalesce(max(seq),0) into upto from public.nearly_chat_messages where space_id=s.id and seq<=coalesce((payload->>'upto')::bigint,0)
   and ((sender_id=u and recipient_id=peer) or (sender_id=peer and recipient_id=u));
  update public.nearly_chat_preferences set previous_clear_seq=cleared_seq,cleared_seq=greatest(cleared_seq,upto),hide_legacy=true where space_id=s.id and user_id=u and peer_id=peer returning * into pref;
  return to_jsonb(pref);
 elsif action='read' then
  select coalesce(max(seq),0) into upto from public.nearly_chat_messages where space_id=s.id and seq<=coalesce((payload->>'upto')::bigint,0)
   and ((sender_id=u and recipient_id=peer) or (sender_id=peer and recipient_id=u));
  if upto>pref.read_seq then update public.nearly_chat_preferences set read_seq=upto where space_id=s.id and user_id=u and peer_id=peer; end if;
  return jsonb_build_object('read_seq',greatest(upto,pref.read_seq));
 elsif action='typing' then
  update public.nearly_chat_preferences set typing_until=case when payload->>'active'='true' then now()+interval '5 seconds' else null end where space_id=s.id and user_id=u and peer_id=peer;
  return '{}'::jsonb;
 elsif action<>'get' then raise exception 'Unknown chat action'; end if;
 before_seq:=coalesce((payload->>'before')::bigint,9223372036854775807);
 if payload ? 'visible_ids' then
  if jsonb_typeof(payload->'visible_ids')<>'array' or jsonb_array_length(payload->'visible_ids')>500 then raise exception 'Too many visible messages'; end if;
  select array_agg(value::uuid) into ids from jsonb_array_elements_text(payload->'visible_ids');
 end if;
 select coalesce(jsonb_agg(message_id),'[]') into hidden_json from public.nearly_chat_hidden h join public.nearly_chat_messages x on x.id=h.message_id where h.user_id=u and x.space_id=s.id;
 with page_rows as (
  select x.* from public.nearly_chat_messages x where x.space_id=s.id and x.seq<before_seq and x.seq>pref.cleared_seq
   and ((x.sender_id=u and x.recipient_id=peer) or (x.sender_id=peer and x.recipient_id=u))
   and not exists(select 1 from public.nearly_chat_hidden h where h.message_id=x.id and h.user_id=u)
   order by x.seq desc limit 50
 ), visible_rows as (
  select x.* from public.nearly_chat_messages x where x.id=any(ids) and x.space_id=s.id and x.seq>pref.cleared_seq
   and ((x.sender_id=u and x.recipient_id=peer) or (x.sender_id=peer and x.recipient_id=u))
   and not exists(select 1 from public.nearly_chat_hidden h where h.message_id=x.id and h.user_id=u)
 ), combined as (select * from page_rows union select * from visible_rows)
 select coalesce(jsonb_agg(to_jsonb(c) order by seq),'[]') into rows_json from combined c;
 select read_seq,coalesce(typing_until>now(),false) into peer_read,typing from public.nearly_chat_preferences where space_id=s.id and user_id=peer and peer_id=u;
 return jsonb_build_object('paired',true,'user_id',u,'peer_id',peer,'space_id',s.id,'owner',s.owner_id=u,'messages',rows_json,'hidden_ids',hidden_json,'cleared_seq',pref.cleared_seq,'hide_legacy',pref.hide_legacy,'read_seq',pref.read_seq,'partner_read_seq',coalesce(peer_read,0),'typing',coalesce(typing,false));
end $$;
revoke all on function public.nearly_chat(text,jsonb) from public,anon;
grant execute on function public.nearly_chat(text,jsonb) to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.nearly_chat_messages,public.nearly_chat_preferences;
 end if;
end $$;
