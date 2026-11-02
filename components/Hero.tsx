import { ArrowUpRight, House, Sprout, HeartHandshake } from 'lucide-react';
import { sitePath } from '../lib/site-path';

const moments = [
  ['Electrical work', 'An electrician repairing a switch in a local home'],
  ['Plumbing', 'A plumber working beneath a kitchen sink'],
  ['Home repair', 'A carpenter carefully repairing a wooden chair'],
  ['Appliance care', 'A technician servicing a home air conditioner'],
  ['Cleaning', 'A cleaner wiping a kitchen worktop'],
  ['Mechanic', 'A mechanic working on a scooter'],
] as const;

export function Hero() {
  return <section className="hero hero-editorial" id="home">
    <div className="hero-composition wrap">
      <div className="hero-copy">
        <h1>Skilled people.<br/><em className="hero-accent">Right when</em><br/>you need them.</h1>
        <p className="hero-description">Kaylo connects you with trusted local professionals for the jobs that keep everyday life moving.</p>
        <div className="hero-actions">
          <a href={sitePath('/download/')} className="button">Get started <ArrowUpRight size={18} aria-hidden="true"/></a>
          <a href="#how-it-works" className="text-link">How Kaylo works</a>
        </div>
      </div>
      <div className="service-moments" aria-label="Everyday services on Kaylo">
        {moments.map(([label, description], index) => <figure className={`moment moment-${index}`} key={label}>
          <div className={`moment-photo photo-${index}`} role="img" aria-label={description}/>
          <figcaption>{label}</figcaption>
        </figure>)}
      </div>
    </div>
    <nav className="hero-bottom wrap" aria-label="Explore Kaylo services">
      <a href={sitePath('/services/?category=Home')}><House size={20} aria-hidden="true"/><span>Home</span><span className="hero-category-detail">Repairs & upkeep</span><ArrowUpRight size={16} aria-hidden="true"/></a>
      <a href={sitePath('/services/?category=Farm')}><Sprout size={20} aria-hidden="true"/><span>Farm</span><span className="hero-category-detail">Land & harvest</span><ArrowUpRight size={16} aria-hidden="true"/></a>
      <a className="hero-care-link" href={sitePath('/services/?category=Care')}><HeartHandshake size={20} aria-hidden="true"/><span>Care</span><span className="hero-category-detail">Health & support</span><ArrowUpRight size={16} aria-hidden="true"/></a>
    </nav>
  </section>;
}
