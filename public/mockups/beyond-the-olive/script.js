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

const combinations={
  '1':[
    ['Traditional 25-Star Balsamic','Barrel-aged in Modena, Italy'],
    ['Fig Balsamic','Made with California Mission figs'],
    ['Pasadena Blend EVOO','Signature California blend, big, grassy and peppery']
  ],
  '2':[
    ['Traditional 25-Star Balsamic','Barrel-aged in Modena, Italy'],
    ['Arroyo Seco EVOO','Gold Medal-winning California extra virgin olive oil'],
    ['Pasadena Blend EVOO','Signature California blend, big, grassy and peppery']
  ]
};
const selectionList=document.getElementById('selection-list');
const selectionLabel=document.getElementById('selection-label');
document.querySelectorAll('.style-option').forEach(button=>{
  button.addEventListener('click',()=>{
    document.querySelectorAll('.style-option').forEach(option=>{
      const selected=option===button;
      option.classList.toggle('selected',selected);
      option.setAttribute('aria-checked',String(selected));
    });
    const style=button.dataset.style;
    selectionLabel.textContent=`Style ${style} selected`;
    selectionList.innerHTML=combinations[style].map(([name,detail])=>`<li><strong>${name}</strong><span>${detail}</span></li>`).join('');
  });
});

const stage=document.querySelector('.product-stage');
const image=document.querySelector('.product-image');
if(stage&&image){
  const loaded=()=>stage.classList.remove('image-pending','image-failed');
  const failed=()=>{stage.classList.remove('image-pending');stage.classList.add('image-failed');};
  if(image.complete){image.naturalWidth?loaded():failed();}
  else{image.addEventListener('load',loaded,{once:true});image.addEventListener('error',failed,{once:true});}
  window.setTimeout(()=>{if(!image.naturalWidth)failed();},2500);
}
