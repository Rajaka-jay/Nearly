// Optional coturn REST credentials. Set TURN_URLS (JSON array) and TURN_SHARED_SECRET
// as Supabase function secrets. Never commit relay credentials to client code.
import {relayConfig} from './relay-config.mjs';
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
 try{
  const config=await relayConfig({env:name=>Deno.env.get(name),userId:user.id});
  return response(config);
 }catch{
  // Do not return upstream errors/URLs: those may contain provider credentials.
  return response({error:'The call relay settings are incomplete or the provider is unavailable. Check the TURN secrets in Supabase.'},503);
 }
});
