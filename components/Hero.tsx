import {ArrowUpRight} from 'lucide-react';
import {sitePath} from '../lib/site-path';
import {ServiceShowcase} from './ServiceShowcase';

export function Hero() {
 return <section className="hero hero-playful hero-clean" id="home">
  <div className="hero-composition wrap">
   <div className="hero-copy">
    <h1><span className="hero-line hero-line-first">Skilled people.</span>{' '}
     <span className="hero-line hero-line-second"><em className="hero-accent">Right when</em></span>{' '}
     <span className="hero-line hero-line-third">you need them.</span></h1>
    <p className="hero-description">Kaylo connects you with trusted local professionals for the jobs that keep everyday life moving.</p>
    <div className="hero-actions"><a href={sitePath('/download/')} className="button">Get started <ArrowUpRight size={18} aria-hidden="true"/></a><a href="#how-it-works" className="text-link">How Kaylo works</a></div>
    <nav className="hero-category-links" aria-label="Explore Kaylo services">
     {['Home','Farm','Care'].map(category=><a key={category} href={sitePath(`/services/?category=${category}`)}>{category}<ArrowUpRight size={16} aria-hidden="true"/></a>)}
    </nav>
   </div>
  </div>
  <ServiceShowcase/>
 </section>;
}
