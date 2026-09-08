(()=>{
  if(/(?:admin|driver)\.html$/i.test(location.pathname))return;
  const IMAGES={
    taxi:'https://a.top4top.io/p_39037ruz91.jpg',
    private:'https://b.top4top.io/p_3903uole11.jpg',
    delivery:'https://d.top4top.io/p_3903w8nwl1.jpg',
    cargo:'https://e.top4top.io/p_39031nwfb1.jpg',
    starex:'https://f.top4top.io/p_3903d2ibm1.jpg',
    intercity:'https://c.top4top.io/p_3903gu3zr1.jpg'
  };
  const FALLBACK={taxi:'./assets/services/taxi.svg',private:'./assets/services/private.svg',delivery:'./assets/services/delivery.svg',cargo:'./assets/services/cargo.svg',starex:'./assets/services/private.svg',intercity:'./assets/services/intercity.svg'};
  const PRIMARY=['taxi','private','delivery','cargo','starex'];
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();

  ready(()=>{
    loadCss();
    const grid=document.getElementById('servicesGrid');
    const booking=document.getElementById('bookingServices');
    if(grid){applyHomeImages();new MutationObserver(()=>queueMicrotask(applyHomeImages)).observe(grid,{childList:true,subtree:true})}
    if(booking){applyBookingImages();new MutationObserver(()=>queueMicrotask(applyBookingImages)).observe(booking,{childList:true,subtree:true})}
    setTimeout(()=>{applyHomeImages();applyBookingImages()},250);
    setTimeout(()=>{applyHomeImages();applyBookingImages()},900);
    setTimeout(()=>{applyHomeImages();applyBookingImages()},1800);
  });

  function loadCss(){
    if(document.querySelector('link[href="./customer-service-images.css"]'))return;
    const l=document.createElement('link');l.rel='stylesheet';l.href='./customer-service-images.css';document.head.appendChild(l);
  }

  function makeImage(code,cls){
    const img=document.createElement('img');
    img.className=cls;
    img.src=IMAGES[code];
    img.alt=label(code);
    img.loading=code==='taxi'?'eager':'lazy';
    img.decoding='async';
    img.referrerPolicy='no-referrer';
    img.onerror=()=>{if(img.dataset.fallback==='1')return;img.dataset.fallback='1';img.src=FALLBACK[code]||'./assets/brand/mark.svg'};
    return img;
  }

  function label(code){return({taxi:'تكسي',private:'خصوصي',delivery:'دليفري',cargo:'حمل',starex:'ستاركس',intercity:'بين المحافظات'})[code]||code}

  function applyHomeImages(){
    const grid=document.getElementById('servicesGrid');if(!grid)return;
    grid.querySelectorAll('[data-service-code]').forEach(card=>{
      const code=card.dataset.serviceCode;if(!IMAGES[code])return;
      card.classList.toggle('jl-primary-service',PRIMARY.includes(code));
      card.classList.toggle('jl-intercity-service',code==='intercity');
      card.classList.add('jl-photo-service');
      card.querySelectorAll('.jl-service-photo').forEach((n,i)=>{if(i)n.remove()});
      let photo=card.querySelector('.jl-service-photo');
      if(!photo){photo=document.createElement('span');photo.className='jl-service-photo';photo.appendChild(makeImage(code,'jl-service-photo-img'));card.prepend(photo)}
      else if(!photo.querySelector('img'))photo.appendChild(makeImage(code,'jl-service-photo-img'));
      const icon=card.querySelector('.service-icon');if(icon)icon.setAttribute('aria-hidden','true');
      const lux=card.querySelector('.lux-service-media');if(lux)lux.setAttribute('aria-hidden','true');
    });
  }

  function applyBookingImages(){
    const box=document.getElementById('bookingServices');if(!box)return;
    box.querySelectorAll('[data-booking-service]').forEach(card=>{
      const code=card.dataset.bookingService;if(!IMAGES[code])return;
      card.classList.add('jl-booking-photo-service');
      if(!card.querySelector('.jl-booking-photo')){
        const wrap=document.createElement('span');wrap.className='jl-booking-photo';wrap.appendChild(makeImage(code,'jl-booking-photo-img'));card.prepend(wrap)
      }
      card.querySelector('.service-icon')?.setAttribute('aria-hidden','true');
    });
  }

  window.JEEBLI_SERVICE_IMAGES={refresh:()=>{applyHomeImages();applyBookingImages()},images:IMAGES};
})();
