create table public.nearly_spaces (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 partner_id uuid references auth.users(id),
 invite uuid unique default gen_random_uuid(),
 expires_at timestamptz not null default now()+interval '7 days',
 data jsonb not null default '{}'::jsonb,
 revision integer not null default 0,
 check(owner_id is distinct from partner_id)
);
alter table public.nearly_spaces enable row level security;
revoke all on public.nearly_spaces from anon, authenticated;
create function public.nearly_action(action text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); s public.nearly_spaces; target public.nearly_spaces;
begin
 if u is null then raise exception 'Sign in first'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 select * into s from public.nearly_spaces where owner_id=u or partner_id=u for update;
 if action='create' then
  if s.id is null then insert into public.nearly_spaces(owner_id) values(u) returning * into s; end if;
 elsif action='join' then
  if s.id is not null then raise exception 'You already belong to a space'; end if;
  select * into target from public.nearly_spaces where invite=(payload->>'code')::uuid for update;
  if target.id is null or target.partner_id is not null or target.expires_at<now() or target.owner_id=u then raise exception 'Invitation is unavailable or expired'; end if;
  update public.nearly_spaces set partner_id=u,invite=null where id=target.id returning * into s;
 elsif action='save' then
  if s.id is null then raise exception 'Join a space first'; end if;
  if s.revision<>(payload->>'revision')::integer then raise exception 'CONFLICT: your partner updated this space. Refresh and retry your change.'; end if;
  if jsonb_typeof(payload->'data') <> 'object' or octet_length((payload->'data')::text)>8000000 then raise exception 'Space is too large. Export and remove a photo.'; end if;
  update public.nearly_spaces set data=payload->'data',revision=revision+1 where id=s.id returning * into s;
 elsif action='invite' then
  if s.owner_id<>u or s.partner_id is not null then raise exception 'Invitation unavailable'; end if;
  update public.nearly_spaces set invite=gen_random_uuid(),expires_at=now()+interval '7 days' where id=s.id returning * into s;
 elsif action='leave' then
  if s.owner_id=u then
   if s.partner_id is null then delete from public.nearly_spaces where id=s.id;
   else update public.nearly_spaces set owner_id=s.partner_id,partner_id=null,invite=null where id=s.id; end if;
  else update public.nearly_spaces set partner_id=null,invite=null where id=s.id; end if;
  return 'null'::jsonb;
 elsif action<>'get' then raise exception 'Unknown action'; end if;
 if s.id is null then return 'null'::jsonb; end if;
 return jsonb_build_object('id',s.id,'data',s.data,'revision',s.revision,'paired',s.partner_id is not null,'owner',s.owner_id=u,'invite',case when s.owner_id=u then s.invite else null end);
end $$;
revoke all on function public.nearly_action(text,jsonb) from public, anon;
grant execute on function public.nearly_action(text,jsonb) to authenticated;
