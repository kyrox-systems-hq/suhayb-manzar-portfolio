const menuButton = document.querySelector('.menu-button');
const mobileNav = document.querySelector('.mobile-nav');

menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  mobileNav.hidden = open;
});

document.querySelectorAll('.mobile-nav a').forEach((link) => {
  link.addEventListener('click', () => {
    mobileNav.hidden = true;
    menuButton?.setAttribute('aria-expanded', 'false');
  });
});

document.querySelectorAll('.filter').forEach((button) => {
  button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    document.querySelectorAll('.filter').forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.product-card').forEach((card) => {
      const show = filter === 'all' || card.dataset.category === filter;
      card.classList.toggle('is-hidden', !show);
    });
  });
});

function settleImage(image) {
  const frame = image.closest('.image-loading');
  if (!frame) return;
  const show = () => {
    image.style.display = 'block';
    frame.classList.remove('image-loading');
  };
  const fail = () => {
    image.style.display = 'none';
    frame.classList.add('image-loading');
  };
  image.addEventListener('load', show, { once: true });
  image.addEventListener('error', fail, { once: true });
  if (image.complete) {
    if (image.naturalWidth > 0) show();
    else fail();
  }
}

document.querySelectorAll('.image-loading > img').forEach(settleImage);

window.__OASIS_HUP_AUDIT__ = {
  version: 'OHP-20260809-001',
  productCards: document.querySelectorAll('.product-card').length,
  filters: document.querySelectorAll('.filter').length,
  overflow: () => document.documentElement.scrollWidth - document.documentElement.clientWidth
};
