'use client';
import {useEffect,useRef} from 'react';
import {Heart,Leaf,X} from 'lucide-react';
import type {GardenVisit} from './CoupleGrovePage';

const copy:Record<string,{title:string;body:string;action:string}>={
 swing:{title:'A little swing, a little slower',body:'Give the swing a gentle push. Your visit leaves a small trace for your partner to discover.',action:'Give it a gentle push'},
 bench:{title:'Let the world wait a moment',body:'Settle in for a slow breath, warm light and a few falling petals. There is nothing to finish here.',action:'Take a quiet moment'},
 lantern:{title:'Leave a little light',body:'Write a wish or a note as a saved memory. It becomes a little light in your shared sky.',action:'Write a note for our sky'},
 flowers:{title:'Something small is blooming',body:'A touch wakes these flowers. Plant a memory to keep a bloom that both of you can return to.',action:'Bloom and plant a memory'},
 frame:{title:'A window into your story',body:'Open your latest saved memory, or plant your first one. Your private photos stay private.',action:'Open a little memory'},
 blanket:{title:'A little picnic for two',body:'Today’s small conversation starter:',action:'Keep an answer as a memory'},
 cottage:{title:'A little note at the door',body:'Leave a note as a memory for your partner to find when they next visit. Presence stays private.',action:'Leave a note at our door'},
 stars:{title:'All those little moments',body:'Take a slow look through the moments you have saved in your shared garden.',action:'Read our garden story'}
};
const prompts=['What small kindness made your day lighter?','What would you pack for a picnic together?','Which ordinary moment would you like to share today?','What song feels like a hug to you?','What is one small thing you appreciate about us?','What view would you like to show each other?','What is a quiet adventure we could plan together?'];
export function picnicQuestion(){return prompts[Math.floor(Date.now()/86400000)%prompts.length]}
export default function GardenObjectDialog({kind,latest,userId,busy,rewarded,close,act,move}:{kind:string;latest?:GardenVisit;userId:string;busy:boolean;rewarded:boolean;close:()=>void;act:()=>void;move?:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),c=copy[kind]||copy.stars;
 useEffect(()=>{const el=dialog.current;el?.showModal();return()=>el?.close()},[]);

 return <dialog ref={dialog} className="garden-object-dialog" aria-labelledby="garden-object-title" onCancel={close}>
  <button className="close" aria-label="Close garden moment" onClick={close}><X/></button>
  <Heart className="object-heart"/><h2 id="garden-object-title">{c.title}</h2><p>{c.body}</p>
  {kind==='blanket'&&<blockquote>{picnicQuestion()}</blockquote>}
  {latest&&<p className="object-trace"><Leaf/>{latest.user_id===userId?'You':'Your partner'} visited here · <time>{new Date(latest.created_at).toLocaleString()}</time></p>}
  <p className="muted">{rewarded?'Your daily visit point is already saved. Enjoy this corner as often as you like.':'Your first saved garden interaction today earns +1 shared growth point. Repeated taps do not add more.'}</p>
  <button className="primary" disabled={busy} onClick={act}>{c.action}</button>
  {move&&<button disabled={busy} onClick={move}>Move or remove this decoration</button>}
 </dialog>;
}
