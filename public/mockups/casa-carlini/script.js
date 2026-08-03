const menuButton=document.querySelector('.menu-button');
const navigation=document.querySelector('.primary-nav');

menuButton?.addEventListener('click',()=>{
  const open=navigation.classList.toggle('open');
  menuButton.setAttribute('aria-expanded',String(open));
});

navigation?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{
  navigation.classList.remove('open');
  menuButton?.setAttribute('aria-expanded','false');
}));

const formatButtons=document.querySelectorAll('[data-format]');
const price=document.getElementById('selected-price');
const detail=document.getElementById('format-detail');

formatButtons.forEach(button=>button.addEventListener('click',()=>{
  formatButtons.forEach(item=>item.classList.remove('active'));
  button.classList.add('active');
  price.textContent=button.dataset.price;
  detail.textContent=button.dataset.detail;
}));

const cover=document.querySelector('.book-cover');
const stage=document.querySelector('.cover-stage');

if(cover&&stage){
  const stableCover='https://books.google.com/books/content?id=hFx0tAEACAAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api';
  const loaded=()=>stage.classList.remove('image-failed');
  const failed=()=>stage.classList.add('image-failed');

  stage.classList.add('image-failed');
  cover.referrerPolicy='no-referrer';
  cover.addEventListener('load',loaded,{once:true});
  cover.addEventListener('error',failed,{once:true});
  cover.src=stableCover;

  window.setTimeout(()=>{
    if(!cover.naturalWidth)failed();
  },3500);
}
