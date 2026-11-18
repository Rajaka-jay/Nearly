-- Partner-only, short-lived WebRTC signaling. Audio/video never enter Postgres.
create schema if not exists nearly_private;
revoke all on schema nearly_private from public, anon;
grant usage on schema nearly_private to authenticated;

create table public.nearly_calls (
 id uuid primary key default gen_random_uuid(),
 space_id uuid not null references public.nearly_spaces(id) on delete cascade,
 caller_id uuid not null references auth.users(id) on delete cascade,
 callee_id uuid not null references auth.users(id) on delete cascade,
 caller_device uuid not null,
 callee_device uuid,
 status text not null default 'ringing' check(status in ('ringing','connecting','active','ended')),
 offer jsonb,
 answer jsonb,
 caller_candidates jsonb not null default '[]',
 callee_candidates jsonb not null default '[]',
 end_reason text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '60 seconds',
 check(caller_id<>callee_id)
);
create unique index nearly_calls_one_live on public.nearly_calls(space_id) where status<>'ended';
create index nearly_calls_space_recent on public.nearly_calls(space_id,created_at desc);
create index nearly_calls_caller on public.nearly_calls(caller_id);
create index nearly_calls_callee on public.nearly_calls(callee_id);
alter table public.nearly_calls enable row level security;
revoke all on public.nearly_calls from public,anon,authenticated;
grant select on public.nearly_calls to authenticated;

create function nearly_private.can_read_call(target_space uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
  select 1 from public.nearly_spaces s where s.id=target_space
   and s.partner_id is not null and (s.owner_id=auth.uid() or s.partner_id=auth.uid())
 );
$$;
revoke all on function nearly_private.can_read_call(uuid) from public,anon;
grant execute on function nearly_private.can_read_call(uuid) to authenticated;
create policy nearly_calls_partner_read on public.nearly_calls for select to authenticated
 using (nearly_private.can_read_call(space_id) and (caller_id=(select auth.uid()) or callee_id=(select auth.uid())));

create function public.nearly_call(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); s public.nearly_spaces; c public.nearly_calls;
 device uuid; mine boolean; candidates jsonb; reason text;
begin
 if u is null then raise exception 'Sign in to call your partner'; end if;
 select * into s from public.nearly_spaces where owner_id=u or partner_id=u;
 if s.id is null or s.partner_id is null then
  if action='get' then return jsonb_build_object('user_id',u,'paired',false,'call',null); end if;
  raise exception 'Connect with your partner before starting a call';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('nearly-call:'||s.id::text,0));
 -- Recheck membership after acquiring the lock. Every signaling write checks the pair.
 select * into s from public.nearly_spaces where id=s.id and partner_id is not null and (owner_id=u or partner_id=u) for share;
 if s.id is null then raise exception 'Your couple connection changed'; end if;
 update public.nearly_calls set status='ended',end_reason='timeout',offer=null,answer=null,
  caller_candidates='[]',callee_candidates='[]',updated_at=now()
  where space_id=s.id and status<>'ended' and expires_at<=now();
 delete from public.nearly_calls where space_id=s.id and status='ended' and updated_at<now()-interval '1 day';
 if action='get' then
  select * into c from public.nearly_calls where space_id=s.id and (caller_id=u or callee_id=u)
   and ((caller_id=s.owner_id and callee_id=s.partner_id) or (callee_id=s.owner_id and caller_id=s.partner_id))
   order by created_at desc limit 1;
  return jsonb_build_object('user_id',u,'paired',true,'space_id',s.id,'call',case when c.id is null then null else to_jsonb(c) end);
 end if;
 device:=(payload->>'device')::uuid;
 if device is null then raise exception 'Call device is required'; end if;
 if action='start' then
  if jsonb_typeof(payload->'description') is distinct from 'object' or payload->'description'->>'type' is distinct from 'offer'
   or coalesce(length(payload->'description'->>'sdp'),0) not between 10 and 64000 then raise exception 'Invalid call offer'; end if;
  if exists(select 1 from public.nearly_calls where space_id=s.id and status<>'ended') then raise exception 'A call is already in progress. Answer it or wait for it to end.'; end if;
  if exists(select 1 from public.nearly_calls where space_id=s.id and caller_id=u and created_at>now()-interval '5 seconds') then raise exception 'Please wait a moment before calling again'; end if;
  insert into public.nearly_calls(space_id,caller_id,callee_id,caller_device,offer)
   values(s.id,u,case when s.owner_id=u then s.partner_id else s.owner_id end,device,payload->'description') returning * into c;
  return to_jsonb(c);
 end if;
 select * into c from public.nearly_calls where id=(payload->>'id')::uuid and space_id=s.id
  and ((caller_id=s.owner_id and callee_id=s.partner_id) or (callee_id=s.owner_id and caller_id=s.partner_id)) for update;
 if c.id is null then raise exception 'This call is no longer available'; end if;
 if c.status='ended' then
  if action='end' then return to_jsonb(c); end if;
  raise exception 'This call has already ended';
 end if;
 mine:=c.caller_id=u;
 if action='answer' then
  if mine or c.status<>'ringing' then raise exception 'This call has already been answered'; end if;
  if jsonb_typeof(payload->'description') is distinct from 'object' or payload->'description'->>'type' is distinct from 'answer'
   or coalesce(length(payload->'description'->>'sdp'),0) not between 10 and 64000 then raise exception 'Invalid call answer'; end if;
  update public.nearly_calls set answer=payload->'description',callee_device=device,status='connecting',updated_at=now(),expires_at=now()+interval '60 seconds' where id=c.id returning * into c;
  return to_jsonb(c);
 end if;
 if (mine and c.caller_device<>device) or (not mine and c.callee_device is distinct from device and not(action='end' and c.status='ringing')) then
  raise exception 'This call is open on another device';
 end if;
 if action='ice' then
  if jsonb_typeof(payload->'candidate') is distinct from 'object' or coalesce(length(payload->'candidate'->>'candidate'),0) not between 1 and 4096
   or octet_length((payload->'candidate')::text)>6000 then raise exception 'Invalid network candidate'; end if;
  candidates:=case when mine then c.caller_candidates else c.callee_candidates end;
  if not candidates @> jsonb_build_array(payload->'candidate') then
   if jsonb_array_length(candidates)>=128 then raise exception 'Too many network candidates'; end if;
   candidates:=candidates||jsonb_build_array(payload->'candidate');
   update public.nearly_calls set caller_candidates=case when mine then candidates else caller_candidates end,
    callee_candidates=case when mine then callee_candidates else candidates end,updated_at=now() where id=c.id returning * into c;
  end if;
 elsif action in ('active','heartbeat') then
  if c.status not in ('connecting','active') then raise exception 'The call has not been answered yet'; end if;
  update public.nearly_calls set status=case when action='active' then 'active' else status end,
   expires_at=now()+interval '60 seconds',updated_at=now() where id=c.id returning * into c;
 elsif action='end' then
  reason:=payload->>'reason';
  if reason is null or reason not in ('hangup','declined','cancelled','failed','unavailable') then reason:='hangup'; end if;
  update public.nearly_calls set status='ended',end_reason=reason,offer=null,answer=null,
   caller_candidates='[]',callee_candidates='[]',updated_at=now(),expires_at=now() where id=c.id returning * into c;
 else raise exception 'Unknown call action'; end if;
 return to_jsonb(c);
end $$;
revoke all on function public.nearly_call(text,jsonb) from public,anon;
grant execute on function public.nearly_call(text,jsonb) to authenticated;
-- Realtime is a fast notification path; clients also poll to recover dropped events.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(
  select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='nearly_calls'
 ) then alter publication supabase_realtime add table public.nearly_calls; end if;
end $$;
