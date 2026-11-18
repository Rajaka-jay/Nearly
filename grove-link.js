const refineShellBeforeGrove=refineShell;
refineShell=function(){refineShellBeforeGrove();const nav=document.querySelector('#nav');if(nav&&!nav.querySelector('[data-grove]'))nav.insertAdjacentHTML('beforeend','<a data-grove href="grove/">'+uiIcon('sprout')+'<span>Couple Grove</span></a>')};
water=function(){location.href='grove/'};
refineShell();
