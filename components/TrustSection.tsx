import { BadgeCheck, MessagesSquare, Star } from 'lucide-react';
import { sitePath } from '../lib/site-path';
import { Reveal } from './Motion';

const details = [
  { icon: BadgeCheck, title: 'Know who you’re booking', copy: 'See the professional’s experience, service details and verification information on their profile.' },
  { icon: Star, title: 'Read before you decide', copy: 'Check ratings and reviews alongside the price and available times.' },
  { icon: MessagesSquare, title: 'Keep the details together', copy: 'Discuss the work in Kaylo and follow your booking as it progresses.' },
];

export function TrustSection() {
  return <section className="section trust trust-editorial" id="about">
    <div className="wrap trust-grid">
      <Reveal className="trust-photo">
        <img src={sitePath('/images/craftsman.jpg')} width="1448" height="1086" loading="lazy" alt="A carpenter at work at a workshop bench"/>
        <p lang="ml" className="trust-local-note">നാട്ടിലെ ആളുകൾ. നാട്ടിലെ സേവനങ്ങൾ.</p>
      </Reveal>
      <Reveal className="trust-copy">
        <p className="eyebrow">About Kaylo</p>
        <h2>People you can{' '}<br/>feel good about <em>calling.</em></h2>
        <p>Built in Kerala, Kaylo brings local skills closer to the people who need them. Get to know the person and agree the details before the work begins.</p>
        <ul className="trust-details">
          {details.map(({ icon: Icon, title, copy }) => <li key={title}>
            <Icon size={20} strokeWidth={1.6} aria-hidden="true"/>
            <div><h3>{title}</h3><p>{copy}</p></div>
          </li>)}
        </ul>
      </Reveal>
    </div>
  </section>;
}
