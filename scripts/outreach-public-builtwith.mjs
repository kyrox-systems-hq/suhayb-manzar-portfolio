import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';

const cwd = process.cwd();

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (!item.startsWith('--')) continue;
    const [key, ...parts] = item.slice(2).split('=');
    args[key] = parts.length ? parts.join('=') : true;
  }
  return args;
}

function mondayIso(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) fail('Provide --week=YYYY-MM-DD using the Monday campaign start date.');
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.getUTCDay() !== 1) fail(`Campaign week must be a Monday. Received ${value}.`);
  return value;
}

function normalizeDomain(value) {
  if (!value) return '';
  return String(value).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split('?')[0].split('#')[0].replace(/\.$/, '');
}

function normalizeCountry(value) {
  const raw = String(value ?? '').trim().toUpperCase();
  if (raw === 'GB') return 'UK';
  if (raw === 'USA') return 'US';
  if (raw === 'CAN') return 'CA';
  return raw;
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function validIso(value) {
  return typeof value === 'string' && Number.isFinite(new Date(value).valueOf());
}

function validBuiltWithPublicUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['trends.builtwith.com', 'builtwith.com'].includes(url.hostname);
  } catch { return false; }
}

function ageHours(value) {
  if (!validIso(value)) return Infinity;
  return Math.max(0, (Date.now() - new Date(value).valueOf()) / 3600000);
}

function inRange(value, range, { allowUnknown = false } = {}) {
  if (value == null || value === '') return allowUnknown;
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  if (range?.min != null && n < range.min) return false;
  if (range?.max != null && n > range.max) return false;
  return true;
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function buildExclusions(ledger) {
  const domains = new Set();
  const names = new Set();
  const emails = new Set();
  for (const entry of ledger.entries ?? []) {
    if (entry.domain) domains.add(normalizeDomain(entry.domain));
    if (entry.business_name) names.add(String(entry.business_name).trim().toLowerCase());
    if (entry.contact_email) emails.add(normalizeEmail(entry.contact_email));
  }
  return { domains, names, emails };
}

const args = parseArgs(process.argv.slice(2));
const week = mondayIso(args.week);
if (!args.input) fail('Provide --input=/path/to/public-builtwith-discovery.json. The agent creates this file from direct current BuiltWith public pages.');

const config = await readJson(path.join(cwd, 'outreach', 'config.json'));
const ledger = await readJson(path.join(cwd, 'public', 'mockups', '_outreach-ledger.json'));
const inputPath = path.resolve(args.input);
const inputText = await readFile(inputPath, 'utf8');
const input = JSON.parse(inputText);
const pages = input.source_pages ?? [];
const raw = input.prospects ?? [];
const policy = config.builtwith.public_trends ?? {};
const maxPageAge = Number(policy.max_source_page_age_hours ?? 24);
const issues = [];

if (pages.length < Number(policy.min_distinct_source_pages ?? 4)) issues.push(`need at least ${policy.min_distinct_source_pages ?? 4} distinct current BuiltWith public source pages`);
const pageByUrl = new Map();
for (const [index, page] of pages.entries()) {
  const label = `source page ${index + 1}`;
  if (!validBuiltWithPublicUrl(page.url)) issues.push(`${label}: invalid BuiltWith public URL`);
  if (!validIso(page.fetched_at)) issues.push(`${label}: fetched_at missing or invalid`);
  else if (ageHours(page.fetched_at) > maxPageAge) issues.push(`${label}: source page fetch is older than ${maxPageAge} hours`);
  if (page.last_updated_claim !== 'Instantly') issues.push(`${label}: BuiltWith current-list 'Last Updated Instantly' claim was not recorded`);
  if (page.direct_fetch !== true) issues.push(`${label}: direct_fetch must be true`);
  if (page.url) pageByUrl.set(page.url, page);
}

if (issues.length) {
  console.error(`Public BuiltWith source validation failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

const exclusions = buildExclusions(ledger);
const seenDomains = new Set();
const seenNames = new Set();
const seenEmails = new Set();
const markets = new Set(config.campaign.markets.map(normalizeCountry));
const accepted = [];

for (const item of raw) {
  const domain = normalizeDomain(item.domain);
  const country = normalizeCountry(item.country);
  const name = String(item.business_name ?? '').trim().toLowerCase();
  const email = normalizeEmail(item.builtwith_public_email ?? '');
  const sourcePage = pageByUrl.get(item.builtwith_public_source_url);

  if (!domain || seenDomains.has(domain) || exclusions.domains.has(domain)) continue;
  if (name && (seenNames.has(name) || exclusions.names.has(name))) continue;
  if (email && (seenEmails.has(email) || exclusions.emails.has(email))) continue;
  if (!markets.has(country)) continue;
  if (!sourcePage) continue;
  if (!inRange(item.estimated_monthly_revenue_usd, config.builtwith.revenue_usd_monthly)) continue;
  if (!inRange(item.estimated_monthly_tech_spend_usd, config.builtwith.technology_spend_usd_monthly)) continue;
  if (Number(item.sku_count ?? 0) < Number(config.builtwith.sku_min ?? 0)) continue;
  if (!inRange(item.estimated_employees, config.builtwith.employees, { allowUnknown: true })) continue;

  accepted.push({
    business_name: item.business_name ?? null,
    domain,
    country,
    ecommerce_platform_signal: item.ecommerce_platform_signal ?? 'Shopify',
    estimated_monthly_revenue_usd: Number(item.estimated_monthly_revenue_usd),
    estimated_monthly_tech_spend_usd: Number(item.estimated_monthly_tech_spend_usd),
    estimated_employees: item.estimated_employees == null ? null : Number(item.estimated_employees),
    sku_count: Number(item.sku_count),
    social_followers: item.social_followers == null ? null : Number(item.social_followers),
    traffic_rank: item.traffic_rank == null ? null : Number(item.traffic_rank),
    marketing_signal: item.marketing_signal ?? null,
    builtwith_public_source_url: item.builtwith_public_source_url,
    builtwith_public_source_fetched_at: sourcePage.fetched_at,
    builtwith_public_page_current: true,
    builtwith_freshness_tier: 'public-current-list',
    discovery_source: 'BuiltWith Public Trends',
    discovery_status: 'discovered',
    initial_problem_signal: null,
    commercial_activity_note: null,
    preliminary_commercial_score: Number(item.preliminary_commercial_score ?? 0),
    builtwith_public_email: email || null
  });

  seenDomains.add(domain);
  if (name) seenNames.add(name);
  if (email) seenEmails.add(email);
}

accepted.sort((a, b) => {
  const spend = b.estimated_monthly_tech_spend_usd - a.estimated_monthly_tech_spend_usd;
  if (spend) return spend;
  return b.estimated_monthly_revenue_usd - a.estimated_monthly_revenue_usd;
});

const selected = accepted.slice(0, config.campaign.discovery_pool_target);
if (selected.length < config.campaign.qualified_target) {
  fail(`Only ${selected.length} public BuiltWith candidates passed the hard commercial filters. Gather more current public list pages before qualification.`);
}

const dir = path.join(cwd, 'outreach', 'campaigns', week);
await mkdir(dir, { recursive: true });
const output = {
  schema_version: 5,
  campaign_week: week,
  generated_at: new Date().toISOString(),
  retrieval_run_id: randomUUID(),
  source: 'BuiltWith Public Trends',
  production_eligible: true,
  requested_pool: config.campaign.discovery_pool_target,
  count: selected.length,
  source_provenance: {
    type: 'BuiltWith Public Trends',
    live_api: false,
    live_public_web: true,
    source_pages: pages,
    source_input_sha256: hash(inputText),
    current_list_claim_verified: true
  },
  freshness_policy: {
    public_source_page_max_age_hours: maxPageAge,
    direct_live_domain_check_required: true,
    final_browser_and_email_reverification_required: true
  },
  prospects: selected
};

await writeJson(path.join(dir, '01-discovered.json'), output);
console.log(`Wrote ${selected.length} commercially filtered prospects from current BuiltWith public pages. No user export or Lists API action was required.`);
