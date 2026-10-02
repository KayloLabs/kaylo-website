import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Kaylo | Skilled people. Right when you need them.',description:'Find local help for your home, farm and loved ones. Kaylo connects you with skilled professionals for the jobs that keep everyday life moving.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a>{children}</body></html>}
