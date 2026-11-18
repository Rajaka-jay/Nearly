'use client';
import {useEffect} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
type Instance={destroy:()=>Promise<void>};
type API={mount:(client:SupabaseClient)=>Instance};
export default function CallWidget({client}:{client:SupabaseClient}){
 useEffect(()=>{
  if(window.parent!==window){
   document.documentElement.dataset.embedded='true';
   const navigate=(event:MouseEvent)=>{
    const anchor=(event.target as Element)?.closest('a');
    if(!anchor||event.ctrlKey||event.metaKey||event.shiftKey||anchor.target==='_blank')return;
    const url=new URL(anchor.href,location.href);
    if(url.origin===location.origin&&url.pathname==='/Nearly/'){event.preventDefault();window.parent.location.hash=url.hash||'#home';}
   };
   document.addEventListener('click',navigate);return ()=>document.removeEventListener('click',navigate);
  }
  let cancelled=false,instance:Instance|undefined;
  const api=()=>(window as unknown as {NearlyCalls?:API}).NearlyCalls;
  const mount=()=>{if(!cancelled)instance=api()?.mount(client);};
  if(!document.querySelector('link[data-nearly-calls]')){const css=document.createElement('link');css.rel='stylesheet';css.href='/Nearly/calls.css?v=1';css.dataset.nearlyCalls='true';document.head.append(css);}
  let script=document.querySelector<HTMLScriptElement>('script[data-nearly-calls]');
  if(api())mount();else{if(!script){script=document.createElement('script');script.src='/Nearly/calls.js?v=1';script.dataset.nearlyCalls='true';document.body.append(script);}script.addEventListener('load',mount);}
  return ()=>{cancelled=true;script?.removeEventListener('load',mount);void instance?.destroy();};
 },[client]);return null;
}
