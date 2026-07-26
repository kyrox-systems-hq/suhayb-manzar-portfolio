const header = document.querySelector('.site-header');
const menuButton = document.querySelector('.menu-button');
const navLinks = document.querySelectorAll('.nav-links a');

const updateHeader = () => header?.classList.toggle('scrolled', window.scrollY > 12);
const closeMenu = () => {
  document.body.classList.remove('menu-open');
  menuButton?.setAttribute('aria-expanded', 'false');
  menuButton?.setAttribute('aria-label', 'Open navigation');
};

updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

menuButton?.addEventListener('click', () => {
  const isOpen = document.body.classList.toggle('menu-open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
  menuButton.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
});

navLinks.forEach((link) => link.addEventListener('click', closeMenu));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('menu-open')) {
    closeMenu();
    menuButton?.focus();
  }
});

const form = document.querySelector('#project-form');
const formStatus = document.querySelector('#form-status');
form?.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const subject = `Website enquiry: ${data.get('business') || data.get('name') || 'New project'}`;
  const body = [
    `Name: ${data.get('name') || ''}`,
    `Email: ${data.get('email') || ''}`,
    `Business or project: ${data.get('business') || ''}`,
    `Timing: ${data.get('timing') || ''}`,
    `Budget: ${data.get('budget') || ''}`,
    '',
    'Project details:',
    data.get('details') || ''
  ].join('\n');

  if (formStatus) {
    formStatus.textContent = 'Email draft prepared for suhayb@lcmb.co.uk. If it did not open, use the direct email link.';
  }

  window.location.href = `mailto:suhayb@lcmb.co.uk?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});
