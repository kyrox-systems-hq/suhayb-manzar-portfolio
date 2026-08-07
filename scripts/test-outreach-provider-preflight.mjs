import { mkdir, writeFile, readFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const week = '2099-01-12';
const campaignDir = path.join(root, 'outreach', 'campaigns', week);
const tempDir = await mkdtemp(path.join(tmpdir(), 'provider-preflight-test-'));
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function runProvider(configFile, expectedSuccess = true) {
  const result = await new Promise((resolve) => {
    const child = spawn('node', ['scripts/outreach-provider-preflight.mjs', `--week=${week}`, `--config=${configFile}`], {
      cwd: root,
      env: { ...process.env, OUTREACH_TEST_MODE: '1' },
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
  if (ok !== expectedSuccess) failures.push(`provider preflight ${expectedSuccess ? 'should pass' : 'should fail'} but exited ${result.status}.\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
  return result;
}

function validProvider() {
  return {
    schema_version: 1,
    provider_name: 'Synthetic Reply-Aware Provider',
    sender_mailbox: 'sender@example.com',
    sender_display_name: 'Suhayb Manzar',
    physical_postal_address: '1 Test Street, Test City',
    unsubscribe_mode: 'provider-native unsubscribe',
    credential_env_var: 'SYNTHETIC_PROVIDER_API_KEY',
    capabilities: {
      per_prospect_custom_content: true,
      recipient_timezone_scheduling: true,
      same_thread_followups: true,
      reply_detection: true,
      stop_on_reply: true,
      bounce_detection: true,
      stop_on_bounce: true,
      opt_out_detection: true,
      stop_on_opt_out: true,
      manual_pause: true,
      idempotent_import_or_send: true,
      delivery_status_export: true
    },
    integration_test: {
      test_recipient: 'internal-test@example.com',
      tested_at: new Date().toISOString(),
      initial_send_verified: true,
      same_thread_verified: true,
      reply_stop_verified: true,
      bounce_stop_verified: true,
      opt_out_stop_verified: true,
      sent_history_verified: true
    }
  };
}

try {
  await rm(campaignDir, { recursive: true, force: true });
  await mkdir(campaignDir, { recursive: true });
  const now = new Date().toISOString();
  const qualified = Array.from({ length: 25 }, (_, i) => ({
    business_name: `Provider Test ${i}`,
    domain: `provider-test-${i}.example`,
    live_site_checked_at: now,
    contact_email_verified_at: now
  }));
  const messages = [];
  for (let i = 0; i < 25; i += 1) {
    const sequenceKey = hash(`sequence-${i}`);
    for (let touch = 1; touch <= 5; touch += 1) {
      messages.push({
        sequence_key: sequenceKey,
        message_key: hash(`sequence-${i}-touch-${touch}`),
        domain: `provider-test-${i}.example`,
        recipient_email: `owner${i}@provider-test-${i}.example`,
        touch_number: touch,
        thread_mode: 'same_thread',
        send_status: 'planned',
        stop_on: ['reply', 'bounce', 'opt_out', 'manual_conversation']
      });
    }
  }

  const manifest = {
    schema_version: 6,
    campaign_week: week,
    generated_at: now,
    production_ready_manifest: false,
    production_source_eligible: false,
    source_preflight_verified: true,
    preflight_verified: true,
    idempotency_keys_verified: true,
    message_count: 125,
    prospects: 25,
    messages
  };
  await writeJson(path.join(campaignDir, '01-discovered.json'), {
    generated_at: now,
    production_eligible: false,
    source_provenance: { type: 'BuiltWith export', live_api: false }
  });
  await writeJson(path.join(campaignDir, '02-qualified.json'), { prospects: qualified });
  await writeJson(path.join(campaignDir, 'source-preflight.json'), { passed: true });
  await writeJson(path.join(campaignDir, 'preflight.json'), { passed: true });
  await writeJson(path.join(campaignDir, '07-send-manifest.json'), manifest);

  const configFile = path.join(tempDir, 'provider.json');
  await writeJson(configFile, validProvider());
  await runProvider(configFile, true);
  check(await readFile(path.join(campaignDir, '08-provider-preflight.json'), 'utf8').then(Boolean), 'provider preflight report should be written');

  const missingCapability = validProvider();
  missingCapability.capabilities.stop_on_reply = false;
  await writeJson(configFile, missingCapability);
  await runProvider(configFile, false);

  const staleIntegration = validProvider();
  staleIntegration.integration_test.tested_at = new Date(Date.now() - 31 * 86400000).toISOString();
  await writeJson(configFile, staleIntegration);
  await runProvider(configFile, false);

  await writeJson(configFile, validProvider());
  const badManifest = structuredClone(manifest);
  badManifest.messages[0].stop_on = ['bounce', 'opt_out', 'manual_conversation'];
  await writeJson(path.join(campaignDir, '07-send-manifest.json'), badManifest);
  await runProvider(configFile, false);

  const duplicateKeyManifest = structuredClone(manifest);
  duplicateKeyManifest.messages[1].message_key = duplicateKeyManifest.messages[0].message_key;
  await writeJson(path.join(campaignDir, '07-send-manifest.json'), duplicateKeyManifest);
  await runProvider(configFile, false);

  if (failures.length) {
    console.error(`Provider preflight regression failed with ${failures.length} issue(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('Provider preflight regression passed.');
  }
} finally {
  await rm(campaignDir, { recursive: true, force: true });
  await rm(tempDir, { recursive: true, force: true });
}
