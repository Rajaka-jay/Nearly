/** Server-only TURN configuration. Provider/master secrets never reach clients. */
const stun={urls:['stun:stun.cloudflare.com:3478','stun:stun.l.google.com:19302']};
function validate(entries){
 if(!Array.isArray(entries)||!entries.length||entries.length>24)throw Error('Invalid relay response');
 const result=entries.map(entry=>{
  const urls=Array.isArray(entry?.urls)?entry.urls:[entry?.urls];
  if(!urls.length||urls.length>24||urls.some(u=>typeof u!=='string'||u.length>512||!/^(stun|stuns|turn|turns):[^\s]+$/.test(u)))throw Error('Invalid relay response');
  const relay=urls.some(u=>/^turns?:/.test(u));
  if(relay&&(typeof entry.username!=='string'||!entry.username||entry.username.length>1024||typeof entry.credential!=='string'||!entry.credential||entry.credential.length>1024))throw Error('Relay credentials missing');
  return relay?{urls,username:entry.username,credential:entry.credential}:{urls};
 });
 if(!result.some(e=>e.urls.some(u=>/^turns?:/.test(u))))throw Error('No TURN server returned');
 return result;
}
export async function relayConfig({env,userId,fetcher=fetch,cryptoApi=crypto,now=Date.now()}){
 const cfId=env('CF_TURN_KEY_ID'),cfToken=env('CF_TURN_API_TOKEN'),metered=env('METERED_TURN_CREDENTIALS_URL');
 let iceServers,provider;
 if(cfId||cfToken){
  if(!cfId||!cfToken||!/^[a-zA-Z0-9_-]{1,128}$/.test(cfId))throw Error('Complete the Cloudflare TURN settings');
  const r=await fetcher('https://rtc.live.cloudflare.com/v1/turn/keys/'+encodeURIComponent(cfId)+'/credentials/generate-ice-servers',{method:'POST',headers:{Authorization:'Bearer '+cfToken,'Content-Type':'application/json'},body:JSON.stringify({ttl:14400}),signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw Error('The TURN provider rejected the request');
  iceServers=validate((await r.json()).iceServers);provider='cloudflare';
 }else if(metered){
  const url=new URL(metered);
  if(url.protocol!=='https:'||!url.hostname.endsWith('.metered.live')||url.username||url.password||url.pathname!=='/api/v1/turn/credentials'||!url.searchParams.get('apiKey'))throw Error('Invalid Metered credentials URL');
  const r=await fetcher(url.toString(),{signal:AbortSignal.timeout(8000),redirect:'error'});
  if(!r.ok)throw Error('The TURN provider rejected the request');
  iceServers=validate(await r.json());provider='metered';
 }else{
  const urls=env('TURN_URLS'),secret=env('TURN_SHARED_SECRET'),username=env('TURN_USERNAME'),password=env('TURN_PASSWORD');
  if(!urls&&!secret&&!username&&!password)return {iceServers:[stun],relayConfigured:false,provider:'direct',iceTransportPolicy:'all'};
  if(!urls)throw Error('TURN URLs are missing');
  const turnUrls=JSON.parse(urls);let credential=password,name=username;
  if(secret){
   name=`${Math.floor(now/1000)+14400}:${userId}`;
   const key=await cryptoApi.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);
   const signature=await cryptoApi.subtle.sign('HMAC',key,new TextEncoder().encode(name));
   credential=btoa(String.fromCharCode(...new Uint8Array(signature)));
  }
  iceServers=[stun,...validate([{urls:turnUrls,username:name,credential}])];provider=secret?'coturn':'custom';
 }
 return {iceServers,relayConfigured:true,provider,iceTransportPolicy:env('TURN_FORCE_RELAY')==='true'?'relay':'all'};
}
