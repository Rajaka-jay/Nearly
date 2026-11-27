-- Additive garden interaction API. Existing grove_action and records are unchanged.
create table public.grove_interactions (
 id uuid primary key default gen_random_uuid(),
 couple_id uuid not null references public.nearly_spaces(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 partner_id uuid not null references auth.users(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 interaction_type text not null check(interaction_type in ('cat','butterfly','bird','swing','bench','lantern','flowers','frame','blanket','cottage')),
 interaction_day date not null default (now() at time zone 'UTC')::date,
 reward_points integer not null default 0 check(reward_points between 0 and 1),
 created_at timestamptz not null default now(),
 unique(couple_id,owner_id,partner_id,user_id,interaction_type,interaction_day)
);
create unique index grove_one_visit_reward_daily on public.grove_interactions(couple_id,user_id,interaction_day) where reward_points>0;
create index grove_interactions_pair_history on public.grove_interactions(couple_id,owner_id,partner_id,created_at desc);
alter table public.grove_interactions enable row level security;
create policy grove_interaction_members on public.grove_interactions for select to authenticated
 using ((select auth.uid()) in (owner_id,partner_id) and public.grove_member(couple_id));
revoke all on public.grove_interactions from public,anon,authenticated;

-- Deliberate authenticated RPC: callers cannot write progress/tables directly.
create function public.grove_visit(kind text default null) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); s public.nearly_spaces; eid uuid; reward integer:=0;
 day date:=(now() at time zone 'UTC')::date; result jsonb;
begin
 if u is null then raise exception 'Sign in to enjoy your shared garden'; end if;
 select * into s from public.nearly_spaces where owner_id=u or partner_id=u for update;
 if s.id is null then raise exception 'Join your couple space first'; end if;
 if kind is not null then
  if kind not in ('cat','butterfly','bird','swing','bench','lantern','flowers','frame','blanket','cottage') then raise exception 'Unknown garden interaction'; end if;
  if s.partner_id is null then raise exception 'Connect your partner to save shared garden moments'; end if;
  -- Same space lock as grove_action serializes requests with all other rewards.
  insert into public.grove_state(couple_id) values(s.id) on conflict do nothing;
  if not exists(select 1 from public.grove_interactions where couple_id=s.id and user_id=u and interaction_day=day and reward_points>0) then reward:=1; end if;
  insert into public.grove_interactions(couple_id,owner_id,partner_id,user_id,interaction_type,interaction_day,reward_points)
   values(s.id,s.owner_id,s.partner_id,u,kind,day,reward)
   on conflict(couple_id,owner_id,partner_id,user_id,interaction_type,interaction_day) do nothing returning id into eid;
  if eid is not null then
   update public.grove_state set growth_points=growth_points+reward,updated_at=clock_timestamp() where couple_id=s.id;
  else reward:=0;
  end if;
 end if;
 result:=public.grove_action('get','{}'::jsonb);
 return result||jsonb_build_object('visit_reward',reward,'interactions',(
  select coalesce(jsonb_agg(t),'[]'::jsonb) from (
   select id,user_id,interaction_type,reward_points,created_at from public.grove_interactions
    where couple_id=s.id and owner_id=s.owner_id and partner_id=s.partner_id order by created_at desc limit 40
  )t
 ));
end $$;
revoke all on function public.grove_visit(text) from public,anon;
grant execute on function public.grove_visit(text) to authenticated;
