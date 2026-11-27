'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {Heart} from 'lucide-react';
import {assetConfig} from '../lib/assets';

export default function GardenVisitors({stage,calm,dark,busy,encounter,react}:{stage:number;calm:boolean;dark:boolean;busy:boolean;encounter:(kind:string)=>void;react:(text:string,sound:'purr'|'bird'|'chime')=>void}){
 const [cat,setCat]=useState('sleep'),[hello,setHello]=useState(false),[visiting,setVisiting]=useState(true),[birdHop,setBirdHop]=useState(false),[butterflyHop,setButterflyHop]=useState(false),[look,setLook]=useState(0);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),hopTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{if(calm){setCat('sleep');return}let tick=0;const interval=setInterval(()=>{if(document.hidden)return;tick++;setCat(['sleep','stretch','wander','sleep'][tick%4]);setVisiting(Math.random()>.25)},22000);return()=>clearInterval(interval)},[calm]);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);if(hopTimer.current)clearTimeout(hopTimer.current)},[]);
 function pet(){if(timer.current)clearTimeout(timer.current);setCat('hello');setHello(true);react('A tiny purr, just for you.','purr');encounter('cat');timer.current=setTimeout(()=>{setCat('sleep');setHello(false)},6500)}
 function greet(kind:'bird'|'butterfly'){
  if(hopTimer.current)clearTimeout(hopTimer.current);setBirdHop(kind==='bird');setButterflyHop(kind==='butterfly');
  react(kind==='bird'?'A little song among the branches.':'A small flutter of company.',kind==='bird'?'bird':'chime');encounter(kind);
  hopTimer.current=setTimeout(()=>{setBirdHop(false);setButterflyHop(false)},3000);
 }
 return <div className="garden-visitors" aria-label="Little garden visitors">
  <button className={'garden-cat cat-'+cat} aria-label="Pet our garden cat" disabled={busy} onClick={pet} onPointerMove={e=>{if(calm||e.pointerType!=='mouse')return;const box=e.currentTarget.getBoundingClientRect();setLook((e.clientX-box.left)/box.width*6-3)}} onPointerLeave={()=>setLook(0)}>
   <img src={cat==='sleep'?assetConfig.visitors.sleep:assetConfig.visitors.awake} alt="" draggable={false} style={{'--cat-look':look+'deg'} as CSSProperties}/>
   {hello&&<span className="cat-affection" aria-hidden="true"><Heart fill="currentColor"/></span>}
   <span className="visitor-name">Our little visitor</span>
  </button>
  {!dark&&visiting&&<button className={'garden-butterfly '+(butterflyHop?'butterfly-greeting':'')} aria-label="Say hello to the butterfly" disabled={busy} onClick={()=>greet('butterfly')}><img src={assetConfig.visitors.butterfly} alt="" draggable={false}/></button>}
  {!dark&&visiting&&stage>=3&&<button className={'garden-robin '+(birdHop?'bird-greeting':'')} aria-label="Say hello to the robin" disabled={busy} onClick={()=>greet('bird')}><img src={assetConfig.visitors.bird} alt="" draggable={false}/></button>}
 </div>;
}
