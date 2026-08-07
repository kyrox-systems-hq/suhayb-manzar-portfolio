import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
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
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseArgs(argv) {
  const [command = 'status', ...rest] = argv;
  const args = {};
  for (const item of rest) {
    if (!item.startsWith('--')) continue;
    const [key, ...valueParts] = item.slice(2).split('=');
    args[key] = valueParts.length ? valueParts.join('=') : true;
  }
  return { command, args };
}

function mondayIso(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) fail('Provide --week=YYYY-MM-DD using the Monday campaign start date.');
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.getUTCDay() !== 1) fail(`Campaign week must be a Monday. Received ${value}.`);
  return value;
}

function campaignDir(week) {
  return path.join(cwd, 'outreach', 'campaigns', week);
}

async function initCampaign(week, config) {
  const dir = campaignDir(week);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, 'campaign.json');
  if (await exists(file)) {
    console.log(`Campaign already exists: ${path.relative(cwd, file)}`);
    return;
  }
  await writeJson(file, {
    schema_version: 1,
    campaign_week: week,
    created_at: new Date().toISOString(),
    qualified_target: config.campaign.qualified_target,
    discovery_pool_target: config.campaign.discovery_pool_target,
    new_prospects_per_business_day: config.campaign.new_prospects_per_business_day,
    status: 'initialized'
  });
  console.log(`Initialized ${path.relative(cwd, dir)}`);
}

async function status(week) {
  const dir = campaignDir(week);
  const files = [
    'campaign.json',
    '01-discovered.json',
    '01-live-checked.json',
    'source-preflight.json',
    '02-qualified.json',
    '03-dossiers.json',
    '04-mockups.json',
    '05-email-standard.md',
    '06-sequences.json',
    'preflight.json',
    '07-send-manifest.json',
    '08-provider-preflight.json',
    '09-results-review.md'
  ];

  for (const file of files) {
    const full = path.join(dir, file);
    if (!(await exists(full))) {
      console.log(`MISSING ${file}`);
      continue;
    }
    if (file.endsWith('.json')) {
      const data = await readJson(full);
      const count = data.count
        ?? data.qualification_candidate_count
        ?? data.prospects?.length
        ?? data.dossiers?.length
        ?? data.mockups?.length
        ?? data.sequences?.length
        ?? data.messages?.length
        ?? '';
      console.log(`READY   ${file}${count !== '' ? ` (${count})` : ''}`);
    } else {
      console.log(`READY   ${file}`);
    }
  }
}

const { command, args } = parseArgs(process.argv.slice(2));
const configPath = path.join(cwd, 'outreach', 'config.json');
if (!(await exists(configPath))) fail('outreach/config.json is missing.');
const config = await readJson(configPath);
const week = mondayIso(args.week);

switch (command) {
  case 'init':
    await initCampaign(week, config);
    break;
  case 'status':
    await status(week);
    break;
  default:
    fail(`Unknown command: ${command}. Use the dedicated npm scripts for discovery, live checking, validation, scheduling, provider preflight and ledger sync.`);
}
