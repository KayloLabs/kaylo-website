import { StructuredData } from '@/components/StructuredData';
import {sitePath} from '../../lib/site-path';
import {canonicalMetadata, breadcrumbStructuredData} from '../../lib/site-metadata';
import type { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Services } from '@/components/Services';
import { HowItWorks } from '@/components/HowItWorks';
import { FinalCTA } from '@/components/FinalCTA';
export const metadata: Metadata = canonicalMetadata('/services/');
export default function ServicesPage(){return <><StructuredData data={breadcrumbStructuredData('/services/')}/><Navbar/><main id="main" tabIndex={-1} className="services-page"><h1 className="sr-only">Home, Farm and Care services</h1><div className="wrap page-breadcrumb"><a href={sitePath('/')}>Kaylo</a><span>/</span><span>Services</span></div><Services/><HowItWorks/><FinalCTA/></main><Footer/></>}
