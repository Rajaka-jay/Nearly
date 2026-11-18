// The shell owns the call; Grove's frame can change without interrupting media.
const refineShellBeforeGrove=refineShell;
refineShell=function(){refineShellBeforeGrove();const nav=document.querySelector('#nav');if(nav&&!nav.querySelector('[data-grove]'))nav.insertAdjacentHTML('beforeend','<a data-grove href="#grove" '+(location.hash==='#grove'?'class="active" aria-current="page"':'')+'>'+uiIcon('sprout')+'<span>Couple Grove</span></a>')};
const navigateBeforeGrove=navigate;
navigate=function(){if(location.hash!=='#grove'){document.body.classList.remove('viewing-grove');navigateBeforeGrove();return;}page='grove';document.body.classList.add('viewing-grove');refineShell();document.querySelector('#page-name').textContent='Couple Grove';if(!document.querySelector('#nearly-grove-frame'))document.querySelector('#app').innerHTML='<iframe id="nearly-grove-frame" title="Your Couple Grove garden" src="grove/?embedded=1" allow="camera; microphone; fullscreen; picture-in-picture"></iframe>';};
window.onhashchange=navigate;
water=function(){location.hash='grove'};
navigate();
