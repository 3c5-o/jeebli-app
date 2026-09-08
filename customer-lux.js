(()=>{
  if(/(?:admin|driver)\.html$/i.test(location.pathname))return;
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  ready(init);

  const LOGO='https://e.top4top.io/p_3903njl7j1.jpg';
  const FALLBACK_LOGO='./assets/brand/mark.svg';
  const IMAGES={
    taxi:'https://a.top4top.io/p_39037ruz91.jpg',
    private:'https://b.top4top.io/p_3903uole11.jpg',
    delivery:'https://d.top4top.io/p_3903w8nwl1.jpg',
    cargo:'https://e.top4top.io/p_39031nwfb1.jpg',
    starex:'https://f.top4top.io/p_3903d2ibm1.jpg',
    intercity:'https://c.top4top.io/p_3903gu3zr1.jpg'
  };
  const DESCS={
    taxi:'تكسي المدينة بسرعة ووضوح',private:'سيارة خاصة لراحة وخصوصية أكثر',delivery:'توصيل طلبات وطرود داخل منطقتك',cargo:'نقل الأغراض والحمولات',starex:'نقل جماعي مريح للعائلة والمجموعة',intercity:'رحلات آمنة ومريحة بين المحافظات'
  };

  function init(){
    loadCss();applyThemeMeta();decorateBrand();injectHero();decorateServices();observeServices();
    window.addEventListener('load',()=>setTimeout(()=>{decorateBrand();decorateServices();},700));
  }
  function loadCss(){if(document.querySelector('link[href="./customer-lux.css"]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='./customer-lux.css';document.head.appendChild(l)}
  function applyThemeMeta(){
    const theme=document.querySelector('meta[name="theme-color"]');if(theme)theme.content='#061321';
    const status=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');if(status)status.content='black-translucent';
  }
  function logoImg(cls=''){const img=document.createElement('img');img.src=LOGO;img.alt='جيبلي';img.className=cls;img.referrerPolicy='no-referrer';img.onerror=()=>{if(img.src.endsWith('mark.svg'))return;img.src=FALLBACK_LOGO};return img}
  function decorateBrand(){
    const splash=document.querySelector('.splash-logo');if(splash&&!splash.querySelector('img')){splash.textContent='';splash.appendChild(logoImg())}
    const brand=document.querySelector('.brand-logo');if(brand&&!brand.querySelector('img')){brand.textContent='';brand.appendChild(logoImg())}
    document.querySelectorAll('.auth-copy h2').forEach(h=>h.textContent='كل الطرق أقرب إليك.');
    document.querySelectorAll('.auth-copy p:not(.kicker)').forEach(p=>p.textContent='اطلب وسيلة النقل المناسبة، استقبل عروض السائقين، واختر السعر والخدمة اللي تناسبك.');
  }
  function injectHero(){
    const home=document.getElementById('page-home');if(!home||document.getElementById('jlHero'))return;
    const map=home.querySelector('.home-map-card');if(!map)return;
    const hero=document.createElement('section');hero.id='jlHero';hero.className='jl-hero';
    hero.innerHTML=`<img class="jl-hero-logo" src="${LOGO}" alt="جيبلي" referrerpolicy="no-referrer"><div class="jl-hero-copy"><span class="jl-hero-eyebrow">✦ JEEBLI PREMIUM</span><h2>مشوارك يبدأ من هنا</h2><p>تكسي، خصوصي، دليفري، حمل، ستاركس وسفر — كلها من مكان واحد.</p><button class="jl-hero-btn" type="button">اطلب الآن</button><div class="jl-hero-badges"><span>سعر بالاتفاق</span><span>سائقون حسب منطقتك</span><span>تتبع مباشر</span></div></div>`;
    hero.querySelector('img').onerror=e=>e.currentTarget.src=FALLBACK_LOGO;
    hero.querySelector('button').onclick=()=>window.openBooking?.('taxi');
    map.insertAdjacentElement('beforebegin',hero);
  }
  function observeServices(){
    ['servicesGrid','bookingServices'].forEach(id=>{const box=document.getElementById(id);if(!box)return;new MutationObserver(()=>decorateServices()).observe(box,{childList:true,subtree:true})});
  }
  function decorateServices(){
    document.querySelectorAll('[data-service-code]').forEach(card=>decorateHomeCard(card,card.dataset.serviceCode));
    document.querySelectorAll('[data-booking-service]').forEach(card=>decorateBookingCard(card,card.dataset.bookingService));
  }
  function decorateHomeCard(card,code){
    const url=IMAGES[code];if(!url||card.dataset.luxDone==='1')return;card.dataset.luxDone='1';card.classList.add('lux-service-card');
    let media=document.createElement('span');media.className='lux-service-media';const img=document.createElement('img');img.src=url;img.alt=card.querySelector('strong')?.textContent||code;img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.onerror=()=>{media.style.display='none'};media.appendChild(img);card.prepend(media);
    const copy=card.querySelector('.service-copy');if(copy){const small=copy.querySelector('small');if(small&&DESCS[code])small.textContent=DESCS[code]}
    const arrow=document.createElement('span');arrow.className='lux-service-arrow';arrow.textContent='‹';card.appendChild(arrow);
  }
  function decorateBookingCard(card,code){
    const url=IMAGES[code];if(!url||card.dataset.luxDone==='1')return;card.dataset.luxDone='1';card.classList.add('lux-booking-service');
    const img=document.createElement('img');img.className='lux-booking-img';img.src=url;img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();card.prepend(img);
    const small=card.querySelector('small');if(small&&DESCS[code])small.textContent=DESCS[code];
  }

  window.JEEBLI_LUX={logo:LOGO,images:IMAGES,refresh:()=>{decorateBrand();injectHero();decorateServices()}};
})();
