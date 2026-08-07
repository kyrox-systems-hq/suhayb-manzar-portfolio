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

function normalizeDomain(value) {
  if (!value) return '';
  return String(value).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split('?')[0].split('#')[0].replace(/\.$/, '');
}

function validHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function meaningful(value) {
  return typeof value === 'string' && value.trim().length >= 8;
}

function wordCount(value) {
  return String(value ?? '').trim().split(/\s+/).filter(Boolean).length;
}

function tokens(text) {
  const stop = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'for', 'is', 'it', 'this', 'that', 'i', 'you', 'your', 'with', 'on', 'if', 'can', 'into']);
  return new Set(String(text ?? '').toLowerCase().replace(/https?:\/\/\S+/g, ' ').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((token) => token.length > 2 && !stop.has(token)));
}

function jaccard(a, b) {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

const week = parseWeek(process.argv.slice(2));
const config = await readJson(path.join(cwd, 'outreach', 'config.json'));
const dir = path.join(cwd, 'outreach', 'campaigns', week);
const dossierFile = path.join(dir, '03-dossiers.json');
const mockupFile = path.join(dir, '04-mockups.json');
const sequenceFile = path.join(dir, '06-sequences.json');
for (const file of [dossierFile, mockupFile, sequenceFile]) if (!(await exists(file))) fail(`${path.basename(file)} is missing.`);

const dossiers = (await readJson(dossierFile)).dossiers ?? [];
const mockups = (await readJson(mockupFile)).mockups ?? [];
const sequences = (await readJson(sequenceFile)).sequences ?? [];
const target = config.campaign.qualified_target;
const issues = [];

if (dossiers.length !== target || mockups.length !== target || sequences.length !== target) {
  issues.push(`evidence guard requires exactly ${target} dossiers, mock-ups and sequences`);
}

const dossierMap = new Map(dossiers.map((item) => [normalizeDomain(item.domain), item]));
const mockupMap = new Map(mockups.map((item) => [normalizeDomain(item.domain), item]));

for (const sequence of sequences) {
  const domain = normalizeDomain(sequence.domain);
  const dossier = dossierMap.get(domain);
  const mockup = mockupMap.get(domain);
  if (!dossier || !mockup) {
    issues.push(`${domain || sequence.business_name}: dossier or mock-up evidence source missing`);
    continue;
  }

  const allowed = new Map();
  const dossierEvidence = dossier.evidence_bank ?? [];
  if (!Array.isArray(dossierEvidence) || dossierEvidence.length < 3) {
    issues.push(`${domain}: dossier evidence_bank must contain at least three sourced evidence items`);
  } else {
    for (const item of dossierEvidence) {
      if (!item?.id || !/^[a-z0-9][a-z0-9._-]{2,}$/i.test(item.id)) {
        issues.push(`${domain}: dossier evidence item has an invalid id`);
        continue;
      }
      if (allowed.has(item.id)) issues.push(`${domain}: duplicate evidence id ${item.id}`);
      if (!meaningful(item.claim)) issues.push(`${domain}: evidence ${item.id} has no meaningful claim`);
      if (!Array.isArray(item.source_urls) || item.source_urls.length === 0 || item.source_urls.some((url) => !validHttpUrl(url))) {
        issues.push(`${domain}: evidence ${item.id} must have at least one valid public source URL`);
      }
      allowed.set(item.id, item.claim);
    }
  }

  const improvements = mockup.demonstrated_improvements ?? [];
  if (!Array.isArray(improvements) || improvements.length < 2) {
    issues.push(`${domain}: mock-up must record at least two demonstrated_improvements`);
  } else {
    for (const item of improvements) {
      if (!item?.id || !/^mockup-[a-z0-9._-]+$/i.test(item.id)) {
        issues.push(`${domain}: demonstrated improvement has an invalid mockup-* id`);
        continue;
      }
      if (allowed.has(item.id)) issues.push(`${domain}: duplicate evidence id ${item.id}`);
      if (!meaningful(item.claim)) issues.push(`${domain}: demonstrated improvement ${item.id} has no meaningful claim`);
      allowed.set(item.id, item.claim);
    }
  }

  const usedAcrossSequence = new Set();
  const touches = sequence.touches ?? [];
  for (const touch of touches) {
    const actualWords = wordCount(touch.body_text);
    if (!Number.isInteger(touch.word_count) || touch.word_count !== actualWords) {
      issues.push(`${domain}: touch ${touch.touch_number} word_count must equal the final body word count (${actualWords})`);
    }
    if (!Array.isArray(touch.evidence_used) || touch.evidence_used.length === 0) {
      issues.push(`${domain}: touch ${touch.touch_number} has no evidence ids`);
      continue;
    }
    for (const id of touch.evidence_used) {
      if (!allowed.has(id)) issues.push(`${domain}: touch ${touch.touch_number} references unknown evidence id ${id}`);
      else usedAcrossSequence.add(id);
    }
  }
  if (usedAcrossSequence.size < 4) issues.push(`${domain}: five-touch sequence uses fewer than four distinct grounded evidence items`);

  for (let i = 0; i < touches.length; i += 1) {
    for (let j = i + 1; j < touches.length; j += 1) {
      const similarity = jaccard(touches[i].body_text, touches[j].body_text);
      if (similarity > 0.72) issues.push(`${domain}: touches ${touches[i].touch_number} and ${touches[j].touch_number} are too textually similar (${similarity.toFixed(2)})`);
    }
  }
}

if (issues.length) {
  console.error(`Evidence grounding preflight failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log('Evidence grounding preflight passed.');
