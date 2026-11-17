// Opt-in browser alerts for new shared activity while Nearly is open.
(function(){
 const KEY='nearly-browser-alerts';
 function attach(){
  const modal=document.querySelector('#modal');
  if(!modal||!modal.textContent.includes('Your shared space')||modal.querySelector('#enable-alerts'))return;
  const b=document.createElement('button');b.id='enable-alerts';b.className='btn light';b.textContent=localStorage.getItem(KEY)==='yes'?'Alerts enabled':'Enable browser alerts';
  modal.append(b);b.onclick=async()=>{if(!('Notification'in window)){toast('Browser notifications are not supported here.');return}const p=await Notification.requestPermission();if(p==='granted'){localStorage.setItem(KEY,'yes');b.textContent='Alerts enabled';toast('Browser alerts are enabled while Nearly is open.')}else toast('Allow notifications in your browser settings to enable alerts.')};
 }
 new MutationObserver(attach).observe(document.querySelector('#modal'),{childList:true,subtree:true});
 let previous='';
 setInterval(()=>{if(!spaceRecord?.paired||!state?.rooms)return;const now=JSON.stringify(state.rooms);if(previous&&now!==previous&&document.hidden&&localStorage.getItem(KEY)==='yes'&&Notification.permission==='granted')new Notification('Nearly',{body:'There’s a new update in your shared space.',tag:'nearly-update'});previous=now},1500);
})();
