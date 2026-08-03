const heroImage = document.querySelector('.hero-image-wrap > img');
heroImage?.addEventListener('error', () => heroImage.classList.add('image-unavailable'));

const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');

menuButton?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
});

nav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    nav.classList.remove('open');
    menuButton?.setAttribute('aria-expanded', 'false');
  });
});

const filters = document.querySelectorAll('.filter');
const results = document.querySelectorAll('.filter-results > div');

filters.forEach((button) => {
  button.addEventListener('click', () => {
    const selected = button.dataset.filter;
    filters.forEach((item) => item.classList.toggle('active', item === button));
    results.forEach((item) => {
      const groups = (item.dataset.groups || '').split(' ');
      item.classList.toggle('hidden', selected !== 'all' && !groups.includes(selected));
    });
  });
});

async function loadProductImage(card) {
  const handle = card.dataset.handle;
  const image = card.querySelector('.product-media img');
  if (!handle || !image) return;

  try {
    const response = await fetch(`https://mastermindchina.com/products/${handle}.js`, {
      mode: 'cors',
      credentials: 'omit'
    });
    if (!response.ok) return;
    const product = await response.json();
    const source = product.featured_image || product.images?.[0];
    if (!source) return;
    image.src = source.startsWith('//') ? `https:${source}` : source;
  } catch (_) {
    // The styled fallback remains visible if the live Shopify endpoint blocks CORS.
  }
}

document.querySelectorAll('.product-card[data-handle]').forEach(loadProductImage);
