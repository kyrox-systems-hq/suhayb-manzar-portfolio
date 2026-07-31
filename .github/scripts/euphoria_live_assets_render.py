from __future__ import annotations

import html
import json
import re
import shutil
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

BASE = "https://euphoriasmokeshop.com"
OUT = Path("mockup-output")
ASSETS = OUT / "assets"
OUT.mkdir(parents=True, exist_ok=True)
ASSETS.mkdir(parents=True, exist_ok=True)

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
})


def request(url: str, *, expect_json: bool = False):
    response = session.get(url, timeout=45)
    response.raise_for_status()
    return response.json() if expect_json else response


def clean_url(url: str) -> str:
    if not url:
        return ""
    url = html.unescape(url.strip())
    if url.startswith("//"):
        return "https:" + url
    return urljoin(BASE, url)


def extension_for(url: str, content_type: str = "") -> str:
    path = urlparse(url).path.lower()
    for ext in (".png", ".webp", ".jpg", ".jpeg", ".gif"):
        if path.endswith(ext):
            return ".jpg" if ext == ".jpeg" else ext
    if "png" in content_type:
        return ".png"
    if "webp" in content_type:
        return ".webp"
    return ".jpg"


def download(url: str, stem: str) -> tuple[str, str]:
    url = clean_url(url)
    response = request(url)
    ext = extension_for(url, response.headers.get("content-type", ""))
    filename = f"{stem}{ext}"
    path = ASSETS / filename
    path.write_bytes(response.content)
    return filename, url


def money(cents) -> str:
    try:
        value = int(cents) / 100
    except (TypeError, ValueError):
        return ""
    return f"${value:,.2f}"


def fetch_product(handle: str) -> dict | None:
    js_url = f"{BASE}/products/{handle}.js"
    try:
        data = request(js_url, expect_json=True)
    except Exception:
        page_url = f"{BASE}/products/{handle}"
        try:
            page = request(page_url).text
            soup = BeautifulSoup(page, "html.parser")
            title = (soup.select_one('meta[property="og:title"]') or {}).get("content", "")
            image = (soup.select_one('meta[property="og:image"]') or {}).get("content", "")
            price = (soup.select_one('meta[property="product:price:amount"]') or {}).get("content", "")
            if not title or not image:
                return None
            return {
                "handle": handle,
                "title": title,
                "vendor": "",
                "price": f"${float(price):,.2f}" if price else "",
                "source": page_url,
                "image_url": clean_url(image),
            }
        except Exception:
            return None

    images = data.get("images") or []
    if not images:
        return None
    return {
        "handle": handle,
        "title": data.get("title", ""),
        "vendor": data.get("vendor", ""),
        "price": money(data.get("price")),
        "source": f"{BASE}/products/{handle}",
        "image_url": clean_url(images[0]),
    }


manifest: dict[str, object] = {
    "site": BASE,
    "rule": "Every raster image in the mock-up was downloaded from Euphoria Smoke Shop's live website. No generated or stock media is used.",
    "assets": [],
}

logo_source = f"{BASE}/cdn/shop/files/Euphoria_smoke_supply_logo_transparent.png?v=1711214967&width=1200"
logo_file, logo_url = download(logo_source, "euphoria-official-logo")
manifest["assets"].append({"role": "official logo", "file": logo_file, "source": logo_url})

home_html = request(BASE).text
home_soup = BeautifulSoup(home_html, "html.parser")
home_handles: list[str] = []
for anchor in home_soup.select('a[href*="/products/"]'):
    match = re.search(r"/products/([^?#/]+)", anchor.get("href", ""))
    if match and match.group(1) not in home_handles:
        home_handles.append(match.group(1))

preferred_handles = [
    "porcelain-designed-glass-bong",
    "10-flower-bong-with-lighter-indent",
    "puffco-peak-pro-daybreak-limited-edition",
    "puffco-pivot-vaporizer",
    "sucker-4-love-lollipop-hand-pipe",
    "ramen-bowl-hand-pipe",
    "space-shuttle-hand-pipe",
    "hemper-cupcake-bong-6",
    "hemper-tornado-vortex-rig",
    "hemper-pina-colada-xl-bong-7",
]
ordered_handles = preferred_handles + [h for h in home_handles if h not in preferred_handles]

products: list[dict] = []
seen_titles: set[str] = set()
for handle in ordered_handles:
    if len(products) >= 8:
        break
    product = fetch_product(handle)
    if not product or not product.get("title"):
        continue
    title_key = str(product["title"]).lower()
    if title_key in seen_titles:
        continue
    try:
        image_file, image_url = download(str(product["image_url"]), f"product-{len(products)+1:02d}")
    except Exception:
        continue
    product["image_file"] = image_file
    product["image_url"] = image_url
    products.append(product)
    seen_titles.add(title_key)
    manifest["assets"].append({
        "role": f"product image: {product['title']}",
        "file": image_file,
        "source": image_url,
        "product_page": product["source"],
    })

if len(products) < 6:
    raise RuntimeError(f"Only {len(products)} live product images could be downloaded; refusing to build a mock-up with fabricated placeholders.")


def image_candidates(soup: BeautifulSoup) -> list[tuple[int, str, str]]:
    candidates: list[tuple[int, str, str]] = []
    for img in soup.find_all("img"):
        alt = (img.get("alt") or "").strip()
        src = img.get("src") or img.get("data-src") or ""
        if not src and img.get("srcset"):
            src = img.get("srcset").split(",")[-1].strip().split(" ")[0]
        src = clean_url(src)
        if not src or "cdn/shop" not in src:
            continue
        text = f"{alt} {src}".lower()
        score = 0
        for term, points in (("store", 8), ("shop", 5), ("inside", 8), ("interior", 8), ("attleboro", 7), ("about", 3)):
            if term in text:
                score += points
        if score:
            candidates.append((score, alt, src))
    return sorted(candidates, reverse=True)


store_file = ""
store_url = ""
for page_path in ("/", "/pages/about-us", "/about_us"):
    try:
        soup = BeautifulSoup(request(BASE + page_path).text, "html.parser")
    except Exception:
        continue
    for _, _, candidate_url in image_candidates(soup):
        try:
            store_file, store_url = download(candidate_url, "storefront-existing-site-image")
            break
        except Exception:
            continue
    if store_file:
        break

if store_file:
    manifest["assets"].append({"role": "store or brand image", "file": store_file, "source": store_url})


def esc(value: object) -> str:
    return html.escape(str(value or ""))


def product_card(product: dict, compact: bool = False) -> str:
    compact_class = " product-card--compact" if compact else ""
    return f"""
      <article class="product-card{compact_class}">
        <div class="product-photo"><img src="assets/{esc(product['image_file'])}" alt="{esc(product['title'])}"></div>
        <div class="product-info">
          <p class="vendor">{esc(product.get('vendor') or 'Euphoria selection')}</p>
          <h3>{esc(product['title'])}</h3>
          <div class="product-bottom"><strong>{esc(product.get('price'))}</strong><span>View product</span></div>
        </div>
      </article>"""


hero = products[2] if len(products) > 2 else products[0]
categories = products[:4]
featured = products[4:8]
category_labels = ["Bongs & glass", "Vaporizers", "Puffco", "Hemper & novelty"]
category_cards = "".join(
    f"""
      <article class="category-card">
        <div class="category-photo"><img src="assets/{esc(p['image_file'])}" alt="{esc(p['title'])}"></div>
        <div><span>Shop</span><strong>{esc(label)}</strong></div>
      </article>"""
    for p, label in zip(categories, category_labels)
)
featured_cards = "".join(product_card(p, compact=True) for p in featured)
store_section = ""
if store_file:
    store_section = f"""
    <div class="store-photo"><img src="assets/{esc(store_file)}" alt="Euphoria Smoke Shop image from the existing website"></div>
    """

html_doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Euphoria Smoke Shop mobile homepage mock-up</title>
<style>
:root{{--ink:#f6f2e8;--paper:#eeeae0;--black:#090b0a;--panel:#101512;--green:#86a854;--green2:#b9d07b;--muted:#a8afa8;--line:rgba(255,255,255,.12)}}
*{{box-sizing:border-box}}
html,body{{margin:0;background:#e7e5df;color:var(--ink);font-family:Arial,Helvetica,sans-serif}}
body{{display:flex;justify-content:center;padding:26px 0 34px}}
.phone{{width:430px;overflow:hidden;background:var(--black);border-radius:24px;box-shadow:0 24px 70px rgba(0,0,0,.28);border:1px solid rgba(0,0,0,.2)}}
.promo{{height:34px;display:flex;align-items:center;justify-content:center;background:#253a2d;font-size:10px;letter-spacing:.08em;text-transform:uppercase;font-weight:800}}
.promo b{{color:var(--green2);margin-left:5px}}
header{{height:78px;display:grid;grid-template-columns:42px 1fr 82px;align-items:center;padding:0 16px;background:#080a09;border-bottom:1px solid var(--line)}}
.menu,.circle{{width:36px;height:36px;border:1px solid var(--line);border-radius:50%;display:grid;place-items:center;font-size:17px}}
.menu{{font-size:20px}}
.actions{{display:flex;gap:7px;justify-content:flex-end}}
.logo-wrap{{display:flex;justify-content:center;align-items:center;height:58px}}
.logo-wrap img{{display:block;max-height:52px;max-width:196px;object-fit:contain}}
.hero-copy{{padding:31px 22px 25px;background:linear-gradient(145deg,#131814,#090b0a)}}
.eyebrow{{margin:0 0 11px;color:var(--green2);font-size:9px;letter-spacing:.16em;text-transform:uppercase;font-weight:900}}
h1,h2,h3,p{{margin-top:0}}
h1{{font-family:Georgia,'Times New Roman',serif;font-size:41px;line-height:1;letter-spacing:-.035em;font-weight:500;margin-bottom:16px}}
.lede{{font-size:13px;line-height:1.55;color:#c7cbc5;margin-bottom:21px}}
.btn{{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;background:var(--green);color:#0b0d0a;font-size:10px;letter-spacing:.08em;text-transform:uppercase;font-weight:900;border-radius:3px}}
.hero-media{{height:390px;background:#f5f3ed;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden}}
.hero-media img{{width:100%;height:100%;object-fit:contain;display:block}}
.hero-tag{{position:absolute;left:15px;bottom:15px;background:#0b0d0bdd;border-left:3px solid var(--green);padding:10px 12px;font-size:9px;line-height:1.35;backdrop-filter:blur(6px)}}
.hero-tag b{{display:block;font-size:11px;margin-bottom:2px}}
.trust{{display:grid;grid-template-columns:1fr 1fr;background:#101411;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}}
.trust div{{min-height:72px;padding:14px 14px;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}}
.trust div:nth-child(even){{border-right:0}}.trust div:nth-child(n+3){{border-bottom:0}}
.trust b{{display:block;font-size:10px;margin-bottom:4px}}.trust span{{font-size:8px;line-height:1.35;color:var(--muted)}}
section{{padding:34px 18px}}
.section-head{{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:18px}}
h2{{font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.03;font-weight:500;letter-spacing:-.025em;margin-bottom:0}}
.link{{font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--green2);font-weight:900}}
.categories{{background:#0a0d0b}}
.category-grid{{display:grid;grid-template-columns:1fr 1fr;gap:10px}}
.category-card{{overflow:hidden;border-radius:9px;border:1px solid var(--line);background:#111612}}
.category-photo{{height:150px;background:#f2efe7}}
.category-photo img{{width:100%;height:100%;object-fit:contain}}
.category-card>div:last-child{{padding:12px 13px 14px}}
.category-card span{{display:block;font-size:8px;color:var(--green2);letter-spacing:.1em;text-transform:uppercase;margin-bottom:5px}}
.category-card strong{{font-family:Georgia,serif;font-size:17px;font-weight:500}}
.budget{{padding:24px 18px;background:#263a2d;display:grid;grid-template-columns:1fr 1fr;gap:10px}}
.budget-intro{{grid-column:1/-1;margin-bottom:3px}}
.budget-intro p{{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--green2);font-weight:900;margin-bottom:6px}}
.budget-intro h2{{font-size:26px}}
.budget-card{{padding:16px 13px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.14);border-radius:7px}}
.budget-card b{{display:block;font-family:Georgia,serif;font-size:21px;font-weight:500;margin-bottom:5px}}
.budget-card span{{font-size:8px;color:#d9ded6}}
.featured{{background:#111612;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}}
.product-grid{{display:grid;grid-template-columns:1fr 1fr;gap:10px}}
.product-card{{overflow:hidden;background:#f2efe8;color:#111;border-radius:9px;border:1px solid rgba(255,255,255,.12)}}
.product-photo{{height:205px;background:#f7f5ef;display:flex;align-items:center;justify-content:center}}
.product-photo img{{width:100%;height:100%;object-fit:contain}}
.product-info{{padding:13px}}
.vendor{{font-size:7px;letter-spacing:.11em;text-transform:uppercase;font-weight:900;color:#61705f;margin-bottom:7px}}
.product-info h3{{font-family:Georgia,serif;font-size:16px;line-height:1.12;font-weight:500;margin-bottom:13px;min-height:54px}}
.product-bottom{{display:flex;justify-content:space-between;align-items:end;border-top:1px solid rgba(0,0,0,.12);padding-top:10px;gap:6px}}
.product-bottom strong{{font-size:14px}}.product-bottom span{{font-size:7px;text-transform:uppercase;letter-spacing:.08em;font-weight:900;color:#436229;text-align:right}}
.brand-feature{{padding:0;background:#111612}}
.brand-feature-image{{height:340px;background:#f5f3ed}}
.brand-feature-image img{{width:100%;height:100%;object-fit:contain}}
.brand-feature-copy{{padding:25px 20px 30px;border-top:1px solid var(--line)}}
.brand-feature-copy h2{{font-size:30px;margin-bottom:11px}}
.brand-feature-copy p{{font-size:11px;line-height:1.55;color:var(--muted);margin-bottom:17px}}
.reviews{{background:#0a0d0b}}
.review{{padding:17px;border:1px solid var(--line);border-radius:8px;background:#111512;margin-bottom:10px}}
.stars{{font-size:11px;color:var(--green2);letter-spacing:.08em;margin-bottom:9px}}
.review q{{display:block;font-family:Georgia,serif;font-size:16px;line-height:1.38;margin-bottom:12px;color:#eee9de}}
.review cite{{font-style:normal;font-size:8px;letter-spacing:.11em;text-transform:uppercase;color:var(--muted);font-weight:900}}
.store{{padding:0;background:#111512}}
.store-photo{{height:310px;background:#111}}
.store-photo img{{width:100%;height:100%;object-fit:cover}}
.store-copy{{padding:28px 20px 31px}}
.store-copy h2{{font-size:31px;margin-bottom:12px}}
.store-copy>p{{font-size:11px;line-height:1.55;color:var(--muted);margin-bottom:19px}}
.store-details{{display:grid;grid-template-columns:1fr 1fr;gap:12px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:15px 0;margin-bottom:18px}}
.store-details b{{display:block;color:var(--green2);font-size:8px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:5px}}
.store-details span{{font-size:9px;line-height:1.4;color:#e0e2dc}}
footer{{padding:27px 18px;background:#050706;border-top:1px solid var(--line)}}
.footer-logo{{height:57px;display:flex;justify-content:flex-start;margin-bottom:18px}}
.footer-logo img{{max-height:55px;max-width:205px;object-fit:contain}}
.footer-grid{{display:grid;grid-template-columns:1fr 1fr;gap:20px;border-top:1px solid var(--line);padding-top:18px}}
.footer-grid b{{display:block;font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:var(--green2);margin-bottom:8px}}
.footer-grid span{{display:block;font-size:8px;line-height:1.8;color:var(--muted)}}
.legal{{display:flex;justify-content:space-between;align-items:center;margin-top:19px;padding-top:14px;border-top:1px solid var(--line);font-size:7px;color:#777d77}}
.age{{width:25px;height:25px;border-radius:50%;border:1px solid #777d77;display:grid;place-items:center}}
</style>
</head>
<body>
<main class="phone">
  <div class="promo">First order online <b>10% off with FIRSTTIME10</b></div>
  <header>
    <div class="menu">☰</div>
    <div class="logo-wrap"><img src="assets/{esc(logo_file)}" alt="Euphoria Smoke Shop official logo"></div>
    <div class="actions"><div class="circle">⌕</div><div class="circle">🛒</div></div>
  </header>

  <div class="hero-copy">
    <p class="eyebrow">Attleboro storefront + nationwide online shop</p>
    <h1>Find the right piece without digging through the whole store.</h1>
    <p class="lede">A clearer route into Euphoria’s glass, vaporizers, Puffco products and everyday smoking essentials.</p>
    <span class="btn">Shop best sellers</span>
  </div>
  <div class="hero-media">
    <img src="assets/{esc(hero['image_file'])}" alt="{esc(hero['title'])}">
    <div class="hero-tag"><b>{esc(hero['title'])}</b>{esc(hero.get('price'))} · Available from Euphoria</div>
  </div>

  <div class="trust">
    <div><b>5-star customer reviews</b><span>Real feedback from Euphoria customers.</span></div>
    <div><b>Fast, discreet shipping</b><span>Delivery estimates shown at checkout.</span></div>
    <div><b>Unmarked packaging</b><span>Orders arrive without revealing contents.</span></div>
    <div><b>Secure Shopify checkout</b><span>Encrypted payment processing.</span></div>
  </div>

  <section class="categories">
    <div class="section-head"><div><p class="eyebrow">Start with what you need</p><h2>Shop by category</h2></div><span class="link">All products</span></div>
    <div class="category-grid">{category_cards}</div>
  </section>

  <div class="budget">
    <div class="budget-intro"><p>Useful shortcuts</p><h2>Shop more for less</h2></div>
    <div class="budget-card"><b>$25 & under</b><span>Everyday accessories</span></div>
    <div class="budget-card"><b>$50 & under</b><span>Glass and vape options</span></div>
    <div class="budget-card"><b>$100 & under</b><span>Premium upgrades</span></div>
    <div class="budget-card"><b>All budgets</b><span>Browse the full range</span></div>
  </div>

  <section class="featured">
    <div class="section-head"><div><p class="eyebrow">Products already sold by Euphoria</p><h2>Current favourites</h2></div><span class="link">View all</span></div>
    <div class="product-grid">{featured_cards}</div>
  </section>

  <section class="brand-feature">
    <div class="brand-feature-image"><img src="assets/{esc(products[1]['image_file'])}" alt="{esc(products[1]['title'])}"></div>
    <div class="brand-feature-copy">
      <p class="eyebrow">Bongs and water pipes</p>
      <h2>Compare products without losing the visual impact.</h2>
      <p>Product photography remains the focus. Names, prices and the next step sit in a consistent place, so customers can scan rather than hunt.</p>
      <span class="btn">Shop bongs</span>
    </div>
  </section>

  <section class="reviews">
    <div class="section-head"><div><p class="eyebrow">What customers say</p><h2>Trusted locally</h2></div><span class="link">See reviews</span></div>
    <article class="review"><div class="stars">★★★★★</div><q>This shop is so beautiful. The owners make this place a unique one stop shop for all your needs.</q><cite>Vanessa Lara</cite></article>
    <article class="review"><div class="stars">★★★★★</div><q>Awesome store. Had a bunch of fun options I haven’t seen elsewhere.</q><cite>Steve Fox</cite></article>
  </section>

  <section class="store">
    {store_section}
    <div class="store-copy">
      <p class="eyebrow">A real shop, not an anonymous catalogue</p>
      <h2>Visit Euphoria in Attleboro.</h2>
      <p>The physical storefront is one of Euphoria’s strongest trust signals, so it deserves a clear place in the shopping journey.</p>
      <div class="store-details">
        <div><b>Address</b><span>13 N Main Street<br>Attleboro, MA 02703</span></div>
        <div><b>Online orders</b><span>Fast shipping<br>Unmarked packaging</span></div>
      </div>
      <span class="btn">Get directions</span>
    </div>
  </section>

  <footer>
    <div class="footer-logo"><img src="assets/{esc(logo_file)}" alt="Euphoria Smoke Shop official logo"></div>
    <div class="footer-grid">
      <div><b>Shop</b><span>All products<br>Bongs and glass<br>Vaporizers<br>Smoking accessories<br>Shop by budget</span></div>
      <div><b>Help</b><span>About us<br>Shopping FAQ<br>Shipping policy<br>Refund policy<br>Contact us</span></div>
    </div>
    <div class="legal"><span>© 2026 Euphoria Smoke Shop</span><span class="age">21+</span></div>
  </footer>
</main>
</body>
</html>"""

html_path = OUT / "euphoria-mobile-homepage-live-assets.html"
html_path.write_text(html_doc, encoding="utf-8")
(OUT / "asset-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(args=["--font-render-hinting=none"])
    page = browser.new_page(viewport={"width": 486, "height": 900}, device_scale_factor=2)
    page.goto(html_path.resolve().as_uri(), wait_until="networkidle")
    page.screenshot(path=str(OUT / "euphoria-mobile-homepage-live-assets.png"), full_page=True)
    browser.close()

shutil.make_archive("euphoria-live-assets-mockup", "zip", OUT)
print(json.dumps({"products": products, "store_image": store_url, "output": str(OUT)}, indent=2))
