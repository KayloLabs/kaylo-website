import type { Metadata } from 'next';
import { canonicalMetadata } from '@/lib/site-metadata';
import { InformationPage } from '@/components/InformationPage';
import { sitePath } from '@/lib/site-path';

export const metadata: Metadata = {
  ...canonicalMetadata('/pricing/'),
  title: 'Pricing and payment information | Kaylo',
  description: 'How Kaylo shows service prices, booking totals, offers and payment options before you request a professional.',
};
const contents = [
  ['service-price', 'Your service price'], ['booking-total', 'Your booking total'],
  ['payment', 'When you pay'], ['offers', 'Offers and discounts'], ['questions', 'Pricing questions'],
] as const;

export default function PricingPage() {
  return <InformationPage title="Pricing, explained" description="See the price for your chosen professional and service in the app before you send a booking request." contents={contents}>
    <p className="privacy-intro">Kaylo does not use one flat rate for every job. Prices depend on the service, professional and options you select. The live service listing and booking summary in the app are the place to check the amount for your job.</p>
    <section id="service-price"><h2>1. Find the price for your service</h2>
      <dl className="privacy-data-list">
        <div><dt>Home</dt><dd>Choose a professional and the service you need. Review the listed price, included work and any available quantity, duration or add-on choices.</dd></div>
        <div><dt>Farm</dt><dd>Select the agricultural service and its applicable quantity or work requirements. Review the available professional and calculated booking total before submitting.</dd></div>
        <div><dt>Care</dt><dd>Review the doctor’s appointment fee or the caregiver’s visit options and price, together with the selected date and time.</dd></div>
      </dl>
      <p>Availability and prices can differ between services and professionals. Images, app previews and sample booking amounts on this website are illustrative, not a quote for your job.</p>
    </section>
    <section id="booking-total"><h2>2. Review the booking total</h2>
      <p>The booking summary shows the amount for the service and options you selected, including any applied discount and charges displayed in that summary. Check the scope and total before submitting. The saved booking amount is used for payment; refreshing the app does not create a new agreed price.</p>
      <p>Do not assume materials, additional work or a longer visit are included unless the service details say so. Clarify requirements with the professional before work begins. If the scope or amount is unclear, contact Kaylo before making a payment.</p>
    </section>
    <section id="payment"><h2>3. When you pay</h2>
      <p>For new online bookings, request the service first and pay after the professional accepts. Complete checkout before the deadline shown in the app. Where available, cash bookings are paid to the professional, who confirms the amount collected before completing the job.</p>
      <p>Razorpay processes available online payment methods. A payment is confirmed after verification. For cancellation or an interrupted payment, follow the <a href={sitePath('/refund-policy/')}>cancellation and refund policy</a> rather than attempting another payment immediately.</p>
    </section>
    <section id="offers"><h2>4. Offers and discounts</h2>
      <p>Offers may depend on your account, a minimum booking amount, service eligibility, prior use or a validity period. Only a discount shown as applied in the booking summary reduces the amount you pay. A promotional image or scratch-card reveal by itself is not a completed booking or a cash entitlement.</p>
      <p>Read the offer terms shown in the app. If an offer does not apply to your booking, the undiscounted or otherwise eligible total is shown before you submit.</p>
    </section>
    <section id="questions"><h2>5. Questions about an amount</h2>
      <p>Email <a href="mailto:kayloapp@gmail.com?subject=Kaylo%20pricing%20question">kayloapp@gmail.com</a> with the service or booking reference and the amount you are asking about. For an existing booking, you can also use its in-app help option.</p>
      <p><a href={sitePath('/services/')}>Explore services</a> or read the <a href={sitePath('/terms/')}>terms of service</a>.</p>
    </section>
  </InformationPage>;
}
