import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const cwd = process.cwd();

function parseArgs(argv) {
  const [command = 'status', ...rest] = argv;
  const args = {};
  for (const item of rest) {
    if (!item.startsWith('--')) continue;
    const [key, ...valueParts] = item.slice(2).split('=');
    args[key] = valueParts.length ? valueParts.join('=') : true;
  }
  return { command, args };
}

function fail(message) {
  console.error(message);
  process.exit(1);
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

function campaignDir(week) {
  return path.join(cwd, 'outreach', 'campaigns', week);
}

function normalizeDomain(value) {
  if (!value) return '';
  let text = String(value).trim().toLowerCase();
  text = text.replace(/^https?:\/\//, '').replace(/^www\./, '');
  text = text.split('/')[0].split('?')[0].split('#')[0];
  return text.replace(/\.$/, '');
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
  const revenue = centreScore(
    record.estimated_monthly_revenue_usd,
    bw.revenue_usd_monthly.min,
    bw.revenue_usd_monthly.max
  );
  const spend = logScale(
    record.estimated_monthly_tech_spend_usd,
    bw.technology_spend_usd_monthly.min,
    Math.max(5000, bw.technology_spend_usd_monthly.min * 50)
  );
  const employees = centreScore(
    record.estimated_employees,
    bw.employees.min,
    bw.employees.max
  );
  const recency = clamp01(1 - daysSince(record.last_detected_at) / 90);
  const traffic = record.page_rank && Number(record.page_rank) > 0
    ? clamp01(1 - Math.log10(Number(record.page_rank)) / 8)
    : 0.25;
  const sku = logScale(record.sku_count, bw.sku_min, 5000);

  return Math.round(
    100 * (
      0.30 * revenue +
      0.20 * spend +
      0.15 * employees +
      0.15 * recency +
      0.10 * traffic +
      0.10 * sku
    )
  ) / 10;
}

function normalizeBuiltWithResult(raw, technology, config) {
  const meta = raw.META ?? raw.Meta ?? raw.meta ?? {};
  const domain = normalizeDomain(raw.D ?? raw.Domain ?? raw.domain);
  return {
    business_name: meta.CompanyName ?? null,
    domain,
    country: meta.Country ?? raw.Country ?? null,
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
    builtwith_meta_emails: Array.isArray(meta.Emails) ? meta.Emails : [],
    builtwith_meta_telephones: Array.isArray(meta.Telephones) ? meta.Telephones : [],
    builtwith_meta_social: Array.isArray(meta.Social) ? meta.Social : [],
    discovery_source: 'BuiltWith',
    discovery_status: 'discovered',
    initial_problem_signal: null,
    commercial_activity_note: null,
    preliminary_commercial_score: 0,
    config_snapshot: {
      revenue_range: config.builtwith.revenue_usd_monthly,
      employee_range: config.builtwith.employees
    }
  };
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
  return data.NextOffset
    ?? data.nextOffset
    ?? data.List11?.NextOffset
    ?? data.List5?.NextOffset
    ?? null;
}

async function fetchBuiltWithPage({ apiKey, technology, config, offset }) {
  const params = new URLSearchParams();
  params.set('KEY', apiKey);
  params.set('TECH', technology);
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
  if (config.builtwith.sku_min != null) {
    params.append('SKU', `${config.builtwith.sku_min}|GTE`);
  }
  if (offset) params.set('OFFSET', offset);

  const url = `https://api.builtwith.com/lists12/api.json?${params.toString()}`;
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`BuiltWith request failed for ${technology}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function discoverFromApi(config) {
  const apiKey = process.env.BUILTWITH_API_KEY;
  if (!apiKey) {
    fail('BUILTWITH_API_KEY is not set. Supply --input=<BuiltWith JSON export> or set the environment variable.');
  }

  const output = [];
  for (const technology of config.builtwith.technologies) {
    let offset = null;
    for (let page = 0; page < config.builtwith.max_pages_per_technology; page += 1) {
      const data = await fetchBuiltWithPage({ apiKey, technology, config, offset });
      const records = getBuiltWithResults(data);
      for (const raw of records) output.push(normalizeBuiltWithResult(raw, technology, config));

      const next = getNextOffset(data);
      if (!next || next === 'END') break;
      offset = next;

      if (output.length >= config.campaign.discovery_pool_target * 4) break;
    }
  }
  return output;
}

async function discoverFromInput(input, config) {
  const data = await readJson(path.resolve(input));
  const chunks = [];

  if (Array.isArray(data.sources)) {
    for (const source of data.sources) {
      const tech = source.technology ?? 'BuiltWith export';
      for (const raw of getBuiltWithResults(source.data ?? source)) {
        chunks.push(normalizeBuiltWithResult(raw, tech, config));
      }
    }
    return chunks;
  }

  const technology = data.technology ?? 'BuiltWith export';
  return getBuiltWithResults(data).map((raw) => normalizeBuiltWithResult(raw, technology, config));
}

function buildExclusions(ledger) {
  const domains = new Set();
  const names = new Set();
  const emails = new Set();
  for (const entry of ledger.entries ?? []) {
    if (entry.domain) domains.add(normalizeDomain(entry.domain));
    if (entry.business_name) names.add(String(entry.business_name).trim().toLowerCase());
    if (entry.contact_email) emails.add(String(entry.contact_email).trim().toLowerCase());
  }
  return { domains, names, emails };
}

function dedupeAndExclude(records, ledger, config) {
  const exclusions = buildExclusions(ledger);
  const seen = new Set();
  const accepted = [];

  for (const record of records) {
    const domain = normalizeDomain(record.domain);
    if (!domain || seen.has(domain) || exclusions.domains.has(domain)) continue;

    const name = record.business_name?.trim().toLowerCase();
    if (name && exclusions.names.has(name)) continue;

    seen.add(domain);
    record.domain = domain;
    record.preliminary_commercial_score = preliminaryScore(record, config);
    accepted.push(record);
  }

  accepted.sort((a, b) => {
    const score = b.preliminary_commercial_score - a.preliminary_commercial_score;
    if (score) return score;
    return String(b.last_detected_at ?? '').localeCompare(String(a.last_detected_at ?? ''));
  });

  return accepted.slice(0, config.campaign.discovery_pool_target);
}

function addBusinessDays(dateIso, days) {
  const date = new Date(`${dateIso}T12:00:00Z`);
  let remaining = days;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const dow = date.getUTCDay();
    if (dow !== 0 && dow !== 6) remaining -= 1;
  }
  return date.toISOString().slice(0, 10);
}

function addBusinessDaysWithHolidays(dateIso, days, holidays = []) {
  const holidaySet = new Set(holidays);
  const date = new Date(`${dateIso}T12:00:00Z`);
  let remaining = days;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const dow = date.getUTCDay();
    const iso = date.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !holidaySet.has(iso)) remaining -= 1;
  }
  return date.toISOString().slice(0, 10);
}

function minuteWindow(start, end) {
  const toMin = (value) => {
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
  };
  return [toMin(start), toMin(end)];
}

function hhmm(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function stableHash(text) {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function sendTimeFor(record, index, config) {
  const [start, end] = minuteWindow(
    config.sequence.initial_send_window_local.start,
    config.sequence.initial_send_window_local.end
  );
  const span = Math.max(1, end - start);
  const seed = stableHash(`${record.domain}|${record.recipient_email}|${index}`);
  return hhmm(start + (seed % (span + 1)));
}

function wordCount(text) {
  return String(text ?? '').trim().split(/\s+/).filter(Boolean).length;
}

function sequenceQualityIssues(sequence, config) {
  const issues = [];
  if (!Array.isArray(sequence.touches) || sequence.touches.length !== config.sequence.touches) {
    issues.push(`must contain exactly ${config.sequence.touches} touches`);
    return issues;
  }

  const forbidden = [
    /\bjust following up\b/i,
    /\bbumping this\b/i,
    /\bany thoughts\??\b/i,
    /\bi never heard back\b/i,
    /\bchecking in\b/i
  ];

  for (const touch of sequence.touches) {
    const body = touch.body_text ?? '';
    const words = wordCount(body);
    const limit = touch.touch_number === 1
      ? config.sequence.initial_max_words
      : config.sequence.followup_max_words;

    if (!body.trim()) issues.push(`touch ${touch.touch_number}: empty body`);
    if (words > limit) issues.push(`touch ${touch.touch_number}: ${words} words exceeds ${limit}`);
    if (/[\u2013\u2014]/.test(body)) issues.push(`touch ${touch.touch_number}: contains en/em dash`);
    if (forbidden.some((pattern) => pattern.test(body))) {
      issues.push(`touch ${touch.touch_number}: contains a forbidden low-value follow-up phrase`);
    }
    if (touch.touch_number === 1 && !touch.subject) issues.push('touch 1: subject is required');
  }

  const joined = sequence.touches.map((touch) => touch.body_text ?? '').join('\n').toLowerCase();
  if (!joined.includes(String(sequence.live_mockup_url ?? '').toLowerCase())) {
    issues.push('sequence does not include the live mock-up URL');
  }
  return issues;
}

async function initCampaign(week, config) {
  const dir = campaignDir(week);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, 'campaign.json');
  if (await exists(file)) {
    console.log(`Campaign already exists: ${path.relative(cwd, file)}`);
    return;
  }
  await writeJson(file, {
    schema_version: 1,
    campaign_week: week,
    created_at: new Date().toISOString(),
    qualified_target: config.campaign.qualified_target,
    new_prospects_per_business_day: config.campaign.new_prospects_per_business_day,
    status: 'initialized'
  });
  console.log(`Initialized ${path.relative(cwd, dir)}`);
}

async function discover(week, input, config) {
  await initCampaign(week, config);
  const ledgerPath = path.join(cwd, 'public', 'mockups', '_outreach-ledger.json');
  const ledger = await readJson(ledgerPath);
  const raw = input
    ? await discoverFromInput(input, config)
    : await discoverFromApi(config);
  const selected = dedupeAndExclude(raw, ledger, config);
  const file = path.join(campaignDir(week), '01-discovered.json');
  await writeJson(file, {
    schema_version: 1,
    campaign_week: week,
    generated_at: new Date().toISOString(),
    source: input ? 'BuiltWith export' : 'BuiltWith Lists API',
    requested_pool: config.campaign.discovery_pool_target,
    count: selected.length,
    prospects: selected
  });
  console.log(`Wrote ${selected.length} discovered prospects to ${path.relative(cwd, file)}`);
}

async function status(week) {
  const dir = campaignDir(week);
  const files = [
    'campaign.json',
    '01-discovered.json',
    '02-qualified.json',
    '03-dossiers.json',
    '04-mockups.json',
    '05-email-standard.md',
    '06-sequences.json',
    '07-send-manifest.json'
  ];

  for (const file of files) {
    const full = path.join(dir, file);
    if (!(await exists(full))) {
      console.log(`MISSING ${file}`);
      continue;
    }
    if (file.endsWith('.json')) {
      const data = await readJson(full);
      const count = data.count
        ?? data.prospects?.length
        ?? data.dossiers?.length
        ?? data.mockups?.length
        ?? data.sequences?.length
        ?? data.messages?.length
        ?? '';
      console.log(`READY   ${file}${count !== '' ? ` (${count})` : ''}`);
    } else {
      console.log(`READY   ${file}`);
    }
  }
}

async function validate(week, config) {
  const dir = campaignDir(week);
  const issues = [];

  const qualifiedFile = path.join(dir, '02-qualified.json');
  if (await exists(qualifiedFile)) {
    const data = await readJson(qualifiedFile);
    const prospects = data.prospects ?? [];
    if (prospects.length !== config.campaign.qualified_target) {
      issues.push(`02-qualified.json has ${prospects.length} prospects, expected ${config.campaign.qualified_target}`);
    }
    for (const [i, p] of prospects.entries()) {
      const label = p.domain || p.business_name || `prospect ${i + 1}`;
      if (!p.contact_email && !p.recipient_email) issues.push(`${label}: verified contact email missing`);
      if (!p.email_source_url) issues.push(`${label}: email_source_url missing`);
      if (!p.primary_website_problem) issues.push(`${label}: primary_website_problem missing`);
      if (!p.compliance_status) issues.push(`${label}: compliance_status missing`);
      if (!p.compliance_basis) issues.push(`${label}: compliance_basis missing`);
      if (p.compliance_status !== 'eligible') issues.push(`${label}: compliance_status is not eligible`);
    }
  } else {
    issues.push('02-qualified.json is missing');
  }

  const mockupsFile = path.join(dir, '04-mockups.json');
  if (await exists(mockupsFile)) {
    const data = await readJson(mockupsFile);
    for (const mockup of data.mockups ?? []) {
      const label = mockup.domain || mockup.business_name;
      if (!mockup.live_url) issues.push(`${label}: live mock-up URL missing`);
      if (mockup.deployment_verified !== true) issues.push(`${label}: deployment not verified`);
      if (mockup.desktop_verified !== true) issues.push(`${label}: desktop not verified`);
      if (mockup.mobile_verified !== true) issues.push(`${label}: mobile not verified`);
      if (mockup.factual_accuracy_verified !== true) issues.push(`${label}: factual accuracy not verified`);
    }
  }

  const sequenceFile = path.join(dir, '06-sequences.json');
  if (await exists(sequenceFile)) {
    const data = await readJson(sequenceFile);
    const sequences = data.sequences ?? [];
    if (sequences.length !== config.campaign.qualified_target) {
      issues.push(`06-sequences.json has ${sequences.length} sequences, expected ${config.campaign.qualified_target}`);
    }
    for (const sequence of sequences) {
      const label = sequence.domain || sequence.business_name;
      for (const issue of sequenceQualityIssues(sequence, config)) {
        issues.push(`${label}: ${issue}`);
      }
    }
  }

  if (issues.length) {
    console.error(`Validation failed with ${issues.length} issue(s):`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
    return;
  }

  console.log('Campaign validation passed.');
}

async function schedule(week, config) {
  const file = path.join(campaignDir(week), '06-sequences.json');
  if (!(await exists(file))) fail('06-sequences.json is missing.');
  const data = await readJson(file);
  const sequences = data.sequences ?? [];
  if (sequences.length !== config.campaign.qualified_target) {
    fail(`Expected ${config.campaign.qualified_target} sequences, found ${sequences.length}.`);
  }

  const messages = [];
  for (const [index, sequence] of sequences.entries()) {
    const initialDayOffset = Math.floor(index / config.campaign.new_prospects_per_business_day);
    const initialDate = addBusinessDays(week, initialDayOffset);
    const localTime = sendTimeFor(sequence, index, config);
    const holidays = sequence.non_working_dates ?? [];

    for (const touch of sequence.touches) {
      const followupOffset = (touch.touch_number - 1) * config.sequence.business_day_gap;
      const localDate = addBusinessDaysWithHolidays(initialDate, followupOffset, holidays);
      messages.push({
        campaign_week: week,
        business_name: sequence.business_name,
        domain: sequence.domain,
        recipient_name: sequence.recipient_name,
        recipient_email: sequence.recipient_email,
        recipient_timezone: sequence.recipient_timezone,
        country: sequence.country,
        touch_number: touch.touch_number,
        subject: touch.subject ?? null,
        body_text: touch.body_text,
        purpose: touch.purpose,
        scheduled_local_date: localDate,
        scheduled_local_time: localTime,
        thread_mode: config.sequence.thread_mode,
        stop_on: config.sequence.stop_on,
        compliance_status: sequence.compliance_status,
        compliance_basis: sequence.compliance_basis,
        live_mockup_url: sequence.live_mockup_url,
        send_status: 'planned'
      });
    }
  }

  const out = path.join(campaignDir(week), '07-send-manifest.json');
  await writeJson(out, {
    schema_version: 1,
    campaign_week: week,
    generated_at: new Date().toISOString(),
    provider_status: 'not_loaded',
    sender_mailbox: null,
    reply_aware_provider_required: true,
    message_count: messages.length,
    prospects: sequences.length,
    messages
  });

  console.log(`Wrote ${messages.length} planned messages for ${sequences.length} prospects to ${path.relative(cwd, out)}`);
}

async function ledgerSync(week) {
  const qualifiedFile = path.join(campaignDir(week), '02-qualified.json');
  if (!(await exists(qualifiedFile))) fail('02-qualified.json is missing.');
  const qualified = await readJson(qualifiedFile);

  const ledgerFile = path.join(cwd, 'public', 'mockups', '_outreach-ledger.json');
  const ledger = await readJson(ledgerFile);
  const existingDomains = new Set((ledger.entries ?? []).map((entry) => normalizeDomain(entry.domain)).filter(Boolean));
  let added = 0;

  for (const prospect of qualified.prospects ?? []) {
    const domain = normalizeDomain(prospect.domain);
    if (!domain || existingDomains.has(domain)) continue;

    ledger.entries.push({
      business_name: prospect.business_name ?? domain,
      domain,
      owner_or_contact: prospect.recipient_name
        ? `${prospect.recipient_name}${prospect.recipient_role ? `, ${prospect.recipient_role}` : ''}`
        : null,
      contact_email: prospect.contact_email ?? prospect.recipient_email ?? null,
      email_source_url: prospect.email_source_url ?? null,
      source_post_url: null,
      source_platform: 'BuiltWith-led discovery',
      first_researched_at: new Date().toISOString().slice(0, 10),
      status: 'qualified',
      rejection_reason: null,
      mockup_slug: prospect.mockup_slug ?? null,
      notes: `Qualified for weekly campaign ${week}. Commercially filtered first, then website, contact and compliance gates passed.`
    });
    existingDomains.add(domain);
    added += 1;
  }

  ledger.updated_at = new Date().toISOString();
  await writeJson(ledgerFile, ledger);
  console.log(`Added ${added} qualified prospects to the permanent outreach ledger.`);
}

const { command, args } = parseArgs(process.argv.slice(2));
const configPath = path.join(cwd, 'outreach', 'config.json');
if (!(await exists(configPath))) fail('outreach/config.json is missing.');
const config = await readJson(configPath);

const week = mondayIso(args.week);

switch (command) {
  case 'init':
    await initCampaign(week, config);
    break;
  case 'discover':
    await discover(week, args.input, config);
    break;
  case 'status':
    await status(week);
    break;
  case 'validate':
    await validate(week, config);
    break;
  case 'schedule':
    await schedule(week, config);
    break;
  case 'ledger-sync':
    await ledgerSync(week);
    break;
  default:
    fail(`Unknown command: ${command}`);
}
