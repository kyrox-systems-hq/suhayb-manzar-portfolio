import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const cwd = process.cwd();

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
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
    const [key, ...value] = item.slice(2).split('=');
    args[key] = value.length ? value.join('=') : true;
  }
  return args;
}

function mondayIso(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) {
    fail('Provide --week=YYYY-MM-DD using the Monday campaign start date.');
  }
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.getUTCDay() !== 1) {
    fail(`Campaign week must be a Monday. Received ${value}.`);
  }
  return value;
}

function normalizeDomain(value) {
  if (!value) return '';
  let text = String(value).trim().toLowerCase();
  text = text.replace(/^https?:\/\//, '').replace(/^www\./, '');
  return text.split('/')[0].split('?')[0].split('#')[0].replace(/\.$/, '');
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeCountry(value) {
  const raw = String(value ?? '').trim().toUpperCase();
  if (raw === 'GB') return 'UK';
  if (raw === 'USA') return 'US';
  if (raw === 'CAN') return 'CA';
  return raw;
}

function epochToIso(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString();
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function logScale(value, min, max) {
  const v = Math.max(Number(value) || 0, 1);
  const lo = Math.log10(Math.max(min, 1));
  const hi = Math.log10(Math.max(max, min + 1));
  return clamp01((Math.log10(v) - lo) / (hi - lo));
}

function centreScore(value, min, max) {
  const n = Number(value) || 0;
  if (n < min || n > max) return 0;
  const mid = (min + max) / 2;
  const half = (max - min) / 2 || 1;
  return 1 - Math.abs(n - mid) / half;
}

function daysSince(iso) {
  if (!iso) return 9999;
  return Math.max(0, (Date.now() - new Date(iso).valueOf()) / 86400000);
}

function preliminaryScore(record, config) {
  const bw = config.builtwith;
  const revenue = centreScore(record.estimated_monthly_revenue_usd, bw.revenue_usd_monthly.min, bw.revenue_usd_monthly.max);
  const spend = logScale(record.estimated_monthly_tech_spend_usd, bw.technology_spend_usd_monthly.min, Math.max(5000, bw.technology_spend_usd_monthly.min * 50));
  const employees = centreScore(record.estimated_employees, bw.employees.min, bw.employees.max);
  const recency = clamp01(1 - daysSince(record.last_detected_at) / 90);
  const traffic = record.page_rank && Number(record.page_rank) > 0 ? clamp01(1 - Math.log10(Number(record.page_rank)) / 8) : 0.25;
  const sku = logScale(record.sku_count, bw.sku_min, 5000);
  return Math.round(100 * (0.30 * revenue + 0.20 * spend + 0.15 * employees + 0.15 * recency + 0.10 * traffic + 0.10 * sku)) / 10;
}

function getBuiltWithResults(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.Results)) return data.Results;
  if (Array.isArray(data.results)) return data.results;
  if (data.List11 && Array.isArray(data.List11.Results)) return data.List11.Results;
  if (data.List5 && Array.isArray(data.List5.Results)) return data.List5.Results;
  return [];
}

function getNextOffset(data) {
  return data.NextOffset ?? data.nextOffset ?? data.List11?.NextOffset ?? data.List5?.NextOffset ?? null;
}

function normalizeBuiltWithResult(raw, technology, config) {
  const meta = raw.META ?? raw.Meta ?? raw.meta ?? {};
  const country = normalizeCountry(meta.Country ?? raw.Country);
  return {
    business_name: meta.CompanyName ?? null,
    domain: normalizeDomain(raw.D ?? raw.Domain ?? raw.domain),
    country,
    ecommerce_platform_signal: technology,
    estimated_monthly_revenue_usd: Number(raw.R ?? raw.Revenue ?? raw.SalesRevenue ?? 0) || 0,
    estimated_monthly_tech_spend_usd: Number(raw.S ?? raw.Spend ?? 0) || 0,
    estimated_employees: Number(raw.E ?? raw.Employees ?? 0) || 0,
    sku_count: Number(raw.SKU ?? raw.Skus ?? 0) || 0,
    social_followers: Number(raw.F ?? raw.Followers ?? 0) || 0,
    page_rank: Number(raw.A ?? raw.PageRank ?? 0) || null,
    tranco_rank: Number(raw.Q ?? raw.Tranco ?? 0) || null,
    first_detected_at: epochToIso(raw.FD ?? raw.FirstDetected),
    last_detected_at: epochToIso(raw.LD ?? raw.LastDetected),
    city: meta.City ?? null,
    state: meta.State ?? null,
    postcode: meta.Postcode ?? null,
    vertical: meta.Vertical ?? null,
    builtwith_meta_emails: Array.isArray(meta.Emails) ? meta.Emails.map(normalizeEmail).filter(Boolean) : [],
    builtwith_meta_telephones: Array.isArray(meta.Telephones) ? meta.Telephones : [],
    builtwith_meta_social: Array.isArray(meta.Social) ? meta.Social : [],
    discovery_source: 'BuiltWith',
    discovery_status: 'discovered',
    initial_problem_signal: null,
    commercial_activity_note: null,
    preliminary_commercial_score: 0,
    config_snapshot: {
      revenue_range: config.builtwith.revenue_usd_monthly,
      employee_range: config.builtwith.employees,
      technology_spend_range: config.builtwith.technology_spend_usd_monthly,
      sku_min: config.builtwith.sku_min
    }
  };
}

function withinRange(value, range) {
  const n = Number(value) || 0;
  if (range?.min != null && n < range.min) return false;
  if (range?.max != null && n > range.max) return false;
  return true;
}

function meetsCommercialFilters(record, config) {
  const markets = new Set(config.campaign.markets.map(normalizeCountry));
  if (!markets.has(normalizeCountry(record.country))) return false;
  if (!withinRange(record.estimated_monthly_revenue_usd, config.builtwith.revenue_usd_monthly)) return false;
  if (!withinRange(record.estimated_employees, config.builtwith.employees)) return false;
  if (!withinRange(record.estimated_monthly_tech_spend_usd, config.builtwith.technology_spend_usd_monthly)) return false;
  if (config.builtwith.sku_min != null && Number(record.sku_count || 0) < config.builtwith.sku_min) return false;
  return true;
}

function buildExclusions(ledger) {
  const domains = new Set();
  const names = new Set();
  const emails = new Set();
  const sourceUrls = new Set();
  for (const entry of ledger.entries ?? []) {
    if (entry.domain) domains.add(normalizeDomain(entry.domain));
    if (entry.business_name) names.add(String(entry.business_name).trim().toLowerCase());
    if (entry.contact_email) emails.add(normalizeEmail(entry.contact_email));
    if (entry.source_post_url) sourceUrls.add(String(entry.source_post_url).trim());
  }
  return { domains, names, emails, sourceUrls };
}

function dedupeAndExclude(records, ledger, config) {
  const exclusions = buildExclusions(ledger);
  const seenDomains = new Set();
  const seenNames = new Set();
  const seenEmails = new Set();
  const accepted = [];

  for (const record of records) {
    if (!meetsCommercialFilters(record, config)) continue;

    const domain = normalizeDomain(record.domain);
    const name = String(record.business_name ?? '').trim().toLowerCase();
    const emails = (record.builtwith_meta_emails ?? []).map(normalizeEmail).filter(Boolean);

    if (!domain || seenDomains.has(domain) || exclusions.domains.has(domain)) continue;
    if (name && (seenNames.has(name) || exclusions.names.has(name))) continue;
    if (emails.some((email) => exclusions.emails.has(email) || seenEmails.has(email))) continue;

    record.domain = domain;
    record.preliminary_commercial_score = preliminaryScore(record, config);
    accepted.push(record);

    seenDomains.add(domain);
    if (name) seenNames.add(name);
    for (const email of emails) seenEmails.add(email);
  }

  accepted.sort((a, b) => {
    const scoreDifference = b.preliminary_commercial_score - a.preliminary_commercial_score;
    if (scoreDifference) return scoreDifference;
    return String(b.last_detected_at ?? '').localeCompare(String(a.last_detected_at ?? ''));
  });

  return accepted.slice(0, config.campaign.discovery_pool_target);
}

async function fetchBuiltWithPage({ apiKey, technology, config, offset }) {
  const params = new URLSearchParams();
  params.set('KEY', apiKey);
  params.set('TECH', technology.replace(/\s+/g, '-'));
  params.set('COUNTRY', config.campaign.markets.join(','));
  params.set('SINCE', config.builtwith.since);
  if (config.builtwith.include_meta) params.set('META', 'yes');

  const addRange = (key, range) => {
    if (range?.min != null) params.append(key, `${range.min}|GTE`);
    if (range?.max != null) params.append(key, `${range.max}|LTE`);
  };

  addRange('REVENUE', config.builtwith.revenue_usd_monthly);
  addRange('EMPLOYEES', config.builtwith.employees);
  addRange('SPEND', config.builtwith.technology_spend_usd_monthly);
  if (config.builtwith.sku_min != null) params.append('SKU', `${config.builtwith.sku_min}|GTE`);
  if (offset) params.set('OFFSET', offset);

  const response = await fetch(`https://api.builtwith.com/lists12/api.json?${params.toString()}`, {
    headers: { accept: 'application/json' }
  });
  if (!response.ok) throw new Error(`BuiltWith request failed for ${technology}: ${response.status} ${response.statusText}`);
  return response.json();
}

async function discoverFromApi(config) {
  const apiKey = process.env.BUILTWITH_API_KEY;
  if (!apiKey) fail('BUILTWITH_API_KEY is not set. Supply --input=<BuiltWith JSON export> or set the environment variable.');

  const output = [];
  for (const technology of config.builtwith.technologies) {
    let offset = null;
    for (let page = 0; page < config.builtwith.max_pages_per_technology; page += 1) {
      const data = await fetchBuiltWithPage({ apiKey, technology, config, offset });
      for (const raw of getBuiltWithResults(data)) output.push(normalizeBuiltWithResult(raw, technology, config));
      const next = getNextOffset(data);
      if (!next || next === 'END') break;
      offset = next;
      if (output.length >= config.campaign.discovery_pool_target * 4) break;
    }
  }
  return output;
}

async function discoverFromInput(inputPath, config) {
  const data = await readJson(path.resolve(inputPath));
  const records = [];
  if (Array.isArray(data.sources)) {
    for (const source of data.sources) {
      const technology = source.technology ?? 'BuiltWith export';
      for (const raw of getBuiltWithResults(source.data ?? source)) records.push(normalizeBuiltWithResult(raw, technology, config));
    }
    return records;
  }
  const technology = data.technology ?? 'BuiltWith export';
  return getBuiltWithResults(data).map((raw) => normalizeBuiltWithResult(raw, technology, config));
}

async function ensureCampaign(week, config) {
  const dir = path.join(cwd, 'outreach', 'campaigns', week);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, 'campaign.json');
  if (!(await exists(file))) {
    await writeJson(file, {
      schema_version: 1,
      campaign_week: week,
      created_at: new Date().toISOString(),
      qualified_target: config.campaign.qualified_target,
      new_prospects_per_business_day: config.campaign.new_prospects_per_business_day,
      status: 'initialized'
    });
  }
  return dir;
}

const args = parseArgs(process.argv.slice(2));
const week = mondayIso(args.week);
const config = await readJson(path.join(cwd, 'outreach', 'config.json'));
const ledger = await readJson(path.join(cwd, 'public', 'mockups', '_outreach-ledger.json'));
const campaignDir = await ensureCampaign(week, config);

const raw = args.input ? await discoverFromInput(args.input, config) : await discoverFromApi(config);
const selected = dedupeAndExclude(raw, ledger, config);
const outputFile = path.join(campaignDir, '01-discovered.json');

await writeJson(outputFile, {
  schema_version: 2,
  campaign_week: week,
  generated_at: new Date().toISOString(),
  source: args.input ? 'BuiltWith export' : 'BuiltWith Lists API',
  requested_pool: config.campaign.discovery_pool_target,
  count: selected.length,
  prospects: selected
});

console.log(`Wrote ${selected.length} commercially filtered, non-duplicate prospects to ${path.relative(cwd, outputFile)}`);
