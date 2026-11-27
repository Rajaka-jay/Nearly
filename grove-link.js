// The shell owns the call; Grove's frame can change without interrupting media.
const refineShellBeforeGrove=refineShell;
refineShell=function(){refineShellBeforeGrove();const nav=document.querySelector('#nav');if(nav&&!nav.querySelector('[data-grove]'))nav.insertAdjacentHTML('beforeend','<a data-grove href="#grove" '+(location.hash==='#grove'?'class="active" aria-current="page"':'')+'>'+uiIcon('sprout')+'<span>Couple Grove</span></a>')};
const navigateBeforeGrove=navigate;
navigate=function(){if(location.hash!=='#grove'){document.body.classList.remove('viewing-grove','grove-fullscreen');navigateBeforeGrove();return;}page='grove';document.body.classList.add('viewing-grove');refineShell();document.querySelector('#page-name').textContent='Couple Grove';if(!document.querySelector('#nearly-grove-frame'))document.querySelector('#app').innerHTML='<iframe id="nearly-grove-frame" title="Your Couple Grove garden" src="grove/?embedded=1" allow="camera; microphone; fullscreen; picture-in-picture"></iframe>';};
window.onhashchange=navigate;
water=function(){location.hash='grove'};
navigate();

// Only the active same-origin Grove frame can expand the shell viewport.
let groveExpandedScroll=null;
window.addEventListener('message',event=>{const frame=document.querySelector('#nearly-grove-frame');if(event.origin!==location.origin||event.source!==frame?.contentWindow||location.hash!=='#grove'||event.data?.type!=='nearly:grove-immersive'||typeof event.data.enabled!=='boolean')return;if(event.data.enabled&&!document.body.classList.contains('grove-fullscreen'))groveExpandedScroll=window.scrollY;document.body.classList.toggle('grove-fullscreen',event.data.enabled);if(!event.data.enabled&&groveExpandedScroll!==null){const y=groveExpandedScroll;groveExpandedScroll=null;requestAnimationFrame(()=>window.scrollTo(0,y))}});
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('grove-fullscreen')){document.body.classList.remove('grove-fullscreen');document.querySelector('#nearly-grove-frame')?.contentWindow?.postMessage({type:'nearly:grove-exit-immersive'},location.origin)}});
