import { SiteExperience } from '@/components/SiteExperience';
import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { BrandStatement } from '@/components/Motion';
import { HowItWorks } from '@/components/HowItWorks';
import { Services } from '@/components/Services';
import { TrustSection,LocalSection } from '@/components/TrustSection';
import { AppPreview } from '@/components/AppPreview';
import { Professionals } from '@/components/Professionals';
import { FinalCTA } from '@/components/FinalCTA';
import { Footer } from '@/components/Footer';
export default function Page(){return <SiteExperience><Navbar/><main id="main" tabIndex={-1}><Hero/><BrandStatement/><HowItWorks/><Services/><TrustSection/><LocalSection/><AppPreview/><Professionals/><FinalCTA/></main><Footer/></SiteExperience>}
