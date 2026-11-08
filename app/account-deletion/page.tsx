import type { Metadata } from 'next';
import { UserRoundMinus } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { AccountDeletionForm } from '@/components/AccountDeletionForm';
import { sitePath } from '@/lib/site-path';
import '../privacy-pages.css';

export const metadata: Metadata = {
  title: 'Request account deletion | Kaylo and Kaylo Partner',
  description: 'Request deletion of your Kaylo or Kaylo Partner account and associated data without reinstalling the app.',
  referrer: 'no-referrer',
};

export default function AccountDeletionPage() {
  return <><Navbar/><main id="main" tabIndex={-1} className="deletion-page wrap">
    <div className="page-breadcrumb"><a href={sitePath('/')}>Kaylo</a><span>/</span><span>Account deletion</span></div>
    <header className="privacy-heading"><div className="privacy-kicker"><UserRoundMinus size={18} aria-hidden="true"/>Kaylo & Kaylo Partner</div><h1>Your account.<br/><em>Your decision.</em></h1><p>Request deletion here, even if you have already uninstalled the app.</p></header>
    <div className="deletion-layout"><div className="deletion-explainer">
      <h2>What happens next</h2><p>Verify your account email, confirm the request, and keep the reference we give you. Sending a verification code does not request deletion. Kaylo records your request only after you confirm it.</p>
      <ul><li><strong>Account access and associated data:</strong> deletion covers your account, profile and eligible related data. If the same account is linked to both apps, deletion also removes that linked access.</li>
        <li><strong>Bookings, payments and applications:</strong> active work, refunds, unpaid balances or disputes may need review. Necessary financial or legal evidence can be retained with restricted access. A request remains pending until the required steps are complete.</li>
        <li><strong>Photos and documents:</strong> the request includes associated account photos and uploaded application documents, subject to necessary evidence retention.</li>
        <li><strong>On your device:</strong> separately remove local prescriptions and any exported files. Kaylo cannot remotely erase an offline device or copies you previously shared with someone else.</li></ul>
      <p>Read our <a href={sitePath('/privacy/#retention')}>privacy policy</a> for data categories and retention details.</p>
      <div className="deletion-alternative"><h3>Can’t access your email?</h3><p>If you used phone-only sign-in, lost access to your email, or need help with an unfinished request, email <a href="mailto:kayloapp@gmail.com?subject=Kaylo%20account%20deletion%20request">kayloapp@gmail.com</a>. Include the app you use and your account email or phone number so we can arrange an alternative identity check. Never send passwords, verification codes or full payment-card details.</p></div>
    </div><AccountDeletionForm/></div>
  </main><Footer/></>;
}
