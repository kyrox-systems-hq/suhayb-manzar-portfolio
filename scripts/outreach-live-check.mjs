import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const cwd = process.cwd();

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

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseWeek(argv) {
  const raw = argv.find((value) => value.startsWith('--week='))?.slice(7);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw ?? '')) fail('Provide --week=YYYY-MM-DD using the Monday campaign start date.');
  const date = new Date(`${raw}T12:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.getUTCDay() !== 1) fail(`Campaign week must be a Monday. Received ${raw}.`);
  return raw;
}

function normalizeDomain(value) {
  if (!value) return '';
  let text = String(value).trim().toLowerCase();
  text = text.replace(/^https?:\/\//, '').replace(/^www\./, '');
  return text.split('/')[0].split('?')[0].split('#')[0].replace(/\.$/, '');
}

function domainFromUrl(value) {
  try {
    return normalizeDomain(new URL(value).hostname);
  } catch {
    return '';
  }
}

function buildLedgerDomains(ledger) {
  return new Set((ledger.entries ?? []).map((entry) => normalizeDomain(entry.domain)).filter(Boolean));
}

function requestUrlFor(prospect) {
  if (process.env.OUTREACH_TEST_MODE === '1' && prospect.test_url_override) return prospect.test_url_override;
  return `https://${normalizeDomain(prospect.domain)}/`;
}

async function fetchOnce(url, config) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(config.liveness.timeout_ms ?? 12000));
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'cache-control': config.liveness.request_cache_control ?? 'no-cache',
        pragma: config.liveness.request_pragma ?? 'no-cache',
        'user-agent': 'Mozilla/5.0 (compatible; SuhaybManzarOutreachResearch/1.0)'
      }
    });

    const finalUrl = response.url || url;
    const result = {
      checked_at: checkedAt,
      requested_url: url,
      final_url: finalUrl,
      final_domain: domainFromUrl(finalUrl),
      http_status: response.status,
      content_type: response.headers.get('content-type'),
      response_date: response.headers.get('date'),
      response_cache_control: response.headers.get('cache-control'),
      response_age_seconds: response.headers.get('age') != null && Number.isFinite(Number(response.headers.get('age'))) ? Number(response.headers.get('age')) : null,
      no_cache_requested: true,
      network_error: null
    };
    try {
      await response.body?.cancel();
    } catch {
      // The headers and final URL are enough for the liveness gate.
    }
    return result;
  } catch (error) {
    return {
      checked_at: checkedAt,
      requested_url: url,
      final_url: null,
      final_domain: null,
      http_status: null,
      content_type: null,
      response_date: null,
      response_cache_control: null,
      response_age_seconds: null,
      no_cache_requested: true,
      network_error: error?.name === 'AbortError' ? 'timeout' : String(error?.message ?? error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function classify(check, config) {
  const status = Number(check.http_status);
  if (Number.isFinite(status) && status >= Number(config.liveness.accepted_status_min ?? 200) && status <= Number(config.liveness.accepted_status_max ?? 399)) {
    return 'live';
  }
  if ((config.liveness.manual_recheck_statuses ?? [401, 403, 429]).includes(status)) return 'blocked_needs_browser_recheck';
  if (check.network_error === 'timeout') return 'timeout_needs_browser_recheck';
  if (check.network_error) return 'network_error_needs_browser_recheck';
  return 'failed_status';
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const week = parseWeek(process.argv.slice(2));
const config = await readJson(path.join(cwd, 'outreach', 'config.json'));
const dir = path.join(cwd, 'outreach', 'campaigns', week);
const discoveryFile = path.join(dir, '01-discovered.json');
if (!(await exists(discoveryFile))) fail('01-discovered.json is missing. Run outreach:discover first.');

const discovery = await readJson(discoveryFile);
const prospects = discovery.prospects ?? [];
if (prospects.length < config.campaign.qualified_target) fail(`Discovery contains only ${prospects.length} prospects. At least ${config.campaign.qualified_target} are required.`);

const ledger = await readJson(path.join(cwd, 'public', 'mockups', '_outreach-ledger.json'));
const excludedDomains = buildLedgerDomains(ledger);

const checked = await mapLimit(prospects, 8, async (prospect) => {
  const primary = await fetchOnce(requestUrlFor(prospect), config);
  let check = primary;
  if (primary.network_error && process.env.OUTREACH_TEST_MODE !== '1') {
    const fallbackUrl = `http://${normalizeDomain(prospect.domain)}/`;
    check = await fetchOnce(fallbackUrl, config);
    check.https_attempt = primary;
  }
  return {
    ...prospect,
    live_check: check,
    live_check_status: classify(check, config)
  };
});

const seenFinalDomains = new Set();
for (const prospect of checked) {
  const originalDomain = normalizeDomain(prospect.domain);
  const finalDomain = normalizeDomain(prospect.live_check?.final_domain) || originalDomain;
  prospect.redirected_domain = finalDomain !== originalDomain ? finalDomain : null;
  prospect.redirect_duplicate = false;
  prospect.redirect_duplicate_reason = null;

  if (finalDomain !== originalDomain && excludedDomains.has(finalDomain)) {
    prospect.redirect_duplicate = true;
    prospect.redirect_duplicate_reason = 'redirects_to_permanently_excluded_domain';
  } else if (seenFinalDomains.has(finalDomain)) {
    prospect.redirect_duplicate = true;
    prospect.redirect_duplicate_reason = 'same_final_storefront_as_earlier_candidate';
  } else {
    seenFinalDomains.add(finalDomain);
  }
}

const qualificationCandidates = checked.filter((prospect) => {
  if (prospect.redirect_duplicate) return false;
  return ['live', 'blocked_needs_browser_recheck', 'timeout_needs_browser_recheck', 'network_error_needs_browser_recheck'].includes(prospect.live_check_status);
});

if (qualificationCandidates.length < Number(config.liveness.min_viable_for_qualification ?? config.campaign.qualified_target)) {
  fail(`Only ${qualificationCandidates.length} candidates remain after live-domain checks. At least ${config.liveness.min_viable_for_qualification ?? config.campaign.qualified_target} are required before qualification.`);
}

const outputFile = path.join(dir, '01-live-checked.json');
await writeJson(outputFile, {
  schema_version: 1,
  campaign_week: week,
  generated_at: new Date().toISOString(),
  discovery_retrieval_run_id: discovery.retrieval_run_id ?? null,
  checked_count: checked.length,
  qualification_candidate_count: qualificationCandidates.length,
  live_count: checked.filter((prospect) => prospect.live_check_status === 'live' && !prospect.redirect_duplicate).length,
  browser_recheck_count: checked.filter((prospect) => prospect.live_check_status.includes('recheck') && !prospect.redirect_duplicate).length,
  duplicate_redirect_count: checked.filter((prospect) => prospect.redirect_duplicate).length,
  failed_count: checked.filter((prospect) => prospect.live_check_status === 'failed_status').length,
  qualification_candidates: qualificationCandidates,
  all_checks: checked
});

console.log(`Live-checked ${checked.length} discovered prospects; ${qualificationCandidates.length} remain eligible for Stage 2 review.`);
