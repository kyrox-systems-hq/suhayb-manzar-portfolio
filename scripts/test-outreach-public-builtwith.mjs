import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const week = '2099-01-05';
const campaignDir = path.join(root, 'outreach', 'campaigns', week);
const tempDir = await mkdtemp(path.join(tmpdir(), 'public-builtwith-test-'));
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function run(script, args, expectedSuccess = true, env = {}) {
  const result = await new Promise((resolve) => {
    const child = spawn('node', [script, ...args], {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({ status: null, stdout, stderr: `${stderr}${error.message}` }));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
  const ok = result.status === 0;
  if (ok !== expectedSuccess) failures.push(`${script} ${expectedSuccess ? 'should pass' : 'should fail'} but exited ${result.status}.\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
  return result;
}

function sourcePages(fetchedAt) {
  return [
    'https://trends.builtwith.com/joins/Shopify-using-Klaviyo',
    'https://trends.builtwith.com/joins/Shopify-using-Facebook-Pixel',
    'https://trends.builtwith.com/joins/Shopify-using-Hotjar',
    'https://builtwith.com/website-lists/Shopify'
  ].map((url) => ({ url, fetched_at: fetchedAt, last_updated_claim: 'Instantly', direct_fetch: true }));
}

function prospect(i, sourceUrl) {
  return {
    business_name: `Public Store ${i}`,
    domain: `public-store-${i}.example`,
    country: i % 3 === 0 ? 'US' : i % 3 === 1 ? 'UK' : 'CA',
    ecommerce_platform_signal: 'Shopify',
    estimated_monthly_revenue_usd: 45000 + i * 4000,
    estimated_monthly_tech_spend_usd: 700 + i * 25,
    estimated_employees: i % 5 === 0 ? null : 8 + (i % 20),
    sku_count: 40 + i,
    social_followers: 1000 + i * 100,
    traffic_rank: 900000 - i * 1000,
    marketing_signal: i % 2 === 0 ? 'Klaviyo' : 'Meta Pixel',
    builtwith_public_source_url: sourceUrl
  };
}

try {
  await rm(campaignDir, { recursive: true, force: true });
  await mkdir(campaignDir, { recursive: true });
  const now = new Date().toISOString();
  const pages = sourcePages(now);
  const prospects = Array.from({ length: 32 }, (_, i) => prospect(i, pages[i % pages.length].url));
  prospects.push({ ...prospect(99, pages[0].url), domain: 'too-small.example', estimated_monthly_revenue_usd: 5000 });
  prospects.push({ ...prospect(100, pages[1].url), domain: 'too-large.example', estimated_monthly_revenue_usd: 900000 });
  prospects.push({ ...prospect(101, pages[2].url), domain: 'too-many-staff.example', estimated_employees: 200 });
  prospects.push({ ...prospect(102, pages[3].url), domain: 'wrong-country.example', country: 'AU' });
  prospects.push({ ...prospect(103, pages[0].url), domain: 'too-few-products.example', sku_count: 2 });
  prospects.push({ ...prospect(104, pages[1].url), domain: 'patchandbagel.com' });

  const inputFile = path.join(tempDir, 'public-builtwith.json');
  await writeJson(inputFile, { schema_version: 1, source_pages: pages, prospects });
  await run('scripts/outreach-public-builtwith.mjs', [`--week=${week}`, `--input=${inputFile}`], true);

  const discovery = JSON.parse(await readFile(path.join(campaignDir, '01-discovered.json'), 'utf8'));
  check(discovery.production_eligible === true, 'public BuiltWith discovery should be production eligible');
  check(discovery.source_provenance?.type === 'BuiltWith Public Trends', 'source type should be BuiltWith Public Trends');
  check(discovery.source_provenance?.live_public_web === true, 'public source should be marked live_public_web');
  check(discovery.count === 32, `expected 32 valid public BuiltWith candidates, got ${discovery.count}`);
  check(!discovery.prospects.some((p) => ['too-small.example', 'too-large.example', 'too-many-staff.example', 'wrong-country.example', 'too-few-products.example', 'patchandbagel.com'].includes(p.domain)), 'commercial, country and permanent-ledger exclusions must be enforced');
  check(discovery.prospects.some((p) => p.estimated_employees == null), 'unknown employee count should be allowed at discovery for later qualification resolution');

  await writeJson(path.join(campaignDir, '01-live-checked.json'), {
    schema_version: 1,
    campaign_week: week,
    generated_at: new Date().toISOString(),
    discovery_retrieval_run_id: discovery.retrieval_run_id,
    qualification_candidate_count: discovery.prospects.length,
    qualification_candidates: discovery.prospects.map((p) => ({ ...p, live_check_status: 'live' })),
    all_checks: discovery.prospects.map((p) => ({ ...p, live_check_status: 'live' }))
  });
  await run('scripts/outreach-source-guard.mjs', [`--week=${week}`], true);
  const sourcePreflight = JSON.parse(await readFile(path.join(campaignDir, 'source-preflight.json'), 'utf8'));
  check(sourcePreflight.passed === true, 'public BuiltWith source preflight should pass');
  check(sourcePreflight.production_source_eligible === true, 'public source preflight should remain production eligible');
  check(sourcePreflight.source_type === 'BuiltWith Public Trends', 'source preflight should preserve public source type');

  const stalePages = sourcePages(new Date(Date.now() - 30 * 3600000).toISOString());
  await writeJson(inputFile, {
    schema_version: 1,
    source_pages: stalePages,
    prospects: Array.from({ length: 30 }, (_, i) => prospect(i, stalePages[i % stalePages.length].url))
  });
  await run('scripts/outreach-public-builtwith.mjs', [`--week=${week}`, `--input=${inputFile}`], false);

  const tooFewPages = sourcePages(now).slice(0, 2);
  await writeJson(inputFile, {
    schema_version: 1,
    source_pages: tooFewPages,
    prospects: Array.from({ length: 30 }, (_, i) => prospect(i, tooFewPages[i % tooFewPages.length].url))
  });
  await run('scripts/outreach-public-builtwith.mjs', [`--week=${week}`, `--input=${inputFile}`], false);

  if (failures.length) {
    console.error(`Public BuiltWith regression failed with ${failures.length} issue(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('Public BuiltWith no-user discovery regression passed.');
  }
} finally {
  await rm(campaignDir, { recursive: true, force: true });
  await rm(tempDir, { recursive: true, force: true });
}
