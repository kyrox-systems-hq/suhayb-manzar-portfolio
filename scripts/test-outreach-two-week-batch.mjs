import { readFile, writeFile, mkdir, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const week1 = '2099-01-05';
const week2 = '2099-01-12';
const ledgerFile = path.join(root, 'public', 'mockups', '_outreach-ledger.json');
const originalLedger = await readFile(ledgerFile, 'utf8');
const tempDir = await mkdtemp(path.join(tmpdir(), 'two-week-outreach-test-'));
const failures = [];

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function run(command, args, expectedSuccess = true) {
  const result = await new Promise((resolve) => {
    const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
  const ok = result.status === 0;
  if (ok !== expectedSuccess) failures.push(`${command} ${args.join(' ')} ${expectedSuccess ? 'should pass' : 'should fail'} but exited ${result.status}.\n${result.stdout}\n${result.stderr}`);
  return result;
}

function bw(domain, name, index) {
  const now = Math.floor(Date.now() / 1000);
  return {
    D: domain,
    R: 90000 + index,
    E: 10,
    S: 900,
    SKU: 100,
    FD: now - 90 * 86400,
    LD: now - 86400,
    A: 500000,
    META: {
      CompanyName: name,
      Country: 'US',
      City: 'Test City',
      Emails: [`hello${index}@${domain}`]
    }
  };
}

try {
  for (const week of [week1, week2]) await rm(path.join(root, 'outreach', 'campaigns', week), { recursive: true, force: true });

  const week1Domain = 'week-one-business.example';
  await writeJson(path.join(root, 'outreach', 'campaigns', week1, '02-qualified.json'), {
    prospects: [{
      business_name: 'Week One Business',
      domain: week1Domain,
      recipient_name: 'Week One Owner',
      recipient_role: 'Founder',
      contact_email: `owner@${week1Domain}`,
      email_source_url: `https://${week1Domain}/contact`
    }],
    rejected: []
  });

  await run('node', ['scripts/outreach-ledger-sync.mjs', `--week=${week1}`], true);

  const input = {
    technology: 'Shopify',
    Results: [
      bw(week1Domain, 'Week One Business Reappears', 0),
      ...Array.from({ length: 25 }, (_, i) => bw(`week-two-${i}.example`, `Week Two ${i}`, i + 1))
    ]
  };
  const inputFile = path.join(tempDir, 'week2-builtwith.json');
  await writeJson(inputFile, input);
  await run('node', ['scripts/outreach-discover.mjs', `--week=${week2}`, `--input=${inputFile}`], true);

  const discovered = JSON.parse(await readFile(path.join(root, 'outreach', 'campaigns', week2, '01-discovered.json'), 'utf8'));
  if (discovered.prospects.length !== 25) failures.push(`Week 2 should contain exactly 25 non-Week-1 candidates, found ${discovered.prospects.length}`);
  if (discovered.prospects.some((prospect) => prospect.domain === week1Domain)) failures.push('Week 2 discovery reused a Week 1 permanent-ledger domain');
  if (!discovered.prospects.every((prospect) => prospect.domain.startsWith('week-two-'))) failures.push('Week 2 discovery contains an unexpected domain');

  if (failures.length) {
    console.error(`Two-week batching regression failed with ${failures.length} issue(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('Two-week batching and permanent exclusion regression passed.');
  }
} finally {
  await writeFile(ledgerFile, originalLedger, 'utf8');
  for (const week of [week1, week2]) await rm(path.join(root, 'outreach', 'campaigns', week), { recursive: true, force: true });
  await rm(tempDir, { recursive: true, force: true });
}
