import {sitePath} from '../lib/site-path';
import type { Metadata, Viewport } from 'next';
import { canonicalSiteOrigin } from '../lib/site-metadata';
import localFont from 'next/font/local';
import './globals.css';
import './brand-refresh.css';
import './marketing.css';
import './service-showcase.css';
const display = localFont({src:[{path:'../public/fonts/jakarta-regular.ttf',weight:'200 800',style:'normal'},{path:'../public/fonts/jakarta-italic.ttf',weight:'200 800',style:'italic'}],variable:'--font-display',display:'swap'});
const body = localFont({src:'../public/fonts/hankengrotesk-HankenGrotesk[wght].ttf',variable:'--font-body',display:'swap',weight:'100 900'});
// Do not put a canonical or homepage social metadata here: private routes also
// inherit this layout. Each public page explicitly defines its own previews.
export const metadata: Metadata = {
  metadataBase: new URL(canonicalSiteOrigin),
  applicationName: 'Kaylo',
  title: 'Kaylo',
  icons: {
    icon: [
      {url:sitePath('/icons/kaylo-mark-v2.ico'),type:'image/x-icon',sizes:'16x16 32x32 48x48'},
      {url:sitePath('/icons/kaylo-mark-v2-192.png'),type:'image/png',sizes:'192x192'},
      {url:sitePath('/icons/kaylo-mark-v2-96.png'),type:'image/png',sizes:'96x96'},
    ],
    shortcut: sitePath('/icons/kaylo-mark-v2.ico'),
    apple: [{url:sitePath('/icons/kaylo-apple-touch-v2.png'),type:'image/png',sizes:'180x180'}],
    other: [{rel:'mask-icon',url:sitePath('/icons/kaylo-mask-v2.svg'),color:'#264d36'}],
  },
};
export const viewport: Viewport = { themeColor: '#f8f7f1' };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en" className={`${display.variable} ${body.variable}`}><body><a className="skip-link" href="#main">Skip to content</a>{children}</body></html>}
