const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('#main-nav');

if (menuButton && nav) {
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('is-open', !open);
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menuButton.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
    });
  });
}

const details = {
  fabric: {
    kicker: 'Fit & fabric',
    title: 'Soft, broken-in Comfort Colors without the mystery.',
    items: [
      'Comfort Colors 1717 garment-dyed tee',
      '100% ring-spun cotton, 6.1 oz/yd²',
      'Relaxed fit with twill-taped neck and shoulders',
      'DTG print designed to sit into the vintage fabric rather than feel thick and plasticky'
    ],
    link: 'Check the current live size guide and options ↗'
  },
  delivery: {
    kicker: 'Delivery',
    title: 'Set the timing expectation before checkout.',
    items: [
      'Free shipping on current U.S. orders',
      'Production takes 2–5 business days',
      'Delivery takes 3–5 business days after shipping',
      'Allow 5–10 business days total, with tracking after dispatch'
    ],
    link: 'Check the current shipping information ↗'
  },
  made: {
    kicker: 'Made to order',
    title: 'Make the trade-off clear before the buyer chooses a size.',
    items: [
      'Each item is printed after the order is placed',
      'Returns or exchanges are not accepted for sizing issues or change of mind',
      'The live refund policy covers damaged, defective, misprinted or incorrect items',
      'Use the current official policy as the source of truth for reporting deadlines'
    ],
    link: 'Read the current official refund policy ↗'
  }
};

const detailContent = document.querySelector('#detail-content');
const detailTabs = document.querySelectorAll('.detail-tab');

function detailHref(key) {
  return key === 'made'
    ? 'https://thespinedlife.com/policies/refund-policy'
    : 'https://thespinedlife.com/products/ghost-stories-tee';
}

function renderDetail(key) {
  const detail = details[key];
  if (!detailContent || !detail) return;
  detailContent.innerHTML = `
    <p class="detail-kicker">${detail.kicker}</p>
    <h3>${detail.title}</h3>
    <ul>${detail.items.map((item) => `<li>${item}</li>`).join('')}</ul>
    <a href="${detailHref(key)}" target="_blank" rel="noreferrer">${detail.link}</a>
  `;
}

for (const tab of detailTabs) {
  tab.addEventListener('click', () => {
    const key = tab.dataset.detail;
    detailTabs.forEach((item) => {
      const active = item === tab;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', String(active));
    });
    renderDetail(key);
  });
}
