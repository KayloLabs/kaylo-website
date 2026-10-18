'use client';

import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {KayloIntro} from './admin/KayloIntro';
import '../app/admin/intro.css';

const introKey='kaylo.website.intro.v1';
type Phase='checking'|'intro'|'revealing'|'ready';

export function SiteExperience({children}:{children:React.ReactNode}){
 const [phase,setPhase]=useState<Phase>('checking');
 const content=useRef<HTMLDivElement>(null);
 const blocked=phase==='intro'||phase==='revealing';
 useLayoutEffect(()=>{
  let seen=false;
  try{seen=sessionStorage.getItem(introKey)==='seen';}catch{/* Storage is optional. */}
  setPhase(seen||window.location.hash?'ready':'intro');
 },[]);
 useEffect(()=>{
  if(!blocked)return;
  const previous=document.body.style.overflow;
  document.body.style.overflow='hidden';
  return()=>{document.body.style.overflow=previous;};
 },[blocked]);
 const finish=()=>{
  try{sessionStorage.setItem(introKey,'seen');}catch{/* Private browsing still works. */}
  setPhase('ready');
  requestAnimationFrame(()=>content.current?.querySelector<HTMLElement>('main')?.focus({preventScroll:true}));
 };
 return <div className="site-experience" data-phase={phase}>
  <div ref={content} className="site-content" inert={blocked} aria-hidden={blocked||undefined}>{children}</div>
  {blocked&&<KayloIntro label="Opening Kaylo" curtain onReveal={()=>setPhase('revealing')} onComplete={finish}/>}
 </div>;
}
