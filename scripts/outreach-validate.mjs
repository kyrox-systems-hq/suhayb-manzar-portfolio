import { readFile, writeFile, access, rm } from 'node:fs/promises';
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

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim());
}

function validHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
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

function validIsoTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  return Number.isFinite(new Date(value).valueOf());
}

function ageHours(value, nowMs = Date.now()) {
  if (!validIsoTimestamp(value)) return Infinity;
  return Math.max(0, (nowMs - new Date(value).valueOf()) / 3600000);
}

function ageDays(value, nowMs = Date.now()) {
  return ageHours(value, nowMs) / 24;
}

function wordCount(text) {
  return String(text ?? '').trim().split(/\s+/).filter(Boolean).length;
}

function isNonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function numericScore(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 10;
}

async function digest(file) {
  const content = await readFile(file);
  return createHash('sha256').update(content).digest('hex');
}

function stageDomainMap(items, key = 'domain') {
  const map = new Map();
  for (const item of items) map.set(normalizeDomain(item[key]), item);
  return map;
}

function sameSet(a, b) {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

function liveCandidateMap(items) {
  const map = new Map();
  for (const item of items) {
    const original = normalizeDomain(item.domain);
    const finalDomain = normalizeDomain(item.live_check?.final_domain);
    if (original) map.set(original, item);
    if (finalDomain) map.set(finalDomain, item);
  }
  return map;
}

const week = parseWeek(process.argv.slice(2));
const config = await readJson(path.join(cwd, 'outreach', 'config.json'));
const dir = path.join(cwd, 'outreach', 'campaigns', week);
const preflightFile = path.join(dir, 'preflight.json');
await rm(preflightFile, { force: true });

const requiredFiles = {
  liveChecked: path.join(dir, '01-live-checked.json'),
  qualified: path.join(dir, '02-qualified.json'),
  dossiers: path.join(dir, '03-dossiers.json'),
  mockups: path.join(dir, '04-mockups.json'),
  emailStandard: path.join(dir, '05-email-standard.md'),
  sequences: path.join(dir, '06-sequences.json')
};

const issues = [];
for (const [label, file] of Object.entries(requiredFiles)) {
  if (!(await exists(file))) issues.push(`${label} stage file is missing`);
}

if (issues.length) {
  console.error(`Campaign preflight failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

const liveCheckedData = await readJson(requiredFiles.liveChecked);
const qualifiedData = await readJson(requiredFiles.qualified);
const dossierData = await readJson(requiredFiles.dossiers);
const mockupData = await readJson(requiredFiles.mockups);
const sequenceData = await readJson(requiredFiles.sequences);
const emailStandard = await readFile(requiredFiles.emailStandard, 'utf8');

const liveCandidates = liveCheckedData.qualification_candidates ?? [];
const qualified = qualifiedData.prospects ?? [];
const dossiers = dossierData.dossiers ?? [];
const mockups = mockupData.mockups ?? [];
const sequences = sequenceData.sequences ?? [];
const target = config.campaign.qualified_target;

if (liveCandidates.length < target) issues.push(`01-live-checked.json has only ${liveCandidates.length} qualification candidates, expected at least ${target}`);
if (qualified.length !== target) issues.push(`02-qualified.json has ${qualified.length} prospects, expected ${target}`);
if (dossiers.length !== target) issues.push(`03-dossiers.json has ${dossiers.length} dossiers, expected ${target}`);
if (mockups.length !== target) issues.push(`04-mockups.json has ${mockups.length} mock-ups, expected ${target}`);
if (sequences.length !== target) issues.push(`06-sequences.json has ${sequences.length} sequences, expected ${target}`);

const liveMap = liveCandidateMap(liveCandidates);
const qualifiedDomains = new Set();
const qualifiedEmails = new Set();
const allowedCountries = new Set(config.campaign.markets);
const scoreFields = ['ability_to_pay', 'website_opportunity', 'commercial_urgency', 'marketing_spend_evidence', 'decision_maker_accessibility', 'weighted_score'];
const liveMaxAgeHours = Number(config.qualification.live_site_check_max_age_hours ?? 24);
const builtWithMaxAgeDays = Number(config.builtwith.freshness?.max_last_detected_age_days ?? 30);
const contactMaxAgeHours = Number(config.qualification.contact_email_check_max_age_hours ?? liveMaxAgeHours);

for (const [index, prospect] of qualified.entries()) {
  const domain = normalizeDomain(prospect.domain);
  const email = normalizeEmail(prospect.contact_email ?? prospect.recipient_email);
  const label = domain || prospect.business_name || `prospect ${index + 1}`;
  const liveCandidate = liveMap.get(domain);

  if (!isNonEmpty(prospect.business_name)) issues.push(`${label}: business_name missing`);
  if (!domain) issues.push(`${label}: domain missing`);
  if (domain && qualifiedDomains.has(domain)) issues.push(`${label}: duplicate domain inside qualified set`);
  if (domain) qualifiedDomains.add(domain);
  if (!liveCandidate) issues.push(`${label}: prospect did not come from the current live-checked discovery pool`);
  if (!allowedCountries.has(prospect.country)) issues.push(`${label}: country ${prospect.country ?? '(missing)'} is not in the configured campaign markets`);
  if (!isNonEmpty(prospect.location)) issues.push(`${label}: business location missing`);
  if (!validTimeZone(prospect.timezone)) issues.push(`${label}: valid IANA timezone missing`);

  if (!validIsoTimestamp(prospect.builtwith_last_detected_at)) {
    issues.push(`${label}: builtwith_last_detected_at missing or invalid`);
  } else if (ageDays(prospect.builtwith_last_detected_at) > builtWithMaxAgeDays) {
    issues.push(`${label}: BuiltWith last-detected evidence is older than ${builtWithMaxAgeDays} days at preflight`);
  }
  if (!Number.isFinite(Number(prospect.builtwith_last_detected_age_days_at_discovery))) issues.push(`${label}: BuiltWith discovery-age record missing`);
  if (!['preferred', 'fallback'].includes(prospect.builtwith_freshness_tier)) issues.push(`${label}: BuiltWith freshness tier missing or invalid`);
  if (liveCandidate) {
    if (prospect.builtwith_last_detected_at !== liveCandidate.last_detected_at) issues.push(`${label}: BuiltWith last-detected timestamp does not match current discovery record`);
    if (prospect.builtwith_freshness_tier !== liveCandidate.builtwith_freshness_tier) issues.push(`${label}: BuiltWith freshness tier does not match current discovery record`);
  }

  if (!validIsoTimestamp(prospect.live_site_checked_at)) {
    issues.push(`${label}: live_site_checked_at missing or invalid`);
  } else if (ageHours(prospect.live_site_checked_at) > liveMaxAgeHours) {
    issues.push(`${label}: browser live-site verification is older than ${liveMaxAgeHours} hours`);
  }
  if (prospect.live_site_status !== 'active') issues.push(`${label}: live_site_status must be active`);
  if (!validHttpUrl(prospect.live_site_final_url)) issues.push(`${label}: live_site_final_url missing or invalid`);
  if (!domain || normalizeDomain(prospect.live_site_final_domain) !== domain) issues.push(`${label}: qualified domain must match the browser-verified final domain`);
  if (!Array.isArray(prospect.live_site_evidence_urls) || prospect.live_site_evidence_urls.length === 0 || prospect.live_site_evidence_urls.some((url) => !validHttpUrl(url))) {
    issues.push(`${label}: live-site evidence URLs missing or invalid`);
  }

  if (!isNonEmpty(prospect.commercial_verification_notes)) issues.push(`${label}: commercial verification notes missing`);
  if (!isNonEmpty(prospect.primary_website_problem)) issues.push(`${label}: primary website problem missing`);
  if (!Array.isArray(prospect.problem_evidence) || prospect.problem_evidence.length === 0) issues.push(`${label}: website problem evidence missing`);
  if (!isNonEmpty(prospect.best_conversion_surface)) issues.push(`${label}: best conversion surface missing`);
  if (!isNonEmpty(prospect.recipient_name)) issues.push(`${label}: recipient name missing`);
  if (!isNonEmpty(prospect.recipient_role)) issues.push(`${label}: recipient role missing`);
  if (!validEmail(email)) issues.push(`${label}: exact verified contact email missing or invalid`);
  if (email && qualifiedEmails.has(email)) issues.push(`${label}: duplicate contact email inside qualified set`);
  if (email) qualifiedEmails.add(email);
  if (!validHttpUrl(prospect.email_source_url)) issues.push(`${label}: email_source_url missing or invalid`);
  if (!validIsoTimestamp(prospect.contact_email_verified_at)) {
    issues.push(`${label}: contact_email_verified_at missing or invalid`);
  } else if (ageHours(prospect.contact_email_verified_at) > contactMaxAgeHours) {
    issues.push(`${label}: public email verification is older than ${contactMaxAgeHours} hours`);
  }

  if (prospect.compliance_status !== 'eligible') issues.push(`${label}: compliance_status must be eligible`);
  if (!isNonEmpty(prospect.compliance_basis)) issues.push(`${label}: compliance basis missing`);
  if (!Array.isArray(prospect.compliance_evidence_urls) || prospect.compliance_evidence_urls.length === 0 || prospect.compliance_evidence_urls.some((url) => !validHttpUrl(url))) {
    issues.push(`${label}: compliance evidence URLs missing or invalid`);
  }
  if (!prospect.scores || typeof prospect.scores !== 'object') {
    issues.push(`${label}: component scores missing`);
  } else {
    for (const field of scoreFields) if (!numericScore(prospect.scores[field])) issues.push(`${label}: score ${field} missing or outside 0 to 10`);
  }
}

const dossierMap = stageDomainMap(dossiers);
const mockupMap = stageDomainMap(mockups);
const sequenceMap = stageDomainMap(sequences);
const dossierDomains = new Set(dossierMap.keys());
const mockupDomains = new Set(mockupMap.keys());
const sequenceDomains = new Set(sequenceMap.keys());
if (!sameSet(qualifiedDomains, dossierDomains)) issues.push('dossier domains do not exactly match qualified prospect domains');
if (!sameSet(qualifiedDomains, mockupDomains)) issues.push('mock-up domains do not exactly match qualified prospect domains');
if (!sameSet(qualifiedDomains, sequenceDomains)) issues.push('sequence domains do not exactly match qualified prospect domains');

for (const prospect of qualified) {
  const domain = normalizeDomain(prospect.domain);
  const dossier = dossierMap.get(domain);
  if (!dossier) continue;
  if (!isNonEmpty(dossier.primary_commercial_problem)) issues.push(`${domain}: dossier primary commercial problem missing`);
  if (!Array.isArray(dossier.evidence) || dossier.evidence.length === 0) issues.push(`${domain}: dossier evidence missing`);
  if (!isNonEmpty(dossier.why_it_matters)) issues.push(`${domain}: dossier commercial consequence missing`);
  if (!isNonEmpty(dossier.chosen_conversion_surface)) issues.push(`${domain}: dossier conversion surface missing`);
  if (!isNonEmpty(dossier.intervention_hypothesis)) issues.push(`${domain}: dossier intervention hypothesis missing`);
  if (!Array.isArray(dossier.genuine_assets_available) || dossier.genuine_assets_available.length === 0) issues.push(`${domain}: dossier genuine-assets record missing`);
  if (!Array.isArray(dossier.outreach_relevant_observations) || dossier.outreach_relevant_observations.length < 2) issues.push(`${domain}: dossier needs at least two outreach-relevant observations`);
}

for (const prospect of qualified) {
  const domain = normalizeDomain(prospect.domain);
  const mockup = mockupMap.get(domain);
  if (!mockup) continue;
  if (!isNonEmpty(mockup.local_path)) issues.push(`${domain}: mock-up local_path missing`);
  if (!validHttpUrl(mockup.live_url) || !String(mockup.live_url).startsWith('https://')) issues.push(`${domain}: verified HTTPS live mock-up URL missing`);
  for (const flag of ['deployment_verified', 'desktop_verified', 'mobile_verified', 'interactions_verified', 'factual_accuracy_verified']) {
    if (mockup[flag] !== true) issues.push(`${domain}: ${flag} must be true`);
  }
  if (!isNonEmpty(mockup.final_intervention_summary)) issues.push(`${domain}: final intervention summary missing`);
}

const sourceCount = (emailStandard.match(/https:\/\//g) ?? []).length;
if (emailStandard.trim().length < 250) issues.push('05-email-standard.md is too short to be a meaningful researched campaign standard');
if (sourceCount < 2) issues.push('05-email-standard.md must include at least two research source URLs');
for (const concept of ['subject', 'follow-up', 'CTA', 'compliance', 'deliverability']) {
  if (!emailStandard.toLowerCase().includes(concept.toLowerCase())) issues.push(`05-email-standard.md does not address ${concept}`);
}

const forbidden = [
  /\bjust following up\b/i,
  /\bbumping this\b/i,
  /\bany thoughts\??\b/i,
  /\bi never heard back\b/i,
  /\bchecking in\b/i,
  /\bi came across your website\b/i,
  /\bi love what you(?:'|’)re doing\b/i,
  /\byour website looks great but\b/i,
  /\bi help businesses like yours\b/i
];

for (const prospect of qualified) {
  const domain = normalizeDomain(prospect.domain);
  const sequence = sequenceMap.get(domain);
  const mockup = mockupMap.get(domain);
  if (!sequence || !mockup) continue;

  const expectedEmail = normalizeEmail(prospect.contact_email ?? prospect.recipient_email);
  if (normalizeEmail(sequence.recipient_email) !== expectedEmail) issues.push(`${domain}: sequence recipient email does not match qualified record`);
  if (sequence.recipient_name !== prospect.recipient_name) issues.push(`${domain}: sequence recipient name does not match qualified record`);
  if (sequence.recipient_role !== prospect.recipient_role) issues.push(`${domain}: sequence recipient role does not match qualified record`);
  if (sequence.recipient_timezone !== prospect.timezone || !validTimeZone(sequence.recipient_timezone)) issues.push(`${domain}: sequence timezone does not match qualified record`);
  if (sequence.country !== prospect.country) issues.push(`${domain}: sequence country does not match qualified record`);
  if (sequence.compliance_status !== 'eligible') issues.push(`${domain}: sequence compliance_status must be eligible`);
  if (sequence.compliance_basis !== prospect.compliance_basis) issues.push(`${domain}: sequence compliance basis does not match qualified record`);
  if (sequence.live_mockup_url !== mockup.live_url) issues.push(`${domain}: sequence live mock-up URL does not match deployed mock-up record`);

  if (!Array.isArray(sequence.touches) || sequence.touches.length !== config.sequence.touches) {
    issues.push(`${domain}: sequence must contain exactly ${config.sequence.touches} touches`);
    continue;
  }

  const numbers = sequence.touches.map((touch) => touch.touch_number);
  if (numbers.join(',') !== '1,2,3,4,5') issues.push(`${domain}: touch numbers must be exactly 1,2,3,4,5 in order`);
  const purposes = new Set();

  for (const touch of sequence.touches) {
    const body = String(touch.body_text ?? '');
    const limit = touch.touch_number === 1 ? config.sequence.initial_max_words : config.sequence.followup_max_words;
    if (!body.trim()) issues.push(`${domain}: touch ${touch.touch_number} body is empty`);
    if (wordCount(body) > limit) issues.push(`${domain}: touch ${touch.touch_number} exceeds ${limit} words`);
    if (/[\u2013\u2014]/.test(body)) issues.push(`${domain}: touch ${touch.touch_number} contains an en/em dash`);
    if (forbidden.some((pattern) => pattern.test(body))) issues.push(`${domain}: touch ${touch.touch_number} contains forbidden generic or low-value wording`);
    if (!isNonEmpty(touch.purpose)) issues.push(`${domain}: touch ${touch.touch_number} purpose missing`);
    if (isNonEmpty(touch.purpose)) {
      const key = touch.purpose.trim().toLowerCase();
      if (purposes.has(key)) issues.push(`${domain}: touch ${touch.touch_number} repeats a previous touch purpose`);
      purposes.add(key);
    }
    if (!Array.isArray(touch.evidence_used) || touch.evidence_used.length === 0 || touch.evidence_used.some((item) => !isNonEmpty(item))) {
      issues.push(`${domain}: touch ${touch.touch_number} must record prospect-specific evidence used`);
    }
    if (touch.touch_number === 1 && !isNonEmpty(touch.subject)) issues.push(`${domain}: touch 1 subject is required`);
    if (touch.touch_number > 1 && touch.subject != null && String(touch.subject).trim() !== '') issues.push(`${domain}: follow-ups must keep the original thread subject unless provider requirements explicitly change`);
  }

  if (!String(sequence.touches[0].body_text ?? '').includes(mockup.live_url)) issues.push(`${domain}: initial email must include the verified live mock-up URL`);
}

if (issues.length) {
  console.error(`Campaign preflight failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

const hashes = {};
for (const [label, file] of Object.entries(requiredFiles)) hashes[label] = await digest(file);
const report = {
  schema_version: 2,
  campaign_week: week,
  generated_at: new Date().toISOString(),
  passed: true,
  qualified_prospects: qualified.length,
  sequences: sequences.length,
  expected_messages: sequences.length * config.sequence.touches,
  freshness: {
    builtwith_max_age_days: builtWithMaxAgeDays,
    live_site_max_age_hours: liveMaxAgeHours,
    contact_email_max_age_hours: contactMaxAgeHours
  },
  source_hashes: hashes
};
await writeFile(preflightFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log('Campaign preflight passed.');
