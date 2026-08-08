import { readFile, access } from 'node:fs/promises';
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

function validTimeZone(value) {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

const week = parseWeek(process.argv.slice(2));
const config = await readJson(path.join(cwd, 'outreach', 'config.json'));
const sequenceFile = path.join(cwd, 'outreach', 'campaigns', week, '06-sequences.json');
if (!(await exists(sequenceFile))) fail('06-sequences.json is missing.');
const data = await readJson(sequenceFile);
const sequences = data.sequences ?? [];
const issues = [];

if (sequences.length !== config.campaign.qualified_target) {
  issues.push(`expected ${config.campaign.qualified_target} sequences, found ${sequences.length}`);
}

for (const sequence of sequences) {
  const label = sequence.domain ?? sequence.business_name ?? 'sequence';
  if (!validTimeZone(sequence.recipient_timezone)) issues.push(`${label}: recipient_timezone is missing or invalid`);
  if (sequence.preferred_local_send_time != null && !validTime(sequence.preferred_local_send_time)) {
    issues.push(`${label}: preferred_local_send_time must be HH:MM in 24-hour time`);
  }
  if (sequence.non_working_dates == null) {
    issues.push(`${label}: non_working_dates must be an array, even when empty`);
  } else if (!Array.isArray(sequence.non_working_dates)) {
    issues.push(`${label}: non_working_dates must be an array`);
  } else {
    const seen = new Set();
    for (const date of sequence.non_working_dates) {
      if (!validDate(date)) issues.push(`${label}: invalid non-working date ${date}`);
      if (seen.has(date)) issues.push(`${label}: duplicate non-working date ${date}`);
      seen.add(date);
    }
  }
}

if (issues.length) {
  console.error(`Recipient timing preflight failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log('Recipient timing preflight passed.');
