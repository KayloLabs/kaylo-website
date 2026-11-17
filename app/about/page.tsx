import type { Metadata } from 'next';
import { canonicalMetadata } from '@/lib/site-metadata';
import { InformationPage } from '@/components/InformationPage';
import { sitePath } from '@/lib/site-path';

export const metadata: Metadata = canonicalMetadata('/about/');
const contents = [
  ['platform', 'What Kaylo does'], ['services', 'Home, Farm and Care'],
  ['professionals', 'For professionals'], ['booking', 'How booking works'], ['contact', 'Get in touch'],
] as const;

export default function AboutPage() {
  return <InformationPage title="About Kaylo" description="A Kerala-rooted platform connecting people with local professionals for everyday services." contents={contents}>
    <section id="platform"><h2>1. What Kaylo does</h2>
      <p className="privacy-intro">Kaylo brings service discovery, booking requests and communication into one place. Customers can review professional profiles, choose a service and time, and follow a booking from the request through completion.</p>
      <p>Our focus is practical: make it easier to find appropriate local help and give skilled professionals a way to reach customers and manage their work. Service availability depends on the area and the professionals using the platform.</p>
    </section>
    <section id="services"><h2>2. Home, Farm and Care</h2>
      <dl className="privacy-data-list">
        <div><dt>Home</dt><dd>Household services and maintenance, such as electrical work, plumbing, cleaning, appliance repair and carpentry.</dd></div>
        <div><dt>Farm</dt><dd>Agricultural services that connect people with professionals for the work their farm requires.</dd></div>
        <div><dt>Care</dt><dd>Doctor appointments, caregiver visits and everyday care tools, including reminders and personal prescription records.</dd></div>
      </dl>
      <p>Explore the <a href={sitePath('/services/')}>service categories</a> and check the app for actual professionals, availability and booking prices.</p>
    </section>
    <section id="professionals"><h2>3. For professionals</h2>
      <p>Kaylo Partner helps professionals receive and respond to booking requests, manage availability, communicate with customers and keep track of completed work and earnings records. Professionals submit relevant details and documents through the application process.</p>
      <p><a href={sitePath('/professionals/')}>Apply as a professional</a>. An application is reviewed before approval; submitting a form is not a guarantee of acceptance or future bookings.</p>
    </section>
    <section id="booking"><h2>4. How booking works</h2>
      <p>Choose the professional and service, review the price and send a booking request. For new online bookings, the professional accepts before payment becomes available. The app then keeps the booking, payment and work-progress updates together.</p>
      <p>Read <a href={sitePath('/pricing/')}>how pricing works</a>, the <a href={sitePath('/terms/')}>terms of service</a> and the <a href={sitePath('/refund-policy/')}>cancellation and refund policy</a> before booking.</p>
    </section>
    <section id="contact"><h2>5. Get in touch</h2>
      <p>Contact Kaylo at <a href="mailto:kayloapp@gmail.com">kayloapp@gmail.com</a> for service, partnership or account enquiries. For an existing booking or application, include its reference so we can find the relevant record.</p>
      <p><a href={sitePath('/contact/')}>Contact and support</a> · <a href={sitePath('/download/')}>Download Kaylo</a></p>
    </section>
  </InformationPage>;
}
