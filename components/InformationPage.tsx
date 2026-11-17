import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { sitePath } from '@/lib/site-path';
import '@/app/privacy-pages.css';

type InformationPageProps = {
  title: string;
  description: string;
  contents: ReadonlyArray<readonly [string, string]>;
  updated?: string;
  children: ReactNode;
};

/** Public information shares the same readable layout as the privacy policy. */
export function InformationPage({ title, description, contents, updated, children }: InformationPageProps) {
  return <><Navbar/><main id="main" tabIndex={-1} className="privacy-page wrap">
    <div className="page-breadcrumb"><a href={sitePath('/')}>Kaylo</a><span aria-hidden="true">/</span><span>{title}</span></div>
    <header className="privacy-heading">
      <div className="privacy-kicker">Kaylo · Home · Farm · Care</div>
      <h1>{title}</h1>
      <p>{description}</p>
      {updated && <div className="privacy-meta"><span>Effective {updated}</span></div>}
    </header>
    <div className="privacy-layout">
      <aside className="privacy-contents"><span>On this page</span>
        <nav aria-label={`${title} sections`}>{contents.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}</nav>
        <a className="privacy-request-link" href={sitePath('/contact/')}>Contact Kaylo <ArrowUpRight size={16} aria-hidden="true"/></a>
      </aside>
      <article className="privacy-article">{children}</article>
    </div>
  </main><Footer/></>;
}
