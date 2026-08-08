import { mkdir, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const week = '2099-01-12';
const campaignDir = path.join(root, 'outreach', 'campaigns', week);
const standardFile = path.join(campaignDir, '05-email-standard.md');
const sequenceFile = path.join(campaignDir, '06-sequences.json');
const failures = [];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function oldIso(days) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function run(script, expectedSuccess = true) {
  const result = await new Promise((resolve) => {
    const child = spawn('node', [`scripts/${script}`, `--week=${week}`], {
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
  if (ok !== expectedSuccess) failures.push(`${script} ${expectedSuccess ? 'should pass' : 'should fail'} but exited ${result.status}.\n${result.stdout}\n${result.stderr}`);
  return result;
}

function sequences(reviewed = todayIso(), reviewId = 'WEBLEADS-EMAIL-TEST-001') {
  return {
    schema_version: 3,
    campaign_week: week,
    email_standard_reviewed: reviewed,
    email_standard_review_id: reviewId,
    sequences: Array.from({ length: 25 }, (_, i) => ({
      business_name: `Timing Test ${i}`,
      domain: `timing-test-${i}.example`,
      recipient_timezone: 'America/New_York',
      preferred_local_send_time: i === 0 ? '09:35' : undefined,
      non_working_dates: i === 0 ? ['2099-01-19'] : []
    }))
  };
}

function standard(reviewed = todayIso(), reviewId = 'WEBLEADS-EMAIL-TEST-001') {
  return `Reviewed: ${reviewed}\nReview-ID: ${reviewId}\n\n# Campaign Email Standard\n\nCurrent theory review for synthetic timing tests.\n`;
}

try {
  await rm(campaignDir, { recursive: true, force: true });
  await mkdir(campaignDir, { recursive: true });

  const reviewed = todayIso();
  const reviewId = 'WEBLEADS-EMAIL-TEST-001';
  await writeFile(standardFile, standard(reviewed, reviewId), 'utf8');
  await new Promise((resolve) => setTimeout(resolve, 20));
  await writeJson(sequenceFile, sequences(reviewed, reviewId));
  await run('outreach-theory-guard.mjs', true);
  await run('outreach-timing-guard.mjs', true);

  const stale = oldIso(9);
  await writeFile(standardFile, standard(stale, 'WEBLEADS-EMAIL-STALE-001'), 'utf8');
  await new Promise((resolve) => setTimeout(resolve, 20));
  await writeJson(sequenceFile, sequences(stale, 'WEBLEADS-EMAIL-STALE-001'));
  await run('outreach-theory-guard.mjs', false);

  await writeFile(standardFile, standard(reviewed, reviewId), 'utf8');
  await new Promise((resolve) => setTimeout(resolve, 20));
  await writeJson(sequenceFile, sequences(reviewed, 'WEBLEADS-EMAIL-WRONG-001'));
  await run('outreach-theory-guard.mjs', false);

  await writeFile(standardFile, standard(reviewed, reviewId), 'utf8');
  await new Promise((resolve) => setTimeout(resolve, 20));
  const invalidTime = sequences(reviewed, reviewId);
  invalidTime.sequences[0].preferred_local_send_time = '25:90';
  await writeJson(sequenceFile, invalidTime);
  await run('outreach-timing-guard.mjs', false);

  const duplicateHoliday = sequences(reviewed, reviewId);
  duplicateHoliday.sequences[0].non_working_dates = ['2099-01-19', '2099-01-19'];
  await writeJson(sequenceFile, duplicateHoliday);
  await run('outreach-timing-guard.mjs', false);

  if (failures.length) {
    console.error(`Theory/timing regression failed with ${failures.length} issue(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('Theory freshness and recipient timing regression passed.');
  }
} finally {
  await rm(campaignDir, { recursive: true, force: true });
}
