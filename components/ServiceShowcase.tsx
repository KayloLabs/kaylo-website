'use client';

import {useRef, useState} from 'react';
import {ArrowUpRight, Pause, Play} from 'lucide-react';
import {motion, useInView, useReducedMotion} from 'motion/react';
import {sitePath} from '../lib/site-path';

const areas = [
 {name: 'Home', art: 'mode_home', services: ['Electrical work', 'Plumbing', 'Cleaning', 'Repairs'], detail: 'Repairs, cleaning & everyday fixes'},
 {name: 'Farm', art: 'mode_farm', services: ['Coconut harvesting', 'Gardening', 'Farm support'], detail: 'Land, gardens & the next harvest'},
 {name: 'Care', art: 'mode_care', services: ['Doctor appointments', 'Caregivers', 'Everyday assistance'], detail: 'Doctors, caregivers & your loved ones'},
];

export function ServiceShowcase() {
 const ref = useRef<HTMLDivElement>(null);
 const visible = useInView(ref, {amount: .1});
 const reduced = useReducedMotion();
 const [paused, setPaused] = useState(false);
 return <div ref={ref} className="service-showcase" data-paused={paused || !visible || !!reduced}>
  <div className="showcase-panels" aria-label="Explore Kaylo service areas">
   {areas.map((area, index) => <motion.a key={area.name}
    className={`showcase-area showcase-${area.name.toLowerCase()}`}
    href={sitePath(`/services/?category=${area.name}`)}
    aria-label={`Explore Kaylo ${area.name}: ${area.detail}`}
    initial={false} whileInView={reduced ? {} : {y: [28, 0], opacity: [.75, 1]}}
    viewport={{once: true, amount: .2}} transition={{duration: .7, delay: index * .09, ease: [.22, 1, .36, 1]}}>
    <div className="showcase-heading"><h2>{area.name}</h2><span className="showcase-arrow"><ArrowUpRight aria-hidden="true"/></span></div>
    <p>{area.detail}</p>
    <img className="showcase-art" src={sitePath(`/app-art/${area.art}.png`)} alt="" width="1024" height="1024" loading="lazy"/>
    <div className="showcase-ribbon" aria-hidden="true"><div className="showcase-ribbon-track">
     {[0, 1].map(copy => <span className="showcase-ribbon-copy" key={copy}>{area.services.map(service => <span key={service}>{service}<i>✳</i></span>)}</span>)}
    </div></div>
   </motion.a>)}
  </div>
  <button type="button" className="showcase-motion-toggle" onClick={() => setPaused(value => !value)}
   aria-label={paused ? 'Play service showcase motion' : 'Pause service showcase motion'}>
   {paused ? <Play size={14} aria-hidden="true"/> : <Pause size={14} aria-hidden="true"/>}
  </button>
 </div>;
}
