(()=>{
  if(/(?:admin|driver)\.html$/i.test(location.pathname))return;
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  ready(init);

  function init(){
    loadCss();
    fixBodyScroll();
    bindReliableLocation();
    polishSchedule();
    watchBookingSteps();
    ensureLocalBrand();
    refreshImages();
    window.addEventListener('pageshow',()=>{fixBodyScroll();ensureLocalBrand();refreshImages()});
    window.addEventListener('appinstalled',()=>window.notify?.('تم تثبيت جيبلي على جهازك'));
    setTimeout(()=>{fixBodyScroll();refreshImages();ensureLocalBrand()},450);
    setTimeout(()=>{fixBodyScroll();refreshImages()},1500);
  }

  function loadCss(){
    ['./customer-final.css','./customer-v1-hotfix.css'].forEach(href=>{
      if(document.querySelector(`link[href="${href}"]`))return;
      const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.appendChild(l);
    });
  }

  function visibleModal(){
    return [...document.querySelectorAll('.sheet,.v2-sheet,.j-cancel-sheet,.j-address-choice-sheet')].some(el=>!el.classList.contains('hidden')&&getComputedStyle(el).display!=='none');
  }
  function syncModalLock(){
    const open=visibleModal();
    document.body.classList.toggle('jl-modal-open',open);
    if(!open){
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('position');
      document.body.style.removeProperty('height');
      document.documentElement.style.removeProperty('overflow');
    }
  }
  function fixBodyScroll(){
    syncModalLock();
    if(window.__JEEBLI_SCROLL_OBSERVER)return;
    window.__JEEBLI_SCROLL_OBSERVER=new MutationObserver(muts=>{
      if(muts.some(m=>m.type==='attributes'&&m.attributeName==='class'))queueMicrotask(syncModalLock);
    });
    window.__JEEBLI_SCROLL_OBSERVER.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
  }

  function bindReliableLocation(){
    const bind=(id,opts)=>{
      const el=document.getElementById(id);if(!el||el.dataset.jlGeoFinal==='1')return;
      el.dataset.jlGeoFinal='1';
      el.addEventListener('click',async e=>{
        const fn=window.JEEBLI_MOBILE?.retryLocation;
        if(!fn)return;
        e.preventDefault();e.stopImmediatePropagation();
        setGeoBusy(el,true);
        try{await fn(opts||{});setGeoHint('تم تحديد موقعك بنجاح','ok')}
        catch(err){setGeoHint(geoHint(err),'error')}
        finally{setGeoBusy(el,false)}
      },true);
    };
    bind('homeLocateBtn',{});bind('headerLocationBtn',{});bind('bookingLocateBtn',{forBooking:true});
    const retry=()=>{bind('homeLocateBtn',{});bind('headerLocationBtn',{});bind('bookingLocateBtn',{forBooking:true})};
    new MutationObserver(retry).observe(document.body,{subtree:true,childList:true});
  }
  function setGeoBusy(el,busy){
    if(!el)return;el.disabled=busy;el.classList.toggle('jl-geo-busy',busy);if(busy)el.setAttribute('aria-busy','true');else el.removeAttribute('aria-busy');
  }
  function geoHint(err){
    if(err?.code===1)return 'الموقع محظور. افتح إعدادات هذا الموقع في Chrome واسمح بإذن الموقع ثم جرّب مرة ثانية.';
    if(err?.code===2)return 'GPS غير متاح حالياً. شغّل خدمة الموقع من الهاتف وتأكد أن Chrome مسموح له باستخدامها.';
    if(err?.code===3)return 'GPS تأخر بالاستجابة. اطلع لمكان تكون به إشارة الموقع أفضل ثم أعد المحاولة.';
    return 'تعذر تحديد الموقع. تأكد من تشغيل GPS ومنح Chrome إذن الموقع.';
  }
  function setGeoHint(text,type){
    let box=document.getElementById('jlGeoHint');
    if(!box){
      box=document.createElement('div');box.id='jlGeoHint';box.className='jl-geo-hint';
      const map=document.querySelector('#page-home .home-map-card');if(map)map.insertAdjacentElement('afterend',box);else document.querySelector('#page-home')?.prepend(box);
    }
    box.className=`jl-geo-hint ${type||''}`;box.textContent=text;box.hidden=false;
    clearTimeout(window.__jlGeoHintTimer);window.__jlGeoHintTimer=setTimeout(()=>{if(box)box.hidden=true},7000);
  }

  function polishSchedule(){
    const input=document.getElementById('scheduledAt');if(!input)return;
    const updateMin=()=>{
      const d=new Date(Date.now()+15*60*1000);const pad=n=>String(n).padStart(2,'0');
      input.min=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    updateMin();setInterval(updateMin,60000);
    input.addEventListener('change',()=>{
      if(input.value&&new Date(input.value).getTime()<Date.now()+10*60*1000){input.value='';window.notify?.('اختر موعداً بعد 15 دقيقة على الأقل');}
    });
  }

  function watchBookingSteps(){
    const panel=document.querySelector('#bookingSheet .booking-sheet-panel');if(!panel)return;
    const steps=[...document.querySelectorAll('#bookingSheet .booking-step')];
    const scrollStart=()=>requestAnimationFrame(()=>panel.scrollTo({top:0,behavior:'smooth'}));
    const ob=new MutationObserver(m=>{if(m.some(x=>x.attributeName==='class'))scrollStart()});
    steps.forEach(s=>ob.observe(s,{attributes:true,attributeFilter:['class']}));
    document.getElementById('bookingSheet')?.addEventListener('touchmove',()=>{}, {passive:true});
  }

  function ensureLocalBrand(){
    const icon='./assets/brand/app-icon.svg';
    document.querySelectorAll('.splash-logo,.brand-logo').forEach(box=>{
      let img=box.querySelector('img');if(!img){box.textContent='';img=document.createElement('img');box.appendChild(img)}
      if(!img.src.includes('/assets/brand/app-icon.svg'))img.src=icon;img.alt='جيبلي';
    });
    let fav=document.querySelector('link[rel="icon"]');if(!fav){fav=document.createElement('link');fav.rel='icon';document.head.appendChild(fav)}fav.href=icon;fav.type='image/svg+xml';
    let apple=document.querySelector('link[rel="apple-touch-icon"]');if(!apple){apple=document.createElement('link');apple.rel='apple-touch-icon';document.head.appendChild(apple)}apple.href=icon;
    const theme=document.querySelector('meta[name="theme-color"]');if(theme)theme.content='#07101f';
  }

  function refreshImages(){
    window.JEEBLI_SERVICE_IMAGES?.refresh?.();
    window.JEEBLI_LUX?.refresh?.();
    const force={private:'./assets/services/private-photo.svg',delivery:'./assets/services/delivery-photo.svg'};
    Object.entries(force).forEach(([code,src])=>{
      document.querySelectorAll(`[data-service-code="${code}"],[data-booking-service="${code}"]`).forEach(card=>{
        const imgs=card.querySelectorAll('.jl-service-photo-img,.jl-booking-photo-img,.lux-service-media img,.lux-booking-img');
        imgs.forEach(img=>{if(!img.src.includes(src.replace('./','/')))img.src=src;img.style.display='block';img.style.opacity='1'});
      });
    });
  }

  window.JEEBLI_CUSTOMER_V1={syncScroll:syncModalLock,retryLocation:opts=>window.JEEBLI_MOBILE?.retryLocation?.(opts),refreshImages};
})();
