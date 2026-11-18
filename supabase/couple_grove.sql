create table public.grove_state(couple_id uuid primary key references public.nearly_spaces(id) on delete cascade,growth_points integer not null default 0 check(growth_points>=0),love_crystals integer not null default 0 check(love_crystals>=0),relationship_start_date date,inventory jsonb not null default '{"watering_can":3,"fertilizer":3,"sunlight":3,"memory_seed":3,"love_crystal":3}',updated_at timestamptz not null default now());
create table public.grove_events(id uuid primary key default gen_random_uuid(),couple_id uuid not null references public.nearly_spaces(id) on delete cascade,user_id uuid not null references auth.users(id),event_type text not null,points integer not null default 0,reward_key text,metadata jsonb not null default '{}',created_at timestamptz not null default now(),unique(couple_id,user_id,reward_key));
create table public.grove_memories(id uuid primary key default gen_random_uuid(),couple_id uuid not null references public.nearly_spaces(id) on delete cascade,created_by uuid not null references auth.users(id),title text not null,note text not null,memory_date date not null,image_path text,decoration text not null,created_at timestamptz not null default now());
create table public.grove_goals(couple_id uuid not null references public.nearly_spaces(id) on delete cascade,goal_type text not null,goal_date date not null,completed_by uuid[] not null default '{}',rewarded boolean not null default false,completed_at timestamptz,primary key(couple_id,goal_type,goal_date));
create table public.grove_decorations(id uuid primary key default gen_random_uuid(),couple_id uuid not null references public.nearly_spaces(id) on delete cascade,decoration_type text not null,position_x numeric not null check(position_x between 0 and 100),position_y numeric not null check(position_y between 0 and 100),created_by uuid not null references auth.users(id),updated_at timestamptz not null default now());
create table public.grove_preferences(user_id uuid primary key references auth.users(id) on delete cascade,notification_previews boolean not null default false);
create function public.grove_member(c uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.nearly_spaces where id=c and (owner_id=auth.uid() or partner_id=auth.uid()))$$;
revoke all on function public.grove_member(uuid) from public,anon;grant execute on function public.grove_member(uuid) to authenticated;
alter table public.grove_state enable row level security;alter table public.grove_events enable row level security;alter table public.grove_memories enable row level security;alter table public.grove_goals enable row level security;alter table public.grove_decorations enable row level security;alter table public.grove_preferences enable row level security;
create policy members on public.grove_state for select to authenticated using(public.grove_member(couple_id));
create policy members on public.grove_events for select to authenticated using(public.grove_member(couple_id));
create policy members on public.grove_memories for select to authenticated using(public.grove_member(couple_id));
create policy members on public.grove_goals for select to authenticated using(public.grove_member(couple_id));
create policy members on public.grove_decorations for select to authenticated using(public.grove_member(couple_id));
create policy own on public.grove_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke all on public.grove_state,public.grove_events,public.grove_memories,public.grove_goals,public.grove_decorations from anon,authenticated;
grant select on public.grove_state,public.grove_events,public.grove_memories,public.grove_goals,public.grove_decorations to authenticated;
grant select,insert,update on public.grove_preferences to authenticated;
create index on public.grove_events(couple_id,created_at desc);create index on public.grove_memories(couple_id,created_at desc);create index on public.grove_decorations(couple_id);
create function public.grove_action(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();s public.nearly_spaces;g public.grove_state;p integer:=0;k text;kind text;eid uuid;goal public.grove_goals;d jsonb;day date:=(now() at time zone 'UTC')::date;request uuid;
begin
 if u is null then raise exception 'Sign in to open your grove';end if;
 select * into s from public.nearly_spaces where owner_id=u or partner_id=u for update;
 if s.id is null then raise exception 'Join your couple space first';end if;
 insert into public.grove_state(couple_id) values(s.id) on conflict do nothing;
 select * into g from public.grove_state where couple_id=s.id for update;
 if action not in ('get','water','memory','gift','goal','decorate','delete_memory','settings') or action is null then raise exception 'Unknown grove action';end if;
 if action='water' then p:=2;k:='water:'||day;
 elsif action='gift' then
  kind:=payload->>'item';if kind not in ('watering_can','fertilizer','sunlight','memory_seed','love_crystal') or kind is null then raise exception 'Choose an inventory item';end if;
  k:='gift:'||day;p:=1;
  if exists(select 1 from public.grove_events where couple_id=s.id and user_id=u and reward_key=k) then raise exception 'Your daily gift has already been sent';end if;
  if (g.inventory->>kind)::integer<1 then raise exception 'This item is out of stock';end if;
  update public.grove_state set inventory=jsonb_set(inventory,array[kind],to_jsonb((inventory->>kind)::integer-1)),love_crystals=love_crystals+case when kind='love_crystal' then 1 else 0 end where couple_id=s.id;
 elsif action='memory' then
  if length(trim(payload->>'title')) not between 1 and 120 or length(coalesce(payload->>'note',''))>2000 or payload->>'title' is null then raise exception 'Enter a title up to 120 characters and a note up to 2000';end if;
  if payload->>'decoration' not in ('flower','heart','lantern') then raise exception 'Choose a seed decoration';end if;
  if nullif(payload->>'image_path','') is not null and (split_part(payload->>'image_path','/',1)<>s.id::text or split_part(payload->>'image_path','/',2)<>u::text) then raise exception 'Invalid private image path';end if;
  request:=(payload->>'request_id')::uuid;if request is null then raise exception 'Request ID required';end if;
  k:='memory:'||request;p:=20;
  if not exists(select 1 from public.grove_events where couple_id=s.id and user_id=u and reward_key=k) then
   insert into public.grove_memories(couple_id,created_by,title,note,memory_date,image_path,decoration) values(s.id,u,trim(payload->>'title'),coalesce(payload->>'note',''),(payload->>'date')::date,nullif(payload->>'image_path',''),payload->>'decoration');
  end if;
 elsif action='goal' then
  kind:=payload->>'goal';if kind not in ('water_together','checkin','prompt','memory_seed','future_date','decorate') or kind is null then raise exception 'Invalid goal';end if;
  if kind='water_together' and not exists(select 1 from public.grove_events where couple_id=s.id and user_id=u and reward_key='water:'||day) then raise exception 'Water the tree first';end if;
  if kind='memory_seed' and not exists(select 1 from public.grove_memories where couple_id=s.id and created_by=u and created_at>=day::timestamptz) then raise exception 'Plant a memory seed first';end if;
  if kind='decorate' and not exists(select 1 from public.grove_decorations where couple_id=s.id and created_by=u) then raise exception 'Place a decoration first';end if;
  insert into public.grove_goals(couple_id,goal_type,goal_date) values(s.id,kind,day) on conflict do nothing;
  select * into goal from public.grove_goals where couple_id=s.id and goal_type=kind and goal_date=day for update;
  if u=any(goal.completed_by) then raise exception 'You have already completed this goal today';end if;
  update public.grove_goals set completed_by=array_append(completed_by,u) where couple_id=s.id and goal_type=kind and goal_date=day returning * into goal;
  if s.partner_id is not null and s.owner_id=any(goal.completed_by) and s.partner_id=any(goal.completed_by) and not goal.rewarded then
   p:=15;update public.grove_goals set rewarded=true,completed_at=now() where couple_id=s.id and goal_type=kind and goal_date=day;
  end if;
 elsif action='decorate' then
  if jsonb_typeof(payload->'items')<>'array' or jsonb_array_length(payload->'items')>12 then raise exception 'Choose up to twelve decorations';end if;
  delete from public.grove_decorations where couple_id=s.id;
  for d in select value from jsonb_array_elements(payload->'items') loop
   if d->>'type' not in ('bench','lantern','blanket','swing','flowers','stars','frame') then raise exception 'Unknown decoration';end if;
   insert into public.grove_decorations(couple_id,decoration_type,position_x,position_y,created_by) values(s.id,d->>'type',(d->>'x')::numeric,(d->>'y')::numeric,u);
  end loop;
 elsif action='delete_memory' then
  delete from public.grove_memories where id=(payload->>'id')::uuid and couple_id=s.id and created_by=u;
  if not found then raise exception 'You can delete your own memories only';end if;
 elsif action='settings' then
  update public.grove_state set relationship_start_date=(payload->>'start_date')::date where couple_id=s.id;
 end if;
 if action<>'get' then
  insert into public.grove_events(couple_id,user_id,event_type,points,reward_key,metadata) values(s.id,u,action,p,k,payload-'image_path') on conflict(couple_id,user_id,reward_key) do nothing returning id into eid;
  if eid is not null then update public.grove_state set growth_points=growth_points+p,updated_at=now() where couple_id=s.id;end if;
 end if;
 select * into g from public.grove_state where couple_id=s.id;
 return jsonb_build_object('couple',to_jsonb(g),'user_id',u,'paired',s.partner_id is not null,'names',jsonb_build_array(coalesce(s.data->>'name','You'),coalesce(s.data->>'partner','Your partner')),'stage',case when g.growth_points>=1000 then 5 when g.growth_points>=500 then 4 when g.growth_points>=200 then 3 when g.growth_points>=50 then 2 else 1 end,'events',(select coalesce(jsonb_agg(t),'[]') from(select * from public.grove_events where couple_id=s.id order by created_at desc limit 100)t),'memories',(select coalesce(jsonb_agg(t),'[]') from(select * from public.grove_memories where couple_id=s.id order by created_at desc limit 100)t),'goals',(select coalesce(jsonb_agg(t),'[]') from(select * from public.grove_goals where couple_id=s.id and goal_date=day)t),'decorations',(select coalesce(jsonb_agg(t),'[]') from(select * from public.grove_decorations where couple_id=s.id)t));
end $$;
revoke all on function public.grove_action(text,jsonb) from public,anon;grant execute on function public.grove_action(text,jsonb) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('grove-images','grove-images',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy grove_upload on storage.objects for insert to authenticated with check(bucket_id='grove-images' and (storage.foldername(name))[2]=auth.uid()::text and public.grove_member(((storage.foldername(name))[1])::uuid));
create policy grove_read on storage.objects for select to authenticated using(bucket_id='grove-images' and public.grove_member(((storage.foldername(name))[1])::uuid));
create policy grove_delete on storage.objects for delete to authenticated using(bucket_id='grove-images' and (storage.foldername(name))[2]=auth.uid()::text);
alter publication supabase_realtime add table public.grove_state;
