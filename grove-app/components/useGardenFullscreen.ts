'use client';
import {useEffect,useRef,useState} from 'react';

/** Native fullscreen when supported; immersive viewport fallback for mobile/iframes. */
export function useGardenFullscreen(){
 const [expanded,setExpanded]=useState(false);
 const button=useRef<HTMLButtonElement>(null),scroll=useRef(0),wasExpanded=useRef(false);
 useEffect(()=>{
  const changed=()=>{if(!document.fullscreenElement)setExpanded(false)};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]'))setExpanded(false)};
  const message=(event:MessageEvent)=>{if(event.source===window.parent&&event.origin===location.origin&&event.data?.type==='nearly:grove-exit-immersive')setExpanded(false)};
  document.addEventListener('fullscreenchange',changed);window.addEventListener('keydown',escape);window.addEventListener('message',message);
  return()=>{document.removeEventListener('fullscreenchange',changed);window.removeEventListener('keydown',escape);window.removeEventListener('message',message)};
 },[]);
 useEffect(()=>{
  document.documentElement.classList.toggle('grove-immersive',expanded);
  if(wasExpanded.current&&!expanded)requestAnimationFrame(()=>{window.scrollTo(0,scroll.current);button.current?.focus({preventScroll:true})});
  wasExpanded.current=expanded;
  if(window.parent!==window)window.parent.postMessage({type:'nearly:grove-immersive',enabled:expanded},location.origin);
  return()=>{document.documentElement.classList.remove('grove-immersive');if(window.parent!==window)window.parent.postMessage({type:'nearly:grove-immersive',enabled:false},location.origin)};
 },[expanded]);
 async function toggle(){
  if(expanded){
   setExpanded(false);
   if(document.fullscreenElement===document.documentElement)try{await document.exitFullscreen()}catch{/* CSS fallback still exits. */}
  }else{
   scroll.current=window.scrollY;setExpanded(true);
   // A rejected/unsupported native request keeps the usable viewport fallback.
   try{if(document.fullscreenEnabled&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen()}catch{/* iOS/embedded browsers can use the immersive layout. */}
  }
 }
 return {expanded,toggle,button};
}
