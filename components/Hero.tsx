'use client';

import {type CSSProperties, type PointerEvent} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {motion, useMotionValue, useReducedMotion, useSpring} from 'motion/react';
import {sitePath} from '../lib/site-path';
import {ServiceShowcase} from './ServiceShowcase';

const moments = ['Electrical work', 'Plumbing', 'Home repair', 'Appliance care', 'Cleaning', 'Mechanic'];

function ServiceMoment({label, index}: {label: string; index: number}) {
 const reduced = useReducedMotion();
 const x = useMotionValue(0), y = useMotionValue(0);
 const rotateX = useSpring(x, {stiffness: 150, damping: 22});
 const rotateY = useSpring(y, {stiffness: 150, damping: 22});
 function move(event: PointerEvent<HTMLAnchorElement>) {
  if (reduced || event.pointerType !== 'mouse') return;
  const rect = event.currentTarget.getBoundingClientRect();
  x.set((.5 - (event.clientY - rect.top) / rect.height) * 9);
  y.set(((event.clientX - rect.left) / rect.width - .5) * 9);
 }
 function reset() {x.set(0); y.set(0);}
 return <figure className={`moment moment-${index}`} style={{'--moment-order': index} as CSSProperties}>
  <motion.a className="moment-frame" href={sitePath('/services/?category=Home')}
   aria-label={`Explore ${label.toLowerCase()} in Kaylo`}
   onPointerMove={move} onPointerLeave={reset} onBlur={reset}
   style={reduced ? undefined : {rotateX, rotateY, transformPerspective: 700}}>
   <div className={`moment-photo photo-${index}`} role="img" aria-label={`${label} in a local home or workshop`}/>
   <figcaption><span>{label}</span><ArrowUpRight size={14} aria-hidden="true"/></figcaption>
  </motion.a>
 </figure>;
}

export function Hero() {
 return <section className="hero hero-playful" id="home">
  <div className="hero-composition wrap">
   <svg className="hero-thread" viewBox="0 0 1300 650" fill="none" aria-hidden="true">
    <path d="M40 380 C180 80 270 110 350 190 S900 560 1080 350 S1210 100 1280 130"/>
    <path className="moving-thread" d="M40 380 C180 80 270 110 350 190 S900 560 1080 350 S1210 100 1280 130"/>
   </svg>
   <div className="hero-copy">
    <h1><span className="hero-line hero-line-first">Skilled people.</span>{' '}
     <span className="hero-line hero-line-second"><em className="hero-accent">Right when<svg viewBox="0 0 420 30" preserveAspectRatio="none" fill="none" aria-hidden="true"><path d="M8 21C100 5 275 4 412 17"/></svg></em></span>{' '}
     <span className="hero-line hero-line-third">you need them.</span></h1>
    <p className="hero-description">Kaylo connects you with trusted local professionals for the jobs that keep everyday life moving.</p>
    <div className="hero-actions"><a href={sitePath('/download/')} className="button">Get started <ArrowUpRight size={18} aria-hidden="true"/></a><a href="#how-it-works" className="text-link">How Kaylo works</a></div>
   </div>
   <div className="service-moments">{moments.map((label, index) => <ServiceMoment key={label} label={label} index={index}/>)}</div>
  </div>
  <ServiceShowcase/>
 </section>;
}
