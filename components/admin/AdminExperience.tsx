'use client';

import {createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import AdminPortal from './AdminPortal';
import {KayloIntro} from './KayloIntro';

type Theme = 'light' | 'dark';
const preferenceKey = 'kaylo.admin.theme';
const Appearance = createContext<{theme:Theme;toggleTheme:()=>void}>({theme:'light',toggleTheme:()=>{}});
export const useAdminAppearance = () => useContext(Appearance);

export default function AdminExperience(){
 const [theme,setTheme]=useState<Theme|null>(null);
 const [intro,setIntro]=useState(true);
 const explicitChoice=useRef(false);
 const page=useRef<HTMLDivElement>(null);
 const wasIntro=useRef(true);

 useEffect(()=>{
  const system=window.matchMedia('(prefers-color-scheme: dark)');
  const readPreference=()=>{
   let stored:string|null=null;
   try{stored=window.localStorage.getItem(preferenceKey);}catch{/* Private browsing can disallow storage. */}
   explicitChoice.current=stored==='light'||stored==='dark';
   setTheme(stored==='light'||stored==='dark'?stored:system.matches?'dark':'light');
  };
  readPreference();
  const followSystem=()=>{if(!explicitChoice.current)setTheme(system.matches?'dark':'light');};
  const sync=(event:StorageEvent)=>{if(event.key===preferenceKey||event.key===null)readPreference();};
  system.addEventListener('change',followSystem);
  window.addEventListener('storage',sync);
  return()=>{system.removeEventListener('change',followSystem);window.removeEventListener('storage',sync);};
 },[]);

 const toggleTheme=useCallback(()=>{
  const next=theme==='dark'?'light':'dark';
  explicitChoice.current=true;
  setTheme(next);
  try{window.localStorage.setItem(preferenceKey,next);}catch{/* Keep the choice for this visit when storage is unavailable. */}
 },[theme]);
 const finishIntro=useCallback(()=>setIntro(false),[]);
 useEffect(()=>{
  if(!intro&&wasIntro.current){
   wasIntro.current=false;
   page.current?.querySelector<HTMLInputElement>('[data-admin-autofocus]')?.focus({preventScroll:true});
  }
 },[intro]);

 return <Appearance.Provider value={{theme:theme??'light',toggleTheme}}>
  <div className="ops ops-admin" data-theme={theme??undefined}>
   <div ref={page} inert={intro} aria-hidden={intro||undefined} className="ops-content">
    <AdminPortal/>
   </div>
   {intro&&<KayloIntro onComplete={finishIntro}/>}
  </div>
 </Appearance.Provider>;
}
