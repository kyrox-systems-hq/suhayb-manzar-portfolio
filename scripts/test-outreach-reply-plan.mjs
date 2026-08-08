import { mkdir, writeFile, readFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const week = '2099-01-05';
const campaignDir = path.join(root, 'outreach', 'campaigns', week);
const tempDir = await mkdtemp(path.join(tmpdir(), 'reply-plan-test-'));
const failures = [];

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function runPlan(configFile, expectedSuccess = true) {
  const result = await new Promise((resolve) => {
    const child = spawn('node', ['scripts/outreach-reply-plan.mjs', `--week=${week}`, `--config=${configFile}`], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
  const ok = result.status === 0;
  if (ok !== expectedSuccess) failures.push(`Reply plan ${expectedSuccess ? 'should pass' : 'should fail'} but exited ${result.status}.\n${result.stdout}\n${result.stderr}`);
  return result;
}

function makeManifest() {
  const messages = [];
  const dates = ['2099-01-05', '2099-01-08', '2099-01-13', '2099-01-16', '2099-01-21'];
  for (let i = 0; i < 25; i += 1) {
    const sequenceKey = hash(`reply-sequence-${i}`);
    const subject = `Focused product-page concept ${i}`;
    for (let touch = 1; touch <= 5; touch += 1) {
      messages.push({
        campaign_week: week,
        sequence_key: sequenceKey,
        message_key: hash(`reply-sequence-${i}-touch-${touch}`),
        business_name: `Reply Test ${i}`,
        domain: `reply-test-${i}.example`,
        recipient_name: `Owner ${i}`,
        recipient_role: 'Founder',
        recipient_email: `owner${i}@reply-test-${i}.example`,
        recipient_timezone: 'America/New_York',
        country: 'US',
        touch_number: touch,
        subject: touch === 1 ? subject : null,
        body_text: `Touch ${touch} personalised body for Reply Test ${i}.`,
        purpose: `Purpose ${touch}`,
        evidence_used: [`site-${touch}`],
        scheduled_local_date: dates[touch - 1],
        scheduled_local_time: i === 0 ? '09:35' : '09:30',
        scheduled_timezone: 'America/New_York',
        non_working_dates_applied: [],
        thread_mode: 'same_thread',
        stop_on: ['reply', 'bounce', 'opt_out', 'manual_conversation'],
        compliance_status: 'eligible',
        compliance_basis: 'Synthetic test',
        live_mockup_url: `https://example.com/mockups/${i}/`,
        send_status: 'planned'
      });
    }
  }
  return {
    schema_version: 6,
    campaign_week: week,
    generated_at: new Date().toISOString(),
    production_ready_manifest: false,
    production_source_eligible: false,
    idempotency_keys_verified: true,
    message_count: 125,
    prospects: 25,
    messages
  };
}

try {
  await rm(campaignDir, { recursive: true, force: true });
  await mkdir(campaignDir, { recursive: true });
  await writeJson(path.join(campaignDir, '07-send-manifest.json'), makeManifest());

  const configFile = path.join(tempDir, 'reply-config.json');
  await writeJson(configFile, {
    schema_version: 1,
    provider: 'Reply.io',
    api_base: 'https://api.reply.io/v3',
    credential_env_var: 'REPLY_API_KEY',
    email_account_id: 101,
    schedule_id: 202,
    sender_mailbox: 'sender@example.com',
    sequence_name_prefix: 'Test Web Outreach',
    settings: {
      emails_count_per_day: 5,
      days_to_finish_prospect: 30,
      email_sending_delay_seconds: 60,
      daily_throttling: 5,
      disable_opens_tracking: true,
      enable_links_tracking: false,
      replies_handling_type: 'MarkAsFinished'
    }
  });

  await runPlan(configFile, true);
  const plan = JSON.parse(await readFile(path.join(campaignDir, 'reply-io-plan.json'), 'utf8'));
  check(plan.dry_run_only === true, 'Reply plan must remain dry-run only');
  check(plan.production_load_allowed === false, 'test manifest should not be production-loadable');
  check(plan.sequence_count === 25, `expected 25 Reply sequences, got ${plan.sequence_count}`);
  check(plan.contact_count === 25, `expected 25 Reply contacts, got ${plan.contact_count}`);
  check(plan.email_step_count === 125, `expected 125 Reply email steps, got ${plan.email_step_count}`);

  const first = plan.operations[0];
  check(first.create_sequence.body.scheduleId === 202, 'Reply sequence should use configured schedule ID');
  check(first.create_sequence.body.emailAccounts.length === 1 && first.create_sequence.body.emailAccounts[0] === 101, 'Reply sequence should use configured sender account');
  check(first.create_sequence.body.settings.repliesHandlingType === 'MarkAsFinished', 'Reply sequence should finish on reply');
  check(first.create_sequence.body.steps.length === 5, 'each Reply sequence should contain five email steps');
  check(first.expected_local_schedule[0].utc_instant === '2099-01-05T14:35:00.000Z', `09:35 New York should resolve to 14:35Z in January 2099, got ${first.expected_local_schedule[0].utc_instant}`);
  check(first.expected_local_schedule.map((item) => item.delay_from_previous_minutes).join(',') === '0,4320,7200,4320,7200', `unexpected Reply delay plan: ${first.expected_local_schedule.map((item) => item.delay_from_previous_minutes).join(',')}`);
  check(first.enrol_contact_after_ids_resolve.body_template.startFrom === '2099-01-05T14:35:00.000Z', 'Reply enrolment should start from the exact first UTC instant');
  check(first.post_enrolment_verification.require.nextSendAfter_matches_first_utc_instant === '2099-01-05T14:35:00.000Z', 'Reply verification should require nextSendAfter to match the intended start');
  check(first.create_contact.body.timeZone === 'America/New_York', 'Reply contact should retain recipient timezone');

  const badConfig = JSON.parse(await readFile(configFile, 'utf8'));
  badConfig.schedule_id = null;
  await writeJson(configFile, badConfig);
  await runPlan(configFile, false);

  if (failures.length) {
    console.error(`Reply plan regression failed with ${failures.length} issue(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('Reply.io dry-run plan regression passed.');
  }
} finally {
  await rm(campaignDir, { recursive: true, force: true });
  await rm(tempDir, { recursive: true, force: true });
}
