import type { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ProfessionalForm } from '@/components/ProfessionalForm';
import { Logo } from '@/components/Logo';
export const metadata:Metadata={title:'Join as a professional | Kaylo',description:'Bring your skill to Kaylo. Apply to connect with local customers for home, farm and care services.'};
export default function ProfessionalPage(){return <><Navbar/><main id="main"><section className="professional-page wrap"><div className="professional-intro"><a className="breadcrumb" href="/">Kaylo / For professionals</a><p className="eyebrow">GOOD WORK DESERVES TO BE FOUND</p><h1>You bring<br/>the <em>know-how.</em></h1><p>We’re building a simpler way for skilled people to connect with the people who need them.</p><img src="/images/craftsman.jpg" width={1448} height={1086} alt="A skilled carpenter in his workshop"/><ul><li>Reach people in your area</li><li>Keep bookings and conversations together</li><li>Build a profile around your work</li></ul><Logo animated className="pro-page-logo"/></div><ProfessionalForm/></section></main><Footer/></>}
