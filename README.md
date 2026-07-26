# Suhayb Manzar portfolio

A zero-dependency static portfolio for Suhayb Manzar’s freelance web-development work.

## Project contents

- Responsive portfolio homepage
- Daily Crossword Unlimited case study
- Drasteon case study
- Direct WhatsApp and email enquiry routes with no data collection or backend
- Open Graph, Twitter Card, canonical and structured metadata
- Sitemap, robots file and branded 404 page
- Firebase Hosting redirects, security headers and cache rules
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
node scripts/verify-site.mjs --base=https://suhayb-manzar-portfolio.web.app
```

## Firebase Hosting deployment

The production site is deployed to a dedicated Firebase Hosting project:

- Firebase project: `suhayb-manzar-portfolio`
- Production branch: `main`
- Deploy command: `firebase deploy --only hosting`
- Hosting directory: `public`
- Root directory: repository root
- Functions, databases and environment variables: none

The production deployment is currently run directly from the repository checkout. GitHub Actions can be connected later when Actions are available on the repository owner’s account.

Firebase documents no-cost static hosting, GitHub integration and custom domains:

- [Hosting quickstart](https://firebase.google.com/docs/hosting/quickstart)
- [Usage and quotas](https://firebase.google.com/docs/hosting/usage-quotas-pricing)
- [GitHub integration](https://firebase.google.com/docs/hosting/github-integration)
- [Custom domains](https://firebase.google.com/docs/hosting/custom-domain)

## Sales resources

The files under `sales/` are templates. Keep any populated lead tracker, prospect details, private proposals, and client information outside this public repository.
