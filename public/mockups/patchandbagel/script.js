const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
menuButton?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
});
nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
}));

// A complete local fallback is the default. Genuine site photography replaces it only after loading successfully.
document.querySelectorAll('[data-image-stage]').forEach(stage => {
  const image = stage.querySelector(':scope > img');
  const source = image?.dataset.src;
  stage.classList.add('is-fallback');
  if (!image || !source) return;
  const loader = new Image();
  loader.onload = () => {
    image.src = source;
    stage.classList.remove('is-fallback');
  };
  loader.onerror = () => stage.classList.add('is-fallback');
  loader.src = source;
});

const unitPrice = document.getElementById('unit-price');
const unitNote = document.getElementById('unit-note');
document.querySelectorAll('.quantity-tab').forEach(tab => tab.addEventListener('click', () => {
  document.querySelectorAll('.quantity-tab').forEach(item => item.classList.remove('active'));
  tab.classList.add('active');
  unitPrice.textContent = tab.dataset.price;
  unitNote.textContent = tab.dataset.note;
}));

const modal = document.getElementById('quote-modal');
const firstInput = document.getElementById('quote-email');
function openModal(){modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');setTimeout(()=>firstInput.focus(),250)}
function closeModal(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open')}
document.querySelectorAll('[data-open-quote]').forEach(button => button.addEventListener('click', openModal));
document.querySelectorAll('[data-close-quote]').forEach(button => button.addEventListener('click', closeModal));
document.addEventListener('keydown', event => {if(event.key === 'Escape' && modal.classList.contains('open')) closeModal()});

document.getElementById('quote-form')?.addEventListener('submit', event => {
  event.preventDefault();
  const email = document.getElementById('quote-email').value.trim();
  const type = document.getElementById('quote-type').value;
  const quantity = document.getElementById('quote-quantity').value;
  const notes = document.getElementById('quote-notes').value.trim();
  const subject = encodeURIComponent(`Custom patch quote request — ${quantity} pieces`);
  const body = encodeURIComponent(`Hi Jessica,\n\nI'd like a quote for a custom patch order.\n\nWork email: ${email}\nPatch type: ${type}\nQuantity: ${quantity}\nProject notes: ${notes || 'I will share the artwork and details separately.'}\n\nPlease let me know what else you need.\n`);
  window.location.href = `mailto:jessica@patchandbagel.com?subject=${subject}&body=${body}`;
});
