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

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim());
}

function validIso(value) {
  return typeof value === 'string' && Number.isFinite(new Date(value).valueOf());
}

function ageHours(value) {
  if (!validIso(value)) return Infinity;
  return Math.max(0, (Date.now() - new Date(value).valueOf()) / 3600000);
}

function ageDays(value) {
  return ageHours(value) / 24;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

const args = parseArgs(process.argv.slice(2));
const week = mondayIso(args.week);
if (!args.config) fail('Provide --config=/path/to/provider-readiness.json.');

const providerFile = path.resolve(args.config);
if (!(await exists(providerFile))) fail(`Provider config not found: ${providerFile}`);
const providerText = await readFile(providerFile, 'utf8');
const provider = JSON.parse(providerText);
const campaignDir = path.join(cwd, 'outreach', 'campaigns', week);
const manifestFile = path.join(campaignDir, '07-send-manifest.json');
const discoveryFile = path.join(campaignDir, '01-discovered.json');
const qualifiedFile = path.join(campaignDir, '02-qualified.json');
const sourcePreflightFile = path.join(campaignDir, 'source-preflight.json');
const campaignPreflightFile = path.join(campaignDir, 'preflight.json');
for (const file of [manifestFile, discoveryFile, qualifiedFile, sourcePreflightFile, campaignPreflightFile]) {
  if (!(await exists(file))) fail(`${path.basename(file)} is missing. Complete campaign preflight and scheduling first.`);
}

const manifestText = await readFile(manifestFile, 'utf8');
const manifest = JSON.parse(manifestText);
const discovery = await readJson(discoveryFile);
const qualified = await readJson(qualifiedFile);
const sourcePreflight = await readJson(sourcePreflightFile);
const campaignPreflight = await readJson(campaignPreflightFile);
const config = await readJson(path.join(cwd, 'outreach', 'config.json'));
const issues = [];
const testMode = process.env.OUTREACH_TEST_MODE === '1';

if (!testMode) {
  if (manifest.production_ready_manifest !== true) issues.push('manifest is not marked production-ready');
  if (manifest.production_source_eligible !== true) issues.push('manifest was not built from a production-eligible BuiltWith source');
  if (discovery.production_eligible !== true) issues.push('current discovery file is not production-eligible');
  if (discovery.source_provenance?.type !== 'BuiltWith Lists API' || discovery.source_provenance?.live_api !== true) issues.push('current discovery file is not from the authenticated live BuiltWith Lists API');
  const maxSourceAge = Number(config.builtwith.source_pull_max_age_hours_for_qualification ?? 48);
  if (ageHours(discovery.generated_at) > maxSourceAge) issues.push(`BuiltWith discovery pull is older than ${maxSourceAge} hours at provider load time`);
}

if (sourcePreflight.passed !== true || campaignPreflight.passed !== true) issues.push('source or campaign preflight is not currently passed');
if (manifest.preflight_verified !== true || manifest.source_preflight_verified !== true) issues.push('manifest preflights are not verified');
if (manifest.idempotency_keys_verified !== true) issues.push('manifest idempotency keys are not verified');
if (manifest.message_count !== 125 || manifest.messages?.length !== 125) issues.push('manifest must contain exactly 125 messages');
if (manifest.prospects !== 25) issues.push('manifest must contain exactly 25 prospects');
if ((qualified.prospects ?? []).length !== 25) issues.push('qualified campaign must still contain exactly 25 prospects');

const liveMaxAgeHours = Number(config.qualification.live_site_check_max_age_hours ?? 24);
const emailMaxAgeHours = Number(config.qualification.contact_email_check_max_age_hours ?? 24);
for (const prospect of qualified.prospects ?? []) {
  if (ageHours(prospect.live_site_checked_at) > liveMaxAgeHours) issues.push(`${prospect.domain}: live-site verification is older than ${liveMaxAgeHours} hours at provider load time`);
  if (ageHours(prospect.contact_email_verified_at) > emailMaxAgeHours) issues.push(`${prospect.domain}: public-email verification is older than ${emailMaxAgeHours} hours at provider load time`);
}

if (!provider.provider_name || !String(provider.provider_name).trim()) issues.push('provider_name missing');
if (!validEmail(provider.sender_mailbox)) issues.push('sender_mailbox missing or invalid');
if (!provider.sender_display_name || !String(provider.sender_display_name).trim()) issues.push('sender_display_name missing');
if (!provider.physical_postal_address || String(provider.physical_postal_address).trim().length < 8) issues.push('physical_postal_address missing');
if (!provider.unsubscribe_mode || String(provider.unsubscribe_mode).trim().length < 3) issues.push('unsubscribe_mode missing');
if (!provider.credential_env_var || !/^[A-Z][A-Z0-9_]+$/.test(provider.credential_env_var)) {
  issues.push('credential_env_var missing or invalid');
} else if (!testMode && !process.env[provider.credential_env_var]) {
  issues.push(`provider credential environment variable ${provider.credential_env_var} is not set`);
}

const requiredCapabilities = [
  'per_prospect_custom_content',
  'recipient_timezone_scheduling',
  'same_thread_followups',
  'reply_detection',
  'stop_on_reply',
  'bounce_detection',
  'stop_on_bounce',
  'opt_out_detection',
  'stop_on_opt_out',
  'manual_pause',
  'idempotent_import_or_send',
  'delivery_status_export'
];
for (const capability of requiredCapabilities) {
  if (provider.capabilities?.[capability] !== true) issues.push(`provider capability not verified: ${capability}`);
}

const integration = provider.integration_test ?? {};
if (!validEmail(integration.test_recipient)) issues.push('integration test recipient missing or invalid');
if (!validIso(integration.tested_at)) issues.push('provider integration test timestamp missing or invalid');
else if (ageDays(integration.tested_at) > 30) issues.push('provider integration test is older than 30 days');
for (const check of ['initial_send_verified', 'same_thread_verified', 'reply_stop_verified', 'bounce_stop_verified', 'opt_out_stop_verified', 'sent_history_verified']) {
  if (integration[check] !== true) issues.push(`provider integration test has not verified ${check}`);
}

const messageKeys = new Set();
const sequenceTouches = new Map();
const recipientSequences = new Map();
const requiredStopEvents = ['reply', 'bounce', 'opt_out', 'manual_conversation'];
for (const message of manifest.messages ?? []) {
  if (!/^[a-f0-9]{64}$/.test(message.message_key ?? '')) issues.push(`touch ${message.touch_number} for ${message.domain}: invalid message_key`);
  if (messageKeys.has(message.message_key)) issues.push(`duplicate message_key ${message.message_key}`);
  messageKeys.add(message.message_key);
  if (!/^[a-f0-9]{64}$/.test(message.sequence_key ?? '')) issues.push(`${message.domain}: invalid sequence_key`);
  if (message.thread_mode !== 'same_thread') issues.push(`${message.domain}: provider manifest is not configured for same-thread follow-ups`);
  if (message.send_status !== 'planned') issues.push(`${message.domain} touch ${message.touch_number}: unexpected send_status ${message.send_status}`);
  for (const event of requiredStopEvents) if (!(message.stop_on ?? []).includes(event)) issues.push(`${message.domain} touch ${message.touch_number}: stop_on missing ${event}`);

  if (!sequenceTouches.has(message.sequence_key)) sequenceTouches.set(message.sequence_key, new Set());
  sequenceTouches.get(message.sequence_key).add(message.touch_number);
  if (!recipientSequences.has(message.recipient_email)) recipientSequences.set(message.recipient_email, new Set());
  recipientSequences.get(message.recipient_email).add(message.sequence_key);
}

if (messageKeys.size !== 125) issues.push(`expected 125 unique message keys, found ${messageKeys.size}`);
if (sequenceTouches.size !== 25) issues.push(`expected 25 sequence keys, found ${sequenceTouches.size}`);
for (const [sequenceKey, touches] of sequenceTouches.entries()) {
  if (touches.size !== 5 || [...touches].sort((a, b) => a - b).join(',') !== '1,2,3,4,5') issues.push(`sequence ${sequenceKey} does not contain exactly touches 1 through 5`);
}
for (const [email, sequences] of recipientSequences.entries()) if (sequences.size !== 1) issues.push(`${email}: recipient maps to multiple sequence keys`);

if (issues.length) {
  console.error(`Provider preflight failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

const outputFile = path.join(campaignDir, '08-provider-preflight.json');
const report = {
  schema_version: 2,
  campaign_week: week,
  generated_at: new Date().toISOString(),
  passed: true,
  test_mode: testMode,
  provider_name: provider.provider_name,
  sender_mailbox: provider.sender_mailbox,
  integration_tested_at: integration.tested_at,
  source_rechecked_at_provider_load: true,
  live_and_email_freshness_rechecked: true,
  messages_verified: 125,
  prospects_verified: 25,
  provider_config_sha256: sha256(providerText),
  manifest_sha256: sha256(manifestText)
};
await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log('Outbound provider preflight passed.');
