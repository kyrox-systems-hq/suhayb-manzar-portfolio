import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const expectedOrigin = 'https://suhayb-manzar-portfolio.suhayb-manzar1.workers.dev';
const htmlFiles = [
  'index.html',
  '404.html',
  'work/daily-crossword-unlimited/index.html',
  'work/drasteon/index.html'
];
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}=(["'])(.*?)\\1`, 'i'))?.[2] ?? '';
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function verifyHtml(relativePath) {
  const absolutePath = path.join(publicDir, relativePath);
  const html = await readFile(absolutePath, 'utf8');
  const is404 = relativePath === '404.html';

  check(/<!doctype html>/i.test(html), `${relativePath}: missing HTML doctype`);
  check(/<html\b[^>]*\blang=["']en-GB["']/i.test(html), `${relativePath}: missing en-GB language`);
  check(/<meta\b[^>]*name=["']viewport["']/i.test(html), `${relativePath}: missing viewport metadata`);
  check((html.match(/<h1\b/gi) ?? []).length === 1, `${relativePath}: must contain exactly one h1`);
  check(/<main\b/i.test(html), `${relativePath}: missing main landmark`);
  check(!html.includes('\uFFFD'), `${relativePath}: contains a Unicode replacement character`);
  check(!/suhayb\.manzar1@gmail\.com/i.test(html), `${relativePath}: contains the retired contact address`);
  check(!/\sstyle=(["'])/i.test(html), `${relativePath}: contains inline styles blocked by the production CSP`);

  if (!is404) {
    check(/<meta\b[^>]*name=["']description["']/i.test(html), `${relativePath}: missing meta description`);
    check(/<link\b[^>]*rel=["']canonical["']/i.test(html), `${relativePath}: missing canonical URL`);
    check(/<meta\b[^>]*property=["']og:title["']/i.test(html), `${relativePath}: missing Open Graph title`);
    check(/<meta\b[^>]*property=["']og:image["']/i.test(html), `${relativePath}: missing Open Graph image`);
    check(/<meta\b[^>]*name=["']twitter:card["']/i.test(html), `${relativePath}: missing Twitter card metadata`);
  } else {
    check(/<meta\b[^>]*name=["']robots["'][^>]*content=["']noindex["']/i.test(html), '404.html: missing noindex');
  }

  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const tag = match[0];
    const href = attribute(tag, 'href');
    if (attribute(tag, 'target') === '_blank') {
      const rel = attribute(tag, 'rel').split(/\s+/);
      check(rel.includes('noopener') && rel.includes('noreferrer'), `${relativePath}: external target lacks noopener/noreferrer`);
    }
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || /^https?:/i.test(href)) continue;

    const cleanPath = href.split(/[?#]/)[0];
    if (!cleanPath.startsWith('/')) continue;
    const target = path.join(publicDir, cleanPath.replace(/^\//, ''));
    const resolved = cleanPath.endsWith('/') ? path.join(target, 'index.html') : target;
    check(await exists(resolved), `${relativePath}: broken internal link ${href}`);
  }

  const labels = new Set([...html.matchAll(/<label\b[^>]*\bfor=(["'])(.*?)\1/gi)].map((match) => match[2]));
  for (const match of html.matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
    const id = attribute(match[0], 'id');
    check(Boolean(id) && labels.has(id), `${relativePath}: form control is missing a matching label`);
  }

  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      JSON.parse(match[1]);
    } catch {
      check(false, `${relativePath}: invalid JSON-LD`);
    }
  }

  const visibleText = stripTags(html);
  check(!visibleText.includes('WEB-PORT-'), `${relativePath}: internal build serial is exposed`);
}

async function verifyLocal() {
  for (const file of htmlFiles) await verifyHtml(file);

  const requiredFiles = [
    '_headers',
    '_redirects',
    'robots.txt',
    'sitemap.xml',
    'assets/styles.css',
    'assets/site.js',
    'assets/favicon.svg',
    'assets/social-card.jpg'
  ];
  for (const file of requiredFiles) {
    check(await exists(path.join(publicDir, file)), `missing required file: public/${file}`);
  }

  const publicFiles = await Promise.all([
    readFile(path.join(publicDir, 'index.html'), 'utf8'),
    readFile(path.join(publicDir, 'work/daily-crossword-unlimited/index.html'), 'utf8'),
    readFile(path.join(publicDir, 'work/drasteon/index.html'), 'utf8'),
    readFile(path.join(publicDir, 'assets/site.js'), 'utf8')
  ]);
  check(publicFiles.every((content) => content.includes('suhayb@lcmb.co.uk')), 'contact address is not consistent across every page and enquiry script');

  const sitemap = await readFile(path.join(publicDir, 'sitemap.xml'), 'utf8');
  for (const route of ['/', '/work/daily-crossword-unlimited/', '/work/drasteon/']) {
    check(sitemap.includes(`${expectedOrigin}${route}`), `sitemap is missing ${route}`);
  }

  const robots = await readFile(path.join(publicDir, 'robots.txt'), 'utf8');
  check(robots.includes(`${expectedOrigin}/sitemap.xml`), 'robots.txt points to the wrong sitemap');

  const headers = await readFile(path.join(publicDir, '_headers'), 'utf8');
  for (const header of ['Content-Security-Policy:', 'X-Content-Type-Options:', 'Referrer-Policy:', 'X-Frame-Options: DENY']) {
    check(headers.includes(header), `_headers is missing ${header}`);
  }
  const homepage = publicFiles[0];
  const jsonLd = homepage.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  check(Boolean(jsonLd), 'homepage is missing JSON-LD');
  if (jsonLd) {
    const jsonLdHash = createHash('sha256').update(jsonLd).digest('base64');
    check(headers.includes(`'sha256-${jsonLdHash}'`), '_headers CSP does not allow the current JSON-LD block');
  }

  const redirects = await readFile(path.join(publicDir, '_redirects'), 'utf8');
  check(redirects.includes('/work/drasteon '), '_redirects is missing the Drasteon canonical redirect');
  check(redirects.includes('/work/daily-crossword-unlimited '), '_redirects is missing the crossword canonical redirect');
}

async function verifyRemote(baseUrl) {
  const base = baseUrl.replace(/\/$/, '');
  const routes = ['/', '/work/daily-crossword-unlimited/', '/work/drasteon/', '/robots.txt', '/sitemap.xml'];

  for (const route of routes) {
    const response = await fetch(`${base}${route}`, { redirect: 'manual' });
    check(response.status === 200, `${route}: expected 200, received ${response.status}`);
    if (route === '/') {
      for (const header of ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'x-frame-options']) {
        check(response.headers.has(header), `live homepage is missing ${header}`);
      }
    }
  }

  for (const route of ['/work/daily-crossword-unlimited', '/work/drasteon']) {
    const response = await fetch(`${base}${route}`, { redirect: 'manual' });
    check([301, 308].includes(response.status), `${route}: expected a permanent redirect, received ${response.status}`);
    check(response.headers.get('location')?.endsWith(`${route}/`), `${route}: redirect target is not canonical`);
  }

  const notFound = await fetch(`${base}/this-page-must-not-exist`, { redirect: 'manual' });
  check(notFound.status === 404, `unknown route: expected 404, received ${notFound.status}`);
  check((await notFound.text()).includes('That page does not exist.'), 'unknown route: branded 404 content was not served');
}

await verifyLocal();

const baseArgument = process.argv.find((argument) => argument.startsWith('--base='));
if (baseArgument) {
  await verifyRemote(baseArgument.slice('--base='.length));
}

if (failures.length) {
  console.error(`Verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Verified ${htmlFiles.length} HTML files${baseArgument ? ' and the live deployment' : ''}.`);
