import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { Wordmark } from '@/components/Logo';
import { sitePath } from '@/lib/site-path';
import './not-found.css';

export const metadata: Metadata = {
  title: 'Page not found | Kaylo',
  robots: { index: false, follow: true },
};

/** Clay artwork already used across the site, placed around the 404. */
const crew = ['icon_electric', 'icon_plumb', 'icon_carpentry', 'icon_garden', 'icon_coconut', 'mode_farm', 'mode_care'];

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="nf-page">
      <div className="nf-stage" aria-hidden="true">
        <svg className="nf-route" viewBox="0 0 520 440" fill="none">
          <path d="M58 92c64-46 150-38 196 6 38 37 18 90 70 112 58 25 122-34 150 22 24 48-30 96-92 112-74 19-118-40-184-14-58 23-80 84-138 56-46-22-40-88 4-118"/>
        </svg>
        <div className="nf-number">
          <span>4</span>
          <span className="nf-zero"><img src={sitePath('/app-art/mode_home.png')} alt=""/></span>
          <span>4</span>
        </div>
        {crew.map((art, index) => (
          <img key={art} className={`nf-crew nf-crew-${index + 1}`} src={sitePath(`/app-art/${art}.png`)} alt=""/>
        ))}
      </div>
      <h1>This page is out on a job.</h1>
      <footer className="nf-foot">
        <a className="nf-back" href={sitePath('/')}><ArrowLeft size={14} aria-hidden="true"/>Back to home</a>
        <a className="nf-wordmark" href={sitePath('/')} aria-label="Kaylo home"><Wordmark/></a>
      </footer>
    </main>
  );
}
