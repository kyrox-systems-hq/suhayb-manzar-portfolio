import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const ledgerFile = path.join(root, 'public', 'mockups', '_outreach-ledger.json');
const originalLedger = await readFile(ledgerFile, 'utf8');
const week = '2099-01-12';
const campaignDir = path.join(root, 'outreach', 'campaigns', week);
const qualifiedFile = path.join(campaignDir, '02-qualified.json');
const failures = [];

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function runLedger(expectedSuccess) {
  const result = await new Promise((resolve) => {
    const child = spawn('node', ['scripts/outreach-ledger-sync.mjs', `--week=${week}`], {
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
  if (ok !== expectedSuccess) failures.push(`ledger sync ${expectedSuccess ? 'should pass' : 'should fail'} but exited ${result.status}.\n${result.stdout}\n${result.stderr}`);
  return result;
}

try {
  await rm(campaignDir, { recursive: true, force: true });
  await mkdir(campaignDir, { recursive: true });

  await writeJson(qualifiedFile, {
    prospects: [{
      business_name: 'Fresh Alias For Existing Business',
      domain: 'patchandbagel.com',
      recipient_name: 'Different Contact',
      recipient_role: 'Founder',
      contact_email: 'different-contact@example.com'
    }],
    rejected: []
  });
  const duplicateResult = await runLedger(false);
  if (!duplicateResult.stderr.includes('duplicates permanent ledger by domain')) failures.push('domain duplicate failure did not identify the permanent-ledger collision');

  const unique = {
    business_name: 'Synthetic Current Campaign Business',
    domain: 'synthetic-current-campaign.example',
    recipient_name: 'Synthetic Owner',
    recipient_role: 'Founder',
    contact_email: 'synthetic-owner@synthetic-current-campaign.example',
    email_source_url: 'https://synthetic-current-campaign.example/contact'
  };
  await writeJson(qualifiedFile, { prospects: [unique], rejected: [] });
  await runLedger(true);
  await runLedger(true);

  const ledger = JSON.parse(await readFile(ledgerFile, 'utf8'));
  const matches = ledger.entries.filter((entry) => entry.domain === unique.domain && entry.campaign_week === week);
  if (matches.length !== 1) failures.push(`same-campaign idempotent ledger sync should leave one entry, found ${matches.length}`);

  if (failures.length) {
    console.error(`Ledger duplicate regression failed with ${failures.length} issue(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('Permanent-ledger duplicate and idempotency regression passed.');
  }
} finally {
  await writeFile(ledgerFile, originalLedger, 'utf8');
  await rm(campaignDir, { recursive: true, force: true });
}
