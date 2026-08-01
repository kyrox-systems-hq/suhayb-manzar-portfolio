document.querySelectorAll('.brand img').forEach((image) => {
  const markLoaded = () => image.parentElement.classList.add('logo-loaded');
  if (image.complete && image.naturalWidth > 0) markLoaded();
  else image.addEventListener('load', markLoaded, { once: true });
});

const menuButton = document.querySelector('.menu-button');
const siteNav = document.querySelector('.site-nav');
const quoteModal = document.getElementById('quote-modal');
const quotePanel = quoteModal.querySelector('.quote-panel');
const quoteForm = document.getElementById('quote-form');
const firstInput = document.getElementById('quote-email');

menuButton?.addEventListener('click', () => {
  const isOpen = siteNav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
});

siteNav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    siteNav.classList.remove('open');
    menuButton?.setAttribute('aria-expanded', 'false');
  });
});

function openQuote() {
  quoteModal.classList.add('open');
  quoteModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  window.setTimeout(() => firstInput.focus(), 250);
}

function closeQuote() {
  quoteModal.classList.remove('open');
  quoteModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

document.querySelectorAll('[data-open-quote]').forEach((button) => button.addEventListener('click', openQuote));
document.querySelectorAll('[data-close-quote]').forEach((button) => button.addEventListener('click', closeQuote));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && quoteModal.classList.contains('open')) closeQuote();
});

quotePanel.addEventListener('click', (event) => event.stopPropagation());

const unitPrice = document.getElementById('unit-price');
const priceNote = document.getElementById('price-note');
document.querySelectorAll('.quantity-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.quantity-tab').forEach((item) => item.classList.remove('active'));
    tab.classList.add('active');
    unitPrice.textContent = tab.dataset.price;
    priceNote.textContent = tab.dataset.note;
  });
});

quoteForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const email = document.getElementById('quote-email').value.trim();
  const type = document.getElementById('quote-type').value;
  const quantity = document.getElementById('quote-quantity').value;
  const notes = document.getElementById('quote-notes').value.trim();
  const subject = encodeURIComponent(`Custom patch quote request — ${quantity} pieces`);
  const body = encodeURIComponent(
    `Hi Jessica,\n\nI'd like a quote for a custom patch order.\n\nWork email: ${email}\nPatch type: ${type}\nQuantity: ${quantity}\nProject notes: ${notes || 'I will share the details and artwork separately.'}\n\nPlease let me know what else you need.\n`
  );
  window.location.href = `mailto:jessica@patchandbagel.com?subject=${subject}&body=${body}`;
});
