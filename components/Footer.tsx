'use client';
import {sitePath} from '../lib/site-path';
import { LogoMark, Wordmark } from './Logo';
import { ArrowUpRight, ArrowUp } from 'lucide-react';
import { Dialog,DialogTrigger,DialogContent,DialogTitle,DialogDescription } from './ui/dialog';
function Terms(){return <Dialog><DialogTrigger asChild><button className="footer-link">Terms</button></DialogTrigger><DialogContent className="kaylo-dialog policy-dialog"><DialogTitle>A few things to know.</DialogTitle><DialogDescription>Terms for using this Kaylo website.</DialogDescription><p>Kaylo connects people with local professionals. This website provides information about the platform; it does not itself confirm bookings or take payments.</p><h3>Services and availability</h3><p>Service availability depends on location and the professionals using the platform. Review each professional’s profile, verification information, scope, price and booking terms in the app before confirming a service.</p><h3>App preview</h3><p>The interactive phone on this website is an illustrative preview. Its conversations and bookings are examples, not live transactions.</p><h3>Care and emergencies</h3><p>Kaylo Care is not a replacement for emergency medical services. For an emergency, contact your local emergency service directly.</p><h3>Contact</h3><p>For questions about Kaylo or these website terms, email kayloapp@gmail.com.</p></DialogContent></Dialog>}
export function Footer(){return <footer className="footer"><div className="wrap">
 <div className="footer-main">
  <a className="footer-brand-home" href={sitePath('/')} aria-label="Kaylo home"><Wordmark/><span className="footer-brand-divider" aria-hidden="true"/><LogoMark className="footer-logo-mark"/></a>
  <nav aria-label="Footer navigation"><span className="eyebrow">Explore</span><div className="footer-links"><a href={sitePath('/')}>Home</a><a href={sitePath('/#how-it-works')}>How it works</a><a href={sitePath('/services/')}>Services</a><a href={sitePath('/professionals/')}>For professionals</a><a href={sitePath('/download/')}>Download the apps</a><a href={sitePath('/#about')}>About</a></div></nav>
  <div className="footer-contact"><span>Contact</span><a href="mailto:kayloapp@gmail.com">kayloapp@gmail.com <ArrowUpRight size={18}/></a><a className="back-top" href="#main">Back to top <ArrowUp size={16}/></a></div>
 </div>
 <div className="footer-bottom"><span>© {new Date().getFullYear()} Kaylo</span><div><a className="footer-link" href={sitePath('/privacy/')}>Privacy</a><a className="footer-link" href={sitePath('/account-deletion/')}>Account deletion</a><Terms/></div></div>
 </div></footer>}
