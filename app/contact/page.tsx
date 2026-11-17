import type { Metadata } from 'next';
import { InformationPage } from '@/components/InformationPage';
import { sitePath } from '@/lib/site-path';

export const metadata: Metadata = {
  title: 'Contact and support | Kaylo',
  description: 'Contact Kaylo about a booking, payment, professional application, account or privacy request.',
};
const contents = [
  ['email', 'Contact Kaylo'], ['bookings', 'Booking and payment help'],
  ['professionals', 'Professional applications'], ['account', 'Accounts and privacy'], ['urgent', 'Urgent situations'],
] as const;

export default function ContactPage() {
  return <InformationPage title="Contact Kaylo" description="Get help with a booking, your account or a professional application." contents={contents}>
    <section id="email"><h2>1. Email support</h2>
      <p className="privacy-intro"><a href="mailto:kayloapp@gmail.com">kayloapp@gmail.com</a></p>
      <p>Tell us whether you use Kaylo or Kaylo Partner and give a short description of the issue. Include the relevant booking, payment, support-request or application reference if you have one. You can also create a support request in the app and return to it to read replies.</p>
      <p>Do not send your password, one-time sign-in code, full card number, CVV or UPI PIN. Send sensitive identity or health documents only through the appropriate private application or account process when requested.</p>
    </section>
    <section id="bookings"><h2>2. Booking and payment help</h2>
      <p>Open the relevant booking in the app to check its status, contact the professional or access help. For unfinished work, a quality concern, wrong charge or no-show, use the booking’s dispute option when available.</p>
      <p>If payment or a refund is uncertain, include its reference, date and amount. Avoid making a second payment while the first result is being checked. Read our <a href={sitePath('/refund-policy/')}>cancellation and refund policy</a> for the status meanings.</p>
    </section>
    <section id="professionals"><h2>3. Professional applications</h2>
      <p>Use the <a href={sitePath('/professionals/')}>professional application form</a> to apply. For an existing application, email from the address you used to apply and include your application reference.</p>
      <p>If Kaylo asks for a corrected document, use the secure update link provided for that application. Do not post identity documents or bank details in public messages.</p>
    </section>
    <section id="account"><h2>4. Accounts and privacy</h2>
      <p>You can request deletion from app settings or our <a href={sitePath('/account-deletion/')}>account-deletion page</a>, even if you have uninstalled the app. If you cannot access the registered email, contact support for an alternative identity check.</p>
      <p>For questions about access, correction, retention or sharing of information, read the <a href={sitePath('/privacy/')}>privacy policy</a> and email the support address above.</p>
    </section>
    <section id="urgent"><h2>5. Urgent situations</h2>
      <p>Kaylo support, chat and SOS features are not emergency-response services. If someone is in immediate danger or needs urgent medical help, contact the appropriate local emergency service directly.</p>
    </section>
  </InformationPage>;
}
