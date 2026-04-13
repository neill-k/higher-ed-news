## Higher Ed News

An editorial-style [Next.js](https://nextjs.org) app starter for a higher education news product, built with the App Router and ready to deploy on [Vercel](https://vercel.com).

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Vercel-ready deployment path

## Getting Started

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The main entry points are:

- `src/app/page.tsx` for the homepage
- `src/app/layout.tsx` for global metadata and fonts
- `src/app/globals.css` for the color system, typography, and motion

## Quality Checks

Run the standard checks before shipping:

```bash
npm run lint
npm run build
```

## Deploy on Vercel

The easiest path is to import this repository into Vercel and deploy it directly. For a local-to-Vercel workflow, you can also use the Vercel CLI.

- [Create a Vercel project](https://vercel.com/new)
- [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying)

## Next Steps

- Replace the placeholder editorial content with live stories or CMS-backed content.
- Add search, filtering, or topic pages.
- Connect scheduled ingestion, summaries, or newsroom workflows once the data model is defined.
