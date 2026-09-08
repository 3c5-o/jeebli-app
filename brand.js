(()=>{
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  ready(()=>{
    if(!document.querySelector('link[href="./brand.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='./brand.css';document.head.appendChild(l)}
    const mark='./assets/brand/mark.svg';
    ['.splash-logo','.brand-logo','.brand-mark','.admin-logo','.splash-mark'].forEach(sel=>document.querySelectorAll(sel).forEach(el=>{el.innerHTML=`<img src="${mark}" alt="جيبلي" />`}));
    const authCopy=document.querySelector('.auth-copy');if(authCopy&&!authCopy.querySelector('.jeebli-auth-hero')){const img=document.createElement('img');img.className='jeebli-auth-hero';img.src='./assets/brand/hero.svg';img.alt='جيبلي للنقل والتوصيل';authCopy.appendChild(img)}
    const asset={taxi:'taxi.svg',private:'private.svg',delivery:'delivery.svg',cargo:'cargo.svg',intercity:'intercity.svg'};
    function enhance(root=document){
      root.querySelectorAll('[data-service-code],[data-booking-service]').forEach(card=>{const code=card.dataset.serviceCode||card.dataset.bookingService,icon=card.querySelector('.service-icon');if(!icon||!asset[code]||icon.querySelector('img'))return;icon.innerHTML=`<img src="./assets/services/${asset[code]}" alt="" />`;card.classList.add('brand-service')});
    }
    enhance();
    ['servicesGrid','bookingServices'].forEach(id=>{const el=document.getElementById(id);if(el)new MutationObserver(()=>enhance(el)).observe(el,{childList:true,subtree:true})});
    const driverHero=document.querySelector('.driver-page.active .page-title');if(driverHero&&!driverHero.querySelector('.jeebli-service-banner')){const i=document.createElement('img');i.src='./assets/brand/driver-hero.svg';i.alt='جيبلي سائق';i.className='jeebli-service-banner';driverHero.appendChild(i)}
  });
})();