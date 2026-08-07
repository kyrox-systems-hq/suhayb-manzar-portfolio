import { mkdir, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const week = '2099-01-12';
const campaignDir = path.join(root, 'outreach', 'campaigns', week);
const manifestFile = path.join(campaignDir, '07-send-manifest.json');
const failures = [];

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function run(expectedSuccess = true) {
  const result = await new Promise((resolve) => {
    const child = spawn('node', ['scripts/outreach-provider-time-guard.mjs', `--week=${week}`], {
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
  if (ok !== expectedSuccess) failures.push(`provider timing guard ${expectedSuccess ? 'should pass' : 'should fail'} but exited ${result.status}.\n${result.stdout}\n${result.stderr}`);
}

function message(date, time = '09:30', zone = 'America/New_York') {
  return {
    domain: 'timing-provider.example',
    recipient_email: 'owner@timing-provider.example',
    touch_number: 1,
    scheduled_local_date: date,
    scheduled_local_time: time,
    scheduled_timezone: zone,
    send_status: 'planned'
  };
}

try {
  await rm(campaignDir, { recursive: true, force: true });
  await mkdir(campaignDir, { recursive: true });

  await writeJson(manifestFile, { messages: [message('2099-01-12')] });
  await run(true);

  await writeJson(manifestFile, { messages: [message('2000-01-03')] });
  await run(false);

  await writeJson(manifestFile, { messages: [message('2099-01-12', '25:00')] });
  await run(false);

  await writeJson(manifestFile, { messages: [message('2099-01-12', '09:30', 'Not/A_Real_Zone')] });
  await run(false);

  if (failures.length) {
    console.error(`Provider timing regression failed with ${failures.length} issue(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('Provider timing regression passed.');
  }
} finally {
  await rm(campaignDir, { recursive: true, force: true });
}
