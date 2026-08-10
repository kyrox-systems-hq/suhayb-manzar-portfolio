const menuButton = document.querySelector('.menu-button');
const mainNav = document.querySelector('.main-nav');

if (menuButton && mainNav) {
  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    mainNav.classList.toggle('is-open', !isOpen);
  });

  mainNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    menuButton.setAttribute('aria-expanded', 'false');
    mainNav.classList.remove('is-open');
  }));
}

let selection = {
  colour: 'Yellow',
  plug: 'EU plug',
  size: 'Small',
  dimensions: 'Ø28 × H26 cm'
};

function renderSelection() {
  document.querySelector('#colour-value').textContent = selection.colour;
  document.querySelector('#plug-value').textContent = selection.plug;
  document.querySelector('#size-value').textContent = selection.size;
  document.querySelector('#choice-summary').textContent = `${selection.colour} · ${selection.plug} · ${selection.size} · ${selection.dimensions}`;
}

function activate(buttons, activeButton) {
  buttons.forEach(button => {
    const active = button === activeButton;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

const swatches = [...document.querySelectorAll('.swatch')];
swatches.forEach(button => button.addEventListener('click', () => {
  selection.colour = button.dataset.colour;
  activate(swatches, button);
  renderSelection();
}));

const plugButtons = [...document.querySelectorAll('.pill')];
plugButtons.forEach(button => button.addEventListener('click', () => {
  selection.plug = button.dataset.plug;
  activate(plugButtons, button);
  renderSelection();
}));

const sizeButtons = [...document.querySelectorAll('.size-button')];
sizeButtons.forEach(button => button.addEventListener('click', () => {
  selection.size = button.dataset.size;
  selection.dimensions = button.dataset.dimensions;
  activate(sizeButtons, button);
  renderSelection();
}));

const detailData = {
  product: {
    kicker: 'Product',
    title: 'One design, clearly configured.',
    items: [
      'Mushroom-shaped shade with a minimalist cylindrical base',
      'Yellow, Black, White and Green shade options currently listed',
      'EU, UK, US and AU plug options currently listed',
      'Small Ø28 × H26 cm and Large Ø40 × H37 cm sizes'
    ]
  },
  delivery: {
    kicker: 'Delivery',
    title: 'Set the expectation before checkout.',
    items: [
      'The current Eclipse listing publishes a 1–3 business-day shipping window',
      'The live listing describes the product as ready to ship worldwide',
      'Shipping cost is calculated by the current store at checkout',
      'Order questions can go directly to info@havenlux.store'
    ]
  },
  returns: {
    kicker: 'Returns',
    title: 'Use the official 30-day policy as the source of truth.',
    items: [
      'Haven Lux publishes a 30-day money-back guarantee',
      'The official FAQ says returns can be initiated within 30 days of delivery',
      'Returned items need original packaging and unused, resalable condition',
      'The FAQ says returns and exchanges are processed within 2–3 working days after receipt'
    ]
  }
};

const tabs = [...document.querySelectorAll('.detail-tab')];
const detailContent = document.querySelector('#detail-content');

tabs.forEach(tab => tab.addEventListener('click', () => {
  const key = tab.dataset.detail;
  const data = detailData[key];
  tabs.forEach(item => {
    const active = item === tab;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-selected', String(active));
  });
  detailContent.innerHTML = `
    <p class="detail-kicker">${data.kicker}</p>
    <h3>${data.title}</h3>
    <ul>${data.items.map(item => `<li>${item}</li>`).join('')}</ul>
  `;
}));

renderSelection();
