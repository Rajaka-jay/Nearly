// A single icon vocabulary for navigation, controls and activity cards.
function uiIcon(name, cls='') {
  const paths={
    home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1Z"/>',
    heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    play:'<path d="M6 7h12a3 3 0 0 1 3 2.7l1 7a2 2 0 0 1-3.3 1.8L16 16H8l-3.7 2.5A2 2 0 0 1 1 16.7l1-7A3 3 0 0 1 6 7Z"/><path d="M7 10v5m-2.5-2.5h5M16 11h.01M19 14h.01"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
    sprout:'<path d="M12 21v-8C5 14 3 10 3 6c6 0 9 2 9 7Zm0 2c0-7 3-10 9-10 0 6-3 9-9 10ZM7 21h10"/>',
    sparkles:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM21 2v4m-2-2h4"/>',
    star:'<path d="m12 3 2.8 5.6 6.2.9-4.5 4.4 1 6.1-5.5-2.9L6.5 20l1-6.1L3 9.5l6.2-.9Z"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    moon:'<path d="M20.5 13a8.5 8.5 0 0 1-9.5-9.5A8.5 8.5 0 1 0 20.5 13Z"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    settings:'<path d="m9 3-.5 3-3 1L3 6l-1 4 2.5 2L4 15l-2 2 3 3 3-1 2 2h4l1-3 3-1 3 1 1-4-2.5-2 .5-3 2-2-3-3-3 1-2-2Z"/><circle cx="12" cy="12" r="3"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    coffee:'<path d="M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5ZM17 9h2a3 3 0 0 1 0 6h-2M7 2v3m5-3v3"/>',
    pencil:'<path d="m4 16 12-12 4 4L8 20l-5 1Zm9-9 4 4M4 16l4 4"/>',
    book:'<path d="M12 5v16M3 3c5 0 9 2 9 2s4-2 9-2v16c-5 0-9 2-9 2s-4-2-9-2Z"/>',
    music:'<path d="M9 18V5l12-2v13M9 8l12-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="18" cy="16" rx="3" ry="2"/>',
    message:'<path d="M21 12a9 9 0 0 1-9 9 11 11 0 0 1-4-.8L3 22l1.8-5A9 9 0 1 1 21 12Z"/><path d="M8 12h8"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'
  };
  return `<svg class="ui-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.sparkles}</svg>`;
}
const originalPageNavigate=navigate;
navigate=function(){originalPageNavigate();refineShell()};
window.onhashchange=navigate;
function refineShell(){
  const navNames={home:'Home',play:'Play',messages:'Messages',memories:'Memories',space:'Our Space'};
  $('#nav').setAttribute('aria-label','Main navigation');
  $('#nav').innerHTML=pages.map(([id])=>`<a href="#${id}" class="${page===id?'active':''}" ${page===id?'aria-current="page"':''}>${uiIcon({home:'home',play:'play',messages:'mail',memories:'image',space:'sprout'}[id])}<span>${navNames[id]}</span></a>`).join('');
  const brand=document.querySelector('.brand');brand.innerHTML=uiIcon('sparkles')+'<span>nearly</span>';
  document.querySelector('.tagline').textContent='A LITTLE WORLD FOR TWO';
  const couple=document.querySelector('.couple');couple.innerHTML=`<span class="space-heart">${uiIcon('heart')}</span><div>Our little world<small>${esc(state.name)} & ${esc(state.partner)}</small></div>`;
  document.querySelector('.settings').innerHTML=uiIcon('settings')+'<span>Settings & privacy</span>';
  const profile=document.querySelector('[aria-label="Profile settings"]');if(profile)profile.textContent=state.name.slice(0,1).toUpperCase();
  if(page!=='home')document.querySelectorAll('.activity .art').forEach((el,i)=>{const title=el.parentElement?.querySelector('h3')?.textContent;const a=catalog.find(x=>x.name===title);if(a){el.classList.add('activity-art');el.innerHTML=activityArt(a.id)}});
}
function activityIcon(id){return ({guess:'message',roulette:'sparkles',match:'grid',ttt:'grid',rather:'heart',truths:'message',letter:'mail',draw:'pencil',focus:'coffee',watch:'play',cook:'coffee',book:'book',questions:'message',playlist:'music',chess:'play',four:'grid',reversi:'sprout',pebbles:'sparkles'})[id]||'sparkles'}
function uiTimeZone(zone){try{return new Intl.DateTimeFormat('en',{timeZone:zone,timeZoneName:'short'}).formatToParts(new Date()).find(x=>x.type==='timeZoneName').value+' · '+zone.replaceAll('_',' ')}catch{return zone}}
function uiClock(name,zone,partner=false){return `<article class="day-clock ${partner?'partner-clock':''}"><span class="clock-emblem">${uiIcon(partner?'moon':'sun')}</span><div><span class="eyebrow">${partner?'THEIR DAY':'YOUR DAY'}</span><strong data-zone="${esc(zone)}">${clock(zone)}</strong><p>${esc(name)} · ${new Intl.DateTimeFormat('en',{timeZone:zone,weekday:'long'}).format(new Date())}</p></div><span class="zone-label">${esc(uiTimeZone(zone))}</span></article>`}
world=function(){return `<div class="illustrated-world"><img src="assets/shared-sky.webp" alt="Two warm cottages joined by a garden path beneath a lavender evening sky" width="1774" height="887" fetchpriority="high"><a class="sky-hotspot sky-memory" href="#memories">${uiIcon('star')}<span>Memory stars</span></a><a class="sky-hotspot sky-mail" href="#messages">${uiIcon('mail')}<span>Mailbox</span></a><a class="sky-hotspot sky-play" href="#play">${uiIcon('play')}<span>Play</span></a><button class="sky-hotspot sky-reunion" onclick="reunion()">${uiIcon('pin')}<span>Next hello</span></button><button class="sky-hotspot sky-garden" onclick="water()">${uiIcon('sprout')}<span>Garden</span></button><div class="sky-caption">${uiIcon('sparkles')}<span>A small world, made of the moments you leave here.</span></div></div>`};
let sparkSkipped=false;
home=function(){
  const date=new Intl.DateTimeFormat('en',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
  const latest=state.memories.at(-1);
  const nextDate=state.reunion?new Date(state.reunion+'T00:00:00'):null;
  const days=nextDate?Math.max(0,Math.ceil((nextDate-Date.now())/86400000)):null;
  $('#app').innerHTML=`<div class="home-heading"><div><p class="eyebrow">${esc(date.toUpperCase())}</p><h1>Two places. One little world.</h1><p class="page-intro">A little room for your day and ${esc(state.partner)}’s—and a path between them.</p></div><button class="btn light" onclick="location.hash='messages'">${uiIcon('mail')} Leave a note</button></div>
  <section class="dual-days" aria-label="Your local times">${uiClock(state.name,state.zone)}<span class="clock-connection">${uiIcon('star')}<small>Under one sky</small></span>${uiClock(state.partner,state.partnerZone,true)}</section>
  <div class="new-home-grid"><section class="sky-section"><div class="section-heading"><div><p class="eyebrow">YOUR SHARED SKY</p><h2>Our little universe</h2></div><a href="#space" class="link">Visit Our Space ${uiIcon('arrow-right')}</a></div>${world()}</section><div class="daily-column"><section class="daily-card"><div class="daily-card-top"><span class="daily-symbol">${uiIcon('sparkles')}</span><span>${uiIcon('clock')} A few minutes</span></div><p class="eyebrow">TODAY’S DAILY SPARK</p><h2>A tiny question for your two different days.</h2><p class="daily-question">What’s one little thing you wish we could do together today?</p><button class="btn" onclick="spark()">${state.spark.answer?'Read your shared answer':'Answer your Spark'} ${uiIcon('arrow-right')}</button><button class="skip-spark" onclick="sparkSkipped=!sparkSkipped;home()">${sparkSkipped?'Come back whenever you feel like it.':'Skip for now · no streaks here'}</button></section><button class="reunion-strip" onclick="reunion()"><span class="reunion-emblem">${uiIcon('pin')}</span><div><p class="eyebrow">A DATE TO LOOK FORWARD TO</p><strong>${days===null?'Make your next hello a date':days+' days until our next hello'}</strong><small>${nextDate?esc(state.city)+' · '+esc(state.reunion):'A little something to look forward to.'}</small></div>${uiIcon('arrow-right')}</button></div></div>
  <div class="connection-cards"><button class="connection-card" onclick="letter()"><span class="connection-icon peach-icon">${uiIcon('mail')}</span><div><p class="eyebrow">A LITTLE HELLO</p><h3>Some words are worth keeping.</h3><p>Leave a letter for another day.</p></div>${uiIcon('arrow-right')}</button><a class="connection-card" href="#memories"><span class="connection-icon">${uiIcon('star')}</span><div><p class="eyebrow">YOUR LATEST LITTLE STAR</p><h3>${latest?esc(latest.title):'Save the moments that matter.'}</h3><p>${latest?'A little memory to come back to.':'Start with a photo or a story.'}</p></div>${uiIcon('arrow-right')}</a><button class="connection-card" onclick="water()"><span class="connection-icon green-icon">${uiIcon('sprout')}</span><div><p class="eyebrow">WHEN YOU FEEL LIKE IT</p><h3>Growing a little world.</h3><p>${state.water} moments of care, at your pace.</p></div>${uiIcon('arrow-right')}</button></div>
  <div class="section-heading activity-heading"><div><p class="eyebrow">A LITTLE TIME TOGETHER</p><h2>What feels like us today?</h2></div><a href="#play" class="link">Explore all activities ${uiIcon('arrow-right')}</a></div><div class="activities home-activities">${catalog.slice(0,3).map(activity).join('')}</div>`;
  refineShell();
};
const originalActivity=activity;
activity=function(a){return `<button class="activity" onclick="start('${a.id}')"><div class="art activity-art ${a.color}">${activityArt(a.id)}</div><div class="activity-info"><h3>${esc(a.name)}</h3><p>${uiIcon('clock')} ${a.time} min <span>${esc(a.mode)} ${uiIcon('arrow-right')}</span></p></div></button>`};
// Keep the illustration and navigation usable before sign-in completes.
navigate();
