const menuButton = document.querySelector('.menu-button');
const mobileNav = document.querySelector('.mobile-nav');

if (menuButton && mobileNav) {
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    mobileNav.hidden = open;
  });
  mobileNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    menuButton.setAttribute('aria-expanded', 'false');
    mobileNav.hidden = true;
  }));
}

const regions = {
  france: ['France', '2 to 5 business days', 'Delivery estimates are not guaranteed.'],
  eu: ['European Union', '5 to 10 business days', 'Customs or carrier delays can affect delivery.'],
  uk: ['United Kingdom', '5 to 12 business days', 'Buyers may be responsible for local import charges.'],
  na: ['United States & Canada', '7 to 21 business days', 'Buyers may be responsible for local import charges.']
};

const label = document.querySelector('#region-label');
const time = document.querySelector('#region-time');
const note = document.querySelector('#region-note');

document.querySelectorAll('.region-tab').forEach((button) => {
  button.addEventListener('click', () => {
    const value = regions[button.dataset.region];
    if (!value) return;
    document.querySelectorAll('.region-tab').forEach((tab) => {
      tab.classList.remove('active');
      tab.setAttribute('aria-selected', 'false');
    });
    button.classList.add('active');
    button.setAttribute('aria-selected', 'true');
    label.textContent = value[0];
    time.textContent = value[1];
    note.textContent = value[2];
  });
});
