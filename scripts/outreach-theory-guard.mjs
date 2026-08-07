import { readFile, access, stat } from 'node:fs/promises';
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

const week = parseWeek(process.argv.slice(2));
const dir = path.join(cwd, 'outreach', 'campaigns', week);
const standardFile = path.join(dir, '05-email-standard.md');
const sequenceFile = path.join(dir, '06-sequences.json');
for (const file of [standardFile, sequenceFile]) if (!(await exists(file))) fail(`${path.basename(file)} is missing.`);

const standard = await readFile(standardFile, 'utf8');
const sequences = await readJson(sequenceFile);
const issues = [];
const reviewed = standard.match(/^Reviewed:\s*(\d{4}-\d{2}-\d{2})\s*$/mi)?.[1] ?? null;
const reviewId = standard.match(/^Review-ID:\s*([^\s]+)\s*$/mi)?.[1] ?? null;
const legacyFixtureAllowed = process.env.OUTREACH_TEST_MODE === '1' && process.env.OUTREACH_ALLOW_LEGACY_TEST_FIXTURE === '1';

if (legacyFixtureAllowed && !reviewed && !reviewId && !sequences.email_standard_review_id && !sequences.email_standard_reviewed) {
  console.log('Cold-email theory preflight skipped for an explicitly authorised legacy synthetic fixture.');
  process.exit(0);
}

if (!validDate(reviewed)) {
  issues.push('05-email-standard.md must contain a valid `Reviewed: YYYY-MM-DD` line');
} else {
  const reviewedAt = new Date(`${reviewed}T12:00:00Z`).valueOf();
  const ageDays = (Date.now() - reviewedAt) / 86400000;
  if (ageDays > 7.5) issues.push('campaign email theory review is older than seven days');
  if (ageDays < -1.5) issues.push('campaign email theory review is materially future-dated');
}

if (!reviewId || !/^[A-Za-z0-9._:-]{8,}$/.test(reviewId)) issues.push('05-email-standard.md must contain a stable `Review-ID:` value');
if (sequences.email_standard_review_id !== reviewId) issues.push('06-sequences.json must copy the current email standard Review-ID');
if (sequences.email_standard_reviewed !== reviewed) issues.push('06-sequences.json must copy the current email standard Reviewed date');

const [standardStat, sequenceStat] = await Promise.all([stat(standardFile), stat(sequenceFile)]);
if (sequenceStat.mtimeMs + 1000 < standardStat.mtimeMs) {
  issues.push('05-email-standard.md was modified after the sequence file; rewrite or re-confirm the sequences against the current standard');
}

if (issues.length) {
  console.error(`Cold-email theory preflight failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log('Cold-email theory preflight passed.');
