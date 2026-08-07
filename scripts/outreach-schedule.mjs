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

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
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

function nextIsoDate(dateIso) {
  const date = new Date(`${dateIso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function nextRecipientWorkingDayOnOrAfter(dateIso, holidays = []) {
  const holidaySet = new Set(holidays);
  const date = new Date(`${dateIso}T12:00:00Z`);
  while (true) {
    const iso = date.toISOString().slice(0, 10);
    if (![0, 6].includes(date.getUTCDay()) && !holidaySet.has(iso)) return iso;
    date.setUTCDate(date.getUTCDate() + 1);
  }
}

function addRecipientBusinessDays(dateIso, days, holidays = []) {
  const holidaySet = new Set(holidays);
  const date = new Date(`${dateIso}T12:00:00Z`);
  let remaining = days;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const iso = date.toISOString().slice(0, 10);
    if (![0, 6].includes(date.getUTCDay()) && !holidaySet.has(iso)) remaining -= 1;
  }
  return date.toISOString().slice(0, 10);
}

function minuteWindow(start, end) {
  const convert = (value) => {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  };
  return [convert(start), convert(end)];
}

function hhmm(minutes) {
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function stableHash(text) {
  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function fallbackLocalTime(sequence, index, config) {
  const [start, end] = minuteWindow(config.sequence.initial_send_window_local.start, config.sequence.initial_send_window_local.end);
  const span = Math.max(1, end - start);
  const seed = stableHash(`${sequence.domain}|${sequence.recipient_email}|${index}`);
  return hhmm(start + (seed % (span + 1)));
}

function validTimeZone(value) {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function localTimeFor(sequence, index, config) {
  const preferred = sequence.preferred_local_send_time;
  if (preferred != null) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(preferred)) fail(`${sequence.domain}: preferred_local_send_time must use HH:MM 24-hour format.`);
    return preferred;
  }
  return fallbackLocalTime(sequence, index, config);
}

async function verifyPreflight(dir) {
  const preflightFile = path.join(dir, 'preflight.json');
  if (!(await exists(preflightFile))) fail('preflight.json is missing. Run npm run outreach:validate before scheduling.');
  const preflight = await readJson(preflightFile);
  if (preflight.passed !== true) fail('Campaign preflight has not passed.');

  const files = {
    qualified: path.join(dir, '02-qualified.json'),
    dossiers: path.join(dir, '03-dossiers.json'),
    mockups: path.join(dir, '04-mockups.json'),
    emailStandard: path.join(dir, '05-email-standard.md'),
    sequences: path.join(dir, '06-sequences.json')
  };
  for (const [label, file] of Object.entries(files)) {
    if (!(await exists(file))) fail(`${label} stage file is missing after preflight.`);
    const current = await digest(file);
    if (preflight.source_hashes?.[label] !== current) fail(`${label} stage changed after preflight. Re-run npm run outreach:validate.`);
  }
  return preflight;
}

function assignInitialDate(week, holidays, dailyCapacity, maxPerDay) {
  let candidate = week;
  while (true) {
    candidate = nextRecipientWorkingDayOnOrAfter(candidate, holidays);
    const used = dailyCapacity.get(candidate) ?? 0;
    if (used < maxPerDay) {
      dailyCapacity.set(candidate, used + 1);
      return candidate;
    }
    candidate = nextIsoDate(candidate);
  }
}

const week = parseWeek(process.argv.slice(2));
const config = await readJson(path.join(cwd, 'outreach', 'config.json'));
const campaignDir = path.join(cwd, 'outreach', 'campaigns', week);
const preflight = await verifyPreflight(campaignDir);
const sequenceFile = path.join(campaignDir, '06-sequences.json');
const sequenceData = await readJson(sequenceFile);
const sequences = sequenceData.sequences ?? [];

if (sequences.length !== config.campaign.qualified_target) fail(`Expected ${config.campaign.qualified_target} sequences, found ${sequences.length}.`);

const messages = [];
const dailyInitialCapacity = new Map();

for (const [index, sequence] of sequences.entries()) {
  if (!validTimeZone(sequence.recipient_timezone)) fail(`${sequence.domain}: invalid or missing IANA recipient_timezone.`);
  if (sequence.compliance_status !== 'eligible') fail(`${sequence.domain}: compliance_status must be eligible before scheduling.`);
  if (!sequence.recipient_email) fail(`${sequence.domain}: recipient_email missing.`);
  if (!sequence.live_mockup_url) fail(`${sequence.domain}: live_mockup_url missing.`);
  if (!Array.isArray(sequence.touches) || sequence.touches.length !== config.sequence.touches) fail(`${sequence.domain}: expected exactly ${config.sequence.touches} touches.`);

  const holidays = Array.isArray(sequence.non_working_dates) ? sequence.non_working_dates : [];
  let localDate = assignInitialDate(week, holidays, dailyInitialCapacity, config.campaign.new_prospects_per_business_day);
  const localTime = localTimeFor(sequence, index, config);

  for (const touch of sequence.touches) {
    if (touch.touch_number > 1) localDate = addRecipientBusinessDays(localDate, config.sequence.business_day_gap, holidays);
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
      evidence_used: touch.evidence_used ?? [],
      scheduled_local_date: localDate,
      scheduled_local_time: localTime,
      scheduled_timezone: sequence.recipient_timezone,
      non_working_dates_applied: holidays,
      thread_mode: config.sequence.thread_mode,
      stop_on: config.sequence.stop_on,
      compliance_status: sequence.compliance_status,
      compliance_basis: sequence.compliance_basis,
      live_mockup_url: sequence.live_mockup_url,
      send_status: 'planned'
    });
  }
}

const expectedMessages = config.campaign.qualified_target * config.sequence.touches;
if (messages.length !== expectedMessages || preflight.expected_messages !== expectedMessages) fail(`Expected ${expectedMessages} validated messages, found ${messages.length}.`);

const manifestFile = path.join(campaignDir, '07-send-manifest.json');
await writeJson(manifestFile, {
  schema_version: 2,
  campaign_week: week,
  generated_at: new Date().toISOString(),
  provider_status: 'not_loaded',
  sender_mailbox: null,
  reply_aware_provider_required: true,
  preflight_verified: true,
  preflight_generated_at: preflight.generated_at,
  message_count: messages.length,
  prospects: sequences.length,
  initial_touch_distribution: Object.fromEntries([...dailyInitialCapacity.entries()].sort()),
  messages
});

console.log(`Wrote ${messages.length} validated, recipient-calendar-aware planned messages for ${sequences.length} prospects to ${path.relative(cwd, manifestFile)}`);
