import type { Metadata } from 'next';
import { canonicalMetadata } from '@/lib/site-metadata';
import { InformationPage } from '@/components/InformationPage';
import { sitePath } from '@/lib/site-path';

export const metadata: Metadata = canonicalMetadata('/refund-policy/');

const contents = [
  ['before-payment', 'Before payment'], ['before-work', 'Before work starts'],
  ['after-work-starts', 'After work starts'], ['refund-status', 'Refund status and timing'],
  ['cash', 'Cash payments'], ['older-bookings', 'Older bookings'], ['help', 'Get help'],
] as const;

export default function RefundPolicyPage() {
  return <InformationPage title="Cancellation & refunds" description="What happens to your booking and payment if plans change or something goes wrong." contents={contents} updated="17 November 2026">
    <p className="privacy-intro">This policy covers Home, Farm, doctor and caregiver bookings made through Kaylo. The app shows the cancellation outcome before you confirm it. New bookings use the acceptance-first process below; older bookings retain the policy recorded when they were created.</p>
    <section id="before-payment"><h2>1. Before payment</h2>
      <p>You request the service first, and the professional accepts or declines. Online payment becomes available after acceptance. If a request is declined, cancelled or expires before any payment is captured, there is no online payment to refund.</p>
      <p>If your bank shows a debit but Kaylo’s payment status is pending, the outcome must be checked. Do not make a second payment just because the checkout screen closed or your connection dropped. Contact support with the booking and payment reference.</p>
    </section>
    <section id="before-work"><h2>2. Before work starts</h2>
      <p>For new bookings, cancellation before the booking moves to “In progress” is free. This includes the “On the way” and “Arrived” stages. The same full-refund rule applies if the professional cancels before work starts.</p>
      <p>If an online payment has been captured and verified, cancellation authorises a full refund of that payment. If payment is captured after the booking has been cancelled or its payment deadline has passed, the booking is not restarted; the verified payment is routed into the refund process.</p>
      <p>A refund covers the amount actually paid, including the effect of any discount applied to that booking. It does not turn an unused discount into a cash payment.</p>
    </section>
    <section id="after-work-starts"><h2>3. After work starts</h2>
      <p>Once work is in progress, use the booking’s help or dispute option to report incomplete work, a quality issue, a wrong charge, a no-show or another concern. Include a clear description and relevant evidence.</p>
      <p>An authorised administrator reviews the booking and payment records. The current online dispute process supports a full refund or no refund after review. Partial refunds are not currently available through this process. Opening a dispute is not confirmation that a refund has been approved or completed.</p>
    </section>
    <section id="refund-status"><h2>4. Refund status and timing</h2>
      <p>Eligible refunds return through Razorpay to the original payment method. Kaylo does not ask for a UPI PIN, card PIN or new payment to release a refund.</p>
      <dl className="privacy-data-list">
        <div><dt>Authorised</dt><dd>The refund is approved in Kaylo and queued for submission. Money has not necessarily moved yet.</dd></div>
        <div><dt>Pending</dt><dd>The refund is awaiting processing or confirmation. A timeout or missing response is investigated rather than treated as a completed refund.</dd></div>
        <div><dt>Processed</dt><dd>Razorpay has confirmed processing. The time for the credit to appear depends on the payment method and your bank; the booking’s status is not a guarantee of immediate bank credit.</dd></div>
        <div><dt>Needs review or failed</dt><dd>Support must check the provider’s result and resolve the issue. Kaylo will not present an uncertain or failed refund as money already returned.</dd></div>
      </dl>
      <p>After a normal refund is submitted to Razorpay, its published guidance allows 7–10 business days for the credit to appear, depending on the payment method and bank. This estimate starts with submission to the payment provider, not when you open a dispute or request cancellation. It is not a promise of instant credit. See <a href="https://razorpay.com/docs/payments/refunds/normal/" target="_blank" rel="noopener noreferrer">Razorpay’s normal-refund guidance</a>.</p>
      <p>Check the booking for the latest status and any refund reference. If the refund remains pending, has failed, or the bank credit is missing after that timeframe, contact Kaylo so the payment can be traced.</p>
    </section>
    <section id="cash"><h2>5. Cash payments</h2>
      <p>A cash payment cannot be reversed through an online payment gateway. If cash needs to be returned, contact support for a review and an arrangement with the professional. A support decision or an app status alone is not proof that cash has been returned.</p>
    </section>
    <section id="older-bookings"><h2>6. Older bookings</h2>
      <p>Bookings made under an earlier payment process keep their original cancellation and payment rules. Refund requests for these bookings are reviewed by support against the saved booking and payment evidence. They are not silently converted to the new automatic cancellation policy.</p>
    </section>
    <section id="help"><h2>7. Get help with a payment</h2>
      <p>Use the booking’s help option or email <a href="mailto:kayloapp@gmail.com?subject=Kaylo%20payment%20support">kayloapp@gmail.com</a>. Include your booking reference, payment or refund reference if available, the date and amount, and a short explanation. Do not send passwords, one-time sign-in codes, full card details or payment PINs.</p>
      <p>Our <a href={sitePath('/contact/')}>contact page</a> explains the support routes. Read the <a href={sitePath('/terms/')}>terms of service</a> and <a href={sitePath('/pricing/')}>pricing information</a> alongside this policy.</p>
    </section>
  </InformationPage>;
}
