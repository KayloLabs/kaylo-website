'use client';
import {useEffect,useRef,useState} from 'react';
import {Menu,X} from 'lucide-react';
import {sitePath} from '../lib/site-path';
import {Wordmark} from './Logo';

const links=[['Home','/'],['How it works','/#how-it-works'],['Services','/services/'],['For professionals','/professionals/']] as const;

export function Navbar(){
 const [compact,setCompact]=useState(false);
 const [open,setOpen]=useState(false);
 const [path,setPath]=useState('');
 const header=useRef<HTMLElement>(null);
 const toggle=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  setPath(window.location.pathname);
  const scroll=()=>setCompact(window.scrollY>32);
  const desktop=window.matchMedia('(min-width:901px)');
  const resize=()=>{if(desktop.matches)setOpen(false);};
  scroll();window.addEventListener('scroll',scroll,{passive:true});
  desktop.addEventListener('change',resize);
  return()=>{window.removeEventListener('scroll',scroll);desktop.removeEventListener('change',resize);};
 },[]);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!header.current?.contains(event.target))setOpen(false);};
  document.addEventListener('pointerdown',outside);
  return()=>document.removeEventListener('pointerdown',outside);
 },[open]);
 const current=(url:string)=>!url.includes('#')&&path.replace(/\/$/,'')===sitePath(url).replace(/\/$/,'');
 const navigation=()=>links.map(([label,url])=><a key={url} href={sitePath(url)} aria-current={current(url)?'page':undefined} onClick={()=>setOpen(false)}>{label}</a>);
 return <header ref={header} className={`navbar ${compact?'compact':''}`}
  onKeyDown={event=>{if(event.key==='Escape'&&open){event.preventDefault();setOpen(false);toggle.current?.focus();}}}
  onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}>
  <div className="nav-inner">
   <a href={sitePath('/')} className="brand-link" aria-label="Kaylo home"><Wordmark/></a>
   <nav className="desktop-nav" aria-label="Main navigation">{navigation()}</nav>
   <a className="button small nav-cta" href={sitePath('/download/')} aria-current={current('/download/')?'page':undefined}>Get started</a>
   <button ref={toggle} type="button" className="mobile-menu" onClick={()=>setOpen(value=>!value)} aria-expanded={open} aria-controls="mobile-navigation" aria-label={open?'Close menu':'Open menu'}>
    {open?<X aria-hidden="true"/>:<Menu aria-hidden="true"/>}
   </button>
  </div>
  {open&&<nav id="mobile-navigation" className="mobile-links" aria-label="Mobile navigation">{navigation()}</nav>}
 </header>;
}
