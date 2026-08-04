const menuButton=document.querySelector('.menu-button');
const nav=document.querySelector('.primary-nav');
menuButton?.addEventListener('click',()=>{
  const open=nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded',String(open));
});
nav?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{
  nav.classList.remove('open');
  menuButton?.setAttribute('aria-expanded','false');
}));

const mainImage=document.getElementById('main-product-image');
const imageNote=document.querySelector('.image-note');
const galleryButtons=document.querySelectorAll('[data-image]');
const mainFrame=document.querySelector('.main-media');

function watchImage(image,frame){
  if(!image||!frame)return;
  const loaded=()=>frame.classList.remove('image-failed');
  const failed=()=>frame.classList.add('image-failed');
  frame.classList.add('image-failed');
  image.addEventListener('load',loaded,{once:true});
  image.addEventListener('error',failed,{once:true});
  if(image.complete){image.naturalWidth?loaded():failed();}
}

watchImage(mainImage,mainFrame);
document.querySelectorAll('.media-frame img:not(#main-product-image)').forEach(image=>watchImage(image,image.closest('.media-frame')));

galleryButtons.forEach(button=>button.addEventListener('click',()=>{
  galleryButtons.forEach(item=>item.classList.remove('active'));
  button.classList.add('active');
  mainFrame.classList.add('image-failed');
  mainImage.src=button.dataset.image;
  mainImage.alt=`Tinynest baby carrier, ${button.dataset.label.toLowerCase()}`;
  imageNote.textContent=button.dataset.label;
  watchImage(mainImage,mainFrame);
}));
