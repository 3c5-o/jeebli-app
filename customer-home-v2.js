(()=>{
  if(/(?:admin|driver)\.html$/i.test(location.pathname))return;
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  ready(init);

  function init(){
    loadCss();
    const home=document.getElementById('page-home');
    if(!home)return;
    home.classList.add('jl-reference-home');

    // Remove the previous marketing hero; the new reference layout starts directly with the map.
    document.getElementById('jlHero')?.remove();

    buildMapToolbar(home);
    buildDestinationPanel(home);
    prepareServices(home);
    buildComingSoon(home);
    tuneBanner(home);
    syncHomeState(home);

    new MutationObserver(()=>syncHomeState(home)).observe(home,{attributes:true,attributeFilter:['class']});
    const services=document.getElementById('servicesGrid');
    if(services)new MutationObserver(()=>prepareServices(home)).observe(services,{childList:true,subtree:true});
    setTimeout(()=>{prepareServices(home);window.lucide?.createIcons()},700);
  }

  function loadCss(){
    if(document.querySelector('link[href="./customer-home-v2.css"]'))return;
    const l=document.createElement('link');l.rel='stylesheet';l.href='./customer-home-v2.css';document.head.appendChild(l);
  }

  function syncHomeState(home){
    document.body.classList.toggle('jl-home-active',home.classList.contains('active'));
  }

  function buildMapToolbar(home){
    const map=home.querySelector('.home-map-card');
    if(!map||map.querySelector('.jl-map-toolbar'))return;
    const toolbar=document.createElement('div');
    toolbar.className='jl-map-toolbar';
    toolbar.innerHTML=`
      <button type="button" class="jl-map-profile" aria-label="الحساب"><i data-lucide="user-round"></i></button>
      <button type="button" class="jl-map-location" aria-label="الموقع"><i data-lucide="map-pin"></i><span>حدد موقعك</span><i data-lucide="chevron-down"></i></button>
      <button type="button" class="jl-map-notifications" aria-label="الإشعارات"><i data-lucide="bell"></i><b class="jl-map-notif-dot"></b></button>`;
    map.prepend(toolbar);

    const originalProfile=document.getElementById('profileAvatarBtn');
    const originalLocation=document.getElementById('headerLocationBtn');
    const originalLocationText=document.getElementById('headerLocationText');
    const originalNotif=document.querySelector('.header-action[data-page-target="notifications"]');
    const originalDot=document.getElementById('notifDot');
    const locText=toolbar.querySelector('.jl-map-location span');
    const dot=toolbar.querySelector('.jl-map-notif-dot');

    toolbar.querySelector('.jl-map-profile').onclick=()=>originalProfile?.click();
    toolbar.querySelector('.jl-map-location').onclick=()=>originalLocation?.click();
    toolbar.querySelector('.jl-map-notifications').onclick=()=>originalNotif?.click();

    const sync=()=>{
      if(locText)locText.textContent=originalLocationText?.textContent?.trim()||'حدد موقعك';
      if(dot)dot.classList.toggle('hidden',originalDot?.classList.contains('hidden')??true);
    };
    sync();
    if(originalLocationText)new MutationObserver(sync).observe(originalLocationText,{childList:true,characterData:true,subtree:true});
    if(originalDot)new MutationObserver(sync).observe(originalDot,{attributes:true,attributeFilter:['class']});
    window.lucide?.createIcons();
  }

  function buildDestinationPanel(home){
    const map=home.querySelector('.home-map-card');
    if(!map||document.getElementById('jlDestinationPanel'))return;
    const panel=document.createElement('section');
    panel.id='jlDestinationPanel';
    panel.className='jl-destination-panel';
    panel.innerHTML=`
      <button type="button" class="jl-destination-main">
        <span class="jl-destination-dot"></span>
        <span><strong>إلى أين تذهب؟</strong><small>حدد رحلتك واستقبل عروض السائقين من نفس الشاشة</small></span>
        <i data-lucide="chevron-left"></i>
      </button>
      <button type="button" class="jl-discover-btn"><i data-lucide="map-pinned"></i><span>اكتشف خدماتنا في منطقتك</span></button>`;
    map.insertAdjacentElement('afterend',panel);
    panel.querySelector('.jl-destination-main').onclick=()=>document.getElementById('homeSearchBtn')?.click();
    panel.querySelector('.jl-discover-btn').onclick=()=>document.getElementById('servicesGrid')?.scrollIntoView({behavior:'smooth',block:'center'});
    window.lucide?.createIcons();
  }

  function prepareServices(home){
    const grid=document.getElementById('servicesGrid');
    if(!grid)return;
    const section=grid.closest('.section-block');
    if(section){
      section.classList.add('jl-services-section');
      const head=section.querySelector('.section-head');
      if(head&&!head.dataset.homeV2){
        head.dataset.homeV2='1';
        head.innerHTML='<div><p class="kicker">خدمات النقل</p><h2>اختر خدمتك</h2></div>';
      }
    }

    const primary=['taxi','private','delivery','cargo','starex'];
    grid.querySelectorAll('[data-service-code]').forEach(card=>{
      const code=card.dataset.serviceCode;
      card.classList.toggle('jl-primary-service',primary.includes(code));
      card.classList.toggle('jl-intercity-service',code==='intercity');
      card.classList.toggle('jl-future-service',['restaurants','markets','home_services'].includes(code));
      if(primary.includes(code)){
        card.querySelector('.lux-service-arrow')?.remove();
        const small=card.querySelector('.service-copy small');if(small)small.style.display='none';
      }
    });
  }

  function buildComingSoon(home){
    const serviceSection=document.getElementById('servicesGrid')?.closest('.section-block');
    if(!serviceSection||document.getElementById('jlComingSection'))return;
    const section=document.createElement('section');
    section.id='jlComingSection';
    section.className='jl-coming-section';
    section.innerHTML=`
      <div class="jl-coming-head"><div><p class="kicker">قريباً في جيبلي</p><h2>المطاعم والأسواق</h2></div><button type="button">عرض الكل <i data-lucide="chevron-left"></i></button></div>
      <div class="jl-coming-scroll">
        <button type="button" data-coming="restaurants"><span class="jl-coming-icon"><i data-lucide="utensils"></i></span><strong>المطاعم</strong><small>قريباً</small></button>
        <button type="button" data-coming="markets"><span class="jl-coming-icon"><i data-lucide="shopping-cart"></i></span><strong>الأسواق</strong><small>قريباً</small></button>
        <button type="button" data-coming="services"><span class="jl-coming-icon"><i data-lucide="wrench"></i></span><strong>خدمات أخرى</strong><small>قريباً</small></button>
        <button type="button" data-coming="offices"><span class="jl-coming-icon"><i data-lucide="building-2"></i></span><strong>المكاتب</strong><small>قريباً</small></button>
      </div>
      <button type="button" class="jl-fast-banner"><span class="jl-fast-icon"><i data-lucide="zap"></i></span><span><strong>طلب أسرع وتنظيم أوضح</strong><small>اطلب الآن وتابع حالة طلبك من نفس الشاشة</small></span><i data-lucide="chevron-left"></i></button>`;
    serviceSection.insertAdjacentElement('afterend',section);
    section.querySelectorAll('[data-coming],.jl-coming-head>button').forEach(b=>b.onclick=()=>window.notify?.('هذا القسم قيد التجهيز وقريباً داخل جيبلي'));
    section.querySelector('.jl-fast-banner').onclick=()=>document.getElementById('homeSearchBtn')?.click();
    window.lucide?.createIcons();
  }

  function tuneBanner(home){
    const banner=home.querySelector('.feature-banner');
    if(banner)banner.classList.add('jl-reference-banner');
    const quick=home.querySelector('.quick-section');
    if(quick)quick.classList.add('jl-reference-quick');
  }
})();