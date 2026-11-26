/* Provider parsing and clock math shared by the room and its tests. */
(function(root){
 'use strict';
 function parseSource(input){
  let u;try{u=new URL(String(input).trim());}catch{throw Error('Paste a complete HTTPS media link.');}
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.href.length>2048||/[\u0000-\u0020<>"'\\]/.test(u.href))throw Error('Use an HTTPS link without passwords or custom ports.');
  const host=u.hostname.toLowerCase();
  if(host==='localhost'||!host.includes('.')||/^[\d.]+$/.test(host)||host.startsWith('[')||/\.(local|localhost|internal)$/.test(host))throw Error('Use a publicly accessible media link.');
  if(['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtu.be','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host)){
   let id=host.endsWith('youtu.be')?u.pathname.slice(1).split('/')[0]:u.pathname==='/watch'?u.searchParams.get('v'):u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
   if(!/^[a-zA-Z0-9_-]{11}$/.test(id||''))throw Error('Choose a single YouTube video link, not a channel or playlist.');
   return{kind:'youtube',url:'https://www.youtube.com/watch?v='+id,provider_id:id};
  }
  if(host==='open.spotify.com'){
   const match=u.pathname.match(/^\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|show)\/([A-Za-z0-9]{22})\/?$/);
   if(!match)throw Error('Use a Spotify track, album, playlist, episode, or show link.');
   return{kind:'spotify',url:`https://open.spotify.com/${match[1]}/${match[2]}`,provider_id:match[1]+'/'+match[2]};
  }
  u.hash='';
  if(/\.(mp4|webm|ogv)$/i.test(u.pathname))return{kind:'video',url:u.href,provider_id:''};
  if(/\.(mp3|m4a|ogg|wav|aac)$/i.test(u.pathname))return{kind:'audio',url:u.href,provider_id:''};
  return{kind:'link',url:u.href,provider_id:''};
 }
 function targetPosition(room,serverNow=Date.now()){
  const p=Number(room?.position)||0,anchor=Date.parse(room?.anchor_at);
  return Math.max(0,Math.min(86400,p+(room&&!room.paused&&Number.isFinite(anchor)?Math.max(0,(serverNow-anchor)/1000):0)));
 }
 const api={parseSource,targetPosition};root.NearlyMediaCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
