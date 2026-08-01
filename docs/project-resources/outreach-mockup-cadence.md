# Outreach Mock-up Operating Cadence

## Purpose

This is the mandatory workflow for future cold-outreach website mock-ups. It exists to keep each mock-up fast, focused and deployable without repeating the Euphoria failure.

## Core rule

The assistant researches, decides, designs and builds the mock-up. Codex is not asked to research, interpret the brief or redesign the page. Codex is used only when a local authenticated environment is needed for Firebase deployment or a narrowly defined technical fix.

## Ownership

### Assistant owns

- Reading the prospect's post and current website.
- Researching the business, customer journey, positioning and relevant UX issues.
- Deciding the page strategy, hierarchy, copy, imagery and responsive behaviour.
- Building the actual HTML/CSS mock-up.
- Using genuine site assets and verifying claims.
- Testing desktop and mobile layouts.
- Committing the working source directly to the portfolio repository.
- Writing the outreach email after the live links are verified.

### Codex owns only

- Pulling the latest approved commit.
- Running the existing project locally when needed.
- Making only explicitly listed technical fixes.
- Running the authenticated Firebase deployment command.
- Opening and verifying the final live routes.

Codex must not research the prospect, choose the layout, rewrite copy, replace imagery, reinterpret the design or create a new design system.

## Standard sequence

### 1. Research the opportunity

Read:

- the prospect's post;
- the current website;
- the key product or service pages;
- the navigation, trust signals and mobile experience;
- any relevant business details needed for the pitch.

Output a short internal diagnosis:

- what is commercially weak;
- what is already strong and should be preserved;
- what the mock-up must demonstrate;
- what should not be attempted in a quick concept.

Do not hand this research stage to Codex.

### 2. Lock the mock-up scope

Choose one high-value surface only, normally:

- homepage;
- product-page opening;
- mobile conversion flow;
- another single page directly related to the prospect's stated problem.

A quick outreach mock-up is not a full production redesign, SEO audit or complete site architecture exercise.

Before building, lock:

- page purpose;
- section order;
- hero strategy;
- copy direction;
- real assets to use;
- primary desktop and mobile behaviour.

### 3. Build the mock-up directly

Build the working source directly inside:

`public/mockups/<client-slug>/`

Default structure:

```text
public/mockups/<client-slug>/
├── index.html
├── styles.css
└── assets/
```

Use one responsive source by default.

Separate desktop and mobile links are created only when useful for presentation. They must point to the same approved responsive source or use thin wrappers. They must never become separate independently designed versions.

### 4. Asset rules

Use, in order of preference:

1. assets already served by the prospect's own website or CDN;
2. genuine local assets downloaded from that site;
3. restrained typographic or CSS treatments when suitable media does not exist.

Never use:

- generated product or business imagery;
- invented logos;
- stock media presented as the prospect's business;
- fabricated reviews, prices, claims or customer numbers.

Commit assets directly as normal files.

## Absolute prohibition: no archive handoff

Do not use ZIP files, base64 chunks, reconstruction scripts, checksums or attachment-based source handoffs for mock-ups.

The actual HTML, CSS and assets must be committed directly to the repository.

If a binary file cannot be transferred reliably through the current tool, use a normal authenticated Git environment or let Codex download that individual genuine asset from its verified source URL. Do not invent an archive workaround.

### 5. Visual verification before deployment

Verify the actual working page, not screenshots alone.

Minimum checks:

- mobile viewport around 390 × 844;
- desktop viewport around 1440 × 1000;
- no horizontal overflow;
- no broken images;
- correct logo;
- readable typography;
- clear first-screen hierarchy;
- sections retain the intended visual rhythm;
- no accidental generic-template appearance.

The assistant must inspect the result before asking Codex to deploy it.

### 6. Commit the approved source

Commit the working source directly to:

`kyrox-systems-hq/suhayb-manzar-portfolio`

Only modify:

- the specific mock-up folder;
- `firebase.json` when a narrowly required CSP/header change is necessary.

Never touch:

- Drasteon;
- `kyrox-systems-hq/nextcrm-agent-platform`;
- Vercel;
- unrelated portfolio pages;
- unrelated mock-ups.

### 7. Deploy

Preferred path:

```bash
npx firebase-tools deploy --only hosting --project suhayb-manzar-portfolio
```

If the assistant environment is already authenticated, deploy directly.

If Firebase authentication is unavailable, give Codex a short deployment-only instruction containing:

- repository;
- exact approved commit;
- exact route;
- exact Firebase project;
- explicit prohibition on redesign or unrelated changes;
- the deployment command;
- the required live verification.

Codex should not receive a long design brief after the design is already built.

### 8. Live verification

After deployment, open the live route and check:

- correct version is live;
- mobile and desktop both render correctly;
- assets load;
- no CSP or console errors;
- no fallback to the portfolio homepage;
- no stale cached version.

Do not write the outreach email until this is confirmed.

### 9. Outreach email

The email should:

- reference the prospect's actual post or stated concern;
- identify one or two specific commercial weaknesses;
- link to the live mock-up;
- explain that it demonstrates the direction and quality of thinking, not a final production design;
- pitch a proper research-led redesign of the relevant website or page;
- use a simple reply-based CTA.

Research the best current contact email and subject line before drafting.

## Approval and change control

Once the user approves a mock-up visually, that commit becomes the locked visual base.

Further changes must be treated as targeted patches unless the user explicitly asks for a full rebuild.

Before any major structural revision:

1. preserve the approved commit;
2. list exactly what is changing;
3. change only those areas;
4. compare the new result against the approved version;
5. reject the revision if it loses the original quality, rhythm or identity.

## Recovery rule

If a revision is worse:

- immediately restore the last approved commit;
- do not continue layering fixes on top of the rejected version;
- rebuild only the requested improvement from the approved base;
- do not send another implementation prompt until the revised result has been visually checked.

## Fast default cadence

1. Research prospect and site.
2. Decide one-page strategy.
3. Build responsive HTML/CSS directly in the portfolio repository.
4. Verify mobile and desktop.
5. Commit approved source.
6. Deploy directly, or use Codex only for Firebase deployment.
7. Verify live link.
8. Draft researched cold email.

This is the default workflow for every future outreach mock-up unless the user explicitly changes it.