'use client';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
export function Reveal({children,className=''}:{children:React.ReactNode;className?:string}){const reduced=useReducedMotion();return <motion.div className={className} initial={false} whileInView={reduced?{}:{y:[14,0],opacity:[.75,1]}} viewport={{once:true,amount:.2}} transition={{duration:.8,ease:[.22,1,.36,1]}}>{children}</motion.div>}
export function Thread({className=''}:{className?:string}){const ref=useRef<HTMLDivElement>(null);const reduced=useReducedMotion();const {scrollYProgress}=useScroll({target:ref,offset:['start 90%','end 30%']});return <div ref={ref} className={className}><svg viewBox="0 0 1000 160" fill="none" aria-hidden="true"><path d="M0 95 C150 95 90 20 235 50 S380 150 470 95 S610 25 725 65 S870 125 1000 50" stroke="currentColor" opacity=".2"/><motion.path d="M0 95 C150 95 90 20 235 50 S380 150 470 95 S610 25 725 65 S870 125 1000 50" stroke="currentColor" strokeWidth="1.5" style={{pathLength:reduced?1:scrollYProgress}}/></svg></div>}
export function BrandStatement(){
 const ref=useRef<HTMLElement>(null);
 const {scrollYProgress}=useScroll({target:ref,offset:['start 90%','center 40%']});
 const y=useTransform(scrollYProgress,[0,1],[35,0]);
 const reduced=useReducedMotion();
 return <section ref={ref} className="brand brand-expressive section" id="about"><div className="wrap brand-grid">
  <p className="eyebrow">About Kaylo</p><div>
   <motion.h2 style={{y:reduced?0:y}}>Finding the right person{' '}<br/>shouldn’t be <em>complicated.<svg viewBox="0 0 590 24" fill="none" preserveAspectRatio="none" aria-hidden="true"><motion.path d="M3 17C180 3 402 3 586 14" style={{pathLength:reduced?1:scrollYProgress}}/></svg></em></motion.h2>
   <p>From a leaking tap to a broken appliance, everyday problems shouldn’t require endless calls, uncertain recommendations, or wondering who to trust.</p>
  </div></div></section>;
}
