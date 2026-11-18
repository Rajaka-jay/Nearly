create or replace function public.grove_action(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
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
   insert into public.grove_memories(id,couple_id,created_by,title,note,memory_date,image_path,decoration) values(request,s.id,u,trim(payload->>'title'),coalesce(payload->>'note',''),(payload->>'date')::date,nullif(payload->>'image_path',''),payload->>'decoration');
  end if;
 elsif action='goal' then
  kind:=payload->>'goal';if kind not in ('water_together','memory_seed','decorate') or kind is null then raise exception 'Invalid goal';end if;
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
  if payload->'items' is null or jsonb_typeof(payload->'items')<>'array' or jsonb_array_length(payload->'items')>12 then raise exception 'Choose up to twelve decorations';end if;
  delete from public.grove_decorations where couple_id=s.id;
  for d in select value from jsonb_array_elements(payload->'items') loop
   if d->>'type' not in ('bench','lantern','blanket','swing','flowers','stars','frame') then raise exception 'Unknown decoration';end if;
   insert into public.grove_decorations(couple_id,decoration_type,position_x,position_y,created_by) values(s.id,d->>'type',(d->>'x')::numeric,(d->>'y')::numeric,u);
  end loop;
 elsif action='delete_memory' then
  delete from public.grove_memories where id=(payload->>'id')::uuid and couple_id=s.id and created_by=u;
  if not found then raise exception 'You can delete your own memories only';end if;
  update public.grove_events set metadata=metadata-'title'-'note'-'date'-'decoration' where couple_id=s.id and user_id=u and metadata->>'request_id'=payload->>'id';
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
