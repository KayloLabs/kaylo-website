import {sitePath} from '../lib/site-path';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './brand-refresh.css';
import './marketing.css';
import './service-showcase.css';
const display = localFont({src:[{path:'../public/fonts/jakarta-regular.ttf',weight:'200 800',style:'normal'},{path:'../public/fonts/jakarta-italic.ttf',weight:'200 800',style:'italic'}],variable:'--font-display',display:'swap'});
const body = localFont({src:'../public/fonts/hankengrotesk-HankenGrotesk[wght].ttf',variable:'--font-body',display:'swap',weight:'100 900'});
export const metadata: Metadata = {title:'Kaylo | Skilled people. Right when you need them.',description:'Find local help for your home, farm and loved ones. Kaylo connects you with skilled professionals for the jobs that keep everyday life moving.',icons:{
  icon:[
    {url:sitePath('/icons/kaylo-mark-v1.ico'),type:'image/x-icon',sizes:'16x16 32x32 48x48'},
    {url:sitePath('/icons/kaylo-mark-v1-16.png'),type:'image/png',sizes:'16x16'},
    {url:sitePath('/icons/kaylo-mark-v1-32.png'),type:'image/png',sizes:'32x32'},
    {url:sitePath('/icons/kaylo-mark-v1.svg'),type:'image/svg+xml',sizes:'any'},
  ],
  shortcut:sitePath('/icons/kaylo-mark-v1.ico'),
  apple:[{url:sitePath('/icons/kaylo-apple-touch-v1.png'),type:'image/png',sizes:'180x180'}],
  other:[{rel:'mask-icon',url:sitePath('/icons/kaylo-mask-v1.svg'),color:'#264d36'}],
}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en" className={`${display.variable} ${body.variable}`}><body><a className="skip-link" href="#main">Skip to content</a>{children}</body></html>}
