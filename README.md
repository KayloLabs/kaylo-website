# Kaylo website

A responsive Next.js 16 / React 19 landing page, built with TypeScript, Tailwind CSS 4, Motion and Lucide. Static export for GitHub Pages, with Firebase authentication and the existing protected Supabase backend.

## Run

- `npm ci`
- `npm run dev` opens the development server at http://127.0.0.1:3000
- `npm run typecheck`
- `npm run build` produces the deployable `out/` directory

## Design and interactions

Ivory, natural green and earthy neutrals, self-hosted Plus Jakarta Sans and Hanken Grotesk, original editorial imagery. Service tabs show Home, Farm and Care; service buttons open accessible Radix dialogs. The phone is an interactive illustrative preview with Home, Bookings, Care, Messages and Profile screens. Navigation collapses on mobile, scroll motion respects reduced-motion preferences, and privacy/terms dialogs are keyboard accessible. The service intro plays once per tab; the footer uses the original wordmark and symbol, with a pale wave separating the closing sections.

Download links have not been invented. Get started uses the contact path; Join as a Professional opens the partner application. Replace the contact path with official app store links once available. The phone's sample booking and conversation are illustrative. Artwork depicts generated people, not actual Kaylo providers or testimonials. Verify all service availability and operational brand claims before public launch.

## Content

Landing sections live in `components/`, global design rules in `app/globals.css`. Images in `public/images` were generated with the built-in image generation tool. Exact briefs are recorded in `ASSET_PROMPTS.json`. The app repository and saved APK are separate and unchanged by this website task.

The public website is hosted on GitHub Pages. The original Sites configuration remains in `.openai/hosting.json` for the older deployment. No analytics, payment collection, account creation or newsletter backend is attached to this marketing site.

## Professional applications

`/professionals/` runs the full Kaylo Partner application in the browser, in the same four steps as the app: about you, your work and service area, your documents, payout and consent. `components/WorkerApplication.tsx` renders it and `lib/worker-application.ts` mirrors every rule of the Supabase RPC `submit_worker_application` (app repository migration 0027) so the server never rejects a form the site accepted. Submission calls that RPC with the anon key, uploads the five documents one at a time to the `worker-application-documents` function with the receipt's upload token, confirms them through `worker_application_status`, then shows the `KA-` reference, the status checker and what happens next. Typed text stays in `sessionStorage` for the tab so a reload does not lose it; files never leave memory. Applications land in the review queue at `/admin/`, and correction requests use `/application/update/`.

Website leads are retired in favour of applications: `submit_professional_lead` and migration 0028 remain in the app repository untouched, but the site no longer calls them.

Existing submissions in the original Sites D1 `professional_applications` table remain there; no data has been removed. The original Worker remains available for that older deployment through `npm run build`.

The exact app SVG layers and splash choreography power `components/Logo.tsx`. The interactive phone uses original app PNG assets. Its bookings/messages/profile changes are an isolated in-memory demo and do not touch real accounts, payments, or providers.

## GitHub Pages deployment

Live site: https://kaylolabs.github.io/kaylo-website/

Admin: https://kaylolabs.github.io/kaylo-website/admin/

Build using `NEXT_PUBLIC_BASE_PATH=/kaylo-website npm run build:pages`. Publish **only the contents of `out/`**, including `.nojekyll`, to the `main` branch of `KayloLabs/kaylo-website`. That repository holds compiled public assets, not private source history or server credentials. GitHub Pages serves its root directory.

All public links, images, fonts, and the admin portal support the project path. The frontend contains only the public Firebase API key and Supabase anon key. Firebase tokens stay in memory and administrator permission is checked by the existing Edge Functions. Private documents and review decisions remain protected by the backend.

Set Supabase `KAYLO_PORTAL_URL=https://kaylolabs.github.io/kaylo-website/` after publication. The email URL helpers preserve the project subpath for administrator and applicant correction links.

For the identical local build run `NEXT_PUBLIC_BASE_PATH=/kaylo-website node scripts/preview-admin.mjs` and open http://127.0.0.1:3100/kaylo-website/admin/. This static preview avoids development watcher limits.

Checks: `npm run typecheck`, `node --experimental-strip-types --test lib/*.test.ts`, and `node --test server/worker.test.mjs`. The application contract's own database tests live in the app repository under `supabase/tests/worker_applications.sql` and `supabase/tests/partner_admin_review.sql`.
