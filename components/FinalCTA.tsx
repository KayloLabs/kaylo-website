'use client';
import {ArrowUpRight} from 'lucide-react';
import {Dialog,DialogTrigger,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
import {Reveal} from './Motion';
export function FinalCTA(){return <section id="get-started" className="final-cta">
 <svg className="section-wave" viewBox="0 0 1440 88" preserveAspectRatio="none" aria-hidden="true"><path className="wave-space" d="M0 0H1440V61Q1320 93 1200 61T960 61T720 61T480 61T240 61T0 61Z"/><path className="wave-upper" d="M0 0H1440V15Q1320 47 1200 15T960 15T720 15T480 15T240 15T0 15Z"/></svg>
 <Reveal className="wrap final-copy"><h2>Got a job to do?<br/><em>Kaylo it.</em></h2>
 <Dialog><DialogTrigger asChild><button className="button closing-button">Get started <ArrowUpRight size={20}/></button></DialogTrigger><DialogContent className="kaylo-dialog"><DialogTitle>Get Kaylo</DialogTitle><DialogDescription>We’re bringing Kaylo to local communities. Contact our team to try the app and check services in your area.</DialogDescription><a href="mailto:kayloapp@gmail.com?subject=I%20would%20like%20to%20try%20Kaylo" className="button">Contact Kaylo</a><p className="dialog-email">kayloapp@gmail.com</p></DialogContent></Dialog>
 </Reveal>
 <svg className="footer-wave" viewBox="0 0 1440 48" preserveAspectRatio="none" aria-hidden="true"><path d="M0 24Q90 64 180 24T360 24T540 24T720 24T900 24T1080 24T1260 24T1440 24V48H0Z"/></svg>
 </section>}
