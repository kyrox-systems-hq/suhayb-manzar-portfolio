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

const keys = {
  domains: new Set(),
  names: new Set(),
  emails: new Set(),
  sourcePosts: new Set(),
  contacts: new Set()
};

function indexEntry(entry) {
  if (entry.domain) keys.domains.add(normalizeDomain(entry.domain));
  if (entry.business_name) keys.names.add(normalize(entry.business_name));
  if (entry.contact_email) keys.emails.add(normalize(entry.contact_email));
  if (entry.source_post_url) keys.sourcePosts.add(String(entry.source_post_url).trim());
  if (entry.owner_or_contact) keys.contacts.add(normalize(entry.owner_or_contact));
}

for (const entry of ledger.entries ?? []) indexEntry(entry);

function isDuplicate(candidate) {
  const domain = normalizeDomain(candidate.domain);
  const name = normalize(candidate.business_name);
  const email = normalize(candidate.contact_email ?? candidate.recipient_email);
  const sourcePost = String(candidate.source_post_url ?? '').trim();
  const contact = normalize(candidate.owner_or_contact ?? candidate.recipient_name);
  return Boolean(
    (domain && keys.domains.has(domain)) ||
    (name && keys.names.has(name)) ||
    (email && keys.emails.has(email)) ||
    (sourcePost && keys.sourcePosts.has(sourcePost)) ||
    (contact && keys.contacts.has(contact))
  );
}

function add(candidate, status) {
  if (isDuplicate(candidate)) return false;
  const entry = {
    business_name: candidate.business_name ?? normalizeDomain(candidate.domain),
    domain: normalizeDomain(candidate.domain) || null,
    owner_or_contact: candidate.owner_or_contact ?? (candidate.recipient_name ? `${candidate.recipient_name}${candidate.recipient_role ? `, ${candidate.recipient_role}` : ''}` : null),
    contact_email: candidate.contact_email ?? candidate.recipient_email ?? null,
    email_source_url: candidate.email_source_url ?? null,
    source_post_url: candidate.source_post_url ?? null,
    source_platform: candidate.source_platform ?? 'BuiltWith-led discovery',
    first_researched_at: candidate.first_researched_at ?? new Date().toISOString().slice(0, 10),
    status,
    rejection_reason: status === 'rejected' ? candidate.rejection_reason ?? 'unclassified' : null,
    mockup_slug: candidate.mockup_slug ?? null,
    notes: candidate.notes ?? (status === 'qualified'
      ? `Qualified for weekly campaign ${week}. Commercial, website, contact and compliance gates passed.`
      : `Evaluated for weekly campaign ${week} and rejected before mock-up production.`)
  };
  ledger.entries.push(entry);
  indexEntry(entry);
  return true;
}

let qualifiedAdded = 0;
let rejectedAdded = 0;
for (const prospect of stage.prospects ?? []) if (add(prospect, 'qualified')) qualifiedAdded += 1;
for (const prospect of stage.rejected ?? []) {
  if (!prospect.rejection_reason) fail(`${prospect.domain ?? prospect.business_name ?? 'rejected candidate'}: rejection_reason is required.`);
  if (add(prospect, 'rejected')) rejectedAdded += 1;
}

ledger.updated_at = new Date().toISOString();
await writeJson(ledgerFile, ledger);
console.log(`Ledger sync complete: ${qualifiedAdded} qualified and ${rejectedAdded} rejected candidates added.`);
