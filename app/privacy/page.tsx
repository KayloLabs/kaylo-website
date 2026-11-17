import type { Metadata } from 'next';
import { canonicalMetadata } from '@/lib/site-metadata';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { sitePath } from '@/lib/site-path';
import '../privacy-pages.css';

export const metadata: Metadata = {
  ...canonicalMetadata('/privacy/'),
  title: 'Privacy policy | Kaylo and Kaylo Partner',
  description: 'How Kaylo and Kaylo Partner use, share and retain your information, and how to request account deletion.',
};

const contents = [
  ['information', 'Information we use'], ['permissions', 'Device permissions'],
  ['sharing', 'Sharing and service providers'], ['retention', 'How long information stays'],
  ['choices', 'Your choices and deletion'], ['website', 'Using this website'],
  ['contact', 'Contact and updates'],
] as const;

export default function PrivacyPage() {
  return <><Navbar/><main id="main" tabIndex={-1} className="privacy-page wrap">
    <div className="page-breadcrumb"><a href={sitePath('/')}>Kaylo</a><span>/</span><span>Privacy</span></div>
    <header className="privacy-heading"><div className="privacy-kicker"><ShieldCheck size={18} aria-hidden="true"/>Kaylo · Kaylo Partner · Website</div>
      <h1>Your information.<br/><em>Your choices.</em></h1>
      <p>This policy explains the information used to run Kaylo, from finding a professional to completing a booking.</p>
      <div className="privacy-meta"><span>Effective 6 November 2026</span></div>
    </header>
    <div className="privacy-layout"><aside className="privacy-contents"><span>On this page</span><nav aria-label="Privacy policy sections">{contents.map(([id,title])=><a key={id} href={`#${id}`}>{title}</a>)}</nav><a className="privacy-request-link" href={sitePath('/account-deletion/')}>Request account deletion <ArrowUpRight size={16} aria-hidden="true"/></a></aside>
    <article className="privacy-article">
      <p className="privacy-intro">Kaylo connects customers with local home, farm and care professionals. This policy covers the Kaylo customer app, Kaylo Partner, professional applications, administrative services and this website. For privacy questions, contact Kaylo at <a href="mailto:kayloapp@gmail.com">kayloapp@gmail.com</a>.</p>
      <section id="information"><h2>1. Information we use</h2>
        <dl className="privacy-data-list">
          <div><dt>Your account and profile</dt><dd>Name, email address, phone number, sign-in identity, chosen profile photo, language and account preferences. We use these to authenticate you, display your profile and provide support.</dd></div>
          <div><dt>Addresses, bookings and travel</dt><dd>Saved addresses, the location you select, service requirements, booking times, status changes, reviews and relevant contact details. A partner’s journey location is shared with the customer for the relevant booking when journey tracking is active.</dd></div>
          <div><dt>Messages, calls and trusted contacts</dt><dd>Booking messages and their delivery/read status, call invitations and connection status, plus the trusted contacts and SOS details you choose to add. We do not record call audio. Messages are available to the people in that conversation; Kaylo does not claim that chat is end-to-end encrypted.</dd></div>
          <div><dt>Care and prescriptions</dt><dd>Care appointments, caregiver visits, reminders and emergency-contact information you enter. Prescription scans, PDFs and extracted text are stored in the customer app’s local device storage. Prescription scanning and OCR run on the device; documents are not automatically uploaded to a doctor or contact. Sharing sends the document to the app or recipient you select.</dd></div>
          <div><dt>Professional applications</dt><dd>Contact and service information, experience, profile photo, identity documents, submitted qualifications, and applicable doctor or caregiver credentials. Applications may include bank-account or UPI details for partner payment administration. Authorized reviewers use the submitted evidence to review applications. Identity documents and payout details are not public profile information.</dd></div>
          <div><dt>Payments and support</dt><dd>Amounts, booking/payment references, payment status, refund and dispute records, earnings entries and support correspondence. Razorpay handles online payment details. Kaylo does not store your full payment-card number, CVV or PIN.</dd></div>
          <div><dt>Technical information</dt><dd>App and device version, notification tokens, diagnostic errors, app interaction events and technical request information. Firebase Analytics and Crashlytics support usage measurement and crash diagnosis in configured app builds. Hosting and backend services process request information to serve and protect the service.</dd></div>
        </dl>
      </section>
      <section id="permissions"><h2>2. Device permissions</h2><p>Permission prompts appear when the related feature needs them. You can manage these permissions in your phone’s settings.</p>
        <ul><li><strong>Location:</strong> to find an address or services and, in Kaylo Partner, share an active booking journey with the customer. The Partner journey can use a foreground location service with a visible notification.</li>
          <li><strong>Microphone:</strong> for voice search and in-app calls. Voice recognition is handled by your device or browser’s speech service, which may use its own online processing.</li>
          <li><strong>Photos and camera:</strong> for a profile photo, prescription scan or application document you choose to provide. Picking a photo does not make the rest of your library public.</li>
          <li><strong>Notifications:</strong> for booking and message updates, incoming-call invitations and reminders. Delivery depends on your device settings and connectivity.</li>
          <li><strong>Phone and contact features:</strong> for the optional SIM emergency-call flow and selecting a contact. Contact selection is used for the contact you choose; Kaylo does not publish your phonebook.</li></ul>
      </section>
      <section id="sharing"><h2>3. Sharing and service providers</h2><p>We share the information needed to fulfil a booking with its customer and professional. Public professional profiles show the service, profile and review information intended for discovery. Private identity documents, payout details and exact home locations are not part of the public directory.</p>
        <p>Trusted contacts receive the SOS information and invitations that you choose to send. A shared prescription or exported file is available to the recipient you select and may remain with that recipient after you delete your Kaylo copy.</p>
        <p>Our infrastructure includes <strong>Google Firebase</strong> for authentication, notifications, analytics and diagnostics; <strong>Supabase</strong> for backend records, storage and real-time updates; <strong>Razorpay</strong> for online payments; and hosting and email providers for website delivery and service messages. Map, address, weather and routing services receive the requests needed for the feature you use, which can include the selected coordinates and your network address. These providers may process information outside your country.</p>
        <p>Access is limited to the people and providers who need the information to deliver, secure or support the service. We may also disclose relevant information where required by law or to investigate fraud, abuse or a dispute. Kaylo does not sell personal information.</p>
      </section>
      <section id="retention"><h2>4. How long information stays</h2><p>We keep account information while it is needed to provide your account and services. You can remove editable profile information, addresses and local records through the available app controls, or contact us for help.</p>
        <dl className="privacy-retention"><div><dt>Account and service data</dt><dd>Deletion removes or anonymises eligible account data. An unresolved booking, payment, refund or dispute may require a review before related records can be removed. A deletion request is not the same as confirmed completion.</dd></div>
          <div><dt>Application documents and photos</dt><dd>Documents are used for application and verification review. A verified deletion request includes associated application records and uploaded documents, subject to any specific unresolved obligation or required retention.</dd></div>
          <div><dt>Financial, dispute and security evidence</dt><dd>Relevant records may be retained with restricted access to resolve a transaction or dispute, prevent abuse or meet an applicable legal requirement. They are not kept as an active public profile. Contact us to ask what must be retained for your particular request.</dd></div>
          <div><dt>Device-local prescriptions and shared copies</dt><dd>Local prescriptions remain on the device until you delete them, clear app data or remove the app. A website request cannot erase an offline device or a file already exported to another app. Delete those copies on the device or with the recipient.</dd></div>
          <div><dt>Infrastructure records and backups</dt><dd>Service providers may retain limited transaction, diagnostic, security or backup records under their retention settings and legal duties. Deletion from the active service does not mean that every backup or previously shared copy disappears immediately.</dd></div></dl>
      </section>
      <section id="choices"><h2>5. Your choices and account deletion</h2><p>You can update your profile, manage device permissions and notification preferences, and request access, correction or deletion of your information. Do not include passwords, sign-in codes, complete card details or unnecessary health records in support messages.</p>
        <p>To delete your account, use the account-deletion option in app settings or the <a href={sitePath('/account-deletion/')}>account-deletion page</a>. The website route works without reinstalling either app. We verify control of the account before accepting a request; sending a code alone does not delete anything.</p>
        <p>If you no longer have access to your account email or used phone-only sign-in, contact <a href="mailto:kayloapp@gmail.com?subject=Kaylo%20account%20deletion%20request">kayloapp@gmail.com</a> for an alternative identity check. Tell us whether you use Kaylo or Kaylo Partner. We will not ask for your password or payment-card PIN.</p>
      </section>
      <section id="website"><h2>6. Using this website</h2><p>Public information pages do not require sign-in. The website remembers appearance choices and whether the introduction has played. Professional-application drafts retain non-personal choices such as service and partner type; an unfinished upload may retain its application reference and expiring access in the current tab.</p>
        <p>Administrator and download-access sessions are held in memory. The account-deletion form keeps the entered email and verification details only for the current page interaction and sends them to Kaylo’s backend when you submit the form. They are not put in page URLs or browser storage.</p>
        <p>The public website does not add advertising trackers or analytics cookies. Hosting services can still process technical request information. App analytics and diagnostics are separate and are described above.</p>
      </section>
      <section id="contact"><h2>7. Contact and updates</h2><p><strong>Service:</strong> Kaylo and Kaylo Partner<br/><strong>Privacy contact:</strong> <a href="mailto:kayloapp@gmail.com">kayloapp@gmail.com</a></p>
        <p>This policy may be updated when our features or data practices change. The effective date appears at the top of this page. We will provide an additional notice where a change requires it.</p>
        <a className="button" href={sitePath('/account-deletion/')}>Manage account deletion <ArrowUpRight size={18} aria-hidden="true"/></a>
      </section>
    </article></div>
  </main><Footer/></>;
}
