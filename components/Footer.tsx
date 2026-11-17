'use client';
import {sitePath} from '../lib/site-path';
import { LogoMark, Wordmark } from './Logo';
import { ArrowUpRight, ArrowUp } from 'lucide-react';
export function Footer(){return <footer className="footer"><div className="wrap">
 <div className="footer-main">
  <a className="footer-brand-home" href={sitePath('/')} aria-label="Kaylo home"><Wordmark/><span className="footer-brand-divider" aria-hidden="true"/><LogoMark className="footer-logo-mark"/></a>
  <nav aria-label="Footer navigation"><span className="eyebrow">Explore</span><div className="footer-links"><a href={sitePath('/')}>Home</a><a href={sitePath('/#how-it-works')}>How it works</a><a href={sitePath('/services/')}>Services</a><a href={sitePath('/professionals/')}>For professionals</a><a href={sitePath('/download/')}>Download the apps</a><a href={sitePath('/about/')}>About</a><a href={sitePath('/pricing/')}>Pricing</a><a href={sitePath('/contact/')}>Help & contact</a></div></nav>
  <div className="footer-contact"><span>Contact</span><a href="mailto:kayloapp@gmail.com">kayloapp@gmail.com <ArrowUpRight size={18}/></a><a className="back-top" href="#main">Back to top <ArrowUp size={16}/></a></div>
 </div>
 <div className="footer-bottom"><span>© {new Date().getFullYear()} Kaylo</span><div><a className="footer-link" href={sitePath('/privacy/')}>Privacy</a><a className="footer-link" href={sitePath('/account-deletion/')}>Account deletion</a><a className="footer-link" href={sitePath('/terms/')}>Terms</a><a className="footer-link" href={sitePath('/refund-policy/')}>Cancellation & refunds</a></div></div>
 </div></footer>}
