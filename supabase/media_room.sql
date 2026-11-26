-- A private queue and authoritative playback clock, isolated from games and space JSON.
begin;
create table public.nearly_media_rooms (
 id uuid primary key default gen_random_uuid(),
 space_id uuid not null references public.nearly_spaces(id) on delete cascade,
 member_a uuid not null references auth.users(id) on delete cascade,
 member_b uuid not null references auth.users(id) on delete cascade,
 queue jsonb not null default '[]', current_id uuid,
 paused boolean not null default true, position double precision not null default 0,
 anchor_at timestamptz not null default clock_timestamp(), version integer not null default 0,
 updated_by uuid, unique(space_id,member_a,member_b),check(member_a<>member_b)
);
create table public.nearly_media_receipts (
 room_id uuid not null references public.nearly_media_rooms(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null, primary key(room_id,user_id,request_id)
);
alter table public.nearly_media_rooms enable row level security;
alter table public.nearly_media_receipts enable row level security;
revoke all on public.nearly_media_rooms,public.nearly_media_receipts from public,anon,authenticated;
create or replace function public.nearly_media(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid();s public.nearly_spaces;r public.nearly_media_rooms; req uuid;
 source text;kind text;provider_id text:='';title text;item jsonb;item_id uuid;
 p double precision;ts timestamptz:=clock_timestamp();new_queue jsonb;
begin
 if u is null then raise exception 'Sign in to watch or listen with your partner';end if;
 if action is null or action not in ('get','add','select','remove','play','pause','seek') then raise exception 'Unknown media action';end if;
 select * into s from public.nearly_spaces where owner_id=u or partner_id=u for update;
 if s.id is null or s.partner_id is null then raise exception 'Connect your accounts before opening your shared room';end if;
 select * into r from public.nearly_media_rooms where space_id=s.id and member_a=s.owner_id and member_b=s.partner_id for update;
 if r.id is null then
  if action<>'get' then raise exception 'Open the room first';end if;
  insert into public.nearly_media_rooms(space_id,member_a,member_b) values(s.id,s.owner_id,s.partner_id) returning * into r;
 end if;
 if action<>'get' then
  req:=(payload->>'request_id')::uuid;if req is null then raise exception 'Request ID required';end if;
  if exists(select 1 from public.nearly_media_receipts where room_id=r.id and user_id=u and request_id=req) then action:='get';end if;
  if action<>'get' and (payload->>'version' is null or (payload->>'version')::integer<>r.version) then raise exception 'STALE: your partner changed the room. The latest state has been loaded; try again';end if;
 end if;
 ts:=clock_timestamp();
 if action='add' then
  if jsonb_array_length(r.queue)>=40 then raise exception 'Your queue is full. Remove an item before adding another';end if;
  source:=payload->>'url';title:=btrim(coalesce(payload->>'title',''));
  if title='' or length(title)>120 then raise exception 'Enter a title of 1 to 120 characters';end if;
  if source is null or length(source)>2048 or source !~ '^https://[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}([/?][^[:space:]<>"''\\]*)?$' or source ~ '^https://[^/?]*@' or source ~ '^https://[^/?]*\.(local|localhost|internal)([/?]|$)' then raise exception 'Use a public HTTPS link without passwords or custom ports';end if;
  if source ~ '^https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}$' then kind:='youtube';provider_id:=right(source,11);
  elsif source ~ '^https://open\.spotify\.com/(track|album|playlist|episode|show)/[A-Za-z0-9]{22}$' then kind:='spotify';provider_id:=substr(source,length('https://open.spotify.com/')+1);
  elsif source ~ '^https://([^/?]+\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com|spotify\.com)([/?]|$)' then raise exception 'Paste a supported YouTube video or Spotify media link';
  elsif split_part(source,'?',1) ~* '\.(mp4|webm|ogv)$' then kind:='video';
  elsif split_part(source,'?',1) ~* '\.(mp3|m4a|ogg|wav|aac)$' then kind:='audio';
  else kind:='link';end if;
  if exists(select 1 from jsonb_array_elements(r.queue) v where v->>'url'=source) then raise exception 'That link is already in your queue';end if;
  item_id:=gen_random_uuid();item:=jsonb_build_object('id',item_id,'kind',kind,'url',source,'provider_id',provider_id,'title',title,'added_by',u);
  r.queue:=r.queue||item;
  if r.current_id is null then r.current_id:=item_id;r.paused:=true;r.position:=0;r.anchor_at:=ts;end if;
 elsif action in ('select','remove') then
  item_id:=(payload->>'id')::uuid;
  if item_id is null or not exists(select 1 from jsonb_array_elements(r.queue) v where v->>'id'=item_id::text) then raise exception 'This item is no longer in the queue';end if;
  if action='select' then r.current_id:=item_id;r.paused:=true;r.position:=0;r.anchor_at:=ts;
  else
   select coalesce(jsonb_agg(v),'[]') into new_queue from jsonb_array_elements(r.queue) v where v->>'id'<>item_id::text;
   r.queue:=new_queue;
   if r.current_id=item_id then r.current_id:=(new_queue->0->>'id')::uuid;r.paused:=true;r.position:=0;r.anchor_at:=ts;end if;
  end if;
 elsif action in ('play','pause','seek') then
  select v into item from jsonb_array_elements(r.queue) v where v->>'id'=r.current_id::text;
  if item is null or item->>'kind' not in ('youtube','audio','video') then raise exception 'Shared playback supports YouTube and direct audio or video files. Spotify and other websites open separately';end if;
  if action='seek' then
   p:=(payload->>'position')::double precision;
   if p is null or not(p>=0 and p<=86400) then raise exception 'Choose a playback position between 0 and 24 hours';end if;
   r.position:=p;
  else
   -- Playback position is calculated from the server clock, never a browser clock.
   if not r.paused then r.position:=least(86400,r.position+greatest(0,extract(epoch from(ts-r.anchor_at))));end if;
   r.paused:=action='pause';
  end if;
  r.anchor_at:=ts;
 end if;
 if action<>'get' then
  update public.nearly_media_rooms set queue=r.queue,current_id=r.current_id,paused=r.paused,position=r.position,anchor_at=r.anchor_at,version=version+1,updated_by=u where id=r.id returning * into r;
  insert into public.nearly_media_receipts values(r.id,u,req);
 end if;
 return jsonb_build_object('id',r.id,'queue',r.queue,'current_id',r.current_id,'paused',r.paused,'position',r.position,'anchor_at',r.anchor_at,'version',r.version,'server_time',clock_timestamp(),'updated_by',r.updated_by);
end $$;
revoke all on function public.nearly_media(text,jsonb) from public,anon;
grant execute on function public.nearly_media(text,jsonb) to authenticated;
commit;
