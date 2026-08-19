'use strict';

const search = document.getElementById('sku-search');
const clearSearch = document.getElementById('clear-search');
const filterButtons = [...document.querySelectorAll('.filter-button')];
const cards = [...document.querySelectorAll('.product-card')];
const count = document.getElementById('result-count');
const emptyState = document.getElementById('empty-state');
const chips = [...document.querySelectorAll('.sku-chip')];
const menuToggle = document.querySelector('.menu-toggle');
const mobileNav = document.getElementById('mobile-nav');

let currentFilter = 'all';

function renderProducts() {
  const term = search.value.trim().toUpperCase();
  let visible = 0;

  cards.forEach(card => {
    const stockMatch = currentFilter === 'all' || card.dataset.stock === currentFilter;
    const skuMatch = !term || card.dataset.sku.includes(term);
    const show = stockMatch && skuMatch;
    card.hidden = !show;
    if (show) visible += 1;
  });

  count.textContent = `Showing ${visible} ${visible === 1 ? 'product' : 'products'}`;
  emptyState.hidden = visible !== 0;
}

filterButtons.forEach(button => {
  button.addEventListener('click', () => {
    currentFilter = button.dataset.filter;
    filterButtons.forEach(item => item.classList.toggle('active', item === button));
    renderProducts();
  });
});

search.addEventListener('input', renderProducts);
clearSearch.addEventListener('click', () => {
  search.value = '';
  search.focus();
  renderProducts();
});

chips.forEach(chip => {
  chip.addEventListener('click', () => {
    search.value = chip.dataset.sku;
    currentFilter = 'all';
    filterButtons.forEach(button => button.classList.toggle('active', button.dataset.filter === 'all'));
    renderProducts();
    document.getElementById('range').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

menuToggle.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!open));
  mobileNav.hidden = open;
});

mobileNav.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    menuToggle.setAttribute('aria-expanded', 'false');
    mobileNav.hidden = true;
  });
});

renderProducts();
