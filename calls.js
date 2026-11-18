/* Partner-only WebRTC calls; media is never stored in Supabase. */
(function(global){
 'use strict';
 const paths={video:'<rect x="3" y="6" width="12" height="12" rx="3"/><path d="m15 10 6-3v10l-6-3"/>',mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>',phone:'<path d="M6 16v4H2v-6c6-6 14-6 20 0v6h-4v-4l-4-2h-4Z"/>',expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/>',min:'<path d="M5 12h14"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',move:'<path d="M12 3v18M3 12h18m-12-6 3-3 3 3m-9 3-3 3 3 3m3 3 3 3 3-3m3-9 3 3-3 3"/>',heart:'<path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-4 5 3 10 8 15 5-5 12-10 8-15Z"/>',pip:'<rect x="2" y="4" width="20" height="16" rx="3"/><rect x="12" y="11" width="7" height="6" rx="1"/>',flip:'<path d="M4 7h13l-3-3m6 13H7l3 3M4 7v5m16 5v-5"/>'};
 const icon=(name,off=false)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||''}${off?'<path d="m3 3 18 18"/>':''}</svg>`;
 const put=(el,value)=>{if(el.textContent!==value)el.textContent=value;};
 const mediaError=e=>({NotAllowedError:'Camera or microphone permission was denied. Allow access in your browser’s site settings, then try again.',NotFoundError:'No camera or microphone was found. Connect a device and try again.',NotReadableError:'Your camera or microphone is busy in another app. Close that app and try again.'})[e.name]||e.message||'The call could not connect.';
 const clampPosition=(x,y,w,h,v)=>({x:Math.max(8,Math.min(x,Math.max(8,v.width-w-8))),y:Math.max(8,Math.min(y,Math.max(8,v.height-h-8)))});
 class CallWidget{
  constructor(client){
   Object.assign(this,{client,device:crypto.randomUUID(),generation:0,context:null,call:null,pc:null,stream:null,channel:null,channelSpace:null,visible:false,minimized:false,expanded:false,busy:false,mic:true,camera:true,remoteReady:false,seenCandidates:new Set(),endedIds:new Set(),pendingCandidates:[],iceChain:Promise.resolve(),syncChain:Promise.resolve(),polling:false,connectedAt:0,lastBeat:0,status:'A little closer, face to face.',detail:'Both partners need to have Nearly open.',relayConfigured:false,iceServers:[{urls:['stun:stun.cloudflare.com:3478','stun:stun.l.google.com:19302']}],position:null,destroyed:false});
   this.build();
   this.auth=client.auth.onAuthStateChange((_event,session)=>{this.session=session;if(!session){this.cleanup();this.call=null;this.context=null;this.visible=false;void this.unsubscribe();this.render();}else void this.refresh();});
   this.poll=setInterval(()=>void this.refresh(),2500);
   this.clock=setInterval(()=>{if(this.connectedAt)this.render();if(this.pc&&this.call&&['connecting','active'].includes(this.call.status)&&Date.now()-this.lastBeat>15000){this.lastBeat=Date.now();void this.action('heartbeat').catch(()=>{});}},1000);
   this.onResize=()=>this.layout();window.addEventListener('resize',this.onResize);window.visualViewport?.addEventListener('resize',this.onResize);
   this.onUnload=e=>{if(this.pc||this.busy){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',this.onUnload);
   this.onPageHide=()=>{this.endKeepalive();this.cleanup();};window.addEventListener('pagehide',this.onPageHide);void this.refresh();
  }
  build(){
   this.root=document.createElement('div');this.root.id='nearly-calls';
   const b=(action,label,name,cls='')=>`<button type="button" data-nc="${action}" class="nc-button ${cls}" aria-label="${label}" title="${label}">${icon(name)}</button>`;
   this.root.innerHTML=`<button type="button" class="nc-launch" data-nc="open" aria-label="Open video call">${icon('video')}<span>Call your person</span><i></i></button><section class="nc-panel" role="region" aria-labelledby="nc-title" hidden><div class="nc-heading"><div class="nc-drag" tabindex="0" role="button" aria-label="Move call window. Drag or use arrow keys. Home resets its position.">${icon('move')}<div><strong id="nc-title">A little closer</strong><span class="nc-heading-note">Nearly video call</span></div></div><div class="nc-window-controls">${b('minimize','Minimize call','min')}${b('expand','Expand call','expand')}${b('close','Close call window','close')}</div></div><div class="nc-video-area"><video class="nc-remote" autoplay playsinline aria-label="Your partner’s video"></video><div class="nc-placeholder">${icon('heart')}<strong>Just the two of you.</strong><span>A little space to see your person.</span></div><video class="nc-local" autoplay playsinline muted aria-label="Your camera preview"></video><div class="nc-video-label">You</div><button type="button" class="nc-play-audio" data-nc="play" hidden>Tap to hear your partner</button><span class="nc-camera-off" hidden>Your camera is off</span></div><div class="nc-copy"><div class="nc-status" role="status" aria-live="polite"></div><p class="nc-detail"></p><p class="nc-error" role="alert" hidden></p></div><div class="nc-incoming" hidden><button type="button" data-nc="decline" class="nc-decline">Decline</button><button type="button" data-nc="answer" class="nc-answer">${icon('video')} Answer</button></div><div class="nc-controls">${b('mic','Mute microphone','mic')}${b('camera','Turn camera off','video')}${b('flip','Switch camera','flip')}${b('pip','Pop out partner video','pip')}${b('end','End call','phone','nc-end')}</div><div class="nc-start"><button type="button" data-nc="start" class="nc-answer">${icon('video')} Start video call</button></div><div class="nc-footnote">Private call · no recording in Nearly</div></section><span class="nc-announcer" aria-live="polite"></span>`;
   document.body.append(this.root);this.el=s=>this.root.querySelector(s);this.panel=this.el('.nc-panel');this.local=this.el('.nc-local');this.remote=this.el('.nc-remote');
   this.root.addEventListener('click',e=>{const button=e.target.closest('[data-nc]');if(button&&!button.disabled)void this.click(button.dataset.nc);});
   const handle=this.el('.nc-drag');let drag=null;
   handle.addEventListener('pointerdown',e=>{if(e.button!==0||this.expanded)return;const r=this.panel.getBoundingClientRect();drag={x:e.clientX-r.left,y:e.clientY-r.top};handle.setPointerCapture(e.pointerId);});
   handle.addEventListener('pointermove',e=>{if(drag){this.position={x:e.clientX-drag.x,y:e.clientY-drag.y};this.layout();}});
   handle.addEventListener('pointerup',()=>{drag=null;});handle.addEventListener('pointercancel',()=>{drag=null;});
   handle.addEventListener('keydown',e=>{const steps={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]};if(e.key==='Home'){this.position=null;this.layout();e.preventDefault();}else if(steps[e.key]&&!this.expanded){const r=this.panel.getBoundingClientRect(),[x,y]=steps[e.key];this.position={x:r.left+x,y:r.top+y};this.layout();e.preventDefault();}});this.render();
  }
  async click(a){
   if(a==='open'){this.visible=true;this.minimized=false;this.render();this.el('.nc-drag').focus();return;}
   if(a==='close'){if(this.call&&this.ownsCall()||this.busy)this.minimized=true;else this.visible=false;this.render();return;}
   if(a==='minimize'){this.minimized=!this.minimized;this.expanded=false;this.render();return;}
   if(a==='expand'){this.expanded=!this.expanded;this.minimized=false;this.render();return;}
   if(a==='start')return this.start();if(a==='answer')return this.answer();
   if(a==='end'||a==='decline')return this.end(a==='decline'?'declined':this.call?.status==='ringing'?'cancelled':'hangup');
   if(a==='mic'&&this.stream){this.mic=!this.mic;this.stream.getAudioTracks().forEach(t=>t.enabled=this.mic);this.render();}
   if(a==='camera'&&this.stream){this.camera=!this.camera;this.stream.getVideoTracks().forEach(t=>t.enabled=this.camera);this.render();}
   if(a==='flip')return this.flipCamera();
   if(a==='play'){const pc=this.pc;if(!pc||pc.connectionState!=='connected')return;try{this.remote.muted=false;await this.remote.play();if(this.pc===pc)this.el('.nc-play-audio').hidden=true;}catch{if(this.pc===pc)this.setError('Tap again to allow sound in this browser.');}}
   if(a==='pip')try{if(document.pictureInPictureElement)await document.exitPictureInPicture();else if(this.remote.requestPictureInPicture)await this.remote.requestPictureInPicture();}catch{this.setError('Pop-out video is not available here. Use minimize instead.');}
  }
  ownsCall(c=this.call){return c&&(c.caller_id===this.context?.user_id?c.caller_device===this.device:c.callee_device===this.device);}
  async rpc(action,payload={}){const {data,error}=await this.client.rpc('nearly_call',{action,payload});if(error)throw error;return data;}
  action(action,extra={}){return this.call?this.rpc(action,{id:this.call.id,device:this.device,...extra}):Promise.resolve(null);}
  async refresh(){
   if(this.destroyed||this.polling)return;this.polling=true;
   try{const {data,error}=await this.client.auth.getSession();if(error)throw error;this.session=data.session;if(!this.session){this.context=null;this.render();return;}
    const context=await this.rpc('get');if(this.destroyed)return;this.context=context;
    if(!context.paired){if(this.call||this.pc){this.cleanup();this.status='Your couple connection changed.';this.detail='Connect your accounts to call each other.';}this.call=null;await this.unsubscribe();}
    else{await this.subscribe(context.space_id);await this.queueCall(context.call);}this.networkFailed=false;this.render();
   }catch(e){this.networkFailed=true;if(this.pc||this.visible)this.setError('Call updates are unavailable. Check your connection. '+e.message);this.render();}finally{this.polling=false;}
  }
  async unsubscribe(){const c=this.channel;this.channel=null;this.channelSpace=null;if(c)await this.client.removeChannel(c);}
  async subscribe(space){if(this.channelSpace===space)return;await this.unsubscribe();if(this.destroyed)return;this.channelSpace=space;this.channel=this.client.channel('nearly-calls:'+space).on('postgres_changes',{event:'*',schema:'public',table:'nearly_calls',filter:'space_id=eq.'+space},()=>void this.refresh()).subscribe();}
  queueCall(c){this.syncChain=this.syncChain.then(()=>this.receive(c)).catch(e=>this.fail(e));return this.syncChain;}
  async receive(c){
   if(this.destroyed||!c||this.endedIds.has(c.id))return;
   if(this.call?.id===c.id){const rank={ringing:0,connecting:1,active:2,ended:3};if(rank[c.status]<rank[this.call.status]||Date.parse(c.updated_at)<Date.parse(this.call.updated_at))return;}
   if(c.status==='ended'){if(this.call?.id===c.id){this.cleanup();this.call=null;this.endedIds.add(c.id);this.status=c.end_reason==='declined'?'Call declined':c.end_reason==='timeout'?'The call timed out':'Call ended';this.detail=c.end_reason==='timeout'?'Your partner may be away or the connection was lost. Try again when you’re both here.':'A little closer, even from far away.';this.render();}return;}
   if(this.call&&this.call.id!==c.id&&this.pc)return;const incoming=c.callee_id===this.context.user_id&&c.status==='ringing',fresh=this.call?.id!==c.id;this.call=c;
   if(incoming&&fresh){this.visible=true;this.minimized=false;this.status='Your person is calling…';this.detail='Answer when you’re ready.';put(this.el('.nc-announcer'),'Incoming Nearly video call.');this.notifyIncoming();}
   if(!incoming&&!this.ownsCall(c)){if(this.pc||this.stream)this.cleanup();this.status='Call open on another device';this.detail='Continue on that device, or wait for the call to end.';this.render();return;}
   if(this.pc&&this.ownsCall(c)){const generation=this.generation;if(c.caller_id===this.context.user_id&&c.answer&&!this.pc.remoteDescription){this.status='Connecting your little worlds…';await this.pc.setRemoteDescription(c.answer);if(generation!==this.generation)return;}
    if(this.pc.remoteDescription){const list=c.caller_id===this.context.user_id?c.callee_candidates:c.caller_candidates;for(const candidate of list){const key=JSON.stringify(candidate);if(!this.seenCandidates.has(key)){await this.pc.addIceCandidate(candidate);if(generation!==this.generation)return;this.seenCandidates.add(key);}}}}
   this.render();
  }
  notifyIncoming(){try{if(document.hidden&&localStorage.getItem('nearly-browser-alerts')==='yes'&&global.Notification?.permission==='granted'){const n=new Notification('Nearly',{body:'Incoming call. Open Nearly to answer.',tag:'nearly-call'});n.onclick=()=>{window.focus();n.close();};}}catch{/* Optional alerts. */}}
  async configureIce(){const {data,error}=await this.client.functions.invoke('nearly-call-ice');if(error||!Array.isArray(data?.iceServers))throw Error('Call connection settings could not be loaded. Check your sign-in and the TURN provider settings before trying again.');this.iceServers=data.iceServers;this.relayConfigured=!!data.relayConfigured;this.iceTransportPolicy=data.iceTransportPolicy==='relay'?'relay':'all';if(!this.relayConfigured)this.setError('A network relay is not connected yet. This call will try a direct connection, which may fail on mobile data or restricted Wi-Fi.');}
  async acquire(generation){
   if(!global.isSecureContext||!navigator.mediaDevices?.getUserMedia||!global.RTCPeerConnection)throw Error('Video calls need a modern browser and an HTTPS connection.');
   const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:{width:{ideal:640},height:{ideal:480},facingMode:'user'}});
   if(this.destroyed||generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return false;}this.stream=stream;this.mic=true;this.camera=true;this.local.srcObject=stream;void this.local.play().catch(()=>{});return true;
  }
  makePeer(){
   const pc=this.pc=new RTCPeerConnection({iceServers:this.iceServers,iceTransportPolicy:this.iceTransportPolicy||'all'}),generation=this.generation;this.seenCandidates.clear();this.remoteReady=false;this.connectedAt=0;this.lastBeat=0;this.stream.getTracks().forEach(t=>pc.addTrack(t,this.stream));
   pc.onicecandidate=e=>{if(e.candidate&&this.pc===pc){const candidate=e.candidate.toJSON();if(this.call&&this.ownsCall())this.sendCandidate(candidate);else this.pendingCandidates.push(candidate);}};
   pc.ontrack=e=>{if(this.pc!==pc)return;this.remote.srcObject=e.streams[0]||new MediaStream([e.track]);this.remote.onloadeddata=()=>{if(this.pc===pc&&pc.connectionState==='connected'){this.remoteReady=true;this.render();}};if(pc.connectionState==='connected')void this.playRemote(pc);};
   pc.onconnectionstatechange=()=>{if(this.pc!==pc||generation!==this.generation)return;
    if(pc.connectionState==='connected'){clearTimeout(this.connectTimer);clearTimeout(this.disconnectTimer);this.connectedAt=this.connectedAt||Date.now();this.status='Together, right here.';this.detail=this.relayConfigured?'Private video call':'Direct connection · a relay is needed for some mobile networks.';this.clearError();void this.playRemote(pc);void this.action('active').catch(e=>this.setError(e.message));}
    else if(pc.connectionState==='disconnected'){this.status='Reconnecting…';clearTimeout(this.disconnectTimer);this.disconnectTimer=setTimeout(()=>{if(this.pc===pc&&pc.connectionState==='disconnected')void this.fail(Error('The connection was lost. Check your network and call again.'));},15000);}
    else if(pc.connectionState==='failed')void this.fail(Error(this.relayConfigured?'The connection failed. Check your network and try again.':'A direct connection could not be established. A TURN relay needs to be configured for these networks.'));this.render();};
   this.connectTimer=setTimeout(()=>{if(this.pc===pc&&pc.connectionState!=='connected')void this.fail(Error('The call could not connect in time. Your partner may be away, or these networks may need a TURN relay.'));},75000);return pc;
  }
  async playRemote(pc){
   if(this.pc!==pc||pc.connectionState!=='connected'||!this.remote.srcObject)return;
   try{await this.remote.play();if(this.pc!==pc)return;this.el('.nc-play-audio').hidden=this.remote.muted!==true;}
   catch(e){
    if(this.pc!==pc||pc.connectionState!=='connected')return;
    if(e.name==='NotAllowedError'){
     this.remote.muted=true;
     try{await this.remote.play();}catch{/* Wait for an explicit user gesture. */}
     if(this.pc===pc&&pc.connectionState==='connected')this.el('.nc-play-audio').hidden=false;
    }
   }
   if(this.pc===pc&&pc.connectionState==='connected'){if(this.remote.readyState>=2)this.remoteReady=true;this.render();}
  }
  sendCandidate(candidate){const id=this.call?.id;this.iceChain=this.iceChain.then(async()=>{if(this.call?.id===id&&this.pc)await this.action('ice',{candidate});}).catch(e=>{if(this.call?.id===id)this.setError('A network update failed. '+e.message);});}
  flushCandidates(){for(const c of this.pendingCandidates)this.sendCandidate(c);this.pendingCandidates=[];}
  async start(){
   if(this.busy||this.pc)return;this.busy=true;this.visible=true;this.clearError();this.status='Getting your camera ready…';this.detail='Allow camera and microphone access when asked.';this.render();const generation=++this.generation;
   try{await this.refresh();if(generation!==this.generation)return;if(!this.context?.paired)throw Error('Sign in and connect with your partner before calling.');if(this.context.call&&this.context.call.status!=='ended')throw Error('A call is already open. Answer it or continue on the other device.');
    await this.configureIce();if(generation!==this.generation)return;if(!await this.acquire(generation))return;const pc=this.makePeer();await pc.setLocalDescription(await pc.createOffer());if(generation!==this.generation)return;
    const c=await this.rpc('start',{device:this.device,description:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}});
    if(generation!==this.generation){void this.rpc('end',{id:c.id,device:this.device,reason:'cancelled'}).catch(()=>{});return;}this.call=c;this.flushCandidates();this.status='Calling your person…';this.detail='Keep Nearly open while your partner answers.';
   }catch(e){if(generation===this.generation){this.cleanup();this.call=null;this.status='Let’s try again';this.setError(mediaError(e));}}finally{if(generation===this.generation||!this.pc)this.busy=false;this.render();}
  }
  async answer(){
   if(this.busy||!this.call||this.call.status!=='ringing')return;this.busy=true;this.clearError();const c=this.call,generation=++this.generation;this.status='Getting your camera ready…';this.render();
   try{await this.configureIce();if(generation!==this.generation)return;if(!await this.acquire(generation))return;const pc=this.makePeer();await pc.setRemoteDescription(c.offer);await pc.setLocalDescription(await pc.createAnswer());if(generation!==this.generation)return;
    const answered=await this.rpc('answer',{id:c.id,device:this.device,description:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}});if(generation!==this.generation){void this.rpc('end',{id:c.id,device:this.device,reason:'cancelled'}).catch(()=>{});return;}
    this.call=answered;this.flushCandidates();this.status='Connecting your little worlds…';this.detail='Finding the best route between you.';await this.queueCall(answered);
   }catch(e){if(generation===this.generation){this.cleanup();this.status='Couldn’t answer yet';this.setError(mediaError(e));void this.refresh();}}finally{this.busy=false;this.render();}
  }
  async fail(e){if(this.call&&this.ownsCall())void this.action('end',{reason:'failed'}).catch(()=>{});this.cleanup();this.call=null;this.busy=false;this.visible=true;this.status='The call was interrupted';this.detail='You can try again when you’re ready.';this.setError(mediaError(e));this.render();}
  async end(reason='hangup'){const c=this.call;if(c)this.endedIds.add(c.id);this.cleanup();this.call=null;this.busy=false;this.status=reason==='declined'?'Call declined':'Call ended';this.detail='A little closer, even from far away.';this.render();if(c)try{await this.rpc('end',{id:c.id,device:this.device,reason});}catch(e){this.setError('Your camera and microphone are off. The other window will time out if the end update cannot be delivered. '+e.message);}}
  cleanup(){this.generation++;clearTimeout(this.connectTimer);clearTimeout(this.disconnectTimer);this.connectedAt=0;if(this.pc){this.pc.onconnectionstatechange=null;this.pc.ontrack=null;this.pc.onicecandidate=null;this.pc.close();this.pc=null;}if(this.stream){this.stream.getTracks().forEach(t=>t.stop());this.stream=null;}this.local.srcObject=null;this.remote.onloadeddata=null;this.remote.srcObject=null;this.remote.muted=false;this.remoteReady=false;this.pendingCandidates=[];this.seenCandidates.clear();this.el('.nc-play-audio').hidden=true;}
  endKeepalive(){if(!this.call||!this.session||!this.ownsCall())return;const url=this.client.supabaseUrl,key=this.client.supabaseKey;if(url&&key)void fetch(url+'/rest/v1/rpc/nearly_call',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+this.session.access_token},body:JSON.stringify({action:'end',payload:{id:this.call.id,device:this.device,reason:'hangup'}})}).catch(()=>{});}
  async flipCamera(){if(!this.pc||!this.stream||this.flipping)return;this.flipping=true;const pc=this.pc,generation=this.generation;let next;try{const old=this.stream.getVideoTracks()[0],facing=old?.getSettings().facingMode==='environment'?'user':'environment';const video=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:640},height:{ideal:480}}});next=video.getVideoTracks()[0];if(generation!==this.generation){next.stop();return;}next.enabled=this.camera;const sender=pc.getSenders().find(s=>s.track?.kind==='video');if(!sender)throw Error('No video track is available');await sender.replaceTrack(next);if(generation!==this.generation){next.stop();return;}if(old){old.stop();this.stream.removeTrack(old);}this.stream.addTrack(next);this.local.srcObject=null;this.local.srcObject=this.stream;}catch(e){if(next)next.stop();this.setError('Could not switch cameras. '+mediaError(e));}finally{this.flipping=false;this.render();}}
  setError(message){put(this.el('.nc-error'),message);this.el('.nc-error').hidden=false;}
  clearError(){this.el('.nc-error').hidden=true;put(this.el('.nc-error'),'');}
  render(){
   if(this.destroyed)return;this.panel.hidden=!this.visible;this.panel.classList.toggle('nc-mini',this.minimized);this.panel.classList.toggle('nc-expanded',this.expanded);
   const incoming=this.call?.status==='ringing'&&this.call.callee_id===this.context?.user_id,owned=this.ownsCall(),hasMedia=!!this.stream;
   this.el('.nc-incoming').hidden=!incoming;this.el('.nc-controls').hidden=!hasMedia&&!this.busy;this.el('.nc-start').hidden=!!this.call||hasMedia||this.busy;
   this.el('.nc-placeholder').hidden=this.remoteReady;this.remote.hidden=!this.remoteReady;this.local.hidden=!hasMedia;this.el('.nc-video-label').hidden=!hasMedia;this.el('.nc-camera-off').hidden=!hasMedia||this.camera;
   const duration=this.connectedAt?Math.floor((Date.now()-this.connectedAt)/1000):0;put(this.el('.nc-status'),this.status+(this.connectedAt?' · '+String(Math.floor(duration/60)).padStart(2,'0')+':'+String(duration%60).padStart(2,'0'):''));
   put(this.el('.nc-detail'),!this.session?'Sign in to Nearly to call your partner.':!this.context?.paired?'Connect your accounts in Account & pairing first.':this.detail);
   this.el('[data-nc="start"]').disabled=this.busy||!this.context?.paired||this.networkFailed;this.el('[data-nc="answer"]').disabled=this.busy;
   for(const [name,on,label] of [['mic',this.mic,this.mic?'Mute microphone':'Unmute microphone'],['camera',this.camera,this.camera?'Turn camera off':'Turn camera on']]){const b=this.el('[data-nc="'+name+'"]');b.disabled=!hasMedia;b.innerHTML=icon(name==='mic'?'mic':'video',!on);b.setAttribute('aria-label',label);b.setAttribute('title',label);b.setAttribute('aria-pressed',String(!on));}
   this.el('[data-nc="flip"]').disabled=this.busy||this.flipping||!hasMedia;this.el('[data-nc="pip"]').hidden=!document.pictureInPictureEnabled;this.el('[data-nc="pip"]').disabled=!this.remoteReady;
   this.el('[data-nc="minimize"]').setAttribute('aria-label',this.minimized?'Restore call window':'Minimize call');this.el('[data-nc="expand"]').setAttribute('aria-label',this.expanded?'Restore window size':'Expand call');this.el('.nc-launch').classList.toggle('nc-is-live',!!this.call);put(this.el('.nc-launch span'),incoming?'Incoming call':this.call&&owned?'Return to call':'Call your person');this.layout();
  }
  layout(){if(!this.visible)return;const v=window.visualViewport,width=v?.width||innerWidth,height=v?.height||innerHeight;if(this.expanded){this.panel.style.left='8px';this.panel.style.top='8px';this.panel.style.width=Math.min(760,width-16)+'px';this.panel.style.maxHeight=(height-16)+'px';return;}this.panel.style.width='';this.panel.style.maxHeight=(height-16)+'px';const r=this.panel.getBoundingClientRect(),p=this.position||{x:width-r.width-20,y:height-r.height-(width<600?100:90)},next=clampPosition(p.x,p.y,r.width,r.height,{width,height});this.panel.style.left=next.x+'px';this.panel.style.top=next.y+'px';}
  async destroy(){this.destroyed=true;this.endKeepalive();this.cleanup();clearInterval(this.poll);clearInterval(this.clock);this.auth.data.subscription.unsubscribe();window.removeEventListener('resize',this.onResize);window.visualViewport?.removeEventListener('resize',this.onResize);window.removeEventListener('beforeunload',this.onUnload);window.removeEventListener('pagehide',this.onPageHide);await this.unsubscribe();this.root.remove();if(global.NearlyCalls.instance===this)global.NearlyCalls.instance=null;}
 }
 global.NearlyCalls={mount(client){if(this.instance&&!this.instance.destroyed)return this.instance;return this.instance=new CallWidget(client);},clampPosition};
 if(typeof cloud!=='undefined'&&cloud)global.NearlyCalls.mount(cloud);
})(window);
