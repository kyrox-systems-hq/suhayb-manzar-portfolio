'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
const ROOT = path.join(localAppData, 'Kyrox', 'outreach-deployer');
const REPO_DIR = path.join(ROOT, 'repo');
const FIREBASE_CMD = path.join(ROOT, 'firebase-cli', 'node_modules', '.bin', 'firebase.cmd');
const STATE_FILE = path.join(ROOT, 'last-deployed-marker.txt');
const STOP_FILE = path.join(ROOT, 'STOP');
const LOG_FILE = path.join(ROOT, 'deploy.log');

const BRANCH = 'agent/weekly-outreach-system';
const PROJECT_ID = 'suhayb-manzar-portfolio';
const HOSTING_ROOT = 'https://suhayb-manzar-portfolio.web.app';
const MARKER_REL = 'public/mockups/.deploy-ready';
const POLL_MS = 30_000;

let busy = false;

function log(message) {
  fs.mkdirSync(ROOT, { recursive: true });
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${message}\r\n`, 'utf8');
}

function run(file, args, options = {}) {
  const result = spawnSync(file, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    windowsHide: true,
    shell: Boolean(options.shell),
    env: process.env,
  });

  return {
    code: typeof result.status === 'number' ? result.status : 1,
    output: `${result.stdout || ''}${result.stderr || ''}`.trim(),
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

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    return '';
  }
}

function markerSlug(markerText) {
  const match = markerText.match(/^slug=(.+)$/m);
  return match ? match[1].trim() : '';
}

async function verifyLive(markerText, markerSha) {
  const slug = markerSlug(markerText);
  const url = slug
    ? `${HOSTING_ROOT}/mockups/${encodeURIComponent(slug)}/?deploy_marker=${encodeURIComponent(markerSha)}`
    : `${HOSTING_ROOT}/?deploy_marker=${encodeURIComponent(markerSha)}`;

  const response = await fetch(url, {
    headers: { 'cache-control': 'no-cache' },
  });

  if (!response.ok) {
    throw new Error(`Live verification returned HTTP ${response.status} for ${url}`);
  }

  if (slug) {
    const robots = response.headers.get('x-robots-tag') || '';
    if (!/noindex/i.test(robots)) {
      throw new Error(`Live mock-up is missing X-Robots-Tag noindex: ${url}`);
    }
  }
}

async function deployIfNeeded() {
  if (busy) return;
  if (fs.existsSync(STOP_FILE)) process.exit(0);
  busy = true;

  try {
    if (!fs.existsSync(REPO_DIR)) throw new Error(`Repository checkout is missing: ${REPO_DIR}`);
    if (!fs.existsSync(FIREBASE_CMD)) throw new Error(`Firebase CLI is missing: ${FIREBASE_CMD}`);

    mustRun('git', ['-C', REPO_DIR, 'fetch', 'origin', BRANCH, '--prune']);

    const remoteRef = `origin/${BRANCH}`;
    const markerSha = mustRun('git', ['-C', REPO_DIR, 'rev-parse', `${remoteRef}:${MARKER_REL}`]).trim();
    const markerText = mustRun('git', ['-C', REPO_DIR, 'show', `${remoteRef}:${MARKER_REL}`]);
    const lastDeployed = readText(STATE_FILE);

    if (markerSha === lastDeployed) return;

    log(`New marker detected: ${markerSha}`);

    mustRun('git', ['-C', REPO_DIR, 'checkout', '-B', BRANCH, remoteRef]);
    mustRun('git', ['-C', REPO_DIR, 'reset', '--hard', remoteRef]);
    mustRun('git', ['-C', REPO_DIR, 'clean', '-fd']);

    const deploy = run(
      FIREBASE_CMD,
      ['deploy', '--only', 'hosting', '--project', PROJECT_ID, '--non-interactive'],
      { cwd: REPO_DIR, shell: true }
    );
    if (deploy.error || deploy.code !== 0) {
      throw new Error(`Firebase Hosting deployment failed: ${deploy.error ? deploy.error.message : deploy.output}`);
    }

    await verifyLive(markerText, markerSha);
    fs.writeFileSync(STATE_FILE, `${markerSha}\r\n`, 'utf8');
    log(`Deployment succeeded: ${markerSha}`);
  } catch (error) {
    log(`ERROR: ${error && error.message ? error.message : String(error)}`);
  } finally {
    busy = false;
  }
}

process.on('uncaughtException', (error) => log(`UNCAUGHT: ${error.stack || error.message || error}`));
process.on('unhandledRejection', (error) => log(`UNHANDLED: ${error && error.stack ? error.stack : error}`));

log('Watcher started.');
deployIfNeeded();
setInterval(deployIfNeeded, POLL_MS);
