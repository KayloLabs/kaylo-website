# Kaylo website

A responsive Next.js 16 / React 19 landing page, built with TypeScript, Tailwind CSS 4, Motion and Lucide. Static export; no server or secret environment values are required.

## Run

- `npm ci`
- `npm run dev` opens the development server at http://127.0.0.1:3000
- `npm run typecheck`
- `npm run build` produces the deployable `out/` directory

## Design and interactions

Ivory, natural green and earthy neutrals, self-hosted Instrument Serif and DM Sans, original editorial imagery. Service tabs show Home, Farm and Care; service buttons open accessible Radix dialogs. The phone is an interactive illustrative preview with four screens. Navigation collapses on mobile, scroll motion respects reduced-motion preferences, and privacy/terms dialogs are keyboard accessible.

Download links have not been invented. Get started and professional enquiries currently open a contact path to kayloapp@gmail.com. Replace these with official app store and partner onboarding links once available. The phone's sample booking and conversation are illustrative. Artwork depicts generated people, not actual Kaylo providers or testimonials. Verify all service availability and operational brand claims before public launch.

## Content

Landing sections live in `components/`, global design rules in `app/globals.css`. Images in `public/images` were generated with the built-in image generation tool. Exact briefs are recorded in `ASSET_PROMPTS.json`. The app repository and saved APK are separate and unchanged by this website task.

Hosting is configured as a private static Site in `.openai/hosting.json`. No analytics, payment collection, account creation or newsletter backend is attached to this marketing site.

## Professional applications

The website now has `/services/` and `/professionals/` pages. The application form POSTs to `/api/applications`, validates on the server, and stores submissions in the private Sites D1 `professional_applications` table. There is no public listing endpoint and no email is sent automatically. The Site owner can inspect applications using Sites database tools; applicants can request correction or deletion through the support email. New applications require contact consent. The submit reference also makes retrying the same submission idempotent.

Next.js still generates the public pages; a small Cloudflare Worker serves those assets and handles the form endpoint. `npm run build` packages both. Run `npx wrangler d1 migrations apply kaylo-professionals --local`, then `npm run preview` for the full local experience at port 3001 (the Next development server alone does not host the Worker API). Production migrations are applied by Sites.

The exact app SVG layers and splash choreography power `components/Logo.tsx`. The interactive phone uses original app PNG assets. Its bookings/messages/profile changes are an isolated in-memory demo and do not touch real accounts, payments, or providers.
