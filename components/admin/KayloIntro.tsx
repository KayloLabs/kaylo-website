'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {AnimatePresence,motion} from 'motion/react';
import {Logo} from '../Logo';

const services=['Electrical','Plumbing','Home','Farm','Care'] as const;
type Service=(typeof services)[number];
const logoDuration=1000;
const slideDuration=700;
const introDuration=logoDuration+(services.length+1)*slideDuration;

function ServiceIcon({service}:{service:Service}){
 return <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
  {service==='Electrical'&&<>
   <path d="M23 12v13m18-13v13M19 25h26v8a13 13 0 0 1-26 0v-8Z"/>
   <path d="M32 46v6a7 7 0 0 1-7 7h-5m9-29-3 6h6l-3 6"/>
  </>}
  {service==='Plumbing'&&<>
   <path d="M12 47V36a8 8 0 0 1 8-8h19v-8h12v8h4v11H43v-3H22a2 2 0 0 0-2 2v9m-10 0h12"/>
   <path d="M45 20V10m-9 0h18m-5 34c-2 3-5 7-5 10a5 5 0 0 0 10 0c0-3-3-7-5-10Z"/>
  </>}
  {service==='Home'&&<>
   <path d="m9 29 23-19 23 19M16 25v28h32V25"/>
   <path d="M27 53V37h10v16M42 18v-7h6v12"/>
  </>}
  {service==='Farm'&&<>
   <path d="M32 56V32m0 5C19 37 11 29 11 17c12 0 21 7 21 20Z"/>
   <path d="M32 29c0-12 8-20 21-20 0 12-8 20-21 20Zm-10-3 10 11m10-17L32 30"/>
   <path d="M22 55c6-3 14-3 20 0"/>
  </>}
  {service==='Care'&&<>
   <path d="M32 53 13 34C-2 19 18 5 32 20 46 5 66 19 51 34L32 53Z"/>
   <path d="M25 32h14m-7-7v14"/>
  </>}
 </svg>;
}

export function KayloIntro({onComplete}:{onComplete:()=>void}){
 const container=useRef<HTMLElement>(null);
 const callback=useRef(onComplete);
 const finished=useRef(false);
 const [scene,setScene]=useState(0);
 const [reduced,setReduced]=useState(false);
 const [closing,setClosing]=useState(false);
 const [run,setRun]=useState(0);
 useEffect(()=>{callback.current=onComplete;},[onComplete]);
 const complete=useCallback(()=>{
  if(finished.current)return;
  finished.current=true;
  callback.current();
 },[]);
 useEffect(()=>{
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  let timers:number[]=[];
  let ending=false;
  const clear=()=>{timers.forEach(timer=>window.clearTimeout(timer));timers=[];};
  const finish=()=>{
   if(ending||finished.current)return;
   ending=true;clear();setClosing(true);
   timers.push(window.setTimeout(complete,preference.matches?0:200));
  };
  const play=()=>{
   if(ending||finished.current)return;
   clear();setScene(0);setClosing(false);setReduced(preference.matches);setRun(value=>value+1);
   if(preference.matches){timers.push(window.setTimeout(finish,700));return;}
   for(let index=0;index<=services.length;index++){
    timers.push(window.setTimeout(()=>setScene(index+1),logoDuration+index*slideDuration));
   }
   timers.push(window.setTimeout(finish,introDuration));
  };
  const keydown=(event:KeyboardEvent)=>{
   if(event.key==='Enter'||event.key==='Escape'){event.preventDefault();finish();}
   if(event.key==='Tab'){event.preventDefault();container.current?.focus({preventScroll:true});}
  };
  container.current?.focus({preventScroll:true});
  play();preference.addEventListener('change',play);window.addEventListener('keydown',keydown);
  return()=>{clear();preference.removeEventListener('change',play);window.removeEventListener('keydown',keydown);};
 },[complete]);
 const service=scene>0&&scene<=services.length?services[scene-1]:null;
 const isLastScene=scene===services.length+1;
 return <motion.section ref={container} tabIndex={-1} className="kaylo-intro" role="dialog" aria-modal="true" aria-label="Opening Kaylo Admin" data-reduced={reduced} initial={false} animate={{opacity:closing?0:1}} transition={{duration:reduced?0:.2,ease:'easeOut'}}>
  <div className="kaylo-intro__sequence" aria-hidden="true">
   <div className="kaylo-intro__stage">
    <AnimatePresence initial={false}>
     <motion.div key={scene} className="kaylo-intro__frame" initial={reduced?false:{opacity:0,x:8}} animate={{opacity:1,x:0}} exit={reduced?{opacity:0}:{opacity:0,x:-8}} transition={{duration:reduced?0:.2,ease:[.22,.7,.32,1]}}>
      {isLastScene?<span className="kaylo-intro__more">and more</span>:service?<ServiceIcon service={service}/>:<Logo className="kaylo-intro__logo"/>}
     </motion.div>
    </AnimatePresence>
   </div>
   <div className="kaylo-intro__progress"><motion.span key={run} initial={reduced?false:{scaleX:0}} animate={{scaleX:1}} transition={{duration:reduced?0:introDuration/1000,ease:'linear'}}/></div>
  </div>
 </motion.section>;
}
