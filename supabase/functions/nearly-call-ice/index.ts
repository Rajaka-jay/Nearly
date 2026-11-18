// Optional coturn REST credentials. Set TURN_URLS (JSON array) and TURN_SHARED_SECRET
// as Supabase function secrets. Never commit relay credentials to client code.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.89.0';
const headers={'Access-Control-Allow-Origin':'https://rajaka-jay.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store','Content-Type':'application/json'};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return response({error:'Method not allowed'},405);
 const authorization=req.headers.get('Authorization');
 if(!authorization)return response({error:'Sign in to call'},401);
 const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user)return response({error:'Sign in to call'},401);
 const context=await client.rpc('nearly_call',{action:'get'});
 if(context.error||!context.data?.paired)return response({error:'Connect with your partner first'},403);
 const iceServers:RTCIceServer[]=[{urls:['stun:stun.cloudflare.com:3478','stun:stun.l.google.com:19302']}];
 const secret=Deno.env.get('TURN_SHARED_SECRET');
 const urls=Deno.env.get('TURN_URLS');
 if(!secret||!urls)return response({iceServers,relayConfigured:false});
 try{
  const turnUrls=JSON.parse(urls);
  if(!Array.isArray(turnUrls)||!turnUrls.length||turnUrls.some(u=>typeof u!=='string'||!/^turns?:/.test(u)))throw Error('Invalid relay configuration');
  const username=`${Math.floor(Date.now()/1000)+14400}:${user.id}`;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);
  const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(username));
  const credential=btoa(String.fromCharCode(...new Uint8Array(signature)));
  iceServers.push({urls:turnUrls,username,credential});
  return response({iceServers,relayConfigured:true});
 }catch{return response({error:'The call relay needs administrator attention'},503);}
});
