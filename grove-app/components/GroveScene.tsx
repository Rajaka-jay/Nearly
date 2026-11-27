'use client';
import {useEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {MotionConfig,useReducedMotion} from 'framer-motion';
import {BookOpen,Check,Droplets,Flower2,Gift,Heart,Leaf,Pause,Play,Settings2,Sparkles,Sun,Volume2,VolumeX} from 'lucide-react';
import {assetConfig} from '../lib/assets';
import {gardenMoment,seasonNames,type Season} from '../lib/scene';
import type {Grove} from './CoupleGrovePage';

const phaseLabels:Record<string,string>={sunrise:'A soft new morning',day:'A little sunlight for us',golden:'Our golden hour',dusk:'When the fireflies wake',night:'Under the same stars'};
const decorLabel:Record<string,string>={bench:'Garden bench',lantern:'Warm lantern',blanket:'Picnic blanket',swing:'Wooden swing',flowers:'Flower patch',stars:'Star lights',frame:'Memory frame'};

/** Small, replaceable garden props; positions remain server-owned records. */
export function GardenDecoration({type}:{type:string}){
 const drawings:Record<string,ReactNode>={
  bench:<><path d="M13 31h54v13H13zM17 15h46v13H17z" fill="#bc8f68"/><path d="M19 44v19m42-19v19M10 28v16m60-16v16" stroke="#70513b" strokeWidth="5"/></>,
  lantern:<><path d="M35 15v-5q5-8 10 0v5M25 23l15-11 15 11v35l-15 9-15-9z" fill="#705336"/><path d="M29 27h22v26H29z" fill="#ffdf90"/><path d="M40 29v23" stroke="#bd8f45"/><circle cx="40" cy="42" r="6" fill="#fff5c8"/></>,
  blanket:<><path d="M7 28 57 17 76 56 25 69Z" fill="#f2d9bf"/><path d="m20 25 18 39m-3-42 18 39M14 41l50-11M20 54l50-12" stroke="#c98189" strokeWidth="8" opacity=".65"/><path d="M42 31q0-25 20-10v11" stroke="#8d6a46" strokeWidth="4" fill="none"/><path d="M38 29h29l-3 22H41Z" fill="#bb915f"/></>,
  swing:<><path d="M13 68 23 8h35l13 60M21 12h38" stroke="#8b6746" strokeWidth="5" fill="none"/><g className="swing-seat"><path d="m31 12-1 39m19-39 2 39" stroke="#d7c49a" strokeWidth="2"/><path d="M24 50h34v7H24Z" fill="#bb895d"/></g></>,
  flowers:<>{[18,39,60].map((x,i)=><g key={x}><path d={`M${x} 64v-${25+i*7}`} stroke="#6d8b4d" strokeWidth="3"/><path d={`M${x} 56q-15-16-15-4q7 7 15 4`} fill="#8ba26c"/><g fill={i===1?'#e8b77c':'#eaa8b3'}>{[0,72,144,216,288].map(a=><ellipse key={a} cx={x} cy={25-i*3} rx="5" ry="9" transform={`rotate(${a} ${x} ${32-i*3})`}/>)}</g><circle cx={x} cy={32-i*3} r="4" fill="#fff1ba"/></g>)}</>,
  stars:<><path d="M5 16q35 36 70 0" stroke="#786448" fill="none"/>{[16,31,48,65].map((x,i)=><path key={x} d="m0-7 2 5 6 1-5 3 1 6-4-3-5 3 2-6-5-3 6-1z" transform={`translate(${x} ${i===0||i===3?28:39})`} fill="#ffe2a0"/>)}</>,
  frame:<><path d="M17 10h47v53H17z" fill="#b58a65"/><path d="M22 15h37v42H22z" fill="#efe5d3"/><path d="m23 49 12-19 12 13 11-8v21H23" fill="#9aac8b"/><circle cx="48" cy="25" r="5" fill="#edc599"/></>
 };
 return <svg viewBox="0 0 80 80" className={'garden-prop prop-'+type} aria-hidden="true">{drawings[type]||drawings.flowers}</svg>;
}

function useGardenAudio(){
 const [playing,setPlaying]=useState(false),[error,setError]=useState('');
 const context=useRef<AudioContext|null>(null);
 const stop=()=>{const c=context.current;context.current=null;if(c)void c.close();setPlaying(false)};
 useEffect(()=>{const hide=()=>{if(document.hidden)stop()};document.addEventListener('visibilitychange',hide);return()=>{document.removeEventListener('visibilitychange',hide);if(context.current)void context.current.close()}},[]);
 async function toggle(){
  if(context.current){stop();return}
  setError('');
  try{
   const audio=new AudioContext();context.current=audio;await audio.resume();if(context.current!==audio)return;
   // Quiet filtered wind with a slow breathing envelope; generated locally, no stream.
   const buffer=audio.createBuffer(1,audio.sampleRate*4,audio.sampleRate),samples=buffer.getChannelData(0);
   for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
   const noise=audio.createBufferSource();noise.buffer=buffer;noise.loop=true;
   const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=480;
   const gain=audio.createGain();gain.gain.value=.045;
   const breeze=audio.createOscillator(),depth=audio.createGain();breeze.frequency.value=.09;depth.gain.value=.016;breeze.connect(depth).connect(gain.gain);
   noise.connect(filter).connect(gain).connect(audio.destination);noise.start();breeze.start();setPlaying(true);
  }catch{stop();setError('Sound could not start in this browser. Try again with your device volume enabled.')}
 }
 return {playing,toggle,error};
}

export default function GroveScene({g,stage,burst,busy,water,open,openMemory,tree,progress}:{g:Grove;stage:number;burst:number;busy:boolean;water:()=>void;open:(s:string)=>void;openMemory:(id:string)=>void;tree:ReactNode;progress:ReactNode}){
 const systemReduced=useReducedMotion(),[paused,setPaused]=useState(false),[now,setNow]=useState<Date|null>(null),[season,setSeason]=useState<Season>('spring'),[settings,setSettings]=useState(false);
 const audio=useGardenAudio(),calm=!!systemReduced||paused;
 useEffect(()=>{setNow(new Date());const timer=setInterval(()=>setNow(new Date()),60000);try{setPaused(localStorage.getItem('nearly-grove-motion')==='paused');const saved=localStorage.getItem('nearly-grove-season');if(seasonNames.includes(saved as Season))setSeason(saved as Season)}catch{}return()=>clearInterval(timer)},[]);
 const moment=now?gardenMoment(now):{phase:'day',dark:false},watered=g.events.some(e=>e.user_id===g.user_id&&e.event_type==='water'&&e.created_at.slice(0,10)===(now||new Date()).toISOString().slice(0,10));
 const memories=g.memories.slice(0,8),points=g.couple.growth_points;
 const [waterPulse,setWaterPulse]=useState(false),lastWater=useRef<string|null>(null),pulseTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{const water=g.events.find(e=>e.event_type==='water');if(lastWater.current!==null&&water&&lastWater.current!==water.id){setWaterPulse(true);if(pulseTimer.current)clearTimeout(pulseTimer.current);pulseTimer.current=setTimeout(()=>setWaterPulse(false),2300)}lastWater.current=water?.id||''},[g.events]);
 useEffect(()=>()=>{if(pulseTimer.current)clearTimeout(pulseTimer.current)},[]);
 return <MotionConfig reducedMotion={calm?'always':'user'}><section className={`garden living-garden phase-${moment.phase} season-${season}${calm?' scene-paused':''}${waterPulse?' just-watered':''}`} aria-label="Your shared relationship garden" style={{backgroundImage:`url(${assetConfig.background})`}}>
  <div className="scene-light" aria-hidden="true"/><div className="scene-aurora" aria-hidden="true"/><div className="scene-sunbeam" aria-hidden="true"/>
  <div className="scene-atmosphere" aria-hidden="true">{Array.from({length:18},(_,i)=><i key={i} className={moment.dark?'firefly':season==='winter'?'snowflake':season==='autumn'?'falling-leaf':'falling-petal'} style={{'--i':i,left:((i*37+7)%100)+'%',top:((i*19+3)%90)+'%',animationDelay:-(i*1.7)+'s'} as CSSProperties}/>)}{Array.from({length:16},(_,i)=><b className="scene-star" key={i} style={{left:((i*29+9)%100)+'%',top:((i*13+5)%40)+'%',animationDelay:-i+'s'}}/>)}</div>
  <div className="scene-grass" aria-hidden="true">{Array.from({length:22},(_,i)=><i key={i} style={{left:(i*4.8)+'%',height:(20+(i%4)*9)+'px',animationDelay:-i*.3+'s'}}/>)}</div>
  <div className="scene-toolbar"><div className="scene-time"><Sun/><span>{phaseLabels[moment.phase]}<small>{now?now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'Your local time'} · {season} garden</small></span></div><div className="scene-options"><button aria-label={audio.playing?'Mute garden sounds':'Enable gentle wind sounds'} aria-pressed={audio.playing} onClick={()=>void audio.toggle()}>{audio.playing?<Volume2/>:<VolumeX/>}</button><button aria-label={paused?'Resume garden motion':'Pause garden motion'} aria-pressed={paused} onClick={()=>{const value=!paused;setPaused(value);try{localStorage.setItem('nearly-grove-motion',value?'paused':'on')}catch{}}}>{paused?<Play/>:<Pause/>}</button><button aria-label="Scene appearance" aria-expanded={settings} onClick={()=>setSettings(!settings)}><Settings2/></button></div></div>
  {settings&&<div className="scene-settings"><label>Garden season<select value={season} onChange={e=>{const value=e.target.value as Season;setSeason(value);try{localStorage.setItem('nearly-grove-season',value)}catch{}}}>{seasonNames.map(s=><option key={s}>{s}</option>)}</select></label><p>The light follows your device’s clock. Seasons are a garden mood, not live weather. Sound starts only when you turn it on.{systemReduced?' Your device’s reduced-motion setting is respected.':''}</p></div>}
  {audio.error&&<p className="scene-audio-error" role="alert">{audio.error}</p>}
  <div className="scene-couple"><Heart/><span>{g.names.join(' & ')}<small>{points.toLocaleString()} little points of care · presence stays private</small></span></div>
  <div className={'scene-tree-zone growth-'+stage}>{tree}{memories.map((m,i)=><button key={m.id} className={'memory-ornament '+(stage<3?'seed-ornament':'')} style={{left:(stage<3?24+i*7:27+(i*17)%47)+'%',top:(stage<3?75+(i%2)*4:28+(i%3)*12)+'%',animationDelay:-i*.7+'s'}} aria-label={'Open memory: '+m.title} onClick={()=>openMemory(m.id)}><span className="ornament-string"/><Heart fill="currentColor"/><span className="ornament-tooltip">{m.title}</span></button>)}</div>
  <div className="water-ripples" aria-hidden="true"><i/><i/><i/></div>
  {g.decorations.map(d=><button className="scene-decoration" key={d.id} style={{left:d.position_x+'%',top:d.position_y+'%'}} aria-label={'Move or remove '+(decorLabel[d.decoration_type]||d.decoration_type)} onClick={()=>open('decorate')}><GardenDecoration type={d.decoration_type}/></button>)}
  <button className="scene-hotspot hotspot-picnic" aria-label="Open your garden gift basket" onClick={()=>open('gifts')}><Gift/><span>Our basket</span></button>
  <button className="scene-hotspot hotspot-cottage" aria-label="Decorate your garden" onClick={()=>open('decorate')}><Leaf/><span>Make it ours</span></button>
  <button className="scene-hotspot hotspot-lantern" aria-label="Plant a memory under the lantern" onClick={()=>open('memory')}><Sparkles/><span>Leave a little light</span></button>
  <div className="scene-tree-caption"><span>ROOTED IN THE LITTLE THINGS</span><h2>{['A tiny beginning','Putting down roots','Growing into us','A whole world in bloom','Our story, still growing'][stage-1]}</h2></div>
  <div className="scene-water-card"><div className="scene-growth">{progress}</div><button className={'primary scene-water-button '+(watered?'is-watered':'is-ready')} onClick={water} disabled={busy||watered}>{watered?<Check/>:<Droplets/>}<span>{busy?'Saving your care…':watered?'Your tree felt your love today':'Give our tree a little water'}<small>{watered?'Your daily care is saved. Come enjoy your garden anytime.':'+2 shared growth points · once per partner each UTC day'}</small></span>{watered?<Heart/>:<Sparkles/>}</button></div>
  <span className="scene-effect-caption" key={burst} aria-hidden="true">{waterPulse?'A little water, a little love.':''}</span>
  <button className="scene-journal" onClick={()=>open('journal')}><BookOpen/>Our garden story</button>
 </section></MotionConfig>;
}
