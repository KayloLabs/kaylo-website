import type {Metadata} from 'next';
import {Navbar} from '@/components/Navbar';
import {Footer} from '@/components/Footer';
import {ApkDownloads} from '@/components/ApkDownloads';
import {sitePath} from '@/lib/site-path';
import './download.css';
export const metadata: Metadata = {title: 'Download Kaylo & Kaylo Partner | Kaylo', description: 'Download the Kaylo customer and partner Android apps with your download password.'};
export default function DownloadPage() {
  return <><Navbar/><main id="main" className="download-page wrap"><div className="page-breadcrumb"><a href={sitePath('/')}>Kaylo</a><span>/</span><span>Download</span></div><header className="download-heading"><h1>Kaylo, <em>on your phone.</em></h1><p>Two apps. One connected community.<br/>Enter your download password to get started.</p></header><ApkDownloads/></main><Footer/></>;
}
