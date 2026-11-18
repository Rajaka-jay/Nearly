/* Nearly private chat. The server owns authorship, receipts, and deletion. */
(function(){
 const icons={send:'<path d="m22 2-7 20-4-9-9-4Zm0 0L11 13"/>',search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',reply:'<path d="m9 4-6 6 6 6M3 10h9a8 8 0 0 1 8 8"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',smile:'<circle cx="12" cy="12" r="9"/><path d="M8 14c2 3 6 3 8 0M8 9h.01M16 9h.01"/>',video:'<rect x="3" y="6" width="12" height="12" rx="3"/><path d="m15 10 6-3v10l-6-3"/>',heart:'<path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-4 5 3 10 8 15 5-5 12-10 8-15Z"/>',down:'<path d="m6 9 6 6 6-6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>'};
 const icon=n=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[n]||''}</svg>`;
 const setText=(el,value)=>{if(el.textContent!==value)el.textContent=value;};
 const htmlCache=new WeakMap();
 const setHTML=(el,value)=>{if(htmlCache.get(el)!==value){el.innerHTML=value;htmlCache.set(el,value);}};
 const time=s=>{const d=new Date(s);return Number.isNaN(d.getTime())?'':d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});};
 const date=s=>{const d=new Date(s),now=new Date();if(d.toDateString()===now.toDateString())return 'Today';now.setDate(now.getDate()-1);return d.toDateString()===now.toDateString()?'Yesterday':d.toLocaleDateString([],{day:'numeric',month:'short',year:'numeric'});};
 class Chat{
  constructor(client){this.client=client;this.items=new Map();this.pending=new Map();this.context=null;this.root=null;this.draft='';this.reply=null;this.query='';this.nearBottom=true;this.loading=false;this.loaded=false;this.hasOlder=true;this.busy=false;this.reading=false;this.lastTyping=0;this.seen=new Set();this.viewVersion=0;this.channel=null;this.channelKey=null;this.lastRead=0;this.error='';this.notice='';this.epoch=0;
   this.auth=client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){this.epoch++;this.items.clear();this.pending.clear();this.context=null;this.badge();this.draft='';this.reply=null;this.loaded=false;this.clearChannel();this.paint();}});
   this.timer=setInterval(()=>void this.refresh(),3000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)void this.refresh();});
  }
  async rpc(action,payload={}){const {data,error}=await this.client.rpc('nearly_chat',{action,payload});if(error)throw error;return data;}
  active(){return this.root?.isConnected&&page==='messages'&&chatTab==='chat';}
  partner(){return this.context?.owner?(state.partner||'Your person'):(state.name||'Your person');}
  mount(){
   if(document.querySelector('#nearly-chat')){this.root=document.querySelector('#nearly-chat');this.paint();void this.refresh();return;}
   document.querySelector('#app').innerHTML=heading('Your little conversation','For everyday hellos, and everything in between.')+`<div class="tabs"><button class="filter active" onclick="chatTab='chat';messages()">Chat</button><button class="filter" onclick="chatTab='letters';messages()">Letters</button><button class="filter" onclick="chatTab='scheduled';messages()">Scheduled</button></div><section id="nearly-chat" aria-label="Private partner chat"><header class="nchat-header"><span class="nchat-avatar">♡</span><div class="nchat-person"><h2>Your person</h2><p class="nchat-connection" role="status">Connecting your conversation…</p></div><button type="button" data-chat="call" class="nchat-icon" aria-label="Video call">${icon('video')}</button><button type="button" data-chat="search" class="nchat-icon" aria-label="Search messages">${icon('search')}</button><details class="nchat-chatmenu"><summary aria-label="Chat options">${icon('more')}</summary><div><button type="button" data-chat="clear">${icon('trash')} Clear my chat</button><button type="button" data-chat="refresh">Reconnect</button></div></details></header><div class="nchat-search" hidden><label for="nchat-search">Search loaded messages</label><input id="nchat-search" type="search" placeholder="Find a little moment…" autocomplete="off"><button type="button" data-chat="close-search" aria-label="Close search">${icon('close')}</button></div><div class="nchat-alert" role="alert" hidden></div><div class="nchat-notice" role="status" hidden></div><div class="nchat-history"><div class="nchat-messages" role="log" aria-label="Conversation" aria-live="off"></div><button type="button" class="nchat-new" data-chat="bottom" hidden>${icon('down')} New messages</button></div><div class="nchat-reply" hidden></div><div class="nchat-emoji" hidden>${['❤️','🥰','😘','🌷','🤗','✨','😂','💜'].map(e=>`<button type="button" data-chat="emoji" data-emoji="${e}" aria-label="Insert ${e}">${e}</button>`).join('')}</div><form class="nchat-compose"><button type="button" class="nchat-icon" data-chat="emoji-toggle" aria-label="Choose an emoji" aria-expanded="false">${icon('smile')}</button><textarea id="nchat-input" rows="1" maxlength="4000" aria-label="Message your partner" placeholder="A little message for your person…"></textarea><button type="submit" class="nchat-send" aria-label="Send message">${icon('send')}</button></form><div class="nchat-hint">Enter to send · Shift + Enter for a new line</div><span class="nchat-announcer" aria-live="polite"></span></section>`;
   this.root=document.querySelector('#nearly-chat');this.$=s=>this.root?.querySelector(s);this.$('#nchat-input').value=this.draft;this.$('#nchat-search').value=this.query;
   this.root.addEventListener('click',e=>{const b=e.target.closest('[data-chat]');if(b&&!b.disabled){b.closest('details')?.removeAttribute('open');void this.click(b.dataset.chat,b.dataset.id,b);}});
   this.root.addEventListener('toggle',e=>{const d=e.target;if(!d.matches?.('.nchat-message-menu'))return;if(!d.open){this.paint();return;}const menu=d.querySelector('div'),bottom=this.$('.nchat-history').getBoundingClientRect().bottom;menu.style.top='29px';menu.style.bottom='auto';if(menu.getBoundingClientRect().bottom>bottom){menu.style.top='auto';menu.style.bottom='30px';}},true);
   this.$('.nchat-compose').addEventListener('submit',e=>{e.preventDefault();void this.send();});
   this.$('#nchat-input').addEventListener('input',e=>{this.draft=e.target.value;this.resizeInput();void this.typing(!!this.draft.trim());});
   this.$('#nchat-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();void this.send();}});
   this.$('#nchat-search').addEventListener('input',e=>{this.query=e.target.value;this.paint(true);});
   this.$('#nchat-search').addEventListener('keydown',e=>{if(e.key==='Escape')void this.click('close-search');});
   this.$('.nchat-messages').addEventListener('scroll',()=>{const b=this.$('.nchat-messages');this.nearBottom=b.scrollHeight-b.clientHeight-b.scrollTop<90;if(this.nearBottom){this.$('.nchat-new').hidden=true;void this.read();}});
   this.paint();void this.refresh();
  }
  badge(){const a=document.querySelector('#nav a[href="#messages"]');if(!a)return;a.querySelector('.nchat-unread')?.remove();if(!this.context?.paired)return;const unread=[...this.items.values()].filter(m=>m.sender_id!==this.context.user_id&&Number(m.seq)>Math.max(Number(this.context.read_seq),this.lastRead)&&!m.deleted_at).length;if(unread){const b=document.createElement('span');b.className='nchat-unread';b.textContent=unread>49?'50+':String(unread);b.setAttribute('aria-label',b.textContent+' unread messages');a.append(b);}}
  clearChannel(){if(this.channel)void this.client.removeChannel(this.channel);this.channel=null;this.channelKey=null;}
  subscribe(room){if(this.channelKey===room)return;this.clearChannel();this.channelKey=room;this.channel=this.client.channel('nearly-chat:'+room).on('postgres_changes',{event:'*',schema:'public',table:'nearly_chat_messages',filter:'space_id=eq.'+room},()=>void this.refresh()).subscribe(status=>{this.live=status==='SUBSCRIBED';if(this.active())this.paint();});}
  async refresh(before){
   if(this.loading)return;this.loading=true;const epoch=this.epoch,version=this.viewVersion;
   try{const {data,error}=await this.client.auth.getSession();if(error)throw error;if(!data.session){this.context=null;this.items.clear();this.pending.clear();this.loaded=true;this.error='Sign in and connect with your partner to start chatting.';this.paint();return;}
    const result=await this.rpc('get',{...(before?{before}:{}),visible_ids:before?[]:[...this.items.keys()].slice(-500)});if(epoch!==this.epoch||version!==this.viewVersion)return;
    const old=this.context,key=result.user_id+':'+result.space_id+':'+result.peer_id,oldKey=old&&old.user_id+':'+old.space_id+':'+old.peer_id;
    if(oldKey&&key!==oldKey){this.items.clear();this.pending.clear();this.draft='';this.reply=null;this.lastRead=0;this.hasOlder=true;this.seen.clear();if(this.active())this.$('#nchat-input').value='';}
    if(!before&&!this.items.size&&result.messages.length<50)this.hasOlder=false;this.context=result;this.loaded=true;this.error='';if(!result.paired){this.items.clear();this.pending.clear();this.clearChannel();this.paint();return;}
    const newestBefore=Math.max(0,...[...this.items.values()].map(m=>Number(m.seq)));
    const incoming=result.messages.filter(m=>m.sender_id!==result.user_id&&!this.items.has(m.id)&&!m.deleted_at);
    if(!before&&this.items.size&&result.messages.length&&Math.min(...result.messages.map(m=>Number(m.seq)))>newestBefore+1){this.items.clear();this.hasOlder=true;}
    for(const m of result.messages){this.items.set(m.id,m);this.pending.delete(m.request_id);}
    for(const [id,m] of this.items)if(Number(m.seq)<=Number(result.cleared_seq)||result.hidden_ids.includes(id))this.items.delete(id);
    if(before)this.hasOlder=result.messages.length===50;
    this.subscribe(result.space_id);this.badge();
    if(old&&incoming.length){if(this.active())this.$('.nchat-announcer').textContent='New message from your person.';if(document.hidden&&localStorage.getItem('nearly-browser-alerts')==='yes'&&window.Notification?.permission==='granted')try{new Notification('Nearly',{body:'You have a new message in your shared chat.',tag:'nearly-chat'});}catch{/* Alerts are optional. */}}
    this.paint(false,!!before);if(this.active()&&this.nearBottom)void this.read();
   }catch(e){this.error=e.message+' Your unsent messages are kept here. Use Reconnect to try again.';this.paint();}finally{this.loading=false;}
  }
  resizeInput(){const el=this.$('#nchat-input');if(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,120)+'px';}}
  async typing(active){if(!this.context?.paired||(!active&&this.lastTyping===0)||Date.now()-this.lastTyping<2500&&active)return;this.lastTyping=active?Date.now():0;try{await this.rpc('typing',{active});}catch{/* Typing is transient, sending reports errors separately. */}}
  async send(request){
   if(!this.context?.paired)return;let p=request?this.pending.get(request):null;
   if(!p){const body=this.draft.trim();if(!body)return;if(body.length>4000){this.error='Keep this message under 4000 characters.';this.paint();return;}p={request_id:crypto.randomUUID(),id:'pending',body,reply_to:this.reply,created_at:new Date().toISOString(),sender_id:this.context.user_id,status:'sending'};this.pending.set(p.request_id,p);this.draft='';this.reply=null;if(this.active()){this.$('#nchat-input').value='';this.resizeInput();}this.nearBottom=true;}
   if(p.sending)return;p.sending=true;p.status='sending';this.paint();const epoch=this.epoch;
   try{const m=await this.rpc('send',{request_id:p.request_id,body:p.body,reply_to:p.reply_to});if(epoch!==this.epoch)return;this.pending.delete(p.request_id);this.items.set(m.id,m);this.error='';void this.typing(false);this.paint();if(this.active())this.$('#nchat-input').focus();}
   catch(e){if(epoch===this.epoch){p.status='failed';p.sending=false;this.error=e.message;this.paint();}}
  }
  async read(){if(this.reading||!this.active()||document.hidden||!document.hasFocus()||!this.nearBottom||this.query||!this.context?.paired)return;const upto=Math.max(0,...[...this.items.values()].map(m=>Number(m.seq)));if(upto<=Math.max(this.lastRead,Number(this.context.read_seq)))return;this.reading=true;try{await this.rpc('read',{upto});this.lastRead=upto;this.badge();}catch{/* Retry the receipt next refresh. */}finally{this.reading=false;}}
  async change(action,payload={}){if(this.busy)return false;this.busy=true;this.viewVersion++;try{await this.rpc(action,payload);this.error='';return true;}catch(e){this.error=e.message;return false;}finally{this.busy=false;}}
  async click(action,id,button){
   if(action==='call'){window.NearlyCalls?.instance?.click('open');return;}
   if(action==='search'){this.$('.nchat-search').hidden=!this.$('.nchat-search').hidden;if(!this.$('.nchat-search').hidden)this.$('#nchat-search').focus();return;}
   if(action==='close-search'){this.query='';this.$('#nchat-search').value='';this.$('.nchat-search').hidden=true;this.paint(true);return;}
   if(action==='emoji-toggle'){const open=this.$('.nchat-emoji').hidden;this.$('.nchat-emoji').hidden=!open;button.setAttribute('aria-expanded',String(open));return;}
   if(action==='emoji'){const input=this.$('#nchat-input'),start=input.selectionStart,end=input.selectionEnd;input.setRangeText(button.dataset.emoji,start,end,'end');this.draft=input.value;this.resizeInput();input.focus();void this.typing(true);return;}
   if(action==='bottom'){this.nearBottom=true;this.toBottom();void this.read();return;}
   if(action==='refresh'){await this.refresh();return;}
   if(action==='older'){const before=Math.min(...[...this.items.values()].map(m=>Number(m.seq)));await this.refresh(before);return;}
   if(action==='retry'){await this.send(id);return;}
   if(action==='edit-failed'){const p=this.pending.get(id);if(p){this.draft=p.body;this.reply=this.items.has(p.reply_to)&&!this.items.get(p.reply_to).deleted_at?p.reply_to:null;this.pending.delete(id);this.$('#nchat-input').value=this.draft;this.paint();this.$('#nchat-input').focus();}return;}
   if(action==='cancel-reply'){this.reply=null;this.paint();return;}
   const m=this.items.get(id);
   if(action==='reply'&&m&&!m.deleted_at){this.reply=id;this.paint();this.$('#nchat-input').focus();return;}
   if(action==='copy'&&m){try{await navigator.clipboard.writeText(m.body);this.notice='Message copied.';}catch{this.error='Copy is unavailable in this browser. Select the message text to copy it.';}this.paint();return;}
   if(action==='hide'&&m){if(await this.change('hide',{id})){this.items.delete(id);this.notice='Message deleted for you. ';this.undo=id;}this.paint();return;}
   if(action==='undo'&&this.undo){if(await this.change('unhide',{id:this.undo})){this.undo=null;this.notice='Message restored.';await this.refresh();}this.paint();return;}
   if(action==='delete'&&m){this.confirm('Delete for everyone?','This removes the text from both sides of this conversation. It cannot be undone.','Delete for everyone',async()=>{if(await this.change('delete_everyone',{id})){m.body='';m.deleted_at=new Date().toISOString();dialog.close();this.paint();}else this.confirmError();});return;}
   if(action==='clear'){const upto=Math.max(0,...[...this.items.values()].map(m=>Number(m.seq)));this.confirm('Clear your chat?','Messages up to this point will disappear from your view. Your partner keeps their copy. New messages will still arrive.','Clear my chat',async()=>{if(await this.change('clear',{upto})){for(const [key,m]of this.items)if(Number(m.seq)<=upto)this.items.delete(key);this.context.hide_legacy=true;this.context.cleared_seq=upto;this.reply=null;this.undo=null;dialog.close();this.notice='Your chat was cleared. Your partner’s copy is unchanged.';this.paint();await this.refresh();}else this.confirmError();});}
  }
  confirm(title,description,label,callback){modal(`<div class="nchat-confirm"><h2>${title}</h2><p class="sub">${description}</p><p class="nchat-confirm-error" role="alert"></p><div><button type="button" class="btn light" id="nchat-cancel">Cancel</button><button type="button" class="btn" id="nchat-confirm">${label}</button></div></div>`);document.querySelector('#nchat-cancel').onclick=()=>dialog.close();document.querySelector('#nchat-confirm').onclick=async e=>{e.target.disabled=true;await callback();e.target.disabled=false;};}
  confirmError(){const e=document.querySelector('.nchat-confirm-error');if(e)e.textContent=this.error;}
  toBottom(){const b=this.$('.nchat-messages');if(b){b.scrollTop=b.scrollHeight;this.$('.nchat-new').hidden=true;}}
  bubble(m,pending=false){
   const own=m.sender_id===this.context.user_id,deleted=!!m.deleted_at,reply=m.reply_to&&this.items.get(m.reply_to),read=own&&Number(m.seq)<=Number(this.context.partner_read_seq);
   const replyHTML=reply?`<div class="nchat-quote"><b>${reply.sender_id===this.context.user_id?'You':esc(this.partner())}</b><span>${reply.deleted_at?'Message deleted':esc(reply.body.slice(0,140))}</span></div>`:'';
   const menu=pending?'':`<details class="nchat-message-menu"><summary aria-label="Message options">${icon('more')}</summary><div>${!deleted?`<button type="button" data-chat="reply" data-id="${m.id}">${icon('reply')} Reply</button><button type="button" data-chat="copy" data-id="${m.id}">Copy text</button>`:''}<button type="button" data-chat="hide" data-id="${m.id}">${icon('trash')} Delete for me</button>${own&&!deleted?`<button type="button" data-chat="delete" data-id="${m.id}">Delete for everyone</button>`:''}</div></details>`;
   const status=pending?(m.status==='failed'?'Not sent':'Sending…'):own?(read?'Read':'Sent'):'';
   return `<article class="nchat-row ${own?'nchat-own':'nchat-theirs'}" ${pending?'':`data-message-id="${m.id}"`}><div class="nchat-bubble ${deleted?'nchat-deleted':''}">${menu}${replyHTML}<p>${deleted?'♡ This message was deleted':esc(m.body)}</p><div class="nchat-meta"><time datetime="${esc(m.created_at)}">${time(m.created_at)}</time>${status?`<span class="${read?'nchat-read':''}" aria-label="${status}">${esc(status)} ${own&&!pending?(read?'✓✓':'✓'):''}</span>`:''}</div>${pending&&m.status==='failed'?`<div class="nchat-retry"><button type="button" data-chat="retry" data-id="${m.request_id}">Retry</button><button type="button" data-chat="edit-failed" data-id="${m.request_id}">Edit</button></div>`:''}</div></article>`;
  }
  paint(force=false,older=false){
   if(!this.active())return;const b=this.$('.nchat-messages'),oldHeight=b.scrollHeight,oldTop=b.scrollTop;
   setText(this.$('.nchat-person h2'),this.partner());setText(this.$('.nchat-avatar'),this.partner().slice(0,1).toUpperCase());
   setText(this.$('.nchat-connection'),this.context?.typing?'typing…':this.context?.paired?(this.error?'Reconnecting · your draft is safe':this.live?'Connected · just the two of you':'Private chat · checking for updates'):'Your private space for two');
   this.$('.nchat-alert').hidden=!this.error;setText(this.$('.nchat-alert'),this.error);
   this.$('.nchat-notice').hidden=!this.notice;setHTML(this.$('.nchat-notice'),esc(this.notice)+(this.undo?'<button type="button" data-chat="undo">Undo</button>':''));
   this.$('.nchat-send').disabled=!this.context?.paired;this.$('#nchat-input').disabled=!this.context?.paired;
   const rows=[...this.items.values()].sort((a,b)=>Number(a.seq)-Number(b.seq)),query=this.query.toLocaleLowerCase(),filtered=rows.filter(m=>!query||!m.deleted_at&&m.body.toLocaleLowerCase().includes(query));
   const signature=JSON.stringify([filtered,[...this.pending.values()],this.context?.partner_read_seq,this.context?.hide_legacy,this.loaded,this.hasOlder,this.context?.paired,this.context?.user_id,query]);
   if((force||b.dataset.signature!==signature)&&!(b.querySelector('.nchat-message-menu[open]')&&!force&&!older)){
    const earlier=Array.isArray(state.messages)?state.messages:[];let html='';if(!this.loaded)html='<div class="nchat-empty" role="status">Opening your conversation…</div>';else if(!this.context?.paired)html='<div class="nchat-empty">'+icon('heart')+'<h3>A little room for your words.</h3><p>Sign in and connect your accounts to chat.</p><button type="button" class="btn light" onclick="cloud?spaceRecord?account():login():location.reload()">Account & pairing</button></div>';
    else if(!this.loaded)html='<div class="nchat-empty" role="status">Opening your conversation…</div>';
    else{
     if(rows.length&&this.hasOlder&&!query)html+='<button type="button" class="nchat-older" data-chat="older">Load earlier messages</button>';
     if(earlier.length&&!this.context.hide_legacy&&!query)html+=`<details class="nchat-legacy"><summary>Earlier conversation · ${earlier.length} messages</summary><p>Saved before sender details were available. Kept read-only.</p>${earlier.map(m=>`<div><p>${esc(m.text)}</p><small>${date(m.date)} · ${time(m.date)}</small></div>`).join('')}</details>`;
     if(query)html+=`<p class="nchat-search-count">${filtered.length} matching messages in loaded history</p>`;
     if(!filtered.length&&!this.pending.size&&!query)html+='<div class="nchat-empty">'+icon('heart')+'<h3>A little hello goes a long way.</h3><p>Send your person something to smile about.</p></div>';
     let day='';for(const m of filtered){const current=date(m.created_at);if(day!==current){day=current;html+=`<div class="nchat-day"><span>${esc(day)}</span></div>`;}html+=this.bubble(m);}if(!query)for(const p of this.pending.values())html+=this.bubble(p,true);
    }
    b.innerHTML=html;b.dataset.signature=signature;
    if(older)b.scrollTop=oldTop+b.scrollHeight-oldHeight;else if(this.nearBottom&&!query)this.toBottom();else{b.scrollTop=oldTop;if(b.scrollHeight>oldHeight)this.$('.nchat-new').hidden=false;}
   }
   const reply=this.items.get(this.reply);if(this.reply&&(!reply||reply.deleted_at))this.reply=null;this.$('.nchat-reply').hidden=!reply||!!reply.deleted_at;setHTML(this.$('.nchat-reply'),reply&&!reply.deleted_at?`${icon('reply')}<div><b>Replying to ${reply.sender_id===this.context?.user_id?'you':esc(this.partner())}</b><span>${esc(reply.body.slice(0,150))}</span></div><button type="button" data-chat="cancel-reply" aria-label="Cancel reply">${icon('close')}</button>`:'');
  }
 }
 const oldMessages=messages;let chat;
 messages=function(){if(chatTab!=='chat'){oldMessages();return;}if(!cloud){oldMessages();return;}chat=chat||new Chat(cloud);chat.mount();};
 if(cloud){chat=new Chat(cloud);void chat.refresh();}
 const previousShell=refineShell;refineShell=function(){previousShell();chat?.badge();};
 window.NearlyChat={open(){chatTab='chat';location.hash='messages';messages();}};
 if(location.hash==='#messages')messages();
})();
