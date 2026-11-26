/* Partner-only media queue. Shared transport controls use a PostgreSQL server clock. */
(function(){
 'use strict';
 const core=window.NearlyMediaCore,beforeStart=start;
 let room=null,open=false,busy=false,polling=false,generation=0,offset=0,ready=false,enabled=false,player=null,media=null,mountedId=undefined,error='',ytPromise=null,lastCorrection=0,sessionUser=null,playerEpoch=0,networkError=false;
 const el=id=>document.getElementById(id);
 const selected=()=>room?.queue.find(q=>q.id===room.current_id);
 const syncable=q=>q&&['youtube','video','audio'].includes(q.kind);
 const fmt=n=>{n=Math.max(0,Math.floor(n||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');};
 const target=()=>core.targetPosition(room,Date.now()+offset);
 function setError(text){error=text;const node=el('nm-error');if(node){node.textContent=text;node.hidden=!text;}}
 function errorText(e){return e.code==='PGRST202'?'The media room is not available yet. Try again shortly.':e.message||'Could not connect. Try refreshing your room.';}
 async function rpc(action,payload={}){
  if(!cloud)throw Error('Sign in to watch or listen with your partner.');
  const startAt=Date.now();let timer;
  try{const {data,error:e}=await Promise.race([cloud.rpc('nearly_media',{action,payload}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('The room is taking too long to respond. Refresh before trying again.')),15000);})]);if(e)throw e;
   const server=Date.parse(data.server_time);if(Number.isFinite(server))offset=server-(startAt+Date.now())/2;return data;
  }finally{clearTimeout(timer);}
 }
 function destroyPlayer(){
  playerEpoch++;ready=false;enabled=false;
  if(media){media.pause();media.removeAttribute('src');media.load();media=null;}
  if(player){try{player.destroy();}catch{}player=null;}
 }
 function close(){generation++;open=false;room=null;mountedId=undefined;busy=false;networkError=false;setError('');destroyPlayer();}
 start=function(id){return ['watch','playlist','media'].includes(id)?show():beforeStart(id);};
 for(const g of catalog){if(g.id==='watch'){g.name='Watch & listen together';g.time=10;}if(g.id==='playlist'){g.name='Our music queue';g.mode='Together';}}
 async function show(){
  if(busy)return;close();open=true;activeRoom=null;const token=generation;
  modal('<section class="nm"><h2>Making a little room for us…</h2><p role="status">Loading your shared queue.</p></section>');
  try{const next=await rpc('get');if(!open||token!==generation)return;room=next;shell();paint();}
  catch(e){if(open&&token===generation)modal(`<section class="nm"><h2>Couldn’t open your room</h2><p role="alert">${esc(errorText(e))}</p><button class="btn" onclick="NearlyMedia.open()">Try again</button><p class="sub">Sign in and connect your two accounts to share playback.</p></section>`);}
 }
 function shell(){
  const earlier=['watch','playlist'].map(kind=>{const previous=typeof state!=='undefined'?state.rooms?.[kind]:null;if(!previous)return '';let link='';try{const url=new URL(previous.url);if(url.protocol==='https:')link=`<p><a target="_blank" rel="noopener noreferrer" href="${esc(url.href)}">Open earlier link</a></p>`;}catch{}return `<h4>${esc(previous.title|| (kind==='watch'?'Earlier watch night':'Earlier music notes'))}</h4>${link}${(previous.notes||[]).slice(0,100).map(n=>`<p>${esc(n.text)}</p>`).join('')}`;}).join('');
  modal(`<section class="nm"><p class="nm-eyebrow">PRESS PLAY ON A LITTLE TIME TOGETHER</p><h2>Watch & listen</h2><p class="sub">One queue for the two of you. YouTube, movies, music, and little discoveries.</p><p id="nm-error" class="nm-error" role="alert" hidden></p><div class="nm-now"><span id="nm-kind" class="nm-chip"></span><h3 id="nm-title">Your next little discovery</h3><div id="nm-player" class="nm-player"></div><p id="nm-hint" class="nm-hint"></p><button id="nm-enable" class="btn" onclick="NearlyMedia.enable()" hidden>Enable playback on this device</button><div id="nm-transport" hidden><button id="nm-resume" class="btn light" onclick="NearlyMedia.resume()">Resume on this device</button><p id="nm-status" role="status" aria-live="polite"></p><div class="nm-buttons"><button id="nm-play" class="btn" onclick="NearlyMedia.transport('play')">Play for both</button><button id="nm-pause" class="btn light" onclick="NearlyMedia.transport('pause')">Pause for both</button><button class="btn light" onclick="NearlyMedia.resync()">Catch up to partner</button></div><label for="nm-seek">Shared playback position</label><div class="nm-seek"><input type="range" id="nm-seek" min="0" max="86400" step="1" value="0" aria-label="Seek playback for both partners"><span id="nm-time">0:00</span></div></div><button id="nm-reload" class="link" onclick="NearlyMedia.reload()" hidden>Reload player on this device</button><p id="nm-provider-note" class="nm-hint"></p><a id="nm-open" class="link" target="_blank" rel="noopener noreferrer" hidden>Open original</a></div><div class="nm-add"><h3>Add something for us</h3><form id="nm-form"><label for="nm-url">YouTube, Spotify, or a direct media link</label><input id="nm-url" name="url" type="url" required maxlength="2048" placeholder="https://…" autocomplete="off"><label for="nm-name">A title for your queue</label><input id="nm-name" name="title" required maxlength="120" placeholder="Our movie night"><button id="nm-add" class="btn" type="submit">Add to our queue</button><p id="nm-form-error" class="nm-error" role="alert" hidden></p></form></div><div class="nm-queue-heading"><h3>Our queue <span id="nm-count"></span></h3><button class="link" onclick="NearlyMedia.refresh()">Refresh room</button></div><div id="nm-queue"></div>${earlier?`<details><summary>Your earlier watch & music notes</summary>${earlier}</details>`:''}<details><summary>What can we play here?</summary><p>YouTube videos and direct HTTPS MP4, WebM, MP3, M4A, OGG, WAV, or AAC files support shared play, pause, and seeking. Both partners must enable playback on their own device. Use the shared controls below the player to control both devices; the player’s own controls affect only your device.</p><p>Spotify embeds play independently and may offer only previews. Open Spotify and use its Jam feature for synchronized Spotify listening. Movies from subscription websites open in separate tabs; Nearly cannot control those players.</p><p>Playback timing is best effort and can drift during buffering or ads. Catch up to partner realigns your device. Live streams, DRM-protected files, unavailable videos, and files that your browser cannot decode may not support seeking or playback.</p></details><p class="nm-foot">Your queue is private to your connected couple. Closing the room stops playback on this device; Pause for both stops both players.</p></section>`);
  el('nm-form').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;const form=e.currentTarget;try{const source=core.parseSource(form.elements.url.value);const ok=await act('add',{url:source.url,title:form.elements.title.value.trim()});if(ok&&form.isConnected)form.reset();}catch(e){const node=el('nm-form-error');if(node){node.textContent=errorText(e);node.hidden=false;}}});
  el('nm-seek').addEventListener('change',e=>void act('seek',{position:Number(e.target.value)}));
  el('nm-seek').addEventListener('input',e=>{el('nm-time').textContent=fmt(Number(e.target.value));});
 }
 function paint(){
  if(!open||!room||!el('nm-player'))return;
  const q=selected(),isSync=syncable(q);
  if((q?.id||null)!==mountedId){destroyPlayer();mountedId=q?.id||null;const stage=el('nm-player');stage.replaceChildren();
   if(!q)stage.innerHTML='<div class="nm-empty"><span aria-hidden="true">♫</span><strong>A little movie night. A song that feels like us.</strong><p>Add your first link below.</p></div>';
   else if(q.kind==='link')stage.innerHTML='<div class="nm-empty"><span aria-hidden="true">▣</span><strong>Open this website on both devices</strong><p>This provider plays in its own app or website. Playback here is not synchronized.</p></div>';
   else stage.innerHTML='<div class="nm-empty"><span aria-hidden="true">'+(q.kind==='audio'||q.kind==='spotify'?'♫':'▷')+'</span><strong>Ready when you both are.</strong><p>Enable this player to load content from its provider.</p></div>';
  }
  el('nm-title').textContent=q?.title||'Your next little discovery';
  el('nm-kind').textContent=q?({youtube:'YouTube · shared controls',audio:'Audio · shared controls',video:'Video · shared controls',spotify:'Spotify · independent playback',link:'External website · independent playback'})[q.kind]:'Your private shared room';
  el('nm-enable').hidden=!q||q.kind==='link'||enabled;
  el('nm-enable').disabled=busy;
  el('nm-reload').hidden=!q||q.kind==='link'||!enabled;
  el('nm-enable').textContent=q?.kind==='spotify'?'Load Spotify embed on this device':'Enable playback on this device';
  el('nm-transport').hidden=!isSync;
  el('nm-play').disabled=busy||!ready||!room.paused;
  el('nm-pause').disabled=busy||room.paused;
  el('nm-seek').disabled=busy||!ready;
  el('nm-resume').disabled=!ready||busy;
  el('nm-status').textContent=room.paused?'Paused for both.':enabled?(ready?'Playing together.':'Waiting for your player. Reload it if playback does not start.'):'Your partner started playback. Enable your player to join.';
  el('nm-open').hidden=!q;if(q)el('nm-open').href=q.url;
  el('nm-provider-note').textContent=q?.kind==='spotify'?'Spotify’s embed is independent on each device. Full tracks depend on your Spotify account. For remote listening together, open Spotify and use Jam.':q?.kind==='link'?'This is a shared link, not a synchronized player. Each partner needs their own access to the service.':'';
  el('nm-hint').textContent=isSync?'Use Play for both, Pause for both, and the shared position slider. Volume stays personal on each device.':'';
  el('nm-add').disabled=busy;el('nm-add').textContent=busy?'Saving…':'Add to our queue';
  const focused=document.activeElement?.dataset.nmFocus;
  el('nm-count').textContent=`(${room.queue.length}/40)`;
  el('nm-queue').innerHTML=room.queue.length?room.queue.map(item=>`<article class="nm-item ${item.id===room.current_id?'nm-selected':''}"><div><strong>${esc(item.title)}</strong><small>${esc(item.kind==='link'?'External website':item.kind)}</small></div><button class="btn light" data-nm-focus="select-${item.id}" ${busy||item.id===room.current_id?'disabled':''} onclick="NearlyMedia.select('${item.id}')">${item.id===room.current_id?'Selected':'Choose'}</button><button class="nm-remove" aria-label="Remove ${esc(item.title)} from the queue" data-nm-focus="remove-${item.id}" ${busy?'disabled':''} onclick="NearlyMedia.remove('${item.id}')">×</button></article>`).join(''):'<p class="nm-queue-empty">Your queue is empty. Add a song, video, or movie link to begin.</p>';
  if(focused)document.querySelector(`[data-nm-focus="${focused}"]`)?.focus();
  updateClock();
 }
 async function act(action,extra={}){
  if(!room||busy||!open)return false;
  const token=generation,id=room.id;busy=true;setError('');if(el('nm-form-error'))el('nm-form-error').hidden=true;paint();
  try{const next=await rpc(action,{...extra,version:room.version,request_id:crypto.randomUUID()});if(!open||token!==generation||room?.id!==id)return false;room=next;paint();align(true);return true;}
  catch(e){if(open&&token===generation){setError(errorText(e));try{const next=await rpc('get');if(open&&token===generation){room=next;paint();align(true);}}catch{/* Retain last confirmed state. */}}return false;}
  finally{if(token===generation){busy=false;paint();}}
 }
 async function refresh(){
  if(!open||!room||busy||polling)return;
  const token=generation;polling=true;
  try{const next=await rpc('get');if(!open||token!==generation)return;const changed=next.version!==room.version;room=next;if(changed)paint();if(networkError){networkError=false;setError('');paint();}align(false);}
  catch(e){if(open&&token===generation){networkError=true;setError(errorText(e));if(media)media.pause();if(player&&ready)player.pauseVideo();}}
  finally{polling=false;}
 }
 function loadYouTube(){
  if(window.YT?.Player)return Promise.resolve();if(ytPromise)return ytPromise;
  ytPromise=new Promise((resolve,reject)=>{const old=window.onYouTubeIframeAPIReady;const timer=setTimeout(()=>{ytPromise=null;reject(Error('YouTube did not load. Check your connection and try again.'));},15000);window.onYouTubeIframeAPIReady=()=>{if(old)old();clearTimeout(timer);resolve();};let script=document.getElementById('nm-youtube-api');if(!script){script=document.createElement('script');script.id='nm-youtube-api';script.src='https://www.youtube.com/iframe_api';script.onerror=()=>{clearTimeout(timer);ytPromise=null;script.remove();reject(Error('YouTube could not be loaded. Try opening the original link.'));};document.head.append(script);}});return ytPromise;
 }
 async function enable(){
  const q=selected();if(!open||!q||enabled)return;
  const token=generation,id=q.id,serial=playerEpoch;enabled=true;paint();
  const current=()=>open&&generation===token&&selected()?.id===id&&playerEpoch===serial;
  try{
   if(q.kind==='spotify'){
    const frame=document.createElement('iframe');frame.src='https://open.spotify.com/embed/'+q.provider_id;frame.title='Spotify: '+q.title;frame.allow='autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';frame.referrerPolicy='strict-origin-when-cross-origin';frame.height='352';frame.loading='lazy';el('nm-player').replaceChildren(frame);return;
   }
   if(q.kind==='youtube'){
    await loadYouTube();if(!current())return;
    const slot=document.createElement('div');slot.id='nm-yt-slot';el('nm-player').replaceChildren(slot);
    player=new YT.Player('nm-yt-slot',{host:'https://www.youtube-nocookie.com',videoId:q.provider_id,width:'100%',height:'280',playerVars:{playsinline:1,autoplay:0,origin:location.origin,rel:0},events:{onReady:()=>{if(!current())return;ready=true;setError('');paint();align(true);},onError:e=>{if(current()){ready=false;paint();setError(({100:'This YouTube video is unavailable or private.',101:'The creator does not allow this video to be embedded.',150:'The creator does not allow this video to be embedded.',153:'YouTube could not verify this embedded player. Open the original link.'})[e.data]||'YouTube could not play this video. Try another link.');}},onAutoplayBlocked:()=>{if(current())setError('Your browser blocked playback. Tap Resume on this device, then use the shared controls.');},onStateChange:e=>{if(current()&&e.data===0&&!room.paused)void act('pause');}}});
   }else if(q.kind==='video'||q.kind==='audio'){
    media=document.createElement(q.kind==='video'?'video':'audio');media.controls=true;media.preload='metadata';media.playsInline=true;media.setAttribute('aria-label',q.title);media.src=q.url;el('nm-player').replaceChildren(media);
    media.addEventListener('loadedmetadata',()=>{if(current()){ready=true;paint();align(true);}});
    media.addEventListener('error',()=>{if(current()){ready=false;paint();setError('This media file could not be played. Check that the link opens directly and that both browsers support its format.');}});
    media.addEventListener('ended',()=>{if(current()&&!room.paused)void act('pause');});
   }
  }catch(e){if(current()){enabled=false;setError(errorText(e));paint();}}
 }
 function duration(){try{const d=media?.duration||player?.getDuration?.();return Number.isFinite(d)&&d>0?d:86400;}catch{return 86400;}}
 function updateClock(){if(!open||!room||!el('nm-time'))return;const end=duration(),position=Math.min(target(),end);el('nm-time').textContent=fmt(position)+(end<86400?' / '+fmt(end):'');const range=el('nm-seek');range.max=String(Math.min(86400,end));if(document.activeElement!==range)range.value=String(position);}
 function align(force=false){
  if(!open||!ready||!enabled||!syncable(selected()))return;
  const now=Date.now(),pos=Math.min(target(),Math.max(0,duration()-.05));
  if(!force&&now-lastCorrection<1500)return;lastCorrection=now;
  try{
   if(media){if(media.readyState<1)return;if(force||Math.abs(media.currentTime-pos)>1.5)media.currentTime=pos;if(room.paused){if(!media.paused)media.pause();}else if(media.paused){const token=generation,source=media;source.play().catch(()=>{if(token===generation&&open&&media===source)setError('Tap Resume on this device to allow sound and playback.');});}}
   else if(player){const time=player.getCurrentTime();if(force||Math.abs(time-pos)>2)player.seekTo(pos,true);const state=player.getPlayerState();if(room.paused){if(state===1||state===3)player.pauseVideo();}else if(state!==1&&state!==3)player.playVideo();}
  }catch{/* Wait for metadata or the provider's next ready event. */}
 }
 function resume(){
  if(!enabled)return enable();
  if(media){const source=media,token=generation;source.play().then(()=>{if(open&&generation===token&&media===source){setError('');if(!room?.paused)align(true);}}).catch(()=>{if(open&&generation===token&&media===source)setError('Playback is still blocked. Try the player’s own play button.');});}
  else if(player&&ready){player.playVideo();setError('');if(!room?.paused)align(true);}
 }
 async function transport(action){const task=act(action);if(action==='play')resume();return task;}
 dialog.addEventListener('close',close);
 cloud?.auth?.onAuthStateChange((_event,session)=>{const next=session?.user?.id||null;if(!next||(sessionUser&&sessionUser!==next)){const was=open;close();if(was&&document.querySelector('#modal .nm'))dialog.close();}sessionUser=next;});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});window.addEventListener('online',()=>void refresh());
 setInterval(()=>{if(open&&!document.hidden)void refresh();},1500);setInterval(updateClock,500);
 window.NearlyMedia={open:show,enable,refresh,transport,resync:()=>{setError('');align(true);},reload:()=>{destroyPlayer();setError('');return enable();},resume,select:id=>act('select',{id}),remove:id=>{if(confirm('Remove this link from your shared queue?'))return act('remove',{id});}};
if(page==='play'&&!dialog.open)play();
})();
