const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('#main-nav');

function setMenu(open) {
  menuButton.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('is-open', open);
}

menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  setMenu(open);
});

nav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => setMenu(false));
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 900) setMenu(false);
});
