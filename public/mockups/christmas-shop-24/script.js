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

const input=document.getElementById('personalisation');
const count=document.getElementById('character-count');
const orderName=document.getElementById('order-name');
const status=document.getElementById('review-status');
const addButton=document.getElementById('add-button');
const quantity=document.getElementById('quantity');
let qty=1;

function updatePersonalisation(){
  const value=input.value.trim();
  count.textContent=`${input.value.length}/60`;
  orderName.textContent=value || 'Waiting for your wording';
  const ready=value.length>0;
  status.textContent=ready ? 'Ready to order' : 'Not ready';
  status.classList.toggle('ready',ready);
  addButton.classList.toggle('disabled',!ready);
  addButton.setAttribute('aria-disabled',String(!ready));
  addButton.textContent=ready ? `Continue with “${value}”` : 'Add your personalisation first';
}
input?.addEventListener('input',updatePersonalisation);

document.getElementById('minus')?.addEventListener('click',()=>{
  qty=Math.max(1,qty-1);
  quantity.textContent=String(qty);
});
document.getElementById('plus')?.addEventListener('click',()=>{
  qty=Math.min(10,qty+1);
  quantity.textContent=String(qty);
});

document.querySelectorAll('.detail-row').forEach(button=>{
  button.addEventListener('click',()=>{
    const panel=button.nextElementSibling;
    const open=button.classList.toggle('open');
    panel.classList.toggle('open',open);
    button.setAttribute('aria-expanded',String(open));
    button.querySelector('b').textContent=open?'−':'+';
  });
});

const stage=document.querySelector('.product-stage');
const image=document.querySelector('.product-image');
if(stage&&image){
  const loaded=()=>{
    stage.classList.remove('image-pending','image-failed');
  };
  const failed=()=>{
    stage.classList.remove('image-pending');
    stage.classList.add('image-failed');
  };
  if(image.complete){
    image.naturalWidth?loaded():failed();
  }else{
    image.addEventListener('load',loaded,{once:true});
    image.addEventListener('error',failed,{once:true});
  }
  window.setTimeout(()=>{if(!image.naturalWidth)failed();},3500);
}
