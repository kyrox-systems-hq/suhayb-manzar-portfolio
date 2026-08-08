import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

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

function parseWeek(argv) {
  const raw = argv.find((value) => value.startsWith('--week='))?.slice(7);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw ?? '')) fail('Provide --week=YYYY-MM-DD using the Monday campaign start date.');
  const date = new Date(`${raw}T12:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.getUTCDay() !== 1) fail(`Campaign week must be a Monday. Received ${raw}.`);
  return raw;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function validTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value ?? ''));
}

function localNow(timeZone, now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(now);
    const get = (type) => parts.find((part) => part.type === type)?.value;
    return {
      date: `${get('year')}-${get('month')}-${get('day')}`,
      time: `${get('hour')}:${get('minute')}`
    };
  } catch {
    return null;
  }
}

const week = parseWeek(process.argv.slice(2));
const manifestFile = path.join(process.cwd(), 'outreach', 'campaigns', week, '07-send-manifest.json');
if (!(await exists(manifestFile))) fail('07-send-manifest.json is missing.');
const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
const issues = [];
const legacyFixtureAllowed = process.env.OUTREACH_TEST_MODE === '1' && process.env.OUTREACH_ALLOW_LEGACY_PROVIDER_FIXTURE === '1';

for (const message of manifest.messages ?? []) {
  const label = `${message.domain ?? message.recipient_email ?? 'message'} touch ${message.touch_number ?? '?'}`;
  const hasTiming = validDate(message.scheduled_local_date) && validTime(message.scheduled_local_time) && Boolean(message.scheduled_timezone);
  if (!hasTiming && legacyFixtureAllowed) continue;
  if (!validDate(message.scheduled_local_date)) issues.push(`${label}: scheduled_local_date missing or invalid`);
  if (!validTime(message.scheduled_local_time)) issues.push(`${label}: scheduled_local_time missing or invalid`);
  if (!message.scheduled_timezone) {
    issues.push(`${label}: scheduled_timezone missing`);
    continue;
  }
  const now = localNow(message.scheduled_timezone);
  if (!now) {
    issues.push(`${label}: scheduled_timezone is invalid`);
    continue;
  }
  if (!hasTiming) continue;
  const scheduled = `${message.scheduled_local_date}T${message.scheduled_local_time}`;
  const current = `${now.date}T${now.time}`;
  if (message.send_status === 'planned' && scheduled <= current) {
    issues.push(`${label}: planned send time ${scheduled} is already past in ${message.scheduled_timezone}`);
  }
}

if (issues.length) {
  console.error(`Provider timing guard failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log('Provider timing guard passed.');
