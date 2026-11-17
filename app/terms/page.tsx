import type { Metadata } from 'next';
import { canonicalMetadata } from '@/lib/site-metadata';
import { InformationPage } from '@/components/InformationPage';
import { sitePath } from '@/lib/site-path';

export const metadata: Metadata = {
  ...canonicalMetadata('/terms/'),
  title: 'Terms of service | Kaylo',
  description: 'Terms for using Kaylo and Kaylo Partner, including booking acceptance, payments, cancellations, professional responsibilities and support.',
};

const contents = [
  ['using-kaylo', 'Using Kaylo'], ['booking', 'Making a booking'],
  ['payments', 'Prices and payments'], ['cancellations', 'Cancellations and concerns'],
  ['professionals', 'Professional responsibilities'], ['care', 'Care services'],
  ['accounts', 'Accounts and information'], ['support', 'Support and updates'],
] as const;

export default function TermsPage() {
  return <InformationPage title="Terms of service" description="Please read these terms before using Kaylo, booking a service or accepting work through Kaylo Partner." contents={contents} updated="17 November 2026">
    <p className="privacy-intro">These terms cover the Kaylo customer app, Kaylo Partner and this website. Kaylo connects customers with independent local professionals for home, farm and care services. The service details, agreed price and booking record explain what is included in a particular booking.</p>
    <section id="using-kaylo"><h2>1. Using Kaylo</h2>
      <p>Use Kaylo lawfully and provide accurate account, location and service information. Do not impersonate another person, misuse someone else’s documents, interfere with the service or use chat and calls to harass others.</p>
      <p>Available professionals and services depend on the selected location, schedule and service requirements. A profile or verification indicator is information to help you choose; it is not a guarantee of every service outcome. Review the professional’s details and the work included before requesting a booking.</p>
      <p>The website’s interactive app preview illustrates the experience. Its sample conversations and bookings do not create actual service requests.</p>
    </section>
    <section id="booking"><h2>2. Making a booking</h2>
      <p>For new bookings, choose a professional, service, address, date, time and payment method. Submitting a request does not mean that the professional has accepted it. An unanswered request expires after 24 hours or at the scheduled start time, whichever comes first.</p>
      <p>After the professional accepts an online-payment booking, complete payment within the deadline shown in the app: up to 30 minutes after acceptance, ending no later than the scheduled start. Acceptance and payment confirmation are separate updates. Cash bookings do not have an online-payment deadline.</p>
      <p>Service dates and times are interpreted in India Standard Time. Work must take place on the booked date. Keep the address and access instructions accurate, and use booking messages to clarify the agreed scope before the visit.</p>
      <p>Older bookings may follow the payment and cancellation terms saved when they were created. Contact support if an older booking’s options differ from the process described here.</p>
    </section>
    <section id="payments"><h2>3. Prices and payments</h2>
      <p>The app displays the price for your selected service and options before you submit the request. Review quantities, duration, add-ons and any eligible discount. The saved booking amount is the amount used for payment. See <a href={sitePath('/pricing/')}>how pricing works</a>.</p>
      <p>Where online payment is available, Razorpay processes the transaction. Kaylo confirms payment after verification; a pending bank debit or interrupted checkout alone does not prove that a booking is paid. If the result is uncertain, check the booking’s payment status or contact support before paying again.</p>
      <p>For a cash booking, the professional confirms collection of the booking amount before completing the job. Work outside the agreed scope should be discussed before proceeding; do not assume additional work or materials are included.</p>
    </section>
    <section id="cancellations"><h2>4. Cancellations and service concerns</h2>
      <p>For new bookings, cancellation before work moves to “In progress” is free, including while the professional is travelling or has arrived. If an online payment was captured, the cancellation authorises a full refund of the verified payment. Refund authorisation and receipt of money are separate steps.</p>
      <p>After work starts, report incomplete work, quality concerns, an incorrect charge or a no-show through the booking’s help or dispute option. The case is reviewed against the booking and payment records. The current online process supports a full refund or no refund after review, not a partial refund.</p>
      <p>Read the <a href={sitePath('/refund-policy/')}>cancellation and refund policy</a> for pending payments, older bookings, cash returns and refund status.</p>
    </section>
    <section id="professionals"><h2>5. Professional responsibilities</h2>
      <p>Professionals must keep their service details and availability accurate, submit genuine documents and qualifications, and accept only work they can carry out. Any licence or professional registration required for the service must be valid. Do not describe a Kaylo verification indicator as a government licence or specialist qualification.</p>
      <p>Update the booking’s progress accurately and confirm cash only when it has actually been received. Customers and professionals should use the booking record and support process to resolve disagreements.</p>
      <p>The earnings shown in Kaylo Partner are accounting records. An earned or payable amount is not evidence of a bank transfer. Payout availability, verification and payment arrangements must be confirmed separately; these terms do not promise automatic payouts or escrow.</p>
    </section>
    <section id="care"><h2>6. Care services</h2>
      <p>Doctor appointments and caregiver services depend on the professional’s role, qualifications and availability. Verify that the service is appropriate for your needs. Clinical advice and treatment decisions belong to an appropriately qualified healthcare professional.</p>
      <p>Prescription scanning and text recognition help you keep a copy of a document. They may make mistakes, including in medicine names and dosage. Check the original prescription and consult your healthcare professional before relying on extracted text.</p>
      <p>Kaylo’s reminders, SOS alerts and in-app calls depend on device permissions and connectivity. Kaylo is not an emergency-response service. For an urgent medical or safety emergency, contact the appropriate local emergency service.</p>
    </section>
    <section id="accounts"><h2>7. Accounts and information</h2>
      <p>Keep sign-in details private and tell support if you suspect unauthorised access. Reviews should reflect a real service experience and must not include another person’s private information.</p>
      <p>The <a href={sitePath('/privacy/')}>privacy policy</a> explains the information used to run Kaylo. You can <a href={sitePath('/account-deletion/')}>request account deletion</a> from the app or website. An unresolved booking, payment, refund or dispute may require review before relevant records can be removed.</p>
    </section>
    <section id="support"><h2>8. Support and updates</h2>
      <p>For a booking issue, use the in-app help option or email <a href="mailto:kayloapp@gmail.com">kayloapp@gmail.com</a> with the booking reference and a brief description. See our <a href={sitePath('/contact/')}>contact page</a> for what to include.</p>
      <p>These terms may be updated as the service changes. The effective date is shown above. A later update does not change the price or policy already saved for an existing booking. Nothing in these terms takes away rights that cannot be excluded under applicable law.</p>
    </section>
  </InformationPage>;
}
