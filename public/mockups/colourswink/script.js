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

const quantityOutput = document.querySelector('#quantity');
let quantity = 1;
document.querySelectorAll('[data-qty]').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.qty === 'plus') quantity += 1;
    if (button.dataset.qty === 'minus') quantity = Math.max(1, quantity - 1);
    quantityOutput.value = String(quantity);
    quantityOutput.textContent = String(quantity);
  });
});

const delivery = {
  india: {
    label: 'India standard delivery',
    time: '3 to 7 business days',
    note: 'Express delivery is listed as 1 to 3 business days where available.'
  },
  uk: {
    label: 'United Kingdom delivery',
    time: '10 to 14 business days',
    note: 'Published international delivery estimate in the current Shipping Policy.'
  },
  usa: {
    label: 'United States delivery',
    time: '12 to 16 business days',
    note: 'Published international delivery estimate in the current Shipping Policy.'
  }
};

const regionLabel = document.querySelector('#region-label');
const regionTime = document.querySelector('#region-time');
const regionNote = document.querySelector('#region-note');

document.querySelectorAll('.region-tab').forEach((button) => {
  button.addEventListener('click', () => {
    const selected = delivery[button.dataset.region];
    if (!selected) return;
    document.querySelectorAll('.region-tab').forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', String(active));
    });
    regionLabel.textContent = selected.label;
    regionTime.textContent = selected.time;
    regionNote.textContent = selected.note;
  });
});

window.__COLOURSWINK_AUDIT__ = {
  version: 'CSW-20260809-001',
  regions: Object.keys(delivery),
  quantity: () => quantity,
  overflow: () => document.documentElement.scrollWidth - document.documentElement.clientWidth
};
