import { readFile, writeFile, access } from 'node:fs/promises';
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

function parseWeek(argv) {
  const raw = argv.find((value) => value.startsWith('--week='))?.slice(7);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw ?? '')) fail('Provide --week=YYYY-MM-DD using the Monday campaign start date.');
  const date = new Date(`${raw}T12:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.getUTCDay() !== 1) fail(`Campaign week must be a Monday. Received ${raw}.`);
  return raw;
}

function normalizeDomain(value) {
  if (!value) return '';
  return String(value).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split('?')[0].split('#')[0].replace(/\.$/, '');
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

const week = parseWeek(process.argv.slice(2));
const qualifiedFile = path.join(cwd, 'outreach', 'campaigns', week, '02-qualified.json');
if (!(await exists(qualifiedFile))) fail('02-qualified.json is missing.');
const stage = await readJson(qualifiedFile);
const ledgerFile = path.join(cwd, 'public', 'mockups', '_outreach-ledger.json');
const ledger = await readJson(ledgerFile);

const indexes = {
  domains: new Map(),
  names: new Map(),
  emails: new Map(),
  sourcePosts: new Map(),
  contacts: new Map()
};

function setIndex(map, key, entry) {
  if (key && !map.has(key)) map.set(key, entry);
}

function indexEntry(entry) {
  setIndex(indexes.domains, normalizeDomain(entry.domain), entry);
  setIndex(indexes.names, normalize(entry.business_name), entry);
  setIndex(indexes.emails, normalize(entry.contact_email), entry);
  setIndex(indexes.sourcePosts, String(entry.source_post_url ?? '').trim(), entry);
  setIndex(indexes.contacts, normalize(entry.owner_or_contact), entry);
}

for (const entry of ledger.entries ?? []) indexEntry(entry);

function duplicateMatch(candidate) {
  const checks = [
    ['domain', normalizeDomain(candidate.domain), indexes.domains],
    ['business_name', normalize(candidate.business_name), indexes.names],
    ['contact_email', normalize(candidate.contact_email ?? candidate.recipient_email), indexes.emails],
    ['source_post_url', String(candidate.source_post_url ?? '').trim(), indexes.sourcePosts],
    ['owner_or_contact', normalize(candidate.owner_or_contact ?? candidate.recipient_name), indexes.contacts]
  ];
  for (const [field, value, map] of checks) {
    if (value && map.has(value)) return { field, value, entry: map.get(value) };
  }
  return null;
}

function isCurrentCampaignEntry(match) {
  return match?.entry?.campaign_week === week;
}

function buildEntry(candidate, status) {
  return {
    business_name: candidate.business_name ?? normalizeDomain(candidate.domain),
    domain: normalizeDomain(candidate.domain) || null,
    owner_or_contact: candidate.owner_or_contact ?? (candidate.recipient_name ? `${candidate.recipient_name}${candidate.recipient_role ? `, ${candidate.recipient_role}` : ''}` : null),
    contact_email: candidate.contact_email ?? candidate.recipient_email ?? null,
    email_source_url: candidate.email_source_url ?? null,
    source_post_url: candidate.source_post_url ?? null,
    source_platform: candidate.source_platform ?? 'BuiltWith-led discovery',
    first_researched_at: candidate.first_researched_at ?? new Date().toISOString().slice(0, 10),
    campaign_week: week,
    status,
    rejection_reason: status === 'rejected' ? candidate.rejection_reason ?? 'unclassified' : null,
    mockup_slug: candidate.mockup_slug ?? null,
    notes: candidate.notes ?? (status === 'qualified'
      ? `Qualified for weekly campaign ${week}. Commercial, website, contact and compliance gates passed.`
      : `Evaluated for weekly campaign ${week} and rejected before mock-up production.`)
  };
}

function addEntry(candidate, status) {
  const match = duplicateMatch(candidate);
  if (match) {
    if (isCurrentCampaignEntry(match)) return { added: false, currentCampaignDuplicate: true, match };
    return { added: false, currentCampaignDuplicate: false, match };
  }
  const entry = buildEntry(candidate, status);
  ledger.entries.push(entry);
  indexEntry(entry);
  return { added: true, currentCampaignDuplicate: false, match: null };
}

let qualifiedAdded = 0;
let rejectedAdded = 0;

for (const prospect of stage.prospects ?? []) {
  const result = addEntry(prospect, 'qualified');
  if (result.added) {
    qualifiedAdded += 1;
    continue;
  }
  if (!result.currentCampaignDuplicate) {
    fail(`${prospect.domain ?? prospect.business_name ?? 'qualified candidate'}: qualified prospect duplicates permanent ledger by ${result.match.field} (${result.match.value}). Replace it before proceeding.`);
  }
}

for (const prospect of stage.rejected ?? []) {
  if (!prospect.rejection_reason) fail(`${prospect.domain ?? prospect.business_name ?? 'rejected candidate'}: rejection_reason is required.`);
  const result = addEntry(prospect, 'rejected');
  if (result.added) rejectedAdded += 1;
  // A duplicate rejection need not create a second permanent entry because the earlier ledger entry already excludes it.
}

ledger.updated_at = new Date().toISOString();
await writeJson(ledgerFile, ledger);
console.log(`Ledger sync complete: ${qualifiedAdded} qualified and ${rejectedAdded} rejected candidates added.`);
