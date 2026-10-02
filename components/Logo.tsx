'use client';
import { useId,useRef,useState } from 'react';
import { motion,useInView,useReducedMotion } from 'motion/react';
import { RotateCcw } from 'lucide-react';
import paths from './logo-paths.json';
export function Wordmark(){return <svg className="kaylo-wordmark" viewBox="280 550 460 145" role="img" aria-label="Kaylo">{paths.text.map((d,i)=><path key={i} d={d}/>)}</svg>}
export function Logo({animated=false,className=''}:{animated?:boolean;className?:string}){
 const ref=useRef<HTMLDivElement>(null);const inView=useInView(ref,{amount:.6});const reduced=useReducedMotion();const [replay,setReplay]=useState(0);const clip=useId().replaceAll(':','');const play=animated&&!reduced&&inView;
 return <div ref={ref} className={`logo-display ${className}`}><svg key={replay} className="kaylo-logo" viewBox="275 300 490 405" role="img" aria-label="Kaylo" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id={clip}><motion.rect x="275" y="300" height="405" initial={animated&&!reduced?{width:0}:false} animate={{width:play?[0,490]:490}} transition={{duration:1.35,ease:'easeInOut'}}/></clipPath></defs><g clipPath={animated?`url(#${clip})`:undefined} className="logo-loop">{paths.loop.map((d,i)=><path key={i} d={d}/>)}</g><motion.g className="logo-dot" initial={animated&&!reduced?{opacity:0,scale:.6}:false} animate={play?{opacity:[0,0,1],scale:[.6,.6,1]}:{opacity:1,scale:1}} transition={{duration:1.8,times:[0,.75,1],ease:'easeOut'}}>{paths.dot.map((d,i)=><path key={i} d={d}/>)}</motion.g><motion.g initial={animated&&!reduced?{opacity:0,y:10}:false} animate={play?{opacity:[0,0,1],y:[10,10,0]}:{opacity:1,y:0}} transition={{duration:2.3,times:[0,.8,1],ease:'easeOut'}}>{paths.text.map((d,i)=><path key={i} d={d}/>)}</motion.g></svg>{animated&&!reduced&&<button className="logo-replay" onClick={()=>setReplay(v=>v+1)} aria-label="Replay Kaylo logo animation"><RotateCcw size={13}/>Replay</button>}</div>
}
