import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const expectedOrigin = 'https://suhayb-manzar-portfolio.web.app';
const htmlFiles = [
  'index.html',
  '404.html',
  'work/daily-crossword-unlimited/index.html',
  'work/drasteon/index.html'
];
const euphoriaRoutes = [
  '/mockups/euphoria-smoke-shop/',
  '/mockups/euphoria-smoke-shop/desktop/',
  '/mockups/euphoria-smoke-shop/mobile/'
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
  check(!/suhayb@lcmb\.co\.uk/i.test(html), `${relativePath}: contains the retired contact address`);
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

  const firebaseConfig = JSON.parse(await readFile(path.join(root, 'firebase.json'), 'utf8'));
  check(firebaseConfig.hosting?.public === 'public', 'firebase.json must deploy the public directory');
  check(firebaseConfig.hosting?.cleanUrls === true, 'firebase.json must enable clean URLs');
  check(firebaseConfig.hosting?.trailingSlash === true, 'firebase.json must enforce trailing slashes');

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
    readFile(path.join(publicDir, 'work/drasteon/index.html'), 'utf8')
  ]);
  check(publicFiles.every((content) => content.includes('suhayb.manzar1@gmail.com')), 'contact address is not consistent across every public page');
  check(publicFiles.every((content) => !content.includes('suhayb@lcmb.co.uk')), 'retired contact address remains on a public page');
  check(publicFiles[0].includes('https://wa.me/923086885305'), 'homepage is missing the WhatsApp contact link');
  check(!publicFiles[0].includes('id="project-form"'), 'homepage still contains the retired enquiry form');

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

  const euphoriaRoot = path.join(publicDir, 'mockups/euphoria-smoke-shop');
  const euphoriaFiles = [
    'index.html', 'styles.css', 'logo-fallback.js',
    'desktop/index.html', 'mobile/index.html', 'mobile/preview.js',
    'assets/hero.webp', 'assets/store.webp', 'assets/pivot1.webp',
    'assets/pivot2.webp', 'assets/pivot3.webp', 'assets/pivot4.webp'
  ];
  for (const file of euphoriaFiles) {
    check(await exists(path.join(euphoriaRoot, file)), `missing Euphoria mock-up file: ${file}`);
  }

  const mobilePreview = await readFile(path.join(euphoriaRoot, 'mobile/index.html'), 'utf8');
  const mobilePreviewScript = await readFile(path.join(euphoriaRoot, 'mobile/preview.js'), 'utf8');
  check(/<iframe\b[^>]*src=["']\.\.\/["']/i.test(mobilePreview), 'Euphoria mobile route must frame the parent mock-up');
  check(mobilePreview.includes('preview.js'), 'Euphoria mobile route is missing height synchronization');
  check(mobilePreviewScript.includes('window.setInterval(syncHeight, 500);'), 'Euphoria mobile height synchronization must not observe cross-document nodes');

  const euphoriaStyles = await readFile(path.join(euphoriaRoot, 'styles.css'), 'utf8');
  const desktopStorePath = path.join(euphoriaRoot, 'assets/store-desktop.webp');
  check(await exists(desktopStorePath), 'Euphoria desktop store image is missing');
  if (await exists(desktopStorePath)) {
    const euphoriaStoreImage = await stat(desktopStorePath);
    check(euphoriaStoreImage.size >= 100_000, 'Euphoria desktop store image is too small for wide rendering');
  }
  check(/\.store-tile\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*1\s*\/\s*3;/s.test(euphoriaStyles), 'Euphoria desktop mosaic does not constrain the store tile to its own column');
  check(/\.brand-image,\s*\.store-photo\s*\{\s*display:\s*none;/s.test(euphoriaStyles), 'Euphoria desktop repeats hero imagery in later sections');
}

async function verifyRemote(baseUrl) {
  const base = baseUrl.replace(/\/$/, '');
  const routes = ['/', '/work/daily-crossword-unlimited/', '/work/drasteon/', ...euphoriaRoutes, '/robots.txt', '/sitemap.xml'];

  for (const route of routes) {
    const response = await fetch(`${base}${route}`, { redirect: 'manual' });
    check(response.status === 200, `${route}: expected 200, received ${response.status}`);
    if (route === '/') {
      for (const header of ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'x-frame-options']) {
        check(response.headers.has(header), `live homepage is missing ${header}`);
      }
      const homepage = await response.text();
      check(homepage.includes('suhayb.manzar1@gmail.com'), 'live homepage is missing the current email address');
      check(homepage.includes('https://wa.me/923086885305'), 'live homepage is missing the WhatsApp route');
      check(!homepage.includes('id="project-form"'), 'live homepage still contains the retired enquiry form');
      check(!homepage.includes('suhayb@lcmb.co.uk'), 'live homepage contains the retired email address');
    }
    if (route.startsWith('/mockups/euphoria-smoke-shop/')) {
      check(response.headers.get('x-frame-options') === 'SAMEORIGIN', `${route}: expected SAMEORIGIN framing policy`);
      check(response.headers.get('content-security-policy')?.includes("frame-ancestors 'self'"), `${route}: CSP does not permit the same-origin mobile wrapper`);
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
