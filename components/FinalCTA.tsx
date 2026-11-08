'use client';
import {ArrowUpRight} from 'lucide-react';
import {sitePath} from '../lib/site-path';
import {Reveal} from './Motion';
export function FinalCTA(){return <section id="get-started" className="final-cta">
 {/* Matching cubic curves keep the band even, with clearance above every crest. */}
 <svg className="section-wave" viewBox="0 0 1440 88" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <path className="wave-space" d="M0 66C80 42 160 42 240 66S400 90 480 66S640 42 720 66S880 90 960 66S1120 42 1200 66S1360 90 1440 66V0H0Z"/>
  <path className="wave-upper" d="M0 28C80 4 160 4 240 28S400 52 480 28S640 4 720 28S880 52 960 28S1120 4 1200 28S1360 52 1440 28V0H0Z"/>
 </svg>
 <Reveal className="wrap final-copy"><h2>Got a job to do?<br/><em>Kaylo it.</em></h2>
 <a className="button closing-button" href={sitePath('/download/')}>Get started <ArrowUpRight size={20}/></a>
 </Reveal>
 <svg className="footer-wave" viewBox="0 0 1440 48" preserveAspectRatio="none" aria-hidden="true"><path d="M0 24Q90 64 180 24T360 24T540 24T720 24T900 24T1080 24T1260 24T1440 24V48H0Z"/></svg>
 </section>}
