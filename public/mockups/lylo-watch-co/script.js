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

const stages=[...document.querySelectorAll('[data-image]')];
const galleryButtons=[...document.querySelectorAll('[data-gallery-button]')];
galleryButtons.forEach(button=>button.addEventListener('click',()=>{
  const target=button.dataset.galleryButton;
  galleryButtons.forEach(item=>item.classList.toggle('active',item===button));
  stages.forEach(stage=>stage.classList.toggle('active',stage.dataset.image===target));
}));

document.querySelectorAll('.image-stage,.media-card,.finishing-media').forEach(stage=>{
  const image=stage.querySelector('img');
  if(!image)return;
  const loaded=()=>stage.classList.remove('image-failed');
  const failed=()=>stage.classList.add('image-failed');
  stage.classList.add('image-failed');
  image.addEventListener('load',loaded,{once:true});
  image.addEventListener('error',failed,{once:true});
  if(image.complete){image.naturalWidth?loaded():failed();}
});
