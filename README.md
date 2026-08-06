# Originfacts.com Strapi CMS — Next.js 15 frontend

OriginFacts.com is a travel and airport information site built with Next.js and backed by a Strapi CMS. The production frontend is self-hosted on a dedicated VM, not deployed on Vercel.

## Stack
- Next.js 15 (App Router, React Server Components)
- React 19
- Tailwind CSS + `@tailwindcss/typography` for article rendering
- Fraunces serif display + Geist sans body (distinctive editorial look)
- Fetches from Strapi 5 REST API, with ISR (60 s stale-while-revalidate)
- Resend for contact form email
- TravelPayouts, Stay22, Google AdSense, SerpApi, and RapidAPI Airport Info integrations
- Fully responsive, SEO-ready (Open Graph, Twitter cards, canonical URLs)

## Production platform
- Hosting: Dedicated VM at `146.0.42.20`
- Public site: `https://www.originfacts.com`
- Canonical redirect: `originfacts.com` redirects to `www.originfacts.com`
- Web server / reverse proxy: nginx with Let's Encrypt certificates from Certbot
- Frontend runtime: native systemd service, `originfacts-com.service`
- Frontend port: `127.0.0.1:3000`, proxied by nginx
- Project path: `/var/www/html/originfacts.com`
- CMS: Strapi exposed at `https://cms.fxnstudio.com`
- CMS container: Docker container `fxn-strapi`, mapped to `127.0.0.1:8888 -> 1337`
- Deploy webhook: `originfacts-webhook.service`, which runs `/usr/local/bin/deploy-originfacts.sh`

## Docker status
The OriginFacts frontend is currently **not** running in Docker. It runs directly on the VM using systemd:

```bash
systemctl status originfacts-com.service
```

Docker is running on the server for other services, including the Strapi CMS container:

```bash
docker ps
```

## Pages
- `/` — Home: featured article + latest by category + destinations
- `/articles` — All articles (paginated)
- `/articles/[slug]` — Article detail with related by category
- `/category/[slug]` — Category landing (e.g. Flights, Hotels, Tips)
- `/destinations` — All destinations grid
- `/destinations/[slug]` — Destination page with all articles about it
- `/airports` and `/airports/[iata]` — Airport directory and airport detail pages
- `/airlines` and `/airlines/[slug]` — Airline directory and airline detail pages
- `/countries` and `/countries/[code]` — Country travel pages
- `/flight-routes` and `/flight-routes/[slug]` — Route pages
- `/flights-from-perth*` — Perth travel landing pages

## Local development

```bash
cd /var/www/html/originfacts.com
yarn install
yarn dev
```

Local dev runs at `http://localhost:3000`.

## Build and restart on the VM

Use these commands for a manual production rebuild:

```bash
cd /var/www/html/originfacts.com
yarn install --frozen-lockfile
yarn build
systemctl restart originfacts-com.service
systemctl status originfacts-com.service
```

To check nginx after changing the vhost:

```bash
nginx -t
systemctl reload nginx
```

## Automated deployment

Production deploys can be triggered by the GitHub webhook listener:

```bash
systemctl status originfacts-webhook.service
tail -f /var/log/originfacts-deploy.log
```

The webhook deploy script runs:

```bash
cd /var/www/html/originfacts.com
git fetch --quiet origin main
git reset --hard origin/main
yarn install --frozen-lockfile
yarn build
systemctl restart originfacts-com.service
```

## Environment variables
Runtime configuration lives in `.env.local` on the VM. Important keys include:

- `NEXT_PUBLIC_STRAPI_URL`
- `NEXT_PUBLIC_TP_MARKER`
- `NEXT_PUBLIC_TP_WL_HOST`
- `TRAVELPAYOUTS_API_TOKEN`
- `NEXT_PUBLIC_STAY22_AID`
- `RESEND_API_KEY`
- `CONTACT_FROM_EMAIL`
- `CONTACT_TO_EMAIL`
- `SERPAPI_API_KEY`
- `NEXT_PUBLIC_ADSENSE_CLIENT`
- `RAPIDAPI_AIRPORT_INFO_KEY`

## Customising the look
- Colours: `tailwind.config.ts` (`forest`, `sand`, `forest`, `paper`, `ink`)
- Fonts: `app/layout.tsx` — swap Fraunces / Geist for any other pair you like
- Home hero copy: `app/page.tsx`\n
## Deployment

Hosted on **Vercel**, built from `main` on push. Repository:
`xmpcross/strapi-originfacts`.

Server-rendered Next.js: it reads Strapi at request time and uses `next/image`
with remote patterns, so it needs a Next.js runtime rather than a static host.

### Environment variables

Set in the Vercel project, not committed:

```text
NEXT_PUBLIC_STRAPI_URL           CMS read at request time
STRAPI_API_TOKEN                 optional; public reads work without it
NEXT_PUBLIC_SITE_URL             canonicals, sitemap, RSS, OpenGraph
NEXT_PUBLIC_GA_MEASUREMENT_ID    analytics
```

### Notes specific to this site

- Four loaders read from disk while serving: `content/airline-reviews`,
  `content/legal`, `content/pages` and `data/route-facts/all.json`. The paths are
  built with `join(process.cwd(), …)`, which Next's tracer cannot follow, so
  `outputFileTracingIncludes` in `next.config.mjs` bundles them explicitly.
  Without it the build stays green and the pages render empty.
- `scripts` is a symlink to `/opt/scripts/originfacts` on the origin server and
  is **not tracked**. Committing it broke the Vercel build with
  `ENOENT … stat '/vercel/path0/scripts'`, because an absolute symlink dangles
  anywhere else.
- Five API routes (`contact`, `flight-deals`, `nearest-airport`, `nearest-city`,
  `category-articles`) run as serverless functions.

### The CMS is a runtime dependency

Content is fetched per request and per revalidation, so **the site has no
content if Strapi is unreachable**. That server is a separate machine from the
one Vercel runs on, and a DNS failure on the CMS host is enough to empty the
site — which is exactly what happened in August 2026.
