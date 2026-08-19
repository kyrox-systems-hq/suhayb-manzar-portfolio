import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import http from 'node:http';

const root = process.cwd();
const week = '2099-01-05';
const campaignDir = path.join(root, 'outreach', 'campaigns', week);
const ledgerFile = path.join(root, 'public', 'mockups', '_outreach-ledger.json');
const originalLedger = await readFile(ledgerFile, 'utf8');
const tempDir = await mkdtemp(path.join(tmpdir(), 'outreach-v5-test-'));
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

async function runNpm(script, args = [], expectedSuccess = true, extraEnv = {}) {
  const result = await new Promise((resolve) => {
    const child = spawn('npm', ['run', script, '--', ...args], {
      cwd: root,
      env: { ...process.env, BUILTWITH_API_KEY: '', ...extraEnv },
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
  if (ok !== expectedSuccess) {
    failures.push(`${script} ${args.join(' ')} ${expectedSuccess ? 'should succeed' : 'should fail'} but exited ${result.status}.\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
  }
  return result;
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function wordCount(value) {
  return String(value ?? '').trim().split(/\s+/).filter(Boolean).length;
}

function touch(touch_number, subject, body_text, purpose, evidence_used) {
  return { touch_number, subject, body_text, purpose, evidence_used, word_count: wordCount(body_text) };
}

const nowSeconds = Math.floor(Date.now() / 1000);
const day = 86400;

function bw({ domain, name, country = 'US', revenue = 90000, employees = 12, spend = 900, sku = 120, email, lastDetected = nowSeconds - 2 * day }) {
  const record = {
    D: domain,
    R: revenue,
    E: employees,
    S: spend,
    SKU: sku,
    FD: nowSeconds - 90 * day,
    A: 500000,
    META: { CompanyName: name, Country: country, City: 'Test City', Emails: email ? [email] : [] }
  };
  if (lastDetected !== null) record.LD = lastDetected;
  return record;
}

function qualifiedFromCandidate(candidate, i) {
  const domain = candidate.live_check.final_domain;
  const checkedAt = new Date().toISOString();
  return {
    business_name: `Qualified ${i}`,
    domain,
    country: 'US',
    location: 'Test City, US',
    timezone: 'America/New_York',
    builtwith_signals: {
      estimated_monthly_revenue_usd: candidate.estimated_monthly_revenue_usd,
      estimated_monthly_tech_spend_usd: candidate.estimated_monthly_tech_spend_usd,
      estimated_employees: candidate.estimated_employees,
      sku_count: candidate.sku_count
    },
    builtwith_last_detected_at: candidate.last_detected_at,
    builtwith_last_detected_age_days_at_discovery: candidate.builtwith_last_detected_age_days,
    builtwith_freshness_tier: candidate.builtwith_freshness_tier,
    live_site_checked_at: checkedAt,
    live_site_status: 'active',
    live_site_final_url: candidate.live_check.final_url,
    live_site_final_domain: domain,
    live_site_evidence_urls: [candidate.live_check.final_url],
    commercial_verification_notes: 'Active ecommerce operation with a current catalogue and evidence of marketing investment.',
    primary_website_problem: 'The mobile product page separates delivery and trust reassurance from the purchase decision.',
    problem_evidence: ['Current mobile product-page hierarchy inspected.'],
    best_conversion_surface: 'flagship product page',
    recipient_name: `Owner ${i}`,
    recipient_role: 'Founder',
    contact_email: `owner${i}@qualified-${i}.example`,
    email_source_url: `https://qualified-${i}.example/contact`,
    contact_email_verified_at: checkedAt,
    compliance_status: 'eligible',
    compliance_basis: 'CAN-SPAM B2B commercial email requirements recorded',
    compliance_evidence_urls: ['https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business'],
    scores: {
      ability_to_pay: 8,
      website_opportunity: 8,
      commercial_urgency: 7,
      marketing_spend_evidence: 8,
      decision_maker_accessibility: 9,
      weighted_score: 8
    }
  };
}

function dossier(q) {
  return {
    business_name: q.business_name,
    domain: q.domain,
    primary_commercial_problem: q.primary_website_problem,
    evidence: ['Current mobile product-page hierarchy inspected.'],
    source_urls: [q.live_site_final_url],
    why_it_matters: 'Important reassurance is separated from the point where a visitor decides whether to buy.',
    chosen_conversion_surface: q.best_conversion_surface,
    intervention_hypothesis: 'Bring proposition, delivery reassurance and trust proof into one focused mobile buying flow.',
    genuine_assets_available: ['official logo', 'official product imagery', 'published product information'],
    outreach_relevant_observations: [
      'Delivery reassurance is separated from the purchase decision.',
      'The mobile hierarchy makes the product proposition harder to scan.',
      'The current marketing stack indicates active acquisition investment.'
    ],
    evidence_bank: [
      {
        id: 'site-1',
        type: 'website_observation',
        claim: 'Delivery reassurance is separated from the purchase decision on the current product page.',
        source_urls: [q.live_site_final_url]
      },
      {
        id: 'site-2',
        type: 'website_observation',
        claim: 'The current mobile hierarchy makes the product proposition harder to scan before purchase controls.',
        source_urls: [q.live_site_final_url]
      },
      {
        id: 'business-1',
        type: 'business_fact',
        claim: 'The store is an active ecommerce operation with a current catalogue.',
        source_urls: [q.live_site_final_url]
      }
    ]
  };
}

function mockup(q) {
  const slug = q.domain.replace(/\W+/g, '-');
  return {
    business_name: q.business_name,
    domain: q.domain,
    slug,
    local_path: `public/mockups/${slug}/`,
    live_url: `https://suhayb-manzar-portfolio.web.app/mockups/${slug}/`,
    deployment_verified: true,
    desktop_verified: true,
    mobile_verified: true,
    interactions_verified: true,
    factual_accuracy_verified: true,
    final_intervention_summary: 'Focused conversion-led flagship product-page concept.',
    demonstrated_improvements: [
      {
        id: 'mockup-hierarchy',
        claim: 'The concept moves the product proposition into a clearer mobile hierarchy before the purchase controls.'
      },
      {
        id: 'mockup-reassurance',
        claim: 'The concept brings delivery and trust reassurance closer to the buying decision.'
      }
    ]
  };
}

function sequence(q, m, i) {
  const t1 = `Hi ${q.recipient_name}, I noticed delivery reassurance sits away from the buying decision on the mobile product page. I built a focused concept that brings it into the purchase flow and clarifies the hierarchy: ${m.live_url} If the direction makes sense, I can implement it in the live store.`;
  const t2 = 'One other change in the concept is the mobile hierarchy. The product proposition is easier to scan before the purchase controls, so the page asks less of someone arriving on a phone. I can carry that structure into the live page.';
  const t3 = 'I kept the intervention on the product page rather than turning it into a full redesign. The store is already operating, so the concept concentrates on the point where a visitor has to decide whether to buy.';
  const t4 = 'The concept is not only a design file. I can implement the same structure directly in the live ecommerce platform, including responsive behaviour and the genuine store content already in use.';
  const t5 = 'I will close the loop here. The focused concept is still live if you want to review it. If you want that product-page direction implemented, reply and I can take it into the live store.';
  return {
    business_name: q.business_name,
    domain: q.domain,
    recipient_name: q.recipient_name,
    recipient_role: q.recipient_role,
    recipient_email: q.contact_email,
    recipient_timezone: q.timezone,
    country: q.country,
    live_mockup_url: m.live_url,
    compliance_status: q.compliance_status,
    compliance_basis: q.compliance_basis,
    preferred_local_send_time: i === 0 ? '09:35' : undefined,
    non_working_dates: i === 0 ? [week] : [],
    touches: [
      touch(1, 'A product-page idea', t1, 'Introduce the researched conversion problem and focused concept', ['site-1', 'mockup-reassurance']),
      touch(2, null, t2, 'Add the mobile hierarchy angle', ['site-2', 'mockup-hierarchy']),
      touch(3, null, t3, 'Connect the intervention to the live ecommerce journey', ['business-1', 'site-1']),
      touch(4, null, t4, 'Reduce implementation uncertainty', ['mockup-hierarchy', 'mockup-reassurance']),
      touch(5, null, t5, 'Close the sequence cleanly', ['mockup-reassurance'])
    ]
  };
}

function businessDayDistance(from, to, holidays = []) {
  const holidaySet = new Set(holidays);
  const date = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  let count = 0;
  while (date < end) {
    date.setUTCDate(date.getUTCDate() + 1);
    const iso = date.toISOString().slice(0, 10);
    if (![0, 6].includes(date.getUTCDay()) && !holidaySet.has(iso)) count += 1;
  }
  return count;
}

const server = http.createServer((req, res) => {
  if (req.url === '/blocked') {
    res.writeHead(403, { 'content-type': 'text/html' });
    res.end('blocked');
    return;
  }
  if (req.url === '/fail') {
    res.writeHead(500, { 'content-type': 'text/html' });
    res.end('failed');
    return;
  }
  if (req.url === '/redirect') {
    const port = server.address().port;
    res.writeHead(302, { location: `http://127.0.0.1:${port}/ok` });
    res.end();
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
  res.end('<!doctype html><title>Live test store</title>');
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '0.0.0', resolve);
});

try {
  await rm(campaignDir, { recursive: true, force: true });
  await mkdir(campaignDir, { recursive: true });

  const valid = Array.from({ length: 30 }, (_, i) => bw({
    domain: `fresh-store-${i}.example`,
    name: `Fresh Store ${i}`,
    email: `hello${i}@fresh-store-${i}.example`,
    lastDetected: i === 29 ? nowSeconds - 20 * day : nowSeconds - 2 * day
  }));
  const input = {
    technology: 'Shopify',
    Results: [
      ...valid,
      bw({ domain: 'patchandbagel.com', name: 'Fresh Alias', email: 'fresh@patchandbagel.com' }),
      bw({ domain: 'name-duplicate.example', name: 'Nexo Doors', email: 'new@name-duplicate.example' }),
      bw({ domain: 'email-duplicate.example', name: 'Fresh Email Duplicate', email: 'hello@nexodoors.co.uk' }),
      bw({ domain: 'low-revenue.example', name: 'Low Revenue', revenue: 1000, email: 'low@low-revenue.example' }),
      bw({ domain: 'low-employees.example', name: 'Low Employees', employees: 1, email: 'low@low-employees.example' }),
      bw({ domain: 'low-spend.example', name: 'Low Spend', spend: 10, email: 'low@low-spend.example' }),
      bw({ domain: 'low-sku.example', name: 'Low SKU', sku: 1, email: 'low@low-sku.example' }),
      bw({ domain: 'wrong-country.example', name: 'Wrong Country', country: 'AU', email: 'au@wrong-country.example' }),
      bw({ domain: 'stale.example', name: 'Stale', email: 'stale@stale.example', lastDetected: nowSeconds - 45 * day }),
      bw({ domain: 'missing-ld.example', name: 'Missing LD', email: 'missing@missing-ld.example', lastDetected: null }),
      bw({ domain: 'future-ld.example', name: 'Future LD', email: 'future@future-ld.example', lastDetected: nowSeconds + 3 * day }),
      valid[0]
    ]
  };

  const inputPath = path.join(tempDir, 'builtwith.json');
  await writeJson(inputPath, input);
  await runNpm('outreach:discover', [`--week=${week}`, `--input=${inputPath}`], true);

  const discoveredPath = path.join(campaignDir, '01-discovered.json');
  const discovered = JSON.parse(await readFile(discoveredPath, 'utf8'));
  check(discovered.prospects.length === 30, `discovery should return 30 fresh valid records, got ${discovered.prospects.length}`);
  check(discovered.preferred_fresh_count === 29, `expected 29 preferred-fresh records, got ${discovered.preferred_fresh_count}`);
  check(discovered.fallback_fresh_count === 1, `expected one fallback-fresh record, got ${discovered.fallback_fresh_count}`);
  check(Boolean(discovered.retrieval_run_id), 'discovery must record a retrieval_run_id');
  check(Boolean(discovered.source_provenance?.payload_sha256), 'import discovery must record payload SHA-256 provenance');
  check(discovered.production_eligible === false, 'import discovery must be explicitly non-production');
  for (const rejectedDomain of ['stale.example', 'missing-ld.example', 'future-ld.example', 'email-duplicate.example', 'wrong-country.example']) {
    check(!discovered.prospects.some((p) => p.domain === rejectedDomain), `${rejectedDomain} should not survive discovery`);
  }

  const port = server.address().port;
  for (let i = 0; i < discovered.prospects.length; i += 1) {
    const host = `127.0.0.${i + 1}`;
    const pathName = i === 27 ? '/redirect' : i === 28 ? '/blocked' : i === 29 ? '/fail' : '/ok';
    discovered.prospects[i].test_url_override = `http://${host}:${port}${pathName}`;
  }
  await writeJson(discoveredPath, discovered);

  await runNpm('outreach:live-check', [`--week=${week}`], true, { OUTREACH_TEST_MODE: '1' });
  const liveCheckedPath = path.join(campaignDir, '01-live-checked.json');
  const liveChecked = JSON.parse(await readFile(liveCheckedPath, 'utf8'));
  check(liveChecked.checked_count === 30, `live check should inspect all 30 records, got ${liveChecked.checked_count}`);
  check(liveChecked.qualification_candidate_count === 28, `expected 28 qualification candidates, got ${liveChecked.qualification_candidate_count}`);
  check(liveChecked.duplicate_redirect_count === 1, `expected one duplicate redirect, got ${liveChecked.duplicate_redirect_count}`);
  check(liveChecked.failed_count === 1, `expected one failed status, got ${liveChecked.failed_count}`);
  check(liveChecked.browser_recheck_count === 1, `expected one browser-recheck candidate, got ${liveChecked.browser_recheck_count}`);

  const selectable = liveChecked.qualification_candidates.filter((candidate) => candidate.live_check_status === 'live').slice(0, 25);
  check(selectable.length === 25, `need 25 deterministic-live candidates for full fixture, got ${selectable.length}`);
  const qs = selectable.map(qualifiedFromCandidate);
  const ds = qs.map(dossier);
  const ms = qs.map(mockup);
  const ss = qs.map((q, i) => sequence(q, ms[i], i));

  const qualifiedPayload = {
    schema_version: 2,
    campaign_week: week,
    prospects: qs,
    rejected: [{
      business_name: 'Rejected No Email',
      domain: 'rejected-no-email.example',
      recipient_name: 'Rejected Owner',
      recipient_role: 'Founder',
      contact_email: null,
      email_source_url: null,
      source_post_url: null,
      source_platform: 'BuiltWith-led discovery',
      rejection_reason: 'no_verified_email',
      notes: 'Commercially plausible candidate rejected before mock-up work because no exact public email was verified.'
    }]
  };
  await writeJson(path.join(campaignDir, '02-qualified.json'), qualifiedPayload);
  await writeJson(path.join(campaignDir, '03-dossiers.json'), { schema_version: 2, campaign_week: week, dossiers: ds });
  await writeJson(path.join(campaignDir, '04-mockups.json'), { mockups: ms });
  await writeFile(
    path.join(campaignDir, '05-email-standard.md'),
    '# Campaign Email Standard\n\nThe subject stays short and factual. The opening uses current account research. Initial copy is concise and prospect-specific. Every follow-up adds a different commercial angle. The CTA asks directly whether the demonstrated implementation should be built into the live store. Compliance is checked per jurisdiction and deliverability rules are confirmed before provider loading. Current public contact evidence is rechecked before writing.\n\nResearch sources:\nhttps://www.gong.io/\nhttps://www.ftc.gov/\n',
    'utf8'
  );
  await writeJson(path.join(campaignDir, '06-sequences.json'), { sequences: ss });

  await runNpm('outreach:validate', [`--week=${week}`], false);
  await runNpm('outreach:validate', [`--week=${week}`], true, { OUTREACH_TEST_MODE: '1' });
  await runNpm('outreach:schedule', [`--week=${week}`], false);
  await runNpm('outreach:schedule', [`--week=${week}`], true, { OUTREACH_TEST_MODE: '1' });

  const manifest = JSON.parse(await readFile(path.join(campaignDir, '07-send-manifest.json'), 'utf8'));
  check(manifest.source_preflight_verified === true, 'send manifest should record verified source preflight');
  check(manifest.preflight_verified === true, 'send manifest should record verified campaign preflight');
  check(manifest.production_source_eligible === false, 'test/import manifest should remain marked non-production');
  check(manifest.production_ready_manifest === false, 'test/import manifest must not be production ready');
  check(manifest.idempotency_keys_verified === true, 'manifest should verify idempotency keys');
  check(manifest.message_count === 125, `expected 125 planned messages, got ${manifest.message_count}`);
  check(new Set(manifest.messages.map((m) => m.message_key)).size === 125, 'all 125 message keys must be unique');
  check(new Set(manifest.messages.map((m) => m.sequence_key)).size === 25, 'there must be 25 unique sequence keys');

  const initials = manifest.messages.filter((m) => m.touch_number === 1);
  const distribution = new Map();
  for (const message of initials) distribution.set(message.scheduled_local_date, (distribution.get(message.scheduled_local_date) ?? 0) + 1);
  check([...distribution.values()].every((count) => count <= 5), `no date should have more than five new prospects: ${JSON.stringify(Object.fromEntries(distribution))}`);

  const first = manifest.messages.filter((m) => m.domain === qs[0].domain);
  check(first[0].scheduled_local_date !== week, 'a recipient holiday should move the initial touch off that date');
  check(first.every((m) => m.scheduled_local_time === '09:35'), 'preferred local send time should be preserved across all touches');
  for (let i = 1; i < first.length; i += 1) {
    check(businessDayDistance(first[i - 1].scheduled_local_date, first[i].scheduled_local_date, [week]) === 3, `touch ${i + 1} should be exactly three recipient business days after touch ${i}`);
  }

  const staleQualification = structuredClone(qs);
  staleQualification[0].live_site_checked_at = new Date(Date.now() - 48 * 3600000).toISOString();
  await writeJson(path.join(campaignDir, '02-qualified.json'), { ...qualifiedPayload, prospects: staleQualification });
  await runNpm('outreach:validate', [`--week=${week}`], false, { OUTREACH_TEST_MODE: '1' });

  const staleEmail = structuredClone(qs);
  staleEmail[0].contact_email_verified_at = new Date(Date.now() - 48 * 3600000).toISOString();
  await writeJson(path.join(campaignDir, '02-qualified.json'), { ...qualifiedPayload, prospects: staleEmail });
  await runNpm('outreach:validate', [`--week=${week}`], false, { OUTREACH_TEST_MODE: '1' });

  await writeJson(path.join(campaignDir, '02-qualified.json'), qualifiedPayload);
  const badEvidence = structuredClone(ss);
  badEvidence[0].touches[1].evidence_used = ['made-up-evidence'];
  await writeJson(path.join(campaignDir, '06-sequences.json'), { sequences: badEvidence });
  await runNpm('outreach:validate', [`--week=${week}`], false, { OUTREACH_TEST_MODE: '1' });

  const badWordCount = structuredClone(ss);
  badWordCount[0].touches[1].word_count += 1;
  await writeJson(path.join(campaignDir, '06-sequences.json'), { sequences: badWordCount });
  await runNpm('outreach:validate', [`--week=${week}`], false, { OUTREACH_TEST_MODE: '1' });

  const genericSequence = structuredClone(ss);
  genericSequence[0].touches[1] = touch(2, null, 'Just following up to see if you had any thoughts?', 'Generic follow-up', ['site-2']);
  await writeJson(path.join(campaignDir, '06-sequences.json'), { sequences: genericSequence });
  await runNpm('outreach:validate', [`--week=${week}`], false, { OUTREACH_TEST_MODE: '1' });

  await writeJson(path.join(campaignDir, '06-sequences.json'), { sequences: ss });
  await runNpm('outreach:validate', [`--week=${week}`], true, { OUTREACH_TEST_MODE: '1' });

  const mutatedDiscovery = structuredClone(discovered);
  mutatedDiscovery.generated_at = new Date().toISOString();
  await writeJson(discoveredPath, mutatedDiscovery);
  await runNpm('outreach:schedule', [`--week=${week}`], false, { OUTREACH_TEST_MODE: '1' });
  await writeJson(discoveredPath, discovered);

  const mutatedLive = structuredClone(liveChecked);
  mutatedLive.generated_at = new Date().toISOString();
  await writeJson(liveCheckedPath, mutatedLive);
  await runNpm('outreach:schedule', [`--week=${week}`], false, { OUTREACH_TEST_MODE: '1' });
  await writeJson(liveCheckedPath, liveChecked);

  await writeJson(path.join(campaignDir, '02-qualified.json'), qualifiedPayload);
  await runNpm('outreach:ledger-sync', [`--week=${week}`], true);
  const ledger = JSON.parse(await readFile(ledgerFile, 'utf8'));
  check(ledger.entries.some((entry) => entry.domain === qs[0].domain && entry.status === 'qualified'), 'ledger should persist qualified prospects');
  check(ledger.entries.some((entry) => entry.domain === 'rejected-no-email.example' && entry.rejection_reason === 'no_verified_email'), 'ledger should persist serious no-email rejections');

  if (failures.length) {
    console.error(`Outreach v5 test failed with ${failures.length} defect(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('Outreach v5 source freshness, liveness, evidence grounding, campaign, scheduling and ledger tests passed.');
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
  await writeFile(ledgerFile, originalLedger, 'utf8');
  await rm(campaignDir, { recursive: true, force: true });
  await rm(tempDir, { recursive: true, force: true });
}
