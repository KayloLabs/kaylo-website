import {sitePath} from '../../lib/site-path';
import type { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { WorkerApplication } from '@/components/WorkerApplication';
import './application.css';
import { Logo } from '@/components/Logo';
export const metadata:Metadata={title:'Join as a professional | Kaylo',description:'Bring your skill to Kaylo. Apply to connect with local customers for home, farm and care services.'};
export default function ProfessionalPage(){return <><Navbar/><main id="main" tabIndex={-1}><section className="professional-page wrap"><div className="professional-intro"><a className="breadcrumb" href={sitePath('/')}>Kaylo / For professionals</a><p className="eyebrow">GOOD WORK DESERVES TO BE FOUND</p><h1>You bring<br/>the <em>know-how.</em></h1><p>We’re building a simpler way for skilled people to connect with the people who need them.</p><img src={sitePath('/images/craftsman.jpg')} width={1448} height={1086} alt="A skilled carpenter in his workshop"/><ul><li>Identity documents and the qualifications required for your chosen role</li><li>A UPI ID or bank account for payouts</li><li>An email address you can open, for your partner login</li></ul><Logo className="pro-page-logo"/></div><WorkerApplication/></section></main><Footer/></>}
