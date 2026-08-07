import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const week = '2099-01-05';
const campaignDir = path.join(root, 'outreach', 'campaigns', week);
const tempDir = await mkdtemp(path.join(tmpdir(), 'outreach-test-'));
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function run(command, args, expectedSuccess = true) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, BUILTWITH_API_KEY: '' }
  });
  const ok = result.status === 0;
  if (ok !== expectedSuccess) {
    failures.push(
      `${command} ${args.join(' ')} ${expectedSuccess ? 'should succeed' : 'should fail'} but exited ${result.status}.\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
    );
  }
  return result;
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function builtWithRecord({
  domain,
  name,
  country = 'US',
  revenue = 90000,
  employees = 12,
  spend = 900,
  sku = 120,
  email
}) {
  return {
    D: domain,
    R: revenue,
    E: employees,
    S: spend,
    SKU: sku,
    FD: 4070908800,
    LD: 4070908800,
    A: 500000,
    META: {
      CompanyName: name,
      Country: country,
      City: 'Test City',
      Emails: email ? [email] : []
    }
  };
}

function qualifiedRecord(i) {
  return {
    business_name: `Qualified ${i}`,
    domain: `qualified-${i}.example`,
    country: 'US',
    location: 'Test City, US',
    timezone: 'America/New_York',
    commercial_verification_notes: 'Active ecommerce business with current catalogue and marketing stack.',
    primary_website_problem: 'The mobile product page buries delivery and trust information below the purchase decision.',
    best_conversion_surface: 'flagship product page',
    recipient_name: `Owner ${i}`,
    recipient_role: 'Founder',
    contact_email: `owner${i}@qualified-${i}.example`,
    email_source_url: `https://qualified-${i}.example/contact`,
    compliance_status: 'eligible',
    compliance_basis: 'CAN-SPAM B2B commercial email requirements recorded',
    compliance_evidence_urls: ['https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business'],
    scores: {
      ability_to_pay: 8,
      website_opportunity: 8,
      commercial_urgency: 7,
      marketing_spend_evidence: 8,
      decision_maker_accessibility: 9,
      weighted_score: 8.0
    }
  };
}

function dossierFor(q) {
  return {
    business_name: q.business_name,
    domain: q.domain,
    primary_commercial_problem: q.primary_website_problem,
    evidence: ['Mobile purchase hierarchy inspected on the current product page.'],
    why_it_matters: 'Important buying reassurance is separated from the point of decision.',
    chosen_conversion_surface: q.best_conversion_surface,
    intervention_hypothesis: 'Bring the product proposition, delivery reassurance and trust proof into one focused mobile buying flow.',
    genuine_assets_available: ['official logo', 'official product imagery', 'published product information'],
    outreach_relevant_observations: [
      'Delivery reassurance is separated from the purchase decision.',
      'The mobile hierarchy makes the product proposition harder to scan.',
      'The existing marketing stack indicates active investment in acquisition.'
    ]
  };
}

function mockupFor(q) {
  return {
    business_name: q.business_name,
    domain: q.domain,
    slug: q.domain.replace(/\W+/g, '-'),
    local_path: `public/mockups/${q.domain.replace(/\W+/g, '-')}/`,
    live_url: `https://suhayb-manzar-portfolio.web.app/mockups/${q.domain.replace(/\W+/g, '-')}/`,
    deployment_verified: true,
    desktop_verified: true,
    mobile_verified: true,
    interactions_verified: true,
    factual_accuracy_verified: true,
    final_intervention_summary: 'Focused conversion-led flagship product-page concept.'
  };
}

function sequenceFor(q, mockup, i) {
  const preferred = i === 0 ? '09:35' : undefined;
  return {
    business_name: q.business_name,
    domain: q.domain,
    recipient_name: q.recipient_name,
    recipient_role: q.recipient_role,
    recipient_email: q.contact_email,
    recipient_timezone: q.timezone,
    country: q.country,
    live_mockup_url: mockup.live_url,
    compliance_status: q.compliance_status,
    compliance_basis: q.compliance_basis,
    preferred_local_send_time: preferred,
    non_working_dates: i === 0 ? [week] : [],
    touches: [
      {
        touch_number: 1,
        subject: 'A product-page idea',
        body_text: `Hi ${q.recipient_name}, I noticed the mobile product page separates delivery reassurance from the buying decision. I built a focused concept showing how I would bring that information into the purchase flow: ${mockup.live_url} If you like the direction, I can implement it in the live store.`,
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
        body_text: 'The reason I focused on the product page rather than a full redesign is that it is the point where existing acquisition traffic has to make a buying decision. The concept keeps that intervention narrow and measurable.',
        purpose: 'Connect the intervention to acquisition efficiency',
        evidence_used: ['The existing marketing stack indicates active investment in acquisition.']
      },
      {
        touch_number: 4,
        subject: null,
        body_text: 'This is not only a design file. I can implement the same structure directly in the live ecommerce platform, including responsive behaviour and the existing genuine store content.',
        purpose: 'Reduce implementation uncertainty',
        evidence_used: ['The concept is built around the current ecommerce platform and genuine store content.']
      },
      {
        touch_number: 5,
        subject: null,
        body_text: 'I will close the loop here. If you want the focused product-page direction implemented, reply and I can take it from the concept into the live store.',
        purpose: 'Close the sequence cleanly',
        evidence_used: ['A verified focused mock-up is already available.']
      }
    ]
  };
}

async function resetCampaign() {
  await rm(campaignDir, { recursive: true, force: true });
  await mkdir(campaignDir, { recursive: true });
}

try {
  await resetCampaign();

  // 1. Discovery must enforce commercial filters and all duplicate signals even for imported BuiltWith data.
  const valid = Array.from({ length: 10 }, (_, i) => builtWithRecord({
    domain: `new-store-${i}.example`,
    name: `New Store ${i}`,
    email: `hello${i}@new-store-${i}.example`
  }));
  const input = {
    technology: 'Shopify',
    Results: [
      ...valid,
      builtWithRecord({ domain: 'patchandbagel.com', name: 'Fresh Alias', email: 'fresh@patchandbagel.com' }),
      builtWithRecord({ domain: 'name-duplicate.example', name: 'Nexo Doors', email: 'new@name-duplicate.example' }),
      builtWithRecord({ domain: 'email-duplicate.example', name: 'Fresh Email Duplicate', email: 'hello@nexodoors.co.uk' }),
      builtWithRecord({ domain: 'low-revenue.example', name: 'Low Revenue', revenue: 1000, email: 'low@low-revenue.example' }),
      builtWithRecord({ domain: 'low-employees.example', name: 'Low Employees', employees: 1, email: 'low@low-employees.example' }),
      builtWithRecord({ domain: 'low-spend.example', name: 'Low Spend', spend: 10, email: 'low@low-spend.example' }),
      builtWithRecord({ domain: 'low-sku.example', name: 'Low SKU', sku: 1, email: 'low@low-sku.example' }),
      builtWithRecord({ domain: 'wrong-country.example', name: 'Wrong Country', country: 'AU', email: 'au@wrong-country.example' }),
      valid[0]
    ]
  };
  const inputPath = path.join(tempDir, 'builtwith.json');
  await writeJson(inputPath, input);
  run('node', ['scripts/outreach.mjs', 'discover', `--week=${week}`, `--input=${inputPath}`], true);
  const discovered = JSON.parse(await readFile(path.join(campaignDir, '01-discovered.json'), 'utf8'));
  check(discovered.prospects.length === 10, `discovery should return exactly the 10 commercially valid, non-duplicate records; got ${discovered.prospects.length}`);
  check(!discovered.prospects.some((p) => p.domain === 'email-duplicate.example'), 'discovery should exclude a candidate whose public BuiltWith email matches an existing ledger contact email');
  check(!discovered.prospects.some((p) => ['low-revenue.example', 'low-employees.example', 'low-spend.example', 'low-sku.example', 'wrong-country.example'].includes(p.domain)), 'discovery import should enforce the same commercial and country filters as the API path');

  // 2. Qualification alone must never pass the full campaign validator.
  const superficiallyQualified = Array.from({ length: 25 }, (_, i) => ({
    business_name: `Thin ${i}`,
    domain: `thin-${i}.example`,
    contact_email: `owner${i}@thin-${i}.example`,
    email_source_url: `https://thin-${i}.example/contact`,
    primary_website_problem: 'Weak mobile page',
    compliance_status: 'eligible',
    compliance_basis: 'Recorded basis'
  }));
  await writeJson(path.join(campaignDir, '02-qualified.json'), { prospects: superficiallyQualified });
  run('node', ['scripts/outreach.mjs', 'validate', `--week=${week}`], false);

  // 3. Build a complete valid campaign fixture.
  const qualified = Array.from({ length: 25 }, (_, i) => qualifiedRecord(i));
  const dossiers = qualified.map(dossierFor);
  const mockups = qualified.map(mockupFor);
  const sequences = qualified.map((q, i) => sequenceFor(q, mockups[i], i));
  await writeJson(path.join(campaignDir, '02-qualified.json'), { prospects: qualified });
  await writeJson(path.join(campaignDir, '03-dossiers.json'), { dossiers });
  await writeJson(path.join(campaignDir, '04-mockups.json'), { mockups });
  await writeFile(
    path.join(campaignDir, '05-email-standard.md'),
    '# Campaign Email Standard\n\nReviewed against current cold-email evidence. Initial emails are concise, personalised and evidence-led. Follow-ups add a new commercial angle. CTA asks directly about implementation. Compliance and deliverability requirements are checked before scheduling.\n\nSources:\nhttps://www.gong.io/\nhttps://www.ftc.gov/\n',
    'utf8'
  );
  await writeJson(path.join(campaignDir, '06-sequences.json'), { sequences });

  // 4. Scheduling must be blocked until a full-stage validation/preflight has passed.
  run('node', ['scripts/outreach-schedule.mjs', `--week=${week}`], false);

  // 5. Sequence QA must reject evidence-free generic follow-ups.
  const brokenSequences = structuredClone(sequences);
  brokenSequences[0].touches[1].evidence_used = [];
  brokenSequences[0].touches[1].purpose = brokenSequences[0].touches[0].purpose;
  await writeJson(path.join(campaignDir, '06-sequences.json'), { sequences: brokenSequences });
  run('node', ['scripts/outreach.mjs', 'validate', `--week=${week}`], false);

  // Restore valid sequences and require complete validation to pass.
  await writeJson(path.join(campaignDir, '06-sequences.json'), { sequences });
  run('node', ['scripts/outreach.mjs', 'validate', `--week=${week}`], true);

  // 6. Scheduling after validation should produce exactly 125 messages, max five initial touches per local date,
  // preserve preferred time, and skip recipient holidays while keeping 3 recipient business days between touches.
  run('node', ['scripts/outreach-schedule.mjs', `--week=${week}`], true);
  const manifest = JSON.parse(await readFile(path.join(campaignDir, '07-send-manifest.json'), 'utf8'));
  check(manifest.message_count === 125, `schedule should generate 125 messages; got ${manifest.message_count}`);
  const initialMessages = manifest.messages.filter((m) => m.touch_number === 1);
  const byDate = new Map();
  for (const m of initialMessages) byDate.set(m.scheduled_local_date, (byDate.get(m.scheduled_local_date) ?? 0) + 1);
  check([...byDate.values()].every((count) => count <= 5), `no local date should receive more than five new prospects; distribution was ${JSON.stringify(Object.fromEntries(byDate))}`);

  const first = manifest.messages.filter((m) => m.domain === qualified[0].domain);
  check(first[0].scheduled_local_date !== week, 'recipient holiday on the nominal initial date should move the initial email to the next working date');
  check(first.every((m) => m.scheduled_local_time === '09:35'), 'preferred recipient-local send time should be preserved across the sequence');

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
  for (let i = 1; i < first.length; i += 1) {
    check(businessDayDistance(first[i - 1].scheduled_local_date, first[i].scheduled_local_date, [week]) === 3, `touch ${i + 1} should be exactly three recipient business days after touch ${i}`);
  }

  if (failures.length) {
    console.error(`Outreach system test failed with ${failures.length} defect(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log('Outreach system adversarial test passed.');
} finally {
  await rm(campaignDir, { recursive: true, force: true });
  await rm(tempDir, { recursive: true, force: true });
}
