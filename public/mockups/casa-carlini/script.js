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
  const loaded=()=>stage.classList.remove('image-failed');
  const failed=()=>stage.classList.add('image-failed');

  if(cover.complete){
    cover.naturalWidth?loaded():failed();
  }else{
    cover.addEventListener('load',loaded,{once:true});
    cover.addEventListener('error',failed,{once:true});
  }

  window.setTimeout(()=>{
    if(!cover.naturalWidth)failed();
  },2500);
}
