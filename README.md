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
