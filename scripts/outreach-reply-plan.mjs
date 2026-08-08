import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
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

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
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

function validTimeZone(value) {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function localParts(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time ?? '')) {
    throw new Error(`Invalid local date/time ${date} ${time}.`);
  }
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return { year, month, day, hour, minute };
}

function formattedParts(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(instant);
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second')
  };
}

function zonedLocalToUtc(date, time, timeZone) {
  if (!validTimeZone(timeZone)) throw new Error(`Invalid IANA timezone ${timeZone}.`);
  const desired = localParts(date, time);
  const desiredAsUtc = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute, 0);
  let guess = desiredAsUtc;

  for (let iteration = 0; iteration < 6; iteration += 1) {
    const observed = formattedParts(new Date(guess), timeZone);
    const observedAsUtc = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute, 0);
    const delta = observedAsUtc - desiredAsUtc;
    if (delta === 0) {
      const check = formattedParts(new Date(guess), timeZone);
      if (
        check.year === desired.year &&
        check.month === desired.month &&
        check.day === desired.day &&
        check.hour === desired.hour &&
        check.minute === desired.minute
      ) {
        return new Date(guess).toISOString();
      }
    }
    guess -= delta;
  }

  throw new Error(`Could not resolve ${date} ${time} in ${timeZone} to an unambiguous UTC instant.`);
}

function splitName(fullName) {
  const text = String(fullName ?? '').trim();
  if (!text) return { firstName: null, lastName: null, fullName: null };
  const parts = text.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null, fullName: text };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
    fullName: text
  };
}

function requireInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) fail(`${label} must be a positive integer.`);
  return number;
}

const args = parseArgs(process.argv.slice(2));
const week = mondayIso(args.week);
if (!args.config) fail('Provide --config=/secure/path/reply-config.json.');
const configFile = path.resolve(args.config);
if (!(await exists(configFile))) fail(`Reply config not found: ${configFile}`);

const manifestFile = path.join(cwd, 'outreach', 'campaigns', week, '07-send-manifest.json');
if (!(await exists(manifestFile))) fail('07-send-manifest.json is missing. Run campaign scheduling first.');
const manifestText = await readFile(manifestFile, 'utf8');
const manifest = JSON.parse(manifestText);
const configText = await readFile(configFile, 'utf8');
const config = JSON.parse(configText);

if (config.provider !== 'Reply.io') fail('Reply plan config must set provider to Reply.io.');
const emailAccountId = requireInteger(config.email_account_id, 'email_account_id');
const scheduleId = requireInteger(config.schedule_id, 'schedule_id');
if (manifest.message_count !== 125 || manifest.prospects !== 25 || !Array.isArray(manifest.messages) || manifest.messages.length !== 125) {
  fail('Reply production plan requires a 25-prospect, 125-message manifest.');
}
if (manifest.idempotency_keys_verified !== true) fail('Manifest idempotency keys have not been verified.');

const grouped = new Map();
for (const message of manifest.messages) {
  if (!message.sequence_key || !message.message_key) fail(`${message.domain}: sequence_key/message_key missing.`);
  if (!grouped.has(message.sequence_key)) grouped.set(message.sequence_key, []);
  grouped.get(message.sequence_key).push(message);
}
if (grouped.size !== 25) fail(`Expected 25 sequence groups, found ${grouped.size}.`);

const operations = [];
for (const [sequenceKey, rawMessages] of grouped.entries()) {
  const messages = [...rawMessages].sort((a, b) => a.touch_number - b.touch_number);
  if (messages.map((item) => item.touch_number).join(',') !== '1,2,3,4,5') fail(`${messages[0]?.domain}: Reply plan needs touches 1 through 5.`);

  const first = messages[0];
  const timeZone = first.scheduled_timezone || first.recipient_timezone;
  if (!validTimeZone(timeZone)) fail(`${first.domain}: invalid recipient timezone.`);
  if (messages.some((item) => item.recipient_email !== first.recipient_email)) fail(`${first.domain}: one sequence maps to multiple recipients.`);
  if (messages.some((item) => (item.scheduled_timezone || item.recipient_timezone) !== timeZone)) fail(`${first.domain}: sequence contains mixed timezones.`);

  const utcInstants = messages.map((message) => zonedLocalToUtc(message.scheduled_local_date, message.scheduled_local_time, timeZone));
  const delayMinutes = utcInstants.map((instant, index) => {
    if (index === 0) return 0;
    const delta = (new Date(instant).valueOf() - new Date(utcInstants[index - 1]).valueOf()) / 60000;
    if (!Number.isInteger(delta) || delta <= 0) fail(`${first.domain}: invalid elapsed minutes between touches ${index} and ${index + 1}.`);
    return delta;
  });

  const initialSubject = String(messages[0].subject ?? '').trim();
  if (!initialSubject) fail(`${first.domain}: initial subject missing.`);
  const names = splitName(first.recipient_name);
  const operationId = sha256(`reply-plan|${week}|${sequenceKey}`);
  const sequenceName = `${config.sequence_name_prefix ?? 'Suhayb Web Outreach'} | ${week} | ${first.domain}`;

  const sequencePayload = {
    name: sequenceName,
    scheduleId,
    emailAccounts: [emailAccountId],
    settings: {
      emailsCountPerDay: Number(config.settings?.emails_count_per_day ?? 5),
      daysToFinishProspect: Number(config.settings?.days_to_finish_prospect ?? 30),
      emailSendingDelaySeconds: Number(config.settings?.email_sending_delay_seconds ?? 60),
      dailyThrottling: Number(config.settings?.daily_throttling ?? 5),
      disableOpensTracking: config.settings?.disable_opens_tracking !== false,
      repliesHandlingType: config.settings?.replies_handling_type ?? 'MarkAsFinished',
      enableLinksTracking: config.settings?.enable_links_tracking === true
    },
    steps: messages.map((message, index) => ({
      type: 'Email',
      delayInMinutes: delayMinutes[index],
      executionMode: 'Automatic',
      templates: [{
        subject: index === 0 ? initialSubject : initialSubject,
        body: message.body_text
      }]
    }))
  };

  const contactPayload = {
    email: first.recipient_email,
    firstName: names.firstName,
    lastName: names.lastName,
    fullName: names.fullName,
    title: first.recipient_role ?? null,
    company: first.business_name ?? null,
    domain: first.domain,
    country: first.country ?? null,
    timeZone
  };

  const enrolmentTemplate = {
    contactIds: ['<created-contact-id>'],
    removeFromExisting: false,
    startStepId: null,
    ignoreStepDelay: false,
    startFrom: utcInstants[0]
  };

  operations.push({
    operation_id: operationId,
    sequence_key: sequenceKey,
    domain: first.domain,
    recipient_email: first.recipient_email,
    recipient_timezone: timeZone,
    expected_local_schedule: messages.map((message, index) => ({
      touch_number: message.touch_number,
      message_key: message.message_key,
      local_date: message.scheduled_local_date,
      local_time: message.scheduled_local_time,
      timezone: timeZone,
      utc_instant: utcInstants[index],
      delay_from_previous_minutes: delayMinutes[index]
    })),
    create_sequence: {
      method: 'POST',
      path: '/sequences',
      body: sequencePayload
    },
    create_contact: {
      method: 'POST',
      path: '/contacts',
      body: contactPayload
    },
    enrol_contact_after_ids_resolve: {
      method: 'POST',
      path_template: '/sequences/<created-sequence-id>/contact-links/bulk',
      body_template: enrolmentTemplate
    },
    post_enrolment_verification: {
      method: 'GET',
      path_template: '/sequences/<created-sequence-id>/contacts/<created-contact-id>',
      require: {
        email: first.recipient_email,
        status: 'active',
        isOptedOut: false,
        nextSendAfter_matches_first_utc_instant: utcInstants[0]
      }
    }
  });
}

const providerPreflightFile = path.join(cwd, 'outreach', 'campaigns', week, '08-provider-preflight.json');
const providerPreflightExists = await exists(providerPreflightFile);
let productionLoadAllowed = false;
let providerPreflight = null;
if (providerPreflightExists) {
  providerPreflight = await readJson(providerPreflightFile);
  productionLoadAllowed = providerPreflight.passed === true && providerPreflight.provider_name === 'Reply.io' && manifest.production_ready_manifest === true;
}

const plan = {
  schema_version: 1,
  provider: 'Reply.io',
  campaign_week: week,
  generated_at: new Date().toISOString(),
  dry_run_only: true,
  production_load_allowed: productionLoadAllowed,
  production_load_blocker: productionLoadAllowed ? null : 'Reply.io provider preflight has not passed for this production manifest.',
  manifest_sha256: sha256(manifestText),
  reply_config_sha256: sha256(configText),
  api_base: config.api_base ?? 'https://api.reply.io/v3',
  credential_env_var: config.credential_env_var ?? 'REPLY_API_KEY',
  sequence_strategy: 'one_reply_sequence_per_prospect',
  sequence_count: operations.length,
  contact_count: operations.length,
  email_step_count: operations.reduce((sum, operation) => sum + operation.create_sequence.body.steps.length, 0),
  timing_assumption_requires_controlled_test: 'Reply delayInMinutes plus startFrom must reproduce the manifest UTC schedule. Verify nextSendAfter and actual same-thread behaviour before production.',
  operations
};

const outputDir = path.join(cwd, 'outreach', 'campaigns', week);
await mkdir(outputDir, { recursive: true });
const outputFile = path.join(outputDir, 'reply-io-plan.json');
await writeFile(outputFile, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
console.log(`Wrote dry-run Reply.io plan with ${operations.length} sequences and ${plan.email_step_count} email steps to ${path.relative(cwd, outputFile)}.`);
