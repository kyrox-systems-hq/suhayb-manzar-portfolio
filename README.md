# Suhayb Manzar portfolio

A zero-dependency static portfolio for Suhayb Manzar’s freelance web-development work.

## Project contents

- Responsive portfolio homepage
- Daily Crossword Unlimited case study
- Drasteon case study
- Mailto-based enquiry flow with no data collection or backend
- Open Graph, Twitter Card, canonical and structured metadata
- Sitemap, robots file and branded 404 page
- Cloudflare Pages redirects, security headers and cache rules
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
node scripts/verify-site.mjs --base=https://suhayb-manzar-portfolio.pages.dev
```

## Cloudflare Pages deployment

The site is designed for a Git-connected Cloudflare Pages project:

- Production branch: `main`
- Build command: none
- Build output directory: `public`
- Root directory: repository root
- Functions, databases and environment variables: none

Cloudflare documents free static-asset requests, GitHub integration, custom domains, and the current Free-plan Pages limits:

- [Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/)
- [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Free-plan limits](https://developers.cloudflare.com/pages/platform/limits/)

## Sales resources

The files under `sales/` are templates. Keep any populated lead tracker, prospect details, private proposals, and client information outside this public repository.
