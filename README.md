# Suhayb Manzar portfolio

A zero-dependency static portfolio for Suhayb Manzar’s freelance web-development work.

## Project contents

- Responsive portfolio homepage
- Daily Crossword Unlimited case study
- Drasteon case study
- Mailto-based enquiry flow with no data collection or backend
- Open Graph, Twitter Card, canonical and structured metadata
- Sitemap, robots file and branded 404 page
- Cloudflare Workers static-asset redirects, security headers and cache rules
- Lead tracker template, outreach playbook, proposal template and discovery checklist
- Local and post-deployment verification script

## Local preview

```bash
python -m http.server 4173 --directory public
```

Open `http://localhost:4173`.

## Verification

```bash
npm run verify
```

After deployment:

```bash
node scripts/verify-site.mjs --base=https://suhayb-manzar-portfolio.suhayb-manzar1.workers.dev
```

## Cloudflare Workers deployment

The site is deployed as a Git-connected Cloudflare Worker with static assets:

- Production branch: `main`
- Deploy command: `npx wrangler deploy`
- Static asset directory: `public`
- Root directory: repository root
- Functions, databases and environment variables: none

Cloudflare documents static-asset hosting, Git integration, custom domains and billing:

- [Static assets](https://developers.cloudflare.com/workers/static-assets/)
- [Git integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/)
- [Custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Static-asset billing and limits](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)

## Sales resources

The files under `sales/` are templates. Keep any populated lead tracker, prospect details, private proposals, and client information outside this public repository.
