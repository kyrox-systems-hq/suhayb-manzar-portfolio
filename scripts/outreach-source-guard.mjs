import { readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
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

async function digest(file) {
  const content = await readFile(file);
  return createHash('sha256').update(content).digest('hex');
}

function parseWeek(argv) {
  const raw = argv.find((value) => value.startsWith('--week='))?.slice(7);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw ?? '')) fail('Provide --week=YYYY-MM-DD using the Monday campaign start date.');
  const date = new Date(`${raw}T12:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.getUTCDay() !== 1) fail(`Campaign week must be a Monday. Received ${raw}.`);
  return raw;
}

function validIso(value) {
  return typeof value === 'string' && Number.isFinite(new Date(value).valueOf());
}

function ageHours(value) {
  if (!validIso(value)) return Infinity;
  return Math.max(0, (Date.now() - new Date(value).valueOf()) / 3600000);
}

const week = parseWeek(process.argv.slice(2));
const config = await readJson(path.join(cwd, 'outreach', 'config.json'));
const dir = path.join(cwd, 'outreach', 'campaigns', week);
const discoveryFile = path.join(dir, '01-discovered.json');
const liveCheckedFile = path.join(dir, '01-live-checked.json');
const outputFile = path.join(dir, 'source-preflight.json');

if (!(await exists(discoveryFile))) fail('01-discovered.json is missing. Run outreach:discover first.');
if (!(await exists(liveCheckedFile))) fail('01-live-checked.json is missing. Run outreach:live-check after discovery.');

const discovery = await readJson(discoveryFile);
const liveChecked = await readJson(liveCheckedFile);
const issues = [];
const testMode = process.env.OUTREACH_TEST_MODE === '1';

if (!discovery.retrieval_run_id) issues.push('discovery retrieval_run_id missing');
if (!validIso(discovery.generated_at)) issues.push('discovery generated_at missing or invalid');
if ((discovery.prospects ?? []).length < config.campaign.qualified_target) issues.push('discovery has fewer than the required 25 prospects');
if (liveChecked.discovery_retrieval_run_id !== discovery.retrieval_run_id) issues.push('live-domain check does not belong to the current discovery retrieval run');
if (!validIso(liveChecked.generated_at)) issues.push('live-domain generated_at missing or invalid');
if (validIso(discovery.generated_at) && validIso(liveChecked.generated_at) && new Date(liveChecked.generated_at) < new Date(discovery.generated_at)) {
  issues.push('live-domain check predates discovery');
}
if ((liveChecked.qualification_candidates ?? []).length < config.campaign.qualified_target) issues.push('live-domain check leaves fewer than 25 qualification candidates');

const requireLiveApi = config.builtwith.require_live_api_for_production === true;
if (requireLiveApi && !testMode) {
  if (discovery.production_eligible !== true) issues.push('production discovery must come from a fresh authenticated BuiltWith Lists API pull');
  if (discovery.source_provenance?.type !== 'BuiltWith Lists API' || discovery.source_provenance?.live_api !== true) {
    issues.push('BuiltWith live API provenance missing');
  }
}

const pullMaxAge = Number(config.builtwith.source_pull_max_age_hours_for_qualification ?? 48);
if (!testMode && ageHours(discovery.generated_at) > pullMaxAge) {
  issues.push(`BuiltWith discovery pull is older than ${pullMaxAge} hours; run discovery again before qualification/preflight`);
}

if (discovery.source_provenance?.live_api === true) {
  const pages = discovery.source_provenance.api_pages ?? [];
  if (pages.length === 0) issues.push('BuiltWith live API provenance has no response-page records');
  for (const [index, page] of pages.entries()) {
    if (!validIso(page.fetched_at)) issues.push(`BuiltWith API page ${index + 1}: fetched_at missing or invalid`);
    if (page.response_freshness_gate_passed !== true) issues.push(`BuiltWith API page ${index + 1}: response freshness gate was not recorded as passed`);
    if (!page.payload_sha256 || !/^[a-f0-9]{64}$/.test(page.payload_sha256)) issues.push(`BuiltWith API page ${index + 1}: payload SHA-256 missing or invalid`);
    if (page.no_cache_requested !== true) issues.push(`BuiltWith API page ${index + 1}: no-cache request was not recorded`);
  }
}

const maxLdAge = Number(config.builtwith.freshness?.max_last_detected_age_days ?? 30);
for (const prospect of discovery.prospects ?? []) {
  if (!validIso(prospect.last_detected_at)) {
    issues.push(`${prospect.domain ?? 'discovered prospect'}: last_detected_at missing or invalid`);
    continue;
  }
  const ldAgeDays = ageHours(prospect.last_detected_at) / 24;
  if (ldAgeDays > maxLdAge) issues.push(`${prospect.domain}: last_detected_at is older than ${maxLdAge} days`);
  if (!['preferred', 'fallback'].includes(prospect.builtwith_freshness_tier)) issues.push(`${prospect.domain}: freshness tier missing or invalid`);
}

if (issues.length) {
  console.error(`Source preflight failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

const report = {
  schema_version: 1,
  campaign_week: week,
  generated_at: new Date().toISOString(),
  passed: true,
  test_mode: testMode,
  production_source_eligible: discovery.production_eligible === true,
  discovery_retrieval_run_id: discovery.retrieval_run_id,
  discovery_generated_at: discovery.generated_at,
  source_type: discovery.source_provenance?.type ?? discovery.source,
  freshness_policy: discovery.freshness_policy ?? config.builtwith.freshness,
  hashes: {
    discovery: await digest(discoveryFile),
    liveChecked: await digest(liveCheckedFile)
  }
};
await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log('Source freshness preflight passed.');
