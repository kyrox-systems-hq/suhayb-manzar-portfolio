'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const REPO = 'kyrox-systems-hq/suhayb-manzar-portfolio';
const BRANCH = 'agent/weekly-outreach-system';
const PROJECT_ID = 'suhayb-manzar-portfolio';
const HOSTING_ROOT = 'https://suhayb-manzar-portfolio.web.app';

const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
const ROOT = path.join(localAppData, 'Kyrox', 'outreach-deployer');
const REPO_DIR = path.join(ROOT, 'repo');
const FIREBASE_DIR = path.join(ROOT, 'firebase-cli');
const FIREBASE_CMD = path.join(FIREBASE_DIR, 'node_modules', '.bin', 'firebase.cmd');
const WATCHER = path.join(ROOT, 'Watch-OutreachDeploy.js');
const WATCHER_SOURCE = path.join(REPO_DIR, 'scripts', 'outreach-deployer', 'Watch-OutreachDeploy.js');
const STATE_FILE = path.join(ROOT, 'last-deployed-marker.txt');
const STOP_FILE = path.join(ROOT, 'STOP');
const LOG_FILE = path.join(ROOT, 'final-repair.log');
const STARTUP_VBS = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'Kyrox-Outreach-AutoDeploy.vbs');

const MARKER_REL = 'public/mockups/.deploy-ready';
const PROOF_REL = 'public/mockups/_system/auto-deploy-proof.txt';
const PROOF_URL = `${HOSTING_ROOT}/mockups/_system/auto-deploy-proof.txt`;
const OLD_TASK = 'Kyrox Outreach Auto Deploy';

let stage = 'startup';

function log(message) {
  fs.mkdirSync(ROOT, { recursive: true });
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} [${stage}] ${message}\r\n`, 'utf8');
}

function run(file, args, options = {}) {
  const result = spawnSync(file, args, {
    cwd: options.cwd,
    encoding: options.inherit ? undefined : 'utf8',
    windowsHide: true,
    shell: Boolean(options.shell),
    stdio: options.inherit ? 'inherit' : undefined,
    env: process.env,
  });

  return {
    code: typeof result.status === 'number' ? result.status : 1,
    output: options.inherit ? '' : `${result.stdout || ''}${result.stderr || ''}`.trim(),
    error: result.error,
  };
}

function mustRun(file, args, options = {}) {
  const result = run(file, args, options);
  if (result.error || result.code !== 0) {
    throw new Error(`${file} ${args.join(' ')} failed: ${result.error ? result.error.message : result.output}`);
  }
  return result.output;
}

function mustRunCmd(file, args, options = {}) {
  return mustRun(file, args, { ...options, shell: true });
}

function removeOldAutomation() {
  run('schtasks.exe', ['/Delete', '/TN', OLD_TASK, '/F']);
  try { fs.rmSync(STARTUP_VBS, { force: true }); } catch {}
  try { fs.writeFileSync(STOP_FILE, 'stop\r\n', 'utf8'); } catch {}
}

function cleanRoot() {
  removeOldAutomation();
  try { fs.rmSync(ROOT, { recursive: true, force: true }); } catch (error) {
    throw new Error(`Could not remove the old deployment folder: ${error.message}`);
  }
  fs.mkdirSync(ROOT, { recursive: true });
}

function ghJson(args) {
  const output = mustRun('gh', args);
  return JSON.parse(output);
}

function getRemoteFile(relPath) {
  const branchEncoded = encodeURIComponent(BRANCH);
  const result = run('gh', ['api', `repos/${REPO}/contents/${relPath}?ref=${branchEncoded}`]);
  if (result.code !== 0) return null;
  return JSON.parse(result.output);
}

function putRemoteFile(relPath, content, message) {
  const existing = getRemoteFile(relPath);
  const args = [
    'api', `repos/${REPO}/contents/${relPath}`,
    '--method', 'PUT',
    '-f', `message=${message}`,
    '-f', `content=${Buffer.from(content, 'utf8').toString('base64')}`,
    '-f', `branch=${BRANCH}`,
  ];
  if (existing && existing.sha) args.push('-f', `sha=${existing.sha}`);
  return ghJson(args);
}

function deleteRemoteFile(relPath, message) {
  const existing = getRemoteFile(relPath);
  if (!existing || !existing.sha) return;
  mustRun('gh', [
    'api', `repos/${REPO}/contents/${relPath}`,
    '--method', 'DELETE',
    '-f', `message=${message}`,
    '-f', `sha=${existing.sha}`,
    '-f', `branch=${BRANCH}`,
  ]);
}

function vbsQuote(value) {
  return String(value).replace(/"/g, '""');
}

function installStartupWatcher() {
  const nodeExe = process.execPath;
  const vbs = [
    'Set sh = CreateObject("WScript.Shell")',
    `sh.Run Chr(34) & "${vbsQuote(nodeExe)}" & Chr(34) & " " & Chr(34) & "${vbsQuote(WATCHER)}" & Chr(34), 0, False`,
    '',
  ].join('\r\n');
  fs.mkdirSync(path.dirname(STARTUP_VBS), { recursive: true });
  fs.writeFileSync(STARTUP_VBS, vbs, 'utf8');
  mustRun('wscript.exe', [STARTUP_VBS]);
}

function waitForState(expectedSha, timeoutMs = 240_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const actual = fs.readFileSync(STATE_FILE, 'utf8').trim();
      if (actual === expectedSha) return true;
    } catch {}
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
  }
  return false;
}

async function waitForLiveProof(proofId, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${PROOF_URL}?proof=${encodeURIComponent(proofId)}&t=${Date.now()}`, {
        headers: { 'cache-control': 'no-cache' },
      });
      if (response.ok) {
        const body = (await response.text()).trim();
        const robots = response.headers.get('x-robots-tag') || '';
        if (body === proofId.trim() && /noindex/i.test(robots)) return true;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  return false;
}

async function waitForProofRemoval(cleanupId, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${PROOF_URL}?cleanup=${encodeURIComponent(cleanupId)}&t=${Date.now()}`, {
        headers: { 'cache-control': 'no-cache' },
      });
      if (response.status === 404) return true;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  return false;
}

async function verifyExistingLiveSite() {
  const url = `${HOSTING_ROOT}/mockups/thespinedlife/?manual=${Date.now()}`;
  const response = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
  if (!response.ok) throw new Error(`Live TheSpinedLife route returned HTTP ${response.status}.`);
  const body = await response.text();
  if (!body.includes('TheSpinedLife')) throw new Error('Live TheSpinedLife page content was not found.');
  const robots = response.headers.get('x-robots-tag') || '';
  if (!/noindex/i.test(robots)) throw new Error('Live TheSpinedLife route is missing X-Robots-Tag noindex.');
}

async function main() {
  console.log('');
  console.log('Kyrox Outreach Auto Deploy - final Node repair');
  console.log('------------------------------------------------');
  console.log('');

  stage = 'clean_reset';
  console.log('[1/8] Removing previous deployment automation...');
  cleanRoot();
  log('Clean reset complete.');

  stage = 'github_access';
  console.log('[2/8] Validating GitHub access...');
  mustRun('gh', ['repo', 'view', REPO, '--json', 'nameWithOwner']);
  mustRun('gh', ['auth', 'setup-git', '--hostname', 'github.com']);

  stage = 'clone';
  console.log('[3/8] Creating a clean local checkout...');
  mustRun('gh', ['repo', 'clone', REPO, REPO_DIR, '--', '--branch', BRANCH, '--single-branch']);
  if (!fs.existsSync(WATCHER_SOURCE)) throw new Error(`Watcher source is missing: ${WATCHER_SOURCE}`);
  if (!fs.existsSync(path.join(REPO_DIR, 'firebase.json'))) throw new Error('firebase.json is missing.');
  if (!fs.existsSync(path.join(REPO_DIR, '.firebaserc'))) throw new Error('.firebaserc is missing.');

  stage = 'firebase_cli';
  console.log('[4/8] Installing and validating Firebase CLI...');
  fs.mkdirSync(FIREBASE_DIR, { recursive: true });
  mustRunCmd('npm.cmd', ['install', '--prefix', FIREBASE_DIR, 'firebase-tools@latest', '--no-audit', '--no-fund', '--loglevel=error']);
  if (!fs.existsSync(FIREBASE_CMD)) throw new Error(`Firebase CLI was not created: ${FIREBASE_CMD}`);
  mustRunCmd(FIREBASE_CMD, ['--version']);

  stage = 'firebase_auth';
  console.log('[5/8] Validating Firebase project access...');
  let projects = run(FIREBASE_CMD, ['projects:list', '--json'], { shell: true });
  if (projects.code !== 0 || !projects.output.includes(PROJECT_ID)) {
    console.log('Firebase needs one browser sign-in.');
    const login = run(FIREBASE_CMD, ['login', '--reauth'], { shell: true, inherit: true });
    if (login.code !== 0) throw new Error('Firebase browser sign-in failed.');
    projects = run(FIREBASE_CMD, ['projects:list', '--json'], { shell: true });
    if (projects.code !== 0 || !projects.output.includes(PROJECT_ID)) {
      throw new Error(`Firebase login cannot access ${PROJECT_ID}.`);
    }
  }

  stage = 'manual_deploy';
  console.log('[6/8] Proving direct Firebase deployment first...');
  mustRunCmd(FIREBASE_CMD, ['deploy', '--only', 'hosting', '--project', PROJECT_ID, '--non-interactive'], { cwd: REPO_DIR });
  await verifyExistingLiveSite();

  stage = 'install_watcher';
  console.log('[7/8] Installing the hidden login watcher...');
  fs.copyFileSync(WATCHER_SOURCE, WATCHER);
  try { fs.rmSync(STOP_FILE, { force: true }); } catch {}

  const baseline = getRemoteFile(MARKER_REL);
  if (!baseline || !baseline.sha) throw new Error('Could not read the current deployment marker.');
  fs.writeFileSync(STATE_FILE, `${baseline.sha}\r\n`, 'utf8');
  installStartupWatcher();

  stage = 'self_test';
  console.log('[8/8] Running live marker -> watcher -> Firebase -> cleanup self-test...');
  const proofId = `KYROX_AUTO_DEPLOY_${crypto.randomUUID()}`;
  putRemoteFile(PROOF_REL, `${proofId}\n`, 'Add outreach auto-deploy proof');
  const markerPut = putRemoteFile(
    MARKER_REL,
    `slug=thespinedlife\nselftest=${proofId}\nrequested_at_utc=${new Date().toISOString()}\n`,
    'Trigger outreach auto-deploy proof'
  );
  const markerSha = markerPut && markerPut.content && markerPut.content.sha;
  if (!markerSha) throw new Error('Could not determine the self-test marker SHA.');

  if (!waitForState(markerSha)) throw new Error('The background watcher did not process the proof marker within four minutes.');
  if (!(await waitForLiveProof(proofId))) throw new Error('The unique proof file was not verified live on Firebase.');

  deleteRemoteFile(PROOF_REL, 'Remove outreach auto-deploy proof');
  const cleanupId = crypto.randomUUID();
  const cleanupPut = putRemoteFile(
    MARKER_REL,
    `slug=thespinedlife\ncleanup=${cleanupId}\nrequested_at_utc=${new Date().toISOString()}\n`,
    'Trigger outreach auto-deploy proof cleanup'
  );
  const cleanupSha = cleanupPut && cleanupPut.content && cleanupPut.content.sha;
  if (!cleanupSha) throw new Error('Could not determine the cleanup marker SHA.');

  if (!waitForState(cleanupSha)) throw new Error('The background watcher did not process the cleanup marker within four minutes.');
  if (!(await waitForProofRemoval(cleanupId))) throw new Error('The temporary proof file was not removed from Firebase.');

  stage = 'complete';
  log('FULL END-TO-END VALIDATION PASSED.');
  console.log('');
  console.log('FULL END-TO-END VALIDATION PASSED');
  console.log('GitHub marker -> Node watcher -> branch pull -> Firebase deploy -> live proof -> cleanup all passed.');
}

main().catch(error => {
  try {
    log(`FAILED: ${error && error.stack ? error.stack : error}`);
    fs.writeFileSync(STOP_FILE, 'stop\r\n', 'utf8');
    fs.rmSync(STARTUP_VBS, { force: true });
  } catch {}
  console.error('');
  console.error(`FINAL REPAIR FAILED at stage: ${stage}`);
  console.error(error && error.message ? error.message : String(error));
  console.error(`Log: ${LOG_FILE}`);
  process.exitCode = 1;
});
