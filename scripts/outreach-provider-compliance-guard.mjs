import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (!item.startsWith('--')) continue;
    const [key, ...parts] = item.slice(2).split('=');
    args[key] = parts.length ? parts.join('=') : true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.config) fail('Provide --config=/path/to/provider-readiness.json.');
const providerFile = path.resolve(args.config);
if (!(await exists(providerFile))) fail(`Provider config not found: ${providerFile}`);
const provider = JSON.parse(await readFile(providerFile, 'utf8'));
const issues = [];

for (const capability of ['physical_address_footer', 'unsubscribe_mechanism']) {
  if (provider.capabilities?.[capability] !== true) issues.push(`provider capability not verified: ${capability}`);
}
for (const check of ['physical_address_verified', 'unsubscribe_verified']) {
  if (provider.integration_test?.[check] !== true) issues.push(`provider integration test has not verified ${check}`);
}

if (issues.length) {
  console.error(`Provider compliance-delivery guard failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log('Provider compliance-delivery guard passed.');
