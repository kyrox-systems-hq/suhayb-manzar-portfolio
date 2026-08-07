import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import http from 'node:http';

const root = process.cwd();
const week = '2099-01-05';
const campaignDir = path.join(root, 'outreach', 'campaigns', week);
const ledgerFile = path.join(root, 'public', 'mockups', '_outreach-ledger.json');
const originalLedger = await readFile(ledgerFile, 'utf8');
const tempDir = await mkdtemp(path.join(tmpdir(), 'outreach-v3-test-'));
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function runNpm(script, args = [], expectedSuccess = true, extraEnv = {}) {
  const result = spawnSync('npm', ['run', script, '--', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, BUILTWITH_API_KEY: '', ...extraEnv }
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

const nowSeconds = Math.floor(Date.now() / 1000);
const day = 86400;

function bw({
  domain,
  name,
  country = 'US',
  revenue = 90000,
  employees = 12,
  spend = 900,
  sku = 120,
  email,
  lastDetected = nowSeconds - 2 * day
}) {
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
    why_it_matters: 'Important reassurance is separated from the point where a visitor decides whether to buy.',
    chosen_conversion_surface: q.best_conversion_surface,
    intervention_hypothesis: 'Bring proposition, delivery reassurance and trust proof into one focused mobile buying flow.',
    genuine_assets_available: ['official logo', 'official product imagery', 'published product information'],
    outreach_relevant_observations: [
      'Delivery reassurance is separated from the purchase decision.',
      'The mobile hierarchy makes the product proposition harder to scan.',
      'The current marketing stack indicates active acquisition investment.'
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
    final_intervention_summary: 'Focused conversion-led flagship product-page concept.'
  };
}

function sequence(q, m, i) {
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
      {
        touch_number: 1,
        subject: 'A product-page idea',
        body_text: `Hi ${q.recipient_name}, I noticed the mobile product page separates delivery reassurance from the buying decision. I built a focused concept showing how I would bring that information into the purchase flow: ${m.live_url} If you like the direction, I can implement it in the live store.`,
        purpose: 'Introduce the researched conversion problem and working concept',
        evidence_used: ['Delivery reassurance is separated from the purchase decision.']
      },
      {
        touch_number: 2,
        subject: null,
        body_text: 'One other thing I changed in the concept is the mobile hierarchy. The product proposition is easier to scan before the purchase controls, without adding unsupported claims. If that direction makes sense, I can build it into the live page.',
        purpose: 'Add the mobile hierarchy angle',
        evidence_used: ['The mobile hierarchy makes the product proposition harder to scan.']
      },
      {
        touch_number: 3,
        subject: null,
        body_text: 'The reason I focused on the product page rather than a full redesign is that it is the point where existing acquisition traffic has to make a buying decision. The intervention stays narrow and measurable.',
        purpose: 'Connect the intervention to acquisition efficiency',
        evidence_used: ['The current marketing stack indicates active acquisition investment.']
      },
      {
        touch_number: 4,
        subject: null,
        body_text: 'This is not only a design file. I can implement the same structure directly in the live ecommerce platform, including responsive behaviour and the existing genuine store content.',
        purpose: 'Reduce implementation uncertainty',
        evidence_used: ['The mock-up uses the current ecommerce platform and genuine store content.']
      },
      {
        touch_number: 5,
        subject: null,
        body_text: 'I will close the loop here. If you want the focused product-page direction implemented, reply and I can take it from the concept into the live store.',
        purpose: 'Close the sequence cleanly',
        evidence_used: ['A verified focused mock-up is already live.']
      }
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
  server.listen(0, '0.0.0.0', resolve);
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
  runNpm('outreach:discover', [`--week=${week}`, `--input=${inputPath}`], true);

  const discoveredPath = path.join(campaignDir, '01-discovered.json');
  const discovered = JSON.parse(await readFile(discoveredPath, 'utf8'));
  check(discovered.prospects.length === 30, `discovery should return the 30 fresh valid records, got ${discovered.prospects.length}`);
  check(discovered.preferred_fresh_count === 29, `expected 29 preferred-fresh records, got ${discovered.preferred_fresh_count}`);
  check(discovered.fallback_fresh_count === 1, `expected one fallback-fresh record, got ${discovered.fallback_fresh_count}`);
  check(Boolean(discovered.retrieval_run_id), 'discovery must record a retrieval_run_id');
  check(Boolean(discovered.source_provenance?.payload_sha256), 'import discovery must record payload SHA-256 provenance');
  check(discovered.source_provenance?.record_level_last_detected_freshness_enforced === true, 'import discovery must record that record-level freshness was enforced');
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

  runNpm('outreach:live-check', [`--week=${week}`], true, { OUTREACH_TEST_MODE: '1' });
  const liveChecked = JSON.parse(await readFile(path.join(campaignDir, '01-live-checked.json'), 'utf8'));
  check(liveChecked.checked_count === 30, `live check should inspect all 30 records, got ${liveChecked.checked_count}`);
  check(liveChecked.qualification_candidate_count === 28, `expected 28 qualification candidates after one duplicate redirect and one 500 failure, got ${liveChecked.qualification_candidate_count}`);
  check(liveChecked.duplicate_redirect_count === 1, `expected one duplicate redirect, got ${liveChecked.duplicate_redirect_count}`);
  check(liveChecked.failed_count === 1, `expected one failed status, got ${liveChecked.failed_count}`);
  check(liveChecked.browser_recheck_count === 1, `expected one browser-recheck candidate, got ${liveChecked.browser_recheck_count}`);

  const selectable = liveChecked.qualification_candidates.filter((candidate) => candidate.live_check_status === 'live').slice(0, 25);
  check(selectable.length === 25, `need 25 deterministic-live candidates for full fixture, got ${selectable.length}`);
  const qs = selectable.map(qualifiedFromCandidate);
  const ds = qs.map(dossier);
  const ms = qs.map(mockup);
  const ss = qs.map((q, i) => sequence(q, ms[i], i));

  await writeJson(path.join(campaignDir, '02-qualified.json'), {
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
  });
  await writeJson(path.join(campaignDir, '03-dossiers.json'), { dossiers: ds });
  await writeJson(path.join(campaignDir, '04-mockups.json'), { mockups: ms });
  await writeFile(
    path.join(campaignDir, '05-email-standard.md'),
    '# Campaign Email Standard\n\nThe subject stays short and factual. The opening uses current account research. Initial copy is concise and prospect-specific. Every follow-up adds a different commercial angle. The CTA asks directly whether the demonstrated implementation should be built into the live store. Compliance is checked per jurisdiction and deliverability rules are confirmed before provider loading. Current public contact evidence is rechecked before writing.\n\nResearch sources:\nhttps://www.gong.io/\nhttps://www.ftc.gov/\n',
    'utf8'
  );
  await writeJson(path.join(campaignDir, '06-sequences.json'), { sequences: ss });

  runNpm('outreach:validate', [`--week=${week}`], true);
  runNpm('outreach:schedule', [`--week=${week}`], true);

  const manifest = JSON.parse(await readFile(path.join(campaignDir, '07-send-manifest.json'), 'utf8'));
  check(manifest.preflight_verified === true, 'send manifest should record verified preflight');
  check(manifest.message_count === 125, `expected 125 planned messages, got ${manifest.message_count}`);
  check(Boolean(manifest.freshness_preflight), 'send manifest should carry the freshness preflight summary');

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
  await writeJson(path.join(campaignDir, '02-qualified.json'), { schema_version: 2, campaign_week: week, prospects: staleQualification, rejected: [] });
  runNpm('outreach:validate', [`--week=${week}`], false);

  const staleEmail = structuredClone(qs);
  staleEmail[0].contact_email_verified_at = new Date(Date.now() - 48 * 3600000).toISOString();
  await writeJson(path.join(campaignDir, '02-qualified.json'), { schema_version: 2, campaign_week: week, prospects: staleEmail, rejected: [] });
  runNpm('outreach:validate', [`--week=${week}`], false);

  await writeJson(path.join(campaignDir, '02-qualified.json'), { schema_version: 2, campaign_week: week, prospects: qs, rejected: [] });
  runNpm('outreach:validate', [`--week=${week}`], true);

  const mutatedLive = structuredClone(liveChecked);
  mutatedLive.generated_at = new Date().toISOString();
  await writeJson(path.join(campaignDir, '01-live-checked.json'), mutatedLive);
  runNpm('outreach:schedule', [`--week=${week}`], false);
  await writeJson(path.join(campaignDir, '01-live-checked.json'), liveChecked);

  await writeJson(path.join(campaignDir, '02-qualified.json'), {
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
  });
  runNpm('outreach:ledger-sync', [`--week=${week}`], true);
  const ledger = JSON.parse(await readFile(ledgerFile, 'utf8'));
  check(ledger.entries.some((entry) => entry.domain === qs[0].domain && entry.status === 'qualified'), 'ledger should persist qualified prospects');
  check(ledger.entries.some((entry) => entry.domain === 'rejected-no-email.example' && entry.rejection_reason === 'no_verified_email'), 'ledger should persist serious no-email rejections');

  if (failures.length) {
    console.error(`Outreach v3 test failed with ${failures.length} defect(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('Outreach v3 freshness, qualification, scheduling and ledger tests passed.');
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
  await writeFile(ledgerFile, originalLedger, 'utf8');
  await rm(campaignDir, { recursive: true, force: true });
  await rm(tempDir, { recursive: true, force: true });
}
