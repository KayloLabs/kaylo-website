'use client';
import {sitePath} from '../lib/site-path';
import {officialProfiles} from '../lib/site-metadata';
import { LogoMark, Wordmark } from './Logo';
import { ArrowUpRight, ArrowUp } from 'lucide-react';
export function Footer(){return <footer className="footer"><div className="wrap">
 <div className="footer-main">
  <a className="footer-brand-home" href={sitePath('/')} aria-label="Kaylo home"><Wordmark/><span className="footer-brand-divider" aria-hidden="true"/><LogoMark className="footer-logo-mark"/></a>
  <nav aria-label="Footer navigation"><span className="eyebrow">Explore</span><div className="footer-links"><a href={sitePath('/')}>Home</a><a href={sitePath('/#how-it-works')}>How it works</a><a href={sitePath('/services/')}>Services</a><a href={sitePath('/professionals/')}>For professionals</a><a href={sitePath('/download/')}>Download the apps</a><a href={sitePath('/about/')}>About</a><a href={sitePath('/pricing/')}>Pricing</a><a href={sitePath('/contact/')}>Help & contact</a></div></nav>
  <div className="footer-contact"><span>Contact</span><a href="mailto:kayloapp@gmail.com">kayloapp@gmail.com <ArrowUpRight size={18}/></a>
   <div className="footer-social"><span>Connect with us</span><div className="footer-social-links">{officialProfiles.map(profile=><a key={profile.url} className="footer-social-link" href={profile.url} target="_blank" rel="me noopener noreferrer" aria-label={`Kaylo on ${profile.name} (opens in a new tab)`} title={profile.name}>
    {profile.name==='Instagram' ? <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg> : <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true" focusable="false"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.476-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z"/></svg>}
   </a>)}</div></div>
   <a className="back-top" href="#main">Back to top <ArrowUp size={16}/></a></div>
 </div>
 <div className="footer-bottom"><span>© {new Date().getFullYear()} Kaylo</span><div><a className="footer-link" href={sitePath('/privacy/')}>Privacy</a><a className="footer-link" href={sitePath('/account-deletion/')}>Account deletion</a><a className="footer-link" href={sitePath('/terms/')}>Terms</a><a className="footer-link" href={sitePath('/refund-policy/')}>Cancellation & refunds</a></div></div>
 </div></footer>}
