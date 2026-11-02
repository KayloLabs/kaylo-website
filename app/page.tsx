import { SiteExperience } from '@/components/SiteExperience';
import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { Services } from '@/components/Services';
import { TrustSection } from '@/components/TrustSection';
import { AppPreview } from '@/components/AppPreview';
import { Professionals } from '@/components/Professionals';
import { FinalCTA } from '@/components/FinalCTA';
import { Footer } from '@/components/Footer';
export default function Page(){return <SiteExperience><Navbar/><main id="main" tabIndex={-1} className="marketing-home"><Hero/><Services/><AppPreview/><TrustSection/><Professionals/><FinalCTA/></main><Footer/></SiteExperience>}
