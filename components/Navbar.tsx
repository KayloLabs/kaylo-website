'use client';
import {sitePath} from '../lib/site-path';
import { useEffect, useState } from 'react';
import { Wordmark } from './Logo';
import { Menu, X } from 'lucide-react';
export function Navbar() {
 const [compact,setCompact]=useState(false); const [open,setOpen]=useState(false);
 useEffect(()=>{const scroll=()=>setCompact(window.scrollY>32);scroll();window.addEventListener('scroll',scroll,{passive:true});return()=>window.removeEventListener('scroll',scroll)},[]);
 return <header className={`navbar ${compact?'compact':''}`}><div className="nav-inner"><a href={sitePath('/')} className="brand-link" aria-label="Kaylo home"><Wordmark/></a><nav className="desktop-nav" aria-label="Main navigation"><a href={sitePath('/')}>Home</a><a href={sitePath('/#how-it-works')}>How it works</a><a href={sitePath('/services/')}>Services</a><a href={sitePath('/professionals/')}>For professionals</a></nav><a className="button small nav-cta" href={sitePath('/download/')}>Get started</a><button className="mobile-menu" onClick={()=>setOpen(!open)} aria-expanded={open} aria-controls="mobile-navigation" aria-label={open?'Close menu':'Open menu'}>{open?<X/>:<Menu/>}</button></div>{open&&<nav id="mobile-navigation" className="mobile-links" aria-label="Mobile navigation">{[['Home','/'],['How it works','/#how-it-works'],['Services','/services/'],['For professionals','/professionals/']].map(([label,id])=><a key={id} href={sitePath(id)} onClick={()=>setOpen(false)}>{label}</a>)}</nav>}</header>
}
