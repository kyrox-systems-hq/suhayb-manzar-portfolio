import { readFile, writeFile, mkdir, access, stat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
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

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
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

function ageDays(iso, nowMs = Date.now()) {
  if (!iso) return null;
  const timestamp = new Date(iso).valueOf();
  if (!Number.isFinite(timestamp)) return null;
  return (nowMs - timestamp) / 86400000;
}

function freshnessStatus(record, config, nowMs = Date.now()) {
  const policy = config.builtwith.freshness ?? {};
  const age = ageDays(record.last_detected_at, nowMs);
  if (age == null) {
    return {
      eligible: policy.require_last_detected !== true,
      age_days: null,
      tier: 'unknown',
      reason: 'missing_last_detected'
    };
  }

  const futureSkewHours = Math.max(0, -age * 24);
  if (futureSkewHours > Number(policy.max_future_clock_skew_hours ?? 24)) {
    return {
      eligible: false,
      age_days: Math.round(age * 100) / 100,
      tier: 'invalid',
      reason: 'last_detected_in_future'
    };
  }

  const nonNegativeAge = Math.max(0, age);
  const maxAge = Number(policy.max_last_detected_age_days ?? 30);
  if (nonNegativeAge > maxAge) {
    return {
      eligible: false,
      age_days: Math.round(nonNegativeAge * 100) / 100,
      tier: 'stale',
      reason: 'last_detected_too_old'
    };
  }

  const preferred = Number(policy.preferred_last_detected_age_days ?? 14);
  return {
    eligible: true,
    age_days: Math.round(nonNegativeAge * 100) / 100,
    tier: nonNegativeAge <= preferred ? 'preferred' : 'fallback',
    reason: null
  };
}

function preliminaryScore(record, config) {
  const bw = config.builtwith;
  const revenue = centreScore(record.estimated_monthly_revenue_usd, bw.revenue_usd_monthly.min, bw.revenue_usd_monthly.max);
  const spend = logScale(record.estimated_monthly_tech_spend_usd, bw.technology_spend_usd_monthly.min, Math.max(5000, bw.technology_spend_usd_monthly.min * 50));
  const employees = centreScore(record.estimated_employees, bw.employees.min, bw.employees.max);
  const maxFreshnessAge = Math.max(1, Number(bw.freshness?.max_last_detected_age_days ?? 30));
  const recency = clamp01(1 - Math.max(0, Number(record.builtwith_last_detected_age_days ?? maxFreshnessAge)) / maxFreshnessAge);
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
  const record = {
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
    builtwith_last_detected_age_days: null,
    builtwith_freshness_tier: null,
    config_snapshot: {
      revenue_range: config.builtwith.revenue_usd_monthly,
      employee_range: config.builtwith.employees,
      technology_spend_range: config.builtwith.technology_spend_usd_monthly,
      sku_min: config.builtwith.sku_min,
      freshness: config.builtwith.freshness
    }
  };

  const freshness = freshnessStatus(record, config);
  record.builtwith_last_detected_age_days = freshness.age_days;
  record.builtwith_freshness_tier = freshness.tier;
  record.builtwith_freshness_rejection_reason = freshness.reason;
  return record;
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
  if (!freshnessStatus(record, config).eligible) return false;
  return true;
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

    const freshness = freshnessStatus(record, config);
    record.builtwith_last_detected_age_days = freshness.age_days;
    record.builtwith_freshness_tier = freshness.tier;
    record.builtwith_freshness_rejection_reason = null;
    record.domain = domain;
    record.preliminary_commercial_score = preliminaryScore(record, config);
    accepted.push(record);

    seenDomains.add(domain);
    if (name) seenNames.add(name);
    for (const email of emails) seenEmails.add(email);
  }

  const tierOrder = { preferred: 0, fallback: 1, unknown: 2 };
  accepted.sort((a, b) => {
    const tierDifference = (tierOrder[a.builtwith_freshness_tier] ?? 9) - (tierOrder[b.builtwith_freshness_tier] ?? 9);
    if (tierDifference) return tierDifference;
    const scoreDifference = b.preliminary_commercial_score - a.preliminary_commercial_score;
    if (scoreDifference) return scoreDifference;
    return String(b.last_detected_at ?? '').localeCompare(String(a.last_detected_at ?? ''));
  });

  return accepted.slice(0, config.campaign.discovery_pool_target);
}

function validateResponseFreshness(response, config, technology) {
  const policy = config.builtwith.freshness ?? {};
  const ageHeader = response.headers.get('age');
  if (ageHeader != null && Number.isFinite(Number(ageHeader))) {
    const ageSeconds = Number(ageHeader);
    if (ageSeconds > Number(policy.max_response_age_seconds_if_reported ?? 3600)) {
      throw new Error(`BuiltWith response for ${technology} reports Age=${ageSeconds}s, exceeding the configured cache-age limit.`);
    }
  }

  const dateHeader = response.headers.get('date');
  if (dateHeader) {
    const responseDate = new Date(dateHeader).valueOf();
    if (Number.isFinite(responseDate)) {
      const ageHours = Math.max(0, (Date.now() - responseDate) / 3600000);
      if (ageHours > Number(policy.max_response_date_age_hours_if_reported ?? 2)) {
        throw new Error(`BuiltWith response for ${technology} has a Date header ${ageHours.toFixed(2)} hours old, exceeding the configured freshness limit.`);
      }
    }
  }
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

  const endpoint = 'https://api.builtwith.com/lists12/api.json';
  const fetchedAt = new Date().toISOString();
  const response = await fetch(`${endpoint}?${params.toString()}`, {
    headers: {
      accept: 'application/json',
      'cache-control': config.builtwith.freshness?.request_cache_control ?? 'no-cache',
      pragma: config.builtwith.freshness?.request_pragma ?? 'no-cache'
    }
  });
  if (!response.ok) throw new Error(`BuiltWith request failed for ${technology}: ${response.status} ${response.statusText}`);
  validateResponseFreshness(response, config, technology);

  const payload = await response.text();
  let data;
  try {
    data = JSON.parse(payload);
  } catch {
    throw new Error(`BuiltWith returned invalid JSON for ${technology}.`);
  }

  const ageHeader = response.headers.get('age');
  return {
    data,
    provenance: {
      technology,
      fetched_at: fetchedAt,
      endpoint,
      query_since: config.builtwith.since,
      offset_present: Boolean(offset),
      response_date: response.headers.get('date'),
      response_age_seconds: ageHeader != null && Number.isFinite(Number(ageHeader)) ? Number(ageHeader) : null,
      response_cache_control: response.headers.get('cache-control'),
      response_etag: response.headers.get('etag'),
      payload_sha256: sha256(payload),
      no_cache_requested: true,
      response_freshness_gate_passed: true
    }
  };
}

async function discoverFromApi(config) {
  const apiKey = process.env.BUILTWITH_API_KEY;
  if (!apiKey) fail('BUILTWITH_API_KEY is not set. Supply --input=<BuiltWith JSON export> for testing only or set the environment variable for a production pull.');

  const records = [];
  const pages = [];
  for (const technology of config.builtwith.technologies) {
    let offset = null;
    for (let page = 0; page < config.builtwith.max_pages_per_technology; page += 1) {
      const result = await fetchBuiltWithPage({ apiKey, technology, config, offset });
      pages.push(result.provenance);
      for (const raw of getBuiltWithResults(result.data)) records.push(normalizeBuiltWithResult(raw, technology, config));
      const next = getNextOffset(result.data);
      if (!next || next === 'END') break;
      offset = next;
      if (records.length >= config.campaign.discovery_pool_target * 4) break;
    }
  }
  return {
    records,
    provenance: {
      type: 'BuiltWith Lists API',
      live_api: true,
      api_pages: pages
    }
  };
}

async function discoverFromInput(inputPath, config) {
  const absolute = path.resolve(inputPath);
  const payload = await readFile(absolute, 'utf8');
  const data = JSON.parse(payload);
  const fileStat = await stat(absolute);
  const records = [];
  if (Array.isArray(data.sources)) {
    for (const source of data.sources) {
      const technology = source.technology ?? 'BuiltWith export';
      for (const raw of getBuiltWithResults(source.data ?? source)) records.push(normalizeBuiltWithResult(raw, technology, config));
    }
  } else {
    const technology = data.technology ?? 'BuiltWith export';
    for (const raw of getBuiltWithResults(data)) records.push(normalizeBuiltWithResult(raw, technology, config));
  }

  return {
    records,
    provenance: {
      type: 'BuiltWith export',
      live_api: false,
      imported_at: new Date().toISOString(),
      source_file_name: path.basename(absolute),
      source_file_modified_at: fileStat.mtime.toISOString(),
      payload_sha256: sha256(payload),
      record_level_last_detected_freshness_enforced: true
    }
  };
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
const retrievalRunId = randomUUID();

const discovery = args.input ? await discoverFromInput(args.input, config) : await discoverFromApi(config);
const selected = dedupeAndExclude(discovery.records, ledger, config);
if (selected.length < config.campaign.qualified_target) {
  fail(`Only ${selected.length} fresh, commercially filtered, non-duplicate prospects remain. At least ${config.campaign.qualified_target} are required before qualification can begin.`);
}

const outputFile = path.join(campaignDir, '01-discovered.json');
const preferredFresh = selected.filter((record) => record.builtwith_freshness_tier === 'preferred').length;
const fallbackFresh = selected.filter((record) => record.builtwith_freshness_tier === 'fallback').length;
const productionEligible = discovery.provenance.live_api === true;

await writeJson(outputFile, {
  schema_version: 4,
  campaign_week: week,
  retrieval_run_id: retrievalRunId,
  generated_at: new Date().toISOString(),
  source: discovery.provenance.type,
  production_eligible: productionEligible,
  production_ineligibility_reason: productionEligible ? null : 'production_requires_fresh_authenticated_builtwith_lists_api_pull',
  source_provenance: discovery.provenance,
  freshness_policy: config.builtwith.freshness,
  requested_pool: config.campaign.discovery_pool_target,
  count: selected.length,
  pool_health: selected.length >= config.campaign.discovery_pool_target ? 'full' : 'usable_but_thin',
  preferred_fresh_count: preferredFresh,
  fallback_fresh_count: fallbackFresh,
  prospects: selected
});

console.log(`Wrote ${selected.length} fresh, commercially filtered, non-duplicate prospects to ${path.relative(cwd, outputFile)}`);
if (!productionEligible) console.log('This discovery file is test/import mode and is not production-eligible without an authenticated live BuiltWith API pull.');
